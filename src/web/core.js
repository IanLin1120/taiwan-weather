'use strict';
/* ================= 基礎工具 ================= */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const h=(t,a={},...c)=>{const e=document.createElement(t);for(const k in a){if(k==='class')e.className=a[k];else if(k==='html')e.innerHTML=a[k];else if(k.startsWith('on'))e.addEventListener(k.slice(2),a[k]);else e.setAttribute(k,a[k]);}c.flat().forEach(x=>x!=null&&e.append(x));return e};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const pad=n=>String(n).padStart(2,'0');
const WD='日一二三四五六';
const fmtHM=d=>pad(d.getHours())+':'+pad(d.getMinutes());
const fmtMD=d=>(d.getMonth()+1)+'/'+d.getDate();
const fmtDay=d=>{const t=new Date();t.setHours(0,0,0,0);const x=new Date(d);x.setHours(0,0,0,0);const diff=Math.round((x-t)/864e5);return diff===0?'今天':diff===1?'明天':diff===2?'後天':'週'+WD[d.getDay()]};
const num=v=>{const n=parseFloat(v);return isFinite(n)&&n>-90?n:null};
function toast(msg,ms=2200){const t=$('#toast');t.textContent=msg;t.classList.add('on');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('on'),ms)}
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function lsGet(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}

/* ================= 設定 ================= */
const DEF={
  cwaKey:'',moenvKey:'',
  theme:'auto',acc:'terra',mat:'liquid',gA:.38,
  loc:{mode:'gps',county:'臺北市',town:'中正區',lat:25.0324,lon:121.5199},
  me:{feel:0,ride:'scooter',hair:'short',style:'casual'},
  notif:{
    h3:{on:true,every:3,onlyChange:false},
    today:{on:true,time:'06:30'},
    week:{on:true,day:0,time:'20:00'},
    warn:{on:true},
    rain:{on:false,lead:10,interval:5,stop:true,wifiOnly:false,target:'gps'}
  },
  notifMode:'sound',
  refresh:15,places:[],curPlace:''
};
function deepMerge(a,b){const o=Array.isArray(a)?[...a]:{...a};for(const k in b){o[k]=(b[k]&&typeof b[k]==='object'&&!Array.isArray(b[k])&&a&&typeof a[k]==='object')?deepMerge(a[k],b[k]):b[k]}return o}
let CFG=deepMerge(DEF,lsGet('wx.cfg',{}));
function saveCfg(){lsSet('wx.cfg',CFG);NAT.call('saveConfig',JSON.stringify(CFG))}

/* ================= 原生橋接 (APK) ================= */
const isApp=!!window.WXN;
const NAT={
  call(fn,...a){try{if(window.WXN&&WXN[fn])return WXN[fn](...a)}catch(e){console.warn('NAT',fn,e)}return null},
  json(fn,...a){const r=this.call(fn,...a);try{return r?JSON.parse(r):null}catch(e){return null}}
};
/* 原生端完成權限要求時會回呼這裡 */
window.onNativeEvent=function(type,data){
  if(type==='perm'){if(window.Settings)Settings.renderPerm();if(data==='loc')Loc.locate(true)}
  if(type==='resume'){App.onResume()}
  if(type==='apk'){toast(data==='ok'?'APK 下載完成，請依畫面指示安裝':'APK 下載失敗，請稍後再試或到 GitHub 下載')}
  if(type==='rain'){if(window.Area)Area.onNativeRain&&Area.onNativeRain(data)}
};

