/* ================= 颱風：資料（官方 CWA 資料，經 ExpTech 轉發；備援 CWA 開放資料） ================= */
const TY={
  BASE:'https://api.core-tnn1.exptech.dev/api/v5/meteor/typhoon',
  d:null,at:0,
  ms(t){t=+t;return !t?null:t<1e12?t*1000:t},
  cls(w){return w==null?['—','#9a8f80']:w<17.2?['熱帶性低氣壓','#5b8fc9']:w<32.7?['輕度颱風','#4f9a5a']:w<51?['中度颱風','#e08a2c']:['強烈颱風','#d23a37']},
  DIR:{N:'北',NNE:'北北東',NE:'東北',ENE:'東北東',E:'東',ESE:'東南東',SE:'東南',SSE:'南南東',S:'南',SSW:'南南西',SW:'西南',WSW:'西南西',W:'西',WNW:'西北西',NW:'西北',NNW:'北北西'},
  dir(d){return d?(this.DIR[String(d).toUpperCase()]||d):'—'},
  bf(w){return w==null?'—':beaufort(w)},
  async load(force){
    if(!force&&this.d&&Date.now()-this.at<5*60e3)return this.d;
    const get=p=>NET.json(this.BASE+p,{timeout:20000});
    const [tr,po,wa]=await Promise.allSettled([get('/track'),get('/potential'),get('/warning')]);
    let list=[],src='',updated=null;
    if(tr.status==='fulfilled'&&tr.value&&Array.isArray(tr.value.cyclones)){
      updated=this.ms(tr.value.updated);src='中央氣象署颱風路徑（經 ExpTech 轉發，與 DPIP 同源）';
      list=tr.value.cyclones.map(c=>{
        const past=(c.analysis||[]).map(f=>({time:this.ms(f.t),lat:+f.lat,lon:+f.lon,wind:f.wind,gust:f.gust,p:f.pres})).filter(x=>isFinite(x.lat)&&x.time).sort((a,b)=>a.time-b.time);
        const fc=(c.forecast||[]).map(f=>({tau:f.tau,time:this.ms(f.t),lat:+f.lat,lon:+f.lon,wind:f.wind,gust:f.gust,p:f.pres,spd:f.speed,dir:f.dir,r15:f.r15,r70:f.r70,state:f.state})).filter(x=>isFinite(x.lat)&&x.time).sort((a,b)=>a.time-b.time);
        const n=c.now||{};
        return {key:c.tdNo||c.name,name:c.cwaName||c.name,en:c.name,year:c.year,tdNo:c.tdNo,tyNo:c.tyNo,past,fc,
          now:{spd:n.speed,dir:n.dir,move:n.move,c15:n.c15,c25:n.c25}};
      });
    }else if(CWA.has()){
      try{const t=await CWA.typhoons();src='中央氣象署開放資料（W-C0034-005）';
        list=t.map(c=>({key:c.en||c.name,name:c.name,en:c.en,past:c.past,fc:c.fc,now:(()=>{const l=c.past[c.past.length-1]||{};return {spd:l.spd,dir:l.move,c15:l.r15?{avg:l.r15,ne:l.r15,se:l.r15,sw:l.r15,nw:l.r15}:null,c25:l.r25?{avg:l.r25,ne:l.r25,se:l.r25,sw:l.r25,nw:l.r25}:null}})()}))}catch(e){}
    }
    if(!src&&tr.status==='rejected')throw new Error('無法取得颱風資料（'+(tr.reason&&tr.reason.message||'網路錯誤')+'）');
    // 潛勢圖（官方的「颱風路徑潛勢預報」圓錐）
    const pots=po.status==='fulfilled'&&po.value&&Array.isArray(po.value.cyclones)?po.value.cyclones:[];
    // 警報單
    const warns=wa.status==='fulfilled'&&wa.value&&Array.isArray(wa.value.cyclones)?wa.value.cyclones:[];
    for(const c of list){
      const p=pots.find(x=>(c.tdNo&&x.tdNo===c.tdNo)||(x.name&&(x.name===c.name||x.name===c.en)));
      if(p){c.cone=p.cone||[];c.pts=p.points||[]}
      const w=warns.find(x=>x.active!==false&&((c.tdNo&&x.tdNo===c.tdNo)||(x.typhoon&&(x.typhoon.name===c.en||x.typhoon.cwaName===c.name))));
      if(w)c.warn={headline:w.headline,msgType:w.msgType,event:w.event,sent:this.ms(w.sent),expires:this.ms(w.expires),reportNo:w.typhoon&&w.typhoon.reportNo,
        scale:w.typhoon&&w.typhoon.analysis&&w.typhoon.analysis.scale,sections:w.sections||[],areas:(w.areas||[]).map(a=>a.name)};
      const L=c.past[c.past.length-1];c.cur=L||c.fc[0];
    }
    list=list.filter(c=>c.past.length||c.fc.length);
    this.d={list,src,updated,at:Date.now()};this.at=Date.now();return this.d;
  },
  /* 時間 t 的位置：路徑點之間線性內插（經緯度、風速、暴風半徑） */
  pos(c,t){
    const P=[...c.past.map(p=>({...p,r15:c.now.c15?c.now.c15.avg:null})),...c.fc];
    if(!P.length)return null;if(t<=P[0].time)return {...P[0],fc:false};
    for(let k=0;k<P.length-1;k++){const a=P[k],b=P[k+1];if(a.time<=t&&b.time>=t){const r=(t-a.time)/(b.time-a.time||1);const L=(x,y)=>x==null?y:y==null?x:x+(y-x)*r;
      return {lat:L(a.lat,b.lat),lon:L(a.lon,b.lon),wind:L(a.wind,b.wind),p:L(a.p,b.p),r15:L(a.r15,b.r15),r70:b.r70!=null?L(a.r70||0,b.r70):null,fc:t>((c.past[c.past.length-1]||{}).time||0)}}}
    return {...P[P.length-1],fc:true};
  },
  /* 不對稱暴風圈（四象限半徑）→ 多邊形 */
  quad(lat,lon,q,n=96){if(!q)return null;const kx=1/(111.32*Math.cos(lat*Math.PI/180)),ky=1/110.57,c=[];
    const v=[q.ne,q.se,q.sw,q.nw].map(x=>x??q.avg);
    const R=b=>{const u=((b-45)%360+360)%360,i=Math.floor(u/90),r=(u-i*90)/90;const a0=v[i],a1=v[(i+1)%4];return a0+(a1-a0)*(1-Math.cos(r*Math.PI))/2};
    for(let i=0;i<=n;i++){const b=i/n*360;const r=R(b);const rad=b*Math.PI/180;c.push([lon+r*Math.sin(rad)*kx,lat+r*Math.cos(rad)*ky])}
    return {type:'Polygon',coordinates:[c]}},
  fmt(t){const d=new Date(t);return `${d.getMonth()+1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`},
  fmtDate(t){const d=new Date(t);return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${pad(d.getHours())}:00`},
  fmtD(t){const d=new Date(t);return `${d.getDate()}日${pad(d.getHours())}時`}
};

/* ================= 停班停課（行政院人事行政總處 官方公告） ================= */
const CLOSE={
  URL:'https://www.dgpa.gov.tw/typh/daily/nds.html',
  d:null,at:0,
  COL:{stop:'#d23a37',school:'#e0893a',part:'#e8b33a',normal:'#5f9a5a',none:'#9a8f80'},
  NAME:{stop:'停班停課',school:'停課',part:'部分停班課',normal:'照常',none:'尚未宣布'},
  txt(h){return h.replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/[ \t\r]+/g,' ').replace(/\n\s*/g,'\n').trim()},
  /* 一段公告文字 → 狀態（看「今天／明天」第一句；含山區、部分鄉鎮的算「部分」） */
  cls(t){
    const ss=t.replace(/\[[^\]]*\]|【[^】]*】/g,'').split(/[。\n]/).map(x=>x.trim()).filter(x=>/上班|上課|停班|停課|列入/.test(x));const f=ss[0]||t;
    if(/尚未宣布|未宣布/.test(f))return 'none';
    if(/尚未列入|無停止上班|無停班停課/.test(f))return 'normal';
    const work=/停止上班|停班/.test(f),school=/停止上課|停課/.test(f),ok=/照常上班|照常上課|正常上班|正常上課/.test(f);
    const local=/[鄉鎮區里村]|山區|部分|地區/.test(f.split(/停止|停班|停課/)[0]||'');
    if((work||school)&&(local||ok))return 'part';
    if(work)return 'stop';if(school)return 'school';if(ok)return 'normal';return 'none'},
  sheet(){let el=$('#tySheet');if(!el){el=h('div',{id:'tySheet'});document.body.append(el)}
    el.innerHTML=`<div class="plBg"></div><div class="plBox glass tyBox"><div class="lab"><span>🏫 停班停課（官方公告）</span><button class="btn sm" id="tyX">關閉</button></div>
      <div id="tyClose">${this.html(Loc.get().county)}</div><div class="sub" style="margin-top:8px">來源：行政院人事行政總處${this.d&&this.d.updated?'・更新 '+esc(this.d.updated):''}　<a href="#" id="tyCloseWeb">開啟官方頁面</a></div></div>`;
    el.classList.add('on');$('#tyX').onclick=()=>el.classList.remove('on');el.querySelector('.plBg').onclick=()=>el.classList.remove('on');
    $('#tyCloseWeb').onclick=e=>{e.preventDefault();if(isApp)NAT.call('openUrl',this.URL);else window.open(this.URL,'_blank')}},
  async load(force){
    if(!force&&this.d&&Date.now()-this.at<5*60e3)return this.d;
    const r=await NET.raw(this.URL,{timeout:20000});if(!r.ok)throw new Error('HTTP '+r.status);
    const html=await r.text();
    const rows=[];
    for(const tr of html.match(/<tr[\s\S]*?<\/tr>/gi)||[]){
      const td=(tr.match(/<td[\s\S]*?<\/td>/gi)||[]).map(x=>this.txt(x));if(td.length<2)continue;
      const area=td[0].replace(/\s+/g,''),text=td.slice(1).join('\n').trim();
      if(!/[縣市]|地區|鄉|鎮|島/.test(area)||!/上班|上課|停止|照常|尚未|宣布/.test(text)||area.length>16)continue;
      rows.push({area:area.replace(/台/g,'臺'),text,st:this.cls(text)});
    }
    const um=this.txt(html).match(/(?:更新時間|發布時間|資料更新)[^\d]{0,4}([\d\/\-]+\s*[\d:]+)/);
    const none=!rows.length&&/無停班停課|無停止上班/.test(this.txt(html));
    this.d={rows,updated:um?um[1]:'',none,src:'行政院人事行政總處'};this.at=Date.now();return this.d},
  /* 找某縣市的公告：名稱比對用「包含」（官方表格有時在縣市前後加區域、符號），區域合併列則看內文 */
  norm(x){return String(x||'').replace(/台/g,'臺').replace(/\s+/g,'')},
  county(c){const n=this.norm(c);if(!this.d||!n)return [];const short=n.replace(/[縣市]$/,'');
    return this.d.rows.filter(r=>{const a=this.norm(r.area);return a.includes(n)||(a.includes(short)&&!Object.keys(TW.counties).some(k=>k!==n&&a.includes(k)))||(/地區|全區|各縣市/.test(a)&&this.norm(r.text).includes(n))})},
  stopping(){return this.d&&this.d.rows.some(r=>r.st==='stop'||r.st==='school'||r.st==='part')},
  chip(st){return `<span class="tyTag" style="background:${this.COL[st]}">${this.NAME[st]}</span>`},
  html(myCounty){const d=this.d;if(!d)return '<div class="sub">讀取中…</div>';
    if(!d.rows.length)return `<div class="sub">${d.none?'目前沒有停班停課訊息（全國照常上班上課）':'目前沒有停班停課公告'}</div>`;
    const mine=this.county(myCounty)||[];const others=d.rows.filter(r=>!mine.includes(r));
    const row=r=>`<div class="clR${mine.includes(r)?' me':''}"><b>${esc(r.area)}</b>${this.chip(r.st)}<div class="clT">${esc(r.text).replace(/\n/g,'<br>')}</div></div>`;
    const nc=String(myCounty||'').replace(/台/g,'臺');
    const absent=!mine.length&&nc?`<div class="sub" style="margin:2px 0">📍 你的所在地</div><div class="clR me"><b>${esc(nc)}</b>${this.chip('normal')}<div class="clT">人事行政總處的公告名單中沒有${esc(nc)}，代表目前沒有宣布停班停課（照常上班上課）。</div></div><div class="sep"></div>`:'';
    return absent+(mine.length?`<div class="sub" style="margin:2px 0">📍 你的所在地</div>${mine.map(row).join('')}<div class="sep"></div>`:'')+others.map(row).join('')}
};

/* ================= 歷年颱風（ExpTech 保存的氣象署颱風路徑歷史快照） =================
   每個快照只含「當時還活著」的颱風，且附完整過去路徑；所以每個颱風取它最後一次出現的快照，就是完整路徑。
   作法：先每約 1 天抽一張快照找出有哪些颱風，再對每個颱風用二分搜尋找最後一張，結果按年份存在手機裡。 */
const TYH={
  STATIC:'https://static.core-tnn1.exptech.dev/api/v5/meteor/typhoon/track/',
  _t:null,_tAt:0,mem:new Map(),
  async times(){if(this._t&&Date.now()-this._tAt<30*60e3)return this._t;
    const L=await NET.json(TY.BASE+'/track/list',{timeout:20000});if(!Array.isArray(L)||!L.length)throw new Error('沒有歷史資料');
    let s=+L[0];const T=[s];for(let i=1;i<L.length;i++){s+=+L[i];T.push(s)}this._t=T;this._tAt=Date.now();return T},
  async snap(sec){if(this.mem.has(sec))return this.mem.get(sec);
    let d;try{d=await NET.json(this.STATIC+sec,{timeout:20000})}catch(e){d=await NET.json(TY.BASE+'/track/'+sec,{timeout:20000})}
    const cy=(d&&Array.isArray(d.cyclones)?d.cyclones:[]);const v={};for(const c of cy)v[this.key(c)]=c;this.mem.set(sec,v);if(this.mem.size>400)this.mem.delete(this.mem.keys().next().value);return v},
  key(c){return (c.year||'')+'-'+(c.tdNo||c.name)},
  yr(sec){return new Date(sec*1000+8*3600e3).getUTCFullYear()},
  async year(y,prog){
    const ck='wx.tyy.'+y,old=lsGet(ck,null),Y=new Date().getFullYear();
    if(old&&(y<Y?true:Date.now()-old.at<3*3600e3))return old;
    const T=(await this.times()).filter(t=>this.yr(t)===y||(this.yr(t)===y+1&&new Date((t)*1000+8*3600e3).getUTCMonth()===0&&new Date(t*1000+8*3600e3).getUTCDate()<=10));
    const all=await this.times();
    if(!T.length)return {storms:[],at:Date.now(),note:all.length&&this.yr(all[0])>y?`歷史資料從 ${new Date(all[0]*1000).getFullYear()} 年 ${new Date(all[0]*1000).getMonth()+1} 月開始，沒有 ${y} 年的資料`:`${y} 年目前沒有颱風路徑資料`};
    // 抽樣：每約 24 小時一張，另外每段連續資料的最後一張也要
    const idx=[];let last=-1e12;
    for(let i=0;i<T.length;i++){const gapNext=i===T.length-1||T[i+1]-T[i]>12*3600;if(T[i]-last>=24*3600||gapNext){idx.push(i);last=T[i]}}
    const got=new Map();let done=0;
    const pool=async(list,fn,n=4)=>{let k=0;await Promise.all(Array.from({length:n},async()=>{while(k<list.length){const i=list[k++];await fn(i)}}))};
    await pool(idx,async i=>{try{got.set(i,await this.snap(T[i]))}catch(e){got.set(i,null)}done++;prog&&prog(done,idx.length)});
    // 每個颱風：最後一次出現的抽樣點 a、下一個抽樣點 b，在 (a,b) 之間二分找最後一張
    const lastSeen={};idx.forEach((i,j)=>{const v=got.get(i);if(v)for(const k in v)lastSeen[k]={j,i}});
    const out=[];
    for(const k in lastSeen){let lo=lastSeen[k].i,hi=lastSeen[k].j+1<idx.length?idx[lastSeen[k].j+1]:T.length;
      while(hi-lo>1){const mid=(lo+hi)>>1;let v=null;try{v=await this.snap(T[mid])}catch(e){}if(v&&v[k])lo=mid;else hi=mid}
      let c;try{c=(await this.snap(T[lo]))[k]}catch(e){}if(!c)continue;
      const tr=(c.analysis||[]).map(f=>({time:TY.ms(f.t),lat:+f.lat,lon:+f.lon,wind:f.wind,gust:f.gust,p:f.pres})).filter(p=>isFinite(p.lat)&&p.time).sort((a,b)=>a.time-b.time);
      if(!tr.length)continue;if(this.yr(tr[0].time/1000)!==y)continue;
      const ws=tr.map(p=>p.wind).filter(x=>x!=null),ps=tr.map(p=>p.p).filter(x=>x!=null);
      out.push({key:k,name:c.cwaName||c.name,en:c.name,year:c.year||y,tyNo:c.tyNo,tdNo:c.tdNo,start:tr[0].time,end:tr[tr.length-1].time,maxWind:ws.length?Math.max(...ws):null,minP:ps.length?Math.min(...ps):null,track:tr});
    }
    out.sort((a,b)=>b.start-a.start);
    const first=this.yr(T[0])===y&&new Date(T[0]*1000+8*3600e3).getUTCMonth()>0?fmtMD(new Date(T[0]*1000))+'/'+y:'';
    const R={storms:out,at:Date.now(),partial:first};
    try{lsSet(ck,R)}catch(e){}
    return R}
};

/* ================= 歷年颱風（中央氣象署颱風資料庫 → GitHub 每 6 小時整理成 JSON） ================= */
const TYD={
  base(){return GH.pages+'data/typhoon/'},
  async index(){const c=lsGet('wx.tyidx',null);if(c&&Date.now()-c.at<3*3600e3)return c.v;
    const v=await NET.json(this.base()+'index.json?t='+Math.floor(Date.now()/36e5),{timeout:20000});try{lsSet('wx.tyidx',{at:Date.now(),v})}catch(e){}return v},
  async year(y){const k='wx.tyd.'+y,c=lsGet(k,null),cur=y>=new Date().getFullYear()-1;
    if(c&&(!cur||Date.now()-c.at<3*3600e3))return c.v;
    let v;try{v=await NET.json(this.base()+y+'.json?t='+Math.floor(Date.now()/36e5),{timeout:30000})}catch(e){if(c)return c.v;throw e}
    v.storms=v.storms.map(s=>({...s,start:s.start?Date.parse(s.start.replace(' ','T')+'Z'):null,end:s.end?Date.parse(s.end.replace(' ','T')+'Z'):null,
      track:(s.track||[]).map(p=>({time:Date.parse(p[0]),lat:p[1],lon:p[2],wind:p[3],p:p[4]}))}));
    // 還在活動的颱風（官方歷史資料還沒有路徑）：用即時資料的路徑補上
    try{const live=TY.d&&TY.d.list||[];for(const s of v.storms)if(!s.track.length){const l=live.find(c=>(c.en||'').toUpperCase()===(s.en||'').toUpperCase());if(l)s.track=l.past}}catch(e){}
    try{lsSet(k,{at:Date.now(),v})}catch(e){}
    return v}
};

/* ================= 颱風：地圖（2D／3D 動畫）與完整資訊 ================= */
const TYV={
  srcs:['ty-cone','ty-past','ty-fc','ty-r70','ty-c15','ty-c25','ty-warn','ty-done'],
  ensure(m){
    const fc={type:'FeatureCollection',features:[]};
    for(const id of this.srcs)if(!m.getSource(id))m.addSource(id,{type:'geojson',data:fc});
    const before=GL.firstSymbol(m);
    const add=(l)=>{if(!m.getLayer(l.id))m.addLayer(l,before)};
    add({id:'ty-warn-f',type:'fill',source:'ty-warn',paint:{'fill-color':['get','c'],'fill-opacity':.32}});
    add({id:'ty-warn-l',type:'line',source:'ty-warn',paint:{'line-color':['get','c'],'line-width':1.4}});
    add({id:'ty-cone-f',type:'fill',source:'ty-cone',paint:{'fill-color':'#f3c04a','fill-opacity':.22}});
    add({id:'ty-cone-l',type:'line',source:'ty-cone',paint:{'line-color':'#d9a12a','line-width':1.5,'line-dasharray':[3,2]}});
    add({id:'ty-r70-f',type:'fill',source:'ty-r70',paint:{'fill-color':'#e0893a','fill-opacity':.06}});
    add({id:'ty-r70-l',type:'line',source:'ty-r70',paint:{'line-color':'#e0893a','line-width':1,'line-opacity':.7}});
    add({id:'ty-c15-f',type:'fill',source:'ty-c15',paint:{'fill-color':'#e05a3a','fill-opacity':.16}});
    add({id:'ty-c15-l',type:'line',source:'ty-c15',paint:{'line-color':'#d2462b','line-width':2}});
    add({id:'ty-c25-f',type:'fill',source:'ty-c25',paint:{'fill-color':'#a3233f','fill-opacity':.22}});
    add({id:'ty-c25-l',type:'line',source:'ty-c25',paint:{'line-color':'#a3233f','line-width':1.6}});
    add({id:'ty-past-l',type:'line',source:'ty-past',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['get','c'],'line-width':4}});
    add({id:'ty-fc-l',type:'line',source:'ty-fc',layout:{'line-cap':'round'},paint:{'line-color':'#c0562b','line-width':3,'line-dasharray':[1.6,1.4]}});
    add({id:'ty-done-l',type:'line',source:'ty-done',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#fff','line-width':2,'line-opacity':.85}});
  },
  set(m,id,f){const s=m.getSource(id);if(s)s.setData({type:'FeatureCollection',features:f||[]})},
  clear(m){if(!m)return;for(const id of this.srcs)this.set(m,id,[]);(this.mk||[]).forEach(x=>x.remove());this.mk=[];if(this.eye){this.eye.remove();this.eye=null}},
  ln(co,p={}){return {type:'Feature',properties:p,geometry:{type:'LineString',coordinates:co}}},
  poly(g,p={}){return {type:'Feature',properties:p,geometry:g}},

  async prep(ML){
    const m=ML.map;this.ML=ML;this.ensure(m);this.clear(m);this.hist=null;
    ML.setSteps([{label:'讀取颱風資料中…',short:'',sub:'',draw:()=>{}}],0);this.info();
    let D;try{D=await TY.load(true)}catch(e){ML.setSteps([{label:'⚠️ 颱風資料讀取失敗',short:'',sub:e.message,draw:()=>{}}],0);this.info();return}
    if(ML.layer!=='typhoon'||this.hist)return;
    this.D=D;
    if(!D.list.length){ML.setSteps([{label:'目前沒有颱風',short:'',sub:'可按「📅 歷年」看今年所有颱風',draw:()=>{}}],0);this.info();return}
    this.sel=this.sel&&!this.sel.hist&&D.list.find(c=>c.key===this.sel.key)?D.list.find(c=>c.key===this.sel.key):D.list[0];
    this.render();
  },
  render(){
    const ML=this.ML,m=ML.map;this.clear(m);
    this.drawStatic(m);
    const c=this.sel;const H=3600e3;
    // 時間軸：即時＝過去最多 72 小時 → 最後一個預報點；歷史＝整個生命期。每小時一格
    const tEnd=(c.fc[c.fc.length-1]||c.past[c.past.length-1]).time,tNow=(c.past[c.past.length-1]||c.fc[0]).time;
    let tStart=c.past.length?c.past[0].time:tNow;if(!c.hist)tStart=Math.max(tStart,tNow-72*H);
    const stepH=c.hist&&tEnd-tStart>10*24*H?3:1;
    const steps=[];let ni=0;
    for(let t=Math.floor(tStart/H)*H;t<=tEnd+1;t+=stepH*H){
      if(t<=tNow)ni=steps.length;
      steps.push({t,label:TY.fmt(t),short:fmtMD(new Date(t))+' '+pad(new Date(t).getHours())+'時',sub:c.hist?'歷史路徑':t<=tNow?'實際路徑':'預報 +'+Math.round((t-tNow)/H)+'h',draw:()=>this.drawAt(m,t)});
    }
    ML.setSteps(steps,c.hist?0:ni);
    this.fit(m);
    this.info();
  },
  /* 歷年颱風：選年份 → 列出當年所有颱風（官方定位路徑）→ 點一個在地圖上播放 */
  async years(){
    let el=$('#tySheet');if(!el){el=h('div',{id:'tySheet'});document.body.append(el)}
    const Y=new Date().getFullYear();this.hy=this.hy||Y;this.hf=this.hf||'all';
    el.innerHTML=`<div class="plBg"></div><div class="plBox glass tyBox"><div class="lab"><span>📅 歷年颱風</span><button class="btn sm" id="tyX">關閉</button></div>
      <div class="tyYrBar"><select id="tyYrSel"><option>${this.hy}</option></select>
        <div class="seg sm" id="tyHF"><button class="btn ${this.hf==='all'?'on':''}" data-f="all">全部</button><button class="btn ${this.hf==='warn'?'on':''}" data-f="warn">有發警報</button></div></div>
      <div id="tyHL"><div class="sub">讀取中…</div></div>
      <div class="sub" style="margin-top:12px;line-height:1.6">資料來源：<b>中央氣象署颱風資料庫</b>（颱風名稱、編號、生命期、最低氣壓、最大風速、暴風半徑、警報報數）；路徑為 IBTrACS 彙整的官方最佳路徑（日本氣象廳 RSMC 東京等），近兩年為暫定值。資料每 6 小時自動更新。</div></div>`;
    el.classList.add('on');const close=()=>el.classList.remove('on');$('#tyX').onclick=close;el.querySelector('.plBg').onclick=close;
    $('#tyHF').onclick=e=>{const b=e.target.closest('[data-f]');if(!b)return;this.hf=b.dataset.f;$$('#tyHF .btn').forEach(x=>x.classList.toggle('on',x===b));this.yearList()};
    try{const I=await TYD.index();const ys=Object.keys(I.years).map(Number).sort((a,b)=>b-a);if(!ys.includes(this.hy))this.hy=ys[0];
      $('#tyYrSel').innerHTML=ys.map(y=>`<option value="${y}" ${y===this.hy?'selected':''}>${y} 年（${I.years[y].n} 個）</option>`).join('');
      $('#tyYrSel').onchange=e=>{this.hy=+e.target.value;this.yearList()}}
    catch(e){$('#tyHL').innerHTML='<div class="sub">⚠️ 無法讀取歷年颱風資料：'+esc(e.message)+'</div>';return}
    this.yearList();
  },
  async yearList(){
    const x=$('#tyHL');if(!x)return;x.innerHTML='<div class="sub">讀取 '+this.hy+' 年資料中…</div>';
    let R;try{R=await TYD.year(this.hy)}catch(e){x.innerHTML='<div class="sub">⚠️ '+esc(e.message)+'</div>';return}
    if($('#tyHL')!==x)return;
    const all=R.storms,L=this.hf==='warn'?all.filter(s=>s.warn):all;
    const strong=all.filter(s=>(s.maxWind||0)>=51).length,mid=all.filter(s=>(s.maxWind||0)>=32.7&&(s.maxWind||0)<51).length;
    x.innerHTML=`<div class="tySum"><div><b>${all.length}</b><span>颱風</span></div><div><b>${all.filter(s=>s.warn).length}</b><span>氣象署發警報</span></div><div><b>${strong}</b><span>強烈颱風</span></div><div><b>${mid}</b><span>中度颱風</span></div></div>`+
      (L.length?L.map(st=>{const i=all.indexOf(st);const [cn,col]=TY.cls(st.maxWind);
      return `<div class="tyHI" data-i="${i}"><div class="tyBig sm" style="background:${col}">🌀</div>
        <div class="grow"><div class="tyHN"><b>${esc(st.name)}</b> <small>${esc(st.en||'')}</small></div>
          <div class="sub">編號 ${esc(st.id)}・${st.start?TY.fmtDate(st.start):'—'} ～ ${st.end?TY.fmtDate(st.end):'持續中'}</div>
          <div class="sub">最低 ${st.minP??'—'} hPa・最大風速 ${st.maxWind??'—'} m/s${st.r7?'・七級風半徑 '+st.r7+' km':''}</div>
          <div class="tyTags"><span class="tyTag" style="background:${col}">${cn}</span>${st.warn?`<span class="tyTag" style="background:#c0562b">警報 ${st.warn} 報</span>`:''}${st.track.length?'':'<span class="tyTag" style="background:#9a8f80">路徑整理中</span>'}</div></div>
        ${st.track.length?'<span class="tyGo">🗺</span>':''}</div>`}).join(''):'<div class="sub" style="padding:10px 0">這一年氣象署沒有發布颱風警報</div>');
    x.querySelectorAll('[data-i]').forEach(r=>r.onclick=()=>{const st=all[+r.dataset.i];if(!st.track.length){this.histInfo(st);return}$('#tySheet').classList.remove('on');this.showHist(st)});
  },
  histInfo(st){toast(`${st.name}：官方路徑資料還沒整理好（通常 1～2 週內補上）`)},
  showHist(st){
    const c={key:'h-'+st.id,name:st.name,en:st.en,year:+String(st.id).slice(0,4),tyNo:String(st.id).slice(4),past:st.track,fc:[],now:{},hist:true,cwa:st};c.cur=c.past[c.past.length-1];
    this.hist=c;this.D={list:[c],src:'中央氣象署颱風資料庫＋IBTrACS 官方最佳路徑',at:Date.now(),hist:true};this.sel=c;this.render();
    toast(`${st.name}（${c.year}）路徑，按 ▶ 播放`);
  },
  fit(m){const c=this.sel;const b=new maplibregl.LngLatBounds();
    [...(c.hist?c.past:c.past.slice(-6)),...c.fc].forEach(p=>b.extend([p.lon,p.lat]));(c.cone||[]).forEach(p=>b.extend(p));b.extend([120.2,22]);b.extend([121.9,25.3]);
    m.fitBounds(b,{padding:{top:110,bottom:300,left:30,right:70},pitch:CFG.map3d?50:0,bearing:CFG.map3d?-12:0,duration:900,maxZoom:7})},
  drawStatic(m){
    const D=this.D;const ml=[];this.mk.forEach(x=>x.remove());this.mk=[];
    const past=[],fc=[],r70=[],cone=[];
    for(const c of D.list){
      for(let i=0;i<c.past.length-1;i++){const a=c.past[i],b=c.past[i+1];past.push(this.ln([[a.lon,a.lat],[b.lon,b.lat]],{c:TY.cls(b.wind)[1]}))}
      const L=c.past[c.past.length-1];
      if(c.fc.length)fc.push(this.ln([...(L?[[L.lon,L.lat]]:[]),...c.fc.map(p=>[p.lon,p.lat])]));
      c.fc.forEach(f=>{if(f.r70)r70.push(this.poly(WX3.circle(f.lat,f.lon,f.r70)));
        this.mk.push(glMarker(m,f.lat,f.lon,`<div class="tyFc"><i style="background:${TY.cls(f.wind)[1]}"></i><span>${TY.fmtD(f.time)}</span></div>`,'tyFcM',
          `<b>${esc(c.name)}</b> 預報 ${f.tau} 小時<br>${TY.fmt(f.time)}<br>${TY.cls(f.wind)[0]}<br>近中心最大風速 ${f.wind??'—'} m/s（${TY.bf(f.wind)} 級）<br>瞬間陣風 ${f.gust??'—'} m/s<br>中心氣壓 ${f.p??'—'} hPa<br>70% 機率半徑 ${f.r70??'—'} km${f.state&&f.state[0]?'<br>'+esc(f.state[0]):''}`))});
      if(c.cone&&c.cone.length>2)cone.push(this.poly({type:'Polygon',coordinates:[[...c.cone,c.cone[0]]]}));
    }
    this.set(m,'ty-past',past);this.set(m,'ty-fc',fc);this.set(m,'ty-r70',cone.length?[]:r70);this.set(m,'ty-cone',cone);
    // 警報區域：縣市上色
    const w=this.sel.warn;const fs=[];
    if(w&&w.areas){const land=/陸上/.test(w.event||w.headline||'');for(const a of w.areas){const n=String(a).replace(/台/g,'臺');const C=TW.counties[n];if(C)fs.push({type:'Feature',properties:{c:land?'#d23a37':'#e0893a'},geometry:C.geom})}}
    this.set(m,'ty-warn',fs);
  },
  drawAt(m,t){
    const c=this.sel;const p=TY.pos(c,t);if(!p)return;
    const tNow=(c.past[c.past.length-1]||c.fc[0]).time;
    const r15=p.r15||(c.now.c15&&c.now.c15.avg)||150;
    // 暴風圈：現在用官方四象限半徑；其他時間用預報的平均半徑
    const near=Math.abs(t-tNow)<1.5*3600e3;
    this.set(m,'ty-c15',[this.poly(near&&c.now.c15?TY.quad(p.lat,p.lon,c.now.c15):WX3.circle(p.lat,p.lon,r15))]);
    this.set(m,'ty-c25',near&&c.now.c25?[this.poly(TY.quad(p.lat,p.lon,c.now.c25))]:[]);
    // 已走過的路徑（白色細線跟著跑）
    const done=[...c.past,...c.fc].filter(q=>q.time<=t).map(q=>[q.lon,q.lat]);done.push([p.lon,p.lat]);this.set(m,'ty-done',done.length>1?[this.ln(done)]:[]);
    WX3.moveStorm(m,p.lat,p.lon,r15*1.1);
    const [cn,col]=TY.cls(p.wind);
    const pop=`<b>${esc(c.name)}</b> ${esc(c.en||'')}<br>${TY.fmt(t)}（${p.fc?'預報':'實際'}）<br>${cn}・${p.wind!=null?Math.round(p.wind)+' m/s':''}<br>中心氣壓 ${p.p!=null?Math.round(p.p):'—'} hPa<br>暴風半徑約 ${Math.round(r15)} km`;
    if(!this.eye){this.eye=glMarker(m,p.lat,p.lon,`<div class="tyEye"><i></i></div>`,'',pop)}else{this.eye.setLngLat([p.lon,p.lat]);this.eye.getPopup()&&this.eye.getPopup().setHTML(pop)}
    this.eye.getElement().firstChild.style.setProperty('--tc',col);
    // 3D 播放時鏡頭跟著颱風
    if(this.ML.playing&&CFG.map3d&&this.follow!==false)m.easeTo({center:[p.lon,p.lat],duration:180,easing:x=>x});
    this.badge(p,t);
  },
  badge(p,t){const [cn,col]=TY.cls(p.wind);const r=this.row();
    $('#tySt').innerHTML=`<span class="tyTag" style="background:${col}">${cn}</span> <b>${esc(this.sel.name)}</b> ${p.wind!=null?Math.round(p.wind)+' m/s':''}${p.p!=null?'・'+Math.round(p.p)+' hPa':''}`;},
  row(){let r=$('#tyRow');const box=$('#tlBox');if(!r&&box){r=h('div',{id:'tyRow'},h('span',{id:'tySt',class:'grow'}),h('button',{id:'tyLive',class:'btn sm'},'↩ 即時'),h('button',{id:'tyYrB',class:'btn sm'},'📅 歷年'),h('button',{id:'tyCl',class:'btn sm'},'🏫 停班課'),h('button',{id:'tyBtn',class:'btn sm pri'},'🌀 詳細'));box.querySelector('.tlHead').after(r);$('#tyBtn').onclick=()=>this.sheet();$('#tyCl').onclick=()=>this.toggleClose();$('#tyYrB').onclick=()=>this.years();$('#tyLive').onclick=()=>{this.hist=null;this.prep(this.ML)}}return r},
  /* 地圖切換：縣市依停班停課狀態上色（再按一次回到颱風警報區域） */
  async toggleClose(){const m=this.ML.map;this.showClose=!this.showClose;$('#tyCl').classList.toggle('on',this.showClose);
    if(!this.showClose){this.drawStatic(m);$('#lyLegend .clLg')&&$('#lyLegend .clLg').remove();return}
    try{await CLOSE.load()}catch(e){toast('無法讀取停班停課公告');this.showClose=false;$('#tyCl').classList.remove('on');return}
    const fs=[];for(const r of CLOSE.d.rows){const c=Object.keys(TW.counties).find(n=>CLOSE.norm(r.area).includes(n));if(c)fs.push({type:'Feature',properties:{c:CLOSE.COL[r.st]},geometry:TW.counties[c].geom})}
    this.set(m,'ty-warn',fs);
    const lg=$('#lyLegend');if(lg&&!lg.querySelector('.clLg'))lg.insertAdjacentHTML('beforeend',`<div class="clLg"><b>停班停課</b>${['stop','school','part','normal'].map(k=>`<div class="lg"><i style="background:${CLOSE.COL[k]}"></i>${CLOSE.NAME[k]}</div>`).join('')}</div>`);
    toast(CLOSE.d.rows.length?'縣市顏色＝停班停課狀態'+(CLOSE.d.updated?'（'+CLOSE.d.updated+'）':''):'目前沒有停班停課公告')},
  /* 颱風完整資訊（底部面板） */
  info(){const r=this.row();const on=this.ML&&this.ML.layer==='typhoon';const has=!!(this.D&&this.D.list.length);
    if(r){r.style.display=on?'':'none';$('#tyBtn').style.display=has?'':'none';$('#tyLive').style.display=this.hist?'':'none';if(!has)$('#tySt').innerHTML='<span class="sub">目前沒有颱風</span>'}
    document.body.classList.toggle('tyOn',!!on)},
  sheet(){
    const D=this.D;if(!D||!D.list.length)return;const c=this.sel;const histMode=!!c.hist;
    let el=$('#tySheet');if(!el){el=h('div',{id:'tySheet'});document.body.append(el)}
    const L=c.past[c.past.length-1]||c.fc[0];const [cn,col]=TY.cls(c.cwa?c.cwa.maxWind:L.wind);const w=c.warn;
    const q=x=>x?`${Math.round(x.avg)} km<div class="sub">東北 ${x.ne??'—'}・東南 ${x.se??'—'}・西南 ${x.sw??'—'}・西北 ${x.nw??'—'} km</div>`:'—';
    const tw=TW.locate(L.lat,L.lon);
    const distTW=Math.round(kmDist(L.lat,L.lon,23.7,120.95));
    el.innerHTML=`<div class="plBg"></div><div class="plBox glass tyBox">
      <div class="lab"><span>🌀 颱風詳細資訊</span><button class="btn sm" id="tyX">關閉</button></div>
      ${D.list.length>1?`<div class="chips">${D.list.map(x=>`<button class="btn ${x.key===c.key?'on':''}" data-k="${esc(x.key)}">${esc(x.name)}</button>`).join('')}</div>`:''}
      <div class="tyHead"><div class="tyBig" style="background:${col}">🌀</div><div class="grow"><div class="tyN">${esc(c.name)} <small>${esc(c.en||'')}</small></div>
        <div class="sub">${c.year?c.year+' 年 ':''}${c.tyNo?'第 '+esc(c.tyNo)+' 號颱風':''}${c.tdNo?'（熱帶性低氣壓 '+esc(c.tdNo)+' 號）':''}</div>
        <span class="tyTag" style="background:${col}">${cn}</span>${w?` <span class="tyTag" style="background:${/陸上/.test(w.event||w.headline||'')?'#d23a37':'#e0893a'}">${esc(w.event||'颱風警報')}</span>`:''}</div></div>
      ${w&&w.headline?`<div class="tyWarn"><b>📢 ${esc(w.headline)}</b><div class="sub">${w.reportNo?'第 '+esc(w.reportNo)+' 報・':''}發布 ${w.sent?TY.fmt(w.sent):'—'}${w.expires?'・有效至 '+TY.fmt(w.expires):''}</div>
        ${w.areas&&w.areas.length?`<div style="margin-top:6px"><b>警戒區域：</b>${w.areas.map(esc).join('、')}</div>`:''}</div>`:''}
      ${c.hist?'':`<h4>🏫 停班停課（官方公告）</h4><div id="tyClose">${CLOSE.html(Loc.get().county)}</div>
      <div class="sub">來源：行政院人事行政總處${CLOSE.d&&CLOSE.d.updated?'・更新 '+esc(CLOSE.d.updated):''}　<a href="#" id="tyCloseWeb">開啟官方頁面</a></div>`}
      ${c.cwa?`<h4>氣象署颱風資料庫</h4><div class="tyGrid">
        ${this.kv('颱風編號',esc(c.cwa.id))}${this.kv('生命期',(c.cwa.start?TY.fmtDate(c.cwa.start):'—')+'<div class="sub">至 '+(c.cwa.end?TY.fmtDate(c.cwa.end):'—')+'</div>')}
        ${this.kv('中心最低氣壓',(c.cwa.minP??'—')+' hPa')}${this.kv('中心最大風速',(c.cwa.maxWind??'—')+' m/s',TY.cls(c.cwa.maxWind)[0])}
        ${this.kv('最大陣風',(c.cwa.gust??'—')+' m/s')}${this.kv('警報報數',c.cwa.warn?c.cwa.warn+' 報':'未發警報')}
        ${this.kv('最大七級風半徑',(c.cwa.r7??'—')+' km')}${this.kv('最大十級風半徑',(c.cwa.r10??'—')+' km')}</div>
        <div class="acts"><button class="btn sm" id="tyTDB">🔗 氣象署颱風資料庫頁面</button></div>`:''}
      ${c.hist?'':`<h4>${'目前狀態'}（${TY.fmt(L.time)}）</h4>
      <div class="tyGrid">
        ${this.kv('中心位置',`北緯 ${L.lat.toFixed(1)}°・東經 ${L.lon.toFixed(1)}°`,tw?'位於'+tw.county+tw.name:'距台灣中心約 '+distTW+' 公里')}
        ${this.kv('中心氣壓',(L.p??'—')+' hPa')}
        ${this.kv('近中心最大風速',(L.wind??'—')+' m/s',TY.bf(L.wind)+' 級風')}
        ${this.kv('瞬間最大陣風',(L.gust??'—')+' m/s',TY.bf(L.gust)+' 級風')}
        ${c.hist?'':this.kv('移動',`${TY.dir(c.now.dir)} ${c.now.spd??'—'} km/h`,c.now.move&&c.now.move[0]?esc(c.now.move[0]):'')}
        ${c.hist?'':this.kv('七級風暴風半徑',q(c.now.c15))}
        ${c.hist?'':this.kv('十級風暴風半徑',q(c.now.c25))}
      </div>`}
      ${c.fc.length?`<h4>官方預報路徑</h4><div class="tyTbl"><div class="tyTr th"><span>時間</span><span>位置</span><span>強度</span><span>氣壓</span><span>70%半徑</span></div>
        ${c.fc.map(f=>{const [n2,c2]=TY.cls(f.wind);return `<div class="tyTr"><span><b>${TY.fmtD(f.time)}</b><small>+${f.tau}h</small></span><span>${f.lat.toFixed(1)}N ${f.lon.toFixed(1)}E<small>${TY.dir(f.dir)} ${f.spd??''}${f.spd!=null?' km/h':''}</small></span><span><i style="background:${c2}"></i>${f.wind??'—'} m/s<small>${n2}</small></span><span>${f.p??'—'}</span><span>${f.r70??'—'} km</span></div>`+(f.state&&f.state[0]?`<div class="tyNote">${esc(f.state[0])}</div>`:'')}).join('')}</div>`:''}
      ${w&&w.sections&&w.sections.length?`<h4>警報內容</h4>${w.sections.map(s=>`<div class="tySec"><b>${esc(s.title)}</b><p>${esc(s.text).replace(/\n/g,'<br>')}</p></div>`).join('')}`:''}
      ${c.past.length?`<h4>${c.hist?'路徑紀錄（每 6 小時）':'過去路徑'}</h4><div class="tyTbl">${(c.hist?c.past:c.past.slice(-12)).slice().reverse().map(p=>{const [n2,c2]=TY.cls(p.wind);return `<div class="tyTr"><span>${TY.fmt(p.time)}</span><span>${p.lat.toFixed(1)}N ${p.lon.toFixed(1)}E</span><span><i style="background:${c2}"></i>${p.wind??'—'} m/s</span><span>${p.p??'—'}</span><span></span></div>`}).join('')}</div>`:''}
      <div class="sub" style="margin-top:12px">資料來源：${esc(D.src)}・更新 ${D.updated?TY.fmt(D.updated):TY.fmt(D.at)}<br>黃色區域為官方「路徑潛勢預報」範圍；橘色圓圈為各預報點 70% 機率半徑。動畫的位置是在官方定位點之間平均內插，僅供示意。</div>
      <div class="acts"><button class="btn sm" id="tyWeb">🔗 氣象署颱風消息</button></div>
    </div>`;
    el.classList.add('on');
    if($('#tyCloseWeb')&&!c.hist)$('#tyCloseWeb').onclick=e=>{e.preventDefault();if(isApp)NAT.call('openUrl',CLOSE.URL);else window.open(CLOSE.URL,'_blank')};
    if(!c.hist&&!CLOSE.d||Date.now()-CLOSE.at>5*60e3)CLOSE.load().then(()=>{const x=$('#tyClose');if(x)x.innerHTML=CLOSE.html(Loc.get().county)}).catch(()=>{const x=$('#tyClose');if(x)x.innerHTML='<div class="sub">⚠️ 無法讀取人事行政總處公告'+(isApp?'':'（網頁版受瀏覽器限制，請用 APK 或點下方連結）')+'</div>'});
    $('#tyX').onclick=()=>el.classList.remove('on');el.querySelector('.plBg').onclick=()=>el.classList.remove('on');
    if($('#tyTDB'))$('#tyTDB').onclick=()=>{const u='https://rdc28.cwa.gov.tw/TDB/public/typhoon_detail?typhoon_id='+c.cwa.id;if(isApp)NAT.call('openUrl',u);else window.open(u,'_blank')};
    $('#tyWeb').onclick=()=>{const u='https://www.cwa.gov.tw/V8/C/P/Typhoon/TY_NEWS.html';if(isApp)NAT.call('openUrl',u);else window.open(u,'_blank')};
    el.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>{this.sel=D.list.find(x=>x.key===b.dataset.k);el.classList.remove('on');this.ML.prepTyphoon()});
  },
  kv(k,v,s){return `<div class="kv"><div class="k">${k}</div><div class="v">${v}</div>${s?`<div class="d">${s}</div>`:''}</div>`}
};
