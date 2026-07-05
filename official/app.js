const root = document.documentElement;
const themeToggle = document.querySelector('#themeToggle');
const themeLabel = document.querySelector('#themeLabel');
const authModal = document.querySelector('#authModal');
const openLogin = document.querySelector('#openLogin');
const closeModal = document.querySelector('#closeModal');
const loginForm = document.querySelector('#loginForm');
const registerForm = document.querySelector('#registerForm');
const landingScreen = document.querySelector('#landingScreen');
const workspace = document.querySelector('#workspace');
const clearFiles = document.querySelector('#clearFiles');
const fileList = document.querySelector('#fileList');
const logoutVectorButton = document.querySelector('#logoutVectorButton');
const openMapDialogButton = document.querySelector('#openMapDialogButton');
const closeMapDialogButton = document.querySelector('#closeMapDialogButton');
const mapDialog = document.querySelector('#mapDialog');

const MAP_LAYERS = {
  white: ['https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', 'CARTO Light'],
  osm: ['https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', 'OSM'],
  roads: ['https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', 'OSM HOT'],
  sat: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', 'Esri'],
  topo: ['https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', 'OpenTopoMap'],
  dark: ['https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', 'CARTO'],
};

let activeLayer = null;

function isLeafletReady() {
  return Boolean(window.L && typeof window.L.map === 'function');
}

function initVectorMap() {
  if (window.vectorMap || !isLeafletReady()) return window.vectorMap || null;

  window.vectorMap = window.L.map('vectorMap', { zoomControl: false }).setView([48.86, 37.60], 9);
  window.vectorLeafletMap = window.vectorMap;
  window.L.control.zoom({ position: 'bottomright' }).addTo(window.vectorMap);
  setMapLayer('white');
  document.querySelector('#vectorMap')?.classList.add('is-ready');

  return window.vectorMap;
}

function setMapLayer(layerKey = 'white') {
  const map = window.vectorMap || initVectorMap();
  if (!map) return;

  if (activeLayer) map.removeLayer(activeLayer);
  const config = MAP_LAYERS[layerKey] || MAP_LAYERS.white;
  activeLayer = window.L.tileLayer(config[0], {
    maxZoom: 19,
    attribution: config[1],
  }).addTo(map);

  document.querySelectorAll('.map-type-card').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.layer === layerKey);
  });
  closeMapDialog();
}

function openMapDialog() {
  mapDialog?.classList.add('is-open');
  mapDialog?.setAttribute('aria-hidden', 'false');
}

function closeMapDialog() {
  mapDialog?.classList.remove('is-open');
  mapDialog?.setAttribute('aria-hidden', 'true');
}


function getVectorMap() {
  const map = window.vectorLeafletMap || window.vectorMap || initVectorMap();
  if (map && typeof map.addLayer === 'function') {
    window.vectorLeafletMap = map;
    window.vectorMap = map;
    return map;
  }
  return null;
}

window.initVectorMap = initVectorMap;
window.getVectorMap = getVectorMap;
window.setMapLayer = setMapLayer;
window.openMapDialog = openMapDialog;
window.closeMapDialog = closeMapDialog;

function forceNavVisibility() {
  if (!document.querySelector('#vectorNavEmergencyStyles')) {
    const style = document.createElement('style');
    style.id = 'vectorNavEmergencyStyles';
    style.textContent = '#workspace.vector-workspace.is-open{display:block!important;position:relative!important;z-index:10!important}#workspace.vector-workspace.is-open>.hover-nav{display:flex!important;visibility:visible!important;opacity:1!important;position:fixed!important;top:0!important;bottom:0!important;z-index:9000!important;pointer-events:auto!important;transform:none!important}#workspace.vector-workspace.is-open>.hover-nav--left{left:0!important;right:auto!important}#workspace.vector-workspace.is-open>.hover-nav--right{right:0!important;left:auto!important}.theme-toggle{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}';
    document.head.appendChild(style);
  }

  document.querySelectorAll('#workspace > .hover-nav').forEach((nav) => {
    nav.style.display = 'flex';
    nav.style.visibility = 'visible';
    nav.style.opacity = '1';
    nav.style.position = 'fixed';
    nav.style.top = '0';
    nav.style.bottom = '0';
    nav.style.zIndex = '9000';
    nav.style.pointerEvents = 'auto';
  });
  themeToggle?.setAttribute('hidden', 'true');
}

function injectAsset(tag, attrs) {
  const selector = tag === 'link'
    ? `link[href^="${attrs.href.split('?')[0]}"]`
    : `script[src^="${attrs.src.split('?')[0]}"]`;
  if (document.querySelector(selector)) return;

  const element = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    element[key] = value;
  });
  document.head.appendChild(element);
}

function loadLibraryAssets() {
  injectAsset('link', { rel: 'stylesheet', href: './supabase-library.css?v=20260704-1' });
  injectAsset('script', { src: './supabase-library.js?v=20260704-1', defer: true });
  injectAsset('script', { src: './map-item-filter.js?v=20260704-1', defer: true });
  injectAsset('script', { src: './map-scale.js?v=20260704-1', defer: true });
  injectAsset('script', { src: './map-layer-control.js?v=20260705-4', defer: true });
  injectAsset('script', { src: './map-polygons-control.js?v=20260705-4', defer: true });
  injectAsset('link', { rel: 'stylesheet', href: './map-data.css?v=20260704-7' });
  injectAsset('script', { src: './map-data.js?v=20260704-7', defer: true });
  injectAsset('link', { rel: 'stylesheet', href: './dict-editor.css?v=20260704-1' });
  injectAsset('script', { src: './dict-editor.js?v=20260704-1', defer: true });
  injectAsset('script', { src: './route-point-editor.js?v=20260704-2', defer: true });
  injectAsset('script', { src: './map-network.js?v=20260704-1', defer: true });
}

