(() => {
  let client=null, coverageGroup=null, stations=[];
  const RADIUS_KM=15;
  const RADIUS_STYLE={color:'#15803D',fillColor:'#22C55E',weight:1.15,opacity:.72,fillOpacity:.045,vectorLayerKey:'polygons',lineCap:'round',lineJoin:'round'};
  const RADIUS_HALO_STYLE={color:'#FFFFFF',weight:2.2,opacity:.55,fill:false,interactive:false,vectorLayerKey:'polygons',lineCap:'round',lineJoin:'round'};
  let stationRadiusHiddenByPolygon=false;

  function sb(){ if(client) return client; if(!window.supabase||!window.VECTOR_SUPABASE_URL||!window.VECTOR_SUPABASE_KEY) return null; client=window.supabase.createClient(window.VECTOR_SUPABASE_URL,window.VECTOR_SUPABASE_KEY); return client; }
  function isMap(m){ return !!(m && typeof m.addLayer==='function' && typeof m.fitBounds==='function'); }
  function getMap(){ if(window.getVectorMap){const m=window.getVectorMap({create:false}); if(isMap(m)) return m;} if(isMap(window.vectorLeafletMap)) return window.vectorLeafletMap; if(isMap(window.vectorMap)) return window.vectorMap; try{const m=eval('vectorMap'); if(isMap(m)){window.vectorLeafletMap=m; return m;}}catch{} return null; }
  function kmRadius(s){return Number(s.coverage_radius_km||RADIUS_KM)}

  function rememberOriginal(layer){ if(!layer||!layer.setStyle) return; if(!layer.__vectorPolygonOriginalStyle){ const o=layer.options||{}; layer.__vectorPolygonOriginalStyle={opacity:o.opacity??1,fillOpacity:o.fillOpacity??0.7,weight:o.weight??2}; } }
  function hideStationRadii(){ const set=window.vectorLayerRegistry?.stationRadius; if(!set) return; set.forEach(layer=>{rememberOriginal(layer);layer.setStyle?.({opacity:0,fillOpacity:0,weight:0});const el=layer.getElement?.();if(el)el.style.pointerEvents='none';}); stationRadiusHiddenByPolygon=true; }
  function restoreStationRadii(){ const set=window.vectorLayerRegistry?.stationRadius; if(!set) return; set.forEach(layer=>{if(layer.__vectorPolygonOriginalStyle)layer.setStyle?.(layer.__vectorPolygonOriginalStyle);const el=layer.getElement?.();if(el)el.style.pointerEvents='';}); stationRadiusHiddenByPolygon=false; }
  function ensureRadiusPane(map){let p=map.getPane('vectorRadiusPane');if(!p){p=map.createPane('vectorRadiusPane');p.style.zIndex=610;p.style.pointerEvents='auto'}return 'vectorRadiusPane';}
  function bringGroupToFront(g){setTimeout(()=>{try{g.eachLayer?.(l=>{l.bringToFront?.();l.eachLayer?.(x=>x.bringToFront?.())})}catch{}},80);setTimeout(()=>{try{g.eachLayer?.(l=>{l.bringToFront?.();l.eachLayer?.(x=>x.bringToFront?.())})}catch{}},300)}

  function mountButton(){ if(document.querySelector('#openPolygonControl')) return; const btn=document.createElement('button'); btn.id='openPolygonControl'; btn.className='vector-polygon-tool-btn'; btn.type='button'; btn.title='Радіуси покриття станцій'; btn.innerHTML='<span class="vector-polygon-icon">▰</span>'; btn.addEventListener('click',togglePanel); document.body.appendChild(btn); }
  function ensurePanel(){ let p=document.querySelector('#vectorPolygonPanel'); if(p) return p; p=document.createElement('section'); p.id='vectorPolygonPanel'; p.innerHTML='<div class="vpp-head"><div><b>Радіуси</b><span>Покриття малюється окремими витонченими колами поверх карти.</span></div><button type="button" id="vppClose">×</button></div><div id="vppStatus">Готово.</div><div id="vppList"><label class="vpp-row"><input id="coverageToggle" type="checkbox" checked><span class="vpp-title"><i class="vpp-dot"></i>Радіуси станцій 15 км</span><span class="vpp-count" id="coverageCount">—</span></label></div><div class="vpp-actions"><button id="vppRefresh" type="button">Оновити</button><button id="vppApply" type="button">Застосувати</button></div>'; document.body.appendChild(p); const st=document.createElement('style'); st.id='vectorPolygonControlStyles'; st.textContent=`
      .vector-polygon-tool-btn{position:fixed;right:92px;top:364px;width:54px;height:54px;z-index:99999;border:1px solid rgba(255,255,255,.18);background:rgba(9,15,26,.96);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;border-radius:14px;box-shadow:0 16px 38px rgba(0,0,0,.42)}
      .vector-polygon-tool-btn:hover,.vector-polygon-tool-btn.is-active{border-color:#d78219;color:#d78219}.vector-polygon-icon{font-size:24px;line-height:1;transform:rotate(45deg)}
      #vectorPolygonPanel{position:fixed;right:154px;top:356px;width:350px;max-height:58vh;overflow:auto;z-index:100000;display:none;padding:14px;border:1px solid rgba(215,130,25,.38);background:rgba(10,23,48,.94);box-shadow:0 24px 70px rgba(0,0,0,.45);font-family:Rajdhani,Arial,sans-serif;border-radius:16px;color:#fff}
      #vectorPolygonPanel.is-open{display:block}.vpp-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}.vpp-head b{display:block;color:#fff;text-transform:uppercase;letter-spacing:.14em;font-size:20px}.vpp-head span{display:block;color:#b7c3d4;font-size:14px;margin-top:2px}.vpp-head button{background:none;border:0;color:#fff;font-size:26px;cursor:pointer}#vppStatus{color:#b7c3d4;font-size:14px;margin-bottom:10px}.vpp-row{display:grid;grid-template-columns:26px 1fr auto;gap:10px;align-items:center;padding:10px 12px;border:1px solid rgba(255,255,255,.08);background:rgba(17,35,68,.7);margin-bottom:7px;color:#fff;border-radius:10px}.vpp-row:hover{border-color:rgba(215,130,25,.55)}.vpp-row input{accent-color:#d78219}.vpp-title{display:flex;align-items:center;gap:8px;font-weight:700;letter-spacing:.08em}.vpp-dot{width:10px;height:10px;display:inline-block;transform:rotate(45deg);background:#22C55E}.vpp-count{color:#d78219;font-weight:700}.vpp-actions{display:flex;gap:8px;margin-top:12px}.vpp-actions button{flex:1;padding:10px;border:1px solid rgba(215,130,25,.45);background:rgba(255,255,255,.05);color:#fff;text-transform:uppercase;font-weight:800;letter-spacing:.12em;cursor:pointer}.vpp-actions #vppApply{background:rgba(215,130,25,.18);color:#ffb055}`; if(!document.querySelector('#vectorPolygonControlStyles')) document.head.appendChild(st); p.querySelector('#vppClose').onclick=()=>{p.classList.remove('is-open');document.querySelector('#openPolygonControl')?.classList.remove('is-active')}; p.querySelector('#vppRefresh').onclick=loadStations; p.querySelector('#vppApply').onclick=applyCoveragePolygon; return p; }
  function togglePanel(){ const p=ensurePanel(); p.classList.toggle('is-open'); document.querySelector('#openPolygonControl')?.classList.toggle('is-active',p.classList.contains('is-open')); if(p.classList.contains('is-open')) loadStations(); }
  function status(t){ const e=document.querySelector('#vppStatus'); if(e)e.textContent=t; }

  async function loadStations(){ const c=sb(); if(!c){status('Supabase не підключено.'); return;} status('Завантажую станції...'); const {data,error}=await c.from('dict_stations').select('station_name,station_code,lat,lon,coverage_radius_km,status_text,is_active').eq('is_active',true).limit(1000); if(error){ stations=[]; status('Помилка: '+error.message); return; } stations=(data||[]).filter(s=>Number.isFinite(Number(s.lat))&&Number.isFinite(Number(s.lon))); const cnt=document.querySelector('#coverageCount'); if(cnt) cnt.textContent=stations.length; status('Станцій із координатами: '+stations.length+'. Будуть намальовані окремі радіуси.'); }
  function ensureGroup(map){ if(!coverageGroup) coverageGroup=window.L.layerGroup().addTo(map); else coverageGroup.clearLayers(); return coverageGroup; }
  function radiusPopup(s){return '<b>'+String(s.station_name||s.station_code||'Станція')+'</b><br>Радіус покриття: '+kmRadius(s)+' км'+(s.status_text?'<br>'+String(s.status_text):'')}
  function drawSingleRadius(map,group,s){
    const lat=Number(s.lat), lon=Number(s.lon), r=kmRadius(s)*1000, pane=ensureRadiusPane(map);
    window.L.circle([lat,lon],{radius:r,pane,...RADIUS_HALO_STYLE}).addTo(group);
    window.L.circle([lat,lon],{radius:r,pane,...RADIUS_STYLE}).bindPopup(radiusPopup(s)).addTo(group);
  }

  async function applyCoveragePolygon(){
    const map=getMap(); if(!map){status('Карта ще не ініціалізована.'); return;}
    if(!document.querySelector('#coverageToggle')?.checked){ ensureGroup(map); restoreStationRadii(); status('Радіуси покриття вимкнено.'); return; }
    if(!stations.length) await loadStations(); if(!stations.length){status('Немає станцій із координатами.'); return;}
    status('Малюю окремі витончені радіуси покриття...'); const group=ensureGroup(map); hideStationRadii();
    try{
      stations.forEach(s=>drawSingleRadius(map,group,s));
      bringGroupToFront(group);
      if(window.vectorLayerRegistry){ window.vectorLayerRegistry.polygons=window.vectorLayerRegistry.polygons||new Set(); group.eachLayer(l=>window.vectorLayerRegistry.polygons.add(l)); }
      status('Готово. Окремих радіусів: '+stations.length+'.'); try{map.fitBounds(group.getBounds(),{padding:[40,40]});}catch{}
    }catch(e){ console.warn(e); restoreStationRadii(); status('Не вдалося сформувати радіуси. Окремі радіуси повернено.'); }
  }

  function boot(){mountButton();ensurePanel();if(stationRadiusHiddenByPolygon)hideStationRadii();}
  window.addEventListener('load',()=>{boot();setInterval(boot,1000)}); document.addEventListener('click',()=>setTimeout(boot,120));
})();