import html
import os
import re
import time

PLACEHOLDER_RE = re.compile(r"{{\s*([^}]+?)\s*}}")
SAFE_ID_RE = re.compile(r"[^a-zA-Z0-9._-]+")

CONDITION_FIELDS = ("Sea State", "TWD", "Conditions", "Best", "To Work", "Free Notes")
CONDITION_BLOCKS = (
    ("ST 0-4", "has04"),
    ("DT 5-8", "has58"),
    ("FP 9-11", "has911"),
    ("DP 12-18", "has1218"),
    ("OP 19-23", "has1923"),
    ("S 24+", "has24"),
)


def normalize_payload(payload):
    if payload is None:
        return {}
    if isinstance(payload, dict):
        return payload
    if isinstance(payload, list):
        if not payload:
            return {}
        first = payload[0]
        return first if isinstance(first, dict) else {}
    return {}


def truthy(value):
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        v = value.strip().lower()
        return v in {"1", "true", "t", "yes", "y", "on"}
    return False


def get_report_id(data):
    raw = (
        data.get("report_id")
        or data.get("Report ID")
        or data.get("reportId")
        or data.get("row_id")
        or data.get("Row ID")
        or data.get("id")
    )
    if raw is None:
        return ""
    report_id = str(raw).strip()
    if not report_id:
        return ""
    if SAFE_ID_RE.search(report_id):
        raise ValueError("report_id must be URL-safe (letters, digits, '.', '_', '-')")
    return report_id


def _condition_has_any_content(data, label):
    for suffix in CONDITION_FIELDS:
        value = data.get(f"{label} {suffix}")
        if value is None:
            continue
        if str(value).strip():
            return True
    return False


def should_render_condition(data, label, has_key):
    if truthy(data.get(has_key)):
        return True
    return _condition_has_any_content(data, label)


def prune_conditions(template_html, data):
    out = template_html
    for label, has_key in CONDITION_BLOCKS:
        if should_render_condition(data, label, has_key):
            continue
        pattern = re.compile(
            rf"<!--\s*=====\s*{re.escape(label)}\s*=====\s*-->\s*<tr>.*?</tr>\s*",
            flags=re.DOTALL,
        )
        out = pattern.sub("", out, count=1)
    return out


def render_placeholders(template_html, data):
    def repl(match):
        key = match.group(1)
        value = data.get(key, "")
        if value is None:
            value = ""
        return html.escape(str(value), quote=True)

    return PLACEHOLDER_RE.sub(repl, template_html)


def render_report_html(data, template_path=None):
    if template_path is None:
        template_path = os.path.join(os.path.dirname(__file__), "report_template.html")
    with open(template_path, "r", encoding="utf-8") as f:
        template_html = f.read()
    template_html = prune_conditions(template_html, data)
    return render_placeholders(template_html, data)


def html_to_pdf_bytes(html_str, timeout_ms=45000):
    try:
        from playwright.sync_api import sync_playwright
    except Exception as e:
        raise RuntimeError("playwright is required to generate PDFs") from e

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
            ],
        )
        page = browser.new_page()
        page.set_content(html_str, wait_until="load", timeout=timeout_ms)
        page.wait_for_timeout(250)
        pdf_bytes = page.pdf(
            format="A4",
            print_background=True,
            prefer_css_page_size=True,
        )
        browser.close()
        return pdf_bytes


def render_report_pdf_bytes(data, template_path=None):
    html_str = render_report_html(data, template_path=template_path)
    return html_to_pdf_bytes(html_str)
