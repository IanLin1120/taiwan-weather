/* ================= 匯整目前位置的天氣 ================= */
const FX={
  cur:null,
  async load(force){
    const loc=await Loc.locate(false);
    if(force)NET.mem.clear();
    const S=await Promise.allSettled([
      OM.point(loc.lat,loc.lon,loc.elev),
      OM.aqPoint(loc.lat,loc.lon),
      CWA.has()?CWA.townForecast(loc.county,loc.town):Promise.reject('nokey'),
      CWA.has()?CWA.townWeek(loc.county,loc.town):Promise.reject('nokey'),
      CWA.has()?CWA.stations():Promise.reject('nokey'),
      CFG.moenvKey?MOENV.sites():Promise.reject('nokey'),
      CWA.has()?CWA.warnings(loc.county):Promise.reject('nokey')
    ]);
    const v=i=>S[i].status==='fulfilled'?S[i].value:null;
    const err=i=>S[i].status==='rejected'&&S[i].reason!=='nokey'?String(S[i].reason&&S[i].reason.message||S[i].reason):null;
    const om=v(0);if(!om)throw new Error('無法取得天氣資料（'+(err(0)||'網路')+'）');
    const fx={loc,at:new Date(),now:{...om.now},hourly:om.hourly,daily:om.daily,min15:om.min15,src:['Open-Meteo'],errs:[]};
    for(const i of [2,3,4,5,6]){const e=err(i);if(e)fx.errs.push(e)}
    // 空品：環境部測站優先
    const aq=v(1);fx.aq=aq?{...aq}:null;
    const ms=v(5);if(ms){const n=nearest(ms,loc.lat,loc.lon,25);if(n){fx.aq={...(fx.aq||{}),pm25:n.pm25,pm10:n.pm10,aqi:n.aqi,status:n.status,site:n.name,km:n.km,src:'環境部 '+n.name+'測站'}}fx.src.push('環境部')}
    // 即時觀測：中央氣象署最近測站
    const st=v(4);if(st){const n=nearest(st,loc.lat,loc.lon,loc.elev?12:15,s=>s.t!=null&&s.time&&Date.now()-s.time<2*3600e3&&(!loc.elev||loc.elev<300||(s.alt!=null&&Math.abs(s.alt-loc.elev)<350)));
      if(n){fx.now.t=n.t;if(n.rh!=null)fx.now.rh=n.rh;if(n.wind!=null){fx.now.wind=n.wind;fx.now.dir=n.dir??fx.now.dir}if(n.gust!=null)fx.now.gust=n.gust;if(n.weather){fx.now.text=n.weather}
        fx.now.obs={name:n.name,km:n.km,time:n.time,rain:n.rain};fx.now.src='中央氣象署 '+n.name+'測站';fx.src.push('中央氣象署觀測')}}
    // CWA 鄉鎮逐 3 小時預報
    const tf=v(2);if(tf&&tf.slots.length){fx.cwa3h=tf.slots;fx.src.push(tf.src);
      const spot=loc.elev>800;   // 高山景點：鄉鎮預報代表鄉公所一帶，與景點的降雨可能差很多 → 兩者取較高值，寧可多帶傘
      for(const hh of fx.hourly){const s=tf.slots.find(s=>s.start<=hh.time&&(!s.end||s.end>hh.time));if(s){if(s.pop!=null)hh.pop=spot&&hh.pop!=null?Math.max(hh.pop,s.pop):s.pop;if(s.wx&&!spot)hh.text=s.wx;hh.desc=s.desc}}
      const s0=tf.slots.find(s=>s.start<=Date.now()&&(!s.end||s.end>Date.now()))||tf.slots[0];if(s0){fx.now.desc=s0.desc;if(!fx.now.obs&&s0.wx)fx.now.text=s0.wx}}
    const tw=v(3);if(tw&&tw.days.length&&!(loc.elev>800)){fx.cwaWeek=tw.days;fx.src.push(tw.src)}
    fx.warn=v(6)||[];
    // 今日統計（未來 12 小時白天）
    fx.today=this.summarize(fx);
    this.cur=fx;lsSet('wx.lastfx',{t:Date.now(),loc,today:fx.today,now:{t:fx.now.t,text:fx.now.text}});
    return fx;
  },
  win(fx,h0,h1){const b=new Date();b.setMinutes(0,0,0);const t0=+b+h0*3600e3,t1=+b+h1*3600e3;return fx.hourly.filter(x=>+x.time>=t0&&+x.time<t1)},
  summarize(fx){
    const now=new Date();let span=12;if(now.getHours()>=20)span=10;
    const W=this.win(fx,0,span);const day=W.filter(x=>x.day)||W;
    const feel=W.map(x=>x.feel).filter(x=>x!=null),tt=W.map(x=>x.t).filter(x=>x!=null);
    const pops=W.map(x=>x.pop).filter(x=>x!=null);const rainSum=W.reduce((a,x)=>a+(x.rain||0),0);
    const uvs=(day.length?day:W).map(x=>x.uv).filter(x=>x!=null);
    const d0=(fx.cwaWeek&&fx.cwaWeek[0])||null,o0=fx.daily[0];
    return {span,feelMax:Math.max(...feel),feelMin:Math.min(...feel),tMax:Math.max(...tt),tMin:Math.min(...tt),
      hi:o0&&o0.hi,lo:o0&&o0.lo,popMax:pops.length?Math.max(...pops):0,rainSum,uvMax:uvs.length?Math.max(...uvs):0,
      windMax:Math.max(...W.map(x=>x.wind||0)),gustMax:Math.max(...W.map(x=>x.gust||0)),
      thunder:W.some(x=>x.code>=95||/雷/.test(x.text||'')),pm25:fx.aq&&fx.aq.pm25,
      wetHours:W.filter(x=>(x.pop||0)>=50||(x.rain||0)>=0.5).map(x=>x.time)};
  }
};

