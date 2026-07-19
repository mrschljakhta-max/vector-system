(()=>{"use strict";
const FLAG="__vectorUntangleGuard";
const clone=v=>Array.isArray(v)?v.map(clone):L.latLng(v.lat,v.lng);
const point=v=>v&&Number.isFinite(v.lat)&&Number.isFinite(v.lng);
function rings(value,out=[]){
  if(!Array.isArray(value)||!value.length)return out;
  if(point(value[0])){out.push(value);return out}
  value.forEach(v=>rings(v,out));return out
}
function orient(a,b,c){
  const v=(b.lng-a.lng)*(c.lat-a.lat)-(b.lat-a.lat)*(c.lng-a.lng);
  return Math.abs(v)<1e-12?0:v>0?1:-1
}
function onSegment(a,b,c){
  return b.lng<=Math.max(a.lng,c.lng)+1e-12&&b.lng>=Math.min(a.lng,c.lng)-1e-12&&b.lat<=Math.max(a.lat,c.lat)+1e-12&&b.lat>=Math.min(a.lat,c.lat)-1e-12
}
function intersects(a,b,c,d){
  const o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b);
  if(o1!==o2&&o3!==o4)return true;
  return o1===0&&onSegment(a,c,b)||o2===0&&onSegment(a,d,b)||o3===0&&onSegment(c,a,d)||o4===0&&onSegment(c,b,d)
}
function ringCrosses(r){
  const n=r.length;if(n<4)return false;
  const closed=r[0].equals?.(r[n-1])||Math.abs(r[0].lat-r[n-1].lat)<1e-12&&Math.abs(r[0].lng-r[n-1].lng)<1e-12;
  const count=closed?n-1:n;
  for(let i=0;i<count;i++){
    const a=r[i],b=r[(i+1)%count];
    for(let j=i+1;j<count;j++){
      if(j===i||j===(i+1)%count||i===(j+1)%count)continue;
      if(i===0&&j===count-1)continue;
      const c=r[j],d=r[(j+1)%count];
      if(intersects(a,b,c,d))return true
    }
  }
  return false
}
function invalid(latlngs){return rings(latlngs).some(ringCrosses)}
function refresh(layer,options){
  const stable=clone(layer.getLatLngs());
  layer.pm?.disable();layer.setLatLngs(stable);layer.pm?.enable(options)
}
function guard(layer){
  if(layer[FLAG]||!layer.getLatLngs||!layer.pm)return;
  layer[FLAG]=true;
  let lastValid=clone(layer.getLatLngs()),frame=0;
  const options={allowSelfIntersection:false,snappable:true,snapDistance:18,hideMiddleMarkers:true};
  layer.on("pm:markerdragstart",()=>{lastValid=clone(layer.getLatLngs())});
  layer.on("pm:markerdrag",()=>{
    if(frame)return;
    frame=requestAnimationFrame(()=>{
      frame=0;
      const now=layer.getLatLngs();
      if(invalid(now))layer.setLatLngs(clone(lastValid));
      else lastValid=clone(now)
    })
  });
  layer.on("pm:markerdragend",()=>{
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const now=layer.getLatLngs();
      if(invalid(now)){
        layer.setLatLngs(clone(lastValid));
        refresh(layer,options);
        const status=document.querySelector("#vtStatus");
        if(status)status.textContent="Самоперетин заблоковано: межу повернуто до останньої коректної форми."
      }else lastValid=clone(now)
    }))
  })
}
function scan(){
  const map=window.getVectorMap?.()||window.vectorLeafletMap||window.vectorMap;
  if(!map?.eachLayer)return;
  map.eachLayer(layer=>{
    if(layer?.getLatLngs&&layer?.pm)guard(layer);
    layer?.eachLayer?.(child=>child?.getLatLngs&&child?.pm&&guard(child))
  })
}
setInterval(scan,350);setTimeout(scan,600)
})();
