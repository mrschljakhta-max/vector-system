const root = document.documentElement;
const openLogin = document.querySelector('#openLogin');
const openRegister = document.querySelector('#openRegister');
const loginModal = document.querySelector('#loginModal');
const registerModal = document.querySelector('#registerModal');
const themeToggle = document.querySelector('#themeToggle');
const themeLabel = document.querySelector('#themeLabel');

function applyTheme(theme) {
  root.dataset.theme = theme;
  localStorage.setItem('vector-theme', theme);
  if (themeLabel) themeLabel.textContent = theme === 'dark' ? 'Темна' : 'Світла';
}

const savedTheme = localStorage.getItem('vector-theme');
const preferredTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
applyTheme(savedTheme || preferredTheme);

openLogin?.addEventListener('click', () => loginModal?.showModal());
openRegister?.addEventListener('click', () => registerModal?.showModal());
themeToggle?.addEventListener('click', () => {
  applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
});
