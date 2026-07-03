const root = document.documentElement;
const themeToggle = document.querySelector('#themeToggle');
const themeLabel = document.querySelector('#themeLabel');
const logoutBtn = document.querySelector('#logoutBtn');
const localUserForm = document.querySelector('#localUserForm');
const localUsersBody = document.querySelector('#localUsersBody');
const usersEmpty = document.querySelector('#usersEmpty');
const usersSearch = document.querySelector('#usersSearch');
const clearUsers = document.querySelector('#clearUsers');

const USERS_KEY = 'vector-local-users';

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

function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  } catch {
    return [];
  }
}

function setUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  renderUsers();
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toast(message) {
  let box = document.querySelector('.copy-toast');
  if (!box) {
    box = document.createElement('p');
    box.className = 'copy-toast';
    document.body.appendChild(box);
  }
  box.textContent = message;
  box.classList.add('is-visible');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => box.classList.remove('is-visible'), 1700);
}

localUserForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = new FormData(localUserForm);
  const email = String(form.get('email') || '').trim().toLowerCase();
  const secret = String(form.get('password') || '').trim();
  const marker = String(form.get('marker') || '').trim();
  const role = String(form.get('role') || 'user');

  if (!email || !secret) {
    toast('Заповніть email і пароль');
    return;
  }

  const users = getUsers();
  const existingIndex = users.findIndex((user) => user.email === email);
  const record = {
    id: existingIndex >= 0 ? users[existingIndex].id : makeId(),
    email,
    secret,
    marker,
    role,
    status: 'active',
    createdAt: existingIndex >= 0 ? users[existingIndex].createdAt : new Date().toISOString(),
  };

  if (existingIndex >= 0) users[existingIndex] = record;
  else users.push(record);

  setUsers(users);
  localUserForm.reset();
  toast(existingIndex >= 0 ? 'Користувача оновлено' : 'Користувача створено');
});

function renderUsers() {
  if (!localUsersBody) return;
  const query = String(usersSearch?.value || '').trim().toLowerCase();
  const users = getUsers().filter((user) => {
    const haystack = `${user.email} ${user.marker} ${user.role} ${user.status}`.toLowerCase();
    return !query || haystack.includes(query);
  });

  localUsersBody.innerHTML = users.map((user) => `
    <tr data-id="${user.id}">
      <td><strong>${user.email}</strong></td>
      <td><code>${user.secret}</code></td>
      <td>${user.marker || '—'}</td>
      <td><span class="role-badge">${roleLabel(user.role)}</span></td>
      <td><span class="status-pill ${user.status === 'active' ? 'ok' : 'bad'}">${user.status === 'active' ? 'Активний' : 'Заблокований'}</span></td>
      <td class="row-actions">
        <button type="button" data-action="toggle">${user.status === 'active' ? 'Блок' : 'Актив'}</button>
        <button class="danger" type="button" data-action="delete">Видалити</button>
      </td>
    </tr>
  `).join('');

  if (usersEmpty) usersEmpty.hidden = users.length !== 0;
}

function roleLabel(role) {
  if (role === 'admin') return 'Адміністратор';
  if (role === 'operator') return 'Оператор';
  return 'Користувач';
}

usersSearch?.addEventListener('input', renderUsers);

localUsersBody?.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const row = button.closest('tr');
  const id = row?.dataset.id;
  const users = getUsers();
  const user = users.find((item) => item.id === id);
  if (!user) return;

  if (button.dataset.action === 'toggle') {
    user.status = user.status === 'active' ? 'blocked' : 'active';
    setUsers(users);
    toast('Статус змінено');
  }

  if (button.dataset.action === 'delete') {
    setUsers(users.filter((item) => item.id !== id));
    toast('Користувача видалено');
  }
});

clearUsers?.addEventListener('click', () => {
  setUsers([]);
  toast('Список очищено');
});

renderUsers();
