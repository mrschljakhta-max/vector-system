(() => {
  const LABEL_KEY = { summary:'labelsSummary', uav:'labelsUav', stations:'labelsStations', vp:'labelsVp', sp:'labelsSp', points:'labelsPoints', settlements:'labelsSettlements' };
  const COLORS = { labelsSummary:'#8B5CF6', labelsUav:'#3B82F6', labelsStations:'#16A34A', labelsVp:'#EF4444', labelsSp:'#B45309', labelsPoints:'#EC4899', labelsSettlements:'#64748B' };
  const STORAGE = 'vector-layer-control-visible-v1';
  const registry = window.vectorLayerRegistry || (window.vectorLayerRegistry = {});

  function layerKey(layer){
    if(layer?.options?.vectorLayerKey) return layer.options.vectorLayerKey;
    const o = layer?.options || {};
    const color = String(o.color || o.fillColor || '').toUpperCase();
    const radius = typeof layer.getRadius === 'function' ? Number(layer.getRadius()) : 0;
    if(color === '#8B5CF6') return 'summary';
    if(color === '#3B82F6') return 'uav';
    if(color === '#22C55E') return radius > 1000 ? 'stationRadius' : 'stations';
    if(color === '#EF4444') return 'vp';
    if(color === '#FACC15') return 'sp';
    if(color === '#EC4899') return 'points';
    if(color === '#94A3B8') return 'settlements';
    return null;
  }

  function popupTitle(layer){
    try{
      const html = String(layer.getPopup?.()?.getContent?.() || '');
      const m = html.match(/<b[^>]*>(.*?)<\/b>/i);
      if(!m) return '';
      const div = document.createElement('div');
      div.innerHTML = m[1];
      return (div.textContent || div.innerText || '').trim();
    }catch{return '';}
  }

  function visible(key){
    try { return JSON.parse(localStorage.getItem(STORAGE) || '{}')?.[key] !== false; } catch { return true; }
  }

  function applyLabelVisibility(label){
    const key = label?.options?.vectorLayerKey;
    const el = label?.getElement?.();
    if(el) el.style.display = visible(key) ? '' : 'none';
  }

  function registerLabel(key, label){
    if(!registry[key]) registry[key] = new Set();
    registry[key].add(label);
    label.__vectorLayerKey = key;
    setTimeout(() => applyLabelVisibility(label), 50);
  }

  function ensureStyles(){
    if(document.querySelector('#vectorMapLabelStyles')) return;
    const style = document.createElement('style');
    style.id = 'vectorMapLabelStyles';
    style.textContent = `
      .vector-map-label{
        background:transparent!important;
        border:0!important;
        box-shadow:none!important;
        color:var(--label-color,#fff);
        font-family:Rajdhani,Arial,sans-serif;
        font-size:15px;
        font-weight:800;
        letter-spacing:.08em;
        line-height:1;
        white-space:nowrap;
        text-transform:uppercase;
        text-shadow:0 1px 2px rgba(255,255,255,.9),0 -1px 2px rgba(255,255,255,.9),1px 0 2px rgba(255,255,255,.9),-1px 0 2px rgba(255,255,255,.9),0 2px 5px rgba(0,0,0,.22);
        pointer-events:none!important;
      }
      .vector-map-label__text{background:transparent!important;border:0!important;padding:0!important;margin:0!important;}
    `;
    document.head.appendChild(style);
  }

  function patchLeaflet(){
    if(!window.L || window.L.__vectorLabelsPatched) return;
    ensureStyles();
    const proto = window.L.LayerGroup && window.L.LayerGroup.prototype;
    if(!proto || !proto.addLayer) return;
    const original = proto.addLayer;
    proto.addLayer = function(layer){
      const result = original.call(this, layer);
      try{
        if(layer?.options?.vectorLabelLayer) return result;
        const baseKey = layerKey(layer);
        const labelKey = LABEL_KEY[baseKey];
        if(!labelKey || typeof layer.getLatLng !== 'function') return result;
        if(typeof layer.getRadius === 'function' && Number(layer.getRadius()) > 1000) return result;
        if(layer.__vectorLabelCreated) return result;
        const text = popupTitle(layer);
        if(!text) return result;
        layer.__vectorLabelCreated = true;
        const icon = window.L.divIcon({
          className:'vector-map-label',
          html:'<span class="vector-map-label__text" style="--label-color:'+COLORS[labelKey]+'">'+escapeHtml(text)+'</span>',
          iconSize:null,
          iconAnchor:[-10,-18]
        });
        const label = window.L.marker(layer.getLatLng(), { icon, interactive:false, keyboard:false, vectorLabelLayer:true, vectorLayerKey:labelKey });
        original.call(this, label);
        registerLabel(labelKey, label);
      }catch(e){ console.warn('VECTOR label error', e); }
      return result;
    };
    window.L.__vectorLabelsPatched = true;
  }

  function escapeHtml(v){ return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  window.addEventListener('load', () => { patchLeaflet(); setInterval(patchLeaflet, 800); });
  document.addEventListener('click', () => setTimeout(patchLeaflet, 120));
})();