(() => {
  if (window.L && !window.__vectorLeafletPatched) {
    const originalMap = window.L.map;
    window.L.map = function patchedMap(...args) {
      const map = originalMap.apply(this, args);
      window.vectorLeafletMap = map;
      return map;
    };
    window.__vectorLeafletPatched = true;
  }

  const LAYER_STYLES = {
    summary: { color:'#8B5CF6', fillColor:'#8B5CF6' },
    uav: { color:'#3B82F6', fillColor:'#3B82F6' },
    stations: { color:'#22C55E', fillColor:'#22C55E' },
    vp: { color:'#EF4444', fillColor:'#EF4444' },
    sp: { color:'#FACC15', fillColor:'#FACC15' },
    settlements: { color:'#94A3B8', fillColor:'#94A3B8' },
    routes: { color:'#F97316', fillColor:'#F97316' },
    points: { color:'#EC4899', fillColor:'#EC4899' }
  };

  const DATASETS = [
    { key:'summary', category:'objects', title:'Зведені НП', desc:'1 точка = 1 населений пункт із пов’язаними записами', table:'map_settlement_summary', point:true, aggregate:true, name:'settlement_name', lat:'lat', lon:'lon', countField:'total_related_count', popup:'summary', columns:['settlement_id','settlement_name','region','district','hromada_name','lat','lon','mgrs','stations_count','cover_objects_count','vp_count','sp_count','uav_events_count','detected_count','suppressed_count','cover_events_count','requests_count','corridor_count','protection_count','station_units_count','cover_units_count','first_event_at','last_event_at','first_request_at','last_request_at','total_related_count'] },
    { key:'uav', category:'objects', title:'БпЛА', desc:'Події БпЛА, згруповані по населених пунктах', table:'map_uav_settlement_summary', point:true, aggregate:true, name:'settlement_name', lat:'lat', lon:'lon', countField:'uav_events_count', popup:'uav', columns:['settlement_id','settlement_name','region','district','hromada_name','lat','lon','mgrs','uav_events_count','detected_count','suppressed_count','cover_count','first_event_at','last_event_at','stations_count','uav_types_count'] },
    { key:'settlements', category:'objects', title:'Населені пункти', desc:'dict_settlements: lat/lon/MGRS', table:'dict_settlements', columns:['name','region','district','hromada_name','lat','lon','mgrs'], point:true, name:'name', lat:'lat', lon:'lon' },
    { key:'stations', category:'objects', title:'Станції', desc:'зелений маркер + зона 15 км', table:'dict_stations', columns:['station_name','station_code','status_text','lat','lon','mgrs','coverage_radius_km'], point:true, name:'station_name', lat:'lat', lon:'lon', popup:'station' },
    { key:'vp', category:'objects', title:'ВП', desc:'Об’єкти прикриття типу ВП', table:'dict_cover_objects', columns:['object_name','object_type','type_code','priority','lat','lon','mgrs'], point:true, name:'object_name', lat:'lat', lon:'lon', filter:(r)=>String(r.object_type||r.type_code||'').toLowerCase().includes('вп') || String(r.type_code||'').toUpperCase()==='VP' },
    { key:'sp', category:'objects', title:'СП', desc:'Об’єкти прикриття типу СП', table:'dict_cover_objects', columns:['object_name','object_type','type_code','priority','lat','lon','mgrs'], point:true, name:'object_name', lat:'lat', lon:'lon', filter:(r)=>String(r.object_type||r.type_code||'').toLowerCase().includes('сп') || String(r.type_code||'').toUpperCase()==='SP' },
    { key:'routes', category:'objects', title:'Шляхи', desc:'дороги між населеними пунктами з призначенням', table:'map_routes', line:true, columns:['route_code','route_name','route_purpose','route_status','from_name','from_lat','from_lon','to_name','to_lat','to_lon','note'] },
    { key:'points', category:'objects', title:'Пункти', desc:'штаби, РЗ, РО, КП, КСП у населених пунктах', table:'map_points', point:true, name:'point_name', lat:'lat', lon:'lon', popup:'point', columns:['point_code','point_name','point_type','settlement_name','lat','lon','mgrs','note'] },
    { key:'units', category:'objects', title:'Підрозділи', desc:'dict_units: структура підрозділів', table:'dict_units', columns:['unit_name','short_name','unit_type','level_no','note'], point:false },
    { key:'frequencies', category:'params', title:'Частоти', desc:'Показувати частотні поля в підписах', table:'dict_civil_freq', columns:['name','category','freq_from_mhz','freq_to_mhz','note'], point:false },
    { key:'date', category:'params', title:'Дата', desc:'Дата події / заявки для фільтрів і таймлапсу', table:'norm_excel_requests', columns:['request_date'], point:false },
    { key:'time', category:'params', title:'Час', desc:'Час події / заявки для таймлапсу', table:'norm_excel_requests', columns:['request_time','time_start_raw','time_end_raw'], point:false }
  ];

  let client=null, counts={}, layerGroup=null, selected=new Set(['summary']);
  function sb(){ if(client) return client; if(!window.supabase||!window.VECTOR_SUPABASE_URL||!window.VECTOR_SUPABASE_KEY) return null; client=window.supabase.createClient(window.VECTOR_SUPABASE_URL,window.VECTOR_SUPABASE_KEY); return client; }
  function isLeafletMap(m){ return !!(m && typeof m.addLayer === 'function' && typeof m.removeLayer === 'function' && typeof m.fitBounds === 'function'); }
  function getMap(){ if(isLeafletMap(window.vectorLeafletMap)) return window.vectorLeafletMap; if(isLeafletMap(window.vectorMap)) return window.vectorMap; try{ const m=eval('vectorMap'); if(isLeafletMap(m)){ window.vectorLeafletMap=m; return m; } }catch{} return null; }

  function ensureDialog(){
    if(document.querySelector('#mapDataDialog')) return;
    const dialog=document.createElement('section'); dialog.id='mapDataDialog'; dialog.className='map-data-dialog'; dialog.setAttribute('aria-hidden','true');
    dialog.innerHTML='<div class="map-data-panel"><div class="map-data-head"><div><h2>Дані карти</h2><p>БпЛА — сині, станції — зелені, ВП — червоні, СП — жовті, шляхи — помаранчеві, пункти — рожеві.</p></div><button class="map-data-close" type="button" onclick="closeMapDataDialog()">×</button></div><div class="map-data-sections"><section class="map-data-section"><h3>Об’єкти</h3><div class="map-data-grid" id="mapObjectGrid"></div></section><section class="map-data-section"><h3>Параметри</h3><div class="map-data-grid" id="mapParamGrid"></div></section></div><div class="map-data-actions"><button class="map-data-btn" type="button" id="mapDataRefresh">Оновити</button><button class="map-data-btn map-data-btn--primary" type="button" id="mapDataApply">Застосувати</button></div><div class="map-data-status" id="mapDataStatus">Готово до вибору даних.</div></div>';
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
    document.querySelectorAll('.map-data-card input').forEach(input=>input.addEventListener('change',e=>{
      e.target.checked ? selected.add(e.target.value) : selected.delete(e.target.value);
      if(e.target.value === 'summary' && e.target.checked){ ['uav','settlements','stations','vp','sp','routes','points'].forEach(k=>selected.delete(k)); }
      if(['uav','settlements','stations','vp','sp','routes','points'].includes(e.target.value) && e.target.checked){ selected.delete('summary'); }
      renderCards();
    }));
  }
  function cardHtml(d){ const active=selected.has(d.key); const swatch=LAYER_STYLES[d.key]?.fillColor || '#D78219'; return '<label class="map-data-card '+(active?'is-active':'')+'"><input type="checkbox" value="'+d.key+'" '+(active?'checked':'')+'><span><strong><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:'+swatch+';margin-right:8px"></i>'+d.title+'</strong><small>'+d.desc+'</small></span><b class="map-data-count">'+(counts[d.key]??'…')+'</b></label>'; }

  async function loadCounts(){
    const c=sb(); if(!c){ status('Supabase-клієнт не підключений.'); return; }
    status('Оновлюю кількість записів...');
    await Promise.all(DATASETS.map(async d=>{ const {count,error}=await c.from(d.table).select('*',{count:'exact',head:true}); counts[d.key]=error?'!':(count??0); }));
    renderCards(); status('Кількість оновлено.');
  }

  async function applyDataSelection(){
    const c=sb(); if(!c){ status('Supabase-клієнт не підключений.'); return; }
    const map=getMap(); if(!map){ status('Карта ще не ініціалізована. Закрий вікно, відкрий карту і повтори.'); return; }
    if(!layerGroup) layerGroup=window.L.layerGroup().addTo(map); else layerGroup.clearLayers();
    const chosen=DATASETS.filter(d=>selected.has(d.key)); let added=0;
    status('Завантажую вибрані джерела...');
    for(const d of chosen.filter(x=>x.point||x.line)){
      const {data,error}=await c.from(d.table).select(d.columns.join(',')).limit(2000);
      if(error){ console.warn(error); status('Помилка джерела '+d.title+': '+error.message); continue; }
      (data||[]).filter(r=>!d.filter||d.filter(r)).forEach(r=>{
        if(d.line){ const line=makeRouteLine(r); if(line){ line.addTo(layerGroup); added++; } return; }
        const lat=Number(r[d.lat]), lon=Number(r[d.lon]); if(!Number.isFinite(lat)||!Number.isFinite(lon)) return;
        const title=r[d.name]||d.title;
        if(d.key === 'stations') makeCoverageCircle(lat, lon, r).addTo(layerGroup);
        const marker = d.aggregate ? makeScaledMarker(lat, lon, r, d.countField, d.key) : makePointMarker(lat, lon, d.key);
        marker.bindPopup(d.popup === 'summary' ? summaryPopup(r) : d.popup === 'uav' ? uavPopup(r) : d.popup === 'station' ? stationPopup(title, r) : d.popup === 'point' ? pointPopup(title,r) : basicPopup(title, d.title, r)).addTo(layerGroup); added++;
      });
    }
    renderBadges(chosen); status('Дані застосовано. Об’єктів на карті: '+added+'. Параметри: '+chosen.filter(x=>!x.point&&!x.line).map(x=>x.title).join(', '));
    closeMapDataDialog(); if(added) try{ map.fitBounds(layerGroup.getBounds(),{padding:[40,40]}); }catch{}
  }

  function markerStyle(key){ const s = LAYER_STYLES[key] || { color:'#D78219', fillColor:'#D78219' }; return { color:s.color, fillColor:s.fillColor, weight:2, fillOpacity:.72, opacity:.95 }; }
  function makePointMarker(lat, lon, key){ return window.L.circleMarker([lat,lon],{...markerStyle(key),radius:key==='points'?8:7}); }
  function makeCoverageCircle(lat, lon, r){ const km=Number(r.coverage_radius_km || 15); return window.L.circle([lat,lon],{...markerStyle('stations'),radius:km*1000,weight:1,fillOpacity:.08,opacity:.55}); }
  function makeScaledMarker(lat, lon, r, field, key){ const total = Number(r[field] || r.total_related_count || 0); const radius = Math.max(7, Math.min(28, 7 + Math.sqrt(total) * 0.45)); return window.L.circleMarker([lat, lon], { ...markerStyle(key), radius }); }
  function makeRouteLine(r){ const a=[Number(r.from_lat),Number(r.from_lon)], b=[Number(r.to_lat),Number(r.to_lon)]; if(!a.every(Number.isFinite)||!b.every(Number.isFinite)) return null; return window.L.polyline([a,b],{...markerStyle('routes'),weight:4,opacity:.78}).bindPopup(routePopup(r)); }
  function summaryPopup(r){ return '<b>'+esc(r.settlement_name)+'</b><br><span>Зведений НП</span><hr>'+'Всього пов’язаних: <b>'+esc(r.total_related_count)+'</b><br>'+'Станції: <b>'+esc(r.stations_count)+'</b><br>'+'ВП: <b>'+esc(r.vp_count)+'</b> / СП: <b>'+esc(r.sp_count)+'</b><br>'+'Події БпЛА: <b>'+esc(r.uav_events_count)+'</b><br>'+'Виявлено: <b>'+esc(r.detected_count)+'</b> / Подавлено: <b>'+esc(r.suppressed_count)+'</b><br>'+'Заявки: <b>'+esc(r.requests_count)+'</b><br>'+'Коридори: <b>'+esc(r.corridor_count)+'</b> / Прикриття: <b>'+esc(r.protection_count)+'</b><br>'+'Остання подія: '+esc(formatDate(r.last_event_at))+'<br>'+'Остання заявка: '+esc(formatDate(r.last_request_at)); }
  function uavPopup(r){ return '<b>'+esc(r.settlement_name)+'</b><br><span>БпЛА / бойова робота</span><hr>'+'Подій: <b>'+esc(r.uav_events_count)+'</b><br>'+'Виявлено: <b>'+esc(r.detected_count)+'</b><br>'+'Подавлено: <b>'+esc(r.suppressed_count)+'</b><br>'+'Прикриття: <b>'+esc(r.cover_count)+'</b><br>'+'Станцій у подіях: <b>'+esc(r.stations_count)+'</b><br>'+'Типів БпЛА: <b>'+esc(r.uav_types_count)+'</b><br>'+'Перша подія: '+esc(formatDate(r.first_event_at))+'<br>'+'Остання подія: '+esc(formatDate(r.last_event_at)); }
  function stationPopup(title, r){ const km=Number(r.coverage_radius_km || 15); return '<b>'+esc(title)+'</b><br><span>Станція РЕБ</span><hr>'+'Код: <b>'+esc(r.station_code||'—')+'</b><br>'+'Статус: <b>'+esc(r.status_text||'—')+'</b><br>'+'Радіус покриття: <b>'+esc(km)+' км</b><br>'+'MGRS: '+esc(r.mgrs||'—'); }
  function routePopup(r){ return '<b>'+esc(r.route_name)+'</b><br><span>Шлях</span><hr>Звідки: <b>'+esc(r.from_name)+'</b><br>Куди: <b>'+esc(r.to_name)+'</b><br>Призначення: <b>'+esc(r.route_purpose||'—')+'</b><br>Статус: '+esc(r.route_status||'—'); }
  function pointPopup(title,r){ return '<b>'+esc(title)+'</b><br><span>'+esc(r.point_type||'Пункт')+'</span><hr>НП: <b>'+esc(r.settlement_name||'—')+'</b><br>Код: <b>'+esc(r.point_code||'—')+'</b><br>MGRS: '+esc(r.mgrs||'—'); }
  function basicPopup(title, sourceTitle, r){ return '<b>'+esc(title)+'</b><br>'+sourceTitle+'<br>'+Object.entries(r).slice(0,8).map(([k,v])=>esc(k)+': '+esc(v??'')).join('<br>'); }
  function formatDate(v){ if(!v) return '—'; try{return new Date(v).toLocaleString('uk-UA');}catch{return v;} }
  function renderBadges(chosen){ const box=document.querySelector('#mapLayerBadge'); if(!box) return; box.classList.toggle('is-visible',chosen.length>0); box.innerHTML=chosen.map(d=>'<span style="border-color:'+(LAYER_STYLES[d.key]?.fillColor||'#D78219')+'">'+d.title+'</span>').join(''); }
  function status(t){ const el=document.querySelector('#mapDataStatus'); if(el) el.textContent=t; }
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  window.openMapDataDialog=function(){ ensureDialog(); renderCards(); loadCounts(); document.querySelector('#mapDataDialog')?.classList.add('is-open'); document.querySelector('#mapDataDialog')?.setAttribute('aria-hidden','false'); };
  window.closeMapDataDialog=function(){ document.querySelector('#mapDataDialog')?.classList.remove('is-open'); document.querySelector('#mapDataDialog')?.setAttribute('aria-hidden','true'); };
  window.addEventListener('load',ensureDialog);
})();