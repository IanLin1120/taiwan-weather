/* 熱門景點與高山：[名稱, 地區, 緯度, 經度, 海拔(m)] */
const SPOTS={
  '高山':[['合歡山 武嶺','南投縣仁愛鄉',24.1371,121.2712,3275],['合歡山 松雪樓','南投縣仁愛鄉',24.1390,121.2862,3150],['玉山主峰','南投縣信義鄉',23.4700,120.9573,3952],['玉山 排雲山莊','嘉義縣阿里山鄉',23.4777,120.9497,3402],['塔塔加','南投縣信義鄉',23.4870,120.8890,2610],['雪山主峰','臺中市和平區',24.3833,121.2317,3886],['雪山 三六九山莊','臺中市和平區',24.3907,121.2525,3100],['奇萊主山','南投縣仁愛鄉',24.0850,121.3200,3560],['大霸尖山','新竹縣尖石鄉',24.4600,121.2580,3492],['北大武山','屏東縣泰武鄉',22.6280,120.7590,3092],['嘉明湖','臺東縣海端鄉',23.2930,121.0350,3310],['向陽山屋','臺東縣海端鄉',23.2620,121.0130,2850]],
  '森林遊樂區':[['阿里山森林遊樂區','嘉義縣阿里山鄉',23.5104,120.8037,2216],['阿里山 祝山觀日','嘉義縣阿里山鄉',23.5130,120.8150,2451],['太平山','宜蘭縣大同鄉',24.4963,121.5320,1950],['太平山 翠峰湖','宜蘭縣大同鄉',24.5040,121.6030,1840],['大雪山','臺中市和平區',24.2829,120.9452,2200],['溪頭','南投縣鹿谷鄉',23.6740,120.7970,1150],['杉林溪','南投縣竹山鎮',23.6400,120.7900,1600],['觀霧','新竹縣五峰鄉',24.5080,121.1150,2000],['武陵農場','臺中市和平區',24.3613,121.3104,1740],['福壽山農場','臺中市和平區',24.2420,121.2440,2100],['清境農場','南投縣仁愛鄉',24.0560,121.1620,1750],['拉拉山','桃園市復興區',24.7180,121.4320,1500],['司馬庫斯','新竹縣尖石鄉',24.5780,121.3380,1500],['東眼山','桃園市復興區',24.8320,121.4100,1000]],
  '湖泊與峽谷':[['日月潭','南投縣魚池鄉',23.8650,120.9150,748],['太魯閣 天祥','花蓮縣秀林鄉',24.1830,121.4930,480],['太魯閣 燕子口','花蓮縣秀林鄉',24.1720,121.5680,260],['清水斷崖','花蓮縣秀林鄉',24.2150,121.6890,100],['梨山','臺中市和平區',24.2550,121.2510,1950],['內灣','新竹縣橫山鄉',24.7050,121.1830,230],['池上','臺東縣池上鄉',23.1000,121.2190,270]],
  '陽明山與北部':[['陽明山 小油坑','臺北市北投區',25.1770,121.5470,805],['七星山','臺北市北投區',25.1700,121.5550,1120],['擎天崗','臺北市士林區',25.1670,121.5740,760],['九份','新北市瑞芳區',25.1090,121.8440,280],['野柳','新北市萬里區',25.2060,121.6900,10],['淡水','新北市淡水區',25.1700,121.4390,10]],
  '海岸與離島':[['墾丁','屏東縣恆春鎮',21.9450,120.8000,20],['鵝鑾鼻','屏東縣恆春鎮',21.9020,120.8530,50],['高美濕地','臺中市清水區',24.3120,120.5490,5],['七股鹽山','臺南市七股區',23.1540,120.1000,5],['三仙台','臺東縣成功鎮',23.1240,121.4110,10],['綠島','臺東縣綠島鄉',22.6600,121.4900,30],['蘭嶼','臺東縣蘭嶼鄉',22.0500,121.5500,50],['澎湖 馬公','澎湖縣馬公市',23.5650,119.5800,10],['金門','金門縣金城鎮',24.4400,118.3200,30],['馬祖 南竿','連江縣南竿鄉',26.1600,119.9500,50]]
};
/* ================= 多地點切換 ================= */
const Places={
  init(){
    if(!Array.isArray(CFG.places))CFG.places=[];
    if(!CFG.curPlace){CFG.curPlace='gps';
      if(CFG.loc.mode==='fixed'&&CFG.loc.town){const p={id:'p'+Date.now(),name:'',county:CFG.loc.county,town:CFG.loc.town,lat:CFG.loc.lat,lon:CFG.loc.lon};CFG.places.push(p);CFG.curPlace=p.id}
      saveCfg()}
    this.render();
    // 在天氣卡上左右滑動切換地點
    const card=$('#hNowCard');let x0=null,y0=0;
    card.addEventListener('touchstart',e=>{x0=e.touches[0].clientX;y0=e.touches[0].clientY},{passive:true});
    card.addEventListener('touchend',e=>{if(x0==null)return;const dx=e.changedTouches[0].clientX-x0,dy=e.changedTouches[0].clientY-y0;x0=null;
      if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5)this.step(dx<0?1:-1)},{passive:true});
  },
  list(){return [{id:'gps',name:'目前位置',gps:true},...CFG.places]},
  cur(){return this.list().find(p=>p.id===CFG.curPlace)||this.list()[0]},
  label(p){return p.gps?'目前位置':(p.name||p.town)},
  icon(p){return p.gps?'📍':p.spot?(p.elev>=1500?'⛰':'🏞'):'🏠'},
  cache(){return lsGet('wx.pc',{})},
  render(){
    const pc=this.cache();
    $('#hPlaces').innerHTML=this.list().map(p=>{const c=pc[p.id];return `<button class="btn plc ${p.id===CFG.curPlace?'on':''}" data-p="${p.id}">${this.icon(p)} ${esc(this.label(p))}${c?`<span class="plt">${c.i} ${c.t}°</span>`:''}</button>`}).join('')+`<button class="btn plc add" data-p="+">＋ 地點</button>`;
    $('#hPlaces').onclick=e=>{const b=e.target.closest('[data-p]');if(!b)return;const id=b.dataset.p;
      if(id==='+'||id===CFG.curPlace)return this.sheet();this.select(id)};
    const on=$('#hPlaces .on');if(on)on.scrollIntoView({inline:'center',block:'nearest',behavior:'smooth'});
    // 點擊頂部地名也可打開管理
    $('#hPlace').onclick=()=>this.sheet();
  },
  select(id){
    CFG.curPlace=id;const p=this.cur();
    if(p.gps){CFG.loc={...CFG.loc,mode:'gps'}}else CFG.loc={...CFG.loc,mode:'fixed',county:p.county,town:p.town,lat:p.lat,lon:p.lon,elev:p.elev||null,spot:!!p.spot};
    if(p.gps){delete CFG.loc.elev;delete CFG.loc.spot}
    saveCfg();Loc.cur=null;this.render();
    $('#hPlace').textContent=this.label(p);$('#hNowCard').classList.add('swap');setTimeout(()=>$('#hNowCard').classList.remove('swap'),350);
    Home.refresh(p.gps);
  },
  step(d){const L=this.list();let i=L.findIndex(p=>p.id===CFG.curPlace);i=(i+d+L.length)%L.length;if(L.length>1){this.select(L[i].id);toast(this.label(L[i]),1000)}},
  /* 背景更新各地點的氣溫，顯示在膠囊上 */
  async warm(){
    const pc=this.cache();
    for(const p of CFG.places){try{const d=await OM.point(p.lat,p.lon,p.elev);pc[p.id]={t:Math.round(d.now.t),i:wmoIcon(d.now.code,d.now.day),at:Date.now()}}catch(e){}}
    const f=Home.data;if(f){const n=f.now;pc[CFG.curPlace]={t:Math.round(n.t),i:n.text&&n.obs?wxIcon(n.text,n.day??1):wmoIcon(n.code,n.day??1),at:Date.now()}}
    lsSet('wx.pc',pc);this.render();
  },
  sheet(){
    let el=$('#plSheet');if(!el){el=h('div',{id:'plSheet'});document.body.append(el)}
    const pc=this.cache();
    el.innerHTML=`<div class="plBg"></div><div class="plBox glass">
      <div class="lab"><span>📍 我的地點</span><button class="btn sm" id="plX">完成</button></div>
      <div id="plList">${this.list().map((p,i)=>`<div class="plRow ${p.id===CFG.curPlace?'cur':''}" data-id="${p.id}">
        <span class="plI">${this.icon(p)}</span>
        <div class="grow">${p.gps?'<b>目前位置</b><div class="sub">自動定位</div>':`<input class="plName" value="${esc(p.name)}" placeholder="${esc(p.town)}（可取名，如：家、公司）"><div class="sub">${esc(p.spot?(p.area||''):p.county+' '+p.town)}${p.elev?' ・海拔 '+Math.round(p.elev)+' m':''}</div>`}</div>
        ${pc[p.id]?`<span class="plT">${pc[p.id].i} ${pc[p.id].t}°</span>`:''}
        ${p.gps?'':`<button class="ib" data-up="${i}" title="上移">▲</button><button class="ib" data-del="${p.id}" title="刪除">🗑</button>`}
      </div>`).join('')}</div>
      <div class="plAdd"><b>⛰ 景點與高山</b><div class="sub">高山會用該地海拔計算氣溫，並優先採用同高度的氣象站</div>
        <div class="chips" id="spC">${Object.keys(SPOTS).map((k,i)=>`<button class="btn ${i===(this.spCat||0)?'on':''}" data-c="${i}">${k}</button>`).join('')}</div>
        <input id="spQ" placeholder="🔍 搜尋景點，例如：合歡、日月潭、阿里山" style="width:100%;margin:4px 0">
        <div id="spL" class="spL"></div></div>
      <div class="plAdd"><b>＋ 新增地點</b>
        <div class="row"><select id="plC">${TW.countyNames.map(c=>`<option>${c}</option>`).join('')}</select><select id="plT"></select></div>
        <div class="row"><input id="plN" placeholder="名稱（選填，例如：家、公司、爸媽家）" style="flex:1"></div>
        <div class="acts"><button class="btn pri" id="plOk">加入</button><button class="btn" id="plHere">📍 用目前位置加入</button></div>
      </div></div>`;
    el.classList.add('on');
    const spList=()=>{const q=$('#spQ').value.trim();const cat=Object.keys(SPOTS)[this.spCat||0];const L=q?Object.values(SPOTS).flat().filter(x=>(x[0]+x[1]).includes(q)):SPOTS[cat];
      $('#spL').innerHTML=L.map(x=>{const have=CFG.places.some(p=>p.spot&&p.name===x[0]);return `<div class="spI"><div class="grow"><b>${esc(x[0])}</b><div class="sub">${esc(x[1])}・海拔 ${x[4].toLocaleString()} m</div></div>${have?'<span class="ok">已加入</span>':`<button class="btn sm pri" data-sp="${esc(x[0])}">＋</button>`}</div>`}).join('')||'<div class="sub">找不到</div>';
      $$('#spL [data-sp]').forEach(b=>b.onclick=()=>{const x=Object.values(SPOTS).flat().find(y=>y[0]===b.dataset.sp);const tw=TW.locate(x[2],x[3]);
        const p={id:'p'+Date.now(),name:x[0],area:x[1],county:tw?tw.county:'',town:tw?tw.name:x[1],lat:x[2],lon:x[3],elev:x[4],spot:true};CFG.places.push(p);saveCfg();toast('已加入 '+x[0]);this.sheet();this.warm()})};
    $('#spC').onclick=e=>{const b=e.target.closest('[data-c]');if(!b)return;this.spCat=+b.dataset.c;$$('#spC .btn').forEach(x=>x.classList.toggle('on',x===b));spList()};
    $('#spQ').oninput=spList;spList();
    const fill=()=>{const C=TW.counties[$('#plC').value];$('#plT').innerHTML=C.towns.map(t=>`<option>${t.name}</option>`).join('')};
    const l=Loc.get();$('#plC').value=l.county&&TW.counties[l.county]?l.county:'臺北市';fill();if(l.town)$('#plT').value=l.town;$('#plC').onchange=fill;
    const close=()=>{el.classList.remove('on');this.render();const p=this.cur();if(!p.gps)$('#hPlace').textContent=this.label(p)};
    el.querySelector('.plBg').onclick=close;$('#plX').onclick=close;
    const add=(c,t,lat,lon)=>{const p={id:'p'+Date.now(),name:$('#plN').value.trim(),county:c,town:t,lat,lon};CFG.places.push(p);saveCfg();this.sheet();this.warm();toast('已加入 '+this.label(p))};
    $('#plOk').onclick=()=>{const tw=TW.town($('#plC').value,$('#plT').value);if(tw)add(tw.county,tw.name,tw.lat,tw.lon)};
    $('#plHere').onclick=async()=>{const g=await Loc.locate(true);if(g.src==='gps'&&g.county)add(g.county,g.town,g.lat,g.lon);else toast('無法取得定位')};
    el.querySelectorAll('.plName').forEach(inp=>inp.onchange=()=>{const id=inp.closest('.plRow').dataset.id;const p=CFG.places.find(x=>x.id===id);if(p){p.name=inp.value.trim();saveCfg()}});
    el.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{const id=b.dataset.del;CFG.places=CFG.places.filter(x=>x.id!==id);if(CFG.curPlace===id){this.select('gps')}saveCfg();this.sheet()});
    el.querySelectorAll('[data-up]').forEach(b=>b.onclick=()=>{const i=+b.dataset.up-1;if(i<=0)return;const a=CFG.places;[a[i-1],a[i]]=[a[i],a[i-1]];saveCfg();this.sheet()});
    el.querySelectorAll('.plRow').forEach(r=>r.querySelector('.plI').onclick=()=>{this.select(r.dataset.id);close()});
  }
};
