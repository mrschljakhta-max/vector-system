(() => {
  let scaleEl = null;
  function loadLayerControl(){
    if(document.querySelector('script[src^="./map-layer-control.js"]')) return;
    const s=document.createElement('script');
    s.src='./map-layer-control.js?v=20260704-1';
    s.defer=true;
    document.head.appendChild(s);
  }
  function isMap(map) { return !!(map && typeof map.on === 'function' && typeof map.distance === 'function' && typeof map.getCenter === 'function'); }
  function getMap() {
    if (isMap(window.vectorLeafletMap)) return window.vectorLeafletMap;
    if (isMap(window.vectorMap)) return window.vectorMap;
    try { const map = eval('vectorMap'); if (isMap(map)) { window.vectorLeafletMap = map; return map; } } catch {}
    return null;
  }
  function ensureScaleElement() {
    if (scaleEl) return scaleEl;
    scaleEl = document.createElement('div');
    scaleEl.id = 'vectorScaleIndicator';
    scaleEl.innerHTML = '<span class="scale-label">Масштаб</span><strong>1 : —</strong>';
    document.body.appendChild(scaleEl);
    const style = document.createElement('style');
    style.id = 'vectorScaleIndicatorStyles';
    style.textContent = `#vectorScaleIndicator{position:fixed;left:112px;bottom:30px;z-index:8500;min-width:170px;padding:10px 14px;border:1px solid rgba(215,130,25,.65);background:rgba(18,22,25,.86);color:#f4f2ee;box-shadow:0 18px 40px rgba(0,0,0,.35);clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px);font-family:Rajdhani,Arial,sans-serif;letter-spacing:.08em;pointer-events:none;display:none}body:has(#workspace.vector-workspace.is-open) #vectorScaleIndicator{display:block}#vectorScaleIndicator .scale-label{display:block;color:#d78219;text-transform:uppercase;font-weight:700;font-size:12px;line-height:1;margin-bottom:4px}#vectorScaleIndicator strong{display:block;font-size:22px;line-height:1.05;color:#fff}`;
    if (!document.querySelector('#vectorScaleIndicatorStyles')) document.head.appendChild(style);
    return scaleEl;
  }
  function roundToTenThousand(value) { if (!Number.isFinite(value) || value <= 0) return 0; return Math.max(10000, Math.round(value / 10000) * 10000); }
  function formatNumber(value) { return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function estimateScale(map) { const center = map.getCenter(); const zoom = map.getZoom(); const latitude = center.lat * Math.PI / 180; const metersPerPixel = 156543.03392 * Math.cos(latitude) / Math.pow(2, zoom); const metersPerInch = metersPerPixel * 96; return roundToTenThousand(metersPerInch / 0.0254); }
  function update() { const map = getMap(); const el = ensureScaleElement(); if (!map || !el) return; const scale = estimateScale(map); el.querySelector('strong').textContent = scale ? '1 : ' + formatNumber(scale) : '1 : —'; }
  function bind() { const map = getMap(); if (!map || map.__vectorScaleBound) return; map.__vectorScaleBound = true; ensureScaleElement(); map.on('zoomend moveend resize', update); update(); }
  window.addEventListener('load', () => { loadLayerControl(); ensureScaleElement(); const timer = setInterval(() => { loadLayerControl(); bind(); update(); }, 700); setTimeout(() => clearInterval(timer), 12000); });
  document.addEventListener('click', () => setTimeout(() => { loadLayerControl(); bind(); update(); }, 250));
})();