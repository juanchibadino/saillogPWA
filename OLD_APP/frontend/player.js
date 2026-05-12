// --- URL parsing (query params) ---
function parseViewerParams() {
  const qs = new URLSearchParams(location.search);

  const parseHttpUrl = (key) => {
    const raw = qs.get(key);
    if (!raw) return null;
    try {
      const url = new URL(raw, location.href);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      return url.toString();
    } catch {
      return null;
    }
  };

  const rateRaw = qs.get('rate');
  const rate = rateRaw ? Number(rateRaw) : null;

  const sessionIdRaw = qs.get('session_id') || qs.get('sessionId');
  const sessionId = sessionIdRaw ? sessionIdRaw.trim() : '';
  const sessionOk = Boolean(sessionId);
  const sessionBase = sessionOk
    ? `https://storage.googleapis.com/sailog-vakaros/sessions/${encodeURIComponent(sessionId)}`
    : null;
  const sessionTrackUrl = sessionBase ? `${sessionBase}/track.geojson` : null;
  const sessionSeriesUrl = sessionBase ? `${sessionBase}/series_1hz.csv` : null;

  const explicitTrackUrl = parseHttpUrl('track');
  const explicitSeriesUrl = parseHttpUrl('series');
  const usingSession = !explicitTrackUrl && Boolean(sessionTrackUrl);

  return {
    trackRaw: qs.get('track'),
    seriesRaw: qs.get('series'),
    sessionIdRaw,
    usingSession,
    trackUrl: explicitTrackUrl || sessionTrackUrl,
    seriesUrl: explicitSeriesUrl || (usingSession ? sessionSeriesUrl : null),
    autoplay: qs.get('autoplay') === '1',
    rate: Number.isFinite(rate) ? rate : null,
  };
}

const params = parseViewerParams();

const TRACK_URL = params.trackUrl;
const SERIES_URL = params.seriesUrl;
const SESSION_ID = (params.sessionIdRaw || '').trim();
const SESSION_ID_OK = /^[A-Za-z0-9_-]{16,128}$/.test(SESSION_ID);
const SESSION_BASE = SESSION_ID_OK
  ? `https://storage.googleapis.com/sailog-vakaros/sessions/${encodeURIComponent(SESSION_ID)}`
  : '';

const API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'http://localhost:8080'
  : '';
const apiUrl = (path) => `${API_BASE}${path}`;

// DOM refs
const playBtn = document.getElementById('playBtn');
const playFabEl = document.querySelector('.play-fab');
const timeRange = document.getElementById('timeRange');
const trimStartRange = document.getElementById('trimStartRange');
const trimEndRange = document.getElementById('trimEndRange');
const playheadEl = document.querySelector('.playhead');
const trimEl = document.querySelector('.trim');
const speedSel = document.getElementById('speed');
const idxLabel = document.getElementById('idxLabel');

const trimZoomOutBtn = document.getElementById('trimZoomOutBtn');
const trimZoomInBtn = document.getElementById('trimZoomInBtn');

const kpiTime = document.getElementById('kpi-time');
const kpiSog  = document.getElementById('kpi-sog');
const kpiHdg  = document.getElementById('kpi-hdg');
const kpiHT   = document.getElementById('kpi-ht');
const wakeBtn = document.getElementById('wakeBtn');
const fitBtn = document.getElementById('fitBtn');
const buoyBtn = document.getElementById('buoyBtn');
const buoyMenu = document.getElementById('buoyMenu');
const buoyControlEl = document.querySelector('.buoy-control');
const statusEl = document.getElementById('status');
const cacheBadgeEl = document.getElementById('cacheBadge');
const trimToolsEl = document.querySelector('.trim-tools');
const trimSaveBtn = document.getElementById('trimSaveBtn');
const trimMenuBtn = document.getElementById('trimMenuBtn');
const trimSaveModal = document.getElementById('trimSaveModal');
const trimSaveCloseBtn = document.getElementById('trimSaveCloseBtn');
const trimSaveCancelBtn = document.getElementById('trimSaveCancelBtn');
const trimSaveConfirmBtn = document.getElementById('trimSaveConfirmBtn');
const trimNameInput = document.getElementById('trimNameInput');
const trimSaveMsg = document.getElementById('trimSaveMsg');
const trimListModal = document.getElementById('trimListModal');
const trimListCloseBtn = document.getElementById('trimListCloseBtn');
const trimListDoneBtn = document.getElementById('trimListDoneBtn');
const trimListContainer = document.getElementById('trimListContainer');
const trimListLoadingEl = document.getElementById('trimListLoading');
const trimListEmptyEl = document.getElementById('trimListEmpty');
const trimDeleteModal = document.getElementById('trimDeleteModal');
const trimDeleteCloseBtn = document.getElementById('trimDeleteCloseBtn');
const trimDeleteCancelBtn = document.getElementById('trimDeleteCancelBtn');
const trimDeleteConfirmBtn = document.getElementById('trimDeleteConfirmBtn');
const trimDeleteTextEl = document.getElementById('trimDeleteText');
const trimDeleteMsgEl = document.getElementById('trimDeleteMsg');
const playerPanelEl = document.querySelector('.player-panel');
const mapControlsEl = document.querySelector('.map-tools');
const kpisEl = document.querySelector('.kpis');

// Cache badge (best-effort): document navigation cache state (track/series are cross-origin and often opaque).
const cacheState = { html: '—' };
function formatCacheState(value) {
  switch (value) {
    case 'net': return 'GET';
    case 'cache': return 'cache';
    case 'opaque': return '?';
    case 'unknown': return '?';
    case 'pending': return '…';
    case 'loading': return 'GET…';
    case 'error': return 'err';
    case 'missing': return 'missing';
    case 'n/a': return 'n/a';
    default: return value || '—';
  }
}
function renderCacheBadge() {
  if (!cacheBadgeEl) return;
  cacheBadgeEl.textContent = `HTML: ${formatCacheState(cacheState.html)}`;
}

function navCacheStatus() {
  try {
    const nav = performance?.getEntriesByType?.('navigation')?.[0];
    if (!nav || typeof nav.transferSize !== 'number') return 'unknown';
    return nav.transferSize === 0 ? 'cache' : 'net';
  } catch {
    return 'unknown';
  }
}

// Status overlay (safe for embeds: no alerts/popups)
let statusToken = 0;
function setStatus(kind, message, { autoClearMs = 0 } = {}) {
  if (!statusEl) return;

  statusToken++;
  const token = statusToken;

  if (!message) {
    statusEl.textContent = '';
    statusEl.classList.add('hidden');
    statusEl.classList.remove('info', 'error');
    return;
  }

  statusEl.textContent = message;
  statusEl.classList.remove('hidden', 'info', 'error');
  statusEl.classList.add(kind === 'error' ? 'error' : 'info');
  statusEl.setAttribute('aria-live', kind === 'error' ? 'assertive' : 'polite');

  if (autoClearMs > 0) {
    setTimeout(() => {
      if (token !== statusToken) return;
      statusEl.textContent = '';
      statusEl.classList.add('hidden');
      statusEl.classList.remove('info', 'error');
    }, autoClearMs);
  }
}

// Modal helpers
function setModalOpen(el, open) {
  if (!el) return;
  el.classList.toggle('hidden', !open);
}

function clearTrimSaveMsg() {
  if (!trimSaveMsg) return;
  trimSaveMsg.textContent = '';
  trimSaveMsg.classList.add('hidden');
  trimSaveMsg.classList.remove('error');
}

function showTrimSaveMsg(text, { isError = false } = {}) {
  if (!trimSaveMsg) return;
  trimSaveMsg.textContent = text;
  trimSaveMsg.classList.remove('hidden');
  trimSaveMsg.classList.toggle('error', isError);
}

function clearTrimDeleteMsg() {
  if (!trimDeleteMsgEl) return;
  trimDeleteMsgEl.textContent = '';
  trimDeleteMsgEl.classList.add('hidden');
  trimDeleteMsgEl.classList.remove('error');
}

function showTrimDeleteMsg(text, { isError = false } = {}) {
  if (!trimDeleteMsgEl) return;
  trimDeleteMsgEl.textContent = text;
  trimDeleteMsgEl.classList.remove('hidden');
  trimDeleteMsgEl.classList.toggle('error', isError);
}

function setPlaybackVisible(visible) {
  if (playerPanelEl) playerPanelEl.classList.toggle('hidden', !visible);
  if (playFabEl) playFabEl.classList.toggle('hidden', !visible);
  if (kpisEl) kpisEl.classList.toggle('hidden', !visible);
  document.documentElement.classList.toggle('has-playback', visible);
  updateTrimToolsUI();
  requestAnimationFrame(() => {
    map.invalidateSize();
    lockMapToTrack();
  });
}

