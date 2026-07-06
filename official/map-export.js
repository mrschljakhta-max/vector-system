(() => {
  if (window.__vectorExportTool?.destroy) window.__vectorExportTool.destroy();
  document.querySelector('#exportBtn')?.remove();
  document.querySelector('#exportModal')?.remove();
  document.querySelector('#exportCss')?.remove();

  const VERSION = 'export-preview-stable-20260706-1';
  const KEYS = ['summary','uav','stations','stationRadius','vp','sp','routes','points','polygons','clusters','settlements','heatmap'];
  const NAMES = {
    summary:'Зведені НП', uav:'БПЛА', stations:'Станції', stationRadius:'Радіуси станцій',
    vp:'ВП', sp:'СП', routes:'Маршрути', points:'Пункти', polygons:'Контури', clusters:'Кластери',
    settlements:'Населені пункти', heatmap:'Теплокарта'
  };
  const COLORS = {
    summary:'#8B5CF6', uav:'#3B82F6', stations:'#22C55E', stationRadius:'#22C55E',
    vp:'#EF4444', sp:'#FACC15', routes:'#F97316', points:'#EC4899', polygons:'#16A34A',
    clusters:'#D78219', settlements:'#94A3B8', heatmap:'#ff8a00'
  };
  const PALETTES = {
    magma:[[5,0,10,0],[72,20,107,.15],[180,54,122,.30],[255,112,64,.46],[255,230,120,.58]],
    mono:[[0,0,0,0],[45,45,45,.12],[140,140,140,.26],[255,255,255,.46]],
    uv:[[0,255,240,0],[0,255,240,.14],[30,80,255,.28],[180,0,255,.44],[255,255,255,.56]]
  };

  const exportLayers = Object.fromEntries(KEYS.map(k => [k, true]));
  let previewMap = null;
  let previewHeatCanvas = null;
  let previewLayerGroup = null;
  let lastPreviewState = null;
  const cleanupFns = [];

  function byId(id){ return document.querySelector(id); }
  function registry(){ return window.vectorLayerRegistry || {}; }
  function isMap(m){ return Boolean(m && typeof m.addLayer === 'function' && typeof m.getCenter === 'function' && typeof m.getZoom === 'function'); }
  function safeEvalMap(){ try { const m = eval('vectorMap'); if (isMap(m)) return m; } catch {} return null; }
  function mainMap(){ return isMap(window.vectorLeafletMap) ? window.vectorLeafletMap : (isMap(window.vectorMap) ? window.vectorMap : safeEvalMap()); }
  function checked(id){ return !!byId(id)?.checked; }
  function layerEnabled(k){ return exportLayers[k] !== false; }
  function status(text){ const el = byId('#expStatus'); if (el) el.textContent = text; }
  function isHeatmapActive(){ return !!document.querySelector('#hm.on, #hm.hm.on, .hm.on'); }
  function normalizeColor(value){ if (!value) return ''; const s = String(value).trim().toUpperCase(); return s.startsWith('#') && s.length === 4 ? ('#'+s[1]+s[1]+s[2]+s[2]+s[3]+s[3]).toUpperCase() : s; }
  function isLayerDomVisible(layer){ const el = layer?.getElement?.(); if (!el) return true; return el.style.display !== 'none' && el.style.opacity !== '0'; }
  function isSuppressed(layer){ return Boolean(layer?.__vectorClusterHidden || layer?.__vectorExportHidden || layer?.options?.vectorLabelLayer); }

  function ensureCss(){
    if (document.querySelector('#exportCss')) return;
    const s = document.createElement('style');
    s.id = 'exportCss';
    s.textContent = `
      .exportBtn{position:fixed!important;right:92px!important;top:684px!important;width:54px!important;height:54px!important;z-index:100002!important;border:1px solid rgba(255,255,255,.18);background:rgba(9,15,26,.96);color:#fff;border-radius:14px;cursor:pointer;font:900 17px Rajdhani,Arial;display:flex!important;align-items:center;justify-content:center;box-shadow:0 16px 38px rgba(0,0,0,.42)}
      .exportBtn:hover,.exportBtn.is-active{border-color:#d78219;color:#d78219}
      .exportModal{position:fixed;inset:0;z-index:200000;display:none;align-items:center;justify-content:center;background:rgba(4,9,18,.58);backdrop-filter:blur(5px);font-family:Rajdhani,Arial,sans-serif}.exportModal.open{display:flex}
      .exportPanel{width:min(1500px,92vw);height:min(820px,88vh);display:grid;grid-template-columns:390px 1fr;gap:22px;padding:22px;border:1px solid rgba(90,130,210,.35);border-radius:24px;background:linear-gradient(145deg,rgba(14,29,61,.98),rgba(8,18,38,.98));box-shadow:0 30px 90px rgba(0,0,0,.55);color:#fff}
      .exportSide{overflow:auto;padding-right:4px}.exportSide h2{margin:0 0 12px;font-size:28px}.exportSide label{display:block;margin:12px 0 6px;font-weight:800;color:#dbe7ff}
      .exportSide input[type=text]{width:100%;box-sizing:border-box;padding:14px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:#08142d;color:#fff;font:700 16px Rajdhani,Arial}
      .exportChecks{margin:14px 0;padding:12px;border:1px solid rgba(255,255,255,.1);border-radius:16px;background:rgba(255,255,255,.04)}
      .exportChecks label{display:flex;gap:10px;align-items:center;margin:10px 0;color:#e8f0ff}.exportChecks input{accent-color:#3B82F6}
      .exportSubhead{margin:14px 0 8px;color:#ffb055;text-transform:uppercase;letter-spacing:.12em;font-weight:900}.exportLayerChecks{max-height:190px;overflow:auto}
      .exportLayerChecks label{display:grid;grid-template-columns:22px 12px 1fr auto;gap:8px;align-items:center}.exportLayerChecks i{width:10px;height:10px;border-radius:50%;display:inline-block}.exportLayerChecks b{color:#d78219}
      .exportButtons{display:grid;gap:10px;margin-top:14px}.exportButtons button{padding:13px;border:0;border-radius:12px;color:#fff;font:900 16px Rajdhani,Arial;cursor:pointer}
      .expPng{background:#3B82F6}.expXls{background:#24B47E}.expPdf{background:#526987}.expClose{background:#465B82}
      .exportPreview{position:relative;border-radius:18px;overflow:hidden;background:#f8fafc;border:1px solid rgba(255,255,255,.16)}
      .exportMapClone{position:absolute;inset:0;background:#f8fafc;z-index:1}.exportMapClone .leaflet-control-container{display:none!important}
      .exportOverlay{position:absolute;inset:0;pointer-events:none;z-index:9000!important}.exportOverlay>*{z-index:9001!important}
      .expTitle{position:absolute;left:22px;top:20px;padding:10px 16px;background:rgba(8,18,32,.78);border-radius:12px;color:white;font:900 30px Rajdhani,Arial;letter-spacing:.02em;max-width:80%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .expLegend{position:absolute;left:22px;top:96px;padding:14px 16px;background:rgba(8,18,32,.75);border-radius:14px;color:white;min-width:210px;max-width:310px;max-height:280px;overflow:auto}
      .expLegend b{display:block;margin-bottom:8px}.expLegend div{display:flex;align-items:center;gap:8px;margin:6px 0}.expDot{width:12px;height:12px;border-radius:50%;display:inline-block;flex:0 0 auto}
      .expNorth{position:absolute;right:20px;top:20px;width:48px;height:66px;background:rgba(8,18,32,.76);border-radius:14px;display:flex;align-items:center;justify-content:center;color:#fff;font:900 15px Rajdhani,Arial}
      .expNorth:before{content:'▲';position:absolute;top:8px;font-size:20px}.expNorth span{margin-top:22px}
      .expScale{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);padding:10px 20px;background:rgba(8,18,32,.78);border-radius:14px;color:#fff;font:900 22px Rajdhani,Arial;min-width:70px;text-align:center}
      .expKpi{position:absolute;left:22px;bottom:20px;padding:12px 16px;background:rgba(8,18,32,.74);border-radius:14px;color:#fff;min-width:180px}
      .expInfo{position:absolute;right:22px;bottom:20px;padding:12px 16px;background:rgba(8,18,32,.74);border-radius:14px;color:#fff}
      .expGrid{position:absolute;inset:0;z-index:8500;pointer-events:none;background-image:linear-gradient(rgba(51,65,85,.45) 1px,transparent 1px),linear-gradient(90deg,rgba(51,65,85,.45) 1px,transparent 1px);background-size:120px 120px}
      .expStatus{margin-top:10px;color:#b7c3d4;font-size:14px}
    `;
    document.head.appendChild(s);
  }

  function button(){
    ensureCss();
    let b = byId('#exportBtn');
    if (!b) {
      b = document.createElement('button');
      b.id = 'exportBtn'; b.className = 'exportBtn'; b.type = 'button';
      b.title = 'Експорт карти'; b.textContent = 'EX'; b.onclick = open;
      document.body.appendChild(b);
    }
    b.style.display = 'flex';
  }

  function createModal(){
    ensureCss();
    let m = byId('#exportModal');
    if (m) return m;
    m = document.createElement('section');
    m.id = 'exportModal'; m.className = 'exportModal';
    m.innerHTML = `
      <div class="exportPanel">
        <div class="exportSide">
          <h2>Експорт карти</h2>
          <label>Назва карти</label><input id="expName" type="text" placeholder="Введіть назву карти">
          <label>Виконавець</label><input id="expAuthor" type="text" placeholder="Ім'я та прізвище">
          <div class="exportChecks">
            <label><input id="expTitleOn" type="checkbox" checked> Назва карти</label>
            <label><input id="expLegendOn" type="checkbox" checked> Легенда</label>
            <label><input id="expScaleOn" type="checkbox" checked> Масштаб</label>
            <label><input id="expNorthOn" type="checkbox" checked> Північ</label>
            <label><input id="expInfoOn" type="checkbox" checked> Службова інформація</label>
            <label><input id="expKpiOn" type="checkbox" checked> KPI</label>
            <label><input id="expGridOn" type="checkbox"> Координаційна сітка</label>
          </div>
          <div class="exportSubhead">Шари експорту</div>
          <div class="exportChecks exportLayerChecks" id="exportLayerChecks"></div>
          <div class="exportButtons">
            <button class="expPng" id="expPng">PNG</button>
            <button class="expXls" id="expXls">Excel</button>
            <button class="expPdf" id="expPdf">PDF</button>
            <button class="expClose" id="expClose">Закрити</button>
          </div>
          <div class="expStatus" id="expStatus">Готово.</div>
        </div>
        <div class="exportPreview" id="exportPreview">
          <div id="exportMapClone" class="exportMapClone"></div>
          <div id="expGridBox" class="expGrid" style="display:none"></div>
          <div class="exportOverlay" id="exportOverlay">
            <div class="expTitle" id="expTitleBox">Без назви</div>
            <div class="expLegend" id="expLegendBox"></div>
            <div class="expNorth" id="expNorthBox"><span>N</span></div>
            <div class="expScale" id="expScaleBox">1:—</div>
            <div class="expKpi" id="expKpiBox"></div>
            <div class="expInfo" id="expInfoBox"></div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(m);
    m.querySelector('#expClose').onclick = close;
    m.querySelector('#expPng').onclick = exportPng;
    m.querySelector('#expXls').onclick = exportXlsx;
    m.querySelector('#expPdf').onclick = () => status('PDF додамо наступним етапом.');
    m.querySelectorAll('#expName,#expAuthor').forEach(i => i.addEventListener('input', renderDecorations));
    m.querySelectorAll('.exportChecks input:not(.expLayer)').forEach(i => i.addEventListener('change', renderDecorations));
    return m;
  }

  function classifyLayer(l){
    if (!l) return null;
    if (l.options?.vectorLayerKey) return l.options.vectorLayerKey;
    const o = l.options || {};
    const color = normalizeColor(o.color || o.fillColor);
    const radius = typeof l.getRadius === 'function' ? Number(l.getRadius()) : 0;
    if (color === '#8B5CF6') return 'summary';
    if (color === '#3B82F6') return 'uav';
    if (color === '#22C55E' || color === '#16A34A' || color === '#15803D') return radius > 1000 ? 'stationRadius' : 'stations';
    if (color === '#EF4444' || color === '#DC2626') return 'vp';
    if (color === '#FACC15') return 'sp';
    if (color === '#F97316') return 'routes';
    if (color === '#EC4899') return 'points';
    if (color === '#D78219') return 'clusters';
    if (color === '#94A3B8') return 'settlements';
    return null;
  }

  function sourceLayers(k){
    const out = new Set();
    const r = registry();
    if (r[k]) r[k].forEach(l => out.add(l));
    const m = mainMap();
    if (m) {
      m.eachLayer(l => {
        const addRec = x => {
          if (!x || isSuppressed(x) || !isLayerDomVisible(x)) return;
          const ck = classifyLayer(x);
          if (ck === k) out.add(x);
          if (x.eachLayer && ck !== 'clusters') x.eachLayer(addRec);
        };
        addRec(l);
      });
    }
    return Array.from(out).filter(l => !isSuppressed(l) && isLayerDomVisible(l));
  }

  function count(k){ return k === 'heatmap' ? (isHeatmapActive() ? 1 : 0) : sourceLayers(k).length; }

  function bindLayerChecks(){
    const box = byId('#exportLayerChecks');
    if (!box) return;
    box.innerHTML = KEYS.map(k => `<label><input type="checkbox" class="expLayer" data-exp-layer="${k}" ${exportLayers[k]?'checked':''}><i style="background:${COLORS[k]||'#fff'}"></i><span>${NAMES[k]}</span><b>${count(k)}</b></label>`).join('');
    box.querySelectorAll('.expLayer').forEach(i => i.onchange = () => { exportLayers[i.dataset.expLayer] = i.checked; renderAll(false); });
  }

  function open(){
    const m = createModal();
    m.classList.add('open');
    byId('#exportBtn')?.classList.add('is-active');
    const mm = mainMap();
    if (mm) lastPreviewState = { center: mm.getCenter(), zoom: mm.getZoom() };
    bindLayerChecks();
    renderAll(true);
  }

  function close(){
    byId('#exportModal')?.classList.remove('open');
    byId('#exportBtn')?.classList.remove('is-active');
    if (previewMap) lastPreviewState = { center: previewMap.getCenter(), zoom: previewMap.getZoom() };
  }

  function formatScale(n){
    if (!Number.isFinite(n) || n <= 0) return '1:—';
    const rounded = Math.max(10000, Math.round(n / 10000) * 10000);
    return '1:' + rounded.toLocaleString('uk-UA').replace(/\u00a0/g,' ');
  }
  function computedScale(){
    const m = previewMap || mainMap();
    const container = byId('#exportPreview') || m?.getContainer?.();
    if (!m || !container) return '1:—';
    const center = m.getCenter(); const zoom = m.getZoom(); const lat = center?.lat || 0;
    const metersPerPixel = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
    const cssWidth = Math.max(1, container.clientWidth || 1000);
    const nominalPx = Math.min(240, Math.max(100, cssWidth * 0.18));
    return formatScale(metersPerPixel * nominalPx / 0.025);
  }
  function currentScale(){ return computedScale(); }
  function tileUrl(){ let url = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'; try { mainMap()?.eachLayer(l => { if (l._url) url = l._url; }); } catch {} return url; }
  function layerStyle(l){
    const o = l.options || {};
    return { color:o.color || o.fillColor || '#3388ff', fillColor:o.fillColor || o.color || '#3388ff', weight:o.weight ?? 2, opacity:o.opacity ?? .8, fillOpacity:o.fillOpacity ?? .35, dashArray:o.dashArray || null, lineCap:o.lineCap || 'round', lineJoin:o.lineJoin || 'round' };
  }

  function copyLayer(k, l, bounds){
    if (!previewMap || !l || isSuppressed(l) || !isLayerDomVisible(l)) return;
    try {
      let c = null;
      if (l.options?.vectorLayerKey === 'clusters' && l.getLatLng) {
        const html = l.options?.icon?.options?.html || '<div style="width:34px;height:34px;border-radius:50%;background:#d78219;color:#fff;display:grid;place-items:center;font-weight:900">CL</div>';
        c = L.marker(l.getLatLng(), { icon: L.divIcon({ className:'', html, iconSize:[50,50], iconAnchor:[25,25] }) });
      } else if (l instanceof L.Circle) c = L.circle(l.getLatLng(), {...layerStyle(l), radius:l.getRadius()});
      else if (l instanceof L.CircleMarker) c = L.circleMarker(l.getLatLng(), {...layerStyle(l), radius:l.options.radius || 7});
      else if (l instanceof L.Polygon) c = L.polygon(l.getLatLngs(), layerStyle(l));
      else if (l instanceof L.Polyline) c = L.polyline(l.getLatLngs(), layerStyle(l));
      else if (l.eachLayer) { l.eachLayer(x => copyLayer(k, x, bounds)); return; }
      if (c) {
        c.addTo(previewLayerGroup || previewMap);
        try { bounds.push(c.getBounds ? c.getBounds() : L.latLngBounds([c.getLatLng()])); } catch {}
      }
    } catch (e) { console.warn('export copy layer skipped', e); }
  }

  function activePointLatLngs(){
    const out = [];
    ['uav','stations','vp','sp','points','settlements'].forEach(k => {
      if (!layerEnabled(k)) return;
      sourceLayers(k).forEach(l => {
        let p = l.getLatLng ? l.getLatLng() : null;
        if (!p && l.getBounds) p = l.getBounds().getCenter();
        if (p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))) out.push(p);
      });
    });
    return out;
  }
  function getHeatSettings(){
    const palEl = document.querySelector('.hmStyle.active');
    return { palette: palEl?.dataset?.pal || 'magma', intensity: (Number(byId('#hmIntensity')?.value || 65) / 100) * 0.72, radius: Number(byId('#hmRadius')?.value || 42), cold: Number(byId('#hmCold')?.value || 45) / 100 };
  }
  function interp(a,b,t){ return a + (b-a)*t; }
  function heatColor(t, palette, intensity){
    const p = PALETTES[palette] || PALETTES.magma; t = Math.max(0, Math.min(1, t));
    const x = t * (p.length - 1); const i = Math.min(p.length - 2, Math.floor(x)); const f = x - i, a = p[i], b = p[i+1];
    return [interp(a[0],b[0],f), interp(a[1],b[1],f), interp(a[2],b[2],f), interp(a[3],b[3],f) * intensity];
  }

  function mapReady(m){ return Boolean(m && m._loaded && m.getSize && m.getSize().x > 0 && m.getSize().y > 0); }
  function drawPreviewHeatmap(){
    if (!previewMap || !mapReady(previewMap) || !layerEnabled('heatmap') || !isHeatmapActive()) return;
    const container = byId('#exportLeaflet'); if (!container) return;
    if (previewHeatCanvas) previewHeatCanvas.remove();
    const pts = activePointLatLngs(); if (!pts.length) return;
    const { palette, intensity, radius, cold } = getHeatSettings();
    const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
    const mask = document.createElement('canvas'); mask.width = w; mask.height = h;
    const mx = mask.getContext('2d'); const rr = Math.max(18, Math.min(100, radius));
    pts.forEach(p => {
      try {
        const q = previewMap.latLngToContainerPoint(p);
        if (!Number.isFinite(q.x) || !Number.isFinite(q.y)) return;
        const g = mx.createRadialGradient(q.x, q.y, 0, q.x, q.y, rr);
        g.addColorStop(0, 'rgba(255,255,255,.46)'); g.addColorStop(.60, 'rgba(255,255,255,.20)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        mx.fillStyle = g; mx.beginPath(); mx.arc(q.x, q.y, rr, 0, Math.PI*2); mx.fill();
      } catch {}
    });
    const img = mx.getImageData(0,0,w,h), d = img.data, out = mx.createImageData(w,h), o = out.data;
    const minA = 0.035 * (1 - cold), boost = 1 + cold * 1.65;
    for (let i=0;i<d.length;i+=4){ const a = d[i+3] / 255; if (a < minA) { o[i+3] = 0; continue; } const t = Math.min(1, Math.max(0, (a-minA)/(1-minA))*boost); const c = heatColor(t,palette,intensity); o[i]=c[0]; o[i+1]=c[1]; o[i+2]=c[2]; o[i+3]=Math.round(c[3]*255); }
    previewHeatCanvas = document.createElement('canvas'); previewHeatCanvas.width = w; previewHeatCanvas.height = h; previewHeatCanvas.style.cssText = 'position:absolute;inset:0;z-index:450;pointer-events:none';
    container.appendChild(previewHeatCanvas); previewHeatCanvas.getContext('2d').putImageData(out,0,0);
  }

  function renderMapPreview(resetView=false){
    const target = byId('#exportMapClone'); if (!target || !window.L) return;
    const mm = mainMap();
    const current = previewMap && !resetView ? { center: previewMap.getCenter(), zoom: previewMap.getZoom() } : null;
    const start = current || lastPreviewState || (mm ? { center:mm.getCenter(), zoom:mm.getZoom() } : { center:L.latLng(48.86,37.60), zoom:9 });

    if (!previewMap) {
      target.innerHTML = '<div id="exportLeaflet" style="width:100%;height:100%;position:absolute;inset:0"></div>';
      previewMap = L.map('exportLeaflet', { zoomControl:false, attributionControl:false, preferCanvas:true, keyboard:false, scrollWheelZoom:true, dragging:true, doubleClickZoom:true });
      previewMap.setView(start.center, start.zoom);
      L.tileLayer(tileUrl(), { maxZoom:19, attribution:'', crossOrigin:true }).addTo(previewMap);
      previewMap.on('moveend zoomend resize', () => { lastPreviewState = { center: previewMap.getCenter(), zoom: previewMap.getZoom() }; drawPreviewHeatmap(); renderDecorations(); });
    } else {
      previewMap.setView(start.center, start.zoom, { animate:false });
    }
    previewMap.invalidateSize();
    if (previewLayerGroup) previewLayerGroup.clearLayers();
    else previewLayerGroup = L.layerGroup().addTo(previewMap);
    if (previewHeatCanvas) { previewHeatCanvas.remove(); previewHeatCanvas = null; }

    const bounds = [];
    KEYS.filter(k => k !== 'heatmap' && layerEnabled(k)).forEach(k => sourceLayers(k).forEach(l => copyLayer(k, l, bounds)));
    setTimeout(() => {
      try {
        previewMap.invalidateSize();
        if (resetView) {
          const m = mainMap();
          if (m) previewMap.setView(m.getCenter(), m.getZoom(), { animate:false });
        }
        lastPreviewState = { center: previewMap.getCenter(), zoom: previewMap.getZoom() };
        drawPreviewHeatmap(); renderDecorations();
      } catch (e) { console.warn('export preview skipped', e); }
    }, 160);
  }

  function legendHtml(){ return KEYS.filter(k => layerEnabled(k) && count(k)).map(k => `<div><i class="expDot" style="background:${COLORS[k]}"></i><span>${NAMES[k]}: ${count(k)}</span></div>`).join('') || '<div>Немає активних шарів</div>'; }
  function kpiHtml(){ const total = KEYS.filter(k => k !== 'heatmap' && layerEnabled(k)).reduce((s,k) => s + count(k), 0); return `<b>KPI</b><br>Об'єктів: ${total}<br>Станцій: ${layerEnabled('stations') ? count('stations') : 0}<br>Теплокарта: ${layerEnabled('heatmap') && isHeatmapActive() ? 'так' : 'ні'}`; }
  function renderDecorations(){
    if (!byId('#exportModal')?.classList.contains('open')) return;
    const show = (id, v) => { const e = byId(id); if (e) e.style.display = v ? '' : 'none'; };
    const title = byId('#expTitleBox'); if (title) title.textContent = byId('#expName')?.value || 'Без назви'; show('#expTitleBox', checked('#expTitleOn'));
    const legend = byId('#expLegendBox'); if (legend) legend.innerHTML = '<b>Легенда</b>' + legendHtml(); show('#expLegendBox', checked('#expLegendOn'));
    show('#expNorthBox', checked('#expNorthOn'));
    const scale = byId('#expScaleBox'); if (scale) scale.textContent = currentScale(); show('#expScaleBox', checked('#expScaleOn'));
    const kpi = byId('#expKpiBox'); if (kpi) kpi.innerHTML = kpiHtml(); show('#expKpiBox', checked('#expKpiOn'));
    const info = byId('#expInfoBox'); if (info) info.innerHTML = 'Виконавець: ' + (byId('#expAuthor')?.value || 'Не вказано') + '<br>Згенеровано: ' + new Date().toLocaleString('uk-UA'); show('#expInfoBox', checked('#expInfoOn'));
    show('#expGridBox', checked('#expGridOn'));
  }
  function renderAll(resetView=false){ renderMapPreview(resetView); renderDecorations(); setTimeout(renderDecorations, 240); }
  function loadHtml2Canvas(){ return window.html2canvas ? Promise.resolve() : new Promise((res, rej) => { const s = document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'; s.onload=res; s.onerror=rej; document.head.appendChild(s); }); }

  async function exportPng(){
    try {
      status('Генерую PNG...'); renderDecorations();
      if (previewMap) { lastPreviewState = { center: previewMap.getCenter(), zoom: previewMap.getZoom() }; previewMap.invalidateSize(); drawPreviewHeatmap(); renderDecorations(); }
      await new Promise(r => setTimeout(r, 600)); await loadHtml2Canvas();
      const canvas = await html2canvas(byId('#exportPreview'), { useCORS:true, allowTaint:true, backgroundColor:'#f8fafc', scale:2, onclone: doc => { const overlay = doc.querySelector('#exportOverlay'); if (overlay) { overlay.style.zIndex='9000'; overlay.style.display='block'; } ['#expTitleBox','#expLegendBox','#expNorthBox','#expScaleBox','#expKpiBox','#expInfoBox'].forEach(sel => { const e = doc.querySelector(sel); if (e) e.style.zIndex='9001'; }); } });
      const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = (byId('#expName')?.value || 'vector-map') + '.png'; a.click(); status('PNG готовий.');
    } catch (e) { console.error(e); status('Помилка PNG. Перевір CORS тайлів або спробуй іншу підкладку.'); }
  }

  function exportXlsx(){
    try {
      if (!window.XLSX) { status('XLSX бібліотека не підключена.'); return; }
      const rows = KEYS.map(k => ({ layer:NAMES[k], enabled:layerEnabled(k), count:count(k) }));
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'export_layers');
      XLSX.writeFile(wb, (byId('#expName')?.value || 'vector-map') + '.xlsx'); status('Excel готовий.');
    } catch (e) { console.error(e); status('Помилка Excel.'); }
  }

  function destroy(){
    cleanupFns.forEach(fn => { try { fn(); } catch {} });
    try { if (previewMap) previewMap.remove(); } catch {}
    previewMap = null; previewLayerGroup = null;
    byId('#exportBtn')?.remove(); byId('#exportModal')?.remove(); byId('#exportCss')?.remove();
  }
  function boot(){ button(); createModal(); }
  window.vectorExportMap = { open, close, render:renderAll, version:VERSION };
  window.__vectorExportTool = { destroy };
  window.addEventListener('load', boot); cleanupFns.push(() => window.removeEventListener('load', boot));
  document.addEventListener('click', () => setTimeout(button, 100));
  boot(); setInterval(button, 1000);
})();
