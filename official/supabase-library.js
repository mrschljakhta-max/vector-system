(() => {
  const DICTS = [
    { table: 'dict_units', title: 'Підрозділи', desc: 'Структура та підпорядкування', columns: ['unit_name','short_name','unit_type','level_no','note'] },
    { table: 'dict_settlements', title: 'Населені пункти', desc: 'Населені пункти, громади, координати', columns: ['name','region','district','hromada_name','lat','lon','mgrs'] },
    { table: 'dict_stations', title: 'Станції', desc: 'Засоби, підрозділи, статус, геодані', columns: ['station_name','station_code','status_text','lat','lon','mgrs'] },
    { table: 'dict_station_types', title: 'Типи станцій', desc: 'Класифікація засобів', columns: ['type_name','category','description','note'] },
    { table: 'dict_cover_objects', title: 'Об’єкти', desc: 'Об’єкти, типи, пріоритети, координати', columns: ['object_name','object_type','type_code','priority','lat','lon','mgrs'] },
    { table: 'dict_uav', title: 'Типи об’єктів', desc: 'Типи та діапазони', columns: ['uav_name','uav_category','side','control_freq_from_mhz','control_freq_to_mhz','video_freq_from_mhz','video_freq_to_mhz'] },
    { table: 'dict_fpv', title: 'FPV', desc: 'Діапазони', columns: ['name','category','freq_from_mhz','freq_to_mhz','note'] },
    { table: 'dict_navigation', title: 'Навігація', desc: 'Навігаційні частоти', columns: ['nav_name','category','freq_from_mhz','freq_to_mhz','note'] },
    { table: 'dict_civil_freq', title: 'Частоти', desc: 'Додаткові діапазони', columns: ['name','category','freq_from_mhz','freq_to_mhz','note'] },
    { table: 'dict_contact', title: 'Контакти', desc: 'Відповідальні особи', columns: ['full_name','position_name','rank_name','phone','telegram','note'] },
    { table: 'dict_hromada_100', title: 'Громади', desc: 'Громади та райони', columns: ['name','district','region','note'] },
    { table: 'dict_pending', title: 'На розгляд', desc: 'Нерозпізнані значення імпорту', columns: ['source_table','field_name','raw_value','decision_status','resolved_table'] }
  ];

  let client = null;
  let activeDict = DICTS[0];
  let activeRows = [];

  function getClient() {
    if (client) return client;
    if (!window.supabase || !window.VECTOR_SUPABASE_URL || !window.VECTOR_SUPABASE_KEY) return null;
    client = window.supabase.createClient(window.VECTOR_SUPABASE_URL, window.VECTOR_SUPABASE_KEY);
    return client;
  }

  function mount() {
    const library = document.querySelector('#refs .library-head');
    if (!library || document.querySelector('#supabaseLibrary')) return;
    const panel = document.createElement('section');
    panel.className = 'supabase-library';
    panel.id = 'supabaseLibrary';
    panel.innerHTML = '<div class="supabase-library__head"><div><h2>Довідники Supabase</h2><p>Дані завантажуються напряму з LavashBase.</p></div><button class="supabase-refresh" id="refreshDictionaries" type="button">Оновити</button></div><div class="dict-grid" id="dictGrid"></div><div class="dict-viewer" id="dictViewer"><div class="dict-empty">Завантаження довідників...</div></div>';
    library.insertAdjacentElement('afterend', panel);
    document.querySelector('#refreshDictionaries')?.addEventListener('click', loadCounts);
    renderCards();
    loadCounts();
    openDictionary(activeDict.table);
  }

  function renderCards(counts = {}) {
    const grid = document.querySelector('#dictGrid');
    if (!grid) return;
    grid.innerHTML = DICTS.map((dict) => '<button class="dict-card '+(dict.table === activeDict.table ? 'is-active' : '')+'" data-table="'+dict.table+'" type="button"><strong>'+dict.title+'</strong><span>'+dict.desc+'</span><b>'+(counts[dict.table] ?? '—')+'</b></button>').join('');
    grid.querySelectorAll('.dict-card').forEach((btn) => btn.addEventListener('click', () => openDictionary(btn.dataset.table)));
  }

  async function loadCounts() {
    const sb = getClient();
    if (!sb) { showError('Supabase-клієнт не підключений.'); return; }
    const counts = {};
    await Promise.all(DICTS.map(async (dict) => {
      const { count, error } = await sb.from(dict.table).select('*', { count: 'exact', head: true });
      counts[dict.table] = error ? '!' : (count ?? 0);
    }));
    renderCards(counts);
  }

  async function openDictionary(table) {
    const dict = DICTS.find((item) => item.table === table) || DICTS[0];
    activeDict = dict;
    document.querySelectorAll('.dict-card').forEach((card) => card.classList.toggle('is-active', card.dataset.table === table));
    const viewer = document.querySelector('#dictViewer');
    if (viewer) viewer.innerHTML = '<div class="dict-empty">Завантаження записів...</div>';
    const sb = getClient();
    if (!sb) { showError('Supabase-клієнт не підключений.'); return; }
    const { data, error } = await sb.from(dict.table).select(dict.columns.join(',')).limit(200);
    if (error) { showError('Помилка завантаження: ' + error.message); return; }
    activeRows = data || [];
    renderViewer('');
  }

  function renderViewer(filter) {
    const viewer = document.querySelector('#dictViewer');
    if (!viewer) return;
    const f = String(filter || '').toLowerCase();
    const filtered = activeRows.filter((row) => JSON.stringify(row).toLowerCase().includes(f));
    viewer.innerHTML = '<div class="dict-viewer__head"><h3>'+activeDict.title+' <span class="dict-pill">'+filtered.length+'/'+activeRows.length+'</span></h3><input class="dict-search" id="dictSearch" placeholder="Пошук у довіднику..." value="'+escapeHtml(filter || '')+'"></div><div class="dict-table-wrap">'+renderTable(filtered)+'</div>';
    const input = document.querySelector('#dictSearch');
    input?.addEventListener('input', (event) => renderViewer(event.target.value));
    input?.focus();
  }

  function renderTable(rows) {
    if (!rows.length) return '<div class="dict-empty">Записів не знайдено.</div>';
    return '<table class="dict-table"><thead><tr>'+activeDict.columns.map((col) => '<th>'+label(col)+'</th>').join('')+'</tr></thead><tbody>'+rows.map((row) => '<tr>'+activeDict.columns.map((col) => '<td>'+escapeHtml(row[col] ?? '')+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
  }

  function label(col) {
    const labels = { unit_name:'Підрозділ', short_name:'Скорочено', unit_type:'Тип', level_no:'Рівень', note:'Примітка', name:'Назва', region:'Область', district:'Район', hromada_name:'Громада', lat:'Широта', lon:'Довгота', mgrs:'MGRS', station_name:'Станція', station_code:'Код', status_text:'Статус', type_name:'Тип', category:'Категорія', description:'Опис', object_name:'Об’єкт', object_type:'Тип об’єкта', type_code:'Код типу', priority:'Пріоритет', uav_name:'Назва', uav_category:'Категорія', side:'Сторона', control_freq_from_mhz:'Кер. від', control_freq_to_mhz:'Кер. до', video_freq_from_mhz:'Відео від', video_freq_to_mhz:'Відео до', freq_from_mhz:'МГц від', freq_to_mhz:'МГц до', nav_name:'Навігація', full_name:'ПІБ', position_name:'Посада', rank_name:'Звання', phone:'Телефон', telegram:'Telegram', source_table:'Джерело', field_name:'Поле', raw_value:'Сире значення', decision_status:'Статус', resolved_table:'Вирішено' };
    return labels[col] || col;
  }

  function showError(text) {
    const viewer = document.querySelector('#dictViewer');
    if (viewer) viewer.innerHTML = '<div class="dict-empty">'+escapeHtml(text)+'</div>';
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  window.addEventListener('load', () => { mount(); setTimeout(mount, 500); });
  document.addEventListener('click', () => setTimeout(mount, 80));
})();