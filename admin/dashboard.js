const root = document.documentElement;
const themeToggle = document.querySelector('#themeToggle');
const logoutBtn = document.querySelector('#logoutBtn');

function applyTheme(theme) {
  root.dataset.theme = theme;
  localStorage.setItem('vector-theme', theme);
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute('content', theme === 'dark' ? '#111418' : '#f4f2ee');
}

const savedTheme = localStorage.getItem('vector-theme');
const preferredTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
applyTheme(savedTheme || preferredTheme);

if (sessionStorage.getItem('vector-admin-auth') !== 'default-admin') {
  window.location.replace('./index.html');
}

themeToggle?.addEventListener('click', () => {
  applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
});

logoutBtn?.addEventListener('click', () => {
  sessionStorage.removeItem('vector-admin-auth');
  sessionStorage.removeItem('vector-admin-login');
  window.location.replace('./index.html');
});
