(() => {
  let client=null, group=null, visible=false;
  const sb=()=>client||(window.supabase&&window.VECTOR_SUPABASE_URL&&window.VECTOR_SUPABASE_KEY ? (client=window.supabase.createClient(window.VECTOR_SUPABASE_URL,window.VECTOR_SUPABASE_KEY)) : null);
  const isMap=m=>!!(m&&typeof m.addLayer==='function'&&typeof m.fitBounds==='function');
  function map(){ if(isMap(window.vectorLeafletMap)) return window.vectorLeafletMap; try{const m=eval('vectorMap'); if(isMap(m)){window.vectorLeafletMap=m; return m;}}catch{} return null; }
  function mount(){ const nav=document.querySelector('.hover-nav--right'); if(!nav||document.querySelector('#networkBtn')) return; const b=document.createElement('button'); b.id='networkBtn'; b.className='hover-nav__item'; b.type='button'; b.innerHTML='<span class="nav-icon-text">⌁</span><span>Мережа</span>'; b.onclick=toggle; nav.appendChild(b); }
  async function toggle(){ visible=!visible; const b=document.querySelector('#networkBtn'); b?.classList.toggle('is-active',visible); if(!visible){ group?.clearLayers(); return; } await draw(); }
  async function draw(){ const c=sb(), m=map(); if(!c||!m) return; if(!group) group=window.L.layerGroup().addTo(m); else group.clearLayers(); const [routes,points]=await Promise.all([c.from('map_routes').select('*').limit(200), c.from('map_points').select('*').limit(200)]); if(!routes.error){(routes.data||[]).forEach(r=>{const a=[Number(r.from_lat),Number(r.from_lon)],b=[Number(r.to_lat),Number(r.to_lon)]; if(a.every(Number.isFinite)&&b.every(Number.isFinite)) window.L.polyline([a,b],{color:'#F97316',weight:4,opacity:.78}).bindPopup('<b>'+esc(r.route_name)+'</b><br>Шлях<br>'+esc(r.from_name)+' → '+esc(r.to_name)+'<br>Призначення: '+esc(r.route_purpose||'—')).addTo(group);});}
    if(!points.error){(points.data||[]).forEach(p=>{const lat=Number(p.lat),lon=Number(p.lon); if(Number.isFinite(lat)&&Number.isFinite(lon)) window.L.circleMarker([lat,lon],{color:'#EC4899',fillColor:'#EC4899',radius:8,weight:2,fillOpacity:.8}).bindPopup('<b>'+esc(p.point_name)+'</b><br>'+esc(p.point_type)+'<br>НП: '+esc(p.settlement_name||'—')).addTo(group);});}
    try{ if(group.getLayers().length) m.fitBounds(group.getBounds(),{padding:[40,40]}); }catch{}
  }
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
  window.addEventListener('load',()=>{mount(); setTimeout(mount,800);}); document.addEventListener('click',()=>setTimeout(mount,150));
})();