const root = document.documentElement;
const themeToggle = document.querySelector('#themeToggle');
const themeLabel = document.querySelector('#themeLabel');
const logoutBtn = document.querySelector('#logoutBtn');
const copyOfficialLink = document.querySelector('#copyOfficialLink');
const copyToast = document.querySelector('#copyToast');
const grantAccessForm = document.querySelector('#grantAccessForm');

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

logoutBtn?.addEventListener('click', () => {
  sessionStorage.removeItem('vector-admin-auth');
  sessionStorage.removeItem('vector-admin-login');
  window.location.replace('./index.html');
});

function showToast(message) {
  if (!copyToast) return;
  copyToast.textContent = message;
  copyToast.classList.add('is-visible');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => copyToast.classList.remove('is-visible'), 1800);
}

copyOfficialLink?.addEventListener('click', async () => {
  const officialUrl = new URL('../official/', window.location.href).href;
  try {
    await navigator.clipboard.writeText(officialUrl);
    showToast('Посилання скопійовано');
  } catch (error) {
    showToast('Не вдалося скопіювати');
  }
});

grantAccessForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  showToast('Запрошення буде підключено до Supabase');
});

grantAccessForm?.querySelector('textarea')?.addEventListener('input', (event) => {
  const counter = grantAccessForm.querySelector('.field-counter');
  if (counter) counter.textContent = `${event.target.value.length} / 255`;
});

const roleSelect = document.querySelector('[data-role-select]');

if (roleSelect) {
  const roleButton = roleSelect.querySelector('[data-role-button]');
  const roleLabel = roleSelect.querySelector('[data-role-label]');
  const roleValue = roleSelect.querySelector('[data-role-value]');
  const roleOptions = roleSelect.querySelectorAll('.role-select__option');

  const closeRoleSelect = () => {
    roleSelect.classList.remove('is-open');
    roleButton?.setAttribute('aria-expanded', 'false');
  };

  roleButton?.addEventListener('click', (event) => {
    event.preventDefault();
    const isOpen = roleSelect.classList.toggle('is-open');
    roleButton.setAttribute('aria-expanded', String(isOpen));
  });

  roleOptions.forEach((option) => {
    option.addEventListener('click', () => {
      const title = option.querySelector('.role-select__option-title')?.textContent.trim() || '';
      const desc = option.querySelector('.role-select__option-desc')?.textContent.trim() || '';
      roleOptions.forEach((item) => item.classList.remove('is-selected'));
      option.classList.add('is-selected');
      if (roleLabel) roleLabel.textContent = `${title} — ${desc}`;
      if (roleValue) roleValue.value = option.dataset.value || '';
      closeRoleSelect();
    });
  });

  document.addEventListener('click', (event) => {
    if (!roleSelect.contains(event.target)) closeRoleSelect();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeRoleSelect();
  });
}