/* ================= 穿搭建議 ================= */
function dressAdvice(fx){
  const T=fx.today,off=CFG.me.feel||0;   // 怕冷 → -2，怕熱 → +2（體感修正）
  const hi=T.feelMax+off,lo=T.feelMin+off,swing=T.feelMax-T.feelMin;
  const A={top:'tee',bottom:'pants',outer:null,rain:null,hat:null,glasses:false,scarf:false,mask:false,sunscreen:false,water:false,fan:false,folding:false};
  const tips=[];
  let main;
  if(hi>=31){A.top='tee';A.bottom='shorts';A.fan=true;A.water=true;main=['短袖＋短褲／薄長褲','選透氣排汗、淺色布料，避免悶熱。']}
  else if(hi>=27){A.top='tee';A.bottom=CFG.me.style==='office'?'pants':'shorts';main=['短袖為主','輕薄透氣即可。']}
  else if(hi>=23){A.top='tee';A.outer=lo<21?'light':null;main=['短袖'+(lo<21?'＋薄外套':''),lo<21?'早晚稍涼，帶件薄外套。':'舒適的溫度。']}
  else if(hi>=19){A.top='long';A.outer='light';main=['長袖＋薄外套','早晚有涼意，可加一件。']}
  else if(hi>=15){A.top='sweater';A.outer='jacket';main=['毛衣／夾克','偏涼，外套要帶。']}
  else if(hi>=11){A.top='sweater';A.outer='coat';A.scarf=true;main=['厚外套＋圍巾','寒冷，注意保暖。']}
  else{A.top='sweater';A.outer='down';A.scarf=true;A.hat='beanie';main=['羽絨外套＋圍巾＋毛帽','非常寒冷，多層次保暖。']}
  tips.push({i:'👕',b:main[0],t:`體感 ${Math.round(T.feelMin)}～${Math.round(T.feelMax)}°C。${main[1]}`});
  if(swing>=8)tips.push({i:'🧅',b:'溫差大，洋蔥式穿法',t:`未來 ${T.span} 小時體感差約 ${Math.round(swing)}°C，方便穿脫最好。`});
  // 雨具
  const nc=Home.nowcast;const raining=(fx.now.rain||0)>0.1||(nc&&nc.nowLv>=2);
  const ride=CFG.me.ride;
  if(raining||T.popMax>=60||T.rainSum>=2){A.rain=ride==='scooter'?'raincoat':'umbrella';
    tips.push({i:ride==='scooter'?'🧥':'☂️',b:ride==='scooter'?'要穿雨衣':'一定要帶傘',t:`未來 ${T.span} 小時降雨機率最高 ${T.popMax}%`+(T.rainSum>=0.5?`，預估累積 ${T.rainSum.toFixed(1)} mm`:'')+(ride==='scooter'?'，騎車建議兩件式雨衣＋鞋套。':'。'),c:'rain'})}
  else if(T.popMax>=30){A.folding=true;tips.push({i:'🌂',b:'帶把折疊傘',t:`未來 ${T.span} 小時降雨機率 ${T.popMax}%，可能有短暫陣雨。`+(ride==='scooter'?'車廂放件輕便雨衣。':''),c:'rain'})}
  else tips.push({i:'🌂',b:'不太需要雨具',t:`未來 ${T.span} 小時降雨機率最高 ${T.popMax}%。`});
  if(T.thunder)tips.push({i:'⚡',b:'可能有雷雨',t:'聽到雷聲請盡快進入室內，避開空曠處。',c:'hot'});
  // 防曬
  if(T.uvMax>=6){A.hat=A.hat||'sun';A.glasses=true;A.sunscreen=true;tips.push({i:'🧴',b:T.uvMax>=8?'高溫防曬：紫外線過量':'需要防曬',t:`紫外線指數最高 ${Math.round(T.uvMax)}（${uvLevel(T.uvMax)[0]}），擦防曬、戴帽子或撐陽傘。`,c:'hot'})}
  else if(T.uvMax>=3){A.sunscreen=true;tips.push({i:'🧴',b:'適度防曬',t:`紫外線指數 ${Math.round(T.uvMax)}（中量級）。`})}
  if(T.tMax>=33){A.water=true;tips.push({i:'💧',b:'高溫注意中暑',t:`氣溫可達 ${Math.round(T.tMax)}°C，多補水、避免正午曝曬。`,c:'hot'})}
  // 空品
  if(T.pm25!=null&&T.pm25>35.4){A.mask=true;tips.push({i:'😷',b:'空品不佳，建議戴口罩',t:`PM2.5 ${Math.round(T.pm25)} μg/m³（${pm25Level(T.pm25)[0]}）。`,c:'hot'})}
  // 風
  if(T.gustMax>=13.9||T.windMax>=10.8){tips.push({i:'🌬',b:'風很大',t:`陣風可達 ${beaufort(T.gustMax)} 級，`+(A.rain==='umbrella'?'雨傘容易開花，改用雨衣較好。':'穿防風外套。')})}
  if(lo<15&&!A.scarf&&hi<20)A.scarf=true;
  return {A,tips};
}