// --- Map initialization ---
function initMap() {
  const map = L.map('map', {
    zoomControl: false,
    doubleClickZoom: false,
    preferCanvas: true,
  });
  L.control.zoom({ position: 'topright' }).addTo(map);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors',
  }).addTo(map);
  map.attributionControl?.setPrefix(false);
  map.setView([0, 0], 2);
  return map;
}

const map = initMap();
map.on('click', (e) => {
  if (buoyMenuOpen) setBuoyMenuOpen(false);
  if (!buoyPlacementMode || !e?.latlng) return;
  addBuoy(buoyPlacementMode, e.latlng);
  setBuoyPlacementMode(null);
});
window.addEventListener('resize', () => {
  map.invalidateSize();
  requestAnimationFrame(() => lockMapToTrack());
});
setTimeout(() => {
  map.invalidateSize();
  lockMapToTrack();
}, 200);

// Estado
const MIN_TRIM_GAP = 5; // in indices (1Hz => seconds)

// Trim-zoom (viewport) to make fine trimming easier on mobile.
const TRIM_VIEW_MIN_SPAN = 30; // seconds (1Hz indices)
const TRIM_VIEW_PAD_MIN = 10;  // seconds
const TRIM_VIEW_PAD_RATIO = 0.20;

let timer = null;
let series = [];
let idx = 0;
let trimStartIdx = 0;
let trimEndIdx = 0;
let trimViewStartIdx = 0;
let trimViewEndIdx = 0;
let trimIndex = [];
let trimSelection = { all: true, ids: new Set() };
let activeTrimId = null;
let trimIndexETag = '';
let trimIndexLastError = '';
let trimIndexFetchPromise = null;
let pendingDeleteTrimId = '';
let pendingDeleteTrimLabel = '';
const trimBuoyCache = new Map();
let trimBuoyToken = 0;
let trackLatLngLinesFull = [];
let trackBoundsFull = null;
let trackLine = null;
let startMarker = null;
let endMarker = null;
let boatMarker = null;
let lastPos = null; // última pos válida para estela

function boundsFromLatLngLines(latlngLines) {
  const bounds = L.latLngBounds([]);
  const lines = Array.isArray(latlngLines) ? latlngLines : [];
  for (const line of lines) {
    if (!Array.isArray(line)) continue;
    for (const pt of line) bounds.extend(pt);
  }
  return bounds;
}

function lockMapToTrack() {
  if (!trackBoundsFull?.isValid?.() || !trackBoundsFull.isValid()) return;

  const bounds = trackBoundsFull.pad(0.1);
  try {
    map.options.maxBoundsViscosity = 1.0;
    map.setMaxBounds(bounds);
  } catch (_) {}

  let minZoom = null;
  try {
    const calc = map._getBoundsCenterZoom?.(bounds, {
      paddingTopLeft: [24, 24],
      paddingBottomRight: [24, 24],
    });
    if (calc && Number.isFinite(calc.zoom)) minZoom = calc.zoom;
  } catch (_) {}

  if (Number.isFinite(minZoom)) map.setMinZoom(minZoom);
}

// Estela
const TRACK_MODE_DEFAULT = 0; // full track (default colors)
const TRACK_MODE_WAKE = 1;    // wake / trail only
const TRACK_MODE_SPEED = 2;   // track colored by SOG (kn)
let trackMode = TRACK_MODE_DEFAULT;
let wakeSegments = [];
let wakeDecayTimer = null;
const WAKE_TTL_MS = 8000;     // duración visible de cada segmento
const WAKE_DECAY_MS = 200;    // intervalo de actualización de opacidad
const WAKE_MAX_SEGMENTS = 200; // cap de segmentos concurrentes

function syncWakeBtnUI() {
  if (!wakeBtn) return;
  wakeBtn.classList.toggle('active', trackMode !== TRACK_MODE_DEFAULT);
  wakeBtn.classList.toggle('wake', trackMode === TRACK_MODE_WAKE);
  wakeBtn.classList.toggle('speed', trackMode === TRACK_MODE_SPEED);
  wakeBtn.setAttribute(
    'aria-pressed',
    trackMode === TRACK_MODE_DEFAULT ? 'false' : (trackMode === TRACK_MODE_WAKE ? 'true' : 'mixed')
  );
  wakeBtn.title = trackMode === TRACK_MODE_WAKE ? 'Estela'
    : trackMode === TRACK_MODE_SPEED ? 'Boat Speed'
      : 'Track';
}
syncWakeBtnUI();

// Boyas
const BUOY_COLORS = {
  windward: '#ff7a00',
  leeward: '#facc15',
};
const BUOY_LINE_COLOR = '#f59e0b';
let buoyPlacementMode = null;
let buoyMenuOpen = false;
let pendingLeeward = null;
const buoyMarkers = [];

function setBuoyPlacementMode(mode) {
  buoyPlacementMode = mode;
  document.documentElement.classList.toggle('placing-buoy', Boolean(mode));
  if (buoyBtn) buoyBtn.classList.toggle('active', Boolean(mode));
  if (buoyBtn) {
    buoyBtn.title = mode
      ? `Colocar ${mode === 'windward' ? 'Windward' : 'Leeward'}`
      : 'Agregar boya';
  }
}

function setBuoyMenuOpen(open) {
  buoyMenuOpen = Boolean(open);
  if (buoyMenu) buoyMenu.classList.toggle('hidden', !buoyMenuOpen);
  if (buoyMenuOpen) setBuoyPlacementMode(null);
}

function removeBuoy(marker) {
  if (!marker) return;

  if (marker._pairedLine) {
    try { map.removeLayer(marker._pairedLine); } catch (_) {}
    const mate = marker._pairMate;
    if (mate) {
      mate._pairedLine = null;
      mate._pairMate = null;
      if (!pendingLeeward && marker._buoyType === 'leeward') pendingLeeward = mate;
    }
  }

  if (pendingLeeward === marker) pendingLeeward = null;
  try { map.removeLayer(marker); } catch (_) {}

  const idx = buoyMarkers.indexOf(marker);
  if (idx >= 0) buoyMarkers.splice(idx, 1);
}

function bindBuoyInteractions(marker) {
  marker.on('dblclick', (e) => {
    if (e?.originalEvent) {
      L.DomEvent.stopPropagation(e.originalEvent);
      L.DomEvent.preventDefault(e.originalEvent);
    }
    removeBuoy(marker);
  });

  marker.on('add', () => {
    const el = marker.getElement?.();
    if (!el) return;
    let timer = null;
    const start = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        removeBuoy(marker);
      }, 650);
    };
    const cancel = () => {
      if (!timer) return;
      clearTimeout(timer);
      timer = null;
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchend', cancel);
    el.addEventListener('touchmove', cancel);
    el.addEventListener('touchcancel', cancel);
  });
}

function pairLeeward(marker) {
  if (pendingLeeward && pendingLeeward !== marker) {
    const line = L.polyline([pendingLeeward.getLatLng(), marker.getLatLng()], {
      color: BUOY_LINE_COLOR,
      weight: 2,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
      interactive: false,
    }).addTo(map);
    pendingLeeward._pairedLine = line;
    pendingLeeward._pairMate = marker;
    marker._pairedLine = line;
    marker._pairMate = pendingLeeward;
    pendingLeeward = null;
  } else {
    pendingLeeward = marker;
  }
}

function addBuoy(type, latlng) {
  const color = BUOY_COLORS[type] || '#fff';
  const marker = L.circleMarker(latlng, {
    radius: 7,
    weight: 2,
    color,
    fillColor: color,
    fillOpacity: 0.9,
    opacity: 1,
    interactive: true,
    bubblingMouseEvents: false,
  }).addTo(map);

  marker._buoyType = type;
  marker._pairedLine = null;
  marker._pairMate = null;
  buoyMarkers.push(marker);
  bindBuoyInteractions(marker);

  if (type === 'leeward') pairLeeward(marker);
}

function clearAllBuoys() {
  if (!buoyMarkers.length) {
    pendingLeeward = null;
    return;
  }
  const lines = new Set();
  for (const marker of buoyMarkers) {
    if (marker?._pairedLine) lines.add(marker._pairedLine);
    try { map.removeLayer(marker); } catch (_) {}
  }
  for (const line of lines) {
    try { map.removeLayer(line); } catch (_) {}
  }
  buoyMarkers.length = 0;
  pendingLeeward = null;
}

