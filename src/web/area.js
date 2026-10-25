/* ================= ④ 區域即時雨況 ================= */
const Area={
  map:null,mode:'radar',sel:null,steps:[],ti:0,
  async init(){
    const cty=TW.countyNames;
    $('#arCounty').innerHTML=cty.map(c=>`<option>${c}</option>`).join('');
    $('#arCounty').onchange=()=>{this.fillTowns();const C=TW.counties[$('#arCounty').value];this.pick(C.name,C.seat?C.seat.name:C.towns[0].name,true)};
    $('#arTown').onchange=()=>this.pick($('#arCounty').value,$('#arTown').value,true);
    $('#arGps').onclick=async()=>{const l=await Loc.locate(true);if(l.county){this.sel={...l};this.syncSel();this.zoomTo(l.county,l.town);this.update()}};
    $('#arMode').innerHTML=[['radar','📡 雷達回波'],['cloud','☁️ 雲量預報'],['qpf','🌧 1 小時雨量']].map(([k,n])=>`<button class="btn ${k===this.mode?'on':''}" data-m="${k}">${n}</button>`).join('')+'';
    $('#arView').onclick=()=>{CFG.area3d=!CFG.area3d;saveCfg();this.view()};
    $('#arMode').onclick=e=>{const b=e.target.closest('[data-m]');if(!b)return;$$('#arMode [data-m]').forEach(x=>x.classList.toggle('on',x===b));this.mode=b.dataset.m;this.load()};
    $('#arRange').oninput=e=>this.show(+e.target.value);
    $('#arPlay').onclick=()=>this.play();
    $('#arGrab').onclick=()=>$('#arPanel').classList.toggle('mini');
    const l=Loc.get();this.sel={county:l.county||'臺北市',town:l.town||'中正區',lat:l.lat,lon:l.lon,src:l.src};
    this.syncSel();this.renderWatch();
    try{this.map=await GL.make('arMap')}catch(e){$('#arTl').textContent='⚠️ 這支手機無法顯示向量地圖（WebGL）';return}
    const m=this.map;
    m.addSource('tw-town',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    m.addLayer({id:'tw-town-fill',type:'fill',source:'tw-town',paint:{'fill-color':'#a2613a','fill-opacity':['case',['get','sel'],.14,0]}},GL.firstSymbol(m));
    m.addLayer({id:'tw-town-line',type:'line',source:'tw-town',paint:{'line-color':'#a2613a','line-width':['case',['get','sel'],2.8,.9],'line-opacity':.85}});
    m.addSource('tw-town-pt',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    m.addLayer({id:'tw-town-lbl',type:'symbol',source:'tw-town-pt',layout:{'text-field':['get','t'],'text-size':12,'text-font':['Noto Sans Regular'],'text-allow-overlap':false},paint:{'text-color':'#5a4632','text-halo-color':'#f6efe2','text-halo-width':1.5}},undefined);
    m.on('click',e=>{
      const tf=m.queryRenderedFeatures(e.point,{layers:['tw-town-fill']});
      if(tf.length){const t=tf[0].properties.t;$('#arTown').value=t;this.pick(this.sel.county,t,false);return}
      const cf=m.queryRenderedFeatures(e.point,{layers:['tw-cty-fill']});
      if(cf.length){const c=cf[0].properties.c;$('#arCounty').value=c;this.fillTowns();const C=TW.counties[c];this.pick(c,C.seat?C.seat.name:C.towns[0].name,true)}});
    this.zoomTo(this.sel.county,this.sel.town,true);this.view(true);this.load();
    setInterval(()=>this.watchTick(),60e3);
  },
  view(first){const on=!!CFG.area3d;$('#arView').innerHTML=on?'🗺<small>2D</small>':'🧊<small>3D</small>';if(!this.map)return;GL.set3D(this.map,on,{pitch:58,bearing:-20});if(!first&&this.sel)setTimeout(()=>this.zoomTo(this.sel.county,this.sel.town,false,true),950)},
  syncSel(){$('#arCounty').value=this.sel.county;this.fillTowns();$('#arTown').value=this.sel.town},
  fillTowns(){const c=TW.counties[$('#arCounty').value];$('#arTown').innerHTML=c.towns.map(t=>`<option>${t.name}</option>`).join('')},
  pick(c,t,zoom){const tw=TW.town(c,t);if(!tw)return;$('#arTown').value=t;const chg=c!==this.sel.county;this.sel={county:c,town:t,lat:tw.lat,lon:tw.lon,src:'region'};this.zoomTo(c,t,!zoom&&!chg,!zoom&&!chg);this.update()},
  zoomTo(c,t,noFit,keepCam){
    const m=this.map;if(!m)return;const C=TW.counties[c];if(!C)return;
    m.getSource('tw-town').setData({type:'FeatureCollection',features:C.towns.map(x=>({type:'Feature',properties:{t:x.name,sel:x.name===t},geometry:x.geom}))});
    m.getSource('tw-town-pt').setData({type:'FeatureCollection',features:C.towns.map(x=>({type:'Feature',properties:{t:x.name},geometry:{type:'Point',coordinates:[x.lon,x.lat]}}))});
    if(!noFit||!keepCam){const b=C.bbox;m.fitBounds([[b[0],b[1]],[b[2],b[3]]],{padding:{top:120,left:20,right:20,bottom:Math.min(innerHeight*.42+100,420)},pitch:CFG.area3d?58:0,bearing:CFG.area3d?-20:0,duration:noFit?0:800,maxZoom:12})}
    if(this.pin)this.pin.remove();const tw=TW.town(c,t);if(tw)this.pin=glMarker(m,tw.lat,tw.lon,'<div class="meDot" style="background:#a2613a"></div>');
  },
  async load(){
    this.stop();const m=this.map;if(!m)return;WX3.clear(m);
    $('#arTl').textContent='載入中…';
    try{
      if(this.mode==='radar'){const frames=await RADAR.load();this.frames=frames;const tr=RADAR.track(this.sel.lat,this.sel.lon);
        const draw=f=>{WX3.image(m,stylizeRain(RADAR.toCanvas(f)),[[f.B.s,f.B.w],[f.B.n,f.B.e]],true);WX3.fromFrame(m,f)};
        const st=frames.map(f=>({label:fmtHM(f.time),sub:(f.src==='rv'?'RainViewer':'氣象署')+' 觀測',draw:()=>draw(f)}));const ni=st.length-1;
        if(tr.moving){const last=frames[frames.length-1];for(let k=10;k<=60;k+=10){const ff=RADAR.extrapolate(last,tr.v,k);st.push({label:fmtHM(ff.time),sub:'外推 +'+k+' 分',draw:()=>draw(ff)})}}
        this.setSteps(st,ni)}
      else if(this.mode==='cloud'){const G=MapLayer.grid||(MapLayer.grid=await OM.grid('wx'));const st=G.times.slice(0,25).map((t,i)=>({label:fmtDay(t)+' '+fmtHM(t),sub:'雲量預報',draw:()=>{const f=cloudShadow(G,G.v.cloud_cover[i]);WX3.image(m,f.cv,f.bounds,false);WX3.fromGrid(m,G,i,'cloud')}}));
        let ni=0;G.times.forEach((t,i)=>{if(t<=Date.now()&&i<25)ni=i});this.setSteps(st,ni)}
      else{await QPF.load();const q=QPF.canvas();this.setSteps([{label:'未來 1 小時',sub:'氣象署 '+(QPF.data.issued?fmtHM(QPF.data.issued)+' 發布':''),draw:()=>{WX3.clear(m);WX3.image(m,stylizeRain(q.cv),q.bounds,false)}}],0)}
    }catch(e){$('#arTl').textContent='⚠️ '+e.message}
    this.update();
  },
  setSteps(st,ni){this.steps=st;$('#arRange').max=st.length-1;this.show(ni)},
  show(i){const s=this.steps[i];if(!s)return;this.ti=i;$('#arRange').value=i;$('#arTl').textContent=s.label;$('#arTlSub').textContent=s.sub;s.draw()},
  play(){if(this.playing)return this.stop();this.playing=true;$('#arPlay').textContent='⏸';const tk=()=>{if(!this.playing)return;this.show((this.ti+1)%this.steps.length);this._t=setTimeout(tk,750)};tk()},
  stop(){this.playing=false;clearTimeout(this._t);$('#arPlay').textContent='▶'},
  async update(){
    const s=this.sel;if(!s)return;const frames=RADAR.frames;
    let html='';
    const r=RADAR.best?RADAR.track(s.lat,s.lon):null;this.last=r;
    let qpf=null;try{if(QPF.data||this.mode==='qpf'){await QPF.load();qpf=QPF.maxNear(s.lat,s.lon,2)}}catch(e){}
    html+=`<div class="nowcast ${r&&r.ok&&(r.nowLv>=2||r.eta!=null&&r.eta<=30)?'alert':'dry'}"><span class="arPl">${esc(s.town)}</span>${nowcastHTML(r,qpf)}</div>`;
    $('#arStatus').innerHTML=html;
    // 圖表：0~90 分鐘雷達外推
    if(r&&r.ok&&r.series.some(p=>p.lv)){const W=320,Hh=58,bw=W/r.series.length;
      const bars=r.series.map((p,i)=>{const hgt=p.lv?6+p.lv*6:2;const c=p.lv?RADAR.PAL[p.lv]:[150,140,120,90];return `<rect x="${i*bw+1}" y="${Hh-14-hgt}" width="${bw-2}" height="${hgt}" rx="2.5" fill="rgba(${c[0]},${c[1]},${c[2]},${p.lv?.9:.3})"/>`+(i%3===0?`<text x="${i*bw+bw/2}" y="${Hh-2}" font-size="9" text-anchor="middle" fill="currentColor" opacity=".6">${p.tau===0?'現在':'+'+p.tau}</text>`:'')}).join('');
      $('#arChart').innerHTML=`<div class="sub">未來 90 分鐘降雨強度（分鐘）</div><svg viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" style="color:var(--ink)">${bars}</svg>`}
    else if(r&&r.ok)$('#arChart').innerHTML='<div class="sub arNone">☁️ 未來 90 分鐘本區沒有降雨回波經過</div>';
    else $('#arChart').innerHTML='';
  },
  renderWatch(){
    const R=CFG.notif.rain;const st=isApp?NAT.json('rainStatus'):null;
    $('#arWatch').innerHTML=`<div class="lab arWl"><span>🔔 即時降雨提醒${R.on?`<span class="sub">　提前 ${R.lead} 分</span>`:''}</span><span class="grow"></span><button class="btn sm" id="rw_more">${this.watchOpen?'收起 ▴':'設定 ▾'}</button><label class="sw"><input type="checkbox" id="rw_on" ${R.on?'checked':''}><span></span></label></div><div class="${this.watchOpen?'':'hide'}">
      <div class="row"><span class="sub">監測</span><div class="seg" id="rw_tg"><button class="btn ${R.target==='gps'?'on':''}" data-v="gps">📍 我的位置</button><button class="btn ${R.target==='region'?'on':''}" data-v="region">🗺 這個區域</button></div></div>
      <div class="row"><span class="sub">提前</span><div class="seg" id="rw_ld">${[5,10,15,30].map(v=>`<button class="btn ${R.lead==v?'on':''}" data-v="${v}">${v} 分</button>`).join('')}</div>
      <span class="sub">每</span><div class="seg" id="rw_iv">${[5,10,15].map(v=>`<button class="btn ${R.interval==v?'on':''}" data-v="${v}">${v} 分</button>`).join('')}</div><span class="sub">檢查</span></div>
      <div class="lab"><span class="sub">雨停時也通知</span><label class="sw"><input type="checkbox" id="rw_stop" ${R.stop?'checked':''}><span></span></label></div>
      <div class="lab"><span class="sub">行動網路下降低雷達下載頻率（省流量）</span><label class="sw"><input type="checkbox" id="rw_wifi" ${R.wifiOnly?'checked':''}><span></span></label></div>
      ${R.target==='region'?`<div class="sub">目前監測：${esc(R.county||this.sel.county)} ${esc(R.town||this.sel.town)}</div>`:''}
      ${st?`<div class="sub">背景監測：${st.running?'🟢 執行中':'⚪ 未啟動'}${st.last?'・上次檢查 '+fmtHM(new Date(st.last))+'・'+esc(st.msg||''):''}</div>`:''}
      ${!isApp?'<div class="sub">瀏覽器版只在此頁開著時檢查；安裝 APK 後可在背景常駐監測。</div>':''}</div>`;
    $('#rw_more').onclick=()=>{this.watchOpen=!this.watchOpen;this.renderWatch()};
    const save=()=>{saveCfg();Alerts.applyNative();this.renderWatch();Alerts.render&&$('#v-alert').classList.contains('on')&&Alerts.render()};
    $('#rw_on').onchange=async e=>{R.on=e.target.checked;if(R.on){await Alerts.ensurePerm();if(isApp){const p=NAT.json('perms')||{};if(!p.battery)toast('建議到設定允許「不受電池最佳化限制」，背景提醒較準時',3500)}}save()};
    $('#rw_stop').onchange=e=>{R.stop=e.target.checked;save()};$('#rw_wifi').onchange=e=>{R.wifiOnly=e.target.checked;save()};
    const seg=(id,fn)=>$('#'+id).onclick=e=>{const b=e.target.closest('[data-v]');if(!b)return;fn(b.dataset.v);save()};
    seg('rw_tg',v=>{R.target=v;if(v==='region'){R.county=this.sel.county;R.town=this.sel.town;R.lat=this.sel.lat;R.lon=this.sel.lon}});
    seg('rw_ld',v=>R.lead=+v);seg('rw_iv',v=>R.interval=+v);
  },
  /* 瀏覽器版：頁面開著時的即時檢查 */
  async watchTick(){
    const R=CFG.notif.rain;if(isApp||!R.on)return;const now=Date.now();if(now-(this._wt||0)<R.interval*60e3-5e3)return;this._wt=now;
    let lat,lon,name;if(R.target==='region'&&R.lat){lat=R.lat;lon=R.lon;name=R.town}else{const l=await Loc.locate(false);lat=l.lat;lon=l.lon;name=l.town}
    try{const fr=await RADAR.load(true);const r=RADAR.track(lat,lon,fr);const st=lsGet('wx.rainst',{});
      if(r.ok&&r.eta!=null&&r.eta<=R.lead&&now-(st.alertAt||0)>45*60e3){Alerts.send(`☔ 約 ${r.eta} 分鐘後下雨｜${name}`,`雷達回波${r.moving?'由'+dirText(r.dirFrom)+'方移入，速度約 '+Math.round(r.spd)+' km/h':'接近'}，預估${LV_TEXT[r.etaLv]}。出門記得帶雨具！`,'rain');st.alertAt=now}
      if(r.ok&&R.stop&&st.raining&&r.nowLv<2){Alerts.send(`🌤 雨停了｜${name}`,'雷達顯示降雨回波已離開。','rain');}
      st.raining=r.ok&&r.nowLv>=2;lsSet('wx.rainst',st);if($('#v-area').classList.contains('on'))this.update()}catch(e){}
  }
};
