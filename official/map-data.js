(() => {
  const DATASETS = [
    { key:'uav', category:'objects', title:'БпЛА', desc:'Події БпЛА з NORM бойової роботи', table:'norm_word_events', columns:['event_at','uav_type_id','result_raw','result_normalized','azimuth','is_detected','is_suppressed','is_cover','created_at'], point:false },
    { key:'settlements', category:'objects', title:'Населені пункти', desc:'dict_settlements: lat/lon/MGRS', table:'dict_settlements', columns:['name','region','district','hromada_name','lat','lon','mgrs'], point:true, name:'name', lat:'lat', lon:'lon' },
    { key:'stations', category:'objects', title:'Станції', desc:'dict_stations: станції та координати', table:'dict_stations', columns:['station_name','station_code','status_text','lat','lon','mgrs'], point:true, name:'station_name', lat:'lat', lon:'lon' },
    { key:'vp', category:'objects', title:'ВП', desc:'Об’єкти прикриття типу ВП', table:'dict_cover_objects', columns:['object_name','object_type','type_code','priority','lat','lon','mgrs'], point:true, name:'object_name', lat:'lat', lon:'lon', filter:(r)=>String(r.object_type||r.type_code||'').toLowerCase().includes('вп') },
    { key:'sp', category:'objects', title:'СП', desc:'Об’єкти прикриття типу СП', table:'dict_cover_objects', columns:['object_name','object_type','type_code','priority','lat','lon','mgrs'], point:true, name:'object_name', lat:'lat', lon:'lon', filter:(r)=>String(r.object_type||r.type_code||'').toLowerCase().includes('сп') },
    { key:'units', category:'objects', title:'Підрозділи', desc:'dict_units: структура підрозділів', table:'dict_units', columns:['unit_name','short_name','unit_type','level_no','note'], point:false },
    { key:'frequencies', category:'params', title:'Частоти', desc:'Показувати частотні поля в підписах', table:'dict_civil_freq', columns:['name','category','freq_from_mhz','freq_to_mhz','note'], point:false },
    { key:'date', category:'params', title:'Дата', desc:'Дата події / заявки для фільтрів і таймлапсу', table:'norm_excel_requests', columns:['request_date'], point:false },
    { key:'time', category:'params', title:'Час', desc:'Час події / заявки для таймлапсу', table:'norm_excel_requests', columns:['request_time','time_start_raw','time_end_raw'], point:false }
  ];
  let client=null, counts={}, layerGroup=null, selected=new Set(['settlements','stations']);
  function sb(){ if(client) return client; if(!window.supabase||!window.VECTOR_SUPABASE_URL||!window.VECTOR_SUPABASE_KEY) return null; client=window.supabase.createClient(window.VECTOR_SUPABASE_URL,window.VECTOR_SUPABASE_KEY); return client; }
  function ensureDialog(){
    if(document.querySelector('#mapDataDialog')) return;
    const dialog=document.createElement('section'); dialog.id='mapDataDialog'; dialog.className='map-data-dialog'; dialog.setAttribute('aria-hidden','true');
    dialog.innerHTML='<div class="map-data-panel"><div class="map-data-head"><div><h2>Дані карти</h2><p>Обери джерела даних для карти. Ключові поля — координати, назва, дата/час і частоти.</p></div><button class="map-data-close" type="button" onclick="closeMapDataDialog()">×</button></div><div class="map-data-sections"><section class="map-data-section"><h3>Об’єкти</h3><div class="map-data-grid" id="mapObjectGrid"></div></section><section class="map-data-section"><h3>Параметри</h3><div class="map-data-grid" id="mapParamGrid"></div></section></div><div class="map-data-actions"><button class="map-data-btn" type="button" id="mapDataRefresh">Оновити</button><button class="map-data-btn map-data-btn--primary" type="button" id="mapDataApply">Застосувати</button></div><div class="map-data-status" id="mapDataStatus">Готово до вибору даних.</div></div>';
    document.body.appendChild(dialog);
    const badges=document.createElement('div'); badges.id='mapLayerBadge'; badges.className='map-layer-badge'; document.body.appendChild(badges);
    dialog.addEventListener('click',e=>{ if(e.target===dialog) closeMapDataDialog(); });
    document.querySelector('#mapDataRefresh')?.addEventListener('click',loadCounts);
    document.querySelector('#mapDataApply')?.addEventListener('click',applyDataSelection);
    renderCards(); loadCounts();
  }
  function renderCards(){
    const objectGrid=document.querySelector('#mapObjectGrid'), paramGrid=document.querySelector('#mapParamGrid'); if(!objectGrid||!paramGrid) return;
    objectGrid.innerHTML=DATASETS.filter(d=>d.category==='objects').map(cardHtml).join('');
    paramGrid.innerHTML=DATASETS.filter(d=>d.category==='params').map(cardHtml).join('');
    document.querySelectorAll('.map-data-card input').forEach(input=>input.addEventListener('change',e=>{ e.target.checked?selected.add(e.target.value):selected.delete(e.target.value); renderCards(); }));
  }
  function cardHtml(d){ const active=selected.has(d.key); return '<label class="map-data-card '+(active?'is-active':'')+'"><input type="checkbox" value="'+d.key+'" '+(active?'checked':'')+'><span><strong>'+d.title+'</strong><small>'+d.desc+'</small></span><b class="map-data-count">'+(counts[d.key]??'…')+'</b></label>'; }
  async function loadCounts(){
    const c=sb(); if(!c){ status('Supabase-клієнт не підключений.'); return; }
    status('Оновлюю кількість записів...');
    await Promise.all(DATASETS.map(async d=>{ const {count,error}=await c.from(d.table).select('*',{count:'exact',head:true}); counts[d.key]=error?'!':(count??0); }));
    renderCards(); status('Кількість оновлено.');
  }
  async function applyDataSelection(){
    const c=sb(); if(!c){ status('Supabase-клієнт не підключений.'); return; }
    if(!window.vectorMap){ status('Карта ще не ініціалізована. Перейди на вкладку Карта.'); return; }
    if(!layerGroup) layerGroup=L.layerGroup().addTo(window.vectorMap); else layerGroup.clearLayers();
    const chosen=DATASETS.filter(d=>selected.has(d.key)); let added=0;
    status('Завантажую вибрані джерела...');
    for(const d of chosen.filter(x=>x.point)){
      const {data,error}=await c.from(d.table).select(d.columns.join(',')).limit(1000);
      if(error){ console.warn(error); continue; }
      (data||[]).filter(r=>!d.filter||d.filter(r)).forEach(r=>{
        const lat=Number(r[d.lat]), lon=Number(r[d.lon]); if(!Number.isFinite(lat)||!Number.isFinite(lon)) return;
        const title=r[d.name]||d.title; const popup='<b>'+esc(title)+'</b><br>'+d.title+'<br>'+Object.entries(r).slice(0,8).map(([k,v])=>esc(k)+': '+esc(v??'')).join('<br>');
        L.circleMarker([lat,lon],{radius:6,weight:2,fillOpacity:.75}).bindPopup(popup).addTo(layerGroup); added++;
      });
    }
    renderBadges(chosen); status('Дані застосовано. Точок на карті: '+added+'. Параметри: '+chosen.filter(x=>!x.point).map(x=>x.title).join(', '));
    closeMapDataDialog(); if(added) try{ window.vectorMap.fitBounds(layerGroup.getBounds(),{padding:[40,40]}); }catch{}
  }
  function renderBadges(chosen){ const box=document.querySelector('#mapLayerBadge'); if(!box) return; box.classList.toggle('is-visible',chosen.length>0); box.innerHTML=chosen.map(d=>'<span>'+d.title+'</span>').join(''); }
  function status(t){ const el=document.querySelector('#mapDataStatus'); if(el) el.textContent=t; }
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  window.openMapDataDialog=function(){ ensureDialog(); document.querySelector('#mapDataDialog')?.classList.add('is-open'); document.querySelector('#mapDataDialog')?.setAttribute('aria-hidden','false'); };
  window.closeMapDataDialog=function(){ document.querySelector('#mapDataDialog')?.classList.remove('is-open'); document.querySelector('#mapDataDialog')?.setAttribute('aria-hidden','true'); };
  window.addEventListener('load',ensureDialog);
})();