"""
Sailog backend (Flask).

Este servicio expone endpoints tipo webhook que consume la app (Glide):

- POST /process-vakaros:
  Descarga un CSV de Vakaros, genera artefactos (series 1Hz, GeoJSON, resumen)
  y los sube a Google Cloud Storage bajo `sessions/<url_uid>/...`.
- POST /generate-report:
  Normaliza el payload, genera un PDF (Playwright) y lo sube a GCS bajo
  `<REPORT_PREFIX>/<url_uid>.pdf`.

Seguridad:
- Requiere `auth_token` en el body y lo valida contra `GLIDE_SHARED_SECRET`.
- El token se elimina del payload lo antes posible para evitar logging accidental.

Config (env vars):
- GCS_BUCKET: bucket para artefactos de Vakaros.
- REPORT_BUCKET: bucket para PDFs.
- GLIDE_*_WEBHOOK_URL / GLIDE_*_BEARER_TOKEN: callbacks hacia Glide.
- REPORT_PREFIX, *_CACHE_CONTROL: opcionales.
"""

import os
import re
import secrets
import time
import hashlib
import csv
import io
import json
from urllib.parse import urlparse
import requests
from flask import Flask, request, jsonify, abort, make_response
from google.cloud import storage
from google.api_core.exceptions import PreconditionFailed, NotFound
from werkzeug.exceptions import HTTPException
from generate_report import normalize_payload, render_report_pdf_bytes, get_report_id
from render_gps_vkr_data import render_gps_vkr_data

app = Flask(__name__)
BUCKET = os.environ.get("GCS_BUCKET")
GLIDE_SHARED_SECRET = os.environ.get("GLIDE_SHARED_SECRET")
REPORT_PREFIX = os.environ.get("REPORT_PREFIX", "reports")
REPORT_BUCKET = os.environ.get("REPORT_BUCKET")
GLIDE_REPORT_WEBHOOK_URL = os.environ.get("GLIDE_REPORT_WEBHOOK_URL")
GLIDE_REPORT_BEARER_TOKEN = os.environ.get("GLIDE_REPORT_BEARER_TOKEN")
GLIDE_VAKAROS_WEBHOOK_URL = os.environ.get("GLIDE_VAKAROS_WEBHOOK_URL")
GLIDE_VAKAROS_BEARER_TOKEN = os.environ.get("GLIDE_VAKAROS_BEARER_TOKEN")
VAKAROS_CACHE_CONTROL = os.environ.get("VAKAROS_CACHE_CONTROL", "public, max-age=31536000")
REPORT_CACHE_CONTROL = os.environ.get("REPORT_CACHE_CONTROL", "public, max-age=31536000, immutable")
URL_UID_RE = re.compile(r"^[A-Za-z0-9_-]{16,128}$")
TRIM_MAX = 5
TRIM_NAME_MAX = 40
TRIM_MAX_BUOYS = 50
TRIM_CACHE_CONTROL = "no-store"
TRIM_INDEX_CACHE_CONTROL = "no-cache"
ALLOWED_TRIM_ORIGINS = {
    "http://localhost:8081",
    "http://127.0.0.1:8081",
}

# ---------- logging ----------
def _preview_bytes(data: bytes, limit=400):
    if not data:
        return ""
    if len(data) > limit:
        data = data[:limit] + b"..."
    return data.decode("utf-8", errors="replace")

def _sha256_8(value: str) -> str:
    if value is None:
        return ""
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:8]

def _glide_url_meta(url: str) -> dict:
    try:
        parsed = urlparse(url)
        # Avoid logging trigger IDs or secrets embedded in the path.
        return {
            "netloc": parsed.netloc,
            "path_len": len(parsed.path or ""),
            "path_hash": _sha256_8(parsed.path or ""),
        }
    except Exception:
        return {"netloc": "", "path_len": 0, "path_hash": ""}

def _normalize_bearer_token(raw: str) -> str:
    token = (raw or "").strip()
    # Some secrets are stored as "Bearer <token>". Normalize to "<token>".
    if token.lower().startswith("bearer "):
        token = token.split(None, 1)[1].strip() if len(token.split(None, 1)) > 1 else ""
    return token

@app.errorhandler(HTTPException)
def handle_http_exception(e: HTTPException):
    # Keep webhook endpoints JSON-only to make failures easier to diagnose (e.g. Glide).
    if request.path in {"/process-vakaros", "/generate-report"}:
        app.logger.warning("http_error path=%s code=%s desc=%s", request.path, e.code, e.description)
        return jsonify({"status": "error", "error": e.description}), e.code
    return e