function normalizeBuoyList(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (!item) continue;
    const type = String(item.type || '').trim().toLowerCase();
    if (type !== 'windward' && type !== 'leeward') continue;
    const lat = Number(item.lat);
    const lon = Number(item.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    out.push({ type, lat, lon });
  }
  return out;
}

function renderBuoyList(list) {
  if (!Array.isArray(list) || !list.length) return;
  for (const buoy of list) {
    addBuoy(buoy.type, { lat: buoy.lat, lng: buoy.lon });
  }
}

async function fetchTrimBuoys(trimId) {
  if (!SESSION_BASE || !trimId) return [];
  const cached = trimBuoyCache.get(trimId);
  if (Array.isArray(cached)) return cached;
  try {
    const url = `${SESSION_BASE}/trims/${encodeURIComponent(trimId)}.json`;
    const r = await fetch(url, { cache: 'no-store', credentials: 'omit' });
    if (!r.ok) return [];
    const data = await r.json().catch(() => ({}));
    const buoys = normalizeBuoyList(data?.buoys);
    trimBuoyCache.set(trimId, buoys);
    return buoys;
  } catch (err) {
    console.warn('trim buoy fetch error', err);
    return [];
  }
}

function applyTrimBuoysForId(trimId) {
  trimBuoyToken += 1;
  const token = trimBuoyToken;
  if (!trimId || !SESSION_ID_OK) {
    clearAllBuoys();
    return;
  }

  const cached = trimBuoyCache.get(trimId);
  clearAllBuoys();
  if (Array.isArray(cached)) {
    renderBuoyList(cached);
    return;
  }

  (async () => {
    const buoys = await fetchTrimBuoys(trimId);
    if (token !== trimBuoyToken) return;
    clearAllBuoys();
    renderBuoyList(buoys);
  })();
}

setBuoyPlacementMode(null);

// Boat: SVG usando tu path (negro)
const boatSVG = `
<svg width="20" height="20" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
  <g filter="url(#ds)">
    <path
      d="M0,56.55 L14.079,70.635 L23.438,80 C56.384,68.35,80,36.943,80,0 C43.066,0,11.657,23.604,0,56.55z"
      fill="#000"
    />
  </g>
  <defs>
    <filter id="ds" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="0" stdDeviation="1.2" flood-color="#000" flood-opacity="0.6"/>
    </filter>
  </defs>
</svg>`;

function ensureBoatMarker(lat, lon) {
  if (!boatMarker) {
    const html = `<div class="boat-wrapper"><div class="boat-ic">${boatSVG}</div></div>`;
    boatMarker = L.marker([lat, lon], {
      icon: L.divIcon({ html, className: '', iconSize: [36, 36], iconAnchor: [18, 18] })
    }).addTo(map);
  } else {
    boatMarker.setLatLng([lat, lon]);
  }
}

function clampDeg(d) {
  let x = (Number(d) % 360 + 360) % 360;
  return isFinite(x) ? x : 0;
}

function formatTimestamp(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';

  const m = s.match(/\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/);
  if (m?.[0]) return m[0].replace('T', ' ');

  // Fallback: common cases like `YYYY-MM-DD hh:mm:ss-08:00` or `...Z`
  if (s.length >= 19 && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 19);
  return s;
}

function updatePosition() {
  if (series.length) {
    const { startIdx, endIdx, maxIdx } = normalizeTrimBounds();
    idx = Math.max(0, Math.min(idx, maxIdx));
    if (idx < startIdx || idx > endIdx) idx = startIdx;
  }

  const p = series[idx];
  if (!p) {
    if (idxLabel) idxLabel.textContent = '0/0';
    updateSliderVisual();
    return;
  }

  const lat = Number(p.lat);
  const lon = Number(p.lon);
  if (isFinite(lat) && isFinite(lon)) {
    ensureBoatMarker(lat, lon);
    // Estela: agregar segmento desde última posición
    if (trackMode === TRACK_MODE_WAKE) {
      if (lastPos && (lastPos[0] !== lat || lastPos[1] !== lon)) {
        const seg = L.polyline([lastPos, [lat, lon]], { color: '#3aa0ff', weight: 4, opacity: 1.0 });
        seg.addTo(map);
        wakeSegments.push({ line: seg, createdAt: performance.now() });
        if (wakeSegments.length > WAKE_MAX_SEGMENTS) {
          const old = wakeSegments.shift();
          try { map.removeLayer(old.line); } catch(_) {}
        }
      }
      if (!wakeDecayTimer) startWakeDecay();
    }
    lastPos = [lat, lon];
    const deg = isFinite(p.hdg_true) ? clampDeg(p.hdg_true) : (isFinite(p.cog) ? clampDeg(p.cog) : 0);
    const el = boatMarker?.getElement?.();
    if (el) {
      const wrap = el.querySelector('.boat-wrapper');
      if (wrap) wrap.style.transform = `rotate(${deg}deg)`;
    }
  }

  // KPIs
  if (kpiTime) kpiTime.textContent = formatTimestamp(p.timestamp) || '—';
  if (kpiSog)  kpiSog.textContent  = isFinite(p.sog_kts) ? Number(p.sog_kts).toFixed(2) : '—';
  if (kpiHdg)  {
    const cogStr = isFinite(p.cog) ? Number(p.cog).toFixed(0) : '—';
    const hdgStr = isFinite(p.hdg_true) ? Number(p.hdg_true).toFixed(0) : '—';
    kpiHdg.textContent = `${cogStr} / ${hdgStr}`;
  }
  if (kpiHT)   {
    const heelStr = isFinite(p.heel) ? Number(p.heel).toFixed(1) : '—';
    const trimStr = isFinite(p.trim) ? Number(p.trim).toFixed(1) : '—';
    kpiHT.textContent = `${heelStr} / ${trimStr}`;
  }

  if (timeRange) timeRange.value = String(idx);
  if (idxLabel)  idxLabel.textContent = `${idx + 1}/${series.length}`;
  updateSliderVisual();
}

function clearWakeSegments() {
  for (const s of wakeSegments) {
    try { map.removeLayer(s.line); } catch(_) {}
  }
  wakeSegments = [];
}

function decayWakeSegments() {
  const now = performance.now();
  for (let i = wakeSegments.length - 1; i >= 0; i--) {
    const s = wakeSegments[i];
    const age = now - s.createdAt;
    if (age >= WAKE_TTL_MS) {
      try { map.removeLayer(s.line); } catch(_) {}
      wakeSegments.splice(i, 1);
    } else {
      const ratio = 1 - (age / WAKE_TTL_MS);
      s.line.setStyle({ opacity: Math.max(0, Math.min(1, ratio)) });
    }
  }
}

function startWakeDecay() {
  if (wakeDecayTimer) return;
  wakeDecayTimer = setInterval(decayWakeSegments, WAKE_DECAY_MS);
}

function stopWakeDecay() {
  if (!wakeDecayTimer) return;
  clearInterval(wakeDecayTimer);
  wakeDecayTimer = null;
}

async function fetchJSON(url) {
  const r = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!r.ok) throw new Error(`Fetch ${r.status}`);
  return r.json();
}

async function fetchCSV(url) {
  const r = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!r.ok) throw new Error(`Fetch ${r.status}`);
  const text = await r.text();
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  const idxOf = (h) => headers.indexOf(h);
  const iTs = idxOf('timestamp');
  const iLat = idxOf('latitude');
  const iLon = idxOf('longitude');
  const iSog = idxOf('sog_kts');
  const iCog = idxOf('cog');
  const iHdg = idxOf('hdg_true');
  const iHeel = idxOf('heel');
  const iTrim = idxOf('trim');
  const out = [];
  for (let li = 1; li < lines.length; li++) {
    const cols = lines[li].split(',');
    const lat = Number(cols[iLat]);
    const lon = Number(cols[iLon]);
    out.push({
      timestamp: cols[iTs] || '',
      lat: isFinite(lat) ? lat : undefined,
      lon: isFinite(lon) ? lon : undefined,
      sog_kts: Number(cols[iSog]),
      cog: Number(cols[iCog]),
      hdg_true: Number(cols[iHdg]),
      heel: Number(cols[iHeel]),
      trim: Number(cols[iTrim]),
    });
  }
  return out;
}

