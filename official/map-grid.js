(() => {
  let grid = null;
  let on = false;
  function map(){
    const m = window.getVectorMap?.() || window.vectorLeafletMap || window.vectorMap || null;
    return m && typeof m.addLayer === 'function' ? m : null;
  }
  function step(z){ if(z>=13) return .01; if(z>=11) return .02; if(z>=9) return .05; if(z>=7) return .1; return .25; }
  function round(v,s){ return Math.floor(v/s)*s; }
  function fmt(v,axis){ return Math.abs(v).toFixed(2)+'° '+(axis==='lat'?(v>=0?'N':'S'):(v>=0?'E':'W')); }
  function css(){
    if(document.querySelector('#gridCss')) return;
    const s=document.createElement('style');
    s.id='gridCss';
    s.textContent='.gridBtn{position:fixed!important;right:92px!important;top:556px!important;width:54px!important;height:54px!important;z-index:100002!important;border:1px solid rgba(255,255,255,.18)!important;background:rgba(9,15,26,.96)!important;color:#fff!important;border-radius:14px!important;cursor:pointer!important;font:900 22px Rajdhani,Arial!important;display:flex!important;align-items:center!important;justify-content:center!important;box-shadow:0 16px 38px rgba(0,0,0,.42)!important}.gridBtn:hover,.gridBtn.is-active{border-color:#d78219!important;color:#d78219!important}.gridLbl{background:transparent!important;border:0!important;box-shadow:none!important;color:#334155!important;font:800 12px Rajdhani,Arial!important;text-shadow:0 1px 2px #fff!important;white-space:nowrap!important;pointer-events:none!important}';
    document.head.appendChild(s);
  }
  function button(){
    css();
    let b=document.querySelector('#gridBtn');
    if(!b){
      b=document.createElement('button');
      b.id='gridBtn';
      b.className='gridBtn';
      b.type='button';
      b.title='Координаційна сітка';
      b.textContent='⌗';
      b.onclick=toggle;
      document.body.appendChild(b);
    }
    b.style.display='flex';
  }
  function clear(){ if(grid) grid.clearLayers(); document.querySelector('#gridBtn')?.classList.remove('is-active'); on=false; }
  function draw(){
    const m=map();
    if(!m || !window.L) return;
    if(!grid) grid=window.L.layerGroup().addTo(m);
    grid.clearLayers();
    const b=m.getBounds();
    const s=step(m.getZoom());
    const south=round(b.getSouth(),s)-s, north=b.getNorth()+s, west=round(b.getWest(),s)-s, east=b.getEast()+s;
    for(let lat=south; lat<=north; lat+=s){
      window.L.polyline([[lat,west],[lat,east]],{color:'#64748B',weight:1,opacity:.35,dashArray:'4 6'}).addTo(grid);
      window.L.marker([lat,west],{interactive:false,icon:window.L.divIcon({className:'gridLbl',html:fmt(lat,'lat'),iconSize:null,iconAnchor:[-4,0]})}).addTo(grid);
    }
    for(let lon=west; lon<=east; lon+=s){
      window.L.polyline([[south,lon],[north,lon]],{color:'#64748B',weight:1,opacity:.35,dashArray:'4 6'}).addTo(grid);
      window.L.marker([south,lon],{interactive:false,icon:window.L.divIcon({className:'gridLbl',html:fmt(lon,'lon'),iconSize:null,iconAnchor:[0,-14]})}).addTo(grid);
    }
    document.querySelector('#gridBtn')?.classList.add('is-active');
    on=true;
  }
  function toggle(){
    if(on){ clear(); return; }
    draw();
    const m=map();
    if(m&&!m.__gridHooked){ m.on('moveend zoomend',()=>{ if(on) draw(); }); m.__gridHooked=true; }
  }
  window.vectorGrid={toggle,draw,clear,button};
  function boot(){ button(); }
  boot();
  window.addEventListener('load',()=>{boot(); setInterval(boot,700);});
  document.addEventListener('click',()=>setTimeout(boot,80));
})();