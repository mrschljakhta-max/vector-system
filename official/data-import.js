(() => {
  const TYPES = [
    ['', 'Не визначено'],
    ['name', 'Назва'],
    ['lat', 'Координата: широта'],
    ['lon', 'Координата: довгота'],
    ['mgrs', 'Координати MGRS'],
    ['number', 'Число'],
    ['date', 'Дата'],
    ['time', 'Час'],
    ['unit', 'Підрозділ'],
    ['object', 'Об’єкт'],
    ['route', 'Маршрут'],
    ['frequency', 'Частота'],
    ['status', 'Статус'],
    ['note', 'Примітка'],
    ['ignore', 'Не імпортувати']
  ];

  const storageKey = 'vector-imported-tables';
  let current = null;

  function mount() {
    const library = document.querySelector('#refs .library-head');
    if (!library || document.querySelector('#pqImporter')) return;

    const panel = document.createElement('section');
    panel.className = 'pq-importer';
    panel.id = 'pqImporter';
    panel.innerHTML = `
      <div class="pq-importer__head">
        <div>
          <h2>Імпорт таблиць</h2>
          <p>CSV, XLS, XLSX, XLSM. Завантаж файл, переглянь колонки і познач, що означає кожна колонка.</p>
        </div>
        <label class="pq-importer__file">
          Завантажити таблицю
          <input id="pqFile" type="file" accept=".csv,.xls,.xlsx,.xlsm,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">
        </label>
      </div>
      <div class="pq-status" id="pqStatus">Файл ще не завантажено.</div>
      <div class="pq-summary" id="pqSummary" hidden></div>
      <div class="pq-table-wrap" id="pqTableWrap"><div class="pq-empty">Після завантаження тут з’явиться попередній перегляд таблиці.</div></div>
      <div class="pq-actions" id="pqActions" hidden>
        <button class="pq-btn" id="pqClear" type="button">Скинути</button>
        <button class="pq-btn pq-btn--primary" id="pqSave" type="button">Зберегти схему</button>
      </div>
    `;
    library.insertAdjacentElement('afterend', panel);

    document.querySelector('#pqFile')?.addEventListener('change', onFile);
    document.querySelector('#pqClear')?.addEventListener('click', reset);
    document.querySelector('#pqSave')?.addEventListener('click', saveSchema);
  }

  async function onFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setStatus(`Завантажую: ${file.name}...`);
    try {
      const rows = await readTable(file);
      if (!rows.length) throw new Error('Таблиця порожня');
      const headers = normalizeHeaders(rows[0]);
      const body = rows.slice(1, 51).map((row) => headers.map((_, index) => row[index] ?? ''));
      current = { fileName: file.name, totalRows: Math.max(rows.length - 1, 0), headers, body, mapping: autoMap(headers) };
      renderPreview();
    } catch (error) {
      setStatus(`Помилка імпорту: ${error.message}`);
    }
  }

  function readTable(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'csv') return readCsv(file);
    return readExcel(file);
  }

  function readCsv(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Не вдалося прочитати CSV'));
      reader.onload = () => resolve(parseCsv(String(reader.result || '')));
      reader.readAsText(file, 'utf-8');
    });
  }

  function readExcel(file) {
    return new Promise((resolve, reject) => {
      if (!window.XLSX) {
        reject(new Error('Бібліотека XLSX не завантажилась'));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Не вдалося прочитати Excel'));
      reader.onload = () => {
        const data = new Uint8Array(reader.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        resolve(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }));
      };
      reader.readAsArrayBuffer(file);
    });
  }

  function parseCsv(text) {
    const delimiter = text.includes(';') && !text.includes(',') ? ';' : ',';
    const rows = [];
    let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const next = text[i + 1];
      if (char === '"' && quoted && next === '"') { cell += '"'; i++; continue; }
      if (char === '"') { quoted = !quoted; continue; }
      if (char === delimiter && !quoted) { row.push(cell); cell = ''; continue; }
      if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && next === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = ''; continue;
      }
      cell += char;
    }
    row.push(cell); rows.push(row);
    return rows.filter((r) => r.some((v) => String(v).trim() !== ''));
  }

  function normalizeHeaders(row) {
    return row.map((value, index) => String(value || `Колонка ${index + 1}`).trim() || `Колонка ${index + 1}`);
  }

  function autoMap(headers) {
    const map = {};
    headers.forEach((header) => {
      const h = header.toLowerCase();
      if (/(lat|latitude|шир)/.test(h)) map[header] = 'lat';
      else if (/(lon|lng|longitude|довг)/.test(h)) map[header] = 'lon';
      else if (/(mgrs|utm|коорд)/.test(h)) map[header] = 'mgrs';
      else if (/(name|назв|об'єкт|обект)/.test(h)) map[header] = 'name';
      else if (/(unit|підроз|бригада|дивіз)/.test(h)) map[header] = 'unit';
      else if (/(freq|част)/.test(h)) map[header] = 'frequency';
      else if (/(date|дата)/.test(h)) map[header] = 'date';
      else if (/(status|стан)/.test(h)) map[header] = 'status';
      else map[header] = '';
    });
    return map;
  }

  function renderPreview() {
    if (!current) return;
    setStatus(`Файл: ${current.fileName}. Рядків даних: ${current.totalRows}. Показано до 50 рядків.`);
    const summary = document.querySelector('#pqSummary');
    if (summary) {
      summary.hidden = false;
      summary.innerHTML = `<div class="pq-chip"><strong>${current.headers.length}</strong>колонок</div><div class="pq-chip"><strong>${current.totalRows}</strong>рядків</div><div class="pq-chip"><strong>${hasCoords() ? 'так' : 'ні'}</strong>координати</div><div class="pq-chip"><strong>${mappedCount()}</strong>позначено</div>`;
    }
    const table = document.createElement('table');
    table.className = 'pq-table';
    table.innerHTML = `<thead><tr>${current.headers.map((h) => `<th><div>${escapeHtml(h)}</div>${selectHtml(h)}</th>`).join('')}</tr></thead><tbody>${current.body.map((row) => `<tr>${row.map((v) => `<td>${escapeHtml(v)}</td>`).join('')}</tr>`).join('')}</tbody>`;
    const wrap = document.querySelector('#pqTableWrap');
    if (wrap) { wrap.innerHTML = ''; wrap.appendChild(table); }
    document.querySelectorAll('.pq-select').forEach((select) => select.addEventListener('change', (event) => {
      current.mapping[event.target.dataset.header] = event.target.value;
      renderSummaryOnly();
    }));
    const actions = document.querySelector('#pqActions');
    if (actions) actions.hidden = false;
  }

  function selectHtml(header) {
    return `<select class="pq-select" data-header="${escapeHtml(header)}">${TYPES.map(([value, label]) => `<option value="${value}" ${current.mapping[header] === value ? 'selected' : ''}>${label}</option>`).join('')}</select>`;
  }

  function renderSummaryOnly() {
    const summary = document.querySelector('#pqSummary');
    if (summary && current) summary.innerHTML = `<div class="pq-chip"><strong>${current.headers.length}</strong>колонок</div><div class="pq-chip"><strong>${current.totalRows}</strong>рядків</div><div class="pq-chip"><strong>${hasCoords() ? 'так' : 'ні'}</strong>координати</div><div class="pq-chip"><strong>${mappedCount()}</strong>позначено</div>`;
  }

  function hasCoords() {
    const values = Object.values(current?.mapping || {});
    return values.includes('mgrs') || (values.includes('lat') && values.includes('lon'));
  }

  function mappedCount() {
    return Object.values(current?.mapping || {}).filter(Boolean).length;
  }

  function saveSchema() {
    if (!current) return;
    const saved = getSaved();
    saved.push({ fileName: current.fileName, createdAt: new Date().toISOString(), totalRows: current.totalRows, headers: current.headers, mapping: current.mapping });
    localStorage.setItem(storageKey, JSON.stringify(saved));
    setStatus(`Схему імпорту збережено: ${current.fileName}`);
  }

  function getSaved() {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { return []; }
  }

  function reset() {
    current = null;
    setStatus('Файл ще не завантажено.');
    const wrap = document.querySelector('#pqTableWrap');
    if (wrap) wrap.innerHTML = '<div class="pq-empty">Після завантаження тут з’явиться попередній перегляд таблиці.</div>';
    const summary = document.querySelector('#pqSummary');
    if (summary) summary.hidden = true;
    const actions = document.querySelector('#pqActions');
    if (actions) actions.hidden = true;
  }

  function setStatus(text) {
    const status = document.querySelector('#pqStatus');
    if (status) status.textContent = text;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  window.addEventListener('load', mount);
  document.addEventListener('click', () => setTimeout(mount, 80));
})();
