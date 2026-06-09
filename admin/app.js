const root = document.documentElement;
const themeToggle = document.querySelector('#themeToggle');
const themeLabel = document.querySelector('#themeLabel');
const authModal = document.querySelector('#authModal');
const openLogin = document.querySelector('#openLogin');
const closeModal = document.querySelector('#closeModal');
const loginForm = document.querySelector('#loginForm');

const DEFAULT_ADMIN = {
  login: 'admin',
  password: 'Vector@2026!'
};

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

themeToggle?.addEventListener('click', () => {
  applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
});

function openAuth() {
  authModal?.classList.add('is-open');
  authModal?.setAttribute('aria-hidden', 'false');
  setTimeout(() => authModal?.querySelector('input')?.focus(), 80);
}

function closeAuth() {
  authModal?.classList.remove('is-open');
  authModal?.setAttribute('aria-hidden', 'true');
  openLogin?.focus();
}

function showAuthMessage(message, type = 'error') {
  if (!loginForm) return;

  let messageBox = loginForm.querySelector('.auth-message');

  if (!messageBox) {
    messageBox = document.createElement('p');
    messageBox.className = 'auth-message';
    loginForm.appendChild(messageBox);
  }

  messageBox.textContent = message;
  messageBox.dataset.type = type;
}

function normalizeLogin(value) {
  return String(value || '').trim();
}

openLogin?.addEventListener('click', openAuth);
closeModal?.addEventListener('click', closeAuth);

authModal?.addEventListener('click', (event) => {
  if (event.target === authModal) closeAuth();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && authModal?.classList.contains('is-open')) closeAuth();
});

loginForm?.addEventListener('submit', (event) => {
  event.preventDefault();

  const formData = new FormData(loginForm);
  const login = normalizeLogin(formData.get('login'));
  const password = String(formData.get('password') || '');

  if (login !== DEFAULT_ADMIN.login || password !== DEFAULT_ADMIN.password) {
    showAuthMessage('Невірний логін або пароль.', 'error');
    return;
  }

  sessionStorage.setItem('vector-admin-auth', 'default-admin');
  sessionStorage.setItem('vector-admin-login', DEFAULT_ADMIN.login);
  showAuthMessage('Доступ підтверджено. Відкриваю адмін-панель...', 'success');

  setTimeout(() => {
    window.location.href = './dashboard.html';
  }, 350);
});
