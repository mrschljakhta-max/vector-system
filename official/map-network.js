(() => {
  let client = null;
  let routeGroup = null;
  let pointGroup = null;
  let routeVisible = false;
  let pointVisible = false;

  const sb = () => client || (window.supabase && window.VECTOR_SUPABASE_URL && window.VECTOR_SUPABASE_KEY ? (client = window.supabase.createClient(window.VECTOR_SUPABASE_URL, window.VECTOR_SUPABASE_KEY)) : null);
  const isMap = m => !!(m && typeof m.addLayer === 'function' && typeof m.fitBounds === 'function');
  function map() {
    const m = window.getVectorMap?.() || window.vectorLeafletMap || window.vectorMap || null;
    return isMap(m) ? m : null;
  }

  function loadScriptOnce(src){
    if(document.querySelector('script[src^="'+src.split('?')[0]+'"]')) return;
    const s=document.createElement('script');
    s.src=src;
    s.defer=true;
    document.head.appendChild(s);
  }

  function mount() {
    loadScriptOnce('./map-label-collision.js?v=20260704-1');
    loadScriptOnce('./map-clusters.js?v=20260704-1');
    loadScriptOnce('./map-grid.js?v=20260704-1');
    loadScriptOnce('./hm.js?v=20260705-1');
    const nav = document.querySelector('.hover-nav--right');
    if (!nav || document.querySelector('#networkBtn')) return;
    const b = document.createElement('button');
    b.id = 'networkBtn';
    b.className = 'hover-nav__item';
    b.type = 'button';
    b.innerHTML = '<span class="nav-icon-text">⌁</span><span>Мережа</span>';
    b.onclick = () => window.vectorNetwork.setAll(!(routeVisible || pointVisible));
    nav.appendChild(b);
  }

  async function setRoutes(on) {
    routeVisible = on;
    if (!routeGroup) routeGroup = window.L.layerGroup().addTo(map());
    routeGroup.clearLayers();
    if (!on) return syncUi();
    const c = sb(), m = map();
    if (!c || !m) return;
    const { data, error } = await c.from('map_routes').select('*').limit(300);
    if (!error) (data || []).forEach(r => {
      const a = [Number(r.from_lat), Number(r.from_lon)], b = [Number(r.to_lat), Number(r.to_lon)];
      if (a.every(Number.isFinite) && b.every(Number.isFinite)) {
        window.L.polyline([a, b], { color: '#F97316', weight: 4, opacity: .78 })
          .bindPopup('<b>' + esc(r.route_name) + '</b><br>Шлях<br>' + esc(r.from_name) + ' → ' + esc(r.to_name) + '<br>Призначення: ' + esc(r.route_purpose || '—'))
          .addTo(routeGroup);
      }
    });
    fit(); syncUi();
  }

  async function setPoints(on) {
    pointVisible = on;
    if (!pointGroup) pointGroup = window.L.layerGroup().addTo(map());
    pointGroup.clearLayers();
    if (!on) return syncUi();
    const c = sb(), m = map();
    if (!c || !m) return;
    const { data, error } = await c.from('map_points').select('*').limit(300);
    if (!error) (data || []).forEach(p => {
      const lat = Number(p.lat), lon = Number(p.lon);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        window.L.circleMarker([lat, lon], { color: '#EC4899', fillColor: '#EC4899', radius: 8, weight: 2, fillOpacity: .8 })
          .bindPopup('<b>' + esc(p.point_name) + '</b><br>' + esc(p.point_type) + '<br>НП: ' + esc(p.settlement_name || '—'))
          .addTo(pointGroup);
      }
    });
    fit(); syncUi();
  }

  function fit() {
    const m = map();
    const layers = [...(routeGroup?.getLayers() || []), ...(pointGroup?.getLayers() || [])];
    if (!m || !layers.length) return;
    try {
      const fg = window.L.featureGroup(layers);
      m.fitBounds(fg.getBounds(), { padding: [40, 40] });
    } catch {}
  }

  function syncUi() {
    document.querySelector('#networkBtn')?.classList.toggle('is-active', routeVisible || pointVisible);
    document.querySelector('#networkRoutesCard input') && (document.querySelector('#networkRoutesCard input').checked = routeVisible);
    document.querySelector('#networkPointsCard input') && (document.querySelector('#networkPointsCard input').checked = pointVisible);
    window.vectorArrangeLabels?.();
  }

  function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  window.vectorNetwork = {
    setRoutes,
    setPoints,
    setAll: async (on) => { await setRoutes(on); await setPoints(on); },
    getState: () => ({ routes: routeVisible, points: pointVisible })
  };

  window.addEventListener('load', () => { mount(); setTimeout(mount, 800); });
  document.addEventListener('click', () => setTimeout(mount, 150));
})();