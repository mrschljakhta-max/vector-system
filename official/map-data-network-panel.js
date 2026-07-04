(() => {
  let client = null;
  const sb = () => client || (window.supabase && window.VECTOR_SUPABASE_URL && window.VECTOR_SUPABASE_KEY ? (client = window.supabase.createClient(window.VECTOR_SUPABASE_URL, window.VECTOR_SUPABASE_KEY)) : null);

  async function count(table) {
    const c = sb();
    if (!c) return '…';
    const { count } = await c.from(table).select('*', { count: 'exact', head: true });
    return count ?? '…';
  }

  async function inject() {
    const sections = document.querySelector('.map-data-sections');
    if (!sections || document.querySelector('#networkDataSection')) return;
    const routesCount = await count('map_routes');
    const pointsCount = await count('map_points');
    const state = window.vectorNetwork?.getState?.() || { routes: false, points: false };
    const section = document.createElement('section');
    section.id = 'networkDataSection';
    section.className = 'map-data-section';
    section.innerHTML = `
      <h3>Мережа</h3>
      <div class="map-data-grid">
        <label class="map-data-card ${state.routes ? 'is-active' : ''}" id="networkRoutesCard">
          <input type="checkbox" ${state.routes ? 'checked' : ''}>
          <span><strong><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#F97316;margin-right:8px"></i>Шляхи</strong><small>дороги між населеними пунктами з призначенням</small></span>
          <b class="map-data-count">${routesCount}</b>
        </label>
        <label class="map-data-card ${state.points ? 'is-active' : ''}" id="networkPointsCard">
          <input type="checkbox" ${state.points ? 'checked' : ''}>
          <span><strong><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#EC4899;margin-right:8px"></i>Пункти</strong><small>штаби, РЗ, РО, КП, КСП у населених пунктах</small></span>
          <b class="map-data-count">${pointsCount}</b>
        </label>
      </div>`;
    sections.insertBefore(section, sections.lastElementChild);
    section.querySelector('#networkRoutesCard input')?.addEventListener('change', e => {
      section.querySelector('#networkRoutesCard')?.classList.toggle('is-active', e.target.checked);
      window.vectorNetwork?.setRoutes?.(e.target.checked);
    });
    section.querySelector('#networkPointsCard input')?.addEventListener('change', e => {
      section.querySelector('#networkPointsCard')?.classList.toggle('is-active', e.target.checked);
      window.vectorNetwork?.setPoints?.(e.target.checked);
    });
  }

  const originalOpen = window.openMapDataDialog;
  function patchOpen() {
    if (window.openMapDataDialog && !window.openMapDataDialog.__networkPatched) {
      const old = window.openMapDataDialog;
      window.openMapDataDialog = function patchedOpenMapDataDialog() {
        old();
        setTimeout(inject, 120);
      };
      window.openMapDataDialog.__networkPatched = true;
    }
  }

  window.addEventListener('load', () => { patchOpen(); setTimeout(patchOpen, 500); setTimeout(inject, 900); });
  document.addEventListener('click', () => { setTimeout(patchOpen, 80); setTimeout(inject, 140); });
})();