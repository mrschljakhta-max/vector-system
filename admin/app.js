const root = document.documentElement;
const themeToggle = document.querySelector('#themeToggle');
const themeLabel = document.querySelector('#themeLabel');

const openAuthModal = document.querySelector('#openAuthModal');
const closeAuthModal = document.querySelector('#closeAuthModal');
const authModal = document.querySelector('#authModal');
const loginForm = document.querySelector('#loginForm');

function applyTheme(theme) {
  root.dataset.theme = theme;
  localStorage.setItem('vector-theme', theme);
  if (themeLabel) themeLabel.textContent = theme === 'dark' ? 'Темна' : 'Світла';

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.setAttribute('content', theme === 'dark' ? '#111418' : '#f3f3ef');
}

const savedTheme = localStorage.getItem('vector-theme');
const preferredTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
applyTheme(savedTheme || preferredTheme);

themeToggle?.addEventListener('click', () => {
  applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
});

function openModal() {
  authModal?.classList.add('is-open');
  authModal?.setAttribute('aria-hidden', 'false');

  const firstInput = authModal?.querySelector('input');
  setTimeout(() => firstInput?.focus(), 120);
}

function closeModal() {
  authModal?.classList.remove('is-open');
  authModal?.setAttribute('aria-hidden', 'true');
  openAuthModal?.focus();
}

openAuthModal?.addEventListener('click', openModal);
closeAuthModal?.addEventListener('click', closeModal);

authModal?.addEventListener('click', (event) => {
  if (event.target === authModal) closeModal();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && authModal?.classList.contains('is-open')) {
    closeModal();
  }
});

loginForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  alert('Адмін-вхід підключимо до Supabase Auth на наступному етапі.');
});
