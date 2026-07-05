(() => {
  const VERSION = 'export-fix-20260705-12-merged-heat-polygons';
  const KEYS = ['summary','uav','stations','stationRadius','vp','sp','routes','points','polygons','settlements','heatmap'];
  const NAMES = {
    summary:'Зведені НП', uav:'БПЛА', stations:'Станції', stationRadius:'Радіуси станцій',
    vp:'ВП', sp:'СП', routes:'Маршрути', points:'Пункти', polygons:'Полігони',
    settlements:'Населені пункти', heatmap:'Теплокарта'
  };
  const COLORS = {
    summary:'#8B5CF6', uav:'#3B82F6', stations:'#22C55E', stationRadius:'#22C55E',
    vp:'#EF4444', sp:'#FACC15', routes:'#F97316', points:'#EC4899',
    polygons:'#16A34A', settlements:'#94A3B8', heatmap:'#ff8a00'
  };
  const HEAT_PALETTE = [
    [55, 0, 110, 0.00],
    [130, 60, 210, 0.22],
    [255, 210, 90, 0.48],
    [255, 120, 20, 0.68],
    [255, 10, 0, 0.82]
  ];

  const exportLayers = Object.fromEntries(KEYS.map(k => [k, true]));
  let previewMap = null;
  let previewHeatCanvas = null;
  let lastPreviewState = null;
  let renderTimer = null;

  function mainMap(){ return window.vectorLeafletMap || window.vectorMap || safeEvalMap(); }
  function safeEvalMap(){ try { const m = eval('vectorMap'); if (m && m.addLayer) return m; } catch {} return null; }
  function registry(){ return window.vectorLayerRegistry || {}; }
  function byId(id){ return document.querySelector(id); }
  function checked(id){ return !!byId(id)?.checked; }
  function layerEnabled(k){ return exportLayers[k] !== false; }
  function status(text){ const el = byId('#expStatus'); if (el) el.textContent = text; }
  function isHeatmapActive(){ return !!document.querySelector('#hm.on, #hm.hm.on') || !!document.querySelector('.hm.on'); }

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
      .expTitle{position:absolute;left:22px;top:20px;padding:10px 16px;background:rgba(8,18,32,.78);border-radius:12px;color:white;font:900 30px Rajdhani,Arial;letter-spacing:.02em}
      .expLegend{position:absolute;left:22px;top:96px;padding:14px 16px;background:rgba(8,18,32,.75);border-radius:14px;color:white;min-width:210px}
      .expLegend b{display:block;margin-bottom:8px}.expLegend div{display:flex;align-items:center;gap:8px;margin:6px 0}.expDot{width:12px;height:12px;border-radius:50%;display:inline-block}
      .expNorth{position:absolute;right:20px;top:20px;width:48px;height:66px;background:rgba(8,18,32,.76);border-radius:14px;display:flex;align-items:center;justify-content:center;color:#fff;font:900 15px Rajdhani,Arial}
      .expNorth:before{content:'▲';position:absolute;top:8px;font-size:20px}.expNorth span{margin-top:22px}
      .expScale{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);padding:10px 20px;background:rgba(8,18,32,.78);border-radius:14px;color:#fff;font:900 22px Rajdhani,Arial}
      .expKpi{position:absolute;left:22px;bottom:20px;padding:12px 16px;background:rgba(8,18,32,.74);border-radius:14px;color:#fff;min-width:180px}
      .expInfo{position:absolute;right:22px;bottom:20px;padding:12px 16px;background:rgba(8,18,32,.74);border-radius:14px;color:#fff}
      .expGrid{position:absolute;inset:0;z-index:8500;pointer-events:none;background-image:linear-gradient(rgba(51,65,85,.45) 1px,transparent 1px),linear-gradient(90deg,rgba(51,65,85,.45) 1px,transparent 1px);background-size:120px 120px}
      .expStatus{margin-top:10px;color:#b7c3d4;font-size:14px}
    `;
    document.head.appendChild(s);
  }

  function button(){
    ensureCss();
    let b = document.querySelector('#exportBtn');
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
    const color = String(o.color || o.fillColor || '').toUpperCase();
    const radius = typeof l.getRadius === 'function' ? Number(l.getRadius()) : 0;
    if (color === '#8B5CF6') return 'summary';
    if (color === '#3B82F6') return 'uav';
    if (color === '#22C55E') return radius > 1000 ? 'stationRadius' : 'stations';
    if (color === '#16A34A') return 'polygons';
    if (color === '#EF4444') return 'vp';
    if (color === '#FACC15') return 'sp';
    if (color === '#F97316') return 'routes';
    if (color === '#EC4899') return 'points';
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
          const ck = classifyLayer(x);
          if (ck === k) out.add(x);
          if (x.eachLayer) x.eachLayer(addRec);
        };
        addRec(l);
      });
    }

    if (k === 'polygons' && window.vectorCoverageGroup?.eachLayer) {
      window.vectorCoverageGroup.eachLayer(l => out.add(l));
    }
    return Array.from(out);
  }

  function count(k){
    if (k === 'heatmap') return isHeatmapActive() ? 1 : 0;
    return sourceLayers(k).length;
  }

  function bindLayerChecks(){
    const box = byId('#exportLayerChecks');
    if (!box) return;
    box.innerHTML = KEYS.map(k => `<label><input type="checkbox" class="expLayer" data-exp-layer="${k}" ${exportLayers[k]?'checked':''}><i style="background:${COLORS[k]||'#fff'}"></i><span>${NAMES[k]}</span><b>${count(k)}</b></label>`).join('');
    box.querySelectorAll('.expLayer').forEach(i => i.onchange = () => { exportLayers[i.dataset.expLayer] = i.checked; renderAll(false); });
  }

  function open(){
    createModal().classList.add('open');
    document.querySelector('#exportBtn')?.classList.add('is-active');
    bindLayerChecks();
    renderAll(true);
  }
  function close(){
    byId('#exportModal')?.classList.remove('open');
    document.querySelector('#exportBtn')?.classList.remove('is-active');
    if (previewMap) {
      lastPreviewState = { center: previewMap.getCenter(), zoom: previewMap.getZoom() };
      previewMap.remove(); previewMap = null;
    }
  }

  function currentScale(){
    const e = document.querySelector('#vectorScaleBox,#scaleBox,.scale-box');
    return e?.textContent?.replace('МАСШТАБ','').trim() || '1:—';
  }
  function tileUrl(){
    let url = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
    try { mainMap()?.eachLayer(l => { if (l._url) url = l._url; }); } catch {}
    return url;
  }
  function layerStyle(l){
    const o = l.options || {};
    return {
      color:o.color || o.fillColor || '#3388ff',
      fillColor:o.fillColor || o.color || '#3388ff',
      weight:o.weight ?? 2,
      opacity:o.opacity ?? .8,
      fillOpacity:o.fillOpacity ?? .35,
      dashArray:o.dashArray || null,
      lineCap:o.lineCap || 'round',
      lineJoin:o.lineJoin || 'round'
    };
  }
  function copyLayer(k, l, bounds){
    try {
      let c = null;
      if (l instanceof L.Circle) c = L.circle(l.getLatLng(), {...layerStyle(l), radius:l.getRadius()});
      else if (l instanceof L.CircleMarker) c = L.circleMarker(l.getLatLng(), {...layerStyle(l), radius:l.options.radius || 7});
      else if (l instanceof L.Polygon) c = L.polygon(l.getLatLngs(), layerStyle(l));
      else if (l instanceof L.Polyline) c = L.polyline(l.getLatLngs(), layerStyle(l));
      else if (l.eachLayer) { l.eachLayer(x => copyLayer(k, x, bounds)); return; }
      if (c) {
        c.addTo(previewMap);
        try { bounds.push(c.getBounds ? c.getBounds() : L.latLngBounds([c.getLatLng()])); } catch {}
      }
    } catch {}
  }

  function activePointLatLngs(){
    const out = [];
    ['uav','stations','vp','sp','points','settlements'].forEach(k => {
      if (!layerEnabled(k)) return;
      sourceLayers(k).forEach(l => {
        let p = l.getLatLng ? l.getLatLng() : null;
        if (!p && l.getBounds) p = l.getBounds().getCenter();
        if (p) out.push(p);
      });
    });
    return out;
  }

  function interp(a,b,t){ return a + (b-a)*t; }
  function heatColor(t){
    t = Math.max(0, Math.min(1, t));
    const x = t * (HEAT_PALETTE.length - 1);
    const i = Math.min(HEAT_PALETTE.length - 2, Math.floor(x));
    const f = x - i, a = HEAT_PALETTE[i], b = HEAT_PALETTE[i+1];
    return [interp(a[0],b[0],f), interp(a[1],b[1],f), interp(a[2],b[2],f), interp(a[3],b[3],f)];
  }

  function drawPreviewHeatmap(){
    if (!previewMap || !layerEnabled('heatmap') || !isHeatmapActive()) return;
    const container = byId('#exportLeaflet'); if (!container) return;
    if (previewHeatCanvas) previewHeatCanvas.remove();

    const w = container.clientWidth, h = container.clientHeight;
    const mask = document.createElement('canvas');
    mask.width = w; mask.height = h;
    const mx = mask.getContext('2d');
    const radius = 58;

    activePointLatLngs().forEach(p => {
      const q = previewMap.latLngToContainerPoint(p);
      const g = mx.createRadialGradient(q.x, q.y, 0, q.x, q.y, radius);
      g.addColorStop(0, 'rgba(255,255,255,.56)');
      g.addColorStop(.58, 'rgba(255,255,255,.24)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      mx.fillStyle = g;
      mx.beginPath();
      mx.arc(q.x, q.y, radius, 0, Math.PI*2);
      mx.fill();
    });

    const img = mx.getImageData(0,0,w,h);
    const d = img.data;
    const out = mx.createImageData(w,h);
    const o = out.data;
    const coldFill = 0.45;
    const minA = 0.025 * (1 - coldFill);
    const boost = 1 + coldFill * 2.15;

    for (let i=0;i<d.length;i+=4){
      const a = d[i+3] / 255;
      if (a < minA) { o[i+3] = 0; continue; }
      const t = Math.min(1, Math.max(0, (a - minA) / (1 - minA)) * boost);
      const c = heatColor(t);
      o[i] = c[0]; o[i+1] = c[1]; o[i+2] = c[2]; o[i+3] = Math.round(c[3]*255);
    }

    previewHeatCanvas = document.createElement('canvas');
    previewHeatCanvas.width = w; previewHeatCanvas.height = h;
    previewHeatCanvas.style.cssText = 'position:absolute;inset:0;z-index:450;pointer-events:none';
    container.appendChild(previewHeatCanvas);
    previewHeatCanvas.getContext('2d').putImageData(out,0,0);
  }

  function renderMapPreview(resetView=false){
    const target = byId('#exportMapClone'); if (!target || !window.L) return;
    const mm = mainMap();
    const previous = previewMap && !resetView ? { center: previewMap.getCenter(), zoom: previewMap.getZoom() } : null;
    if (previewMap) { previewMap.remove(); previewMap = null; }
    target.innerHTML = '<div id="exportLeaflet" style="width:100%;height:100%;position:absolute;inset:0"></div>';
    previewMap = L.map('exportLeaflet', {
      zoomControl:false, attributionControl:false, preferCanvas:true,
      keyboard:false, scrollWheelZoom:true, dragging:true, doubleClickZoom:true
    });
    L.tileLayer(tileUrl(), { maxZoom:19, attribution:'', crossOrigin:true }).addTo(previewMap);

    const bounds = [];
    KEYS.filter(k => k !== 'heatmap' && layerEnabled(k)).forEach(k => sourceLayers(k).forEach(l => copyLayer(k, l, bounds)));

    setTimeout(() => {
      try {
        if (previous) previewMap.setView(previous.center, previous.zoom);
        else if (lastPreviewState) previewMap.setView(lastPreviewState.center, lastPreviewState.zoom);
        else if (bounds.length) {
          let b = bounds[0]; bounds.slice(1).forEach(x => b.extend(x));
          previewMap.fitBounds(b, {padding:[70,70], maxZoom:mm?.getZoom?.() || 10});
        } else if (mm) previewMap.setView(mm.getCenter(), mm.getZoom());
        previewMap.invalidateSize();
        previewMap.on('moveend zoomend', () => {
          lastPreviewState = { center: previewMap.getCenter(), zoom: previewMap.getZoom() };
          drawPreviewHeatmap();
        });
        drawPreviewHeatmap();
      } catch {}
    }, 120);
  }

  function legendHtml(){
    return KEYS.filter(k => layerEnabled(k) && count(k)).map(k => `<div><i class="expDot" style="background:${COLORS[k]}"></i><span>${NAMES[k]}: ${count(k)}</span></div>`).join('') || '<div>Немає активних шарів</div>';
  }
  function kpiHtml(){
    const total = KEYS.filter(k => k !== 'heatmap' && layerEnabled(k)).reduce((s,k) => s + count(k), 0);
    return `<b>KPI</b><br>Об'єктів: ${total}<br>Станцій: ${layerEnabled('stations') ? count('stations') : 0}<br>Теплокарта: ${layerEnabled('heatmap') && isHeatmapActive() ? 'так' : 'ні'}`;
  }
  function renderDecorations(){
    if (!byId('#exportModal')?.classList.contains('open')) return;
    const show = (id, v) => { const e = byId(id); if (e) e.style.display = v ? '' : 'none'; };
    const title = byId('#expTitleBox'); if (title) title.textContent = byId('#expName')?.value || 'Без назви';
    show('#expTitleBox', checked('#expTitleOn'));
    const legend = byId('#expLegendBox'); if (legend) legend.innerHTML = '<b>Легенда</b>' + legendHtml();
    show('#expLegendBox', checked('#expLegendOn'));
    show('#expNorthBox', checked('#expNorthOn'));
    const scale = byId('#expScaleBox'); if (scale) scale.textContent = currentScale();
    show('#expScaleBox', checked('#expScaleOn'));
    const kpi = byId('#expKpiBox'); if (kpi) kpi.innerHTML = kpiHtml();
    show('#expKpiBox', checked('#expKpiOn'));
    const info = byId('#expInfoBox');
    if (info) info.innerHTML = 'Виконавець: ' + (byId('#expAuthor')?.value || 'Не вказано') + '<br>Згенеровано: ' + new Date().toLocaleString('uk-UA');
    show('#expInfoBox', checked('#expInfoOn'));
    show('#expGridBox', checked('#expGridOn'));
  }

  function scheduleRender(reset=false){
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => renderAll(reset), 80);
  }
  function renderAll(resetView=false){
    renderMapPreview(resetView);
    renderDecorations();
    setTimeout(renderDecorations, 180);
  }

  function loadHtml2Canvas(){
    return window.html2canvas ? Promise.resolve() : new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
      s.onload=res; s.onerror=rej; document.head.appendChild(s);
    });
  }

  async function exportPng(){
    try {
      status('Генерую PNG...');
      renderDecorations();
      if (previewMap) {
        lastPreviewState = { center: previewMap.getCenter(), zoom: previewMap.getZoom() };
        previewMap.invalidateSize();
        drawPreviewHeatmap();
      }
      await new Promise(r => setTimeout(r, 500));
      await loadHtml2Canvas();
      const canvas = await html2canvas(byId('#exportPreview'), {
        useCORS:true, allowTaint:true, backgroundColor:'#f8fafc', scale:2,
        onclone: doc => {
          const overlay = doc.querySelector('#exportOverlay');
          if (overlay) { overlay.style.zIndex = '9000'; overlay.style.display = 'block'; }
          ['#expTitleBox','#expLegendBox','#expNorthBox','#expScaleBox','#expKpiBox','#expInfoBox'].forEach(sel=>{
            const e = doc.querySelector(sel); if (e) e.style.zIndex = '9001';
          });
        }
      });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = (byId('#expName')?.value || 'vector-map') + '.png';
      a.click();
      status('PNG готовий.');
    } catch (e) { console.warn(e); status('Не вдалося створити PNG.'); }
  }

  function exportXlsx(){
    try {
      if (!window.XLSX) { status('XLSX бібліотека не завантажена.'); return; }
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(KEYS.map(k => ({ layer:NAMES[k], enabled:layerEnabled(k), count:count(k) }))), 'Кількість');
      const rows=[];
      KEYS.filter(k => k !== 'heatmap' && layerEnabled(k)).forEach(k => sourceLayers(k).forEach(l => {
        let p = l.getLatLng ? l.getLatLng() : null;
        if (!p && l.getBounds) p = l.getBounds().getCenter();
        rows.push({ layer:NAMES[k], lat:p?.lat || '', lon:p?.lng || '', radius_m:l.getRadius?.() || '' });
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Перелік');
      XLSX.writeFile(wb, (byId('#expName')?.value || 'vector-export') + '.xlsx');
      status('Excel готовий.');
    } catch(e){ console.warn(e); status('Не вдалося створити Excel.'); }
  }

  window.vectorExport = { button, open, close, exportPng, exportXlsx, version: VERSION };
  button();
  window.addEventListener('load', () => { button(); setInterval(button, 1000); });
})();