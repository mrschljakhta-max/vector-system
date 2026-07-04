(() => {
  const STYLE_ID = 'vectorLabelCollisionStyles';
  const LABEL_SELECTOR = '.vector-map-label';
  const PADDING = 4;
  const OFFSETS = [
    [0,0],[0,18],[0,-18],[18,0],[-18,0],[18,18],[-18,18],[18,-18],[-18,-18],
    [0,34],[34,0],[-34,0],[0,-34],[34,18],[-34,18],[34,-18],[-34,-18],
    [18,34],[-18,34],[18,-34],[-18,-34],[0,52],[52,0],[-52,0],[0,-52]
  ];
  let timer = null;

  function ensureStyle(){
    if(document.querySelector('#'+STYLE_ID)) return;
    const s=document.createElement('style');
    s.id=STYLE_ID;
    s.textContent = `
      .vector-map-label{overflow:visible!important;}
      .vector-map-label__text{display:inline-block;will-change:transform,opacity;transition:transform .12s ease,opacity .12s ease;}
      .vector-map-label.is-label-hidden .vector-map-label__text{opacity:0!important;}
    `;
    document.head.appendChild(s);
  }

  function rectWithPad(el){
    const r = el.getBoundingClientRect();
    return {left:r.left-PADDING, right:r.right+PADDING, top:r.top-PADDING, bottom:r.bottom+PADDING, width:r.width, height:r.height};
  }
  function intersects(a,b){ return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom); }
  function inViewport(r){ return r.right>0 && r.bottom>0 && r.left<window.innerWidth && r.top<window.innerHeight; }

  function arrange(){
    ensureStyle();
    const labels=[...document.querySelectorAll(LABEL_SELECTOR)]
      .filter(el=>el.offsetParent!==null)
      .map(el=>({el, txt:el.querySelector('.vector-map-label__text')||el, base:rectWithPad(el)}))
      .filter(x=>x.base.width>0 && x.base.height>0 && inViewport(x.base))
      .sort((a,b)=>a.base.top-b.base.top || a.base.left-b.base.left);

    const accepted=[];
    for(const item of labels){
      item.el.classList.remove('is-label-hidden');
      let placed=false;
      for(const [dx,dy] of OFFSETS){
        item.txt.style.transform = `translate(${dx}px, ${dy}px)`;
        const r=rectWithPad(item.txt);
        if(!inViewport(r)) continue;
        if(!accepted.some(a=>intersects(r,a))){ accepted.push(r); placed=true; break; }
      }
      if(!placed){
        item.txt.style.transform='translate(0,0)';
        item.el.classList.add('is-label-hidden');
      }
    }
  }

  function schedule(){ clearTimeout(timer); timer=setTimeout(arrange,90); }
  function hookMap(){
    const map = window.vectorLeafletMap || window.vectorMap;
    if(map && !map.__vectorLabelCollisionHooked){
      map.on?.('zoomend moveend layeradd layerremove resize', schedule);
      map.__vectorLabelCollisionHooked = true;
    }
  }
  function boot(){ ensureStyle(); hookMap(); schedule(); }
  window.vectorArrangeLabels = schedule;
  window.addEventListener('load',()=>{ boot(); setInterval(boot,900); });
  window.addEventListener('resize', schedule);
  document.addEventListener('click',()=>setTimeout(schedule,180));
})();