/* ================= 人像穿搭示意圖（SVG） ================= */
function avatarSVG(A,scene){
  const dark=document.documentElement.dataset.theme==='dark';
  const skin='#efc8a0',skinS='#d9a97f',hair=CFG.me.hair==='long'?'#4a3326':'#3b2a20';
  const C={tee:'#c98b5a',long:'#8a9a5b',sweater:'#b5653d',light:'#c9b48a',jacket:'#6f7d4c',coat:'#7a4e2d',down:'#5f6f7a',shorts:'#7d6c57',pants:'#4f4236'};
  const sky=scene.sky,night=!scene.day;
  const bgTop=night?(dark?'#141820':'#2b3550'):sky==='rain'||sky==='storm'?(dark?'#2a2d31':'#9aa6ad'):sky==='cloud'?(dark?'#2c2a26':'#c9cdc8'):(dark?'#3a3226':'#f3d9a8');
  const bgBot=night?(dark?'#241e18':'#5a5248'):sky==='rain'||sky==='storm'?(dark?'#2a241c':'#d8d0c0'):(dark?'#2a2219':'#efe5d3');
  let s=`<svg viewBox="0 0 300 400" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bgTop}"/><stop offset="1" stop-color="${bgBot}"/></linearGradient>
  <style>.dr{stroke:${dark?'#8fb6d8':'#5d8fb8'};stroke-width:2;stroke-linecap:round;animation:fall .9s linear infinite}@keyframes fall{from{transform:translate(0,-30px);opacity:0}20%{opacity:.9}to{transform:translate(-8px,60px);opacity:0}}.cl{animation:drift 9s ease-in-out infinite alternate}@keyframes drift{to{transform:translateX(14px)}}.sun{animation:pulse 4s ease-in-out infinite;transform-origin:62px 62px}@keyframes pulse{50%{transform:scale(1.08)}}</style></defs>
  <rect width="300" height="400" fill="url(#sk)"/>`;
  if(night){s+=`<circle cx="240" cy="58" r="20" fill="#f3e6c4"/><circle cx="249" cy="51" r="18" fill="${bgTop}"/>`;for(let i=0;i<9;i++)s+=`<circle cx="${(i*67)%280+10}" cy="${(i*37)%120+12}" r="1.4" fill="#f6eedb" opacity=".8"/>`}
  else if(sky==='sun'||sky==='part'){s+=`<g class="sun"><circle cx="62" cy="62" r="34" fill="#f2b84b" opacity=".25"/><circle cx="62" cy="62" r="22" fill="#f0a93a"/></g>`}
  if(sky!=='sun'){const cc=sky==='rain'||sky==='storm'?(dark?'#4a4f55':'#8c959b'):(dark?'#5a554c':'#f7f3ea');
    s+=`<g class="cl" fill="${cc}" opacity=".95"><ellipse cx="${sky==='part'?110:90}" cy="58" rx="42" ry="20"/><ellipse cx="${sky==='part'?140:120}" cy="46" rx="30" ry="22"/><ellipse cx="${sky==='part'?160:150}" cy="62" rx="34" ry="16"/>${sky==='part'?'':'<ellipse cx="225" cy="40" rx="40" ry="17"/><ellipse cx="250" cy="52" rx="32" ry="14"/>'}</g>`}
  if(sky==='storm')s+=`<path d="M200 70 l-14 30 h12 l-10 28 l26-36 h-13 l10-22z" fill="#f2c94c"/>`;
  if(sky==='rain'||sky==='storm'){for(let i=0;i<22;i++){const x=(i*53)%290+6,y=(i*29)%160+70;s+=`<line class="dr" x1="${x}" y1="${y}" x2="${x-4}" y2="${y+12}" style="animation-delay:${(i%7)*.13}s"/>`}}
  s+=`<ellipse cx="150" cy="356" rx="74" ry="10" fill="#000" opacity=".14"/>`;
  // 長髮背面
  if(CFG.me.hair==='long')s+=`<path d="M116 92 Q112 150 124 168 L176 168 Q188 150 184 92 Z" fill="${hair}"/>`;
  // 腿
  const leg=(x1,x2)=>{const pc=C[A.bottom];if(A.bottom==='shorts')return `<line x1="${x1}" y1="236" x2="${x1+(x2-x1)*.35}" y2="276" stroke="${pc}" stroke-width="28" stroke-linecap="round"/><line x1="${x1+(x2-x1)*.35}" y1="276" x2="${x2}" y2="342" stroke="${skin}" stroke-width="19" stroke-linecap="round"/>`;
    return `<line x1="${x1}" y1="236" x2="${x2}" y2="340" stroke="${pc}" stroke-width="27" stroke-linecap="round"/>`};
  s+=leg(136,132)+leg(164,168);
  s+=`<ellipse cx="127" cy="350" rx="17" ry="8" fill="#3a2e22"/><ellipse cx="173" cy="350" rx="17" ry="8" fill="#3a2e22"/>`;
  if(A.rain==='raincoat')s+=`<ellipse cx="127" cy="346" rx="17" ry="10" fill="#d9a531" opacity=".9"/><ellipse cx="173" cy="346" rx="17" ry="10" fill="#d9a531" opacity=".9"/>`;
  // 手臂
  const outerCol=A.outer?C[A.outer]:null;const longSleeve=A.top!=='tee'||!!A.outer;
  const slv=outerCol||C[A.top];const umb=A.rain==='umbrella';
  const arm=(sx,ex,ey,raise)=>{if(raise){return `<polyline points="${sx},146 218,176 222,138" fill="none" stroke="${slv}" stroke-width="${A.outer==='down'?26:21}" stroke-linecap="round" stroke-linejoin="round"/>${longSleeve?'':`<line x1="214" y1="174" x2="222" y2="140" stroke="${skin}" stroke-width="15" stroke-linecap="round"/>`}<circle cx="222" cy="134" r="9" fill="${skin}"/>`}
    const mx=sx+(ex-sx)*.42,my=146+(ey-146)*.42;
    return longSleeve?`<line x1="${sx}" y1="146" x2="${ex}" y2="${ey-8}" stroke="${slv}" stroke-width="${A.outer==='down'?26:21}" stroke-linecap="round"/><circle cx="${ex}" cy="${ey}" r="9" fill="${skin}"/>`
      :`<line x1="${sx}" y1="146" x2="${mx}" y2="${my}" stroke="${slv}" stroke-width="23" stroke-linecap="round"/><line x1="${mx}" y1="${my}" x2="${ex}" y2="${ey-6}" stroke="${skin}" stroke-width="15" stroke-linecap="round"/><circle cx="${ex}" cy="${ey}" r="9" fill="${skin}"/>`};
  // 傘（在手後）
  if(umb)s+=`<line x1="222" y1="140" x2="222" y2="44" stroke="#5a4a3a" stroke-width="3"/><path d="M150 66 Q222 -6 294 66 Q282 56 270 66 Q258 56 246 66 Q234 56 222 66 Q210 56 198 66 Q186 56 174 66 Q162 56 150 66Z" fill="#b4553a"/><path d="M222 6 Q206 30 198 66 M222 6 Q238 30 246 66" stroke="#8e3f2a" stroke-width="1.5" fill="none"/>`;
  s+=arm(112,98,250,false);
  // 軀幹
  const torso=A.outer==='down'?'M104 136 Q150 124 196 136 L204 250 Q150 260 96 250 Z':'M110 138 Q150 128 190 138 L196 242 Q150 250 104 242 Z';
  s+=`<path d="M110 138 Q150 128 190 138 L196 242 Q150 250 104 242 Z" fill="${C[A.top]}"/>`;
  if(A.top==='sweater')s+=`<path d="M106 232 Q150 240 194 232" stroke="#00000030" stroke-width="2" fill="none"/><path d="M108 238 Q150 246 192 238" stroke="#00000030" stroke-width="2" fill="none"/><path d="M135 132 Q150 142 165 132" stroke="#00000035" stroke-width="3" fill="none"/>`;
  if(A.top==='tee'&&!A.outer)s+=`<path d="M138 132 Q150 142 162 132" stroke="#00000030" stroke-width="2.5" fill="none"/>`;
  if(A.outer==='light'||A.outer==='jacket'||A.outer==='coat'){const oc=C[A.outer];const L=A.outer==='coat'?262:246;
    s+=`<path d="M108 136 Q126 130 140 132 L138 ${L} L100 ${L-4} Z" fill="${oc}"/><path d="M192 136 Q174 130 160 132 L162 ${L} L200 ${L-4} Z" fill="${oc}"/><path d="M140 132 L132 160 M160 132 L168 160" stroke="#00000030" stroke-width="2"/>`;
    if(A.outer==='coat')s+=`<circle cx="134" cy="190" r="3" fill="#00000040"/><circle cx="134" cy="215" r="3" fill="#00000040"/>`}
  if(A.outer==='down'){s+=`<path d="${torso}" fill="${C.down}"/>`;for(let y=156;y<250;y+=20)s+=`<path d="M100 ${y} Q150 ${y+8} 200 ${y}" stroke="#00000035" stroke-width="2.5" fill="none"/>`;s+=`<line x1="150" y1="132" x2="150" y2="254" stroke="#00000035" stroke-width="2"/>`}
  s+=arm(188,202,250,umb);
  // 脖子、頭
  s+=`<rect x="141" y="114" width="18" height="22" rx="6" fill="${skinS}"/>`;
  s+=`<circle cx="150" cy="92" r="32" fill="${skin}"/>`;
  s+=`<circle cx="139" cy="92" r="3" fill="#3a2e22"/><circle cx="161" cy="92" r="3" fill="#3a2e22"/><path d="M142 105 Q150 111 158 105" stroke="#8e5a3a" stroke-width="2.5" fill="none" stroke-linecap="round"/><circle cx="132" cy="101" r="4.5" fill="#e79c84" opacity=".5"/><circle cx="168" cy="101" r="4.5" fill="#e79c84" opacity=".5"/>`;
  // 頭髮
  if(A.hat!=='beanie')s+=CFG.me.hair==='long'?`<path d="M118 92 Q116 58 150 58 Q186 58 182 92 Q176 74 160 72 Q146 84 122 86 Z" fill="${hair}"/>`:`<path d="M118 90 Q116 58 150 58 Q184 58 182 90 Q178 74 164 70 Q150 80 124 80 Z" fill="${hair}"/>`;
  if(A.glasses)s+=`<rect x="128" y="85" width="19" height="13" rx="5" fill="#2b2420"/><rect x="153" y="85" width="19" height="13" rx="5" fill="#2b2420"/><line x1="147" y1="90" x2="153" y2="90" stroke="#2b2420" stroke-width="2"/>`;
  if(A.mask)s+=`<rect x="133" y="98" width="34" height="19" rx="7" fill="#f4f1ea" stroke="#d8d2c4"/><line x1="118" y1="94" x2="133" y2="103" stroke="#d8d2c4" stroke-width="1.5"/><line x1="182" y1="94" x2="167" y2="103" stroke="#d8d2c4" stroke-width="1.5"/>`;
  if(A.scarf)s+=`<path d="M128 124 Q150 136 172 124 L174 138 Q150 148 126 138 Z" fill="#a2613a"/><path d="M160 136 L166 174 L154 176 L150 138Z" fill="#8e5230"/>`;
  if(A.hat==='sun')s+=`<ellipse cx="150" cy="68" rx="56" ry="11" fill="#d7b27a"/><path d="M122 68 Q124 40 150 40 Q176 40 178 68 Z" fill="#e2c08a"/><path d="M123 62 Q150 70 177 62" stroke="#a2613a" stroke-width="5" fill="none"/>`;
  if(A.hat==='beanie')s+=`<path d="M116 86 Q114 52 150 52 Q186 52 184 86 Z" fill="#a2613a"/><rect x="114" y="78" width="72" height="12" rx="6" fill="#8e5230"/><circle cx="150" cy="50" r="8" fill="#c98b5a"/>`;
  // 雨衣（最上層，半透明）
  if(A.rain==='raincoat')s+=`<path d="M112 98 Q108 50 150 48 Q192 50 188 98 Q186 70 150 66 Q114 70 112 98Z" fill="#e3b23c" opacity=".92"/><path d="M116 116 L84 268 Q150 286 216 268 L184 116 Q150 128 116 116Z" fill="#e3b23c" opacity=".72"/><line x1="150" y1="126" x2="150" y2="276" stroke="#b8862a" stroke-width="2" opacity=".7"/>`;
  // 配件 icon
  const items=[];if(A.sunscreen)items.push('🧴');if(A.water)items.push('🥤');if(A.folding)items.push('🌂');if(A.fan)items.push('🪭');
  items.forEach((e,i)=>s+=`<text x="${18+i*34}" y="388" font-size="26">${e}</text>`);
  return s+'</svg>';
}