function ensureMapDataButton() {
  const rightNav = document.querySelector('.hover-nav--right');
  if (!rightNav || document.querySelector('#openMapDataButton')) return;

  const button = document.createElement('button');
  button.className = 'hover-nav__item';
  button.id = 'openMapDataButton';
  button.type = 'button';
  button.innerHTML = '<img src="../assets/database-import.svg" alt=""><span>Дані</span>';
  button.addEventListener('click', () => window.openMapDataDialog?.());
  rightNav.insertBefore(button, rightNav.firstChild);
  forceNavVisibility();
}

function applyTheme() {
  root.dataset.theme = 'dark';
  localStorage.setItem('vector-theme', 'dark');
  if (themeLabel) themeLabel.textContent = 'Темна';
}

function setAuthMode(mode) {
  document.querySelectorAll('.auth-tab[data-auth-mode]').forEach((tab) => {
    tab.classList.toggle('is-active', tab.dataset.authMode === mode);
  });
  loginForm?.classList.toggle('is-active', mode === 'login');
  registerForm?.classList.toggle('is-active', mode === 'register');
}

function openAuth(mode = 'login') {
  setAuthMode(mode);
  authModal?.classList.add('is-open');
  authModal?.setAttribute('aria-hidden', 'false');
}

function closeAuth() {
  authModal?.classList.remove('is-open');
  authModal?.setAttribute('aria-hidden', 'true');
}

function showSection(sectionId) {
  document.querySelectorAll('.nav__item').forEach((item) => {
    item.classList.toggle('is-active', item.dataset.section === sectionId);
  });
  document.querySelectorAll('.section').forEach((section) => {
    section.classList.toggle('is-active', section.id === sectionId);
  });
  ensureMapDataButton();
  forceNavVisibility();

  if (sectionId === 'map') {
    setTimeout(() => window.vectorMap?.invalidateSize(), 80);
  }
}

window.enterVector = function enterVector() {
  closeAuth();
  landingScreen?.setAttribute('hidden', 'true');
  document.querySelector('.landing-bg')?.setAttribute('hidden', 'true');
  workspace?.classList.add('is-open');
  workspace?.setAttribute('aria-hidden', 'false');
  localStorage.setItem('vector-user-session', JSON.stringify({ email: 'local' }));
  showSection('map');
  forceNavVisibility();

  setTimeout(() => {
    initVectorMap();
    ensureMapDataButton();
    forceNavVisibility();
    window.vectorMap?.invalidateSize();
  }, 250);
};

window.logoutVector = function logoutVector() {
  workspace?.classList.remove('is-open');
  workspace?.setAttribute('aria-hidden', 'true');
  landingScreen?.removeAttribute('hidden');
  document.querySelector('.landing-bg')?.removeAttribute('hidden');
  authModal?.classList.remove('is-open');
  localStorage.removeItem('vector-user-session');
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderFileList() {
  if (!fileList) return;

  let files = [];
  try {
    files = JSON.parse(localStorage.getItem('vector-reference-files') || '[]');
  } catch {}

  if (!files.length) {
    fileList.textContent = 'Файли ще не додані.';
    return;
  }

  fileList.innerHTML = files.map((file) => `
    <div class="file-entry">
      <strong>${escapeHtml(file.name)}</strong>
      <span>${escapeHtml(file.type)}</span>
      <span>${file.importedTableId ? 'імпортована таблиця' : ''}</span>
    </div>
  `).join('');
}

applyTheme();
loadLibraryAssets();
forceNavVisibility();

openLogin?.addEventListener('click', () => openAuth('login'));
closeModal?.addEventListener('click', closeAuth);
authModal?.addEventListener('click', (event) => {
  if (event.target === authModal) closeAuth();
});

document.querySelectorAll('[data-auth-mode]').forEach((button) => {
  button.addEventListener('click', () => setAuthMode(button.dataset.authMode));
});

document.querySelectorAll('.nav__item').forEach((button) => {
  button.addEventListener('click', () => showSection(button.dataset.section));
});

document.querySelectorAll('.map-type-card').forEach((button) => {
  button.addEventListener('click', () => setMapLayer(button.dataset.layer));
});

openMapDialogButton?.addEventListener('click', openMapDialog);
closeMapDialogButton?.addEventListener('click', closeMapDialog);
logoutVectorButton?.addEventListener('click', window.logoutVector);

loginForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  window.enterVector();
});

registerForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  alert('Заявку зафіксовано локально.');
});

clearFiles?.addEventListener('click', () => {
  localStorage.removeItem('vector-reference-files');
  renderFileList();
});

renderFileList();
ensureMapDataButton();
forceNavVisibility();
setInterval(forceNavVisibility, 1200);

try {
  const session = JSON.parse(localStorage.getItem('vector-user-session') || 'null');
  if (session?.email) window.enterVector();
} catch {}
