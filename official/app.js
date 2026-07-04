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

function loadLibraryAssets() {
  if (!document.querySelector('link[href^="./supabase-library.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './supabase-library.css?v=20260704-1';
    document.head.appendChild(link);
  }
  if (!document.querySelector('script[src^="./supabase-library.js"]')) {
    const script = document.createElement('script');
    script.src = './supabase-library.js?v=20260704-1';
    script.defer = true;
    document.head.appendChild(script);
  }
}
loadLibraryAssets();

function applyTheme(theme) {
  root.dataset.theme = theme;
  localStorage.setItem('vector-theme', theme);
  if (themeLabel) themeLabel.textContent = theme === 'dark' ? 'Темна' : 'Світла';
}
applyTheme(localStorage.getItem('vector-theme') || 'dark');
themeToggle?.addEventListener('click', () => applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'));

function setAuthMode(mode) {
  document.querySelectorAll('.auth-tab[data-auth-mode]').forEach((tab) => tab.classList.toggle('is-active', tab.dataset.authMode === mode));
  loginForm?.classList.toggle('is-active', mode === 'login');
  registerForm?.classList.toggle('is-active', mode === 'register');
}
function openAuth(mode = 'login') { setAuthMode(mode); authModal?.classList.add('is-open'); authModal?.setAttribute('aria-hidden', 'false'); }
function closeAuth() { authModal?.classList.remove('is-open'); authModal?.setAttribute('aria-hidden', 'true'); }
openLogin?.addEventListener('click', () => openAuth('login'));
closeModal?.addEventListener('click', closeAuth);
document.querySelectorAll('[data-auth-mode]').forEach((button) => button.addEventListener('click', () => setAuthMode(button.dataset.authMode)));

authModal?.addEventListener('click', (event) => { if (event.target === authModal) closeAuth(); });

function showSection(id) {
  document.querySelectorAll('.nav__item').forEach((item) => item.classList.toggle('is-active', item.dataset.section === id));
  document.querySelectorAll('.section').forEach((section) => section.classList.toggle('is-active', section.id === id));
}
document.querySelectorAll('.nav__item').forEach((button) => button.addEventListener('click', () => showSection(button.dataset.section)));

window.enterVector = function enterVector() {
  closeAuth();
  landingScreen?.setAttribute('hidden', 'true');
  document.querySelector('.landing-bg')?.setAttribute('hidden', 'true');
  workspace?.classList.add('is-open');
  workspace?.setAttribute('aria-hidden', 'false');
  localStorage.setItem('vector-user-session', JSON.stringify({ email: 'local' }));
  showSection('map');
};

window.logoutVector = function logoutVector() {
  workspace?.classList.remove('is-open');
  workspace?.setAttribute('aria-hidden', 'true');
  landingScreen?.removeAttribute('hidden');
  document.querySelector('.landing-bg')?.removeAttribute('hidden');
  localStorage.removeItem('vector-user-session');
};

loginForm?.addEventListener('submit', (event) => { event.preventDefault(); window.enterVector(); });
registerForm?.addEventListener('submit', (event) => { event.preventDefault(); alert('Заявку зафіксовано локально.'); });

function renderFileList() {
  if (!fileList) return;
  let files = [];
  try { files = JSON.parse(localStorage.getItem('vector-reference-files') || '[]'); } catch {}
  if (!files.length) { fileList.textContent = 'Файли ще не додані.'; return; }
  fileList.innerHTML = files.map((file) => `<div class="file-entry"><strong>${String(file.name || '')}</strong><span>${String(file.type || '')}</span><span>${file.importedTableId ? 'імпортована таблиця' : ''}</span></div>`).join('');
}
clearFiles?.addEventListener('click', () => { localStorage.removeItem('vector-reference-files'); renderFileList(); });
renderFileList();
try { const session = JSON.parse(localStorage.getItem('vector-user-session') || 'null'); if (session?.email) window.enterVector(); } catch {}
