(() => {
  let clusterGroup = null;
  let enabled = false;
  const hiddenLayers = new Set();

  const DEFAULT_DISTANCE_KM = 18;
  const DEFAULT_MIN_COUNT = 2;
  const STORAGE_KEY = 'vector-cluster-settings-v2';

  const TYPES = {
    summary: { label: 'Зведені НП', color: '#8B5CF6' },
    uav: { label: 'БпЛА', color: '#3B82F6' },
    stations: { label: 'Станції', color: '#22C55E' },
    vp: { label: 'ВП', color: '#EF4444' },
    sp: { label: 'СП', color: '#FACC15', text: '#111827' },
    points: { label: 'Пункти', color: '#EC4899' },
    settlements: { label: 'НП', color: '#94A3B8', text: '#111827' }
  };

  const COLOR_TO_TYPE = {
    '#8B5CF6': 'summary',
    '#3B82F6': 'uav',
    '#22C55E': 'stations',
    '#16A34A': 'stations',
    '#15803D': 'stations',
    '#EF4444': 'vp',
    '#DC2626': 'vp',
    '#FACC15': 'sp',
    '#B45309': 'sp',
    '#EC4899': 'points',
    '#DB2777': 'points',
    '#94A3B8': 'settlements',
    '#64748B': 'settlements'
  };

  function isMap(map) {
    return Boolean(map && typeof map.addLayer === 'function' && typeof map.fitBounds === 'function' && typeof map.eachLayer === 'function');
  }

  function getMap() {
    if (window.getVectorMap) {
      const map = window.getVectorMap({ create: false });
      if (isMap(map)) return map;
    }
    if (isMap(window.vectorLeafletMap)) return window.vectorLeafletMap;
    if (isMap(window.vectorMap)) return window.vectorMap;
    try {
      const map = eval('vectorMap');
      if (isMap(map)) {
        window.vectorLeafletMap = map;
        return map;
      }
    } catch {}
    return null;
  }

  function loadSettings() {
    try {
      return { distanceKm: DEFAULT_DISTANCE_KM, minCount: DEFAULT_MIN_COUNT, hideSource: true, ...(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}) };
    } catch {
      return { distanceKm: DEFAULT_DISTANCE_KM, minCount: DEFAULT_MIN_COUNT, hideSource: true };
    }
  }

  function saveSettings(settings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  function ensurePane(map) {
    let pane = map.getPane('vectorClusterPane');
    if (!pane) {
      pane = map.createPane('vectorClusterPane');
      pane.style.zIndex = 760;
      pane.style.pointerEvents = 'auto';
    }
    return 'vectorClusterPane';
  }

  function distanceKm(a, b) {
    const R = 6371;
    const dLat = (Number(b.lat) - Number(a.lat)) * Math.PI / 180;
    const dLon = (Number(b.lon) - Number(a.lon)) * Math.PI / 180;
    const lat1 = Number(a.lat) * Math.PI / 180;
    const lat2 = Number(b.lat) * Math.PI / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function buildClusters(items, distanceLimitKm, minCount) {
    const n = items.length;
    const parent = Array.from({ length: n }, (_, i) => i);
    const find = (i) => parent[i] === i ? i : (parent[i] = find(parent[i]));
    const unite = (a, b) => {
      a = find(a); b = find(b);
      if (a !== b) parent[b] = a;
    };
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        if (distanceKm(items[i], items[j]) <= distanceLimitKm) unite(i, j);
      }
    }
    const groups = {};
    items.forEach((item, i) => {
      const key = find(i);
      (groups[key] ||= []).push(item);
    });
    return Object.values(groups)
      .filter((group) => group.length >= minCount)
      .sort((a, b) => b.length - a.length);
  }

  function center(group) {
    return {
      lat: group.reduce((sum, item) => sum + Number(item.lat), 0) / group.length,
      lon: group.reduce((sum, item) => sum + Number(item.lon), 0) / group.length
    };
  }

  function normalizeColor(value) {
    if (!value) return '';
    const s = String(value).trim().toUpperCase();
    if (s.startsWith('#')) return s.length === 4 ? ('#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]).toUpperCase() : s;
    return s;
  }

  function inferType(layer, registryKey) {
    if (TYPES[registryKey]) return registryKey;
    const options = layer?.options || {};
    if (TYPES[options.vectorLayerKey]) return options.vectorLayerKey;
    const color = normalizeColor(options.fillColor || options.color);
    return COLOR_TO_TYPE[color] || null;
  }

  function isClusterableLayer(layer, registryKey) {
    if (!layer || typeof layer.getLatLng !== 'function') return false;
    const options = layer.options || {};
    if (options.vectorLabelLayer || options.vectorLayerKey === 'clusters') return false;
    if (registryKey && (registryKey.startsWith('labels') || ['stationRadius', 'polygons', 'grid', 'clusters', 'routes', 'other'].includes(registryKey))) return false;
    if (typeof layer.getRadius === 'function') {
      const radius = Number(layer.getRadius());
      if (Number.isFinite(radius) && radius > 1000) return false;
    }
    const latlng = layer.getLatLng();
    return Number.isFinite(Number(latlng?.lat)) && Number.isFinite(Number(latlng?.lng));
  }

  function isLayerVisible(layer) {
    if (!layer) return false;
    const element = layer.getElement?.();
    if (element && element.style.display === 'none' && !hiddenLayers.has(layer)) return false;
    const options = layer.options || {};
    if ((options.opacity === 0 || options.fillOpacity === 0) && !hiddenLayers.has(layer)) {
      const elementOpacity = element ? getComputedStyle(element).opacity : '';
      if (elementOpacity === '0') return false;
    }
    return true;
  }

  function extractLabel(layer, fallback) {
    try {
      const tooltip = layer.getTooltip?.();
      const content = tooltip?.getContent?.();
      if (content) return String(content).replace(/<[^>]*>/g, '').trim();
    } catch {}
    try {
      const popup = layer.getPopup?.();
      const content = popup?.getContent?.();
      if (content) {
        const div = document.createElement('div');
        div.innerHTML = String(content);
        const b = div.querySelector('b');
        return (b?.textContent || div.textContent || fallback).trim();
      }
    } catch {}
    return fallback;
  }

  function collectFromRegistry() {
    const result = [];
    const registry = window.vectorLayerRegistry || {};
    Object.entries(registry).forEach(([registryKey, set]) => {
      if (!set || typeof set.forEach !== 'function') return;
      set.forEach((layer) => {
        if (!isClusterableLayer(layer, registryKey) || !isLayerVisible(layer)) return;
        const type = inferType(layer, registryKey);
        if (!type) return;
        const latlng = layer.getLatLng();
        result.push({ layer, type, lat: Number(latlng.lat), lon: Number(latlng.lng), label: extractLabel(layer, TYPES[type].label) });
      });
    });
    return result;
  }

  function collectFromMap() {
    const map = getMap();
    const result = [];
    if (!map) return result;
    map.eachLayer((layer) => {
      if (!isClusterableLayer(layer, layer?.options?.vectorLayerKey) || !isLayerVisible(layer)) return;
      const type = inferType(layer, layer?.options?.vectorLayerKey);
      if (!type) return;
      const latlng = layer.getLatLng();
      result.push({ layer, type, lat: Number(latlng.lat), lon: Number(latlng.lng), label: extractLabel(layer, TYPES[type].label) });
    });
    return result;
  }

  function collectVisiblePoints() {
    restoreHiddenLayers();
    const seen = new Set();
    const merged = [];
    [...collectFromRegistry(), ...collectFromMap()].forEach((item) => {
      if (!item.layer || seen.has(item.layer)) return;
      seen.add(item.layer);
      merged.push(item);
    });
    return merged;
  }

  function rememberLayer(layer) {
    if (!layer.__vectorClusterOriginal) {
      const element = layer.getElement?.();
      layer.__vectorClusterOriginal = {
        style: layer.setStyle ? { opacity: layer.options?.opacity ?? 1, fillOpacity: layer.options?.fillOpacity ?? 0.72, weight: layer.options?.weight ?? 2 } : null,
        display: element?.style?.display || '',
        pointerEvents: element?.style?.pointerEvents || ''
      };
    }
  }

  function hideLayer(layer) {
    if (!layer) return;
    rememberLayer(layer);
    if (layer.setStyle) layer.setStyle({ opacity: 0, fillOpacity: 0, weight: 0 });
    const element = layer.getElement?.();
    if (element) {
      element.style.display = 'none';
      element.style.pointerEvents = 'none';
    }
    hiddenLayers.add(layer);
  }

  function restoreHiddenLayers() {
    hiddenLayers.forEach((layer) => {
      const original = layer.__vectorClusterOriginal;
      if (original?.style && layer.setStyle) layer.setStyle(original.style);
      const element = layer.getElement?.();
      if (element && original) {
        element.style.display = original.display;
        element.style.pointerEvents = original.pointerEvents;
      }
    });
    hiddenLayers.clear();
  }

  function ensureStyles() {
    if (document.querySelector('#vectorClusterStyles')) return;
    const style = document.createElement('style');
    style.id = 'vectorClusterStyles';
    style.textContent = `
      .clusterBtn{position:fixed;right:92px;top:428px;width:54px;height:54px;z-index:100002;border:1px solid rgba(255,255,255,.18);background:rgba(9,15,26,.96);color:#fff;border-radius:14px;cursor:pointer;font:900 16px Rajdhani,Arial;display:flex;align-items:center;justify-content:center;box-shadow:0 16px 38px rgba(0,0,0,.42)}
      .clusterBtn:hover,.clusterBtn.is-active{border-color:#d78219;color:#d78219}.clusterBtn__text{letter-spacing:.05em}
      #vectorClusterPanel{position:fixed;right:154px;top:420px;width:340px;max-height:58vh;overflow:auto;z-index:100003;display:none;padding:14px;border:1px solid rgba(215,130,25,.38);background:rgba(10,23,48,.94);box-shadow:0 24px 70px rgba(0,0,0,.45);font-family:Rajdhani,Arial,sans-serif;border-radius:16px;color:#fff}
      #vectorClusterPanel.is-open{display:block}.vcp-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}.vcp-head b{display:block;text-transform:uppercase;letter-spacing:.14em;font-size:20px}.vcp-head span{display:block;color:#b7c3d4;font-size:14px;margin-top:2px}.vcp-head button{background:none;border:0;color:#fff;font-size:26px;cursor:pointer}.vcp-status{color:#b7c3d4;font-size:14px;margin:8px 0 12px}.vcp-block{margin:12px 0}.vcp-label{display:flex;justify-content:space-between;align-items:center;gap:10px;color:#ffb055;font-weight:800;text-transform:uppercase;letter-spacing:.1em;margin-bottom:7px}.vcp-range{width:100%;accent-color:#d78219}.vcp-check{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid rgba(255,255,255,.1);background:rgba(17,35,68,.68);border-radius:10px;font-weight:700;letter-spacing:.06em}.vcp-check input{accent-color:#d78219}.vcp-actions{display:flex;gap:8px;margin-top:12px}.vcp-actions button{flex:1;padding:10px;border:1px solid rgba(215,130,25,.45);background:rgba(255,255,255,.05);color:#fff;text-transform:uppercase;font-weight:800;letter-spacing:.12em;cursor:pointer}.vcp-actions .main{background:rgba(215,130,25,.18);color:#ffb055}.clusterMark{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:var(--cluster-bg);border:2px solid var(--cluster-color);color:var(--cluster-text,#fff);font:900 18px Rajdhani,Arial;box-shadow:0 10px 28px rgba(0,0,0,.35),0 0 0 6px color-mix(in srgb,var(--cluster-color) 18%,transparent)}.clusterMark small{display:block;font-size:9px;line-height:1;margin-top:-3px;letter-spacing:.06em}.clusterPopup b{color:#d78219}.clusterPopup ul{margin:6px 0 0;padding-left:16px;max-height:180px;overflow:auto}.clusterSummary{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.clusterSummary span{border:1px solid rgba(255,255,255,.16);padding:3px 6px;border-radius:8px;background:rgba(255,255,255,.06);font-weight:800}
    `;
    document.head.appendChild(style);
  }

  function mountButton() {
    ensureStyles();
    let button = document.querySelector('#clusterBtn');
    if (!button) {
      button = document.createElement('button');
      button.id = 'clusterBtn';
      button.className = 'clusterBtn';
      button.type = 'button';
      button.title = 'Кластери активних елементів карти';
      button.innerHTML = '<span class="clusterBtn__text">CL</span>';
      button.addEventListener('click', togglePanel);
      document.body.appendChild(button);
    }
    button.style.display = 'flex';
  }

  function ensurePanel() {
    let panel = document.querySelector('#vectorClusterPanel');
    if (panel) return panel;
    const settings = loadSettings();
    panel = document.createElement('section');
    panel.id = 'vectorClusterPanel';
    panel.innerHTML = `
      <div class="vcp-head"><div><b>Кластери</b><span>Активні елементи карти групуються за типом і кольором.</span></div><button type="button" id="vcpClose">×</button></div>
      <div class="vcp-block"><label class="vcp-label"><span>Дистанція</span><strong id="clusterDistanceValue">${settings.distanceKm} км</strong></label><input id="clusterDistance" class="vcp-range" type="range" min="3" max="60" step="3" value="${settings.distanceKm}"></div>
      <div class="vcp-block"><label class="vcp-label"><span>Мінімум у кластері</span><strong id="clusterMinValue">${settings.minCount}</strong></label><input id="clusterMinCount" class="vcp-range" type="range" min="2" max="8" step="1" value="${settings.minCount}"></div>
      <label class="vcp-check"><input id="clusterHideSource" type="checkbox" ${settings.hideSource ? 'checked' : ''}>Приховати елементи, які увійшли в кластер</label>
      <div class="vcp-status" id="clusterStatus">Готово.</div>
      <div class="vcp-actions"><button type="button" id="clusterClear">Очистити</button><button type="button" class="main" id="clusterApply">Застосувати</button></div>
    `;
    document.body.appendChild(panel);
    panel.querySelector('#vcpClose').addEventListener('click', () => closePanel());
    panel.querySelector('#clusterApply').addEventListener('click', applyClusters);
    panel.querySelector('#clusterClear').addEventListener('click', clearClusters);
    panel.querySelector('#clusterDistance').addEventListener('input', syncSettingsUi);
    panel.querySelector('#clusterMinCount').addEventListener('input', syncSettingsUi);
    panel.querySelector('#clusterHideSource').addEventListener('change', syncSettingsUi);
    syncSettingsUi();
    return panel;
  }

  function syncSettingsUi() {
    const distance = Number(document.querySelector('#clusterDistance')?.value || DEFAULT_DISTANCE_KM);
    const minCount = Number(document.querySelector('#clusterMinCount')?.value || DEFAULT_MIN_COUNT);
    const hideSource = Boolean(document.querySelector('#clusterHideSource')?.checked);
    const distanceValue = document.querySelector('#clusterDistanceValue');
    const minValue = document.querySelector('#clusterMinValue');
    if (distanceValue) distanceValue.textContent = distance + ' км';
    if (minValue) minValue.textContent = String(minCount);
    saveSettings({ distanceKm: distance, minCount, hideSource });
  }

  function status(text) {
    const element = document.querySelector('#clusterStatus');
    if (element) element.textContent = text;
  }

  function togglePanel() {
    const panel = ensurePanel();
    panel.classList.toggle('is-open');
    document.querySelector('#clusterBtn')?.classList.toggle('is-active', panel.classList.contains('is-open') || enabled);
    if (panel.classList.contains('is-open')) {
      const points = collectVisiblePoints();
      const totals = summarize(points);
      status('Активних точкових елементів: ' + points.length + formatSummary(totals));
    }
  }

  function closePanel() {
    document.querySelector('#vectorClusterPanel')?.classList.remove('is-open');
    document.querySelector('#clusterBtn')?.classList.toggle('is-active', enabled);
  }

  function ensureGroup(map) {
    if (!clusterGroup) clusterGroup = window.L.layerGroup().addTo(map);
    else clusterGroup.clearLayers();
    return clusterGroup;
  }

  function markerHtml(count, type) {
    const meta = TYPES[type] || { color: '#d78219', label: 'CL' };
    return '<div class="clusterMark" style="--cluster-color:' + meta.color + ';--cluster-bg:' + hexToRgba(meta.color, 0.92) + ';--cluster-text:' + (meta.text || '#fff') + '"><span>' + count + '</span><small>' + escapeHtml(shortLabel(type)) + '</small></div>';
  }

  function shortLabel(type) {
    return type === 'stations' ? 'СТ' : type === 'uav' ? 'БПЛА' : type === 'points' ? 'ПНКТ' : type === 'summary' ? 'НП' : (TYPES[type]?.label || 'CL');
  }

  function popupHtml(group, index, distance) {
    const type = group[0]?.type;
    const list = group.slice(0, 60).map((item) => '<li>' + escapeHtml(item.label || TYPES[type]?.label || 'Елемент') + '</li>').join('');
    return '<div class="clusterPopup"><b>Кластер ' + index + ' — ' + escapeHtml(TYPES[type]?.label || type) + '</b><br>Елементів: ' + group.length + '<br>Поріг: ' + distance + ' км<ul>' + list + '</ul></div>';
  }

  function addToLayerRegistry(layer) {
    window.vectorLayerRegistry = window.vectorLayerRegistry || {};
    window.vectorLayerRegistry.clusters = window.vectorLayerRegistry.clusters || new Set();
    window.vectorLayerRegistry.clusters.add(layer);
  }

  function drawCluster(map, group, index, settings) {
    const pane = ensurePane(map);
    const c = center(group);
    const type = group[0].type;
    const meta = TYPES[type] || { color: '#d78219' };
    const icon = window.L.divIcon({ className: '', html: markerHtml(group.length, type), iconSize: [48, 48], iconAnchor: [24, 24] });
    const marker = window.L.marker([c.lat, c.lon], { pane, icon, vectorLayerKey: 'clusters' })
      .bindPopup(popupHtml(group, index, settings.distanceKm))
      .addTo(clusterGroup);
    addToLayerRegistry(marker);
    if (settings.hideSource) group.forEach((item) => hideLayer(item.layer));
    if (group.length >= 3) {
      const radius = Math.max(900, (Math.max(...group.map((item) => distanceKm(c, item))) + 0.8) * 1000);
      const circle = window.L.circle([c.lat, c.lon], { pane, vectorLayerKey: 'clusters', radius, color: meta.color, weight: 1, opacity: 0.38, fill: false, dashArray: '4 8', interactive: false }).addTo(clusterGroup);
      addToLayerRegistry(circle);
    }
  }

  function groupByType(points) {
    return points.reduce((acc, item) => {
      (acc[item.type] ||= []).push(item);
      return acc;
    }, {});
  }

  function summarize(points) {
    return points.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {});
  }

  function formatSummary(totals) {
    const parts = Object.entries(totals).map(([type, count]) => (TYPES[type]?.label || type) + ': ' + count);
    return parts.length ? ' (' + parts.join(', ') + ')' : '';
  }

  async function applyClusters() {
    const map = getMap();
    if (!map || !window.L) {
      status('Карта ще не ініціалізована.');
      return;
    }
    syncSettingsUi();
    const settings = loadSettings();
    ensureGroup(map);
    clusterGroup.clearLayers();
    restoreHiddenLayers();
    const points = collectVisiblePoints();
    if (!points.length) {
      enabled = false;
      document.querySelector('#clusterBtn')?.classList.remove('is-active');
      status('Немає активних точкових елементів для кластеризації. Спочатку увімкни дані карти.');
      return;
    }
    let clusterCount = 0;
    Object.entries(groupByType(points)).forEach(([type, items]) => {
      const groups = buildClusters(items, settings.distanceKm, settings.minCount);
      groups.forEach((group) => {
        clusterCount += 1;
        drawCluster(map, group, clusterCount, settings);
      });
    });
    enabled = clusterCount > 0;
    document.querySelector('#clusterBtn')?.classList.toggle('is-active', enabled);
    if (!clusterCount) {
      status('Кластерів не знайдено. Збільш дистанцію або зменш мінімум.');
      return;
    }
    status('Побудовано кластерів: ' + clusterCount + '. Активних елементів: ' + points.length + formatSummary(summarize(points)) + '.');
    try { map.fitBounds(clusterGroup.getBounds(), { padding: [40, 40] }); } catch {}
  }

  function clearClusters() {
    if (clusterGroup) clusterGroup.clearLayers();
    restoreHiddenLayers();
    enabled = false;
    document.querySelector('#clusterBtn')?.classList.remove('is-active');
    status('Кластери очищено. Елементи карти повернено.');
  }

  function hexToRgba(hex, alpha) {
    const value = String(hex || '#d78219').replace('#', '');
    const bigint = parseInt(value.length === 3 ? value.split('').map((x) => x + x).join('') : value, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  window.vectorClusters = { apply: applyClusters, clear: clearClusters, collect: collectVisiblePoints };

  function boot() {
    mountButton();
    ensurePanel();
  }

  window.addEventListener('load', () => {
    boot();
    setInterval(boot, 1000);
  });
  document.addEventListener('click', () => setTimeout(() => { boot(); if (enabled) applyClusters(); }, 180));
  setTimeout(boot, 0);
})();
