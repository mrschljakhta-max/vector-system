(() => {
  'use strict';

  const SUPABASE_URL = 'https://vfshxogiuaefrgppuypt.supabase.co'.trim().replace(/\/+$/, '');
  const SUPABASE_KEY = 'sb_publishable_yenD-zpmlFuhKKnojukBZg_z7pr_jzg'.trim();
  const q = (s) => document.querySelector(s);
  const qa = (s) => Array.from(document.querySelectorAll(s));
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pct = (a, b) => b ? `${Math.round((a / b) * 100)}%` : '0%';
  const geo = (r) => Number.isFinite(Number(r?.lat)) && Number.isFinite(Number(r?.lon));
  const rad = (v) => v * Math.PI / 180;
  const one = (v) => Array.isArray(v) ? v[0] : v;
  const state = { sb: null, events: [], cover: [], stations: [], requests: [], loadedAt: null };
  const charts = {};
  let readyResolve;
  const ready = new Promise((resolve) => { readyResolve = resolve; });

  function initSupabase() {
    if (!window.supabase?.createClient) throw new Error('Бібліотека Supabase не завантажилася.');
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SUPABASE_URL)) throw new Error(`Некоректна адреса Supabase: ${SUPABASE_URL}`);
    state.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }

  function km(a, b) {
    const R = 6371;
    const lat1 = rad(+a.lat), lat2 = rad(+b.lat);
    const dLat = lat2 - lat1, dLon = rad(+b.lon - +a.lon);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  async function count(tableName) {
    const { count: total, error } = await state.sb.from(tableName).select('*', { count: 'exact', head: true });
    if (error) throw new Error(`${tableName}: ${error.message}`);
    return total ?? 0;
  }

  async function rows(tableName, columns, limit = 5000) {
    const { data, error } = await state.sb.from(tableName).select(columns).limit(limit);
    if (error) throw new Error(`${tableName}: ${error.message}`);
    return data || [];
  }

  async function rowsPaged(tableName, columns, maxRows = 50000, pageSize = 1000) {
    const out = [];
    for (let from = 0; from < maxRows; from += pageSize) {
      const { data, error } = await state.sb.from(tableName).select(columns).range(from, from + pageSize - 1);
      if (error) throw new Error(`${tableName}: ${error.message}`);
      out.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }
    return out;
  }

  function group(data, keyFn) {
    const map = new Map();
    data.forEach((item) => {
      const key = keyFn(item) || 'Невідомо';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }

  function kpi(items) {
    q('#kpi').innerHTML = items.map((item) => `<article class="card"><small>${esc(item[0])}</small><strong>${esc(item[1])}</strong><span>${esc(item[2])}</span></article>`).join('');
  }

  function table(data) {
    return `<table class="table"><tbody>${data.map((row) => `<tr><th>${esc(row[0])}</th><td>${row[1]}</td></tr>`).join('')}</tbody></table>`;
  }

  function list(data) {
    return data.length ? `<div class="list">${data.map((row) => `<div class="item"><b>${esc(row[0])}</b><span>${row[1]}</span></div>`).join('')}</div>` : '<p class="muted">Даних немає.</p>';
  }

  function bar(value, max) {
    const width = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
    return `<div class="bar"><i style="width:${width}%"></i></div>`;
  }

  function setView(id) {
    qa('.tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.view === id));
    qa('.view').forEach((view) => view.classList.toggle('active', view.id === id));
  }

  function riskClass(n) { return n > 15 ? 'risk-high' : n > 8 ? 'risk-mid' : 'risk-low'; }

  function destroyChart(id) {
    if (charts[id]) {
      charts[id].destroy();
      delete charts[id];
    }
  }

  function chart(id, type, labels, datasets, opts = {}) {
    destroyChart(id);
    const el = q(`#${id}`);
    if (!el || !window.Chart) return;
    charts[id] = new Chart(el, {
      type,
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#c5cfdf' } }, tooltip: { mode: 'index', intersect: false } },
        scales: type === 'doughnut' ? {} : {
          x: { ticks: { color: '#9aa7bd' }, grid: { color: 'rgba(255,255,255,.06)' } },
          y: { beginAtZero: true, ticks: { color: '#9aa7bd', precision: 0 }, grid: { color: 'rgba(255,255,255,.06)' } }
        },
        ...opts
      }
    });
  }

  function filteredUav() {
    const days = q('#uavPeriod').value;
    const stationId = q('#uavStation').value;
    const uavTypeId = q('#uavType').value;
    const cut = days === 'all' ? null : new Date(Date.now() - Number(days) * 86400000);
    return state.events.filter((event) => (!cut || new Date(event.event_at) >= cut) && (stationId === 'all' || String(event.station_id) === stationId) && (uavTypeId === 'all' || String(event.uav_type_id) === uavTypeId));
  }

  function renderUav() {
    const data = filteredUav();
    const byDay = group(data, (event) => event.event_at ? new Date(event.event_at).toLocaleDateString('uk-UA') : null).reverse().slice(-45);
    chart('dailyChart', 'line', byDay.map((x) => x[0]), [{ label: 'Події', data: byDay.map((x) => x[1]), borderColor: '#d78219', backgroundColor: 'rgba(215,130,25,.18)', fill: true, tension: .25 }]);

    const byType = group(data, (event) => one(event.uav)?.uav_name).slice(0, 12);
    chart('uavChart', 'bar', byType.map((x) => x[0]), [{ label: 'Події', data: byType.map((x) => x[1]), backgroundColor: 'rgba(215,130,25,.72)' }], { indexAxis: 'y' });

    const stations = group(data, (event) => one(event.station)?.station_name).slice(0, 12);
    const stationLabels = stations.map((x) => x[0]);
    const detected = stationLabels.map((name) => data.filter((event) => one(event.station)?.station_name === name && event.is_detected).length);
    const suppressed = stationLabels.map((name) => data.filter((event) => one(event.station)?.station_name === name && event.is_suppressed).length);
    chart('stationChart', 'bar', stationLabels, [{ label: 'Виявлено', data: detected, backgroundColor: 'rgba(99,212,113,.72)' }, { label: 'Подавлено', data: suppressed, backgroundColor: 'rgba(215,130,25,.72)' }], { indexAxis: 'y' });

    const det = data.filter((event) => event.is_detected).length;
    const sup = data.filter((event) => event.is_suppressed).length;
    const cov = data.filter((event) => event.is_cover).length;
    const other = Math.max(0, data.length - new Set(data.filter((event) => event.is_detected || event.is_suppressed || event.is_cover).map((event) => event.id)).size);
    chart('resultChart', 'doughnut', ['Виявлення', 'Подавлення', 'Прикриття', 'Інше'], [{ label: 'Події', data: [det, sup, cov, other], backgroundColor: ['#63d471', '#d78219', '#4aa3ff', '#6b7280'] }]);

    const settlements = group(data, (event) => one(event.settlement)?.name).slice(0, 15);
    const maxSettlement = Math.max(1, ...settlements.map((x) => x[1]));
    q('#uavSettlements').innerHTML = list(settlements.map((x) => [x[0], `${x[1]} ${bar(x[1], maxSettlement)}`]));

    const hours = Array.from({ length: 24 }, (_, hour) => [String(hour).padStart(2, '0') + ':00', data.filter((event) => event.event_at && new Date(event.event_at).getHours() === hour).length]);
    const maxHour = Math.max(1, ...hours.map((x) => x[1]));
    q('#uavHours').innerHTML = list(hours.map((x) => [x[0], `${x[1]} ${bar(x[1], maxHour)}`]));

    const recent = [...data].filter((event) => event.event_at).sort((a, b) => new Date(b.event_at) - new Date(a.event_at)).slice(0, 60);
    q('#uavTimeline').innerHTML = recent.length ? `<div class="timeline">${recent.map((event) => {
      const date = new Date(event.event_at);
      const uav = one(event.uav)?.uav_name || 'Тип не визначено';
      const station = one(event.station)?.station_name || 'Станція не визначена';
      const settlement = one(event.settlement)?.name || 'Населений пункт не визначено';
      const result = event.is_suppressed ? 'подавлено' : event.is_detected ? 'виявлено' : event.is_cover ? 'прикриття' : (event.result_normalized || 'подія');
      return `<div class="event"><div class="event-time">${date.toLocaleDateString('uk-UA')}<br>${date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}</div><div class="event-rail"></div><div class="event-body"><b>${esc(uav)} <span class="badge ${event.is_suppressed ? 'ok' : 'warn'}">${esc(result)}</span></b><span>${esc(station)} · ${esc(settlement)}${event.azimuth != null ? ` · азимут ${esc(event.azimuth)}°` : ''}</span></div></div>`;
    }).join('')}</div>` : '<p class="muted">Подій за обраним фільтром немає.</p>';
  }

  async function run() {
    q('#status').textContent = 'Завантажую пов’язані дані та розраховую показники...';
    try {
      if (!state.sb) initSupabase();
      const eventSelect = `id,raw_id,batch_id,event_at,azimuth,station_id,uav_type_id,uav_id,settlement_id,result_raw,result_normalized,is_verified,verified_by,verified_at,is_detected,is_suppressed,is_cover,created_at,uav:dict_uav!norm_word_events_uav_type_id_fkey(id,uav_name,uav_category,side),station:dict_stations!norm_word_events_station_id_fkey(id,station_name,station_code),settlement:dict_settlements!norm_word_events_settlement_id_fkey(id,name,district,region,hromada_name,lat,lon,mgrs)`;
      const coverSelect = `id,object_code,object_name,object_type,type_code,mgrs,lat,lon,priority,is_active,unit_id,settlement_id,coordinate_revision_status,coordinate_revision_note,note,unit:dict_units!dict_cover_objects_unit_id_fkey(unit_name,short_name),settlement:dict_settlements!dict_cover_objects_settlement_id_fkey(name,district,region,hromada_name,lat,lon,mgrs)`;
      const stationSelect = `id,station_name,station_code,status_text,lat,lon,mgrs,coverage_radius_km,is_active,station_type_id,unit_id,settlement_id,note,station_type:dict_station_types!dict_stations_station_type_id_fkey(type_name,category),unit:dict_units!dict_stations_unit_id_fkey(unit_name,short_name),settlement:dict_settlements!dict_stations_settlement_id_fkey(name,district,region,hromada_name)`;
      const [cover, stations, requestCount, eventCount, requests, events] = await Promise.all([
        rows('dict_cover_objects', coverSelect, 3000),
        rows('dict_stations', stationSelect, 1200),
        count('norm_excel_requests'),
        count('norm_word_events'),
        rows('norm_excel_requests', '*', 5000).catch(() => []),
        rowsPaged('norm_word_events', eventSelect, 50000, 1000)
      ]);

      state.cover = cover;
      state.stations = stations;
      state.requests = requests;
      state.events = events;
      state.loadedAt = new Date();

      const active = cover.filter((row) => row.is_active !== false);
      const activeStations = stations.filter((row) => row.is_active !== false);
      const objectsWithGeo = active.filter(geo);
      const stationsWithGeo = activeStations.filter(geo);
      const vp = active.filter((row) => String(row.object_type || row.type_code || '').toUpperCase().includes('ВП') || String(row.type_code || '').toUpperCase() === 'VP');
      const sp = active.filter((row) => String(row.object_type || row.type_code || '').toUpperCase().includes('СП') || String(row.type_code || '').toUpperCase() === 'SP');
      const covered = [], uncovered = [];

      objectsWithGeo.forEach((object) => {
        const hits = stationsWithGeo.map((station) => ({ station, distance: km(object, station), radius: +station.coverage_radius_km || 15 })).filter((item) => item.distance <= item.radius).sort((a, b) => a.distance - b.distance);
        const nearest = stationsWithGeo.map((station) => ({ station, distance: km(object, station) })).sort((a, b) => a.distance - b.distance)[0];
        (hits.length ? covered : uncovered).push({ ...object, hits, nearest });
      });

      const multi = covered.filter((object) => object.hits.length > 1);
      const stationCoverage = stationsWithGeo.map((station) => {
        const hit = objectsWithGeo.map((object) => ({ object, distance: km(object, station) })).filter((item) => item.distance <= (+station.coverage_radius_km || 15));
        return { ...station, count: hit.length, far: Math.max(0, ...hit.map((item) => item.distance)), avg: hit.length ? hit.reduce((sum, item) => sum + item.distance, 0) / hit.length : 0 };
      }).sort((a, b) => b.count - a.count);

      const maxLoad = Math.max(1, ...stationCoverage.map((station) => station.count));
      const detected = events.filter((event) => event.is_detected).length;
      const suppressed = events.filter((event) => event.is_suppressed).length;
      const requestText = requests.map((row) => JSON.stringify(row).toLowerCase()).join('\n');
      const coverRequests = (requestText.match(/прикрит/g) || []).length;
      const corridorRequests = (requestText.match(/коридор/g) || []).length;
      const uniqueUav = new Set(events.map((event) => event.uav_type_id).filter(Boolean)).size;
      const geoEvents = events.filter((event) => geo(one(event.settlement) || {})).length;

      kpi([
        ['Активні ВП/СП', active.length, `ВП: ${vp.length} · СП: ${sp.length}`],
        ['Покрито', covered.length, `${pct(covered.length, objectsWithGeo.length)} від об’єктів`],
        ['Неприкрито', uncovered.length, 'потребують рішення'],
        ['Активні станції', activeStations.length, `з координатами: ${stationsWithGeo.length}`],
        ['Події БпЛА', eventCount, `типів: ${uniqueUav}`],
        ['Виявлено', detected, `${pct(detected, eventCount)} від подій`],
        ['Подавлено', suppressed, `${pct(suppressed, eventCount)} від подій`],
        ['З геоприв’язкою', geoEvents, `${pct(geoEvents, eventCount)} від подій`]
      ]);

      q('#summary').innerHTML = table([
        ['Покриття системи', `${covered.length} / ${objectsWithGeo.length} (${pct(covered.length, objectsWithGeo.length)})`],
        ['Об’єкти без координат', active.length - objectsWithGeo.length],
        ['Станції без координат', activeStations.length - stationsWithGeo.length],
        ['Події з визначеним БпЛА', events.filter((event) => event.uav_type_id).length],
        ['Події з визначеною станцією', events.filter((event) => event.station_id).length],
        ['Події з визначеним населеним пунктом', events.filter((event) => event.settlement_id).length],
        ['Критичний показник', `<span class="${riskClass(uncovered.length)}">${uncovered.length} неприкритих об’єктів</span>`]
      ]);

      q('#uncovered').innerHTML = list(uncovered.slice(0, 50).map((object) => [object.object_name, `${esc(object.object_type || object.type_code || '')} · найближча: ${esc(object.nearest?.station?.station_name || '—')} ${object.nearest ? `${Math.round(object.nearest.distance * 10) / 10} км` : ''}`]));
      q('#stationCoverage').innerHTML = list(stationCoverage.slice(0, 30).map((station) => [station.station_name || station.station_code || 'Станція', `${station.count} об’єктів · сер. ${Math.round(station.avg * 10) / 10} км · max ${Math.round(station.far * 10) / 10} км ${bar(station.count, maxLoad)}`]));
      q('#multiCoverage').innerHTML = list(multi.slice(0, 40).map((object) => [object.object_name, `${object.hits.length} станції · найближча ${esc(object.hits[0]?.station?.station_name || '—')} (${Math.round((object.hits[0]?.distance || 0) * 10) / 10} км)`]));
      q('#stationLoad').innerHTML = list(stationCoverage.slice(0, 40).map((station) => [station.station_name || station.station_code || 'Станція', `${station.count} об’єктів у радіусі · ${station.count > Math.max(8, Math.round(covered.length / Math.max(1, stationsWithGeo.length) * 1.6)) ? '<span class="risk-high">перевантаження</span>' : '<span class="risk-low">норма</span>'}`]));
      q('#combatWork').innerHTML = table([
        ['Заявки Excel', requestCount],
        ['Події Word', eventCount],
        ['Виявлення', detected],
        ['Подавлення', suppressed],
        ['Частка подій із подавленням', pct(suppressed, eventCount)],
        ['Заявки на прикриття ≈', coverRequests],
        ['Заявки на коридор ≈', corridorRequests]
      ]);

      const recommendations = [];
      if (uncovered.length) recommendations.push(['Закрити неприкриті об’єкти', `У системі ${uncovered.length} об’єктів поза радіусами активних станцій.`]);
      const noUav = events.filter((event) => !event.uav_type_id).length;
      const noStation = events.filter((event) => !event.station_id).length;
      const noSettlement = events.filter((event) => !event.settlement_id).length;
      if (noUav) recommendations.push(['Уточнити типи БпЛА', `${noUav} подій не мають зв’язку з довідником БпЛА.`]);
      if (noStation) recommendations.push(['Уточнити станції', `${noStation} подій не прив’язані до станції.`]);
      if (noSettlement) recommendations.push(['Уточнити географію', `${noSettlement} подій не прив’язані до населеного пункту.`]);
      if (!recommendations.length) recommendations.push(['Система стабільна', 'Критичних прогалин у даних не виявлено.']);
      q('#recs').innerHTML = recommendations.map((item) => `<div class="recommendation"><b>${esc(item[0])}</b><span>${esc(item[1])}</span></div>`).join('');
      q('#planning').innerHTML = table([
        ['БпЛА', 'використовувати тип, категорію, дату/час, станцію, населений пункт та результат'],
        ['Геоаналіз', 'будувати теплокарту за координатами dict_settlements'],
        ['Ефективність', 'порівнювати is_detected та is_suppressed по станціях і типах БпЛА'],
        ['Якість даних', 'контролювати події без uav_type_id, station_id або settlement_id']
      ]);

      const stationOptions = group(events, (event) => one(event.station)?.station_name).filter((x) => x[0] !== 'Невідомо');
      const uavOptions = group(events, (event) => one(event.uav)?.uav_name).filter((x) => x[0] !== 'Невідомо');
      q('#uavStation').innerHTML = '<option value="all">Усі станції</option>' + stationOptions.map((item) => {
        const event = events.find((row) => one(row.station)?.station_name === item[0]);
        return `<option value="${esc(event?.station_id)}">${esc(item[0])}</option>`;
      }).join('');
      q('#uavType').innerHTML = '<option value="all">Усі типи БпЛА</option>' + uavOptions.map((item) => {
        const event = events.find((row) => one(row.uav)?.uav_name === item[0]);
        return `<option value="${esc(event?.uav_type_id)}">${esc(item[0])}</option>`;
      }).join('');

      renderUav();
      q('#status').textContent = `Оновлено: ${new Date().toLocaleString('uk-UA')} · завантажено ${events.length} пов’язаних подій`;
      readyResolve(state);
      document.dispatchEvent(new CustomEvent('vector-analytics-ready', { detail: state }));
      return state;
    } catch (error) {
      console.error(error);
      q('#status').innerHTML = `<span class="err">${esc(error.message || error)}</span>`;
      throw error;
    }
  }

  qa('.tab').forEach((tab) => tab.addEventListener('click', () => setView(tab.dataset.view)));
  ['uavPeriod', 'uavStation', 'uavType'].forEach((id) => q(`#${id}`).addEventListener('change', renderUav));
  q('#refresh').addEventListener('click', run);

  window.VectorAnalytics = {
    state,
    ready,
    run,
    rows,
    rowsPaged,
    count,
    helpers: { one, geo, km, group, pct, esc }
  };

  run().catch(() => {});
})();
