const root=document.documentElement;
const themeToggle=document.querySelector('#themeToggle');
const themeLabel=document.querySelector('#themeLabel');
const authModal=document.querySelector('#authModal');
const openLogin=document.querySelector('#openLogin');
const closeModal=document.querySelector('#closeModal');
const loginForm=document.querySelector('#loginForm');
const registerForm=document.querySelector('#registerForm');
const landingScreen=document.querySelector('#landingScreen');
const workspace=document.querySelector('#workspace');
const clearFiles=document.querySelector('#clearFiles');
const fileList=document.querySelector('#fileList');

function ensureAnalyticsWorkspace(){
  const leftNav=document.querySelector('.hover-nav--left');
  const refsBtn=leftNav?.querySelector('[data-section="refs"]');
  if(leftNav && !leftNav.querySelector('[data-section="analytics"]')){
    const btn=document.createElement('button');
    btn.className='hover-nav__item nav__item';
    btn.dataset.section='analytics';
    btn.type='button';
    btn.setAttribute('aria-label','Аналітика');
    btn.innerHTML='<span class="nav-icon-text">◈</span><span>Аналітика</span>';
    btn.addEventListener('click',()=>showSection('analytics'));
    leftNav.insertBefore(btn,refsBtn || leftNav.querySelector('.hover-nav__item--bottom'));
  }
  const content=document.querySelector('.map-shell.content');
  const refs=document.querySelector('#refs');
  if(content && !document.querySelector('#analytics')){
    const article=document.createElement('article');
    article.className='section analytics-section';
    article.id='analytics';
    article.dataset.title='Аналітика';
    content.insertBefore(article,refs || null);
  }
}
function injectAsset(tag,attrs){
  const base=(attrs.href||attrs.src||'').split('?')[0];
  const sel=tag==='link'?`link[href^="${base}"]`:`script[src^="${base}"]`;
  if(document.querySelector(sel))return;
  const el=document.createElement(tag);
  Object.entries(attrs).forEach(([k,v])=>{el[k]=v});
  document.head.appendChild(el);
}
function loadAnalyticsAssets(){
  ensureAnalyticsWorkspace();
  injectAsset('link',{rel:'stylesheet',href:'./vector-analytics.css?v=20260707-2'});
  injectAsset('script',{src:'./vector-analytics.js?v=20260707-2',defer:true});
}
function injectMapToolVisibilityStyles(){
  if(document.querySelector('#vectorMapToolVisibilityStyles'))return;
  const s=document.createElement('style');
  s.id='vectorMapToolVisibilityStyles';
  s.textContent='body:not(.vector-map-tools-visible) #openLayerControl,body:not(.vector-map-tools-visible) #openPolygonControl,body:not(.vector-map-tools-visible) #gridBtn,body:not(.vector-map-tools-visible) #hm,body:not(.vector-map-tools-visible) #exportBtn,body:not(.vector-map-tools-visible) #clusterBtn,body:not(.vector-map-tools-visible) #mapPackageBtn,body:not(.vector-map-tools-visible) #vectorLayerPanel,body:not(.vector-map-tools-visible) #vectorPolygonPanel,body:not(.vector-map-tools-visible) #hmPanel,body:not(.vector-map-tools-visible) #vectorClusterPanel,body:not(.vector-map-tools-visible) #exportModal,body:not(.vector-map-tools-visible) #mapPackageModal{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}';
  document.head.appendChild(s);
}
function forceNavVisibility(){
  if(!workspace?.classList.contains('is-open'))return;
  ensureAnalyticsWorkspace();
  if(!document.querySelector('#vectorNavEmergencyStyles')){
    const s=document.createElement('style');
    s.id='vectorNavEmergencyStyles';
    s.textContent='#workspace.vector-workspace.is-open{display:block!important;position:relative!important;z-index:10!important}#workspace.vector-workspace.is-open>.hover-nav{display:flex!important;visibility:visible!important;opacity:1!important;position:fixed!important;top:0!important;bottom:0!important;z-index:9000!important;pointer-events:auto!important;transform:none!important}#workspace.vector-workspace.is-open>.hover-nav--left{left:0!important;right:auto!important;flex-direction:column!important;gap:14px!important}#workspace.vector-workspace.is-open>.hover-nav--right{right:0!important;left:auto!important}.hover-nav__item[data-section="analytics"]{display:flex!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important}.theme-toggle{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}';
    document.head.appendChild(s);
  }
  document.querySelectorAll('#workspace > .hover-nav').forEach(n=>{
    n.style.display='flex';n.style.visibility='visible';n.style.opacity='1';n.style.position='fixed';n.style.top='0';n.style.bottom='0';n.style.zIndex='9000';n.style.pointerEvents='auto';
  });
  themeToggle?.setAttribute('hidden','true');
}
function isWorkspaceOpen(){return Boolean(document.querySelector('#workspace.vector-workspace.is-open'))}
function closeMapToolPanels(){
  ['#vectorLayerPanel','#vectorPolygonPanel','#hmPanel','#vectorClusterPanel','#exportModal','#mapPackageModal'].forEach(sel=>{const el=document.querySelector(sel);if(!el)return;el.classList.remove('is-open','open')});
  ['#openLayerControl','#openPolygonControl','#gridBtn','#hm','#exportBtn','#clusterBtn','#mapPackageBtn'].forEach(sel=>document.querySelector(sel)?.classList.remove('is-active','on'));
}
function syncMapToolVisibility(){
  injectMapToolVisibilityStyles();
  const open=isWorkspaceOpen();
  document.body.classList.toggle('vector-map-tools-visible',open);
  if(open)forceNavVisibility();else closeMapToolPanels();
}
function forceScript(src,version,cleanup=[]){
  cleanup.forEach(sel=>document.querySelectorAll(sel).forEach(el=>el.remove()));
  document.querySelectorAll(`script[src^="${src}"]`).forEach(el=>el.remove());
  const s=document.createElement('script');s.src=`${src}?v=${version}`;s.defer=true;document.head.appendChild(s);
}
function loadLibraryAssets(){
  injectAsset('link',{rel:'stylesheet',href:'./supabase-library.css?v=20260704-1'});
  injectAsset('script',{src:'./supabase-library.js?v=20260704-1',defer:true});
  injectAsset('script',{src:'./map-item-filter.js?v=20260704-1',defer:true});
  injectAsset('script',{src:'./map-scale.js?v=20260705-scale-upper-left-1',defer:true});
  injectAsset('script',{src:'./map-layer-control.js?v=20260706-stable-tools-4',defer:true});
  injectAsset('script',{src:'./map-polygons-control.js?v=20260706-flicker-fix-1',defer:true});
  injectAsset('link',{rel:'stylesheet',href:'./map-data.css?v=20260704-7'});
  injectAsset('script',{src:'./map-data.js?v=20260704-7',defer:true});
  injectAsset('link',{rel:'stylesheet',href:'./dict-editor.css?v=20260704-1'});
  injectAsset('script',{src:'./dict-editor.js?v=20260704-1',defer:true});
  injectAsset('script',{src:'./route-point-editor.js?v=20260704-2',defer:true});
  injectAsset('script',{src:'./map-network.js?v=20260704-1',defer:true});
  loadAnalyticsAssets();
}
function loadExportStable(){
  forceScript('./map-export.js','20260706-export-preview-stable-1',['#exportBtn','#exportModal','#exportCss']);
  setTimeout(()=>forceScript('./map-package-export.js','20260712-map-package-v1',['#mapPackageBtn','#mapPackageModal','#mapPackageCss']),250);
  setTimeout(syncMapToolVisibility,500);
}
function applyTheme(){root.dataset.theme='dark';localStorage.setItem('vector-theme','dark');if(themeLabel)themeLabel.textContent='Темна'}
function setAuthMode(mode){document.querySelectorAll('.auth-tab[data-auth-mode]').forEach(tab=>tab.classList.toggle('is-active',tab.dataset.authMode===mode));loginForm?.classList.toggle('is-active',mode==='login');registerForm?.classList.toggle('is-active',mode==='register')}
function openAuth(mode='login'){setAuthMode(mode);authModal?.classList.add('is-open');authModal?.setAttribute('aria-hidden','false');syncMapToolVisibility()}
function closeAuth(){authModal?.classList.remove('is-open');authModal?.setAttribute('aria-hidden','true')}
function ensureMapDataButton(){
  const rightNav=document.querySelector('.hover-nav--right');
  if(!rightNav||document.querySelector('#openMapDataButton'))return;
  const btn=document.createElement('button');btn.className='hover-nav__item';btn.id='openMapDataButton';btn.type='button';btn.innerHTML='<img src="../assets/database-import.svg" alt=""><span>Дані</span>';btn.addEventListener('click',()=>window.openMapDataDialog?.());rightNav.insertBefore(btn,rightNav.firstChild);
}
function showSection(id){
  ensureAnalyticsWorkspace();
  document.querySelectorAll('.nav__item').forEach(item=>item.classList.toggle('is-active',item.dataset.section===id));
  document.querySelectorAll('.section').forEach(section=>section.classList.toggle('is-active',section.id===id));
  ensureMapDataButton();syncMapToolVisibility();
  if(id==='analytics') setTimeout(()=>window.vectorRunAnalytics?.(),180);
  setTimeout(()=>{try{window.vectorMap?.invalidateSize?.()}catch{}},120);
}
window.enterVector=function(){closeAuth();landingScreen?.setAttribute('hidden','true');document.querySelector('.landing-bg')?.setAttribute('hidden','true');workspace?.classList.add('is-open');workspace?.setAttribute('aria-hidden','false');localStorage.setItem('vector-user-session',JSON.stringify({email:'local'}));showSection('map');setTimeout(()=>{ensureAnalyticsWorkspace();ensureMapDataButton();syncMapToolVisibility();try{window.vectorMap?.invalidateSize?.()}catch{}},250)};
window.logoutVector=function(){workspace?.classList.remove('is-open');workspace?.setAttribute('aria-hidden','true');landingScreen?.removeAttribute('hidden');document.querySelector('.landing-bg')?.removeAttribute('hidden');localStorage.removeItem('vector-user-session');syncMapToolVisibility()};
function renderFileList(){if(!fileList)return;let files=[];try{files=JSON.parse(localStorage.getItem('vector-reference-files')||'[]')}catch{}if(!files.length){fileList.textContent='Файли ще не додані.';return}fileList.innerHTML=files.map(f=>`<div class="file-entry"><strong>${String(f.name||'')}</strong><span>${String(f.type||'')}</span><span>${f.importedTableId?'імпортована таблиця':''}</span></div>`).join('')}
applyTheme();injectMapToolVisibilityStyles();syncMapToolVisibility();ensureAnalyticsWorkspace();loadLibraryAssets();setTimeout(loadAnalyticsAssets,250);setTimeout(loadExportStable,900);openLogin?.addEventListener('click',()=>openAuth());closeModal?.addEventListener('click',closeAuth);authModal?.addEventListener('click',e=>{if(e.target===authModal)closeAuth()});document.querySelectorAll('[data-auth-mode]').forEach(btn=>btn.addEventListener('click',()=>setAuthMode(btn.dataset.authMode)));loginForm?.addEventListener('submit',e=>{e.preventDefault();window.enterVector()});registerForm?.addEventListener('submit',e=>{e.preventDefault();alert('Заявку зафіксовано локально.')});document.querySelectorAll('.nav__item').forEach(btn=>btn.addEventListener('click',()=>showSection(btn.dataset.section)));clearFiles?.addEventListener('click',()=>{localStorage.removeItem('vector-reference-files');renderFileList()});renderFileList();setInterval(()=>{ensureAnalyticsWorkspace();syncMapToolVisibility()},250);document.addEventListener('click',()=>setTimeout(syncMapToolVisibility,40));