// --- Track parsing (GeoJSON) ---
function isValidLatLon(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

function extractLineStringsFromGeoJSON(geojson) {
  const lines = [];

  const handleGeometry = (g) => {
    if (!g) return;
    if (g.type === 'LineString' && Array.isArray(g.coordinates)) {
      lines.push(g.coordinates);
      return;
    }
    if (g.type === 'MultiLineString' && Array.isArray(g.coordinates)) {
      for (const coords of g.coordinates) {
        if (Array.isArray(coords)) lines.push(coords);
      }
      return;
    }
    if (g.type === 'GeometryCollection' && Array.isArray(g.geometries)) {
      for (const gg of g.geometries) handleGeometry(gg);
    }
  };

  if (geojson?.type === 'FeatureCollection' && Array.isArray(geojson.features)) {
    for (const f of geojson.features) handleGeometry(f?.geometry);
  } else if (geojson?.type === 'Feature') {
    handleGeometry(geojson.geometry);
  } else {
    handleGeometry(geojson);
  }

  return lines;
}

function scoreCoordOrder(lines, order) {
  let ok = 0;
  let total = 0;

  for (const line of lines) {
    if (!Array.isArray(line)) continue;
    for (const pt of line) {
      if (!Array.isArray(pt) || pt.length < 2) continue;
      total++;
      const a = Number(pt[0]);
      const b = Number(pt[1]);
      const lat = order === 'lonlat' ? b : a;
      const lon = order === 'lonlat' ? a : b;
      if (isValidLatLon(lat, lon)) ok++;
    }
  }

  return { ok, total };
}

function guessCoordOrder(lines) {
  const lonlat = scoreCoordOrder(lines, 'lonlat');
  const latlon = scoreCoordOrder(lines, 'latlon');
  if (!lonlat.total) return 'lonlat';
  const r1 = lonlat.ok / lonlat.total;
  const r2 = latlon.ok / latlon.total;
  return r2 > r1 ? 'latlon' : 'lonlat';
}

function toLatLngLines(lines, order) {
  const out = [];
  for (const line of lines) {
    if (!Array.isArray(line)) continue;
    const latlngs = [];
    for (const pt of line) {
      if (!Array.isArray(pt) || pt.length < 2) continue;
      const a = Number(pt[0]);
      const b = Number(pt[1]);
      const lat = order === 'lonlat' ? b : a;
      const lon = order === 'lonlat' ? a : b;
      if (isValidLatLon(lat, lon)) latlngs.push([lat, lon]);
    }
    if (latlngs.length) out.push(latlngs);
  }
  return out;
}

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  const to = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function gradientColorAt(t, stops) {
  const s = Array.isArray(stops) && stops.length ? stops : ['#3aa0ff'];
  if (s.length === 1) return s[0];
  const tt = clamp01(t);
  const n = s.length - 1;
  const idx = Math.min(n - 1, Math.floor(tt * n));
  const local = (tt - (idx / n)) * n;
  const c1 = hexToRgb(s[idx]);
  const c2 = hexToRgb(s[idx + 1]);
  return rgbToHex({
    r: lerp(c1.r, c2.r, local),
    g: lerp(c1.g, c2.g, local),
    b: lerp(c1.b, c2.b, local),
  });
}

function buildGradientTrack(latlngLines) {
  const group = L.featureGroup();
  const stops = ['#7dd3fc', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8'];
  const weight = 4;

  for (const line of latlngLines || []) {
    if (!Array.isArray(line) || line.length < 2) continue;
    const denom = Math.max(1, line.length - 2);
    for (let i = 0; i < line.length - 1; i++) {
      const t = i / denom;
      const color = gradientColorAt(t, stops);
      L.polyline([line[i], line[i + 1]], {
        color,
        weight,
        opacity: 0.92,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }).addTo(group);
    }
  }

  return group;
}

function sogRangeKts(values) {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values || []) {
    const x = Number(v);
    if (!Number.isFinite(x)) continue;
    if (x < min) min = x;
    if (x > max) max = x;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  const minClamped = Math.max(0, min);
  const maxClamped = Math.max(0, max);
  if (maxClamped < minClamped) return null;
  return { min: minClamped, max: maxClamped };
}

function buildSogTrack(latlngLines, { startIdx, endIdx } = {}) {
  // Fallback: if we don't have series/SOG, keep default styling.
  if (!Array.isArray(series) || series.length < 2) return buildGradientTrack(latlngLines);

  const lo = Math.max(0, Math.min(Number(startIdx) || 0, series.length - 1));
  const hi = Math.max(lo, Math.min(Number(endIdx) || (series.length - 1), series.length - 1));

  const sogs = [];
  for (let i = lo; i <= hi; i++) sogs.push(series[i]?.sog_kts);
  const range = sogRangeKts(sogs);
  if (!range) return buildGradientTrack(latlngLines);

  const { min: minSog, max: maxSog } = range;
  const span = maxSog - minSog;
  const stops = ['#3aa0ff', '#ff3b30']; // low = blue, high = red
  const weight = 4;

  let totalSegments = 0;
  for (const line of latlngLines || []) {
    if (Array.isArray(line) && line.length >= 2) totalSegments += (line.length - 1);
  }
  const denomSeg = Math.max(1, totalSegments - 1);

  const group = L.featureGroup();
  let segIdx = 0;
  for (const line of latlngLines || []) {
    if (!Array.isArray(line) || line.length < 2) continue;
    for (let i = 0; i < line.length - 1; i++) {
      const ratio = segIdx / denomSeg;
      segIdx++;

      const sIdx = Math.max(lo, Math.min(hi, lo + Math.round(ratio * (hi - lo))));
      const sogRaw = Number(series[sIdx]?.sog_kts);
      const sog = Number.isFinite(sogRaw) ? sogRaw : minSog;
      const norm = span > 1e-6 ? clamp01((sog - minSog) / span) : 0.5;
      const color = gradientColorAt(norm, stops);

      L.polyline([line[i], line[i + 1]], {
        color,
        weight,
        opacity: 0.92,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }).addTo(group);
    }
  }

  return group;
}

function maxSeriesIdx() {
  return Math.max(series.length - 1, 0);
}

function effectiveTrimEndIdx() {
  const maxIdx = maxSeriesIdx();
  if (!Number.isFinite(trimEndIdx) || trimEndIdx < 1) return maxIdx;
  return Math.min(trimEndIdx, maxIdx);
}

function normalizeTrimBounds() {
  const maxIdx = maxSeriesIdx();
  if (maxIdx < 1) {
    trimStartIdx = 0;
    trimEndIdx = 0;
    return { startIdx: 0, endIdx: 0, maxIdx };
  }

  const gap = Math.max(1, Math.min(MIN_TRIM_GAP, maxIdx));

  let startIdx = Math.floor(Number(trimStartIdx) || 0);
  let endIdx = Math.floor(Number(effectiveTrimEndIdx()) || 0);

  startIdx = Math.max(0, Math.min(startIdx, maxIdx - gap));
  endIdx = Math.max(gap, Math.min(endIdx, maxIdx));

  if (endIdx - startIdx < gap) {
    endIdx = Math.min(maxIdx, startIdx + gap);
    startIdx = Math.max(0, Math.min(endIdx - gap, maxIdx - gap));
  }

  trimStartIdx = startIdx;
  trimEndIdx = endIdx;

  return { startIdx, endIdx, maxIdx };
}

function computeTrimViewMinSpan({ startIdx, endIdx, maxIdx }) {
  const m = Math.floor(Number(maxIdx) || 0);
  if (m < 1) return 0;

  const selSpan = Math.max(1, Math.floor(Number(endIdx) || 0) - Math.floor(Number(startIdx) || 0));
  const pad = Math.max(TRIM_VIEW_PAD_MIN, Math.ceil(selSpan * TRIM_VIEW_PAD_RATIO));
  const minSpan = Math.max(TRIM_VIEW_MIN_SPAN, selSpan + pad * 2);
  return Math.min(m, minSpan);
}

function resetTrimView({ maxIdx } = {}) {
  const m = Number.isFinite(maxIdx) ? Math.floor(maxIdx) : maxSeriesIdx();
  trimViewStartIdx = 0;
  trimViewEndIdx = Math.max(0, m);
}

function normalizeTrimViewBounds({ startIdx, endIdx, maxIdx } = {}) {
  const sel = (Number.isFinite(startIdx) && Number.isFinite(endIdx) && Number.isFinite(maxIdx))
    ? { startIdx: Math.floor(startIdx), endIdx: Math.floor(endIdx), maxIdx: Math.floor(maxIdx) }
    : normalizeTrimBounds();

  const m = sel.maxIdx;
  if (m < 1) {
    trimViewStartIdx = 0;
    trimViewEndIdx = m;
    return { ...sel, viewStartIdx: 0, viewEndIdx: m, viewSpan: 0, minSpan: 0 };
  }

  let vStart = Math.floor(Number(trimViewStartIdx));
  let vEnd = Math.floor(Number(trimViewEndIdx));

  if (!Number.isFinite(vStart) || !Number.isFinite(vEnd) || vEnd <= vStart) {
    vStart = 0;
    vEnd = m;
  }

  vStart = Math.max(0, Math.min(vStart, m));
  vEnd = Math.max(vStart + 1, Math.min(vEnd, m));

  // Ensure selection fits inside view.
  if (vStart > sel.startIdx) vStart = sel.startIdx;
  if (vEnd < sel.endIdx) vEnd = sel.endIdx;

  // Clamp again after expanding for selection.
  if (vEnd > m) {
    const shift = vEnd - m;
    vEnd = m;
    vStart = Math.max(0, vStart - shift);
  }

  const span = Math.max(1, vEnd - vStart);
  vStart = Math.max(0, Math.min(vStart, m - span));
  vEnd = Math.min(m, vStart + span);

  trimViewStartIdx = vStart;
  trimViewEndIdx = vEnd;

  return {
    ...sel,
    viewStartIdx: vStart,
    viewEndIdx: vEnd,
    viewSpan: span,
    minSpan: computeTrimViewMinSpan(sel),
  };
}

function setTrimViewSpan(newSpan, { centerIdx } = {}) {
  const { startIdx, endIdx, maxIdx, minSpan } = normalizeTrimViewBounds();
  if (maxIdx < 1) return;

  const span = Math.max(minSpan, Math.min(Math.floor(Number(newSpan) || 0), maxIdx));
  if (span >= maxIdx) {
    resetTrimView({ maxIdx });
    return;
  }

  const center = Number.isFinite(centerIdx) ? Number(centerIdx) : (startIdx + endIdx) / 2;
  let vStart = Math.floor(center - span / 2);
  vStart = Math.max(0, Math.min(vStart, maxIdx - span));
  let vEnd = vStart + span;

  // Safety: keep selection inside view (can happen near edges due to rounding).
  if (vStart > startIdx) vStart = Math.max(0, startIdx);
  if (vEnd < endIdx) vEnd = Math.min(maxIdx, endIdx);
  if (vEnd > maxIdx) {
    const shift = vEnd - maxIdx;
    vEnd = maxIdx;
    vStart = Math.max(0, vStart - shift);
  }

  trimViewStartIdx = vStart;
  trimViewEndIdx = vEnd;
}

function updateTrimZoomUI() {
  const { maxIdx, viewStartIdx, viewEndIdx, viewSpan, minSpan } = normalizeTrimViewBounds();
  const enabled = series.length >= 2 && maxIdx >= 1;
  const isFull = viewStartIdx === 0 && viewEndIdx === maxIdx;

  if (trimZoomOutBtn) trimZoomOutBtn.disabled = !enabled || isFull;
  if (trimZoomInBtn) trimZoomInBtn.disabled = !enabled || viewSpan <= minSpan;
}

function zoomTrimIn() {
  const { maxIdx, viewSpan, minSpan } = normalizeTrimViewBounds();
  if (maxIdx < 1) return;
  setTrimViewSpan(Math.max(minSpan, Math.floor(viewSpan / 2)));
  syncTrimInputs();
  updateSliderVisual();
  updateTrimZoomUI();
}

function zoomTrimOut() {
  const { maxIdx, viewSpan } = normalizeTrimViewBounds();
  if (maxIdx < 1) return;
  setTrimViewSpan(Math.min(maxIdx, Math.floor(viewSpan * 2)));
  syncTrimInputs();
  updateSliderVisual();
  updateTrimZoomUI();
}

function canSaveTrim() {
  return SESSION_ID_OK && series.length >= 2;
}

function updateTrimToolsUI() {
  if (trimToolsEl) trimToolsEl.classList.toggle('hidden', !SESSION_ID_OK);
  const full = trimIndex.length >= 5;
  if (trimSaveBtn) trimSaveBtn.disabled = !canSaveTrim() || full;
  if (trimMenuBtn) {
    trimMenuBtn.disabled = !SESSION_ID_OK;
    trimMenuBtn.classList.remove('hidden');
  }
}

function normalizeTrimSelection() {
  const ids = new Set(trimIndex.map(t => t.id));
  trimSelection.ids = new Set([...trimSelection.ids].filter(id => ids.has(id)));
  if (!trimSelection.ids.size) trimSelection.all = true;
  if (trimSelection.all) trimSelection.ids = new Set();
  if (activeTrimId && !trimSelection.ids.has(activeTrimId)) activeTrimId = null;
}

function formatTrimLabel(item) {
  const base = item?.id || 'trim';
  const name = String(item?.name || '').trim();
  if (!name || name.toLowerCase() === 'unnamed') return base;
  return `${base} - ${name}`;
}

function getTrimById(id) {
  return trimIndex.find(t => t.id === id);
}

function setTrimDeleteModalOpen(open, { trimId = '', label = '' } = {}) {
  if (!trimDeleteModal) return;
  if (open) {
    pendingDeleteTrimId = String(trimId || '').trim();
    pendingDeleteTrimLabel = String(label || '').trim();
    if (trimDeleteTextEl) trimDeleteTextEl.textContent = `¿Eliminar ${pendingDeleteTrimLabel || pendingDeleteTrimId || 'trim'}?`;
    clearTrimDeleteMsg();
  } else {
    pendingDeleteTrimId = '';
    pendingDeleteTrimLabel = '';
    clearTrimDeleteMsg();
  }
  setModalOpen(trimDeleteModal, open);
}

function resolveActiveTrimId() {
  if (trimSelection.all || !trimSelection.ids.size) {
    activeTrimId = null;
    return null;
  }
  if (activeTrimId && trimSelection.ids.has(activeTrimId)) return activeTrimId;
  const next = [...trimSelection.ids][0] || null;
  activeTrimId = next;
  return next;
}

function applyTrimSelection({ fit = true } = {}) {
  if (trimSelection.all || !trimSelection.ids.size) {
    trimSelection.all = true;
    trimSelection.ids = new Set();
    activeTrimId = null;
    clearAllBuoys();
    if (!series.length) return;
    const maxIdx = maxSeriesIdx();
    if (maxIdx < 1) return;
    trimStartIdx = 0;
    trimEndIdx = maxIdx;
    idx = 0;
    resetTrimView({ maxIdx });
    syncTrimInputs();
    lastPos = null;
    updatePosition();
    updateTrackTrim({ fit });
    return;
  }

  if (!series.length) {
    const activeId = resolveActiveTrimId();
    applyTrimBuoysForId(activeId);
    return;
  }
  const maxIdx = maxSeriesIdx();
  if (maxIdx < 1) return;

  const activeId = resolveActiveTrimId();
  const item = getTrimById(activeId);
  const rawStart = Number(item?.start_idx);
  const rawEnd = Number(item?.end_idx);
  if (!Number.isFinite(rawStart) || !Number.isFinite(rawEnd)) {
    trimSelection.all = true;
    trimSelection.ids = new Set();
    activeTrimId = null;
    clearAllBuoys();
    trimStartIdx = 0;
    trimEndIdx = maxIdx;
    idx = 0;
    resetTrimView({ maxIdx });
    syncTrimInputs();
    lastPos = null;
    updatePosition();
    updateTrackTrim({ fit });
    return;
  }

  applyTrimBuoysForId(activeId);

  let startIdx = Math.floor(rawStart);
  let endIdx = Math.floor(rawEnd);
  if (endIdx <= startIdx) endIdx = startIdx + 1;
  startIdx = Math.max(0, Math.min(startIdx, maxIdx));
  endIdx = Math.max(1, Math.min(endIdx, maxIdx));

  const gap = Math.max(1, Math.min(MIN_TRIM_GAP, maxIdx));
  if (endIdx - startIdx < gap) {
    endIdx = Math.min(maxIdx, startIdx + gap);
    startIdx = Math.max(0, Math.min(startIdx, maxIdx - gap));
  }

  trimStartIdx = startIdx;
  trimEndIdx = endIdx;
  normalizeTrimBounds();

  const minSpan = computeTrimViewMinSpan({ startIdx: trimStartIdx, endIdx: trimEndIdx, maxIdx });
  setTrimViewSpan(minSpan, { centerIdx: (trimStartIdx + trimEndIdx) / 2 });

  if (idx < trimStartIdx || idx > trimEndIdx) idx = trimStartIdx;
  syncTrimInputs();
  lastPos = null;
  updatePosition();
  updateTrackTrim({ fit });
}

function updateTrimListEmptyState({ ok = true } = {}) {
  if (!trimListEmptyEl) return;
  if (!ok) trimListEmptyEl.textContent = trimIndexLastError ? `Error: ${trimIndexLastError}` : 'Error cargando trims. Reintentá.';
  else trimListEmptyEl.textContent = 'No hay trims guardados.';
  trimListEmptyEl.classList.toggle('hidden', trimIndex.length > 0);
}

function renderTrimList() {
  if (!trimListContainer) return;
  trimListContainer.innerHTML = '';

  normalizeTrimSelection();

  const makeTrashIcon = () => {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.6');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    const p1 = document.createElementNS(ns, 'path');
    p1.setAttribute('d', 'M3 6h18');
    const p2 = document.createElementNS(ns, 'path');
    p2.setAttribute('d', 'M8 6V4h8v2');
    const p3 = document.createElementNS(ns, 'path');
    p3.setAttribute('d', 'M19 6l-1 14H6L5 6');
    const p4 = document.createElementNS(ns, 'path');
    p4.setAttribute('d', 'M10 11v6');
    const p5 = document.createElementNS(ns, 'path');
    p5.setAttribute('d', 'M14 11v6');
    svg.appendChild(p1);
    svg.appendChild(p2);
    svg.appendChild(p3);
    svg.appendChild(p4);
    svg.appendChild(p5);
    return svg;
  };

  const makeItem = ({ label, checked, onToggle, onDelete = null }) => {
    const row = document.createElement('div');
    row.className = 'trim-row';

    const labelEl = document.createElement('div');
    labelEl.className = 'trim-label';
    labelEl.textContent = label;
    row.appendChild(labelEl);

    const actions = document.createElement('div');
    actions.className = 'trim-actions';

    if (typeof onDelete === 'function') {
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'trim-delete';
      delBtn.title = 'Eliminar';
      delBtn.setAttribute('aria-label', `Eliminar ${label}`);
      delBtn.appendChild(makeTrashIcon());
      delBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onDelete();
      });
      actions.appendChild(delBtn);
    }

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.addEventListener('change', () => onToggle(input.checked));
    actions.appendChild(input);

    row.appendChild(actions);
    trimListContainer.appendChild(row);
  };

  makeItem({ label: 'All', checked: trimSelection.all, onToggle: (isOn) => {
    if (isOn) {
      trimSelection.all = true;
      trimSelection.ids = new Set();
    } else if (!trimSelection.ids.size) {
      trimSelection.all = true;
    }
    applyTrimSelection({ fit: true });
    renderTrimList();
  } });

  const sorted = [...trimIndex].sort((a, b) => a.id.localeCompare(b.id));
  for (const item of sorted) {
    const label = formatTrimLabel(item);
    const checked = trimSelection.ids.has(item.id);
    makeItem({
      label,
      checked,
      onDelete: () => setTrimDeleteModalOpen(true, { trimId: item.id, label }),
      onToggle: (isOn) => {
      if (isOn) {
        trimSelection.ids.add(item.id);
        trimSelection.all = false;
        activeTrimId = item.id;
      } else {
        trimSelection.ids.delete(item.id);
        if (!trimSelection.ids.size) trimSelection.all = true;
        if (activeTrimId === item.id) activeTrimId = null;
      }
      applyTrimSelection({ fit: true });
      renderTrimList();
    } });
  }
}

