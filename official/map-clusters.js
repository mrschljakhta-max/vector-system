(() => {
  let client = null;
  let clusterGroup = null;
  let stations = [];
  let enabled = false;

  const DEFAULT_DISTANCE_KM = 30;
  const DEFAULT_MIN_COUNT = 2;
  const STORAGE_KEY = 'vector-cluster-settings-v1';

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

  function supabaseClient() {
    if (client) return client;
    if (!window.supabase || !window.VECTOR_SUPABASE_URL || !window.VECTOR_SUPABASE_KEY) return null;
    client = window.supabase.createClient(window.VECTOR_SUPABASE_URL, window.VECTOR_SUPABASE_KEY);
    return client;
  }

  function loadSettings() {
    try {
      return { distanceKm: DEFAULT_DISTANCE_KM, minCount: DEFAULT_MIN_COUNT, showEnvelope: true, ...(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}) };
    } catch {
      return { distanceKm: DEFAULT_DISTANCE_KM, minCount: DEFAULT_MIN_COUNT, showEnvelope: true };
    }
  }

  function saveSettings(settings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  function ensurePane(map) {
    let pane = map.getPane('vectorClusterPane');
    if (!pane) {
      pane = map.createPane('vectorClusterPane');
      pane.style.zIndex = 720;
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

  function radiusMeters(centerPoint, group) {
    const maxKm = Math.max(...group.map((item) => distanceKm(centerPoint, item)), 0);
    return Math.max(1200, (maxKm + 1.5) * 1000);
  }

  function ensureStyles() {
    if (document.querySelector('#vectorClusterStyles')) return;
    const style = document.createElement('style');
    style.id = 'vectorClusterStyles';
    style.textContent = `
      .clusterBtn{position:fixed;right:92px;top:428px;width:54px;height:54px;z-index:100002;border:1px solid rgba(255,255,255,.18);background:rgba(9,15,26,.96);color:#fff;border-radius:14px;cursor:pointer;font:900 16px Rajdhani,Arial;display:flex;align-items:center;justify-content:center;box-shadow:0 16px 38px rgba(0,0,0,.42)}
      .clusterBtn:hover,.clusterBtn.is-active{border-color:#d78219;color:#d78219}.clusterBtn__text{letter-spacing:.05em}
      #vectorClusterPanel{position:fixed;right:154px;top:420px;width:340px;max-height:58vh;overflow:auto;z-index:100003;display:none;padding:14px;border:1px solid rgba(215,130,25,.38);background:rgba(10,23,48,.94);box-shadow:0 24px 70px rgba(0,0,0,.45);font-family:Rajdhani,Arial,sans-serif;border-radius:16px;color:#fff}
      #vectorClusterPanel.is-open{display:block}.vcp-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}.vcp-head b{display:block;text-transform:uppercase;letter-spacing:.14em;font-size:20px}.vcp-head span{display:block;color:#b7c3d4;font-size:14px;margin-top:2px}.vcp-head button{background:none;border:0;color:#fff;font-size:26px;cursor:pointer}.vcp-status{color:#b7c3d4;font-size:14px;margin:8px 0 12px}.vcp-block{margin:12px 0}.vcp-label{display:flex;justify-content:space-between;align-items:center;gap:10px;color:#ffb055;font-weight:800;text-transform:uppercase;letter-spacing:.1em;margin-bottom:7px}.vcp-range{width:100%;accent-color:#d78219}.vcp-check{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid rgba(255,255,255,.1);background:rgba(17,35,68,.68);border-radius:10px;font-weight:700;letter-spacing:.06em}.vcp-check input{accent-color:#d78219}.vcp-actions{display:flex;gap:8px;margin-top:12px}.vcp-actions button{flex:1;padding:10px;border:1px solid rgba(215,130,25,.45);background:rgba(255,255,255,.05);color:#fff;text-transform:uppercase;font-weight:800;letter-spacing:.12em;cursor:pointer}.vcp-actions .main{background:rgba(215,130,25,.18);color:#ffb055}.clusterMark{width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(9,15,26,.92);border:2px solid #d78219;color:#ffb055;font:900 18px Rajdhani,Arial;box-shadow:0 10px 28px rgba(0,0,0,.35),0 0 0 6px rgba(215,130,25,.14)}.clusterPopup b{color:#d78219}.clusterPopup ul{margin:6px 0 0;padding-left:16px;max-height:180px;overflow:auto}
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
      button.title = 'Кластери станцій';
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
      <div class="vcp-head"><div><b>Кластери</b><span>Групування станцій за відстанню між точками.</span></div><button type="button" id="vcpClose">×</button></div>
      <div class="vcp-block"><label class="vcp-label"><span>Дистанція</span><strong id="clusterDistanceValue">${settings.distanceKm} км</strong></label><input id="clusterDistance" class="vcp-range" type="range" min="5" max="80" step="5" value="${settings.distanceKm}"></div>
      <div class="vcp-block"><label class="vcp-label"><span>Мінімум у кластері</span><strong id="clusterMinValue">${settings.minCount}</strong></label><input id="clusterMinCount" class="vcp-range" type="range" min="2" max="8" step="1" value="${settings.minCount}"></div>
      <label class="vcp-check"><input id="clusterEnvelope" type="checkbox" ${settings.showEnvelope ? 'checked' : ''}>Показати тонкий контур кластера</label>
      <div class="vcp-status" id="clusterStatus">Готово.</div>
      <div class="vcp-actions"><button type="button" id="clusterClear">Очистити</button><button type="button" class="main" id="clusterApply">Застосувати</button></div>
    `;
    document.body.appendChild(panel);
    panel.querySelector('#vcpClose').addEventListener('click', () => closePanel());
    panel.querySelector('#clusterApply').addEventListener('click', applyClusters);
    panel.querySelector('#clusterClear').addEventListener('click', clearClusters);
    panel.querySelector('#clusterDistance').addEventListener('input', syncSettingsUi);
    panel.querySelector('#clusterMinCount').addEventListener('input', syncSettingsUi);
    panel.querySelector('#clusterEnvelope').addEventListener('change', syncSettingsUi);
    syncSettingsUi();
    return panel;
  }

  function syncSettingsUi() {
    const distance = Number(document.querySelector('#clusterDistance')?.value || DEFAULT_DISTANCE_KM);
    const minCount = Number(document.querySelector('#clusterMinCount')?.value || DEFAULT_MIN_COUNT);
    const showEnvelope = Boolean(document.querySelector('#clusterEnvelope')?.checked);
    const distanceValue = document.querySelector('#clusterDistanceValue');
    const minValue = document.querySelector('#clusterMinValue');
    if (distanceValue) distanceValue.textContent = distance + ' км';
    if (minValue) minValue.textContent = String(minCount);
    saveSettings({ distanceKm: distance, minCount, showEnvelope });
  }

  function status(text) {
    const element = document.querySelector('#clusterStatus');
    if (element) element.textContent = text;
  }

  function togglePanel() {
    const panel = ensurePanel();
    panel.classList.toggle('is-open');
    document.querySelector('#clusterBtn')?.classList.toggle('is-active', panel.classList.contains('is-open') || enabled);
    if (panel.classList.contains('is-open')) loadStations();
  }

  function closePanel() {
    document.querySelector('#vectorClusterPanel')?.classList.remove('is-open');
    document.querySelector('#clusterBtn')?.classList.toggle('is-active', enabled);
  }

  async function loadStations() {
    if (stations.length) {
      status('Станцій у памʼяті: ' + stations.length + '.');
      return stations;
    }
    const client = supabaseClient();
    if (!client) {
      status('Supabase не підключено.');
      return [];
    }
    status('Завантажую станції...');
    const { data, error } = await client
      .from('dict_stations')
      .select('station_name,station_code,lat,lon,coverage_radius_km,is_active')
      .eq('is_active', true)
      .limit(1000);
    if (error) {
      console.warn(error);
      status('Помилка: ' + error.message);
      stations = [];
      return [];
    }
    stations = (data || []).filter((row) => Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lon)));
    status('Завантажено станцій: ' + stations.length + '.');
    return stations;
  }

  function ensureGroup(map) {
    if (!clusterGroup) clusterGroup = window.L.layerGroup().addTo(map);
    else clusterGroup.clearLayers();
    return clusterGroup;
  }

  function markerHtml(count) {
    return '<div class="clusterMark">' + count + '</div>';
  }

  function popupHtml(group, index, distance) {
    const list = group
      .slice()
      .sort((a, b) => String(a.station_name || '').localeCompare(String(b.station_name || ''), 'uk'))
      .map((item) => '<li>' + String(item.station_name || item.station_code || 'Станція') + '</li>')
      .join('');
    return '<div class="clusterPopup"><b>Кластер ' + index + '</b><br>Станцій: ' + group.length + '<br>Поріг: ' + distance + ' км<ul>' + list + '</ul></div>';
  }

  function addToLayerRegistry(layer) {
    window.vectorLayerRegistry = window.vectorLayerRegistry || {};
    window.vectorLayerRegistry.clusters = window.vectorLayerRegistry.clusters || new Set();
    window.vectorLayerRegistry.clusters.add(layer);
  }

  function drawCluster(map, group, index, settings) {
    const pane = ensurePane(map);
    const c = center(group);
    const icon = window.L.divIcon({ className: '', html: markerHtml(group.length), iconSize: [48, 48], iconAnchor: [24, 24] });
    if (settings.showEnvelope) {
      const circle = window.L.circle([c.lat, c.lon], {
        pane,
        vectorLayerKey: 'clusters',
        radius: radiusMeters(c, group),
        color: '#d78219',
        weight: 1.2,
        opacity: 0.58,
        fill: false,
        dashArray: '6 8',
        interactive: false
      }).addTo(clusterGroup);
      addToLayerRegistry(circle);
    }
    const marker = window.L.marker([c.lat, c.lon], { pane, icon, vectorLayerKey: 'clusters' })
      .bindPopup(popupHtml(group, index, settings.distanceKm))
      .addTo(clusterGroup);
    addToLayerRegistry(marker);
  }

  async function applyClusters() {
    const map = getMap();
    if (!map || !window.L) {
      status('Карта ще не ініціалізована.');
      return;
    }
    syncSettingsUi();
    const settings = loadSettings();
    const rows = await loadStations();
    if (!rows.length) {
      status('Немає станцій із координатами.');
      return;
    }
    const groups = buildClusters(rows, settings.distanceKm, settings.minCount);
    const layer = ensureGroup(map);
    if (!groups.length) {
      enabled = false;
      document.querySelector('#clusterBtn')?.classList.remove('is-active');
      status('Кластерів не знайдено. Збільш дистанцію або зменш мінімум.');
      return;
    }
    groups.forEach((group, index) => drawCluster(map, group, index + 1, settings));
    enabled = true;
    document.querySelector('#clusterBtn')?.classList.add('is-active');
    status('Побудовано кластерів: ' + groups.length + '.');
    try { map.fitBounds(layer.getBounds(), { padding: [40, 40] }); } catch {}
  }

  function clearClusters() {
    if (clusterGroup) clusterGroup.clearLayers();
    enabled = false;
    document.querySelector('#clusterBtn')?.classList.remove('is-active');
    status('Кластери очищено.');
  }

  window.vectorClusters = { apply: applyClusters, clear: clearClusters, load: loadStations };

  function boot() {
    mountButton();
    ensurePanel();
  }

  window.addEventListener('load', () => {
    boot();
    setInterval(boot, 1000);
  });
  document.addEventListener('click', () => setTimeout(boot, 120));
  setTimeout(boot, 0);
})();