/* ================= 主畫面 ================= */
const Home={
  data:null,nowcast:null,
  init(){
    $('#hLocBtn').onclick=async()=>{toast('重新定位中…');if(CFG.curPlace!=='gps'){Places.select('gps');return}await Loc.locate(true);this.refresh(true)};
    Places.init();
    $('#hTheme').onclick=()=>{const d=document.documentElement.dataset.theme==='dark';CFG.theme=d?'light':'dark';saveCfg();applyLook();toast(d?'淺色模式':'暗色模式')};
    const c=lsGet('wx.lastfx',null);if(c){$('#hPlace').textContent=(c.loc.county||'')+' '+(c.loc.town||'')}
    this.refresh();
  },
  async refresh(force){
    $('#hUpd').textContent='更新中…';
    try{
      const fx=await FX.load(force);this.data=fx;this.render();setTimeout(()=>Places.warm(),800);
      this.loadNowcast(fx);
      Alerts.onData&&Alerts.onData(fx);
    }catch(e){$('#hUpd').textContent='⚠️ '+e.message;console.error(e)}
  },
  async loadNowcast(fx){
    const el=$('#hNowcast');el.className='nowcast';el.innerHTML='⏳ 讀取雷達回波中…';
    try{
      const frames=await RADAR.load();const r=RADAR.track(fx.loc.lat,fx.loc.lon,frames);
      let qpf=null;try{await QPF.load();qpf=QPF.maxNear(fx.loc.lat,fx.loc.lon,2)}catch(e){}
      this.nowcast=r;this.qpf=qpf;
      el.innerHTML=nowcastHTML(r,qpf,true);el.className='nowcast '+(r.ok&&(r.nowLv>=2||r.eta!=null&&r.eta<=30)?'alert':'dry');
      this.renderAvatar();
    }catch(e){el.innerHTML='雷達資料暫時無法取得';}
  },
  render(){
    const fx=this.data,n=fx.now,T=fx.today;
    {const p=Places.cur();const area=(fx.loc.county||'')+' '+(fx.loc.town||'');$('#hPlace').innerHTML=(p.gps?esc(area)+' 📍':(p.name?esc(p.name)+' <small>'+esc(p.spot?(p.area||area):area)+'</small>':esc(area)))+(p.elev?` <small>⛰ ${Math.round(p.elev).toLocaleString()} m</small>`:'')+' <span class="plDn">▾</span>';}
    $('#hUpd').textContent=`更新於 ${fmtHM(fx.at)}・${n.src}`;
    const day=n.day??1;
    $('#hIcon').textContent=n.text&&n.obs?wxIcon(n.text,day):wmoIcon(n.code,day);
    $('#hTemp').textContent=Math.round(n.t)+'°';
    $('#hDesc').textContent=n.text||wmoText(n.code);
    $('#hFeel').textContent=`體感 ${Math.round(n.feel)}°・濕度 ${Math.round(n.rh)}%・${dirText(n.dir)}風 ${beaufort(n.wind)} 級`;
    const d0=fx.cwaWeek&&fx.cwaWeek[0]||fx.daily[0];
    $('#hHiLo').innerHTML=`<div>↑ <b>${Math.round(d0.hi??fx.daily[0].hi)}°</b></div><div>↓ <b>${Math.round(d0.lo??fx.daily[0].lo)}°</b></div><div class="sub">☔ ${T.popMax}%</div>`;
    // 警特報
    $('#hWarn').innerHTML=(fx.warn||[]).map(w=>`<div class="warnB">⚠️ ${esc(w.name)}<span class="sub">　${w.end?'至 '+fmtMD(w.end)+' '+fmtHM(w.end):''}</span></div>`).join('');
    TY.load().then(D=>{const html=D.list.map(c=>{const L=c.past[c.past.length-1]||c.fc[0];const [cn,col]=TY.cls(L&&L.wind);
      return `<div class="warnB tyB" onclick="MapLayer.goTyphoon()">🌀 <b>${esc(c.name)}</b> <span class="tyTag" style="background:${col}">${cn}</span>${c.warn?' <b style="color:#c0562b">'+esc(c.warn.event||'颱風警報')+'</b>':''}<span class="sub">　看路徑動畫 ›</span></div>`}).join('');
      let el=$('#hTyB');if(!el){el=h('div',{id:'hTyB'});$('#hWarn').before(el)}el.innerHTML=html}).catch(()=>{});
    CLOSE.load().then(C=>{const cty=String(fx.loc.county||'').replace(/台/g,'臺');const mine=CLOSE.county(cty)||[];let el=$('#hClB');if(!el){el=h('div',{id:'hClB'});$('#hWarn').before(el)}
      const any=CLOSE.stopping();
      el.innerHTML=mine.length&&(any||mine.some(r=>r.st!=='none'))?mine.map(r=>`<div class="warnB clB" onclick="CLOSE.sheet()">🏫 <b>${esc(r.area)}</b> ${CLOSE.chip(r.st)}<div class="sub">${esc(r.text.split('\n')[0])}</div></div>`).join('')
        :(!mine.length&&any&&cty?`<div class="warnB clB ok" onclick="CLOSE.sheet()">🏫 <b>${esc(cty)}</b> ${CLOSE.chip('normal')}<div class="sub">停班停課名單中沒有${esc(cty)}（照常上班上課）・點此看全台</div></div>`:'')}).catch(()=>{});
    this.renderAvatar();
    // 逐時
    const H=FX.win(fx,0,25);
    $('#hHourly').innerHTML=H.map((x,i)=>`<div class="hcell ${i===0?'now':''}"><div class="sub">${i===0?'現在':pad(x.time.getHours())+'時'}</div><div class="ic">${x.text?wxIcon(x.text,x.day):wmoIcon(x.code,x.day)}</div><div class="t">${Math.round(x.t)}°</div><div class="p">${x.pop!=null?'💧'+x.pop+'%':''}</div></div>`).join('');
    // 指標
    const aq=fx.aq||{},pl=pm25Level(aq.pm25),ul=uvLevel(T.uvMax);
    const sr=fx.daily[0].sunrise,ss=fx.daily[0].sunset;
    const kv=(k,v,d,bar)=>`<div class="kv"><div class="k">${k}</div><div class="v">${v}</div>${d?`<div class="d">${d}</div>`:''}${bar?`<div class="bar"><i style="width:${bar[0]}%;background:${bar[1]}"></i></div>`:''}</div>`;
    $('#hGrid').innerHTML=
      kv('🌡 氣溫範圍',`${Math.round(T.tMin)}–${Math.round(T.tMax)}°C`,`體感 ${Math.round(T.feelMin)}–${Math.round(T.feelMax)}°C`)+
      kv('☔ 降雨機率',T.popMax+'%',T.rainSum>=0.1?`累積約 ${T.rainSum.toFixed(1)} mm`:'未來 '+T.span+' 小時',[T.popMax,'var(--rain)'])+
      kv('🕶 紫外線',Math.round(T.uvMax),ul&&ul[0],[clamp(T.uvMax/11*100,0,100),ul&&ul[1]])+
      kv('😷 PM2.5',aq.pm25!=null?Math.round(aq.pm25)+' μg':'—',pl?(pl[0]+'・'+(aq.site?aq.site+'站':'模式預估')):'',pl?[clamp(aq.pm25/75*100,0,100),pl[1]]:null)+
      kv('🌬 風力',`${beaufort(n.wind)} 級`,`${dirText(n.dir)}風 ${n.wind?.toFixed(1)} m/s・陣風 ${beaufort(T.gustMax)} 級`)+
      kv('💧 濕度',Math.round(n.rh)+'%',n.rh>=85?'悶濕':n.rh<=45?'乾燥':'')+
      kv('🌅 日出／日落',`${fmtHM(sr)}／${fmtHM(ss)}`)+
      (aq.aqi!=null?kv('🏭 AQI',Math.round(aq.aqi),aq.status||aq.src||''):'');
    // 一週
    const wk=fx.cwaWeek&&fx.cwaWeek.length>=5?fx.cwaWeek.map(d=>({date:d.date,hi:d.hi,lo:d.lo,pop:d.pop,icon:wxIcon(d.wx),text:d.wx})):fx.daily.map(d=>({date:d.date,hi:d.hi,lo:d.lo,pop:d.pop,icon:wmoIcon(d.code),text:wmoText(d.code)}));
    // 「今天」那列只看今天剩下的時段，跟上面「未來 12 小時」用同一份逐時資料，避免把早上已經過去的降雨機率算進來
    {const mid=new Date();mid.setHours(24,0,0,0);const rest=fx.hourly.filter(h=>+h.time>=Date.now()-3600e3&&+h.time<+mid&&h.pop!=null).map(h=>h.pop);if(wk[0]&&rest.length){wk[0].pop=Math.max(...rest);wk[0].rest=true}}
    const gmin=Math.min(...wk.map(d=>d.lo)),gmax=Math.max(...wk.map(d=>d.hi));
    $('#hWeek').innerHTML=wk.slice(0,7).map(d=>`<div class="wrow"><div><b>${fmtDay(d.date)}</b><div class="sub">${d.rest?'剩餘時段':fmtMD(d.date)}</div></div><div style="font-size:22px">${d.icon}</div><div class="sub">${Math.round(d.lo)}°</div><div class="trng"><i style="left:${(d.lo-gmin)/(gmax-gmin+.01)*100}%;right:${100-(d.hi-gmin)/(gmax-gmin+.01)*100}%"></i></div><div><b>${Math.round(d.hi)}°</b><div class="pp">${d.pop!=null?d.pop+'%':''}</div></div></div>`).join('');
    $('#hSrc').innerHTML='資料來源：'+[...new Set(fx.src)].map(esc).join('、')+(CWA.has()?'':'<br>💡 到「設定」填入中央氣象署授權碼，可改用官方鄉鎮預報與測站觀測')+(fx.errs.length?'<br>⚠️ '+fx.errs.map(esc).join('；'):'');
  },
  renderAvatar(){
    const fx=this.data;if(!fx)return;const {A,tips}=dressAdvice(fx);
    const n=fx.now,nc=this.nowcast;
    const raining=(n.rain||0)>0.1||(nc&&nc.nowLv>=2)||/雨/.test(n.text||'');
    const sky=fx.today.thunder&&raining?'storm':raining?'rain':(n.cloud??50)>80||/陰/.test(n.text||'')?'cloud':(n.cloud??50)>35||/多雲/.test(n.text||'')?'part':'sun';
    $('#avatar').innerHTML=avatarSVG(A,{sky,day:n.day??1});
    $('#dressTips').innerHTML=tips.map(t=>`<div class="tip ${t.c||''}"><i>${t.i}</i><div><b>${esc(t.b)}</b>${esc(t.t)}</div></div>`).join('');
  }
};
function nowcastHTML(r,qpf,short){
  if(!r||!r.ok)return `🛰 ${r?r.msg:'雷達資料不足'}`;
  const ago=Math.round(r.age);const src=RADAR.src==='rv'?'RainViewer':'氣象署雷達';
  let s;
  if(r.nowLv>=2)s=`🌧 <b>目前雷達顯示正在下${LV_TEXT[r.nowLv]}</b>`+(r.stopIn?`，約 ${r.stopIn} 分鐘後趨緩`:'');
  else if(r.eta!=null)s=`⏱ <b>約 ${r.eta} 分鐘後可能開始下雨</b>（${LV_TEXT[r.etaLv]}）`;
  else if(r.nearestKm!=null&&r.nearestKm<40)s=`🌦 ${Math.round(r.nearestKm)} 公里外有降雨回波`+(r.moving?`，${dirText(r.dirFrom)}方往${dirText(r.dirTo)}移動 ${Math.round(r.spd)} km/h，短時間內不會到達`:'');
  else s='☀️ 附近沒有降雨回波，未來 1 小時不太會下雨';
  if(qpf!=null&&qpf>=0.5)s+=`<br><span class="sub">氣象署 1 小時雨量預報：此處約 ${qpf.toFixed(1)} mm</span>`;
  return `<div class="grow">${s}<div class="sub">${src} ${fmtHM(r.frameTime)}（${ago} 分鐘前）</div></div>`;
}
