(() => {
  let grid = null;
  let on = false;
  function map(){ return window.vectorLeafletMap || window.vectorMap || null; }
  function step(z){ if(z>=13) return .01; if(z>=11) return .02; if(z>=9) return .05; if(z>=7) return .1; return .25; }
  function round(v,s){ return Math.floor(v/s)*s; }
  function fmt(v,axis){ return Math.abs(v).toFixed(2)+'° '+(axis==='lat'?(v>=0?'N':'S'):(v>=0?'E':'W')); }
  function css(){ if(document.querySelector('#gridCss')) return; const s=document.createElement('style'); s.id='gridCss'; s.textContent='.gridBtn{position:fixed;right:92px;top:492px;width:54px;height:54px;z-index:99999;border:1px solid rgba(255,255,255,.18);background:rgba(9,15,26,.96);color:#fff;border-radius:14px;cursor:pointer;font:900 18px Rajdhani,Arial}.gridBtn.is-active{border-color:#d78219;color:#d78219}.gridLbl{background:transparent!important;border:0!important;box-shadow:none!important;color:#334155;font:800 12px Rajdhani,Arial;text-shadow:0 1px 2px #fff;white-space:nowrap;pointer-events:none!important}'; document.head.appendChild(s); }
  function button(){ css(); if(document.querySelector('#gridBtn')) return; const b=document.createElement('button'); b.id='gridBtn'; b.className='gridBtn'; b.type='button'; b.title='Координаційна сітка'; b.textContent='⌗'; b.onclick=toggle; document.body.appendChild(b); }
  function clear(){ const m=map(); if(grid) grid.clearLayers(); document.querySelector('#gridBtn')?.classList.remove('is-active'); on=false; }
  function draw(){ const m=map(); if(!m || !window.L) return; if(!grid) grid=window.L.layerGroup().addTo(m); grid.clearLayers(); const b=m.getBounds(); const s=step(m.getZoom()); const south=round(b.getSouth(),s)-s, north=b.getNorth()+s, west=round(b.getWest(),s)-s, east=b.getEast()+s; for(let lat=south; lat<=north; lat+=s){ window.L.polyline([[lat,west],[lat,east]],{color:'#64748B',weight:1,opacity:.35,dashArray:'4 6'}).addTo(grid); window.L.marker([lat,west],{interactive:false,icon:window.L.divIcon({className:'gridLbl',html:fmt(lat,'lat'),iconSize:null,iconAnchor:[-4,0]})}).addTo(grid); } for(let lon=west; lon<=east; lon+=s){ window.L.polyline([[south,lon],[north,lon]],{color:'#64748B',weight:1,opacity:.35,dashArray:'4 6'}).addTo(grid); window.L.marker([south,lon],{interactive:false,icon:window.L.divIcon({className:'gridLbl',html:fmt(lon,'lon'),iconSize:null,iconAnchor:[0,-14]})}).addTo(grid); } document.querySelector('#gridBtn')?.classList.add('is-active'); on=true; }
  function toggle(){ if(on){ clear(); return; } draw(); const m=map(); if(m&&!m.__gridHooked){ m.on('moveend zoomend',()=>{ if(on) draw(); }); m.__gridHooked=true; } }
  window.vectorGrid={toggle,draw,clear};
  window.addEventListener('load',()=>{button(); setInterval(button,1000);});
})();