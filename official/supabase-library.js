(() => {
  const SOURCES = [
    { group:'NORM', table:'norm_excel_requests', title:'NORM заявки', desc:'Нормалізовані заявки на прикриття/коридор', columns:['request_date','request_time','action_type','cover_type','cover_object_name','cover_object_unit','settlement_name','coordinates_mgrs_raw','time_start_raw','time_end_raw','station_name','frequency_mode','lat','lon','parse_status'] },
    { group:'NORM', table:'norm_excel_request_stations', title:'NORM станції', desc:'Станції, прив’язані до заявок', columns:['norm_excel_request_id','station_name_raw','station_id','created_at'] },
    { group:'NORM', table:'norm_word_events', title:'NORM події', desc:'Нормалізовані події бойової роботи', columns:['event_at','azimuth','result_raw','result_normalized','is_detected','is_suppressed','is_cover','is_verified','created_at'] },
    { group:'RAW', table:'raw_excel_requests', title:'RAW заявки', desc:'Сирі Excel-заявки без редагування', columns:['source_file_name','source_row_no','request_date','request_time','action_type','requested_by','cover_type','cover_object_name','cover_object_unit','settlement_name','mgrs','time_start','time_end','station_name','frequencies','duty_officer','lat','lon','parse_status'] },
    { group:'RAW', table:'raw_word_events', title:'RAW події', desc:'Сирі Word-події без редагування', columns:['source_file_name','row_no','station_raw','event_datetime_raw','uav_type_raw','location_raw','azimuth_raw','settlement_raw','result_raw','parse_status'] },
    { group:'ІМПОРТ', table:'upload_batches', title:'Пакети імпорту', desc:'Партії завантаження файлів', columns:['source_system','batch_type','uploaded_by','status','processed_at','created_at','note'] },
    { group:'ІМПОРТ', table:'uploaded_files', title:'Файли', desc:'Завантажені файли та аркуші', columns:['file_name','file_ext','mime_type','source_sheet','file_size_bytes','storage_path','created_at'] },
    { group:'ДОВІДНИКИ', table:'dict_units', title:'Підрозділи', desc:'Структура та підпорядкування', columns:['unit_name','short_name','unit_type','level_no','note'] },
    { group:'ДОВІДНИКИ', table:'dict_settlements', title:'Населені пункти', desc:'НП, громади, координати', columns:['name','region','district','hromada_name','lat','lon','mgrs'] },
    { group:'ДОВІДНИКИ', table:'dict_stations', title:'Станції', desc:'Засоби, підрозділи, статус, геодані', columns:['station_name','station_code','status_text','lat','lon','mgrs'] },
    { group:'ДОВІДНИКИ', table:'dict_cover_objects', title:'Об’єкти', desc:'Об’єкти, типи, пріоритети, координати', columns:['object_name','object_type','type_code','priority','lat','lon','mgrs'] },
    { group:'ДОВІДНИКИ', table:'dict_uav', title:'БпЛА', desc:'Типи та частоти', columns:['uav_name','uav_category','side','control_freq_from_mhz','control_freq_to_mhz','video_freq_from_mhz','video_freq_to_mhz'] },
    { group:'ДОВІДНИКИ', table:'dict_fpv', title:'FPV', desc:'Діапазони FPV', columns:['name','category','freq_from_mhz','freq_to_mhz','note'] },
    { group:'ДОВІДНИКИ', table:'dict_navigation', title:'Навігація', desc:'Навігаційні частоти', columns:['nav_name','category','freq_from_mhz','freq_to_mhz','note'] },
    { group:'ДОВІДНИКИ', table:'dict_civil_freq', title:'Частоти', desc:'Додаткові діапазони', columns:['name','category','freq_from_mhz','freq_to_mhz','note'] },
    { group:'ДОВІДНИКИ', table:'dict_contact', title:'Контакти', desc:'Відповідальні особи', columns:['full_name','position_name','rank_name','phone','telegram','note'] },
    { group:'ДОВІДНИКИ', table:'dict_pending', title:'На розгляд', desc:'Нерозпізнані значення імпорту', columns:['source_table','field_name','raw_value','decision_status','resolved_table'] }
  ];

  let client = null;
  let activeGroup = 'NORM';
  let activeSource = SOURCES[0];
  let activeRows = [];

  function getClient(){
    if(client) return client;
    if(!window.supabase || !window.VECTOR_SUPABASE_URL || !window.VECTOR_SUPABASE_KEY) return null;
    client = window.supabase.createClient(window.VECTOR_SUPABASE_URL, window.VECTOR_SUPABASE_KEY);
    return client;
  }

  function mount(){
    const library = document.querySelector('#refs .library-head');
    if(!library || document.querySelector('#supabaseLibrary')) return;
    const panel = document.createElement('section');
    panel.className = 'supabase-library';
    panel.id = 'supabaseLibrary';
    panel.innerHTML = '<div class="supabase-library__head"><div><h2>Дані LavashBase</h2><p>Основний акцент: NORM і RAW бойової роботи. Довідники — як база для зв’язків і нормалізації.</p></div><button class="supabase-refresh" id="refreshDictionaries" type="button">Оновити</button></div><div class="dict-tabs" id="dictTabs"></div><div class="dict-grid" id="dictGrid"></div><div class="dict-viewer" id="dictViewer"><div class="dict-empty">Завантаження...</div></div>';
    library.insertAdjacentElement('afterend', panel);
    document.querySelector('#refreshDictionaries')?.addEventListener('click', loadCounts);
    renderTabs(); renderCards(); loadCounts(); openSource(activeSource.table);
  }

  function groups(){ return [...new Set(SOURCES.map(s=>s.group))]; }
  function renderTabs(){
    const box = document.querySelector('#dictTabs'); if(!box) return;
    box.innerHTML = groups().map(g=>'<button class="dict-tab '+(g===activeGroup?'is-active':'')+'" data-group="'+g+'" type="button">'+g+'</button>').join('');
    box.querySelectorAll('.dict-tab').forEach(btn=>btn.addEventListener('click',()=>{ activeGroup=btn.dataset.group; activeSource=SOURCES.find(s=>s.group===activeGroup); renderTabs(); renderCards(); openSource(activeSource.table); }));
  }

  function renderCards(counts={}){
    const grid = document.querySelector('#dictGrid'); if(!grid) return;
    const items = SOURCES.filter(s=>s.group===activeGroup);
    grid.innerHTML = items.map(src=>'<button class="dict-card '+(src.table===activeSource.table?'is-active':'')+'" data-table="'+src.table+'" type="button"><strong>'+src.title+'</strong><span>'+src.desc+'</span><b>'+(counts[src.table] ?? '—')+'</b></button>').join('');
    grid.querySelectorAll('.dict-card').forEach(btn=>btn.addEventListener('click',()=>openSource(btn.dataset.table)));
  }

  async function loadCounts(){
    const sb=getClient(); if(!sb){showError('Supabase-клієнт не підключений.'); return;}
    const counts={};
    await Promise.all(SOURCES.map(async src=>{ const {count,error}=await sb.from(src.table).select('*',{count:'exact',head:true}); counts[src.table]=error?'!':(count??0); }));
    renderCards(counts);
  }

  async function openSource(table){
    const src = SOURCES.find(s=>s.table===table) || SOURCES[0];
    activeSource=src; activeGroup=src.group; renderTabs();
    document.querySelectorAll('.dict-card').forEach(c=>c.classList.toggle('is-active',c.dataset.table===table));
    const viewer=document.querySelector('#dictViewer'); if(viewer) viewer.innerHTML='<div class="dict-empty">Завантаження записів...</div>';
    const sb=getClient(); if(!sb){showError('Supabase-клієнт не підключений.'); return;}
    let query=sb.from(src.table).select(src.columns.join(',')).limit(300);
    if(src.table==='norm_excel_requests') query=query.order('request_at',{ascending:false,nullsFirst:false});
    else if(src.table==='norm_word_events') query=query.order('event_at',{ascending:false,nullsFirst:false});
    else if(src.columns.includes('created_at')) query=query.order('created_at',{ascending:false});
    const {data,error}=await query;
    if(error){showError('Помилка завантаження: '+error.message); return;}
    activeRows=data||[]; renderViewer('');
  }

  function renderViewer(filter){
    const viewer=document.querySelector('#dictViewer'); if(!viewer) return;
    const f=String(filter||'').toLowerCase();
    const filtered=activeRows.filter(row=>JSON.stringify(row).toLowerCase().includes(f));
    viewer.innerHTML='<div class="dict-viewer__head"><h3>'+activeSource.group+' / '+activeSource.title+' <span class="dict-pill">'+filtered.length+'/'+activeRows.length+'</span></h3><input class="dict-search" id="dictSearch" placeholder="Пошук..." value="'+escapeHtml(filter||'')+'"></div><div class="dict-table-wrap">'+renderTable(filtered)+'</div>';
    const input=document.querySelector('#dictSearch'); input?.addEventListener('input',e=>renderViewer(e.target.value)); input?.focus();
  }

  function renderTable(rows){
    if(!rows.length) return '<div class="dict-empty">Записів не знайдено.</div>';
    return '<table class="dict-table"><thead><tr>'+activeSource.columns.map(col=>'<th>'+label(col)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+activeSource.columns.map(col=>'<td>'+escapeHtml(format(row[col]))+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
  }
  function format(v){ if(v===true)return 'так'; if(v===false)return 'ні'; if(v===null||v===undefined)return ''; return v; }
  function label(col){
    const labels={request_date:'Дата',request_time:'Час',request_at:'Дата/час',action_type:'Дія',cover_type:'Тип прикриття',cover_object_name:'Об’єкт',cover_object_unit:'Підрозділ',settlement_name:'НП',coordinates_mgrs_raw:'MGRS',mgrs:'MGRS',time_start_raw:'Початок',time_end_raw:'Завершення',time_start:'Початок',time_end:'Завершення',station_name:'Станція',frequency_mode:'Частоти',frequencies:'Частоти',lat:'Широта',lon:'Довгота',parse_status:'Статус',norm_excel_request_id:'ID заявки',station_name_raw:'Станція raw',station_id:'ID станції',created_at:'Створено',event_at:'Подія',azimuth:'Азимут',result_raw:'Результат raw',result_normalized:'Результат norm',is_detected:'Виявлено',is_suppressed:'Подавлено',is_cover:'Прикриття',is_verified:'Перевірено',source_file_name:'Файл',source_row_no:'Рядок',requested_by:'Заявник',duty_officer:'Черговий',row_no:'Рядок',station_raw:'Станція raw',event_datetime_raw:'Дата/час raw',uav_type_raw:'БпЛА raw',location_raw:'Локація raw',azimuth_raw:'Азимут raw',settlement_raw:'НП raw',source_system:'Система',batch_type:'Тип',uploaded_by:'Хто',status:'Статус',processed_at:'Оброблено',note:'Примітка',file_name:'Файл',file_ext:'Тип',mime_type:'MIME',source_sheet:'Аркуш',file_size_bytes:'Розмір',storage_path:'Шлях',unit_name:'Підрозділ',short_name:'Скорочено',unit_type:'Тип',level_no:'Рівень',name:'Назва',region:'Область',district:'Район',hromada_name:'Громада',station_code:'Код',status_text:'Статус',object_name:'Об’єкт',object_type:'Тип об’єкта',type_code:'Код типу',priority:'Пріоритет',uav_name:'Назва',uav_category:'Категорія',side:'Сторона',control_freq_from_mhz:'Кер. від',control_freq_to_mhz:'Кер. до',video_freq_from_mhz:'Відео від',video_freq_to_mhz:'Відео до',category:'Категорія',freq_from_mhz:'МГц від',freq_to_mhz:'МГц до',nav_name:'Навігація',full_name:'ПІБ',position_name:'Посада',rank_name:'Звання',phone:'Телефон',telegram:'Telegram',source_table:'Джерело',field_name:'Поле',raw_value:'Сире значення',decision_status:'Статус',resolved_table:'Вирішено'};
    return labels[col]||col;
  }
  function showError(text){const viewer=document.querySelector('#dictViewer'); if(viewer) viewer.innerHTML='<div class="dict-empty">'+escapeHtml(text)+'</div>';}
  function escapeHtml(value){return String(value??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

  window.addEventListener('load',()=>{mount(); setTimeout(mount,500);});
  document.addEventListener('click',()=>setTimeout(mount,80));
})();