async function fetchTrimIndex() {
  if (trimIndexFetchPromise) return trimIndexFetchPromise;
  trimIndexLastError = '';
  if (!SESSION_ID_OK) {
    trimIndex = [];
    updateTrimToolsUI();
    return false;
  }
  trimIndexFetchPromise = (async () => {
    let ok = false;
    try {
      const url = apiUrl(`/sessions/${encodeURIComponent(SESSION_ID)}/trims`);
      const headers = {};
      if (trimIndexETag) headers['If-None-Match'] = trimIndexETag;
      const r = await fetch(url, { credentials: 'omit', headers });
      if (r.status === 304) return true;

      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = String(data?.error || '').trim();
        trimIndexLastError = msg ? `HTTP ${r.status}: ${msg}` : `HTTP ${r.status}`;
        throw new Error(trimIndexLastError);
      }

      trimIndex = Array.isArray(data.trims) ? data.trims : [];
      trimIndexETag = r.headers.get('ETag') || '';
      ok = true;
    } catch (err) {
      const msg = String(err?.message || '').trim();
      trimIndexLastError = trimIndexLastError || msg || 'Error cargando trims';
      console.warn('trim list error', err);
      trimIndex = [];
    } finally {
      trimIndexFetchPromise = null;
    }
    normalizeTrimSelection();
    updateTrimToolsUI();
    return ok;
  })();
  return trimIndexFetchPromise;
}

