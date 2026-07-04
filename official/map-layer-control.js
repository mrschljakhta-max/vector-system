(() => {
  const LABELS = {
    summary: 'Зведені НП',
    uav: 'БпЛА',
    stations: 'Станції',
    stationRadius: 'Радіуси станцій',
    vp: 'ВП',
    sp: 'СП',
    routes: 'Маршрути',
    points: 'Пункти',
    settlements: 'Населені пункти',
    other: 'Інше'
  };
  const ORDER = ['summary','uav','stations','stationRadius','vp','sp','routes','points','settlements','other'];
  const COLORS = {
    summary:'#8B5CF6', uav:'#3B82F6', stations:'#22C55E', stationRadius:'#22C55E',
    vp:'#EF4444', sp:'#FACC15', routes:'#F97316', points:'#EC4899', settlements:'#94A3B8', other:'#D78219'
  };
  const STORAGE = 'vector-layer-control-visible-v1';
  const registry = window.vectorLayerRegistry || (window.vectorLayerRegistry = {});
  const visible = loadVisible();

  function loadVisible(){ try{return JSON.parse(localStorage.getItem(STORAGE)||'{}')||{};}catch{return{};} }
  function saveVisible(){ localStorage.setItem(STORAGE, JSON.stringify(visible)); }
  function isOn(key){ return visible[key] !== false; }
  function ensureKey(key){ if(!registry[key]) registry[key] = new Set(); }

  function classify(layer){
    const opt = layer?.options || {};
    const color = String(opt.color || opt.fillColor || '').toUpperCase();
    const radius = typeof layer.getRadius === 'function' ? Number(layer.getRadius()) : 0;
    if(color === '#8B5CF6') return 'summary';
    if(color === '#3B82F6') return 'uav';
    if(color === '#22C55E') return radius > 1000 ? 'stationRadius' : 'stations';
    if(color === '#EF4444') return 'vp';
    if(color === '#FACC15') return 'sp';
    if(color === '#F97316') return 'routes';
    if(color === '#EC4899') return 'points';
    if(color === '#94A3B8') return 'settlements';
    return 'other';
  }

  function patchLeaflet(){
    if(!window.L || window.L.__vectorLayerControlPatched) return;
    const proto = window.L.LayerGroup && window.L.LayerGroup.prototype;
    if(!proto || !proto.addLayer) return;
    const original = proto.addLayer;
    proto.addLayer = function(layer){
      const result = original.call(this, layer);
      try{
        const key = classify(layer);
        ensureKey(key);
        registry[key].add(layer);
        layer.__vectorLayerKey = key;
        applyLayerState(key, layer);
        renderPanel();
      }catch{}
      return result;
    };
    window.L.__vectorLayerControlPatched = true;
  }

  function applyLayerState(key, layer){
    const on = isOn(key);
    if(layer?.setStyle){
      if(!layer.__vectorOriginalStyle){
        const o = layer.options || {};
        layer.__vectorOriginalStyle = {
          opacity: o.opacity ?? 1,
          fillOpacity: o.fillOpacity ?? 0.7,
          weight: o.weight ?? 2
        };
      }
      if(on){
        layer.setStyle(layer.__vectorOriginalStyle);
      } else {
        layer.setStyle({ opacity:0, fillOpacity:0, weight:0 });
      }
    }
    const el = layer?.getElement?.();
    if(el) el.style.pointerEvents = on ? '' : 'none';
  }

  function applyGroup(key){
    ensureKey(key);
    registry[key].forEach(layer => applyLayerState(key, layer));
    renderPanel();
  }

  function mountButton(){
    const nav = document.querySelector('.hover-nav--right');
    if(!nav || document.querySelector('#openLayerControl')) return;
    const btn = document.createElement('button');
    btn.id = 'openLayerControl';
    btn.className = 'hover-nav__item';
    btn.type = 'button';
    btn.innerHTML = '<span class="nav-icon-text">▤</span><span>Шари</span>';
    btn.addEventListener('click', togglePanel);
    nav.insertBefore(btn, nav.firstChild);
  }

  function ensurePanel(){
    let panel = document.querySelector('#vectorLayerPanel');
    if(panel) return panel;
    panel = document.createElement('section');
    panel.id = 'vectorLayerPanel';
    panel.innerHTML = '<div class="vlp-head"><div><b>Шари карти</b><span>Керуйте видимістю активних шарів</span></div><button type="button" id="vlpClose">×</button></div><div id="vlpList"></div>';
    document.body.appendChild(panel);
    const style = document.createElement('style');
    style.textContent = `
      #vectorLayerPanel{position:fixed;right:92px;top:72px;width:330px;max-height:72vh;overflow:auto;z-index:12000;display:none;padding:14px;border:1px solid rgba(215,130,25,.58);background:rgba(14,17,20,.92);box-shadow:0 24px 70px rgba(0,0,0,.45);font-family:Rajdhani,Arial,sans-serif;clip-path:polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px)}
      #vectorLayerPanel.is-open{display:block}.vlp-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}.vlp-head b{display:block;color:#fff;text-transform:uppercase;letter-spacing:.14em;font-size:20px}.vlp-head span{display:block;color:#9da7b2;font-size:14px;margin-top:2px}.vlp-head button{background:none;border:0;color:#fff;font-size:26px;cursor:pointer}.vlp-row{display:grid;grid-template-columns:26px 1fr auto;gap:10px;align-items:center;padding:10px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.045);margin-bottom:7px;color:#fff}.vlp-row:hover{border-color:rgba(215,130,25,.55)}.vlp-row input{accent-color:#d78219}.vlp-title{display:flex;align-items:center;gap:8px;font-weight:700;letter-spacing:.08em}.vlp-dot{width:10px;height:10px;border-radius:50%;display:inline-block}.vlp-count{color:#d78219;font-weight:700}.vlp-empty{padding:18px;color:#9da7b2;border:1px dashed rgba(255,255,255,.15)}
    `;
    document.head.appendChild(style);
    panel.querySelector('#vlpClose').onclick = () => panel.classList.remove('is-open');
    return panel;
  }

  function togglePanel(){
    const panel = ensurePanel();
    renderPanel();
    panel.classList.toggle('is-open');
  }

  function renderPanel(){
    const panel = document.querySelector('#vectorLayerPanel');
    if(!panel) return;
    const list = panel.querySelector('#vlpList');
    const keys = ORDER.filter(k => registry[k]?.size);
    if(!keys.length){ list.innerHTML = '<div class="vlp-empty">Активні шари ще не додані на карту.</div>'; return; }
    list.innerHTML = keys.map(k => '<label class="vlp-row"><input type="checkbox" data-layer="'+k+'" '+(isOn(k)?'checked':'')+'><span class="vlp-title"><i class="vlp-dot" style="background:'+COLORS[k]+'"></i>'+LABELS[k]+'</span><span class="vlp-count">'+registry[k].size+'</span></label>').join('');
    list.querySelectorAll('input[data-layer]').forEach(input => input.onchange = () => {
      visible[input.dataset.layer] = input.checked;
      saveVisible();
      applyGroup(input.dataset.layer);
    });
  }

  function boot(){ patchLeaflet(); mountButton(); ensurePanel(); renderPanel(); }
  window.addEventListener('load', () => { boot(); setInterval(boot, 1000); });
  document.addEventListener('click', () => setTimeout(boot, 120));
})();