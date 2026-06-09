const root = document.documentElement;
const themeToggle = document.querySelector('#themeToggle');
const themeLabel = document.querySelector('#themeLabel');
const loginForm = document.querySelector('#loginForm');

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

loginForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  alert('Адмін-вхід підключимо до Supabase Auth на наступному етапі.');
});


const loginAction = document.querySelector('#loginAction');
const requestAction = document.querySelector('#requestAction');

loginAction?.addEventListener('click', (event) => {
  if (loginAction.getAttribute('href')?.startsWith('#')) {
    event.preventDefault();
    alert('Форму входу підключимо наступним етапом.');
  }
});

requestAction?.addEventListener('click', (event) => {
  event.preventDefault();
  alert('Заявку на доступ підключимо наступним етапом.');
});