/* ================= 外觀 ================= */
function applyLook(){
  const dark=CFG.theme==='dark'||(CFG.theme==='auto'&&matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme=dark?'dark':'light';
  document.documentElement.dataset.acc=CFG.acc;
  document.body.classList.remove('liquid','paper','noglass');
  document.body.classList.add(CFG.mat==='paper'?'paper':CFG.mat==='solid'?'noglass':'liquid');
  document.documentElement.style.setProperty('--gA',CFG.gA);
  const bg=getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  $('meta[name=theme-color]').content=bg;
  NAT.call('setDark',dark);
  if(window.MapLayer)MapLayer.onTheme&&MapLayer.onTheme();
  if(window.Home&&Home.data)Home.renderAvatar();
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>CFG.theme==='auto'&&applyLook());

/* ================= 網路 =================
   APK 內經由原生代理（https://wx.app/p?u=...）以避開 CORS；瀏覽器版直接 fetch。 */
const NET={
  mem:new Map(),
  url(u,proxy){return (isApp&&proxy!==false)?location.origin+'/p?u='+encodeURIComponent(u):u},
  async raw(u,{proxy,timeout=25000,headers}={}){
    const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),timeout);
    try{const r=await fetch(this.url(u,proxy),{signal:ctl.signal,headers,cache:'no-store'});return r}
    finally{clearTimeout(t)}
  },
  async json(u,{ttl=0,key,...o}={}){
    const k=key||u;
    if(ttl){const m=this.mem.get(k);if(m&&Date.now()-m.t<ttl)return m.v;
      const c=lsGet('wx.c.'+k.slice(0,180),null);if(c&&Date.now()-c.t<ttl){this.mem.set(k,c);return c.v}}
    const r=await this.raw(u,o);if(!r.ok)throw new Error('HTTP '+r.status);
    const v=await r.json();
    if(ttl){const e={t:Date.now(),v};this.mem.set(k,e);const s=JSON.stringify(e);if(s.length<400000)try{localStorage.setItem('wx.c.'+k.slice(0,180),s)}catch(_){}}
    return v;
  },
  async text(u,o={}){const r=await this.raw(u,o);if(!r.ok)throw new Error('HTTP '+r.status);return r.text()},
  async buf(u,o={}){const r=await this.raw(u,o);if(!r.ok)throw new Error('HTTP '+r.status);return {buf:await r.arrayBuffer(),lm:r.headers.get('last-modified')||r.headers.get('x-last-modified')}},
  async image(u,o={}){
    const r=await this.raw(u,o);if(!r.ok)throw new Error('HTTP '+r.status);
    const lm=r.headers.get('last-modified')||r.headers.get('x-last-modified');
    const b=await r.blob();const url=URL.createObjectURL(b);
    const img=new Image();img.src=url;await img.decode();URL.revokeObjectURL(url);
    return {img,lm};
  },
  clearCache(){this.mem.clear();Object.keys(localStorage).filter(k=>k.startsWith('wx.c.')).forEach(k=>localStorage.removeItem(k))}
};