# Bucket safety: never mix vakaros vs reports in prod (Cloud Run).
if BUCKET and REPORT_BUCKET and BUCKET == REPORT_BUCKET:
    raise RuntimeError("misconfig: GCS_BUCKET and REPORT_BUCKET must be different")
if os.environ.get("K_SERVICE"):
    if not BUCKET:
        raise RuntimeError("misconfig: GCS_BUCKET is required in Cloud Run")
    if not REPORT_BUCKET:
        raise RuntimeError("misconfig: REPORT_BUCKET is required in Cloud Run")
    if not GLIDE_SHARED_SECRET:
        raise RuntimeError("misconfig: GLIDE_SHARED_SECRET is required in Cloud Run")
    if not GLIDE_REPORT_WEBHOOK_URL:
        raise RuntimeError("misconfig: GLIDE_REPORT_WEBHOOK_URL is required in Cloud Run")
    if not GLIDE_REPORT_BEARER_TOKEN:
        raise RuntimeError("misconfig: GLIDE_REPORT_BEARER_TOKEN is required in Cloud Run")
    if not GLIDE_VAKAROS_WEBHOOK_URL:
        raise RuntimeError("misconfig: GLIDE_VAKAROS_WEBHOOK_URL is required in Cloud Run")
    if not GLIDE_VAKAROS_BEARER_TOKEN:
        raise RuntimeError("misconfig: GLIDE_VAKAROS_BEARER_TOKEN is required in Cloud Run")
    if BUCKET != "sailog-vakaros":
        raise RuntimeError(f"misconfig: GCS_BUCKET must be 'sailog-vakaros' (got '{BUCKET}')")
    if REPORT_BUCKET != "sailog-reports":
        raise RuntimeError(f"misconfig: REPORT_BUCKET must be 'sailog-reports' (got '{REPORT_BUCKET}')")

# ---------- helpers ----------
def parse_json_body(req):
    payload = req.get_json(force=True, silent=True)
    if payload is None:
        app.logger.warning(
            "bad_request: invalid or missing JSON content_type=%s data_prefix=%s",
            request.content_type,
            _preview_bytes(request.get_data(cache=True)),
        )
        abort(400, "invalid or missing JSON")
    if isinstance(payload, list):
        if not payload or not isinstance(payload[0], dict):
            app.logger.warning("bad_request: invalid JSON list payload_type=%s", type(payload[0]).__name__ if payload else "empty")
            abort(400, "invalid JSON")
        payload = payload[0]
    if not isinstance(payload, dict):
        app.logger.warning("bad_request: invalid JSON payload_type=%s", type(payload).__name__)
        abort(400, "invalid JSON")
    body = payload.get("body")
    if body is None:
        # Compatibility: some callers (e.g. Glide) send the fields at the top level.
        # Accept both shapes:
        #   {"body": {...}}  (preferred)
        #   {...}            (legacy/compat)
        app.logger.info("compat: missing body wrapper; using payload as body top_keys=%s", list(payload.keys())[:50])
        return payload
    if not isinstance(body, dict):
        app.logger.warning("bad_request: invalid body body_type=%s", type(body).__name__)
        abort(400, "invalid body")
    return body

def require_auth(body):
    if not GLIDE_SHARED_SECRET:
        app.logger.error("misconfig: GLIDE_SHARED_SECRET is required")
        abort(500, "misconfig: GLIDE_SHARED_SECRET is required")
    token = body.get("auth_token")
    # Never keep secrets in the in-memory payload (helps avoid accidental logging).
    body.pop("auth_token", None)
    if not token or token != GLIDE_SHARED_SECRET:
        app.logger.warning(
            "unauthorized: bad token token_present=%s body_keys=%s",
            bool(token),
            list(body.keys())[:50],
        )
        abort(401, "bad token")

def generate_url_uid():
    return secrets.token_urlsafe(32)

def normalize_url_uid(raw):
    if raw is None:
        return ""
    uid = str(raw).strip()
    if not uid:
        return ""
    if not URL_UID_RE.match(uid):
        raise ValueError("url_uid must be URL-safe (letters, digits, '_' or '-')")
    return uid

def truncate_error(err, limit=400):
    msg = str(err).strip()
    if len(msg) > limit:
        return msg[:limit] + "…"
    return msg

