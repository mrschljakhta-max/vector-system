(() => {
  const STORAGE_KEY = 'vector-map-hidden-items-v1';
  const CONFIG = {
    map_settlement_summary: { layer:'summary', id:'settlement_id', title:'settlement_name', sub:'region' },
    map_uav_settlement_summary: { layer:'uav', id:'settlement_id', title:'settlement_name', sub:'uav_events_count' },
    dict_settlements: { layer:'settlements', id:'name', title:'name', sub:'region' },
    dict_stations: { layer:'stations', id:'station_code', title:'station_name', sub:'status_text' },
    dict_cover_objects: { layer:'cover', id:'object_name', title:'object_name', sub:'object_type' },
    map_routes: { layer:'routes', id:'route_code', title:'route_name', sub:'route_purpose' },
    map_points: { layer:'points', id:'point_code', title:'point_name', sub:'point_type' }
  };
  const LAYER_TO_TABLE = { summary:'map_settlement_summary', uav:'map_uav_settlement_summary', settlements:'dict_settlements', stations:'dict_stations', vp:'dict_cover_objects', sp:'dict_cover_objects', routes:'map_routes', points:'map_points' };
  const LAYER_TITLES = { summary:'Зведені НП', uav:'БпЛА', settlements:'Населені пункти', stations:'Станції', vp:'ВП', sp:'СП', routes:'Шляхи', points:'Пункти' };

  function readHidden(){ try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')||{};}catch{return{};} }
  function writeHidden(value){ localStorage.setItem(STORAGE_KEY, JSON.stringify(value||{})); }
  function hiddenFor(layer){ return new Set(readHidden()[layer]||[]); }
  function rowId(layer,row){ const table=LAYER_TO_TABLE[layer], cfg=CONFIG[table]; return String(row?.[cfg?.id] ?? row?.[cfg?.title] ?? ''); }
  function rowTitle(layer,row){ const table=LAYER_TO_TABLE[layer], cfg=CONFIG[table]; return String(row?.[cfg?.title] ?? rowId(layer,row)); }

  function patchSupabase(){
    if(!window.supabase || window.supabase.__vectorFilterPatched) return;
    const originalCreate = window.supabase.createClient.bind(window.supabase);
    window.supabase.createClient = function(...args){
      const client = originalCreate(...args);
      const originalFrom = client.from.bind(client);
      client.from = function(table){
        const query = originalFrom(table);
        const cfg = CONFIG[table];
        if(!cfg || query.__vectorWrapped) return query;
        const originalThen = query.then?.bind(query);
        if(originalThen){
          query.then = (resolve, reject) => originalThen((res) => {
            try{
              if(Array.isArray(res?.data) && !window.__vectorFilterBypass){
                const allHidden = readHidden();
                const layers = table === 'dict_cover_objects' ? ['vp','sp'] : [cfg.layer];
                const remove = new Set(layers.flatMap(layer => allHidden[layer] || []));
                if(remove.size) res = { ...res, data: res.data.filter(row => !remove.has(String(row?.[cfg.id] ?? row?.[cfg.title] ?? ''))) };
              }
            }catch{}
            return resolve ? resolve(res) : res;
          }, reject);
        }
        query.__vectorWrapped = true;
        return query;
      };
      return client;
    };
    window.supabase.__vectorFilterPatched = true;
  }

  async function rawFetch(layer){
    const table = LAYER_TO_TABLE[layer];
    if(!table || !window.supabase || !window.VECTOR_SUPABASE_URL || !window.VECTOR_SUPABASE_KEY) return [];
    window.__vectorFilterBypass = true;
    try{
      const client = window.supabase.createClient(window.VECTOR_SUPABASE_URL, window.VECTOR_SUPABASE_KEY);
      const { data } = await client.from(table).select('*').limit(2000);
      let rows = data || [];
      if(layer === 'vp') rows = rows.filter(r => String(r.object_type||r.type_code||'').toLowerCase().includes('вп') || String(r.type_code||'').toUpperCase()==='VP');
      if(layer === 'sp') rows = rows.filter(r => String(r.object_type||r.type_code||'').toLowerCase().includes('сп') || String(r.type_code||'').toUpperCase()==='SP');
      return rows;
    } finally { window.__vectorFilterBypass = false; }
  }

  function layerFromCard(card){
    const input = card.querySelector('input[value]');
    return input?.value || '';
  }

  function patchCards(){
    document.querySelectorAll('.map-data-card').forEach(card => {
      if(card.__vectorItemFilter) return;
      card.__vectorItemFilter = true;
      card.addEventListener('click', (event) => {
        if(event.target?.matches?.('input')) return;
        const layer = layerFromCard(card);
        if(LAYER_TO_TABLE[layer]) openFilter(layer);
      });
    });
  }

  async function openFilter(layer){
    const rows = await rawFetch(layer);
    const hidden = hiddenFor(layer);
    let modal = document.querySelector('#vectorItemFilterModal');
    if(!modal){
      modal = document.createElement('section');
      modal.id = 'vectorItemFilterModal';
      modal.style.cssText = 'position:fixed;inset:0;z-index:20000;background:rgba(0,0,0,.62);display:flex;align-items:center;justify-content:center;';
      document.body.appendChild(modal);
    }
    modal.innerHTML = '<div style="width:min(760px,92vw);max-height:82vh;overflow:auto;background:#15191d;border:1px solid #d78219;padding:18px;box-shadow:0 30px 80px rgba(0,0,0,.55)"><div style="display:flex;justify-content:space-between;gap:12px"><div><h2 style="margin:0;color:#fff;text-transform:uppercase;letter-spacing:.16em">'+esc(LAYER_TITLES[layer]||layer)+'</h2><p style="color:#aeb7c1;margin:6px 0 14px">Залиш галочку біля елементів, які потрібно показувати на карті.</p></div><button id="vfClose" style="background:none;border:0;color:#fff;font-size:28px;cursor:pointer">×</button></div><input id="vfSearch" placeholder="Пошук..." style="width:100%;box-sizing:border-box;margin-bottom:12px;padding:10px 12px;background:#0d1115;border:1px solid rgba(255,255,255,.15);color:#fff"><div style="display:flex;gap:8px;margin-bottom:12px"><button id="vfAll" class="map-data-btn">Вибрати всі</button><button id="vfNone" class="map-data-btn">Прибрати всі</button><button id="vfSave" class="map-data-btn map-data-btn--primary">Зберегти</button></div><div id="vfList" style="display:grid;gap:6px"></div></div>';
    const list = modal.querySelector('#vfList');
    const render = () => {
      const q = (modal.querySelector('#vfSearch').value || '').toLowerCase();
      list.innerHTML = rows.filter(r => rowTitle(layer,r).toLowerCase().includes(q)).map(r => {
        const id = rowId(layer,r);
        const sub = r.route_purpose || r.settlement_name || r.object_type || r.status_text || r.region || r.point_type || '';
        return '<label style="display:grid;grid-template-columns:24px 1fr;gap:10px;align-items:start;padding:9px 10px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);color:#fff"><input type="checkbox" data-id="'+esc(id)+'" '+(!hidden.has(id)?'checked':'')+'><span><b>'+esc(rowTitle(layer,r))+'</b><br><small style="color:#9da7b2">'+esc(sub)+'</small></span></label>';
      }).join('') || '<div style="color:#9da7b2;padding:20px">Нічого не знайдено.</div>';
    };
    modal.querySelector('#vfClose').onclick = () => modal.remove();
    modal.querySelector('#vfSearch').oninput = render;
    modal.querySelector('#vfAll').onclick = () => { hidden.clear(); render(); };
    modal.querySelector('#vfNone').onclick = () => { rows.forEach(r => hidden.add(rowId(layer,r))); render(); };
    modal.querySelector('#vfSave').onclick = () => {
      const next = new Set(hidden);
      modal.querySelectorAll('#vfList input[data-id]').forEach(input => input.checked ? next.delete(input.dataset.id) : next.add(input.dataset.id));
      const all = readHidden(); all[layer] = [...next]; writeHidden(all);
      modal.remove();
      const apply = document.querySelector('#mapDataApply');
      if(apply) apply.click();
    };
    render();
  }

  function esc(v){ return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  patchSupabase();
  window.addEventListener('load', () => { patchSupabase(); setInterval(patchCards, 700); });
  document.addEventListener('click', () => setTimeout(patchCards, 80));
})();