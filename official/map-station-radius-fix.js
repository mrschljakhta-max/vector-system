(() => {
  const RADIUS_THRESHOLD_METERS = 1000;
  const NO_FILL_STYLE = {
    fillOpacity: 0,
    opacity: 0.62,
    weight: 1.15,
    color: '#15803D'
  };

  function isLeafletMap(map) {
    return Boolean(map && typeof map.eachLayer === 'function');
  }

  function getMap() {
    if (window.getVectorMap) {
      const map = window.getVectorMap({ create: false });
      if (isLeafletMap(map)) return map;
    }
    if (isLeafletMap(window.vectorLeafletMap)) return window.vectorLeafletMap;
    if (isLeafletMap(window.vectorMap)) return window.vectorMap;
    try {
      const map = eval('vectorMap');
      if (isLeafletMap(map)) return map;
    } catch {}
    return null;
  }

  function isGreenRadius(layer) {
    if (!layer || typeof layer.getRadius !== 'function' || typeof layer.setStyle !== 'function') return false;
    const radius = Number(layer.getRadius());
    if (!Number.isFinite(radius) || radius < RADIUS_THRESHOLD_METERS) return false;
    const options = layer.options || {};
    const color = String(options.color || options.fillColor || '').toUpperCase();
    return color === '#22C55E' || color === '#15803D';
  }

  function isSuppressedByCoverage(layer) {
    return Boolean(layer?.__vectorStationRadiusSuppressedByCoverage || layer?.__vectorStationRadiusSuppressedByPolygon);
  }

  function fixLayer(layer) {
    if (!isGreenRadius(layer)) return;
    if (isSuppressedByCoverage(layer)) return;
    layer.options.vectorLayerKey = layer.options.vectorLayerKey || 'stationRadius';
    layer.setStyle(NO_FILL_STYLE);
    const el = layer.getElement?.();
    if (el) {
      el.setAttribute('fill-opacity', '0');
      el.style.fillOpacity = '0';
    }
  }

  function fixRegistry() {
    const set = window.vectorLayerRegistry?.stationRadius;
    if (!set) return;
    set.forEach(fixLayer);
  }

  function fixMapLayers() {
    const map = getMap();
    if (!map) return;
    map.eachLayer((layer) => {
      fixLayer(layer);
      if (typeof layer.eachLayer === 'function') layer.eachLayer(fixLayer);
    });
  }

  function run() {
    fixRegistry();
    fixMapLayers();
  }

  window.vectorFixStationRadiusFill = run;
  window.addEventListener('load', () => {
    run();
    setInterval(run, 700);
  });
  document.addEventListener('click', () => setTimeout(run, 120));
  setTimeout(run, 0);
})();
