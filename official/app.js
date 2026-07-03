const root = document.documentElement;
const themeToggle = document.querySelector('#themeToggle');
const themeLabel = document.querySelector('#themeLabel');
const authModal = document.querySelector('#authModal');
const openLogin = document.querySelector('#openLogin');
const closeModal = document.querySelector('#closeModal');
const authModeButtons = document.querySelectorAll('[data-auth-mode]');
const authTabs = document.querySelectorAll('.auth-tab[data-auth-mode]');
const loginForm = document.querySelector('#loginForm');
const registerForm = document.querySelector('#registerForm');
const landingScreen = document.querySelector('#landingScreen');
const workspace = document.querySelector('#workspace');
const sectionTitle = document.querySelector('#sectionTitle');
const logoutBtn = document.querySelector('#logoutBtn');
const uploadGrid = document.querySelector('#uploadGrid');
const fileList = document.querySelector('#fileList');
const filesCount = document.querySelector('#filesCount');
const clearFiles = document.querySelector('#clearFiles');

const USERS_KEY = 'vector-local-users';
const SESSION_KEY = 'vector-user-session';

const referenceTypes = [
  { key: 'ovt', title: 'ОВТ', description: 'Штат, фактична наявність, справність, ремонти, втрати.' },
  { key: 'combat', title: 'Бойова робота', description: 'Заявки, прикриття, коридори, оповіщення, робота ПУ.' },
  { key: 'freq', title: 'Частоти', description: 'Робочі діапазони засобів РЕБ та частоти БпЛА противника.' },
  { key: 'ics', title: 'ІКС', description: 'Графіт, Айсберг, SkyMap, користувачі та доступи.' },
  { key: 'training', title: 'Навчання', description: 'Підготовка операторів, інструктажі, практичні заняття.' },
  { key: 'map', title: 'Карта', description: 'ВП/СП, штаби, маршрути, РЗ/РО, станції, зони прикриття.' },
];

function applyTheme(theme) {
  root.dataset.theme = theme;
  localStorage.setItem('vector-theme', theme);
  if (themeLabel) themeLabel.textContent = theme === 'dark' ? 'Темна' : 'Світла';
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute('content', theme === 'dark' ? '#111418' : '#f4f2ee');
}

const savedTheme = localStorage.getItem('vector-theme');
const preferredTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
applyTheme(savedTheme || preferredTheme);

themeToggle?.addEventListener('click', () => applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'));

function setAuthMode(mode) {
  authTabs.forEach((tab) => tab.classList.toggle('is-active', tab.dataset.authMode === mode));
  loginForm?.classList.toggle('is-active', mode === 'login');
  registerForm?.classList.toggle('is-active', mode === 'register');
}

function openAuth(mode = 'login') {
  setAuthMode(mode);
  authModal?.classList.add('is-open');
  authModal?.setAttribute('aria-hidden', 'false');
  const firstField = authModal?.querySelector('.auth-form.is-active input');
  setTimeout(() => firstField?.focus(), 80);
}

function closeAuth() {
  authModal?.classList.remove('is-open');
  authModal?.setAttribute('aria-hidden', 'true');
  openLogin?.focus();
}

function openWorkspace(user = null) {
  closeAuth();
  landingScreen?.setAttribute('hidden', 'true');
  workspace?.classList.add('is-open');
  workspace?.setAttribute('aria-hidden', 'false');
  if (user) localStorage.setItem(SESSION_KEY, JSON.stringify({ email: user.email, role: user.role, marker: user.marker }));
}

function closeWorkspace() {
  workspace?.classList.remove('is-open');
  workspace?.setAttribute('aria-hidden', 'true');
  landingScreen?.removeAttribute('hidden');
  localStorage.removeItem(SESSION_KEY);
}

function getUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); } catch { return []; }
}

function showLoginMessage(message) {
  let box = loginForm?.querySelector('.auth-note');
  if (!box && loginForm) {
    box = document.createElement('p');
    box.className = 'auth-note';
    loginForm.appendChild(box);
  }
  if (box) box.textContent = message;
}

openLogin?.addEventListener('click', () => openAuth('login'));
closeModal?.addEventListener('click', closeAuth);
logoutBtn?.addEventListener('click', closeWorkspace);

authModal?.addEventListener('click', (event) => { if (event.target === authModal) closeAuth(); });
authModeButtons.forEach((button) => button.addEventListener('click', () => setAuthMode(button.dataset.authMode)));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && authModal?.classList.contains('is-open')) closeAuth(); });

loginForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = new FormData(loginForm);
  const email = String(form.get('login') || '').trim().toLowerCase();
  const secret = String(form.get('password') || '').trim();
  const user = getUsers().find((item) => item.email === email && item.secret === secret && item.status === 'active');
  if (!user) {
    showLoginMessage('Користувача не знайдено або доступ заблоковано. Створіть доступ в адмінці.');
    return;
  }
  openWorkspace(user);
});

registerForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  alert('Заявки поки вимкнені. Доступ створюється на адмін-сайті.');
});

document.querySelectorAll('.nav__item').forEach((button) => {
  button.addEventListener('click', () => {
    const id = button.dataset.section;
    document.querySelectorAll('.nav__item').forEach((item) => item.classList.toggle('is-active', item === button));
    document.querySelectorAll('.section').forEach((section) => {
      section.classList.toggle('is-active', section.id === id);
      if (section.id === id && sectionTitle) sectionTitle.textContent = section.dataset.title || button.textContent;
    });
  });
});

function getFileRegistry() {
  try { return JSON.parse(localStorage.getItem('vector-reference-files') || '[]'); } catch { return []; }
}
function setFileRegistry(files) { localStorage.setItem('vector-reference-files', JSON.stringify(files)); renderFileRegistry(); }
function renderUploadCards() {
  if (!uploadGrid) return;
  uploadGrid.innerHTML = referenceTypes.map((item) => `<label class="upload-card"><h4>${item.title}</h4><p>${item.description}</p><input type="file" data-ref-type="${item.key}" multiple /></label>`).join('');
  uploadGrid.querySelectorAll('input[type="file"]').forEach((input) => {
    input.addEventListener('change', (event) => {
      const type = event.target.dataset.refType;
      const typeTitle = referenceTypes.find((item) => item.key === type)?.title || type;
      const current = getFileRegistry();
      const added = Array.from(event.target.files).map((file) => ({ type: typeTitle, name: file.name, size: file.size, date: new Date().toLocaleString('uk-UA') }));
      setFileRegistry([...current, ...added]);
      event.target.value = '';
    });
  });
}
function formatSize(size) {
  if (!Number.isFinite(size)) return '—';
  if (size < 1024) return `${size} Б`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} КБ`;
  return `${(size / 1024 / 1024).toFixed(1)} МБ`;
}
function renderFileRegistry() {
  const files = getFileRegistry();
  if (filesCount) filesCount.textContent = String(files.length);
  if (!fileList) return;
  if (!files.length) { fileList.textContent = 'Файли ще не додані.'; return; }
  fileList.innerHTML = files.map((file) => `<div class="file-entry"><strong>${file.name}</strong><span>${file.type}</span><span>${formatSize(file.size)}</span></div>`).join('');
}
clearFiles?.addEventListener('click', () => setFileRegistry([]));
renderUploadCards();
renderFileRegistry();

try {
  const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  if (session?.email) openWorkspace(session);
} catch {}
