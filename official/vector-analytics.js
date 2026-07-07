(() => {
  const DEFAULT_RADIUS_KM = 15;
  let client = null;
  let layer = null;

  function sb(){
    if(client) return client;
    if(!window.supabase || !window.VECTOR_SUPABASE_URL || !window.VECTOR_SUPABASE_KEY) return null;
    client = window.supabase.createClient(window.VECTOR_SUPABASE_URL, window.VECTOR_SUPABASE_KEY);
    return client;
  }

  function getMap(){
    try{ if(window.vectorLeafletMap?.addLayer) return window.vectorLeafletMap; }catch{}
    try{ if(window.vectorMap?.addLayer) return window.vectorMap; }catch{}
    try{ if(vectorMap?.addLayer) return vectorMap; }catch{}
    return null;
  }

  function mount(){
    const section = document.querySelector('#analytics');
    if(!section || section.dataset.analyticsMounted) return;
    section.dataset.analyticsMounted = '1';
    section.innerHTML = `
      <div class="analytics-head">
        <div><p class="eyebrow">VECTOR Analytics</p><h1>Аналітика</h1><p>Автоматичний розрахунок показників із Supabase: ВП/СП, координати, прикриття станціями, заявки, події та проблемні об’єкти.</p></div>
        <div class="analytics-actions"><button class="analytics-btn analytics-btn--primary" id="analyticsRefresh" type="button">Оновити</button><button class="analytics-btn" id="analyticsMap" type="button">Показати неприкриті</button></div>
      </div>
      <p class="analytics-status" id="analyticsStatus">Готово до розрахунку.</p>
      <div class="analytics-grid" id="analyticsKpi"></div>
      <div class="analytics-panels">
        <section class="analytics-panel"><h2>Покриття об’єктів</h2><div id="coveragePanel" class="analytics-empty">Натисни “Оновити”.</div></section>
        <section class="analytics-panel"><h2>Неприкриті ВП/СП</h2><div id="uncoveredPanel" class="analytics-empty">Очікування даних.</div></section>
      </div>`;
    section.querySelector('#analyticsRefresh')?.addEventListener('click', runAnalytics);
    section.querySelector('#analyticsMap')?.addEventListener('click', showUncoveredOnMap);
    setTimeout(runAnalytics, 300);
  }

  async function countTable(c, table){
    const { count, error } = await c.from(table).select('*', { count:'exact', head:true });
    if(error) return null;
    return count || 0;
  }

  async function fetchRows(c, table, cols, limit=5000){
    const { data, error } = await c.from(table).select(cols).limit(limit);
    if(error) throw error;
    return data || [];
  }

  async function runAnalytics(){
    const c = sb();
    if(!c) return status('Supabase не підключений.');
    status('Розраховую показники...');
    try{
      const [cover, stations, reqCount, wordCount, excelRows, wordRows] = await Promise.all([
        fetchRows(c, 'dict_cover_objects', 'object_name,object_type,type_code,mgrs,lat,lon,is_active,unit_id,settlement_id', 2000),
        fetchRows(c, 'dict_stations', 'station_name,station_code,status_text,lat,lon,mgrs,coverage_radius_km,is_active', 1000),
        countTable(c, 'norm_excel_requests'),
        countTable(c, 'norm_word_events'),
        fetchRows(c, 'norm_excel_requests', '*', 1000).catch(() => []),
        fetchRows(c, 'norm_word_events', '*', 2000).catch(() => [])
      ]);

      const activeCover = cover.filter(r => r.is_active !== false);
      const activeStations = stations.filter(r => r.is_active !== false);
      const geoCover = activeCover.filter(hasGeo);
      const geoStations = activeStations.filter(hasGeo);
      const vp = activeCover.filter(r => isType(r, 'VP', 'ВП'));
      const sp = activeCover.filter(r => isType(r, 'SP', 'СП'));
      const coverage = calcCoverage(geoCover, geoStations);
      const detected = countByKeywords(wordRows, ['вияв', 'detected']);
      const suppressed = countByKeywords(wordRows, ['подав', 'suppressed']);
      const suppressionRate = detected ? Math.round((suppressed / detected) * 100) : null;
      const requestTypes = summarizeRequests(excelRows);

      window.__vectorAnalytics = { cover: activeCover, stations: activeStations, coverage };
      renderKpi([
        ['ВП/СП активні', activeCover.length, `ВП: ${vp.length} · СП: ${sp.length}`],
        ['З координатами', geoCover.length, `${percent(geoCover.length, activeCover.length)} від активних`],
        ['Прикрито станціями', coverage.covered.length, `${percent(coverage.covered.length, geoCover.length)} від об’єктів з координатами`],
        ['Неприкрито', coverage.uncovered.length, 'потребують рішення'],
        ['Станції активні', activeStations.length, `з координатами: ${geoStations.length}`],
        ['Заявки Excel', reqCount ?? '—', requestTypes],
        ['Події Word', wordCount ?? '—', `вибірка: ${wordRows.length}`],
        ['Коеф. подавлення', suppressionRate === null ? '—' : suppressionRate + '%', `виявл.: ${detected} · подавл.: ${suppressed}`]
      ]);
      renderCoverage(coverage, geoStations.length, geoCover.length);
      renderUncovered(coverage.uncovered);
      status(`Оновлено: ${new Date().toLocaleString('uk-UA')}.`);
    }catch(err){
      console.error(err);
      status('Помилка аналітики: ' + (err.message || err));
    }
  }

  function hasGeo(r){ return Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lon)); }
  function isType(r, code, ua){ return String(r.type_code || '').toUpperCase() === code || String(r.object_type || '').toLowerCase().includes(ua.toLowerCase()); }
  function percent(a,b){ return b ? Math.round((a/b)*100) + '%' : '0%'; }
  function status(t){ const el=document.querySelector('#analyticsStatus'); if(el) el.textContent=t; }

  function calcCoverage(objects, stations){
    const covered=[], uncovered=[];
    objects.forEach(obj => {
      const hits = stations.map(st => ({ station: st, km: distanceKm(obj, st), radius: Number(st.coverage_radius_km || DEFAULT_RADIUS_KM) }))
        .filter(x => x.km <= x.radius)
        .sort((a,b) => a.km - b.km);
      const item = { ...obj, coverage_hits: hits, nearest: nearestStation(obj, stations) };
      hits.length ? covered.push(item) : uncovered.push(item);
    });
    return { covered, uncovered, all: objects };
  }
  function nearestStation(obj, stations){
    return stations.map(st => ({ station: st, km: distanceKm(obj, st), radius: Number(st.coverage_radius_km || DEFAULT_RADIUS_KM) })).sort((a,b)=>a.km-b.km)[0] || null;
  }
  function distanceKm(a,b){
    const R=6371, lat1=rad(Number(a.lat)), lat2=rad(Number(b.lat)), dLat=lat2-lat1, dLon=rad(Number(b.lon)-Number(a.lon));
    const x=Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
    return 2*R*Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
  }
  function rad(v){ return v*Math.PI/180; }

  function countByKeywords(rows, keys){
    let n=0;
    rows.forEach(r => { const s=JSON.stringify(r).toLowerCase(); if(keys.some(k => s.includes(k))) n++; });
    return n;
  }
  function summarizeRequests(rows){
    if(!rows.length) return 'вибірка недоступна';
    const s = rows.map(r => JSON.stringify(r).toLowerCase()).join('\n');
    const cover = (s.match(/прикрит|cover/g)||[]).length;
    const corridor = (s.match(/коридор|corridor/g)||[]).length;
    return `прикриття≈${cover} · коридори≈${corridor}`;
  }

  function renderKpi(items){
    const box=document.querySelector('#analyticsKpi'); if(!box) return;
    box.innerHTML = items.map(([label,value,sub]) => `<article class="analytics-card"><small>${esc(label)}</small><strong>${esc(value)}</strong><span>${esc(sub)}</span></article>`).join('');
  }
  function renderCoverage(cov, stationCount, objectCount){
    const el=document.querySelector('#coveragePanel'); if(!el) return;
    const coveredPct = objectCount ? Math.round(cov.covered.length/objectCount*100) : 0;
    const multi = cov.covered.filter(o => o.coverage_hits.length > 1).length;
    el.className='';
    el.innerHTML = `<table class="analytics-table"><tbody>
      <tr><th>Станції з координатами</th><td>${stationCount}</td></tr>
      <tr><th>Об’єкти з координатами</th><td>${objectCount}</td></tr>
      <tr><th>Покриття</th><td><div class="analytics-bar"><i style="width:${coveredPct}%"></i></div>${coveredPct}%</td></tr>
      <tr><th>Подвійне і більше прикриття</th><td>${multi}</td></tr>
      <tr><th>Без прикриття</th><td>${cov.uncovered.length}</td></tr>
    </tbody></table>`;
  }
  function renderUncovered(rows){
    const el=document.querySelector('#uncoveredPanel'); if(!el) return;
    if(!rows.length){ el.className='analytics-empty'; el.textContent='Усі об’єкти з координатами потрапляють у радіуси станцій.'; return; }
    el.className='analytics-list';
    el.innerHTML = rows.slice(0,30).map(r => `<div class="analytics-list-item"><b>${esc(r.object_name)}</b><span>${esc(r.object_type || r.type_code || '')} · найближча: ${esc(r.nearest?.station?.station_name || '—')} ${r.nearest ? Math.round(r.nearest.km*10)/10 + ' км' : ''}</span></div>`).join('') + (rows.length>30 ? `<div class="analytics-empty">Показано 30 із ${rows.length}</div>` : '');
  }

  function showUncoveredOnMap(){
    const data = window.__vectorAnalytics?.coverage?.uncovered || [];
    const map = getMap();
    if(!map) return status('Карта ще не ініціалізована. Перейди на вкладку “Карта” і повтори.');
    if(layer) layer.clearLayers(); else layer = window.L.layerGroup().addTo(map);
    data.forEach(r => {
      if(!hasGeo(r)) return;
      window.L.circleMarker([Number(r.lat), Number(r.lon)], { radius:9, color:'#ef4444', fillColor:'#ef4444', fillOpacity:.78, weight:2 })
        .bindPopup(`<b>${esc(r.object_name)}</b><br>${esc(r.object_type || r.type_code || '')}<br>Найближча станція: ${esc(r.nearest?.station?.station_name || '—')}`)
        .addTo(layer);
    });
    try{ if(data.length) map.fitBounds(layer.getBounds(), { padding:[40,40] }); }catch{}
    status('Неприкриті об’єкти нанесено на карту: ' + data.length + '.');
  }
  function esc(v){ return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  window.vectorRunAnalytics = runAnalytics;
  window.addEventListener('load', () => { mount(); setTimeout(mount, 600); setTimeout(mount, 1400); });
  document.addEventListener('click', () => setTimeout(mount, 120));
})();