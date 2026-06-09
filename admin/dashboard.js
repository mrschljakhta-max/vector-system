const root = document.documentElement;
const themeToggle = document.querySelector('#themeToggle');
const themeLabel = document.querySelector('#themeLabel');
const logoutBtn = document.querySelector('#logoutBtn');
const navItems = document.querySelectorAll('.admin-nav__item');

if (sessionStorage.getItem('vector-admin-auth') !== 'default-admin') {
  window.location.replace('./index.html');
}

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

navItems.forEach((item) => {
  item.addEventListener('click', (event) => {
    event.preventDefault();
    navItems.forEach((navItem) => navItem.classList.remove('is-active'));
    item.classList.add('is-active');
  });
});

logoutBtn?.addEventListener('click', () => {
  sessionStorage.removeItem('vector-admin-auth');
  sessionStorage.removeItem('vector-admin-login');
  window.location.replace('./index.html');
});