def gcs_client():
    # Reuse the client between requests (Cloud Run keeps the instance warm).
    global _GCS_CLIENT
    try:
        client = _GCS_CLIENT
    except NameError:
        client = None
    if client is None:
        client = storage.Client()
        _GCS_CLIENT = client
    return client

def ensure_cache_control(blob, cache_control):
    if not cache_control:
        return False
    try:
        blob.reload()
        if blob.cache_control != cache_control:
            blob.cache_control = cache_control
            blob.patch()
            return True
    except Exception:
        return False
    return False

def add_trim_cors(resp):
    origin = request.headers.get("Origin", "")
    if origin in ALLOWED_TRIM_ORIGINS:
        resp.headers["Access-Control-Allow-Origin"] = origin
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type, If-None-Match"
        resp.headers["Access-Control-Allow-Methods"] = "GET,POST,DELETE,OPTIONS"
        resp.headers["Access-Control-Expose-Headers"] = "ETag"
        resp.headers["Vary"] = "Origin"
    return resp

def _quote_etag(etag: str) -> str:
    raw = (etag or "").strip()
    if not raw:
        return ""
    if raw.startswith("W/"):
        return raw
    if raw.startswith('"') and raw.endswith('"'):
        return raw
    return '"' + raw.strip('"') + '"'

def _if_none_match_has_etag(if_none_match: str, etag: str) -> bool:
    inm = (if_none_match or "").strip()
    tag = (etag or "").strip()
    if not inm or not tag:
        return False
    candidates = [c.strip() for c in inm.split(",") if c.strip()]
    return tag in candidates

def get_session_rows_1hz(bucket, url_uid):
    blob = gcs_client().bucket(bucket).blob(f"sessions/{url_uid}/summary.csv")
    if not blob.exists():
        return None
    try:
        text = blob.download_as_text()
        reader = csv.DictReader(io.StringIO(text))
        row = next(reader, None)
        if not row:
            return None
        rows = int(float(row.get("rows_1hz") or 0))
        return rows if rows > 0 else None
    except Exception:
        return None

def sanitize_buoys(raw):
    if not isinstance(raw, list):
        return []
    out = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        btype = str(item.get("type") or "").strip().lower()
        if btype not in {"windward", "leeward"}:
            continue
        try:
            lat = float(item.get("lat"))
            lon = float(item.get("lon"))
        except Exception:
            continue
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            continue
        out.append({"type": btype, "lat": lat, "lon": lon})
        if len(out) >= TRIM_MAX_BUOYS:
            break
    return out

def list_trims(bucket, url_uid):
    prefix = f"sessions/{url_uid}/trims/trim"
    trims = []
    for blob in gcs_client().bucket(bucket).list_blobs(prefix=prefix):
        name = blob.name
        m = re.match(rf"^sessions/{re.escape(url_uid)}/trims/trim([1-9][0-9]*)\.json$", name)
        if not m:
            continue
        slot = int(m.group(1))
        if slot < 1 or slot > TRIM_MAX:
            continue
        trim_id = f"trim{slot}"
        trim_name = ""
        start_idx = None
        end_idx = None
        try:
            data = json.loads(blob.download_as_text())
            trim_name = str(data.get("name") or "").strip()
            start_idx = int(data.get("start_idx"))
            end_idx = int(data.get("end_idx"))
        except Exception:
            trim_name = ""
            start_idx = None
            end_idx = None
        label = f"{trim_id}-{trim_name or 'unnamed'}"
        trims.append({
            "id": trim_id,
            "name": trim_name,
            "label": label,
            "start_idx": start_idx,
            "end_idx": end_idx,
        })
    return sort_trim_items(trims)

def trim_index_path(url_uid):
    return f"sessions/{url_uid}/trims/index.json"

def normalize_trim_slot_id(trim_id: str):
    m = re.match(r"^trim([1-9][0-9]*)$", str(trim_id or "").strip())
    if not m:
        return None
    slot = int(m.group(1))
    if slot < 1 or slot > TRIM_MAX:
        return None
    return slot

def sort_trim_items(items):
    def key(item):
        slot = normalize_trim_slot_id(item.get("id")) if isinstance(item, dict) else None
        return slot if slot is not None else 9999
    return sorted([i for i in items if isinstance(i, dict)], key=key)

