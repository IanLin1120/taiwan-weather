/* ================= ⑤ 設定 ================= */
const Settings={
  init(){this.render()},
  seg(id,opts,cur){return `<div class="seg" id="${id}">${opts.map(([v,n])=>`<button class="btn ${String(cur)===String(v)?'on':''}" data-v="${v}">${n}</button>`).join('')}</div>`},
  bindSeg(id,fn){const e=$('#'+id);if(e)e.onclick=ev=>{const b=ev.target.closest('[data-v]');if(!b)return;$$('#'+id+' .btn').forEach(x=>x.classList.toggle('on',x===b));fn(b.dataset.v);saveCfg()}},
  render(){
    const open=u=>isApp?`href="#" onclick="NAT.call('openUrl','${u}');return false"`:`href="${u}" target="_blank" rel="noopener"`;
    $('#sKeys').innerHTML=`<h3>🔑 資料來源與帳號</h3>
      <div class="lab"><span>中央氣象署 開放資料授權碼</span><span id="kCwaSt" class="sub">${CFG.cwaKey?'已設定':'未設定'}</span></div>
      <div class="keyRow"><input id="kCwa" placeholder="CWA-XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX" value="${esc(CFG.cwaKey)}" autocomplete="off" spellcheck="false"><button class="btn sm pri" id="kCwaT">儲存並測試</button></div>
      <ol class="how"><li>到 <a ${open('https://opendata.cwa.gov.tw/user/authkey')}>氣象資料開放平臺</a> 註冊會員（免費，可用 Google 帳號登入）</li><li>登入後點右上「取得授權碼」</li><li>複製「CWA-」開頭的授權碼貼到上面</li></ol>
      <div class="sub">開通：鄉鎮逐 3 小時與一週預報、即時測站、雨量站、閃電、颱風路徑、警特報。</div>
      <div class="lab" style="margin-top:14px"><span>環境部 環境資料開放平臺 api_key</span><span id="kMoSt" class="sub">${CFG.moenvKey?'已設定':'未設定'}</span></div>
      <div class="keyRow"><input id="kMo" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value="${esc(CFG.moenvKey)}" autocomplete="off" spellcheck="false"><button class="btn sm pri" id="kMoT">儲存並測試</button></div>
      <ol class="how"><li>到 <a ${open('https://data.moenv.gov.tw/')}>環境資料開放平臺</a> 右上「登入／註冊」建立會員</li><li>到會員中心「API 金鑰申請」，金鑰會寄到你的信箱</li><li>貼上 api_key（用於 PM2.5／AQI 即時測站）</li></ol>
      <div class="lab" style="margin-top:12px"><span>免金鑰來源</span></div>
      <div class="sub">✅ 氣象署雷達整合回波圖、未來 1 小時雷達定量降雨預報（公開 S3）<br>✅ Open-Meteo 逐時格點預報與空品預報（備援／時間軸）<br>${isApp?'':'✅ RainViewer 雷達（瀏覽器版備援）'}</div>`;
    $('#kCwaT').onclick=async()=>{const k=$('#kCwa').value.trim();$('#kCwaSt').textContent='測試中…';try{const ok=await CWA.test(k);if(!ok)throw 0;CFG.cwaKey=k;saveCfg();NET.clearCache();$('#kCwaSt').innerHTML='<span class="ok">✓ 可用</span>';App.reload()}catch(e){$('#kCwaSt').innerHTML='<span class="bad">✗ 無法驗證</span>';if(k&&confirm('驗證失敗（可能是網路或授權碼錯誤），仍要儲存嗎？')){CFG.cwaKey=k;saveCfg()}}};
    $('#kMoT').onclick=async()=>{const k=$('#kMo').value.trim();$('#kMoSt').textContent='測試中…';try{const s=await MOENV.sites(k);if(!s.length)throw 0;CFG.moenvKey=k;saveCfg();$('#kMoSt').innerHTML=`<span class="ok">✓ 可用（${s.length} 站）</span>`;App.reload()}catch(e){$('#kMoSt').innerHTML='<span class="bad">✗ 無法驗證</span>';if(k&&confirm('驗證失敗，仍要儲存嗎？')){CFG.moenvKey=k;saveCfg()}}};
    this.renderPerm();
    // 位置
    $('#sLoc').innerHTML=`<h3>📍 位置</h3>${this.seg('lMode',[['gps','📍 自動定位'],['fixed','🏠 固定地區']],CFG.loc.mode)}
      <div class="row"><select id="lC">${TW.countyNames.map(c=>`<option ${c===CFG.loc.county?'selected':''}>${c}</option>`).join('')}</select><select id="lT"></select></div>
      <div class="sub">自動定位失敗時，也會使用這裡選的地區。</div>`;
    const fillT=()=>{const C=TW.counties[$('#lC').value];$('#lT').innerHTML=C.towns.map(t=>`<option ${t.name===CFG.loc.town?'selected':''}>${t.name}</option>`).join('')};fillT();
    $('#lC').onchange=()=>{fillT();Loc.setFixed($('#lC').value,$('#lT').value);this.render()};$('#lT').onchange=()=>{Loc.setFixed($('#lC').value,$('#lT').value);this.render()};
    this.bindSeg('lMode',v=>{CFG.loc.mode=v;if(v==='fixed')Loc.setFixed($('#lC').value,$('#lT').value);else{Loc.locate(true).then(()=>App.reload())}});
    // 外觀
    const accs=[['terra','#a2613a'],['moss','#6f7d4c'],['sand','#b0884a'],['coffee','#7a4e2d'],['clay','#b4553a']];
    $('#sLook').innerHTML=`<h3>🎨 外觀</h3>
      <div class="row"><span class="sub">明暗</span>${this.seg('aTh',[['light','☀️ 淺色'],['dark','🌙 暗色'],['auto','🌓 跟隨系統']],CFG.theme)}</div>
      <div class="row"><span class="sub">材質</span>${this.seg('aMat',[['liquid','💧 液態玻璃'],['paper','📜 紙質'],['solid','🪨 霧面']],CFG.mat)}</div>
      <div class="row"><span class="sub">主色</span>${accs.map(([k,c])=>`<span class="swatch ${CFG.acc===k?'on':''}" data-a="${k}" style="background:${c}"></span>`).join('')}</div>
      <div class="row"><span class="sub">玻璃透明度</span><input type="range" id="aGa" min=".15" max=".8" step=".01" value="${CFG.gA}" style="flex:1"></div>`;
    this.bindSeg('aTh',v=>{CFG.theme=v;applyLook()});this.bindSeg('aMat',v=>{CFG.mat=v;applyLook()});
    $$('#sLook .swatch').forEach(s=>s.onclick=()=>{CFG.acc=s.dataset.a;saveCfg();applyLook();this.render()});
    $('#aGa').oninput=e=>{CFG.gA=+e.target.value;applyLook()};$('#aGa').onchange=()=>saveCfg();
    // 個人化
    const M=CFG.me;
    $('#sMe').innerHTML=`<h3>🧍 穿搭個人化</h3>
      <div class="row"><span class="sub">體感</span>${this.seg('mFeel',[[-2,'🥶 怕冷'],[0,'🙂 一般'],[2,'🥵 怕熱']],M.feel)}</div>
      <div class="row"><span class="sub">交通</span>${this.seg('mRide',[['scooter','🛵 機車'],['walk','🚶 步行／大眾運輸'],['car','🚗 開車']],M.ride)}</div>
      <div class="row"><span class="sub">場合</span>${this.seg('mStyle',[['casual','休閒'],['office','上班／上學']],M.style)}</div>
      <div class="row"><span class="sub">人像</span>${this.seg('mHair',[['short','短髮'],['long','長髮']],M.hair)}</div>`;
    const re=()=>{if(Home.data){Home.data.today=FX.summarize(Home.data);Home.renderAvatar()}};
    this.bindSeg('mFeel',v=>{M.feel=+v;re()});this.bindSeg('mRide',v=>{M.ride=v;re()});this.bindSeg('mStyle',v=>{M.style=v;re()});this.bindSeg('mHair',v=>{M.hair=v;re()});
    // 資料
    $('#sData').innerHTML=`<h3>🔄 更新與資料</h3>
      <div class="row"><span class="sub">開著 App 時自動更新</span>${this.seg('dRef',[[10,'10 分'],[15,'15 分'],[30,'30 分'],[0,'關閉']],CFG.refresh)}</div>
      <div class="sub">雷達圖每 10 分鐘更新一張，每張約 0.5–1.5 MB。背景降雨監測在附近 60 公里內沒有回波、且降雨機率低時，會自動拉長下載間隔來省流量。</div>
      <div class="acts"><button class="btn sm" id="dClr">🧹 清除快取</button><button class="btn sm" id="dRe">⟳ 立即更新</button></div>`;
    this.bindSeg('dRef',v=>{CFG.refresh=+v;App.schedule()});
    $('#dClr').onclick=()=>{NET.clearCache();RADAR.frames=[];toast('已清除快取')};$('#dRe').onclick=()=>App.reload(true);
    const ver=NAT.call('version')||'網頁版';
    UPD.render();
    $('#sAbout').innerHTML=`<h3>ℹ️ 關於</h3><div class="sub">台灣即時天氣預報 ${esc(ver)}<br>
      資料：<a ${open('https://opendata.cwa.gov.tw/')}>交通部中央氣象署</a>、<a ${open('https://data.moenv.gov.tw/')}>環境部</a>、<a ${open('https://open-meteo.com/')}>Open-Meteo</a>（CC BY 4.0）${isApp?'':'、<a href="https://www.rainviewer.com/" target="_blank">RainViewer</a>'}<br>
      地圖：© OpenFreeMap、© OpenStreetMap；地形：Mapzen／AWS Terrain Tiles；行政區界：taiwan-atlas（內政部國土測繪中心）<br>
      「X 分鐘後下雨」是依雷達回波移動外推的估計，實際天氣以中央氣象署發布為準。</div>`;
  },
  async renderPerm(){
    let p;
    if(isApp)p=NAT.json('perms')||{};
    else{p={};try{p.loc=(await navigator.permissions.query({name:'geolocation'})).state==='granted'}catch(e){}p.notif='Notification' in window&&Notification.permission==='granted'}
    const row=(i,n,d,ok,act)=>`<div class="prm"><span style="font-size:22px">${i}</span><div class="grow"><b>${n}</b><span class="sub">${d}</span></div>${ok?'<span class="ok">✓ 已允許</span>':`<button class="btn sm pri" data-p="${act}">允許</button>`}</div>`;
    $('#sPerm').innerHTML=`<h3>🛡 權限</h3>`+
      row('📍','定位','取得目前所在鄉鎮的天氣',p.loc,'loc')+
      row('🔔','通知','預報通知、即時降雨提醒',p.notif,'notif')+
      (isApp?row('🛰','背景定位（選用）','App 關閉時，降雨提醒跟著你移動；不允許則使用最後位置',p.bgloc,'bgloc')+
        row('🔋','不受電池最佳化限制','讓背景降雨監測與定時通知準時送達',p.battery,'battery')+
        `<div class="acts"><button class="btn sm" onclick="NAT.call('openAppSettings')">⚙️ 開啟系統 App 設定</button></div>`:'<div class="sub">瀏覽器版的權限由瀏覽器管理。</div>');
    $$('#sPerm [data-p]').forEach(b=>b.onclick=async()=>{const k=b.dataset.p;
      if(isApp){NAT.call('requestPerm',k);return}
      if(k==='loc'){await Loc.locate(true);this.renderPerm()}if(k==='notif'){await Alerts.ensurePerm();this.renderPerm()}});
  }
};

