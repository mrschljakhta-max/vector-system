(() => {
  const TYPES = [
    ['', 'Не визначено'], ['name', 'Назва'], ['lat', 'Координата: широта'], ['lon', 'Координата: довгота'],
    ['mgrs', 'Координати MGRS'], ['number', 'Число'], ['date', 'Дата'], ['time', 'Час'], ['unit', 'Підрозділ'],
    ['object', 'Об’єкт'], ['route', 'Маршрут'], ['frequency', 'Частота'], ['status', 'Статус'], ['note', 'Примітка'], ['ignore', 'Не імпортувати']
  ];
  const CATEGORIES = ['ОВТ', 'Бойова робота', 'Частоти', 'ІКС', 'Навчання', 'Карта', 'Документи', 'Алгоритми', 'Ворог', 'Аналітика', 'Довідники', 'Архів'];
  const storageKey = 'vector-imported-tables';
  const fileRegistryKey = 'vector-reference-files';
  let current = null;

  function mount() {
    const library = document.querySelector('#refs .library-head');
    if (!library) return false;
    let panel = document.querySelector('#pqImporter');
    if (!panel) {
      panel = document.createElement('section');
      panel.className = 'pq-importer';
      panel.id = 'pqImporter';
      panel.innerHTML = `
        <div class="pq-importer__head">
          <div><h2>Імпорт таблиць</h2><p>CSV, XLS, XLSX, XLSM. Завантаж файл, переглянь колонки і познач, що означає кожна колонка.</p></div>
          <label class="pq-importer__file">Завантажити таблицю<input id="pqFile" type="file" accept=".csv,.xls,.xlsx,.xlsm,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label>
        </div>
        <div class="pq-status" id="pqStatus">Файл ще не завантажено.</div>
        <div class="pq-summary" id="pqSummary" hidden></div>
        <div class="pq-table-wrap" id="pqTableWrap"><div class="pq-empty">Після завантаження тут з’явиться попередній перегляд таблиці.</div></div>
        <div class="pq-save-row" id="pqSaveRow" hidden>
          <label>Категорія збереження<select class="pq-category" id="pqCategory">${CATEGORIES.map((cat) => `<option value="${cat}">${cat}</option>`).join('')}</select></label>
          <div class="pq-actions"><button class="pq-btn" id="pqClear" type="button">Скинути</button><button class="pq-btn pq-btn--primary" id="pqSave" type="button">Зберегти таблицю</button></div>
        </div>
        <div class="pq-saved-list" id="pqSavedList"></div>`;
      library.insertAdjacentElement('afterend', panel);
    }
    bind();
    renderSavedList();
    return true;
  }

  function bind() {
    const fileInput = document.querySelector('#pqFile');
    if (fileInput && !fileInput.dataset.bound) { fileInput.dataset.bound = '1'; fileInput.addEventListener('change', onFile); }
    const clear = document.querySelector('#pqClear');
    if (clear && !clear.dataset.bound) { clear.dataset.bound = '1'; clear.addEventListener('click', reset); }
    const save = document.querySelector('#pqSave');
    if (save && !save.dataset.bound) { save.dataset.bound = '1'; save.addEventListener('click', saveTable); }
  }

  async function onFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setStatus(`Завантажую: ${file.name}...`);
    try {
      const rows = await readTable(file);
      if (!rows.length) throw new Error('Таблиця порожня');
      const headers = normalizeHeaders(rows[0]);
      const body = rows.slice(1).map((row) => headers.map((_, index) => row[index] ?? ''));
      current = { id: makeId(), fileName: file.name, totalRows: Math.max(rows.length - 1, 0), headers, body, preview: body.slice(0, 50), mapping: autoMap(headers), createdAt: new Date().toISOString() };
      renderPreview();
      setDefaultCategory(file.name);
    } catch (error) { setStatus(`Помилка імпорту: ${error.message}`); }
  }

  function readTable(file) { return file.name.split('.').pop().toLowerCase() === 'csv' ? readCsv(file) : readExcel(file); }
  function readCsv(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error('Не вдалося прочитати CSV')); reader.onload = () => resolve(parseCsv(String(reader.result || ''))); reader.readAsText(file, 'utf-8'); }); }
  function readExcel(file) { return new Promise((resolve, reject) => { if (!window.XLSX) { reject(new Error('Бібліотека XLSX не завантажилась. Онови сторінку через Ctrl+F5.')); return; } const reader = new FileReader(); reader.onerror = () => reject(new Error('Не вдалося прочитати Excel')); reader.onload = () => { const data = new Uint8Array(reader.result); const workbook = XLSX.read(data, { type: 'array' }); const sheet = workbook.Sheets[workbook.SheetNames[0]]; resolve(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })); }; reader.readAsArrayBuffer(file); }); }

  function parseCsv(text) {
    const delimiter = text.includes(';') && text.split(';').length >= text.split(',').length ? ';' : ',';
    const rows = []; let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) { const char = text[i], next = text[i + 1]; if (char === '"' && quoted && next === '"') { cell += '"'; i++; continue; } if (char === '"') { quoted = !quoted; continue; } if (char === delimiter && !quoted) { row.push(cell); cell = ''; continue; } if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && next === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; continue; } cell += char; }
    row.push(cell); rows.push(row); return rows.filter((r) => r.some((v) => String(v).trim() !== ''));
  }

  function normalizeHeaders(row) { return row.map((value, index) => String(value || `Колонка ${index + 1}`).trim() || `Колонка ${index + 1}`); }
  function autoMap(headers) { const map = {}; headers.forEach((header) => { const h = header.toLowerCase(); if (/(lat|latitude|шир)/.test(h)) map[header] = 'lat'; else if (/(lon|lng|longitude|довг)/.test(h)) map[header] = 'lon'; else if (/(mgrs|utm|коорд)/.test(h)) map[header] = 'mgrs'; else if (/(name|назв|об'єкт|обект)/.test(h)) map[header] = 'name'; else if (/(unit|підроз|бригада|дивіз|служб)/.test(h)) map[header] = 'unit'; else if (/(freq|част)/.test(h)) map[header] = 'frequency'; else if (/(date|дата|наказ про початок)/.test(h)) map[header] = 'date'; else if (/(status|стан)/.test(h)) map[header] = 'status'; else if (/(num|кільк|числ|number|№|номер)/.test(h)) map[header] = 'number'; else map[header] = ''; }); return map; }

  function renderPreview() {
    if (!current) return;
    setStatus(`Файл: ${current.fileName}. Рядків даних: ${current.totalRows}. Показано до 50 рядків.`);
    renderSummaryOnly();
    const table = document.createElement('table'); table.className = 'pq-table';
    table.innerHTML = `<thead><tr>${current.headers.map((h) => `<th><div>${escapeHtml(h)}</div>${selectHtml(h)}</th>`).join('')}</tr></thead><tbody>${current.preview.map((row) => `<tr>${row.map((v) => `<td>${escapeHtml(v)}</td>`).join('')}</tr>`).join('')}</tbody>`;
    const wrap = document.querySelector('#pqTableWrap'); if (wrap) { wrap.innerHTML = ''; wrap.appendChild(table); }
    document.querySelectorAll('.pq-select').forEach((select) => select.addEventListener('change', (event) => { current.mapping[event.target.dataset.header] = event.target.value; renderSummaryOnly(); }));
    const saveRow = document.querySelector('#pqSaveRow'); if (saveRow) saveRow.hidden = false;
    setTimeout(() => document.querySelector('#pqSaveRow')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 120);
  }

  function selectHtml(header) { return `<select class="pq-select" data-header="${escapeHtml(header)}">${TYPES.map(([value, label]) => `<option value="${value}" ${current.mapping[header] === value ? 'selected' : ''}>${label}</option>`).join('')}</select>`; }
  function renderSummaryOnly() { const summary = document.querySelector('#pqSummary'); if (!summary || !current) return; summary.hidden = false; summary.innerHTML = `<div class="pq-chip"><strong>${current.headers.length}</strong>колонок</div><div class="pq-chip"><strong>${current.totalRows}</strong>рядків</div><div class="pq-chip"><strong>${hasCoords() ? 'так' : 'ні'}</strong>координати</div><div class="pq-chip"><strong>${mappedCount()}</strong>позначено</div>`; }
  function hasCoords() { const values = Object.values(current?.mapping || {}); return values.includes('mgrs') || (values.includes('lat') && values.includes('lon')); }
  function mappedCount() { return Object.values(current?.mapping || {}).filter(Boolean).length; }

  function saveTable() {
    if (!current) return;
    const category = document.querySelector('#pqCategory')?.value || 'Архів';
    const saved = getSaved().filter((item) => item.id !== current.id);
    const record = { ...current, category, savedAt: new Date().toISOString() };
    saved.unshift(record);
    localStorage.setItem(storageKey, JSON.stringify(saved));
    addToFileRegistry(record);
    setStatus(`Таблицю збережено в категорію: ${category}. Файл: ${current.fileName}`);
    renderSavedList();
    renderFileListIfExists();
  }

  function addToFileRegistry(record) {
    const files = getJson(fileRegistryKey, []);
    files.unshift({ type: record.category, name: record.fileName, size: 0, date: new Date().toLocaleString('uk-UA'), importedTableId: record.id });
    localStorage.setItem(fileRegistryKey, JSON.stringify(files));
  }

  function renderSavedList() {
    const box = document.querySelector('#pqSavedList'); if (!box) return;
    const saved = getSaved();
    if (!saved.length) { box.innerHTML = '<h3>Збережені імпорти</h3><p>Поки немає збережених таблиць.</p>'; return; }
    box.innerHTML = `<h3>Збережені імпорти</h3>${saved.slice(0, 8).map((item) => `<div><strong>${escapeHtml(item.fileName)}</strong><span>${escapeHtml(item.category || '—')}</span><span>${item.totalRows || 0} рядків</span></div>`).join('')}`;
  }

  function renderFileListIfExists() {
    const fileList = document.querySelector('#fileList'); if (!fileList) return;
    const files = getJson(fileRegistryKey, []);
    if (!files.length) { fileList.textContent = 'Файли ще не додані.'; return; }
    fileList.innerHTML = files.map((file) => `<div class="file-entry"><strong>${escapeHtml(file.name)}</strong><span>${escapeHtml(file.type || '—')}</span><span>${file.importedTableId ? 'імпортована таблиця' : ''}</span></div>`).join('');
  }

  function reset() { current = null; setStatus('Файл ще не завантажено.'); const wrap = document.querySelector('#pqTableWrap'); if (wrap) wrap.innerHTML = '<div class="pq-empty">Після завантаження тут з’явиться попередній перегляд таблиці.</div>'; const summary = document.querySelector('#pqSummary'); if (summary) summary.hidden = true; const saveRow = document.querySelector('#pqSaveRow'); if (saveRow) saveRow.hidden = true; }
  function getSaved() { return getJson(storageKey, []); }
  function getJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } }
  function setStatus(text) { const status = document.querySelector('#pqStatus'); if (status) status.textContent = text; }
  function setDefaultCategory(fileName) { const select = document.querySelector('#pqCategory'); if (!select) return; const f = fileName.toLowerCase(); if (/(списання|наяв|стан|овт|озбро)/.test(f)) select.value = 'ОВТ'; else if (/(част|freq)/.test(f)) select.value = 'Частоти'; else if (/(карта|маршрут|коорд)/.test(f)) select.value = 'Карта'; else if (/(бой|заяв|прикрит)/.test(f)) select.value = 'Бойова робота'; }
  function makeId() { return `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  window.addEventListener('load', () => { mount(); setTimeout(mount, 300); setTimeout(mount, 1000); });
  document.addEventListener('click', () => setTimeout(mount, 80));
})();