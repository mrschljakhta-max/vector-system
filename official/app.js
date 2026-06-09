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

openLogin?.addEventListener('click', () => openAuth('login'));
closeModal?.addEventListener('click', closeAuth);

authModal?.addEventListener('click', (event) => {
  if (event.target === authModal) closeAuth();
});

authModeButtons.forEach((button) => {
  button.addEventListener('click', () => setAuthMode(button.dataset.authMode));
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && authModal?.classList.contains('is-open')) closeAuth();
});

loginForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  alert('Вхід підключимо до Supabase Auth на наступному етапі.');
});

registerForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  alert('Заявку на реєстрацію підключимо до Supabase на наступному етапі.');
});