async function deleteTrim() {
  if (!pendingDeleteTrimId) return;
  if (!SESSION_ID_OK) {
    showTrimDeleteMsg('Falta session_id válido.', { isError: true });
    return;
  }

  const trimId = pendingDeleteTrimId;
  const label = pendingDeleteTrimLabel || trimId;

  if (trimDeleteConfirmBtn) trimDeleteConfirmBtn.disabled = true;
  trimDeleteConfirmBtn?.classList?.add?.('is-loading');

  try {
    const url = apiUrl(`/sessions/${encodeURIComponent(SESSION_ID)}/trims/${encodeURIComponent(trimId)}`);
    const r = await fetch(url, { method: 'DELETE', credentials: 'omit' });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = String(data?.error || '').trim();
      showTrimDeleteMsg(msg ? `Error: ${msg}` : `Error eliminando (${r.status}).`, { isError: true });
      return;
    }

    trimIndex = trimIndex.filter(t => t.id !== trimId);
    trimIndexETag = '';
    trimIndexLastError = '';
    trimBuoyCache.delete(trimId);

    trimSelection.all = true;
    trimSelection.ids = new Set();
    activeTrimId = null;

    updateTrimToolsUI();
    applyTrimSelection({ fit: true });
    renderTrimList();
    updateTrimListEmptyState({ ok: true });
    setTrimDeleteModalOpen(false);

    setStatus('info', `Eliminado: ${label}`, { autoClearMs: 2500 });
  } catch (err) {
    console.error(err);
    showTrimDeleteMsg('Error eliminando trim.', { isError: true });
  } finally {
    if (trimDeleteConfirmBtn) trimDeleteConfirmBtn.disabled = false;
    trimDeleteConfirmBtn?.classList?.remove?.('is-loading');
  }
}

async function saveTrim() {
  if (!SESSION_ID_OK) {
    showTrimSaveMsg('Falta session_id válido.', { isError: true });
    return;
  }
  if (!series.length) {
    showTrimSaveMsg('No hay serie cargada.', { isError: true });
    return;
  }
  const { startIdx, endIdx, maxIdx } = normalizeTrimBounds();
  if (maxIdx < 1 || endIdx <= startIdx) {
    showTrimSaveMsg('Trim inválido.', { isError: true });
    return;
  }
  const rawName = (trimNameInput?.value || '').trim();
  const name = rawName ? rawName : 'unnamed';
  const buoys = normalizeBuoyList(buoyMarkers.map((m) => {
    const ll = m.getLatLng?.();
    return {
      type: m._buoyType || '',
      lat: Number(ll?.lat),
      lon: Number(ll?.lng),
    };
  }));

  if (trimSaveConfirmBtn) trimSaveConfirmBtn.disabled = true;
  trimSaveConfirmBtn?.classList?.add?.('is-loading');
  try {
    const url = apiUrl(`/sessions/${encodeURIComponent(SESSION_ID)}/trims`);
    const payload = { name, start_idx: startIdx, end_idx: endIdx, buoys };
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = data?.error || (r.status === 409 ? 'No hay más slots libres.' : 'Error guardando trim.');
      showTrimSaveMsg(msg, { isError: true });
      return;
    }
    const label = data?.label || `${data?.id || 'trim'}-${data?.name || name}`;
    showTrimSaveMsg(`Guardado: ${label}`);
    const trimId = String(data?.id || '').trim();
    if (trimId) {
      trimIndex = trimIndex.filter(t => t.id !== trimId);
      trimIndex.push({
        id: trimId,
        name: String(data?.name || name || '').trim(),
        label: String(data?.label || label || '').trim(),
        start_idx: startIdx,
        end_idx: endIdx,
      });
      trimIndex.sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));
      trimIndexETag = '';
      trimBuoyCache.set(trimId, buoys.map(b => ({ ...b })));
      updateTrimToolsUI();
    }
    setModalOpen(trimSaveModal, false);
  } catch (err) {
    console.error(err);
    showTrimSaveMsg('Error guardando trim.', { isError: true });
  } finally {
    if (trimSaveConfirmBtn) trimSaveConfirmBtn.disabled = false;
    trimSaveConfirmBtn?.classList?.remove?.('is-loading');
  }
}

