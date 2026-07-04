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

function forceNavVisibility() {
  if (!document.querySelector('#vectorNavEmergencyStyles')) {
    const style = document.createElement('style');
    style.id = 'vectorNavEmergencyStyles';
    style.textContent = `
      #workspace.vector-workspace.is-open { display:block!important; position:relative!important; z-index:10!important; }
      #workspace.vector-workspace.is-open > .hover-nav { display:flex!important; visibility:visible!important; opacity:1!important; position:fixed!important; top:0!important; bottom:0!important; z-index:9000!important; pointer-events:auto!important; transform:none!important; }
      #workspace.vector-workspace.is-open > .hover-nav--left { left:0!important; right:auto!important; }
      #workspace.vector-workspace.is-open > .hover-nav--right { right:0!important; left:auto!important; }
      #workspace.vector-workspace.is-open .map-shell { z-index:1!important; }
      #workspace.vector-workspace.is-open .leaflet-map { z-index:1!important; }
      #workspace.vector-workspace.is-open .leaflet-pane, #workspace.vector-workspace.is-open .leaflet-top, #workspace.vector-workspace.is-open .leaflet-bottom { z-index:400!important; }
      .theme-toggle { display:flex!important; visibility:visible!important; opacity:1!important; z-index:9100!important; }
    `;
    document.head.appendChild(style);
  }
  document.querySelectorAll('#workspace > .hover-nav').forEach((nav) => {
    nav.style.display = 'flex'; nav.style.visibility = 'visible'; nav.style.opacity = '1'; nav.style.position = 'fixed'; nav.style.top = '0'; nav.style.bottom = '0'; nav.style.zIndex = '9000'; nav.style.pointerEvents = 'auto';
  });
}

function injectAsset(tag, attrs) {
  const selector = tag === 'link' ? `link[href^="${attrs.href.split('?')[0]}"]` : `script[src^="${attrs.src.split('?')[0]}"]`;
  if (document.querySelector(selector)) return;
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => { el[key] = value; });
  document.head.appendChild(el);
}

function loadLibraryAssets() {
  injectAsset('link', { rel: 'stylesheet', href: './supabase-library.css?v=20260704-1' });
  injectAsset('script', { src: './supabase-library.js?v=20260704-1', defer: true });
  injectAsset('script', { src: './map-item-filter.js?v=20260704-1', defer: true });
  injectAsset('link', { rel: 'stylesheet', href: './map-data.css?v=20260704-7' });
  injectAsset('script', { src: './map-data.js?v=20260704-7', defer: true });
  injectAsset('link', { rel: 'stylesheet', href: './dict-editor.css?v=20260704-1' });
  injectAsset('script', { src: './dict-editor.js?v=20260704-1', defer: true });
  injectAsset('script', { src: './route-point-editor.js?v=20260704-1', defer: true });
  injectAsset('script', { src: './map-network.js?v=20260704-1', defer: true });
}
loadLibraryAssets();
forceNavVisibility();

function ensureMapDataButton() {
  const rightNav = document.querySelector('.hover-nav--right');
  if (!rightNav || document.querySelector('#openMapDataButton')) return;
  const btn = document.createElement('button');
  btn.className = 'hover-nav__item'; btn.id = 'openMapDataButton'; btn.type = 'button';
  btn.innerHTML = '<img src="../assets/database-import.svg" alt=""><span>Дані</span>';
  btn.addEventListener('click', () => window.openMapDataDialog?.());
  rightNav.insertBefore(btn, rightNav.firstChild);
  forceNavVisibility();
}

function applyTheme(theme) { root.dataset.theme = theme; localStorage.setItem('vector-theme', theme); if (themeLabel) themeLabel.textContent = theme === 'dark' ? 'Темна' : 'Світла'; }
applyTheme(localStorage.getItem('vector-theme') || 'dark');
themeToggle?.addEventListener('click', () => applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'));
function setAuthMode(mode) { document.querySelectorAll('.auth-tab[data-auth-mode]').forEach((tab) => tab.classList.toggle('is-active', tab.datasetAuthMode === mode || tab.dataset.authMode === mode)); loginForm?.classList.toggle('is-active', mode === 'login'); registerForm?.classList.toggle('is-active', mode === 'register'); }