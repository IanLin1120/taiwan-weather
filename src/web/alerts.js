/* ================= ② 預報通知 ================= */
const Digest={
  h3(fx){
    const W=FX.win(fx,0,3);if(!W.length)return null;
    const t=W.map(x=>x.t),pop=Math.max(...W.map(x=>x.pop||0)),rain=W.reduce((a,x)=>a+(x.rain||0),0);
    const slot=fx.cwa3h&&fx.cwa3h.find(s=>s.end>Date.now());
    const wx=slot&&slot.wx||W.map(x=>x.text||wmoText(x.code)).sort((a,b)=>W.filter(x=>(x.text||wmoText(x.code))===b).length-W.filter(x=>(x.text||wmoText(x.code))===a).length)[0];
    const h0=W[0].time,h1=new Date(+W[W.length-1].time+3600e3);
    const nc=Home.nowcast;let ncs='';if(nc&&nc.ok){if(nc.nowLv>=2)ncs='\n🌧 雷達顯示目前正在下雨';else if(nc.eta!=null&&nc.eta<=60)ncs=`\n⏱ 雷達推估約 ${nc.eta} 分鐘後下雨`}
    return {title:`未來 3 小時｜${fx.loc.town||''}`,
      body:`${pad(h0.getHours())}–${pad(h1.getHours())} 時 ${wx}，降雨機率 ${pop}%${rain>=0.5?'（約 '+rain.toFixed(1)+' mm）':''}\n氣溫 ${Math.round(Math.min(...t))}–${Math.round(Math.max(...t))}°C，${dirText(W[0].dir)}風 ${beaufort(Math.max(...W.map(x=>x.wind||0)))} 級`+ncs,
      key:`${wx}|${Math.round(pop/20)}`,rainy:pop>=50||rain>=1};
  },
  today(fx){
    const T=fx.today,d=fx.cwaWeek&&fx.cwaWeek[0],o=fx.daily[0];const {tips}=dressAdvice(fx);
    const wx=d&&d.wx||wmoText(o.code);
    return {title:`今日天氣｜${fx.loc.county||''}${fx.loc.town||''}`,
      body:`${wx}，${Math.round(T.tMin)}–${Math.round(T.tMax)}°C（體感 ${Math.round(T.feelMin)}–${Math.round(T.feelMax)}°C），降雨機率 ${T.popMax}%\n`+tips.slice(0,4).map(t=>t.i+' '+t.b).join('　')};
  },
  week(fx){
    const wk=fx.cwaWeek&&fx.cwaWeek.length>=5?fx.cwaWeek.map(d=>({date:d.date,hi:d.hi,lo:d.lo,pop:d.pop,i:wxIcon(d.wx)})):fx.daily.map(d=>({date:d.date,hi:d.hi,lo:d.lo,pop:d.pop,i:wmoIcon(d.code)}));
    const rainy=wk.slice(0,7).filter(d=>(d.pop||0)>=60).map(d=>fmtDay(d.date));
    return {title:`一週天氣｜${fx.loc.town||''}`,
      body:wk.slice(0,7).map(d=>`${fmtDay(d.date)} ${d.i} ${Math.round(d.lo)}–${Math.round(d.hi)}° ☔${d.pop??'—'}%`).join('\n')+(rainy.length?`\n記得帶傘：${rainy.join('、')}`:'')};
  }
};
const Alerts={
  fx:null,
  init(){this.render();this.hist();this.tick();setInterval(()=>this.tick(),60e3);
    if(isApp&&!lsGet('wx.askedNotif',false)){const p=NAT.json('perms')||{};if(!p.notif){setTimeout(()=>NAT.call('requestPerm','notif'),2500)}lsSet('wx.askedNotif',true)}},
  onData(fx){this.fx=fx;
    const d={h3:Digest.h3(fx),today:Digest.today(fx),week:Digest.week(fx),at:Date.now(),lat:fx.loc.lat,lon:fx.loc.lon,place:(fx.loc.county||'')+(fx.loc.town||'')};
    NAT.call('setDigest',JSON.stringify(d));this.digest=d;if($('#v-alert').classList.contains('on'))this.render()},
  sw(id,on){return `<label class="sw"><input type="checkbox" id="${id}" ${on?'checked':''}><span></span></label>`},
  render(){
    const N=CFG.notif,d=this.digest;
    const pv=x=>x?`<div class="npv"><b>${esc(x.title)}</b>${esc(x.body)}</div>`:'<div class="npv sub">資料載入後顯示預覽…</div>';
    $('#nc-h3').innerHTML=`<div class="lab"><span>⏱ 未來三小時天氣</span>${this.sw('n_h3',N.h3.on)}</div>
      <div class="row"><span class="sub">推播頻率</span><div class="seg" id="n_h3e">${[1,2,3].map(v=>`<button class="btn ${N.h3.every==v?'on':''}" data-v="${v}">每 ${v} 小時</button>`).join('')}</div></div>
      <div class="lab"><span class="sub">只在天氣有變化或可能下雨時通知</span>${this.sw('n_h3c',N.h3.onlyChange)}</div>${pv(d&&d.h3)}
      <div class="acts"><button class="btn sm" data-test="h3">🔔 傳送測試</button></div>`;
    $('#nc-today').innerHTML=`<div class="lab"><span>☀️ 今日天氣與穿搭</span>${this.sw('n_td',N.today.on)}</div>
      <div class="row"><span class="sub">每天</span><input type="time" id="n_tdt" value="${N.today.time}"><span class="sub">通知</span></div>${pv(d&&d.today)}
      <div class="acts"><button class="btn sm" data-test="today">🔔 傳送測試</button></div>`;
    $('#nc-week').innerHTML=`<div class="lab"><span>📆 一週天氣</span>${this.sw('n_wk',N.week.on)}</div>
      <div class="row"><select id="n_wkd">${[...'日一二三四五六'].map((c,i)=>`<option value="${i}" ${N.week.day==i?'selected':''}>每週${c}</option>`).join('')}<option value="7" ${N.week.day==7?'selected':''}>每天</option></select><input type="time" id="n_wkt" value="${N.week.time}"></div>${pv(d&&d.week)}
      <div class="acts"><button class="btn sm" data-test="week">🔔 傳送測試</button></div>`;
    $('#nc-more').innerHTML=`<div class="lab"><span>☔ 即時降雨提醒<div class="sub">雷達回波接近時推播「X 分鐘後下雨」</div></span>${this.sw('n_rain',N.rain.on)}</div>
      <div class="row"><span class="sub">提前</span><div class="seg" id="n_lead">${[5,10,15,30].map(v=>`<button class="btn ${N.rain.lead==v?'on':''}" data-v="${v}">${v} 分</button>`).join('')}</div></div>
      <div class="lab"><span>⚠️ 天氣警特報<div class="sub">豪雨、強風、低溫、高溫等（需 CWA 授權碼）</div></span>${this.sw('n_warn',N.warn.on)}</div>
      <div class="sub">${isApp?'通知由手機在背景排程發送，App 關閉時也會收到。':'瀏覽器版只在此網頁開著時才能通知；安裝 APK 可在背景收到。'}</div>`;
    const bind=(id,fn)=>{const e=$('#'+id);if(e)e.onchange=()=>{fn(e);saveCfg();this.applyNative()}};
    bind('n_h3',e=>N.h3.on=e.checked);bind('n_h3c',e=>N.h3.onlyChange=e.checked);bind('n_td',e=>N.today.on=e.checked);bind('n_tdt',e=>N.today.time=e.value);
    bind('n_wk',e=>N.week.on=e.checked);bind('n_wkd',e=>N.week.day=+e.value);bind('n_wkt',e=>N.week.time=e.value);bind('n_warn',e=>N.warn.on=e.checked);
    bind('n_rain',e=>{N.rain.on=e.checked;if(App.inited['v-area'])Area.renderWatch()});
    const seg=(id,fn)=>{$('#'+id).onclick=ev=>{const b=ev.target.closest('[data-v]');if(!b)return;fn(+b.dataset.v);saveCfg();this.applyNative();this.render()}};
    seg('n_h3e',v=>N.h3.every=v);seg('n_lead',v=>N.rain.lead=v);
    $$('[data-test]').forEach(b=>b.onclick=async()=>{const k=b.dataset.test;if(!(await this.ensurePerm()))return;const x=this.digest&&this.digest[k];if(!x)return toast('資料還在載入');this.send(x.title,x.body,k)});
    if(N.h3.on||N.today.on||N.week.on||N.rain.on)this.ensurePerm(true);
  },
  async ensurePerm(silent){
    if(isApp){const p=NAT.json('perms')||{};if(!p.notif){if(!silent)NAT.call('requestPerm','notif');return !!silent}return true}
    if(!('Notification' in window)){if(!silent)toast('此瀏覽器不支援通知');return false}
    if(Notification.permission==='granted')return true;if(silent)return false;
    return (await Notification.requestPermission())==='granted';
  },
  applyNative(){NAT.call('saveConfig',JSON.stringify(CFG))},
  send(title,body,kind){
    if(isApp)NAT.call('notify',title,body,kind);
    else if('Notification' in window&&Notification.permission==='granted')new Notification(title,{body,tag:kind});
    if(!isApp){const H=lsGet('wx.nhist',[]);H.unshift({t:Date.now(),title,body,kind});lsSet('wx.nhist',H.slice(0,40))}this.hist();
  },
  hist(){let H=lsGet('wx.nhist',[]);const nh=NAT.json('history');if(nh)H=nh.concat(H).sort((a,b)=>b.t-a.t).slice(0,40);
    $('#nHist').innerHTML=H.length?H.map(x=>`<div class="hist"><small>${fmtMD(new Date(x.t))} ${fmtHM(new Date(x.t))}</small> <b>${esc(x.title)}</b><div class="sub">${esc(x.body).replace(/\n/g,'<br>')}</div></div>`).join(''):'<div class="sub">尚無通知紀錄</div>'},
  /* 瀏覽器版：網頁開著時的排程 */
  tick(){
    if(isApp)return;const N=CFG.notif,now=new Date(),hm=fmtHM(now),last=lsGet('wx.nlast',{}),d=this.digest;if(!d)return;
    const fire=(k,x)=>{if(!x)return;this.send(x.title,x.body,k);last[k]=Date.now();lsSet('wx.nlast',last)};
    if(N.today.on&&hm===N.today.time&&Date.now()-(last.today||0)>3600e3)fire('today',d.today);
    if(N.week.on&&hm===N.week.time&&(N.week.day==7||now.getDay()==N.week.day)&&Date.now()-(last.week||0)>3600e3)fire('week',d.week);
    if(N.h3.on&&Date.now()-(last.h3||0)>=N.h3.every*3600e3-60e3){if(!N.h3.onlyChange||d.h3.rainy||d.h3.key!==last.h3key){last.h3key=d.h3.key;fire('h3',d.h3)}}
  }
};