def update_trim_index(bucket_name, url_uid, trim_item, max_retries=6):
    if not bucket_name:
        return False
    if not isinstance(trim_item, dict):
        return False
    if not normalize_trim_slot_id(trim_item.get("id")):
        return False

    bucket = gcs_client().bucket(bucket_name)
    path = trim_index_path(url_uid)

    for _ in range(max_retries):
        existing = bucket.get_blob(path)
        now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        if existing is None:
            index = {
                "schema": 1,
                "url_uid": url_uid,
                "updated_at": now,
                "trims": sort_trim_items([trim_item]),
            }
            blob = bucket.blob(path)
            blob.cache_control = TRIM_INDEX_CACHE_CONTROL
            try:
                blob.upload_from_string(
                    json.dumps(index, ensure_ascii=False).encode("utf-8"),
                    content_type="application/json",
                    if_generation_match=0,
                )
                try:
                    blob.make_public()
                except Exception:
                    pass
                return True
            except PreconditionFailed:
                continue

        generation = existing.generation
        try:
            text = existing.download_as_text()
            data = json.loads(text)
        except Exception:
            data = {}

        trims = []
        if isinstance(data, dict) and isinstance(data.get("trims"), list):
            trims = [t for t in data.get("trims") if isinstance(t, dict)]
        trims = [t for t in trims if t.get("id") != trim_item.get("id")]
        trims.append(trim_item)
        trims = sort_trim_items(trims)[:TRIM_MAX]

        index = {
            "schema": 1,
            "url_uid": url_uid,
            "updated_at": now,
            "trims": trims,
        }

        blob = bucket.blob(path)
        blob.cache_control = TRIM_INDEX_CACHE_CONTROL
        try:
            blob.upload_from_string(
                json.dumps(index, ensure_ascii=False).encode("utf-8"),
                content_type="application/json",
                if_generation_match=generation,
            )
            try:
                blob.make_public()
            except Exception:
                pass
            return True
        except PreconditionFailed:
            continue

    return False

def remove_trim_from_index(bucket_name, url_uid, trim_id, max_retries=6):
    if not bucket_name:
        return False
    trim_id = str(trim_id or "").strip()
    if not normalize_trim_slot_id(trim_id):
        return False

    bucket = gcs_client().bucket(bucket_name)
    path = trim_index_path(url_uid)

    for _ in range(max_retries):
        existing = bucket.get_blob(path)
        if existing is None:
            return True

        generation = existing.generation
        try:
            text = existing.download_as_text()
            data = json.loads(text)
        except Exception:
            data = {}

        trims = []
        if isinstance(data, dict) and isinstance(data.get("trims"), list):
            trims = [t for t in data.get("trims") if isinstance(t, dict)]
        trims = [t for t in trims if t.get("id") != trim_id]

        now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        index = {
            "schema": 1,
            "url_uid": url_uid,
            "updated_at": now,
            "trims": sort_trim_items(trims),
        }

        blob = bucket.blob(path)
        blob.cache_control = TRIM_INDEX_CACHE_CONTROL
        try:
            blob.upload_from_string(
                json.dumps(index, ensure_ascii=False).encode("utf-8"),
                content_type="application/json",
                if_generation_match=generation,
            )
            try:
                blob.make_public()
            except Exception:
                pass
            return True
        except PreconditionFailed:
            continue
    return False

def upload_trim(bucket, url_uid, slot, payload):
    path = f"sessions/{url_uid}/trims/trim{slot}.json"
    blob = gcs_client().bucket(bucket).blob(path)
    blob.cache_control = TRIM_CACHE_CONTROL
    blob.upload_from_string(
        json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        content_type="application/json",
        if_generation_match=0,
    )
    try:
        blob.make_public()
    except Exception:
        pass
    return path

def post_glide_webhook(url, bearer, json_body):
    clean_url = (url or "").strip()
    clean_bearer = _normalize_bearer_token(bearer)
    if not clean_url:
        raise RuntimeError("missing Glide webhook url")
    if not clean_bearer:
        raise RuntimeError("missing Glide bearer token")
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {clean_bearer}"}
    # Glide already exposes the incoming request body under `jsonBody`.
    # If we wrap again with {"jsonBody": ...}, Glide ends up with jsonBody.jsonBody.<field>.
    r = requests.post(clean_url, json=json_body, headers=headers, timeout=15)
    if r.status_code >= 400:
        msg = r.text.strip()
        if len(msg) > 400:
            msg = msg[:400] + "…"
        meta = _glide_url_meta(clean_url)
        app.logger.error(
            "glide_webhook_error status=%s msg=%s url_netloc=%s url_path_len=%s url_path_hash=%s bearer_len=%s bearer_hash=%s",
            r.status_code,
            msg,
            meta["netloc"],
            meta["path_len"],
            meta["path_hash"],
            len(clean_bearer),
            _sha256_8(clean_bearer),
        )
        raise RuntimeError(f"glide webhook failed: {r.status_code} {msg}")

