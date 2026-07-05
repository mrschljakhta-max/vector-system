(() => {
  let grid = null;
  let on = false;

  function map(){
    if (window.getVectorMap) {
      const m = window.getVectorMap({ create:false });
      if (m) return m;
    }
    if(window.vectorLeafletMap) return window.vectorLeafletMap;
    if(window.vectorMap) return window.vectorMap;
    try { const m = eval('vectorMap'); if(m && typeof m.addLayer === 'function'){ window.vectorLeafletMap = m; return m; } } catch {}
    return null;
  }

  function step(z){
    if(z>=13) return .01;
    if(z>=11) return .02;
    if(z>=9) return .05;
    if(z>=7) return .1;
    return .25;
  }

  function round(v,s){ return Math.floor(v/s)*s; }
  function fmt(v,axis){ return Math.abs(v).toFixed(2)+'° '+(axis==='lat'?(v>=0?'N':'S'):(v>=0?'E':'W')); }

  function css(){
    if(document.querySelector('#gridCss')) return;
    const s=document.createElement('style');
    s.id='gridCss';
    s.textContent='.gridBtn{position:fixed!important;right:92px!important;top:556px!important;width:54px!important;height:54px!important;z-index:100002!important;border:1px solid rgba(255,255,255,.18)!important;background:rgba(9,15,26,.96)!important;color:#fff!important;border-radius:14px!important;cursor:pointer!important;font:900 22px Rajdhani,Arial!important;display:flex!important;align-items:center!important;justify-content:center!important;box-shadow:0 16px 38px rgba(0,0,0,.42)!important}.gridBtn:hover,.gridBtn.is-active{border-color:#d78219!important;color:#d78219!important}.gridLbl{background:transparent!important;border:0!important;box-shadow:none!important;color:#334155!important;font:800 12px Rajdhani,Arial!important;text-shadow:0 1px 2px #fff!important;white-space:nowrap!important;pointer-events:none!important}';
    document.head.appendChild(s);
  }

  function pane(m){
    let p=m.getPane('vectorGridPane');
    if(!p){
      p=m.createPane('vectorGridPane');
      p.style.zIndex=345;
      p.style.pointerEvents='none';
    }
    return 'vectorGridPane';
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

  function clear(){
    if(grid) grid.clearLayers();
    document.querySelector('#gridBtn')?.classList.remove('is-active');
    on=false;
  }

  function draw(){
    const m=map();
    if(!m || !window.L) return false;
    const gridPane=pane(m);
    if(!grid) grid=window.L.layerGroup().addTo(m);
    grid.clearLayers();

    const b=m.getBounds();
    const s=step(m.getZoom());
    const south=round(b.getSouth(),s)-s;
    const north=b.getNorth()+s;
    const west=round(b.getWest(),s)-s;
    const east=b.getEast()+s;
    let latIndex=0;
    for(let lat=south; lat<=north; lat+=s){
      const major=latIndex%5===0;
      window.L.polyline([[lat,west],[lat,east]],{
        pane:gridPane,
        vectorLayerKey:'grid',
        color:'#334155',
        weight:major?1.2:1,
        opacity:major?.42:.24,
        dashArray:major?'':'4 7',
        interactive:false
      }).addTo(grid);
      if(major){
        window.L.marker([lat,west],{
          pane:gridPane,
          interactive:false,
          vectorLayerKey:'grid',
          vectorLabelLayer:true,
          icon:window.L.divIcon({className:'gridLbl',html:fmt(lat,'lat'),iconSize:null,iconAnchor:[-4,0]})
        }).addTo(grid);
      }
      latIndex++;
    }
    let lonIndex=0;
    for(let lon=west; lon<=east; lon+=s){
      const major=lonIndex%5===0;
      window.L.polyline([[south,lon],[north,lon]],{
        pane:gridPane,
        vectorLayerKey:'grid',
        color:'#334155',
        weight:major?1.2:1,
        opacity:major?.42:.24,
        dashArray:major?'':'4 7',
        interactive:false
      }).addTo(grid);
      if(major){
        window.L.marker([south,lon],{
          pane:gridPane,
          interactive:false,
          vectorLayerKey:'grid',
          vectorLabelLayer:true,
          icon:window.L.divIcon({className:'gridLbl',html:fmt(lon,'lon'),iconSize:null,iconAnchor:[0,-14]})
        }).addTo(grid);
      }
      lonIndex++;
    }
    document.querySelector('#gridBtn')?.classList.add('is-active');
    on=true;
    return true;
  }

  function toggle(){
    if(on){ clear(); return; }
    if(!draw()) setTimeout(draw,300);
    const m=map();
    if(m&&!m.__gridHooked){
      m.on('moveend zoomend resize',()=>{ if(on) draw(); });
      m.__gridHooked=true;
    }
  }

  window.vectorGrid={toggle,draw,clear,button};
  function boot(){ button(); }
  boot();
  window.addEventListener('load',()=>{boot(); setInterval(boot,700);});
  document.addEventListener('click',()=>setTimeout(boot,80));
})();