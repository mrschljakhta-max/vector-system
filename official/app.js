const root = document.documentElement;
const themeToggle = document.querySelector('#themeToggle');
const themeLabel = document.querySelector('#themeLabel');
const authTabs = document.querySelectorAll('[data-auth-mode]');
const loginForm = document.querySelector('#loginForm');
const registerForm = document.querySelector('#registerForm');

function applyTheme(theme) {
  root.dataset.theme = theme;
  localStorage.setItem('vector-theme', theme);
  if (themeLabel) themeLabel.textContent = theme === 'dark' ? 'Темна' : 'Світла';
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

authTabs.forEach((tab) => {
  tab.addEventListener('click', () => setAuthMode(tab.dataset.authMode));
});

loginForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  alert('Вхід підключимо до Supabase Auth на наступному етапі.');
});

registerForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  alert('Заявку на реєстрацію підключимо до Supabase на наступному етапі.');
});