def notify_report(report_id, status, error, url_uid):
    payload = {
        "status": status,
        "report_id": report_id or "",
        "error": error or "",
        "url_uid": url_uid or "",
    }
    post_glide_webhook(GLIDE_REPORT_WEBHOOK_URL, GLIDE_REPORT_BEARER_TOKEN, payload)

def notify_vakaros(upload_id, status, error, url_uid):
    payload = {
        "status": status,
        "upload_id": upload_id or "",
        "error": error or "",
        "url_uid": url_uid or "",
    }
    post_glide_webhook(GLIDE_VAKAROS_WEBHOOK_URL, GLIDE_VAKAROS_BEARER_TOKEN, payload)

def upload_bytes(
    bucket,
    path,
    data: bytes,
    content_type="text/plain",
    cache_control="public, max-age=31536000",
    make_public=True,
):
    blob = gcs_client().bucket(bucket).blob(path)
    if cache_control:
        blob.cache_control = cache_control
    blob.upload_from_string(data, content_type=content_type)
    if make_public:
        try:
            blob.make_public()
        except Exception:
            pass
    return blob.public_url

@app.route("/sessions/<url_uid>/trims", methods=["GET", "POST", "OPTIONS"], strict_slashes=False)
def handle_trims(url_uid):
    if request.method == "OPTIONS":
        return add_trim_cors(make_response("", 204))
    try:
        url_uid = normalize_url_uid(url_uid)
    except ValueError as e:
        return add_trim_cors(make_response(jsonify({"error": str(e)}), 400))
    if not BUCKET:
        return add_trim_cors(make_response(jsonify({"error": "missing bucket"}), 500))

    if request.method == "GET":
        try:
            bucket = gcs_client().bucket(BUCKET)
            blob = bucket.get_blob(trim_index_path(url_uid))
            if blob is not None:
                etag = _quote_etag(blob.etag or "")
                if _if_none_match_has_etag(request.headers.get("If-None-Match", ""), etag):
                    resp = make_response("", 304)
                    if etag:
                        resp.headers["ETag"] = etag
                    resp.headers["Cache-Control"] = "public, max-age=0, must-revalidate"
                    return add_trim_cors(resp)
                try:
                    data = json.loads(blob.download_as_text())
                except Exception:
                    data = {}
                trims = []
                if isinstance(data, dict) and isinstance(data.get("trims"), list):
                    trims = [t for t in data.get("trims") if isinstance(t, dict)]
                resp = make_response(jsonify({"trims": sort_trim_items(trims)}), 200)
                if etag:
                    resp.headers["ETag"] = etag
                resp.headers["Cache-Control"] = "public, max-age=0, must-revalidate"
                return add_trim_cors(resp)

            trims = list_trims(BUCKET, url_uid)
            resp = make_response(jsonify({"trims": trims}), 200)
            resp.headers["Cache-Control"] = "no-store"
            return add_trim_cors(resp)
        except Exception as e:
            app.logger.exception("trim_list_failed url_uid_hash=%s err=%s", _sha256_8(url_uid), truncate_error(e))
            resp = make_response(jsonify({"error": "trim_list_failed"}), 500)
            resp.headers["Cache-Control"] = "no-store"
            return add_trim_cors(resp)

    rows_1hz = get_session_rows_1hz(BUCKET, url_uid)
    if not rows_1hz:
        return add_trim_cors(make_response(jsonify({"error": "session not found"}), 404))

    payload = request.get_json(force=True, silent=True)
    if isinstance(payload, list):
        payload = payload[0] if payload else None
    if isinstance(payload, dict) and isinstance(payload.get("body"), dict):
        payload = payload.get("body")
    if not isinstance(payload, dict):
        return add_trim_cors(make_response(jsonify({"error": "invalid json"}), 400))
    body = payload
    try:
        start_idx = int(body.get("start_idx"))
        end_idx = int(body.get("end_idx"))
    except Exception:
        return add_trim_cors(make_response(jsonify({"error": "invalid start_idx/end_idx"}), 400))
    if start_idx < 0 or end_idx <= start_idx or end_idx >= rows_1hz:
        return add_trim_cors(make_response(jsonify({"error": "trim out of range"}), 400))

    raw_name = str(body.get("name") or "").strip()
    if len(raw_name) > TRIM_NAME_MAX:
        raw_name = raw_name[:TRIM_NAME_MAX]
    name = raw_name or "unnamed"
    buoys = sanitize_buoys(body.get("buoys"))

    payload = {
        "schema": 1,
        "saved_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "name": name,
        "start_idx": start_idx,
        "end_idx": end_idx,
        "buoys": buoys,
    }

    slot = None
    for i in range(1, TRIM_MAX + 1):
        try:
            upload_trim(BUCKET, url_uid, i, payload)
            slot = i
            break
        except PreconditionFailed:
            continue
    if slot is None:
        return add_trim_cors(make_response(jsonify({"error": "trims_full"}), 409))

    trim_id = f"trim{slot}"
    label = f"{trim_id}-{name}"
    try:
        update_trim_index(BUCKET, url_uid, {
            "id": trim_id,
            "name": name,
            "label": label,
            "start_idx": start_idx,
            "end_idx": end_idx,
            "saved_at": payload.get("saved_at"),
            "buoys_count": len(buoys),
        })
    except Exception as e:
        app.logger.exception("trim_index_update_failed url_uid_hash=%s err=%s", _sha256_8(url_uid), truncate_error(e))
    return add_trim_cors(make_response(jsonify({"id": trim_id, "name": name, "label": label}), 200))

