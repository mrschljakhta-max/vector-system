(() => {
  const STORAGE='vector-polygons-visible-types-v1';
  let client=null, polygonGroup=null, rows=[], selectedTypes=new Set(loadTypes());

  function sb(){ if(client) return client; if(!window.supabase||!window.VECTOR_SUPABASE_URL||!window.VECTOR_SUPABASE_KEY) return null; client=window.supabase.createClient(window.VECTOR_SUPABASE_URL,window.VECTOR_SUPABASE_KEY); return client; }
  function isMap(m){ return !!(m && typeof m.addLayer==='function' && typeof m.fitBounds==='function'); }
  function getMap(){ if(isMap(window.vectorLeafletMap)) return window.vectorLeafletMap; if(isMap(window.vectorMap)) return window.vectorMap; try{const m=eval('vectorMap'); if(isMap(m)){window.vectorLeafletMap=m; return m;}}catch{} return null; }
  function loadTypes(){ try{return JSON.parse(localStorage.getItem(STORAGE)||'[]')||[]}catch{return[]} }
  function saveTypes(){ localStorage.setItem(STORAGE,JSON.stringify([...selectedTypes])); }

  function mountButton(){
    if(document.querySelector('#openPolygonControl')) return;
    const btn=document.createElement('button');
    btn.id='openPolygonControl'; btn.className='vector-polygon-tool-btn'; btn.type='button'; btn.title='Полігони';
    btn.innerHTML='<span class="vector-polygon-icon">▰</span>';
    btn.addEventListener('click',togglePanel);
    document.body.appendChild(btn);
  }

  function ensurePanel(){
    let p=document.querySelector('#vectorPolygonPanel'); if(p) return p;
    p=document.createElement('section'); p.id='vectorPolygonPanel';
    p.innerHTML='<div class="vpp-head"><div><b>Полігони</b><span>Відображення полігональних шарів карти</span></div><button type="button" id="vppClose">×</button></div><div id="vppStatus">Готово.</div><div id="vppList"></div><div class="vpp-actions"><button id="vppRefresh" type="button">Оновити</button><button id="vppApply" type="button">Застосувати</button></div>';
    document.body.appendChild(p);
    const st=document.createElement('style'); st.id='vectorPolygonControlStyles'; st.textContent=`
      .vector-polygon-tool-btn{position:fixed;right:92px;top:364px;width:54px;height:54px;z-index:99999;border:1px solid rgba(255,255,255,.18);background:rgba(9,15,26,.96);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;border-radius:14px;box-shadow:0 16px 38px rgba(0,0,0,.42)}
      .vector-polygon-tool-btn:hover,.vector-polygon-tool-btn.is-active{border-color:#d78219;color:#d78219}.vector-polygon-icon{font-size:24px;line-height:1;transform:rotate(45deg)}
      #vectorPolygonPanel{position:fixed;right:154px;top:356px;width:330px;max-height:58vh;overflow:auto;z-index:100000;display:none;padding:14px;border:1px solid rgba(215,130,25,.38);background:rgba(10,23,48,.94);box-shadow:0 24px 70px rgba(0,0,0,.45);font-family:Rajdhani,Arial,sans-serif;border-radius:16px;color:#fff}
      #vectorPolygonPanel.is-open{display:block}.vpp-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}.vpp-head b{display:block;color:#fff;text-transform:uppercase;letter-spacing:.14em;font-size:20px}.vpp-head span{display:block;color:#b7c3d4;font-size:14px;margin-top:2px}.vpp-head button{background:none;border:0;color:#fff;font-size:26px;cursor:pointer}#vppStatus{color:#b7c3d4;font-size:14px;margin-bottom:10px}.vpp-row{display:grid;grid-template-columns:26px 1fr auto;gap:10px;align-items:center;padding:10px 12px;border:1px solid rgba(255,255,255,.08);background:rgba(17,35,68,.7);margin-bottom:7px;color:#fff;border-radius:10px}.vpp-row:hover{border-color:rgba(215,130,25,.55)}.vpp-row input{accent-color:#d78219}.vpp-title{display:flex;align-items:center;gap:8px;font-weight:700;letter-spacing:.08em}.vpp-dot{width:10px;height:10px;display:inline-block;transform:rotate(45deg);background:#d78219}.vpp-count{color:#d78219;font-weight:700}.vpp-empty{padding:18px;color:#b7c3d4;border:1px dashed rgba(255,255,255,.15);border-radius:10px}.vpp-actions{display:flex;gap:8px;margin-top:12px}.vpp-actions button{flex:1;padding:10px;border:1px solid rgba(215,130,25,.45);background:rgba(255,255,255,.05);color:#fff;text-transform:uppercase;font-weight:800;letter-spacing:.12em;cursor:pointer}.vpp-actions #vppApply{background:rgba(215,130,25,.18);color:#ffb055}
    `; if(!document.querySelector('#vectorPolygonControlStyles')) document.head.appendChild(st);
    p.querySelector('#vppClose').onclick=()=>{p.classList.remove('is-open');document.querySelector('#openPolygonControl')?.classList.remove('is-active')};
    p.querySelector('#vppRefresh').onclick=loadRows;
    p.querySelector('#vppApply').onclick=applyPolygons;
    return p;
  }

  function togglePanel(){ const p=ensurePanel(); p.classList.toggle('is-open'); document.querySelector('#openPolygonControl')?.classList.toggle('is-active',p.classList.contains('is-open')); if(p.classList.contains('is-open')) loadRows(); }
  function status(t){ const e=document.querySelector('#vppStatus'); if(e)e.textContent=t; }

  async function loadRows(){
    const c=sb(); if(!c){status('Supabase не підключено.'); return;}
    status('Завантажую полігони...');
    let res=await c.from('map_polygons').select('*').limit(1000);
    if(res.error){
      rows=[]; renderList(); status('Таблицю map_polygons ще не знайдено. Коли додамо її в Supabase — полігони зʼявляться тут.'); return;
    }
    rows=res.data||[];
    if(!selectedTypes.size) new Set(rows.map(typeOf)).forEach(t=>selectedTypes.add(t));
    renderList(); status('Завантажено полігонів: '+rows.length);
  }

  function typeOf(r){ return String(r.polygon_type||r.type||r.category||'Полігони'); }
  function nameOf(r){ return String(r.polygon_name||r.name||r.title||r.code||'Полігон'); }
  function colorOf(r){ return String(r.color||r.stroke_color||'#D78219'); }

  function renderList(){
    const list=document.querySelector('#vppList'); if(!list) return;
    if(!rows.length){ list.innerHTML='<div class="vpp-empty">Полігони ще не завантажені або таблиця порожня.</div>'; return; }
    const groups=[...new Set(rows.map(typeOf))];
    list.innerHTML=groups.map(g=>'<label class="vpp-row"><input type="checkbox" data-type="'+esc(g)+'" '+(selectedTypes.has(g)?'checked':'')+'><span class="vpp-title"><i class="vpp-dot"></i>'+esc(g)+'</span><span class="vpp-count">'+rows.filter(r=>typeOf(r)===g).length+'</span></label>').join('');
    list.querySelectorAll('input[data-type]').forEach(i=>i.onchange=()=>{i.checked?selectedTypes.add(i.dataset.type):selectedTypes.delete(i.dataset.type);saveTypes();});
  }

  function ensureGroup(map){ if(!polygonGroup) polygonGroup=window.L.layerGroup().addTo(map); else polygonGroup.clearLayers(); return polygonGroup; }
  function parseGeometry(r){
    const raw=r.geojson||r.geometry||r.coordinates||r.points||r.latlon||r.polygon;
    if(!raw) return null;
    let g=raw;
    if(typeof raw==='string'){ try{g=JSON.parse(raw)}catch{ return parseTextPoints(raw); } }
    if(g?.type==='Feature') g=g.geometry;
    if(g?.type==='Polygon') return g.coordinates.map(ring=>ring.map(([lon,lat])=>[lat,lon]));
    if(g?.type==='MultiPolygon') return g.coordinates.map(poly=>poly.map(ring=>ring.map(([lon,lat])=>[lat,lon])));
    if(Array.isArray(g)){
      if(g.length && Array.isArray(g[0]) && typeof g[0][0]==='number') return g.map(p=>[Number(p[0]),Number(p[1])]);
      if(g.length && g[0]?.lat!=null && g[0]?.lon!=null) return g.map(p=>[Number(p.lat),Number(p.lon)]);
      if(g.length && Array.isArray(g[0]) && Array.isArray(g[0][0])) return g.map(ring=>ring.map(p=>Array.isArray(p)?[Number(p[0]),Number(p[1])]:[Number(p.lat),Number(p.lon)]));
    }
    return null;
  }
  function parseTextPoints(s){
    const pts=String(s).split(/[;|\n]+/).map(x=>x.trim()).filter(Boolean).map(x=>x.split(/[,\s]+/).map(Number)).filter(a=>a.length>=2&&a.every(Number.isFinite)).map(([lat,lon])=>[lat,lon]);
    return pts.length>=3?pts:null;
  }

  function applyPolygons(){
    const map=getMap(); if(!map){status('Карта ще не ініціалізована.'); return;}
    const group=ensureGroup(map); let added=0;
    rows.filter(r=>selectedTypes.has(typeOf(r))).forEach(r=>{
      const geom=parseGeometry(r); if(!geom) return;
      const color=colorOf(r);
      const layer=window.L.polygon(geom,{color,fillColor:color,weight:2,opacity:.85,fillOpacity:.14,vectorLayerKey:'polygons'}).bindPopup('<b>'+esc(nameOf(r))+'</b><br>'+esc(typeOf(r))+(r.note?'<hr>'+esc(r.note):''));
      layer.addTo(group); added++;
    });
    status('Відображено полігонів: '+added);
    if(added) try{map.fitBounds(group.getBounds(),{padding:[40,40]});}catch{}
    if(window.vectorLayerRegistry){ window.vectorLayerRegistry.polygons = window.vectorLayerRegistry.polygons || new Set(); group.eachLayer(l=>window.vectorLayerRegistry.polygons.add(l)); }
  }
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function boot(){mountButton();ensurePanel();}
  window.addEventListener('load',()=>{boot();setInterval(boot,1000)}); document.addEventListener('click',()=>setTimeout(boot,120));
})();