function updateSliderVisual() {
  if ((!trimEl && !playheadEl) || !series.length) return;
  const { startIdx, endIdx, maxIdx } = normalizeTrimBounds();
  if (maxIdx <= 0) return;

  const posIdx = Math.max(startIdx, Math.min(idx, endIdx));

  const { viewStartIdx, viewEndIdx } = normalizeTrimViewBounds({ startIdx, endIdx, maxIdx });
  const viewDenom = Math.max(1, viewEndIdx - viewStartIdx);
  const pct = (i) => `${clamp01((i - viewStartIdx) / viewDenom) * 100}%`;
  if (trimEl) {
    trimEl.style.setProperty('--start', pct(startIdx));
    trimEl.style.setProperty('--end', pct(endIdx));
  }

  const denom = Math.max(1, endIdx - startIdx);
  const localRatio = clamp01((posIdx - startIdx) / denom);
  if (playheadEl) playheadEl.style.setProperty('--pos', `${localRatio * 100}%`);
}

function trimLatLngLinesByPointRange(latlngLines, startPoint, endPoint) {
  const lines = Array.isArray(latlngLines) ? latlngLines : [];
  const out = [];
  let offset = 0;

  for (const line of lines) {
    if (!Array.isArray(line) || !line.length) continue;

    const lineStart = offset;
    const lineEnd = offset + line.length - 1;
    offset += line.length;

    const s = Math.max(startPoint, lineStart);
    const e = Math.min(endPoint, lineEnd);
    if (s > e) continue;

    const seg = line.slice(s - lineStart, e - lineStart + 1);
    if (seg.length) out.push(seg);
  }

  return out;
}

function trimLatLngLinesByRatioRange(latlngLines, startRatio, endRatio) {
  const lines = Array.isArray(latlngLines) ? latlngLines : [];
  const total = lines.reduce((acc, line) => acc + (Array.isArray(line) ? line.length : 0), 0);
  if (total < 2) return lines;

  const maxPoint = total - 1;
  let startPoint = Math.floor(clamp01(startRatio) * maxPoint);
  let endPoint = Math.floor(clamp01(endRatio) * maxPoint);

  if (endPoint <= startPoint) endPoint = Math.min(maxPoint, startPoint + 1);
  return trimLatLngLinesByPointRange(lines, startPoint, endPoint);
}

function updateTrackTrim({ fit = false } = {}) {
  if (!trackLatLngLinesFull.length) return;

  const { startIdx, endIdx, maxIdx } = normalizeTrimBounds();
  const startRatio = maxIdx ? clamp01(startIdx / maxIdx) : 0;
  const endRatio = maxIdx ? clamp01(endIdx / maxIdx) : 1;
  const trimmed = trimLatLngLinesByRatioRange(trackLatLngLinesFull, startRatio, endRatio);
  const linesToRender = trimmed.length ? trimmed : trackLatLngLinesFull;

  if (trackLine) { try { map.removeLayer(trackLine); } catch (_) {} }
  trackLine = trackMode === TRACK_MODE_SPEED
    ? buildSogTrack(linesToRender, { startIdx, endIdx })
    : buildGradientTrack(linesToRender);
  if (trackMode !== TRACK_MODE_WAKE) trackLine.addTo(map);

  setEndpointMarkers(linesToRender);
  updateSliderVisual();

  if (fit) {
    const bounds = trackLine.getBounds();
    if (bounds.isValid()) fitBoundsWithUI(bounds);
  }
}

function syncTrimInputs() {
  const { startIdx, endIdx, maxIdx } = normalizeTrimBounds();
  if (!maxIdx) return;

  const { viewStartIdx, viewEndIdx } = normalizeTrimViewBounds({ startIdx, endIdx, maxIdx });

  if (trimStartRange) {
    trimStartRange.min = String(viewStartIdx);
    trimStartRange.max = String(viewEndIdx);
    trimStartRange.value = String(startIdx);
  }
  if (trimEndRange) {
    trimEndRange.min = String(viewStartIdx);
    trimEndRange.max = String(viewEndIdx);
    trimEndRange.value = String(endIdx);
  }
  if (timeRange) {
    timeRange.min = String(startIdx);
    timeRange.max = String(endIdx);
    timeRange.value = String(idx);
  }

  updateTrimZoomUI();
}

function setTrimStart(newStartIdx) {
  const { maxIdx } = normalizeTrimBounds();
  if (maxIdx < 1) return;

  const gap = Math.max(1, Math.min(MIN_TRIM_GAP, maxIdx));
  const endIdx = trimEndIdx;
  const startMax = Math.max(0, Math.min(endIdx - gap, maxIdx - gap));
  trimStartIdx = Math.max(0, Math.min(startMax, Math.floor(Number(newStartIdx) || 0)));

  normalizeTrimBounds();
  if (trimEndIdx - trimStartIdx < gap) trimEndIdx = Math.min(maxIdx, trimStartIdx + gap);
  normalizeTrimBounds();

  if (idx < trimStartIdx || idx > trimEndIdx) idx = trimStartIdx;
  syncTrimInputs();

  lastPos = null;
  updatePosition();
  updateTrackTrim();
}

function setTrimEnd(newEndIdx) {
  const { maxIdx } = normalizeTrimBounds();
  if (maxIdx < 1) return;

  const gap = Math.max(1, Math.min(MIN_TRIM_GAP, maxIdx));
  trimEndIdx = Math.max(gap, Math.min(maxIdx, Math.floor(Number(newEndIdx) || 0)));
  if (trimEndIdx - trimStartIdx < gap) trimEndIdx = Math.min(maxIdx, trimStartIdx + gap);
  normalizeTrimBounds();

  if (idx < trimStartIdx) idx = trimStartIdx;
  if (idx > trimEndIdx) idx = trimEndIdx;
  syncTrimInputs();

  lastPos = null;
  updatePosition();
  updateTrackTrim();
}

function setEndpointMarkers(latlngLines) {
  if (startMarker) { try { map.removeLayer(startMarker); } catch(_) {} startMarker = null; }
  if (endMarker) { try { map.removeLayer(endMarker); } catch(_) {} endMarker = null; }

  const firstLine = latlngLines?.[0];
  const lastLine = latlngLines?.[latlngLines.length - 1];
  if (!firstLine?.length || !lastLine?.length) return;

  const start = firstLine[0];
  const end = lastLine[lastLine.length - 1];

  startMarker = L.circleMarker(start, {
    radius: 5,
    weight: 2,
    color: '#00d18f',
    fillColor: '#00d18f',
    fillOpacity: 0.9,
  }).addTo(map);

  endMarker = L.circleMarker(end, {
    radius: 5,
    weight: 2,
    color: '#ff6b6b',
    fillColor: '#ff6b6b',
    fillOpacity: 0.9,
  }).addTo(map);
}

function renderTrack(trackJson) {
  const lines = extractLineStringsFromGeoJSON(trackJson);
  if (!lines.length) throw new Error('GeoJSON inválido (no LineString)');

  const order = guessCoordOrder(lines);
  trackLatLngLinesFull = toLatLngLines(lines, order);
  if (!trackLatLngLinesFull.length) throw new Error('GeoJSON inválido (sin coordenadas válidas)');
  updateTrackTrim({ fit: true });
  trackBoundsFull = boundsFromLatLngLines(trackLatLngLinesFull);
  lockMapToTrack();

  return { order };
}

function fitBoundsWithUI(bounds) {
  map.fitBounds(bounds.pad(0.1), {
    paddingTopLeft: [24, 24],
    paddingBottomRight: [24, 24],
  });
}

function centerOnBoat() {
  const latlng = boatMarker?.getLatLng?.();
  if (latlng) {
    map.panTo(latlng, { animate: true, duration: 0.35 });
    return;
  }

  const bounds = trackLine?.getBounds?.();
  if (!bounds?.isValid?.() || !bounds.isValid()) return;
  fitBoundsWithUI(bounds);
}

// Habilitar/deshabilitar UI
function setUIEnabled(enabled) {
  if (playBtn) playBtn.disabled = !enabled;
  if (trimStartRange) trimStartRange.disabled = !enabled;
  if (trimEndRange) trimEndRange.disabled = !enabled;
  if (trimZoomOutBtn) trimZoomOutBtn.disabled = !enabled;
  if (trimZoomInBtn) trimZoomInBtn.disabled = !enabled;
  if (timeRange) timeRange.disabled = !enabled;
  if (speedSel) speedSel.disabled = !enabled;
  if (wakeBtn) wakeBtn.disabled = !enabled;
  if (enabled) updateTrimZoomUI();
  updateTrimToolsUI();
}