@app.route("/sessions/<url_uid>/trims/<trim_id>", methods=["DELETE", "OPTIONS"], strict_slashes=False)
def handle_trim_delete(url_uid, trim_id):
    if request.method == "OPTIONS":
        return add_trim_cors(make_response("", 204))
    try:
        url_uid = normalize_url_uid(url_uid)
    except ValueError as e:
        return add_trim_cors(make_response(jsonify({"error": str(e)}), 400))
    if not BUCKET:
        return add_trim_cors(make_response(jsonify({"error": "missing bucket"}), 500))

    trim_id = str(trim_id or "").strip()
    if not normalize_trim_slot_id(trim_id):
        return add_trim_cors(make_response(jsonify({"error": "invalid trim id"}), 400))

    bucket = gcs_client().bucket(BUCKET)
    blob = bucket.blob(f"sessions/{url_uid}/trims/{trim_id}.json")
    try:
        blob.delete()
    except NotFound:
        return add_trim_cors(make_response(jsonify({"error": "trim not found"}), 404))
    except Exception as e:
        app.logger.exception("trim_delete_failed url_uid_hash=%s trim_id=%s err=%s", _sha256_8(url_uid), trim_id, truncate_error(e))
        return add_trim_cors(make_response(jsonify({"error": "trim_delete_failed"}), 500))

    try:
        remove_trim_from_index(BUCKET, url_uid, trim_id)
    except Exception as e:
        app.logger.exception("trim_index_remove_failed url_uid_hash=%s trim_id=%s err=%s", _sha256_8(url_uid), trim_id, truncate_error(e))

    return add_trim_cors(make_response(jsonify({"ok": True, "id": trim_id}), 200))

