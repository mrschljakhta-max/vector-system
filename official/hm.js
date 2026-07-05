(() => {
let on=false,cv=null;
function M(){try{return window.vectorLeafletMap||window.vectorMap||eval('vectorMap')}catch{return null}}
function css(){if(document.querySelector('#hmcss'))return;let s=document.createElement('style');s.id='hmcss';s.textContent='.hm{position:fixed;right:92px;top:620px;width:54px;height:54px;z-index:100002;background:#090f1a;color:white;border:1px solid #555;border-radius:14px;font-weight:900}.hm.on{border-color:#d78219;color:#d78219}';document.head.appendChild(s)}
function btn(){css();if(document.querySelector('#hm'))return;let b=document.createElement('button');b.id='hm';b.className='hm';b.textContent='HM';b.onclick=toggle;document.body.appendChild(b)}
function pts(){let r=window.vectorLayerRegistry||{},a=[];['uav','stations','vp','sp','points'].forEach(k=>(r[k]||[]).forEach(l=>{let p=l.getLatLng?l.getLatLng():null;if(p)a.push([p.lat,p.lng])}));return a}
function draw(){let m=M();if(!m)return;clear();cv=document.createElement('canvas');cv.style.position='absolute';cv.style.pointerEvents='none';cv.style.zIndex='420';m.getPane('overlayPane').appendChild(cv);let p=pts();function red(){let z=m.getSize();cv.width=z.x;cv.height=z.y;let tl=m.containerPointToLayerPoint([0,0]);cv.style.width=z.x+'px';cv.style.height=z.y+'px';cv.style.transform='translate('+tl.x+'px,'+tl.y+'px)';let c=cv.getContext('2d');c.clearRect(0,0,cv.width,cv.height);p.forEach(x=>{let q=m.latLngToContainerPoint(x),g=c.createRadialGradient(q.x,q.y,0,q.x,q.y,36);g.addColorStop(0,'rgba(255,0,0,.4)');g.addColorStop(1,'rgba(255,0,0,0)');c.fillStyle=g;c.beginPath();c.arc(q.x,q.y,36,0,6.3);c.fill()})}window.hmRed=red;red();if(!m.hm){m.on('move zoom',()=>window.hmRed&&window.hmRed());m.hm=1}on=true;document.querySelector('#hm').classList.add('on')}
function clear(){cv&&cv.remove();cv=null;on=false;document.querySelector('#hm')?.classList.remove('on')}
function toggle(){on?clear():draw()}
window.addEventListener('load',()=>{btn();setInterval(btn,1000)});btn();
})();