// --- Play/Pause ---
function play() {
  if (timer) return;
  if (!series.length) return;
  const { startIdx, endIdx } = normalizeTrimBounds();
  if (idx < startIdx) idx = startIdx;
  if (idx >= endIdx) idx = startIdx; // loop opcional; quitalo si no querés
  if (playBtn) {
    playBtn.classList.add('is-playing');
    playBtn.setAttribute('aria-label', 'Pause');
  }
  const rate = Number(speedSel.value) || 1;
  timer = setInterval(() => {
    idx = Math.min(idx + 1, endIdx);
    updatePosition();
    if (idx >= endIdx) pause(); // o: idx = 0; (para loop)
  }, 1000 / rate);
}

function pause() {
  if (timer) { clearInterval(timer); timer = null; }
  if (playBtn) {
    playBtn.classList.remove('is-playing');
    playBtn.setAttribute('aria-label', 'Play');
  }
}

// Eventos UI
playBtn.addEventListener('click', () => (timer ? pause() : play()));
if (trimStartRange) {
  trimStartRange.addEventListener('input', (e) => {
    pause();
    setTrimStart(Number(e.target.value) || 0);
  });
}
if (trimEndRange) {
  trimEndRange.addEventListener('input', (e) => {
    pause();
    setTrimEnd(Number(e.target.value) || 0);
  });
}
if (trimZoomOutBtn) {
  trimZoomOutBtn.addEventListener('click', () => {
    pause();
    zoomTrimOut();
  });
}
if (trimZoomInBtn) {
  trimZoomInBtn.addEventListener('click', () => {
    pause();
    zoomTrimIn();
  });
}
if (trimSaveBtn) {
  trimSaveBtn.addEventListener('click', () => {
    if (!SESSION_ID_OK) {
      setStatus('error', 'Falta session_id válido.');
      return;
    }
    clearTrimSaveMsg();
    if (trimNameInput) trimNameInput.value = '';
    setModalOpen(trimSaveModal, true);
    trimNameInput?.focus?.();
  });
}
if (trimMenuBtn) {
  trimMenuBtn.addEventListener('click', async () => {
    setModalOpen(trimListModal, true);
    if (trimListContainer) trimListContainer.innerHTML = '';
    if (trimListEmptyEl) trimListEmptyEl.classList.add('hidden');
    if (trimListLoadingEl) trimListLoadingEl.classList.remove('hidden');
    const ok = await fetchTrimIndex();
    if (trimListLoadingEl) trimListLoadingEl.classList.add('hidden');
    renderTrimList();
    updateTrimListEmptyState({ ok });
  });
}
if (trimSaveConfirmBtn) {
  trimSaveConfirmBtn.addEventListener('click', () => saveTrim());
}
if (trimNameInput) {
  trimNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveTrim();
    }
  });
}
if (trimSaveCancelBtn) {
  trimSaveCancelBtn.addEventListener('click', () => setModalOpen(trimSaveModal, false));
}
if (trimSaveCloseBtn) {
  trimSaveCloseBtn.addEventListener('click', () => setModalOpen(trimSaveModal, false));
}
if (trimListCloseBtn) {
  trimListCloseBtn.addEventListener('click', () => setModalOpen(trimListModal, false));
}
if (trimListDoneBtn) {
  trimListDoneBtn.addEventListener('click', () => setModalOpen(trimListModal, false));
}
if (trimSaveModal) {
  trimSaveModal.addEventListener('click', (e) => {
    if (e.target === trimSaveModal) setModalOpen(trimSaveModal, false);
  });
}
if (trimListModal) {
  trimListModal.addEventListener('click', (e) => {
    if (e.target === trimListModal) setModalOpen(trimListModal, false);
  });
}
if (trimDeleteCancelBtn) {
  trimDeleteCancelBtn.addEventListener('click', () => setTrimDeleteModalOpen(false));
}
if (trimDeleteCloseBtn) {
  trimDeleteCloseBtn.addEventListener('click', () => setTrimDeleteModalOpen(false));
}
if (trimDeleteConfirmBtn) {
  trimDeleteConfirmBtn.addEventListener('click', () => deleteTrim());
}
if (trimDeleteModal) {
  trimDeleteModal.addEventListener('click', (e) => {
    if (e.target === trimDeleteModal) setTrimDeleteModalOpen(false);
  });
}
timeRange.addEventListener('input', (e) => {
  pause();
  const v = Number(e.target.value) || 0;
  const { startIdx, endIdx } = normalizeTrimBounds();
  idx = Math.max(startIdx, Math.min(v, endIdx));
  timeRange.value = String(idx);
  // evitar segmentos enormes al scrub
  lastPos = null;
  updatePosition();
});
speedSel.addEventListener('change', () => {
  if (timer) { pause(); play(); } // reinicia con nuevo rate
});

if (buoyBtn) {
  buoyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setBuoyMenuOpen(!buoyMenuOpen);
  });
}
if (buoyMenu) {
  buoyMenu.addEventListener('click', (e) => {
    const btn = e.target.closest?.('[data-buoy-type]');
    const type = btn?.getAttribute?.('data-buoy-type');
    if (type === 'windward' || type === 'leeward') {
      setBuoyPlacementMode(type);
      setBuoyMenuOpen(false);
    }
  });
}
document.addEventListener('click', (e) => {
  if (!buoyMenuOpen) return;
  if (buoyControlEl && buoyControlEl.contains(e.target)) return;
  setBuoyMenuOpen(false);
});

if (wakeBtn) {
  wakeBtn.addEventListener('click', () => {
    trackMode = (trackMode + 1) % 3;
    syncWakeBtnUI();

    if (trackMode === TRACK_MODE_WAKE) {
      if (trackLine && map.hasLayer(trackLine)) map.removeLayer(trackLine);
      clearWakeSegments();
      lastPos = null;
      startWakeDecay();
    } else {
      stopWakeDecay();
      clearWakeSegments();
      // Rebuild track with the right style (default vs SOG-colored)
      updateTrackTrim();
      if (trackLine && !map.hasLayer(trackLine)) trackLine.addTo(map);
    }
    updatePosition();
  });
}

if (fitBtn) {
  fitBtn.addEventListener('click', () => centerOnBoat());
}

// --- Init / carga de datos ---
async function init() {
  cacheState.html = navCacheStatus();
  renderCacheBadge();

  // map always works; playback is optional (requires ?series=...)
  setUIEnabled(false);
  setPlaybackVisible(false);
  if (fitBtn) fitBtn.disabled = true;

  if (!TRACK_URL) {
    const msg = params.trackRaw
      ? 'Parámetro ?track= inválido (solo http/https)'
      : params.sessionIdRaw
        ? 'Parámetro ?session_id= inválido'
        : 'Falta ?track=<URL_GEOJSON> o ?session_id=<ID>';
    setStatus('error', msg);
    return;
  }

  try {
    setStatus('info', 'Cargando track…');
    const trackJson = await fetchJSON(TRACK_URL);
    renderTrack(trackJson);
    if (fitBtn) fitBtn.disabled = false;
    if (mapControlsEl) mapControlsEl.classList.remove('hidden');
    setStatus('', '');

    // series is optional (enables playback + KPIs)
    series = [];
    if (SERIES_URL) {
      try {
        setStatus('info', 'Cargando serie 1Hz…');
        series = (await fetchCSV(SERIES_URL)) || [];
        setStatus('', '');
      } catch (err) {
        console.error(err);
        series = [];
        setStatus('error', 'Track cargado, pero falló la serie. Mostrando solo el mapa.', { autoClearMs: 6000 });
      }
    } else if (params.seriesRaw) {
      setStatus('error', 'Parámetro ?series= inválido (solo http/https). Mostrando solo el mapa.', { autoClearMs: 6000 });
    } else {
      setStatus('info', 'Mapa listo.', { autoClearMs: 2000 });
    }

    trimStartIdx = 0;
    trimEndIdx = 0;
    idx = 0;
    if (series.length >= 2) {
      setPlaybackVisible(true);
      const maxIdx = Math.max(series.length - 1, 0);
      trimEndIdx = maxIdx;
      resetTrimView({ maxIdx });
      syncTrimInputs();
      updatePosition();
      setUIEnabled(true);

      if (params.rate && speedSel) {
        const rateStr = String(params.rate);
        if ([...speedSel.options].some(o => o.value === rateStr)) speedSel.value = rateStr;
      }
      if (params.autoplay) play();
    } else {
      setPlaybackVisible(false);
      setUIEnabled(false);
    }

  } catch (err) {
    console.error(err);
    setStatus('error', 'Error cargando el track. Verificá la URL y CORS.');
    setUIEnabled(false);
    setPlaybackVisible(false);
  }
}

init();