@app.post("/process-vakaros", strict_slashes=False)
def process_vakaros():
    body = parse_json_body(request)
    require_auth(body)

    upload_id = body.get("upload_id") or ""
    csv_url = body.get("csv_url") or ""
    url_uid = ""
    url_uid_for_callback = ""

    t0 = time.time()
    try:
        if not BUCKET:
            raise RuntimeError("missing bucket")
        if not upload_id:
            raise ValueError("missing upload_id")
        if not csv_url:
            raise ValueError("missing csv_url")

        url_uid_raw = body.get("url_uid")
        if url_uid_raw is not None:
            url_uid_for_callback = str(url_uid_raw)
        url_uid = normalize_url_uid(url_uid_raw)
        if not url_uid:
            url_uid = generate_url_uid()
            url_uid_for_callback = url_uid

        # 1) descargar CSV
        r = requests.get(csv_url, timeout=60)
        r.raise_for_status()
        raw_bytes = r.content

        # 2) procesar
        try:
            csv_1hz, geojson_bytes, summary_bytes, _kpis = render_gps_vkr_data(raw_bytes)
        except ValueError as e:
            raise ValueError(f"invalid csv: {e}") from e

        # 3) subir a GCS
        base = f"sessions/{url_uid}"
        upload_bytes(BUCKET, f"{base}/raw.csv", raw_bytes, content_type="text/csv", cache_control=VAKAROS_CACHE_CONTROL)
        upload_bytes(BUCKET, f"{base}/series_1hz.csv", csv_1hz, content_type="text/csv", cache_control=VAKAROS_CACHE_CONTROL)
        upload_bytes(BUCKET, f"{base}/track.geojson", geojson_bytes, content_type="application/geo+json", cache_control=VAKAROS_CACHE_CONTROL)
        upload_bytes(BUCKET, f"{base}/summary.csv", summary_bytes, content_type="text/csv", cache_control=VAKAROS_CACHE_CONTROL)

        notify_vakaros(upload_id, status="Ready", error="", url_uid=url_uid_for_callback)
        app.logger.info(
            "process-vakaros ok upload_id=%s url_uid=%s ms=%.1f",
            upload_id,
            url_uid,
            (time.time() - t0) * 1000.0,
        )
        return jsonify({"status": "ok"})
    except Exception as e:
        error = truncate_error(e)
        if isinstance(e, ValueError):
            app.logger.warning("process-vakaros error upload_id=%s url_uid=%s error=%s", upload_id, url_uid, error)
        else:
            app.logger.exception("process-vakaros error upload_id=%s url_uid=%s error=%s", upload_id, url_uid, error)
        try:
            notify_vakaros(upload_id, status="Error", error=error, url_uid=url_uid_for_callback)
        except Exception:
            pass
        status_code = 400 if isinstance(e, ValueError) else 500
        return jsonify({"status": "error", "error": error}), status_code

@app.post("/generate-report", strict_slashes=False)
def generate_report_webhook():
    body = parse_json_body(request)
    require_auth(body)

    report_id = ""
    url_uid = ""
    url_uid_for_callback = ""

    t0 = time.time()
    try:
        data = normalize_payload(body)
        if not data:
            raise ValueError("missing payload")
        if not REPORT_BUCKET:
            raise RuntimeError("missing report bucket")

        report_id = get_report_id(data)
        if not report_id:
            raise ValueError("missing report_id")

        url_uid_raw = data.get("url_uid")
        if url_uid_raw is not None:
            url_uid_for_callback = str(url_uid_raw)
        url_uid = normalize_url_uid(url_uid_raw)
        if not url_uid:
            url_uid = generate_url_uid()
            url_uid_for_callback = url_uid

        path = f"{REPORT_PREFIX}/{url_uid}.pdf"

        try:
            pdf_bytes = render_report_pdf_bytes(data)
        except Exception as e:
            raise RuntimeError(f"pdf generation failed: {e}") from e

        upload_bytes(
            REPORT_BUCKET,
            path,
            pdf_bytes,
            content_type="application/pdf",
            cache_control=REPORT_CACHE_CONTROL,
        )

        notify_report(report_id, status="Ready", error="", url_uid=url_uid_for_callback)
        app.logger.info(
            "generate-report ok report_id=%s url_uid=%s path=%s ms=%.1f",
            report_id,
            url_uid,
            path,
            (time.time() - t0) * 1000.0,
        )
        return jsonify({"status": "ok"})
    except Exception as e:
        error = truncate_error(e)
        if isinstance(e, ValueError):
            app.logger.warning(
                "generate-report error report_id=%s url_uid=%s error=%s",
                report_id,
                url_uid,
                error,
            )
        else:
            app.logger.exception(
                "generate-report error report_id=%s url_uid=%s error=%s",
                report_id,
                url_uid,
                error,
            )
        try:
            notify_report(report_id, status="Error", error=error, url_uid=url_uid_for_callback)
        except Exception:
            pass
        status_code = 400 if isinstance(e, ValueError) else 500
        return jsonify({"status": "error", "error": error}), status_code


if __name__ == "__main__":
    # Entry-point para desarrollo local. En Cloud Run se usa Gunicorn (ver backend/Dockerfile).
    port = int(os.environ.get("PORT", "8080"))
    debug = os.environ.get("FLASK_DEBUG", "").strip().lower() in {"1", "true", "yes"}
    app.run(host="0.0.0.0", port=port, debug=debug)