/* ================= App 控制 ================= */
const App={
  inited:{},
  boot(){
    TW.init();applyLook();
    $('#nav').onclick=e=>{const b=e.target.closest('[data-v]');if(b)this.show(b.dataset.v)};
    Home.init();Alerts.init();
    this.schedule();
    window.onAndroidBack=()=>{const cur=$('.view.on').id;if(cur!=='v-home'){this.show('v-home');return true}return false};
    setTimeout(()=>{if(!this.inited.map){}},0);
    saveCfg();UPD.auto();
  },
  show(id){
    $$('.view').forEach(v=>v.classList.toggle('on',v.id===id));$$('#nav .btn').forEach(b=>b.classList.toggle('on',b.dataset.v===id));
    if(!this.inited[id]){this.inited[id]=1;
      if(id==='v-map')MapLayer.init();if(id==='v-area')Area.init();if(id==='v-set')Settings.init();}
    else{if(id==='v-map'&&MapLayer.map){MapLayer.map.resize();if(MapLayer.layer==='wind'&&MapLayer.grid)Wind.set(MapLayer.grid,MapLayer.ti)}
      if(id==='v-area'){Area.map&&Area.map.resize();Area.renderWatch();Area.update()}if(id==='v-set'){Settings.renderPerm()}}
    if(id==='v-alert'){Alerts.render();Alerts.hist()}
  },
  schedule(){clearInterval(this._ri);if(CFG.refresh)this._ri=setInterval(()=>this.reload(),CFG.refresh*60e3)},
  reload(force){Home.refresh(force);if(this.inited['v-area']){RADAR.loadedAt=0;Area.load()}},
  onResume(){if(Home.data&&Date.now()-Home.data.at>5*60e3)this.reload();if(this.inited['v-set'])Settings.renderPerm();if(this.inited['v-area'])Area.renderWatch()}
};
document.addEventListener('visibilitychange',()=>{if(!document.hidden)App.onResume()});
App.boot();
