(() => {
  const CONFIGS = {
    stations: {
      title: 'Станції', table: 'dict_stations', order: 'station_name', pk: 'id', limit: 300,
      columns: ['station_name','station_code','status_text','mgrs','lat','lon','coverage_radius_km','is_active','note'],
      editable: ['station_name','station_code','status_text','mgrs','lat','lon','coverage_radius_km','is_active','note'],
      labels: {station_name:'Назва',station_code:'Код',status_text:'Статус',mgrs:'MGRS',lat:'Широта',lon:'Довгота',coverage_radius_km:'Радіус, км',is_active:'Активна',note:'Примітка'}
    },
    settlements: {
      title: 'Населені пункти', table: 'dict_settlements', order: 'name', pk: 'id', limit: 500,
      columns: ['name','settlement_code','region','district','hromada_name','mgrs','lat','lon'],
      editable: ['name','settlement_code','region','district','hromada_name','mgrs','lat','lon'],
      labels: {name:'НП',settlement_code:'Код',region:'Область',district:'Район',hromada_name:'Громада',mgrs:'MGRS',lat:'Широта',lon:'Довгота'}
    },
    cover: {
      title: 'ВП / СП', table: 'dict_cover_objects', order: 'object_name', pk: 'id', limit: 500,
      columns: ['object_name','object_code','object_type','type_code','priority','mgrs','lat','lon','is_active','note'],
      editable: ['object_name','object_code','object_type','type_code','priority','mgrs','lat','lon','is_active','note'],
      labels: {object_name:'Назва',object_code:'Код',object_type:'Тип',type_code:'Тип-код',priority:'Пріоритет',mgrs:'MGRS',lat:'Широта',lon:'Довгота',is_active:'Активний',note:'Примітка'}
    },
    units: {
      title: 'Підрозділи', table: 'dict_units', order: 'unit_name', pk: 'id', limit: 500,
      columns: ['unit_name','unit_code','short_name','unit_type','level_no','note'],
      editable: ['unit_name','unit_code','short_name','unit_type','level_no','note'],
      labels: {unit_name:'Підрозділ',unit_code:'Код',short_name:'Скорочено',unit_type:'Тип',level_no:'Рівень',note:'Примітка'}
    },
    frequencies: {
      title: 'Частоти', table: 'dict_civil_freq', order: 'name', pk: 'id', limit: 500,
      columns: ['name','category','freq_from_mhz','freq_to_mhz','note'],
      editable: ['name','category','freq_from_mhz','freq_to_mhz','note'],
      labels: {name:'Назва',category:'Категорія',freq_from_mhz:'Від, МГц',freq_to_mhz:'До, МГц',note:'Примітка'}
    }
  };

  let supa = null;
  let state = { key: 'stations', rows: [], view: [], selectedIndex: -1, dirty: new Map(), search: '' };

  function sb() {
    if (supa) return supa;
    if (!window.supabase || !window.VECTOR_SUPABASE_URL || !window.VECTOR_SUPABASE_KEY) return null;
    supa = window.supabase.createClient(window.VECTOR_SUPABASE_URL, window.VECTOR_SUPABASE_KEY);
    return supa;
  }

  function mount() {
    const host = document.querySelector('#refs .library-head');
    if (!host || document.querySelector('#dictEditor')) return;
    const box = document.createElement('section');
    box.id = 'dictEditor';
    box.className = 'dict-editor';
    box.innerHTML = `
      <div class="dict-editor__head"><div><p class="eyebrow">VECTOR Data Studio</p><h2>Редактор довідників</h2><p>Редагування довідників напряму в Supabase. Перший робочий режим — станції.</p></div><div class="dict-pill" id="dictDirtyPill">0 змін</div></div>
      <div class="dict-tabs" id="dictTabs"></div>
      <div class="dict-toolbar">
        <button class="dict-btn" id="dictAdd" type="button">＋ Додати</button>
        <button class="dict-btn dict-btn--primary" id="dictSave" type="button">▣ Зберегти</button>
        <button class="dict-btn" id="dictReload" type="button">↻ Оновити</button>
        <button class="dict-btn" id="dictClone" type="button">⧉ Дублювати</button>
        <input class="dict-search" id="dictSearch" placeholder="Пошук...">
        <button class="dict-btn" id="dictFilter" type="button">Фільтр</button>
        <button class="dict-btn" id="dictExport" type="button">Експорт CSV</button>
        <button class="dict-btn" id="dictImport" type="button">Імпорт</button>
      </div>
      <div class="dict-status" id="dictStatus">Готово.</div>
      <div class="dict-layout"><div class="dict-table-wrap" id="dictTableWrap"><div class="dict-empty">Оберіть довідник.</div></div><aside class="dict-props" id="dictProps"><h3>Властивості</h3><div class="dict-empty">Оберіть рядок у таблиці.</div></aside></div>
    `;
    host.insertAdjacentElement('afterend', box);
    renderTabs();
    bind();
    loadRows();
  }

  function bind() {
    document.querySelector('#dictAdd')?.addEventListener('click', addRow);
    document.querySelector('#dictSave')?.addEventListener('click', saveChanges);
    document.querySelector('#dictReload')?.addEventListener('click', loadRows);
    document.querySelector('#dictClone')?.addEventListener('click', cloneRow);
    document.querySelector('#dictSearch')?.addEventListener('input', e => { state.search = e.target.value; applyFilter(); renderTable(); });
    document.querySelector('#dictExport')?.addEventListener('click', exportCsv);
    document.querySelector('#dictFilter')?.addEventListener('click', () => status('Фільтр буде наступним кроком. Поки працює пошук.'));
    document.querySelector('#dictImport')?.addEventListener('click', () => status('Імпорт залишив у старому модулі. Тут додамо після стабілізації редактора.'));
  }

  function renderTabs() {
    const tabs = document.querySelector('#dictTabs'); if (!tabs) return;
    tabs.innerHTML = Object.entries(CONFIGS).map(([key, cfg]) => `<button class="dict-tab ${key===state.key?'is-active':''}" data-key="${key}" type="button">${cfg.title}</button>`).join('');
    tabs.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      if (state.dirty.size && !confirm('Є незбережені зміни. Перейти без збереження?')) return;
      state = { key: b.dataset.key, rows: [], view: [], selectedIndex: -1, dirty: new Map(), search: '' };
      const search = document.querySelector('#dictSearch'); if (search) search.value = '';
      renderTabs(); loadRows();
    }));
  }

  async function loadRows() {
    const c = sb(); const cfg = CONFIGS[state.key];
    if (!c) { status('Supabase не підключений.'); return; }
    status('Завантажую ' + cfg.title + '...');
    const selectCols = [cfg.pk, ...cfg.columns].join(',');
    const { data, error } = await c.from(cfg.table).select(selectCols).order(cfg.order, { ascending: true }).limit(cfg.limit);
    if (error) { status('Помилка: ' + error.message); return; }
    state.rows = (data || []).map(r => ({ ...r, __isNew: false }));
    state.dirty = new Map(); state.selectedIndex = -1;
    applyFilter(); renderTable(); renderProps(); updateDirty();
    status('Завантажено: ' + state.rows.length + ' записів.');
  }

  function applyFilter() {
    const q = state.search.trim().toLowerCase();
    state.view = !q ? state.rows : state.rows.filter(row => Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q)));
  }

  function renderTable() {
    const cfg = CONFIGS[state.key]; const wrap = document.querySelector('#dictTableWrap'); if (!wrap) return;
    if (!state.view.length) { wrap.innerHTML = '<div class="dict-empty">Немає записів.</div>'; return; }
    wrap.innerHTML = `<table class="dict-table"><thead><tr>${cfg.columns.map(c => `<th>${label(c)}</th>`).join('')}</tr></thead><tbody>${state.view.map((row, idx) => `<tr data-id="${row[cfg.pk] || ''}" data-idx="${idx}" class="${idx===state.selectedIndex?'is-selected':''}">${cfg.columns.map(col => cell(row, col)).join('')}</tr>`).join('')}</tbody></table>`;
    wrap.querySelectorAll('tbody tr').forEach(tr => tr.addEventListener('click', () => { state.selectedIndex = Number(tr.dataset.idx); renderTable(); renderProps(); focusOnMap(getSelected()); }));
    wrap.querySelectorAll('td[data-col]').forEach(td => {
      td.addEventListener('input', () => editCell(td.closest('tr'), td.dataset.col, td.textContent));
      td.addEventListener('blur', () => { renderProps(); updateDirty(); });
    });
  }

  function cell(row, col) {
    const cfg = CONFIGS[state.key]; const editable = cfg.editable.includes(col);
    const dirty = isDirty(row, col) ? 'is-dirty' : '';
    return `<td class="${dirty}" data-col="${col}" ${editable?'contenteditable="true"':''}>${esc(row[col] ?? '')}</td>`;
  }

  function renderProps() {
    const cfg = CONFIGS[state.key]; const props = document.querySelector('#dictProps'); if (!props) return;
    const row = getSelected();
    if (!row) { props.innerHTML = '<h3>Властивості</h3><div class="dict-empty">Оберіть рядок у таблиці.</div>'; return; }
    props.innerHTML = `<h3>${cfg.title}</h3>${cfg.columns.map(col => `<label class="dict-field"><span>${label(col)}</span>${col==='note'?`<textarea data-col="${col}" class="${isDirty(row,col)?'is-dirty':''}">${esc(row[col] ?? '')}</textarea>`:`<input data-col="${col}" value="${esc(row[col] ?? '')}" class="${isDirty(row,col)?'is-dirty':''}">`}</label>`).join('')}<div class="dict-audit"><b>ID:</b> ${esc(row[cfg.pk] || 'новий запис')}<br><b>Стан:</b> ${row.__isNew ? 'новий' : 'існуючий'}</div>`;
    props.querySelectorAll('[data-col]').forEach(input => input.addEventListener('input', e => { editRow(row, e.target.dataset.col, e.target.value); renderTable(); updateDirty(); }));
  }

  function getSelected() { return state.view[state.selectedIndex] || null; }
  function editCell(tr, col, value) { const row = state.view[Number(tr.dataset.idx)]; editRow(row, col, value); tr.querySelector(`[data-col="${col}"]`)?.classList.add('is-dirty'); }
  function editRow(row, col, value) {
    if (!row) return;
    const cfg = CONFIGS[state.key];
    const id = row[cfg.pk] || row.__tempId;
    const normalized = normalize(col, value);
    row[col] = normalized;
    state.dirty.set(id, row);
  }
  function normalize(col, value) { if (['lat','lon','coverage_radius_km','priority','level_no','freq_from_mhz','freq_to_mhz'].includes(col)) return value === '' ? null : Number(String(value).replace(',', '.')); if (col === 'is_active') return ['true','так','1','yes','активна','активний'].includes(String(value).toLowerCase()); return value; }
  function isDirty(row, col) { const cfg = CONFIGS[state.key]; const id = row[cfg.pk] || row.__tempId; return state.dirty.has(id) && cfg.editable.includes(col); }
  function label(col) { return CONFIGS[state.key].labels[col] || col; }

  function addRow() {
    const cfg = CONFIGS[state.key];
    const row = { __isNew: true, __tempId: 'new-' + Date.now() };
    cfg.columns.forEach(col => row[col] = col === 'coverage_radius_km' ? 15 : col === 'is_active' ? true : '');
    state.rows.unshift(row); state.dirty.set(row.__tempId, row); applyFilter(); state.selectedIndex = 0; renderTable(); renderProps(); updateDirty(); status('Новий запис додано локально. Заповни поля і натисни Зберегти.');
  }

  function cloneRow() {
    const selected = getSelected(); if (!selected) { status('Оберіть запис для дублювання.'); return; }
    const cfg = CONFIGS[state.key]; const row = { ...selected, [cfg.pk]: null, __isNew: true, __tempId: 'new-' + Date.now() };
    if (row.station_name) row.station_name += ' копія'; if (row.object_name) row.object_name += ' копія'; if (row.name) row.name += ' копія';
    state.rows.unshift(row); state.dirty.set(row.__tempId, row); applyFilter(); state.selectedIndex = 0; renderTable(); renderProps(); updateDirty();
  }

  async function saveChanges() {
    const c = sb(); const cfg = CONFIGS[state.key]; if (!c) return status('Supabase не підключений.');
    const rows = [...state.dirty.values()]; if (!rows.length) return status('Немає змін для збереження.');
    status('Зберігаю змін: ' + rows.length + '...');
    for (const row of rows) {
      const payload = {}; cfg.editable.forEach(col => payload[col] = row[col] === '' ? null : row[col]);
      if (row.__isNew) {
        const { error } = await c.from(cfg.table).insert(payload);
        if (error) { status('Помилка insert: ' + error.message); return; }
      } else {
        const { error } = await c.from(cfg.table).update(payload).eq(cfg.pk, row[cfg.pk]);
        if (error) { status('Помилка update: ' + error.message); return; }
      }
    }
    status('Збережено. Оновлюю дані...');
    await loadRows();
  }

  function exportCsv() {
    const cfg = CONFIGS[state.key]; const rows = state.view.length ? state.view : state.rows;
    const csv = [cfg.columns.join(';'), ...rows.map(r => cfg.columns.map(c => csvVal(r[c])).join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = cfg.table + '.csv'; a.click(); URL.revokeObjectURL(a.href);
  }
  function csvVal(v) { const s = String(v ?? '').replace(/"/g, '""'); return `"${s}"`; }
  function focusOnMap(row) { try { if (row && Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lon))) window.vectorLeafletMap?.setView?.([Number(row.lat), Number(row.lon)], Math.max(window.vectorLeafletMap.getZoom(), 11)); } catch {} }
  function status(text) { const el = document.querySelector('#dictStatus'); if (el) el.textContent = text; }
  function updateDirty() { const el = document.querySelector('#dictDirtyPill'); if (el) el.textContent = state.dirty.size + ' змін'; }
  function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  window.addEventListener('load', () => { mount(); setTimeout(mount, 500); setTimeout(mount, 1200); });
  document.addEventListener('click', () => setTimeout(mount, 150));
})();