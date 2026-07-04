(() => {
  let client = null;
  let group = null;
  let rows = [];
  const R = 15;
  function map(){ return window.vectorLeafletMap || window.vectorMap || null; }
  function sb(){ if(client) return client; if(!window.supabase || !window.VECTOR_SUPABASE_URL || !window.VECTOR_SUPABASE_KEY) return null; client = window.supabase.createClient(window.VECTOR_SUPABASE_URL, window.VECTOR_SUPABASE_KEY); return client; }
  function km(a){ return Number(a.coverage_radius_km || R); }
  function dist(a,b){ const rr=6371; const dlat=(Number(b.lat)-Number(a.lat))*Math.PI/180; const dlon=(Number(b.lon)-Number(a.lon))*Math.PI/180; const la1=Number(a.lat)*Math.PI/180; const la2=Number(b.lat)*Math.PI/180; const h=Math.sin(dlat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dlon/2)**2; return 2*rr*Math.asin(Math.sqrt(h)); }
  function build(items){ const n=items.length; const p=Array.from({length:n},(_,i)=>i); const f=i=>p[i]===i?i:(p[i]=f(p[i])); const u=(a,b)=>{a=f(a); b=f(b); if(a!==b) p[b]=a;}; for(let i=0;i<n;i++) for(let j=i+1;j<n;j++) if(dist(items[i],items[j]) <= km(items[i])+km(items[j])) u(i,j); const out={}; items.forEach((x,i)=>{const k=f(i); (out[k]||(out[k]=[])).push(x);}); return Object.values(out).sort((a,b)=>b.length-a.length); }
  function center(g){ return [g.reduce((s,x)=>s+Number(x.lat),0)/g.length, g.reduce((s,x)=>s+Number(x.lon),0)/g.length]; }
  function mount(){ if(document.querySelector('#clusterBtn')) return; const s=document.createElement('style'); s.textContent='.clusterBtn{position:fixed;right:92px;top:428px;width:54px;height:54px;z-index:99999}.clusterMark{width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(34,197,94,.18);border:2px solid #22C55E;font-weight:900}'; document.head.appendChild(s); const b=document.createElement('button'); b.id='clusterBtn'; b.className='clusterBtn'; b.type='button'; b.textContent='C'; b.onclick=toggle; document.body.appendChild(b); }
  async function load(){ const c=sb(); if(!c) return []; const r=await c.from('dict_stations').select('station_name,station_code,lat,lon,coverage_radius_km').limit(1000); rows=(r.data||[]).filter(x=>Number.isFinite(Number(x.lat))&&Number.isFinite(Number(x.lon))); return rows; }
  function clear(){ const m=map(); if(!m) return; if(!group) group=window.L.layerGroup().addTo(m); group.clearLayers(); }
  async function toggle(){ const m=map(); if(!m) return; if(group && group.getLayers().length){ clear(); return; } if(!rows.length) await load(); if(!group) group=window.L.layerGroup().addTo(m); group.clearLayers(); build(rows).filter(g=>g.length>1).forEach((g,i)=>{ const c=center(g); const icon=window.L.divIcon({className:'',html:'<div class="clusterMark">'+g.length+'</div>',iconSize:[46,46],iconAnchor:[23,23]}); window.L.marker(c,{icon}).bindPopup('Кластер '+(i+1)+'<br>Станцій: '+g.length).addTo(group); }); }
  window.vectorClusters = { toggle, clear };
  window.addEventListener('load',()=>{mount(); setInterval(mount,1000);});
})();