/* ================= 台灣行政區（鄉鎮、縣市邊界） ================= */
const TW={
  towns:[],counties:{},countyNames:[],
  init(){
    const t=window.TW_TOPO;
    const fc=topojson.feature(t,t.objects.towns);
    const byC={};
    fc.features.forEach((f,i)=>{
      const p=f.properties;const bb=this.bbox(f.geometry);
      const c=this.centroid(f.geometry)||[(bb[0]+bb[2])/2,(bb[1]+bb[3])/2];
      const town={i,name:p.t,county:p.c,geom:f.geometry,bbox:bb,lon:c[0],lat:c[1]};
      this.towns.push(town);(byC[p.c]=byC[p.c]||[]).push(i);
    });
    const order=['臺北市','新北市','基隆市','桃園市','新竹市','新竹縣','苗栗縣','臺中市','彰化縣','南投縣','雲林縣','嘉義市','嘉義縣','臺南市','高雄市','屏東縣','宜蘭縣','花蓮縣','臺東縣','澎湖縣','金門縣','連江縣'];
    this.countyNames=order.filter(c=>byC[c]).concat(Object.keys(byC).filter(c=>!order.includes(c)));
    for(const c of this.countyNames){
      const geoms=t.objects.towns.geometries.filter(g=>g.properties.c===c);
      const geom=topojson.merge(t,geoms);
      const bb=this.bbox(geom);
      const towns=byC[c].map(i=>this.towns[i]).sort((a,b)=>a.name.localeCompare(b.name,'zh-Hant'));
      // 縣市代表點：取面積最大鄉鎮之外，用政府所在地較準；此處用各鄉鎮中心平均
      this.counties[c]={name:c,geom,bbox:bb,towns,lat:(bb[1]+bb[3])/2,lon:(bb[0]+bb[2])/2};
    }
    const seat={'臺北市':'中正區','新北市':'板橋區','基隆市':'中正區','桃園市':'桃園區','新竹市':'北區','新竹縣':'竹北市','苗栗縣':'苗栗市','臺中市':'西屯區','彰化縣':'彰化市','南投縣':'南投市','雲林縣':'斗六市','嘉義市':'東區','嘉義縣':'太保市','臺南市':'安平區','高雄市':'苓雅區','屏東縣':'屏東市','宜蘭縣':'宜蘭市','花蓮縣':'花蓮市','臺東縣':'臺東市','澎湖縣':'馬公市','金門縣':'金城鎮','連江縣':'南竿鄉'};
    for(const c in seat){const C=this.counties[c];const tw=C&&C.towns.find(x=>x.name===seat[c]);if(tw){C.lat=tw.lat;C.lon=tw.lon;C.seat=tw}}
  },
  bbox(g){let a=[1e9,1e9,-1e9,-1e9];const f=c=>{if(typeof c[0]==='number'){a[0]=Math.min(a[0],c[0]);a[1]=Math.min(a[1],c[1]);a[2]=Math.max(a[2],c[0]);a[3]=Math.max(a[3],c[1])}else c.forEach(f)};f(g.coordinates);return a},
  centroid(g){let A=0,X=0,Y=0;const polys=g.type==='Polygon'?[g.coordinates]:g.coordinates;
    for(const p of polys){const r=p[0];for(let i=0,j=r.length-1;i<r.length;j=i++){const f=r[j][0]*r[i][1]-r[i][0]*r[j][1];A+=f;X+=(r[j][0]+r[i][0])*f;Y+=(r[j][1]+r[i][1])*f}}
    if(Math.abs(A)<1e-12)return null;return [X/(3*A),Y/(3*A)]},
  inRing(x,y,r){let ins=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const xi=r[i][0],yi=r[i][1],xj=r[j][0],yj=r[j][1];if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))ins=!ins}return ins},
  inGeom(lon,lat,g){const polys=g.type==='Polygon'?[g.coordinates]:g.coordinates;for(const p of polys){if(this.inRing(lon,lat,p[0])){let hole=false;for(let k=1;k<p.length;k++)if(this.inRing(lon,lat,p[k]))hole=true;if(!hole)return true}}return false},
  locate(lat,lon){
    for(const t of this.towns){const b=t.bbox;if(lon<b[0]||lon>b[2]||lat<b[1]||lat>b[3])continue;if(this.inGeom(lon,lat,t.geom))return t}
    let best=null,bd=1e9;for(const t of this.towns){const d=(t.lat-lat)**2+(t.lon-lon)**2;if(d<bd){bd=d;best=t}}return bd<0.15?best:null;
  },
  town(c,n){const C=this.counties[c];return C&&C.towns.find(t=>t.name===n)}
};

/* ================= 位置 ================= */
const Loc={
  cur:null, // {lat,lon,county,town,src}
  get(){if(this.cur)return this.cur;const l=CFG.loc;return {lat:l.lat,lon:l.lon,county:l.county,town:l.town,src:'fixed',elev:l.elev||null,spot:l.spot||null}},
  setFixed(c,t){const tw=TW.town(c,t);if(!tw)return;CFG.loc={...CFG.loc,mode:'fixed',county:c,town:t,lat:tw.lat,lon:tw.lon};saveCfg();this.cur=null;App.reload()},
  async locate(force){
    if(CFG.loc.mode!=='gps'&&!force){this.cur=null;return this.get()}
    try{
      const p=await new Promise((res,rej)=>{if(!navigator.geolocation)return rej(new Error('no geo'));navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:false,timeout:12000,maximumAge:5*60e3})});
      const lat=p.coords.latitude,lon=p.coords.longitude;const t=TW.locate(lat,lon);
      this.cur={lat,lon,county:t?t.county:'',town:t?t.name:'目前位置',src:'gps'};
      if(t){CFG.loc={...CFG.loc,lat,lon,county:t.county,town:t.name};if(force)CFG.loc.mode='gps';saveCfg()}
      return this.cur;
    }catch(e){
      if(force)toast('無法取得定位，改用設定的地區');
      this.cur=null;return this.get();
    }
  }
};
