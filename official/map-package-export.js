(() => {
  'use strict';

  if (window.__vectorMapPackageExport?.destroy) window.__vectorMapPackageExport.destroy();
  document.querySelector('#mapPackageBtn')?.remove();
  document.querySelector('#mapPackageModal')?.remove();
  document.querySelector('#mapPackageCss')?.remove();

  const VERSION = '20260712-v1';
  const SUPABASE_URL = window.VECTOR_SUPABASE_URL || 'https://vfshxogiuaefrgppuypt.supabase.co';
  const SUPABASE_KEY = window.VECTOR_SUPABASE_KEY || 'sb_publishable_yenD-zpmlFuhKKnojukBZg_z7pr_jzg';
  const BASEMAPS = {
    light: { label: 'Світла', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', maxZoom: 20 },
    dark: { label: 'Темна', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', maxZoom: 20 },
    roads: { label: 'Дороги', url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', maxZoom: 20 },
    satellite: { label: 'Супутник', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', maxZoom: 19 },
    none: { label: 'Без підкладки', url: '', maxZoom: 20 }
  };
  const COLORS = {
    uav: '#3B82F6', fpv: '#2563EB', wing: '#8B5CF6', kab: '#EF4444', other: '#64748B',
    detected: '#22C55E', suppressed: '#F97316', both: '#D78219', cover: '#38BDF8',
    station: '#16A34A', radius: '#22C55E', vp: '#EF4444', sp: '#FACC15', route: '#F97316', point: '#EC4899', settlement: '#94A3B8'
  };
  const GROUPS = {
    general: { folder: '00_Загальне', label: 'Загальне' },
    uav: { folder: '01_БпЛА', label: 'БпЛА' },
    stations: { folder: '02_Станції', label: 'Станції' },
    cover: { folder: '03_ВП_СП', label: 'ВП/СП' },
    routes: { folder: '04_Маршрути', label: 'Маршрути' },
    points: { folder: '05_Пункти', label: 'Пункти' }
  };

  const STATIC_MAPS = [
    { id:'overview', group:'general', order:1, name:'Загальна оперативна обстановка', file:'01_Загальна_оперативна_обстановка.png', pack:'basic', layers:['stations','coverage','coverObjects','routes','points','uav','settlements'] },
    { id:'critical', group:'general', order:2, name:'Критичні зони', file:'02_Критичні_зони.png', pack:'basic', layers:['heat','stations','coverage','uncovered','routesRisk'] },
    { id:'uav_heat', group:'uav', order:1, name:'Теплокарта подій БпЛА', file:'01_Теплокарта_подій_БпЛА.png', pack:'basic', layers:['heat','settlements'] },
    { id:'uav_categories', group:'uav', order:2, name:'БпЛА за категоріями', file:'02_БпЛА_за_категоріями.png', pack:'basic', layers:['uavCategories','stations'] },
    { id:'uav_results', group:'uav', order:3, name:'Результати бойової роботи', file:'03_Результати_бойової_роботи.png', pack:'basic', layers:['uavResults','stations'] },
    { id:'station_radius', group:'stations', order:1, name:'Станції та радіуси', file:'01_Станції_та_радіуси.png', pack:'basic', layers:['stations','radii','coverObjects'] },
    { id:'station_contour', group:'stations', order:2, name:'Контур покриття', file:'02_Контур_покриття.png', pack:'basic', layers:['coverage','stations','coverObjects'] },
    { id:'station_load', group:'stations', order:3, name:'Навантаження станцій', file:'03_Навантаження_станцій.png', pack:'basic', layers:['stationLoad','coverage'] },
    { id:'cover_locations', group:'cover', order:1, name:'Розташування ВП і СП', file:'01_Розташування_ВП_СП.png', pack:'basic', layers:['coverObjects','stations','settlements'] },
    { id:'cover_status', group:'cover', order:2, name:'Покриття ВП і СП', file:'02_Покриття_ВП_СП.png', pack:'basic', layers:['coverStatus','stations','coverage'] },
    { id:'cover_critical', group:'cover', order:3, name:'Критичні неприкриті ВП і СП', file:'03_Критичні_неприкриті_ВП_СП.png', pack:'basic', layers:['uncovered','nearestLines','stations','heat'] },
    { id:'routes_points', group:'routes', order:1, name:'Маршрути та пункти', file:'01_Маршрути_та_пункти.png', pack:'basic', layers:['routes','points','stations','settlements'] },
    { id:'routes_coverage', group:'routes', order:2, name:'Маршрути в зоні покриття', file:'02_Маршрути_в_зоні_покриття.png', pack:'basic', layers:['routesCoverage','coverage','stations'] },
    { id:'routes_uav', group:'routes', order:3, name:'Маршрути та активність БпЛА', file:'03_Маршрути_та_активність_БпЛА.png', pack:'basic', layers:['routes','heat','stations','coverage'] },
    { id:'points_types', group:'points', order:1, name:'Пункти за типами', file:'01_Пункти_за_типами.png', pack:'basic', layers:['pointsTypes','coverObjects','stations'] },
    { id:'uav_day', group:'uav', order:4, name:'Денна активність БпЛА', file:'04_Денна_активність.png', pack:'expanded', layers:['heat','uav'], timeFilter:'day' },
    { id:'uav_night', group:'uav', order:5, name:'Нічна активність БпЛА', file:'05_Нічна_активність.png', pack:'expanded', layers:['heat','uav'], timeFilter:'night' },
    { id:'uav_azimuth', group:'uav', order:6, name:'Азимути подій БпЛА', file:'06_Азимути_подій.png', pack:'expanded', layers:['azimuths','stations'] },
    { id:'station_effectiveness', group:'stations', order:4, name:'Результативність станцій', file:'04_Результативність_станцій.png', pack:'expanded', layers:['stationEffectiveness','coverage'] },
    { id:'cover_double', group:'cover', order:4, name:'Подвійне покриття ВП і СП', file:'04_Подвійне_покриття.png', pack:'expanded', layers:['multiCover','stations','radii'] }
  ];

  let client = null;
  let dataCache = null;
  let catalog = [];
  let selected = new Set();
  let currentPreviewId = null;
  let abortRequested = false;
  let renderMapInstance = null;
  let renderRoot = null;
  let previewUrl = null;
  let cleanupFns = [];

  const q = (s, root = document) => root.querySelector(s);
  const qa = (s, root = document) => Array.from(root.querySelectorAll(s));
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const one = (v) => Array.isArray(v) ? v[0] : v;
  const validCoord = (x) => Number.isFinite(Number(x?.lat)) && Number.isFinite(Number(x?.lon ?? x?.lng));
  const ll = (x) => [Number(x.lat), Number(x.lon ?? x.lng)];
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const slug = (v) => String(v || 'map').normalize('NFKD').replace(/[\\/:*?"<>|]/g,'').replace(/\s+/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'').slice(0,90) || 'map';
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('uk-UA') : '—';
  const fmtDateTime = (d) => d ? new Date(d).toLocaleString('uk-UA') : '—';
  const periodLabel = () => `${fmtDate(q('#mpeFrom')?.value)} — ${fmtDate(q('#mpeTo')?.value)}`;
  const groupFolder = (def) => def.folder || GROUPS[def.group]?.folder || '99_Інше';

  function supabaseClient(){
    if (client) return client;
    if (!window.supabase?.createClient) throw new Error('Бібліотека Supabase не завантажена.');
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return client;
  }

  async function loadScript(src, test){
    if (test?.()) return;
    const base = src.split('?')[0];
    let script = document.querySelector(`script[src^="${base}"]`);
    if (!script) {
      script = document.createElement('script');
      script.src = src;
      script.async = true;
      document.head.appendChild(script);
    }
    await new Promise((resolve,reject) => {
      if (test?.()) return resolve();
      script.addEventListener('load',resolve,{once:true});
      script.addEventListener('error',()=>reject(new Error('Не вдалося завантажити '+src)),{once:true});
      setTimeout(()=>test?.()?resolve():reject(new Error('Тайм-аут завантаження '+src)),15000);
    });
  }

  async function ensureLibraries(){
    await loadScript('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',()=>Boolean(window.JSZip));
    await loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',()=>Boolean(window.html2canvas));
  }

  async function rowsPaged(table, select, maxRows=30000, pageSize=1000){
    const out=[]; const sb=supabaseClient();
    for(let from=0;from<maxRows;from+=pageSize){
      const {data,error}=await sb.from(table).select(select).range(from,from+pageSize-1);
      if(error) throw new Error(`${table}: ${error.message}`);
      out.push(...(data||[]));
      if(!data || data.length<pageSize) break;
    }
    return out;
  }

  async function rowsTry(attempts){
    let lastError=null;
    for(const attempt of attempts){
      try{
        const {data,error}=await supabaseClient().from(attempt.table).select(attempt.select||'*').limit(attempt.limit||5000);
        if(error) throw error;
        return data||[];
      }catch(error){ lastError=error; }
    }
    if(lastError) console.warn(lastError);
    return [];
  }

  async function loadData(force=false){
    if(dataCache && !force) return dataCache;
    setStatus('Завантаження даних із Supabase...');
    const eventSelect = `id,event_at,azimuth,station_id,uav_type_id,settlement_id,result_normalized,is_detected,is_suppressed,is_cover,uav:dict_uav!norm_word_events_uav_type_id_fkey(id,uav_name,uav_category,side),station:dict_stations!norm_word_events_station_id_fkey(id,station_name,station_code,lat,lon,coverage_radius_km),settlement:dict_settlements!norm_word_events_settlement_id_fkey(id,name,district,region,hromada_name,lat,lon,mgrs)`;
    const [events,stations,coverObjects,routes,points] = await Promise.all([
      rowsPaged('norm_word_events',eventSelect,30000,1000),
      rowsTry([{table:'dict_stations',select:'id,station_name,station_code,status_text,lat,lon,mgrs,coverage_radius_km,is_active,note',limit:1500}]),
      rowsTry([{table:'dict_cover_objects',select:'id,object_code,object_name,object_type,type_code,lat,lon,mgrs,priority,is_active,note',limit:5000}]),
      rowsTry([
        {table:'dict_routes',select:'id,route_code,route_name,route_purpose,route_status,is_active,note,from:dict_settlements!dict_routes_from_settlement_id_fkey(id,name,lat,lon),to:dict_settlements!dict_routes_to_settlement_id_fkey(id,name,lat,lon)',limit:3000},
        {table:'map_routes',select:'*',limit:3000}
      ]),
      rowsTry([
        {table:'dict_map_points',select:'id,point_code,point_name,point_type,lat,lon,mgrs,is_active,note,settlement:dict_settlements(id,name)',limit:3000},
        {table:'map_points',select:'*',limit:3000}
      ])
    ]);
    dataCache={events,stations,coverObjects,routes,points,loadedAt:new Date().toISOString()};
    return dataCache;
  }

  function normalizeRoutes(rows){
    return (rows||[]).map(r=>{
      const from=one(r.from),to=one(r.to);
      return {
        id:r.id, name:r.route_name||r.name||r.route_code||'Маршрут', purpose:r.route_purpose||r.purpose||'', status:r.route_status||r.status||'', active:r.is_active!==false,
        fromName:from?.name||r.from_name||'', toName:to?.name||r.to_name||'',
        fromLat:Number(from?.lat??r.from_lat), fromLon:Number(from?.lon??r.from_lon), toLat:Number(to?.lat??r.to_lat), toLon:Number(to?.lon??r.to_lon)
      };
    }).filter(r=>[r.fromLat,r.fromLon,r.toLat,r.toLon].every(Number.isFinite));
  }

  function normalizePoints(rows){
    return (rows||[]).map(p=>({
      id:p.id,name:p.point_name||p.name||p.point_code||'Пункт',type:p.point_type||p.type||'Інше',lat:Number(p.lat),lon:Number(p.lon),active:p.is_active!==false,note:p.note||''
    })).filter(validCoord);
  }

  function dateRange(){
    const from=q('#mpeFrom')?.value; const to=q('#mpeTo')?.value;
    if(!from||!to) throw new Error('Оберіть початок і кінець періоду.');
    const start=new Date(`${from}T00:00:00`); const end=new Date(`${to}T23:59:59.999`);
    if(start>end) throw new Error('Початкова дата пізніша за кінцеву.');
    return {start,end,from,to};
  }

  function eventCoords(event){
    const settlement=one(event.settlement); if(validCoord(settlement)) return {lat:Number(settlement.lat),lon:Number(settlement.lon)};
    const station=one(event.station); if(validCoord(station)) return {lat:Number(station.lat),lon:Number(station.lon)};
    return null;
  }

  function filterEvents(events,def){
    const {start,end}=dateRange();
    let out=(events||[]).filter(e=>e.event_at && new Date(e.event_at)>=start && new Date(e.event_at)<=end);
    if(def.timeFilter){
      out=out.filter(e=>{const h=new Date(e.event_at).getHours();return def.timeFilter==='day'?(h>=6&&h<18):(h<6||h>=18)});
    }
    if(def.uavTypeId) out=out.filter(e=>String(e.uav_type_id)===String(def.uavTypeId));
    if(def.stationId) out=out.filter(e=>String(e.station_id)===String(def.stationId));
    return out;
  }

  function haversine(a,b){
    const R=6371,dLat=(Number(b.lat)-Number(a.lat))*Math.PI/180,dLon=(Number(b.lon)-Number(a.lon))*Math.PI/180,la1=Number(a.lat)*Math.PI/180,la2=Number(b.lat)*Math.PI/180;
    const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.sqrt(h));
  }

  function activeStations(data){return (data.stations||[]).filter(s=>s.is_active!==false&&validCoord(s));}
  function activeCover(data){return (data.coverObjects||[]).filter(o=>o.is_active!==false&&validCoord(o));}
  function coverAnalysis(data){
    const stations=activeStations(data),objects=activeCover(data);
    return objects.map(o=>{
      const hits=stations.map(s=>({station:s,distance:haversine(o,s),radius:Number(s.coverage_radius_km)||15})).filter(x=>x.distance<=x.radius).sort((a,b)=>a.distance-b.distance);
      const nearest=stations.map(s=>({station:s,distance:haversine(o,s)})).sort((a,b)=>a.distance-b.distance)[0]||null;
      return {...o,hits,nearest,covered:hits.length>0};
    });
  }

  function routeCoverage(route,stations){
    let covered=0,total=21;
    for(let i=0;i<total;i++){
      const t=i/(total-1),p={lat:route.fromLat+(route.toLat-route.fromLat)*t,lon:route.fromLon+(route.toLon-route.fromLon)*t};
      if(stations.some(s=>haversine(p,s)<=(Number(s.coverage_radius_km)||15))) covered++;
    }
    const ratio=covered/total;
    return ratio>=.95?'Повністю':ratio>=.2?'Частково':'Поза покриттям';
  }

  function buildCatalog(data){
    const eventsByType=new Map();
    data.events.forEach(e=>{if(!e.uav_type_id)return;const u=one(e.uav)||{};const item=eventsByType.get(e.uav_type_id)||{id:e.uav_type_id,name:u.uav_name||'Тип БпЛА',count:0};item.count++;eventsByType.set(e.uav_type_id,item)});
    const typeMaps=[...eventsByType.values()].sort((a,b)=>b.count-a.count).map((u,index)=>({
      id:`uav_type_${u.id}`,group:'uav',folder:'01_БпЛА/За_типами',order:100+index,name:`БпЛА — ${u.name}`,file:`${String(index+1).padStart(2,'0')}_${slug(u.name)}.png`,pack:'full',layers:['heat','uavResults','stations'],uavTypeId:u.id,dynamic:true
    }));
    const stationEvents=new Map();
    data.events.forEach(e=>{if(!e.station_id)return;stationEvents.set(e.station_id,(stationEvents.get(e.station_id)||0)+1)});
    const stationMaps=activeStations(data).filter(s=>stationEvents.has(s.id)).sort((a,b)=>(stationEvents.get(b.id)||0)-(stationEvents.get(a.id)||0)).map((s,index)=>({
      id:`station_${s.id}`,group:'stations',folder:'02_Станції/Окремі_станції',order:100+index,name:`Станція — ${s.station_name||s.station_code}`,file:`${String(index+1).padStart(2,'0')}_${slug(s.station_name||s.station_code)}.png`,pack:'full',layers:['stationFocus','radii','coverObjects','uavResults','routes'],stationId:s.id,dynamic:true
    }));
    catalog=[...STATIC_MAPS,...typeMaps,...stationMaps];
    return catalog;
  }

  function packageSelected(pack){
    const allowed=pack==='basic'?['basic']:pack==='expanded'?['basic','expanded']:['basic','expanded','full'];
    selected=new Set(catalog.filter(d=>allowed.includes(d.pack)).map(d=>d.id));
    renderCatalog();
  }

  function setStatus(text,type=''){
    const el=q('#mpeStatus'); if(!el)return; el.textContent=text; el.className=`mpe-status${type?` ${type}`:''}`;
  }

  function ensureCss(){
    if(q('#mapPackageCss'))return;
    const style=document.createElement('style'); style.id='mapPackageCss'; style.textContent=`
      .mapPackageBtn{position:fixed!important;right:92px!important;top:620px!important;width:54px!important;height:54px!important;z-index:100002!important;border:1px solid rgba(255,255,255,.18);background:rgba(9,15,26,.96);color:#fff;border-radius:14px;cursor:pointer;font:900 14px Rajdhani,Arial;display:flex!important;align-items:center;justify-content:center;box-shadow:0 16px 38px rgba(0,0,0,.42)}
      .mapPackageBtn:hover,.mapPackageBtn.is-active{border-color:#d78219;color:#d78219}.mapPackageModal{position:fixed;inset:0;z-index:210000;display:none;align-items:center;justify-content:center;background:rgba(4,9,18,.72);backdrop-filter:blur(6px);font-family:Rajdhani,Arial,sans-serif}.mapPackageModal.open{display:flex}
      .mpe-panel{width:min(1600px,96vw);height:min(920px,94vh);display:grid;grid-template-rows:auto auto 1fr auto;gap:12px;padding:18px;border:1px solid rgba(215,130,25,.38);border-radius:22px;background:linear-gradient(145deg,#0e1d3d,#081226);color:#fff;box-shadow:0 30px 90px rgba(0,0,0,.65)}
      .mpe-head,.mpe-toolbar,.mpe-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.mpe-head h2{margin:0;font-size:30px;text-transform:uppercase;letter-spacing:.08em}.mpe-head p{margin:3px 0 0;color:#aebbd0}.mpe-close{border:0;background:none;color:#fff;font-size:30px;cursor:pointer}.mpe-tabs{display:flex;gap:8px}.mpe-tab,.mpe-btn,.mpe-chip{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.055);color:#fff;padding:10px 14px;border-radius:10px;cursor:pointer;font:800 14px Rajdhani,Arial;text-transform:uppercase;letter-spacing:.08em}.mpe-tab.active,.mpe-btn.primary,.mpe-chip.active{border-color:#d78219;background:rgba(215,130,25,.18);color:#ffb055}.mpe-btn.danger{border-color:#ef4444;color:#fecaca}.mpe-controls{display:flex;gap:10px;align-items:end;flex-wrap:wrap}.mpe-field{display:grid;gap:5px;color:#c9d5e7;font-size:13px}.mpe-field input,.mpe-field select{min-width:145px;padding:10px 12px;border:1px solid rgba(255,255,255,.12);border-radius:9px;background:#08142d;color:#fff;font:700 14px Rajdhani,Arial}.mpe-body{min-height:0;display:grid;grid-template-columns:430px 1fr;gap:14px}.mpe-sidebar,.mpe-preview{min-height:0;border:1px solid rgba(255,255,255,.1);border-radius:16px;background:rgba(255,255,255,.035);overflow:hidden}.mpe-sidebar{display:grid;grid-template-rows:auto 1fr}.mpe-filterbar{padding:10px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;gap:6px;flex-wrap:wrap}.mpe-list{overflow:auto;padding:10px}.mpe-group{margin-bottom:12px;border:1px solid rgba(255,255,255,.08);border-radius:12px;overflow:hidden}.mpe-group-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;background:rgba(255,255,255,.06);font-weight:900;text-transform:uppercase;letter-spacing:.08em}.mpe-group-head label{display:flex;gap:8px;align-items:center}.mpe-map-row{display:grid;grid-template-columns:24px 1fr auto;gap:8px;align-items:center;padding:9px 11px;border-top:1px solid rgba(255,255,255,.06);cursor:pointer}.mpe-map-row:hover,.mpe-map-row.active{background:rgba(215,130,25,.10)}.mpe-map-row small{display:block;color:#9fb0c9}.mpe-eye{border:0;background:none;color:#ffb055;cursor:pointer;font-size:17px}.mpe-preview{position:relative;display:grid;grid-template-rows:auto 1fr}.mpe-preview-head{padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;gap:10px;align-items:center}.mpe-preview-stage{position:relative;min-height:0;background:#e5e7eb;display:grid;place-items:center}.mpe-preview-stage img{max-width:100%;max-height:100%;display:block}.mpe-preview-placeholder{color:#334155;text-align:center;padding:30px}.mpe-mode-quick .mpe-sidebar{display:none}.mpe-mode-quick .mpe-body{grid-template-columns:1fr}.mpe-quick{display:none;padding:28px;overflow:auto}.mpe-mode-quick .mpe-quick{display:block}.mpe-mode-quick .mpe-preview-head,.mpe-mode-quick .mpe-preview-stage{display:none}.mpe-pack-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.mpe-pack{padding:20px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.045);cursor:pointer}.mpe-pack.active{border-color:#d78219;background:rgba(215,130,25,.12)}.mpe-pack h3{margin:0 0 8px;font-size:23px}.mpe-pack p{color:#aebbd0}.mpe-status{color:#aebbd0}.mpe-status.ok{color:#86efac}.mpe-status.err{color:#fecaca}.mpe-progress{height:8px;flex:1;min-width:180px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden}.mpe-progress i{display:block;height:100%;width:0;background:#d78219;transition:width .2s}.mpe-actions{padding-top:4px}.mpe-actions-left,.mpe-actions-right{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      #mpeRenderRoot{position:fixed;left:-20000px;top:0;background:#eef2f7;overflow:hidden;z-index:-1}.mpe-map-canvas{position:absolute;inset:0}.mpe-overlay{position:absolute;inset:0;z-index:9000;pointer-events:none}.mpe-title{position:absolute;left:26px;top:22px;max-width:72%;padding:12px 18px;border-radius:10px;background:rgba(8,18,32,.82);color:#fff;font:900 31px Rajdhani,Arial}.mpe-subtitle{position:absolute;left:26px;top:82px;padding:8px 13px;border-radius:9px;background:rgba(8,18,32,.76);color:#dbe7ff;font:700 17px Rajdhani,Arial}.mpe-legend{position:absolute;left:26px;top:132px;max-width:310px;max-height:350px;overflow:hidden;padding:13px 16px;border-radius:12px;background:rgba(8,18,32,.78);color:#fff;font:700 15px Rajdhani,Arial}.mpe-legend b{display:block;margin-bottom:7px;text-transform:uppercase}.mpe-legend div{display:flex;align-items:center;gap:8px;margin:5px 0}.mpe-legend i{width:11px;height:11px;border-radius:50%;display:inline-block}.mpe-north{position:absolute;right:24px;top:22px;width:50px;height:68px;border-radius:12px;background:rgba(8,18,32,.8);color:#fff;text-align:center;font:900 14px Rajdhani,Arial;padding-top:35px}.mpe-north:before{content:'▲';position:absolute;top:7px;left:15px;font-size:24px}.mpe-kpi{position:absolute;left:26px;bottom:22px;display:flex;gap:8px}.mpe-kpi span{padding:9px 12px;border-radius:9px;background:rgba(8,18,32,.8);color:#fff;font:800 15px Rajdhani,Arial}.mpe-info{position:absolute;right:24px;bottom:22px;padding:10px 14px;border-radius:9px;background:rgba(8,18,32,.8);color:#fff;font:700 14px Rajdhani,Arial}.mpe-scale{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);padding:8px 15px;border-radius:9px;background:rgba(8,18,32,.8);color:#fff;font:900 18px Rajdhani,Arial}.mpe-grid{position:absolute;inset:0;z-index:8500;background-image:linear-gradient(rgba(51,65,85,.38) 1px,transparent 1px),linear-gradient(90deg,rgba(51,65,85,.38) 1px,transparent 1px);background-size:140px 140px}.mpe-heat{position:absolute;inset:0;z-index:460;pointer-events:none}
      @media(max-width:1000px){.mpe-body{grid-template-columns:1fr}.mpe-sidebar{max-height:330px}.mpe-pack-grid{grid-template-columns:1fr}.mpe-controls{max-height:180px;overflow:auto}.mpe-panel{height:96vh}.mpe-mode-quick .mpe-body{grid-template-columns:1fr}}
    `; document.head.appendChild(style);
  }

  function mountButton(){
    ensureCss(); let btn=q('#mapPackageBtn');
    if(!btn){btn=document.createElement('button');btn.id='mapPackageBtn';btn.className='mapPackageBtn';btn.type='button';btn.title='Пакетний експорт карт';btn.textContent='ZIP';btn.addEventListener('click',openModal);document.body.appendChild(btn)}
    btn.style.display='flex';
  }

  function createModal(){
    ensureCss(); let modal=q('#mapPackageModal'); if(modal)return modal;
    modal=document.createElement('section'); modal.id='mapPackageModal'; modal.className='mapPackageModal'; modal.setAttribute('aria-hidden','true');
    modal.innerHTML=`<div class="mpe-panel mpe-mode-quick">
      <div class="mpe-head"><div><h2>Пакетний експорт карт</h2><p>ZIP із тематичними папками, PNG-картами та службовими файлами.</p></div><div class="mpe-tabs"><button class="mpe-tab active" data-mode="quick">Швидкий експорт</button><button class="mpe-tab" data-mode="builder">Конструктор</button><button class="mpe-close" id="mpeClose">×</button></div></div>
      <div class="mpe-toolbar"><div class="mpe-controls"><label class="mpe-field">Від<input type="date" id="mpeFrom"></label><label class="mpe-field">До<input type="date" id="mpeTo"></label><label class="mpe-field">Підкладка<select id="mpeBasemap"><option value="light">Світла</option><option value="roads">Дороги</option><option value="dark">Темна</option><option value="satellite">Супутник</option><option value="none">Без підкладки</option></select></label><label class="mpe-field">Формат<select id="mpeSize"><option value="1920x1080">1920 × 1080</option><option value="3508x2480">A4 горизонтально</option></select></label><label class="mpe-field">Елементи<select id="mpeDecor"><option value="full">Повне оформлення</option><option value="compact">Без KPI та сітки</option><option value="clean">Тільки карта і назва</option></select></label></div><div><button class="mpe-btn" id="mpeReload">Оновити дані</button></div></div>
      <div class="mpe-body"><aside class="mpe-sidebar"><div class="mpe-filterbar"><button class="mpe-chip" data-select="all">Усі</button><button class="mpe-chip" data-select="none">Жодної</button><button class="mpe-chip" data-select="basic">Базовий</button><button class="mpe-chip" data-select="expanded">Розширений</button></div><div class="mpe-list" id="mpeList"></div></aside><section class="mpe-preview"><div class="mpe-quick"><div class="mpe-pack-grid"><article class="mpe-pack active" data-pack="basic"><h3>Базовий пакет</h3><p>15 головних карт: БпЛА, станції, ВП/СП, маршрути та пункти.</p><b id="mpeBasicCount">15 карт</b></article><article class="mpe-pack" data-pack="expanded"><h3>Розширений пакет</h3><p>Базові карти плюс денна/нічна активність, азимути, результативність і подвійне покриття.</p><b id="mpeExpandedCount">20 карт</b></article><article class="mpe-pack" data-pack="full"><h3>Повний пакет</h3><p>Усі карти плюс окремі зображення за типами БпЛА та кожною станцією.</p><b id="mpeFullCount">—</b></article></div></div><div class="mpe-preview-head"><div><b id="mpePreviewTitle">Оберіть карту</b><small id="mpePreviewMeta"></small></div><button class="mpe-btn" id="mpeRefreshPreview">Оновити прев’ю</button></div><div class="mpe-preview-stage" id="mpePreview"><div class="mpe-preview-placeholder">Натисніть кнопку перегляду біля потрібної карти.</div></div></section></div>
      <div class="mpe-actions"><div class="mpe-actions-left"><span class="mpe-status" id="mpeStatus">Готово.</span><div class="mpe-progress"><i id="mpeProgress"></i></div></div><div class="mpe-actions-right"><button class="mpe-btn danger" id="mpeCancel" style="display:none">Зупинити</button><button class="mpe-btn primary" id="mpeBuild">Сформувати ZIP</button></div></div>
    </div>`;
    document.body.appendChild(modal);
    q('#mpeClose',modal).onclick=closeModal;
    q('#mpeBuild',modal).onclick=buildZip;
    q('#mpeCancel',modal).onclick=()=>{abortRequested=true;setStatus('Зупиняю після поточної карти...')};
    q('#mpeReload',modal).onclick=async()=>{dataCache=null;await initialize(true)};
    q('#mpeRefreshPreview',modal).onclick=()=>currentPreviewId&&showPreview(currentPreviewId,true);
    qa('.mpe-tab',modal).forEach(btn=>btn.onclick=()=>setMode(btn.dataset.mode));
    qa('.mpe-pack',modal).forEach(card=>card.onclick=()=>{qa('.mpe-pack',modal).forEach(x=>x.classList.remove('active'));card.classList.add('active');packageSelected(card.dataset.pack)});
    qa('[data-select]',modal).forEach(btn=>btn.onclick=()=>{const mode=btn.dataset.select;if(mode==='all')selected=new Set(catalog.map(d=>d.id));else if(mode==='none')selected.clear();else packageSelected(mode);renderCatalog()});
    return modal;
  }

  function defaultDates(data){
    const dates=(data.events||[]).map(e=>e.event_at&&new Date(e.event_at)).filter(d=>d&&!Number.isNaN(d)).sort((a,b)=>a-b);
    const max=dates.at(-1)||new Date(), min=dates[0]||new Date(max.getTime()-30*86400000);
    q('#mpeFrom').value=min.toISOString().slice(0,10); q('#mpeTo').value=max.toISOString().slice(0,10);
  }

  async function openModal(){
    const modal=createModal(); modal.classList.add('open');modal.setAttribute('aria-hidden','false');q('#mapPackageBtn')?.classList.add('is-active');
    try{await initialize(false)}catch(error){console.error(error);setStatus(error.message||String(error),'err')}
  }
  function closeModal(){q('#mapPackageModal')?.classList.remove('open');q('#mapPackageModal')?.setAttribute('aria-hidden','true');q('#mapPackageBtn')?.classList.remove('is-active')}
  function setMode(mode){const panel=q('.mpe-panel');panel.classList.toggle('mpe-mode-quick',mode==='quick');qa('.mpe-tab').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));if(mode==='builder'&&!currentPreviewId){const first=catalog.find(d=>selected.has(d.id));if(first)showPreview(first.id)}}

  async function initialize(force){
    setStatus('Завантаження даних...');
    const data=await loadData(force); buildCatalog(data); if(!q('#mpeFrom').value)defaultDates(data); packageSelected(q('.mpe-pack.active')?.dataset.pack||'basic');
    q('#mpeFullCount').textContent=`${catalog.length} карт`; q('#mpeExpandedCount').textContent=`${catalog.filter(d=>['basic','expanded'].includes(d.pack)).length} карт`;
    setStatus(`Готово: ${data.events.length.toLocaleString('uk-UA')} подій, ${data.stations.length} станцій.`,'ok');
  }

  function renderCatalog(){
    const box=q('#mpeList');if(!box)return;
    box.innerHTML=Object.entries(GROUPS).map(([key,meta])=>{
      const maps=catalog.filter(d=>d.group===key).sort((a,b)=>a.order-b.order);if(!maps.length)return'';
      const chosen=maps.filter(d=>selected.has(d.id)).length;
      return `<section class="mpe-group"><div class="mpe-group-head"><label><input type="checkbox" data-group="${key}" ${chosen===maps.length?'checked':''}>${esc(meta.label)}</label><span>${chosen}/${maps.length}</span></div>${maps.map(d=>`<div class="mpe-map-row ${currentPreviewId===d.id?'active':''}" data-map-row="${esc(d.id)}"><input type="checkbox" data-map-check="${esc(d.id)}" ${selected.has(d.id)?'checked':''}><div><b>${esc(d.name)}</b><small>${esc(groupFolder(d))} · ${esc(d.pack)}</small></div><button class="mpe-eye" data-preview="${esc(d.id)}" title="Переглянути">◉</button></div>`).join('')}</section>`;
    }).join('');
    qa('[data-map-check]',box).forEach(input=>input.onchange=()=>{input.checked?selected.add(input.dataset.mapCheck):selected.delete(input.dataset.mapCheck);renderCatalog()});
    qa('[data-group]',box).forEach(input=>input.onchange=()=>{catalog.filter(d=>d.group===input.dataset.group).forEach(d=>input.checked?selected.add(d.id):selected.delete(d.id));renderCatalog()});
    qa('[data-preview]',box).forEach(btn=>btn.onclick=e=>{e.stopPropagation();showPreview(btn.dataset.preview)});
    qa('[data-map-row]',box).forEach(row=>row.onclick=e=>{if(e.target.matches('input,button'))return;showPreview(row.dataset.mapRow)});
  }

  function renderDimensions(){const [w,h]=q('#mpeSize').value.split('x').map(Number);const scale=Math.min(1,w>2200?2200/w:1);return{outputW:w,outputH:h,renderW:Math.round(w*scale),renderH:Math.round(h*scale)}}

  function createRenderRoot(width,height){
    if(renderMapInstance){try{renderMapInstance.remove()}catch{}renderMapInstance=null}
    renderRoot?.remove(); renderRoot=document.createElement('div');renderRoot.id='mpeRenderRoot';renderRoot.style.width=`${width}px`;renderRoot.style.height=`${height}px`;
    renderRoot.innerHTML='<div id="mpeLeaflet" class="mpe-map-canvas"></div><canvas id="mpeHeatCanvas" class="mpe-heat"></canvas><div class="mpe-overlay"><div class="mpe-grid" id="mpeGrid"></div><div class="mpe-title" id="mpeMapTitle"></div><div class="mpe-subtitle" id="mpeMapSubtitle"></div><div class="mpe-legend" id="mpeLegend"></div><div class="mpe-north" id="mpeNorth">N</div><div class="mpe-kpi" id="mpeKpi"></div><div class="mpe-scale" id="mpeScale"></div><div class="mpe-info" id="mpeInfo"></div></div>';
    document.body.appendChild(renderRoot); return renderRoot;
  }

  function tileReady(map,timeout=3500){
    return new Promise(resolve=>{let done=false,tiles=0;const finish=()=>{if(done)return;done=true;resolve()};map.eachLayer(l=>{if(l instanceof L.TileLayer){tiles++;l.once('load',finish);l.once('tileerror',()=>setTimeout(finish,250))}});if(!tiles)return finish();setTimeout(finish,timeout)});
  }

  function addPoint(bounds,p){if(validCoord(p))bounds.extend(ll(p))}
  function categoryColor(event){const name=(one(event.uav)?.uav_name||'').toLowerCase(),cat=(one(event.uav)?.uav_category||'').toLowerCase();if(name.includes('fpv')||cat.includes('fpv'))return COLORS.fpv;if(cat.includes('крил')||name.includes('зала')||name.includes('ланцет')||name.includes('крило'))return COLORS.wing;if(cat.includes('бомб')||name.includes('каб'))return COLORS.kab;return COLORS.other}
  function resultColor(event){if(event.is_detected&&event.is_suppressed)return COLORS.both;if(event.is_suppressed)return COLORS.suppressed;if(event.is_detected)return COLORS.detected;if(event.is_cover)return COLORS.cover;return COLORS.other}
  function objectType(o){const t=String(o.object_type||o.type_code||'').toUpperCase();return t.includes('ВП')||t==='VP'?'vp':t.includes('СП')||t==='SP'?'sp':'other'}

  function addCircle(map,bounds,p,color,radius=7,options={}){if(!validCoord(p))return null;const c=L.circleMarker(ll(p),{radius,color,fillColor:color,fillOpacity:options.fillOpacity??.82,weight:options.weight??2,opacity:options.opacity??.95,pane:options.pane}).addTo(map);addPoint(bounds,p);return c}
  function addLine(map,bounds,coords,color,width=4,dashArray=null,opacity=.85){const line=L.polyline(coords,{color,weight:width,opacity,dashArray,lineCap:'round',lineJoin:'round'}).addTo(map);coords.forEach(p=>bounds.extend(p));return line}

  function drawHeat(map,events){
    const canvas=q('#mpeHeatCanvas',renderRoot);const rect=renderRoot.getBoundingClientRect();canvas.width=Math.max(1,Math.round(rect.width));canvas.height=Math.max(1,Math.round(rect.height));const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.globalCompositeOperation='lighter';
    events.forEach(e=>{const p=eventCoords(e);if(!p)return;const pt=map.latLngToContainerPoint(ll(p));const r=38;const g=ctx.createRadialGradient(pt.x,pt.y,0,pt.x,pt.y,r);g.addColorStop(0,'rgba(255,72,0,.42)');g.addColorStop(.35,'rgba(255,160,0,.28)');g.addColorStop(.72,'rgba(255,230,80,.14)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(pt.x-r,pt.y-r,r*2,r*2)});ctx.globalCompositeOperation='source-over';
  }

  function addAzimuths(map,bounds,events,stations){
    const stationById=new Map(stations.map(s=>[String(s.id),s]));events.filter(e=>Number.isFinite(Number(e.azimuth))).slice(0,2200).forEach(e=>{const s=stationById.get(String(e.station_id))||one(e.station);if(!validCoord(s))return;const km=12,br=Number(e.azimuth)*Math.PI/180,lat=Number(s.lat)+km*Math.cos(br)/111,lon=Number(s.lon)+km*Math.sin(br)/(111*Math.cos(Number(s.lat)*Math.PI/180));addLine(map,bounds,[ll(s),[lat,lon]],resultColor(e),1,null,.2)});
  }

  function configureDecor(def,ctx){
    const decor=q('#mpeDecor').value;const full=decor==='full',compact=decor==='compact';q('#mpeMapTitle',renderRoot).textContent=def.name;q('#mpeMapSubtitle',renderRoot).textContent=`Період: ${periodLabel()}`;
    q('#mpeLegend',renderRoot).style.display=decor==='clean'?'none':'block';q('#mpeNorth',renderRoot).style.display=decor==='clean'?'none':'block';q('#mpeScale',renderRoot).style.display=decor==='clean'?'none':'block';q('#mpeInfo',renderRoot).style.display=decor==='clean'?'none':'block';q('#mpeKpi',renderRoot).style.display=full?'flex':'none';q('#mpeGrid',renderRoot).style.display=full?'block':'none';
    q('#mpeLegend',renderRoot).innerHTML=`<b>Умовні позначення</b>${ctx.legend.map(x=>`<div><i style="background:${x[1]}"></i>${esc(x[0])}</div>`).join('')}`;
    q('#mpeKpi',renderRoot).innerHTML=ctx.kpi.map(x=>`<span>${esc(x[0])}: ${esc(x[1])}</span>`).join('');
    q('#mpeInfo',renderRoot).textContent=`VECTOR · ${fmtDateTime(new Date())}`;
  }

  async function renderDefinition(def,forPreview=false){
    await ensureLibraries();const data=await loadData(false);const dims=renderDimensions();createRenderRoot(dims.renderW,dims.renderH);const basemap=BASEMAPS[q('#mpeBasemap').value]||BASEMAPS.light;
    const map=L.map('mpeLeaflet',{zoomControl:false,attributionControl:false,preferCanvas:true,keyboard:false,scrollWheelZoom:false,dragging:false,doubleClickZoom:false,zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false});renderMapInstance=map;
    map.setView([48.86,37.60],9);if(basemap.url)L.tileLayer(basemap.url,{maxZoom:basemap.maxZoom,crossOrigin:true,attribution:''}).addTo(map);
    const events=filterEvents(data.events,def),stations=activeStations(data),objects=coverAnalysis(data),routes=normalizeRoutes(data.routes).filter(r=>r.active),points=normalizePoints(data.points).filter(p=>p.active);const bounds=L.latLngBounds([]);const legend=[];const kpi=[];const layers=new Set(def.layers||[]);
    const addLegend=(name,color)=>{if(!legend.some(x=>x[0]===name))legend.push([name,color])};

    if(layers.has('radii')||layers.has('coverage')){stations.forEach(s=>{L.circle(ll(s),{radius:(Number(s.coverage_radius_km)||15)*1000,color:COLORS.radius,fillColor:COLORS.radius,fillOpacity:layers.has('coverage')?.08:.03,weight:layers.has('coverage')?2:1,opacity:.55}).addTo(map);addPoint(bounds,s)});addLegend('Зона покриття',COLORS.radius)}
    if(layers.has('stations')||layers.has('stationLoad')||layers.has('stationEffectiveness')||layers.has('stationFocus')){
      const counts=new Map(),det=new Map(),sup=new Map();events.forEach(e=>{if(!e.station_id)return;const id=String(e.station_id);counts.set(id,(counts.get(id)||0)+1);if(e.is_detected)det.set(id,(det.get(id)||0)+1);if(e.is_suppressed)sup.set(id,(sup.get(id)||0)+1)});const max=Math.max(1,...counts.values());
      stations.forEach(s=>{if(def.stationId&&String(s.id)!==String(def.stationId)&&layers.has('stationFocus'))return;let color=COLORS.station,r=8;if(layers.has('stationLoad'))r=7+18*Math.sqrt((counts.get(String(s.id))||0)/max);if(layers.has('stationEffectiveness')){const c=counts.get(String(s.id))||0;const rate=c?(sup.get(String(s.id))||0)/c:0;color=rate>.8?'#16A34A':rate>.5?'#F59E0B':'#EF4444';r=10+8*rate}if(layers.has('stationFocus')){color='#D78219';r=15}const c=addCircle(map,bounds,s,color,r);c?.bindTooltip(`${esc(s.station_name||s.station_code)} · ${counts.get(String(s.id))||0}`)});addLegend('Станції',COLORS.station)
    }
    if(layers.has('coverObjects')||layers.has('coverStatus')||layers.has('uncovered')||layers.has('multiCover')){
      objects.forEach(o=>{if(layers.has('uncovered')&&o.covered)return;if(layers.has('multiCover')&&o.hits.length<2)return;let color=objectType(o)==='vp'?COLORS.vp:objectType(o)==='sp'?COLORS.sp:COLORS.other;if(layers.has('coverStatus'))color=!o.covered?'#EF4444':o.hits.length>1?'#3B82F6':'#22C55E';if(layers.has('uncovered'))color='#EF4444';if(layers.has('multiCover'))color='#3B82F6';const c=addCircle(map,bounds,o,color,layers.has('uncovered')?11:8);c?.bindTooltip(`${esc(o.object_name||o.object_code)} · ${o.hits.length} станцій`)});addLegend(layers.has('coverStatus')?'Покриття ВП/СП':layers.has('uncovered')?'Неприкриті ВП/СП':layers.has('multiCover')?'Подвійне покриття':'ВП/СП',layers.has('coverStatus')?'#22C55E':layers.has('multiCover')?'#3B82F6':'#EF4444')
    }
    if(layers.has('nearestLines'))objects.filter(o=>!o.covered&&o.nearest).forEach(o=>addLine(map,bounds,[ll(o),ll(o.nearest.station)],'#EF4444',2,'8 7',.75));
    if(layers.has('routes')||layers.has('routesCoverage')||layers.has('routesRisk')){
      routes.forEach(r=>{let color=COLORS.route,width=4;if(layers.has('routesCoverage')||layers.has('routesRisk')){const status=routeCoverage(r,stations);color=status==='Повністю'?'#22C55E':status==='Частково'?'#F59E0B':'#EF4444';if(layers.has('routesRisk')&&status==='Повністю')return;width=status==='Поза покриттям'?6:4}addLine(map,bounds,[[r.fromLat,r.fromLon],[r.toLat,r.toLon]],color,width);});addLegend(layers.has('routesCoverage')?'Маршрути за покриттям':layers.has('routesRisk')?'Критичні маршрути':'Маршрути',layers.has('routesCoverage')?'#F59E0B':COLORS.route)
    }
    if(layers.has('points')||layers.has('pointsTypes')){const types=[...new Set(points.map(p=>p.type))],palette=['#EC4899','#A855F7','#06B6D4','#F97316','#84CC16','#EAB308'];points.forEach(p=>{const color=layers.has('pointsTypes')?palette[Math.max(0,types.indexOf(p.type))%palette.length]:COLORS.point;addCircle(map,bounds,p,color,8)});addLegend('Пункти',COLORS.point)}
    if(layers.has('settlements')){const seen=new Set();events.forEach(e=>{const s=one(e.settlement);if(!validCoord(s)||seen.has(s.id||s.name))return;seen.add(s.id||s.name);addCircle(map,bounds,s,COLORS.settlement,3,{fillOpacity:.35,weight:1})});addLegend('Населені пункти',COLORS.settlement)}
    if(layers.has('uav')||layers.has('uavCategories')||layers.has('uavResults')){events.forEach(e=>{const p=eventCoords(e);if(!p)return;const color=layers.has('uavCategories')?categoryColor(e):layers.has('uavResults')?resultColor(e):COLORS.uav;addCircle(map,bounds,p,color,layers.has('uav')?4:5,{fillOpacity:.55,weight:1})});addLegend(layers.has('uavCategories')?'Категорії БпЛА':layers.has('uavResults')?'Результати подій':'Події БпЛА',layers.has('uavCategories')?COLORS.wing:layers.has('uavResults')?COLORS.both:COLORS.uav)}
    if(layers.has('azimuths')){addAzimuths(map,bounds,events,stations);addLegend('Азимути спостереження',COLORS.both)}

    if(!bounds.isValid()){stations.forEach(s=>addPoint(bounds,s));objects.forEach(o=>addPoint(bounds,o))}
    if(bounds.isValid())map.fitBounds(bounds,{padding:[80,80],maxZoom:def.stationId?12:11,animate:false});else map.setView([48.86,37.60],9);
    map.invalidateSize();await tileReady(map);await sleep(350);if(layers.has('heat')){drawHeat(map,events);addLegend('Щільність подій БпЛА','#FF7800')}
    const scale=Math.round((156543.03392*Math.cos(map.getCenter().lat*Math.PI/180)/Math.pow(2,map.getZoom()))*160/0.025);q('#mpeScale',renderRoot).textContent=`1:${Math.max(10000,Math.round(scale/10000)*10000).toLocaleString('uk-UA')}`;
    kpi.push(['Події',events.length.toLocaleString('uk-UA')],['Станції',stations.length],['ВП/СП',objects.length]);configureDecor(def,{legend,kpi});
    const canvas=await window.html2canvas(renderRoot,{useCORS:true,allowTaint:false,backgroundColor:q('#mpeBasemap').value==='dark'?'#111827':'#eef2f7',logging:false,scale:1,width:dims.renderW,height:dims.renderH});
    let out=canvas;if(dims.outputW!==dims.renderW||dims.outputH!==dims.renderH){out=document.createElement('canvas');out.width=dims.outputW;out.height=dims.outputH;out.getContext('2d').drawImage(canvas,0,0,dims.outputW,dims.outputH)}
    if(forPreview){const p=document.createElement('canvas');const ratio=Math.min(1,1200/out.width,680/out.height);p.width=Math.round(out.width*ratio);p.height=Math.round(out.height*ratio);p.getContext('2d').drawImage(out,0,0,p.width,p.height);return await new Promise(resolve=>p.toBlob(resolve,'image/png',.95))}
    return await new Promise((resolve,reject)=>out.toBlob(b=>b?resolve(b):reject(new Error('Не вдалося створити PNG.')),'image/png',.96));
  }

  async function showPreview(id,force=false){
    const def=catalog.find(d=>d.id===id);if(!def)return;currentPreviewId=id;renderCatalog();q('#mpePreviewTitle').textContent=def.name;q('#mpePreviewMeta').textContent=`${groupFolder(def)} / ${def.file}`;setStatus(`Формую прев’ю: ${def.name}...`);
    try{const blob=await renderDefinition(def,true);if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(blob);q('#mpePreview').innerHTML=`<img src="${previewUrl}" alt="${esc(def.name)}">`;setStatus('Прев’ю готове.','ok')}catch(error){console.error(error);q('#mpePreview').innerHTML=`<div class="mpe-preview-placeholder">${esc(error.message||error)}</div>`;setStatus(error.message||String(error),'err')}
  }

  function galleryHtml(items){
    const groups=[...new Set(items.map(x=>x.folder))];return `<!doctype html><html lang="uk"><head><meta charset="utf-8"><title>VECTOR — пакет карт</title><style>body{margin:0;background:#0b0f16;color:#e7edf7;font:16px Arial;padding:28px}h1{color:#d78219}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:18px}.card{background:#111827;border:1px solid #334155;padding:12px}.card img{width:100%;display:block}.card b{display:block;margin-top:10px}</style></head><body><h1>VECTOR — пакет карт</h1>${groups.map(g=>`<h2>${esc(g)}</h2><div class="grid">${items.filter(x=>x.folder===g).map(x=>`<a class="card" href="../${encodeURI(x.path)}"><img src="../${encodeURI(x.path)}"><b>${esc(x.name)}</b></a>`).join('')}</div>`).join('')}</body></html>`;
  }

  async function buildZip(){
    try{
      abortRequested=false;await ensureLibraries();const data=await loadData(false);dateRange();const defs=catalog.filter(d=>selected.has(d.id));if(!defs.length)throw new Error('Не вибрано жодної карти.');
      q('#mpeBuild').disabled=true;q('#mpeCancel').style.display='inline-block';const progress=q('#mpeProgress');const zip=new JSZip();const manifest={system:'VECTOR',version:VERSION,exportMode:q('.mpe-panel').classList.contains('mpe-mode-quick')?'quick':'builder',package:q('.mpe-pack.active')?.dataset.pack||'custom',periodFrom:q('#mpeFrom').value,periodTo:q('#mpeTo').value,generatedAt:new Date().toISOString(),imageFormat:'png',canvas:q('#mpeSize').value,basemap:q('#mpeBasemap').value,mapsCount:defs.length,maps:[]};const gallery=[];
      for(let i=0;i<defs.length;i++){
        if(abortRequested)throw new Error('Експорт зупинено користувачем.');const def=defs[i];setStatus(`Формування ${i+1} із ${defs.length}: ${def.name}`);progress.style.width=`${Math.round(i/defs.length*100)}%`;
        try{const blob=await renderDefinition(def,false);const path=`${groupFolder(def)}/${def.file}`;zip.file(path,blob);manifest.maps.push({id:def.id,name:def.name,folder:groupFolder(def),file:def.file,path,status:'created',layers:def.layers,pack:def.pack});gallery.push({name:def.name,folder:groupFolder(def),path});}
        catch(error){console.error(error);manifest.maps.push({id:def.id,name:def.name,folder:groupFolder(def),file:def.file,status:'skipped',reason:error.message||String(error)});}
        await sleep(80);
      }
      progress.style.width='96%';setStatus('Створення службових файлів і ZIP...');const service=zip.folder('99_Службове');service.file('manifest.json',JSON.stringify(manifest,null,2));service.file('export_info.txt',`VECTOR — ПАКЕТ КАРТ\n\nПеріод: ${periodLabel()}\nРежим: ${manifest.exportMode}\nПакет: ${manifest.package}\nКількість карт: ${gallery.length}\nПідкладка: ${BASEMAPS[manifest.basemap]?.label||manifest.basemap}\nФормат: ${manifest.canvas} PNG\nДата формування: ${fmtDateTime(new Date())}\n\nОбмеження: маршрути відображаються як наявні в системі прямі лінії; події БпЛА прив’язані до координат населених пунктів або станцій; азимути є напрямками спостереження.`);service.file('index.html',galleryHtml(gallery));
      const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}},meta=>{progress.style.width=`${96+Math.round(meta.percent*.04)}%`});const name=`VECTOR_MAPS_${q('#mpeFrom').value}_${q('#mpeTo').value}.zip`;const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000);progress.style.width='100%';setStatus(`Готово. Створено ${gallery.length} карт.`, 'ok');
    }catch(error){console.error(error);setStatus(error.message||String(error),'err')}
    finally{q('#mpeBuild').disabled=false;q('#mpeCancel').style.display='none';abortRequested=false}
  }

  function destroy(){
    cleanupFns.forEach(fn=>{try{fn()}catch{}});cleanupFns=[];if(previewUrl)URL.revokeObjectURL(previewUrl);if(renderMapInstance)try{renderMapInstance.remove()}catch{};renderRoot?.remove();q('#mapPackageBtn')?.remove();q('#mapPackageModal')?.remove();q('#mapPackageCss')?.remove();
  }

  window.__vectorMapPackageExport={open:openModal,destroy,reload:()=>initialize(true),version:VERSION};
  function boot(){mountButton();createModal()}
  window.addEventListener('load',()=>{boot();setTimeout(boot,1000)});document.addEventListener('click',()=>setTimeout(boot,150));setTimeout(boot,0);
})();