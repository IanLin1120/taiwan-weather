/* 數值格點 → Mercator 對齊畫布 */
function fieldCanvas(G,arr,colorFn,land=false,W=260,H=380){
  const s=G.lats[0]-0.15,n=G.lats[G.ny-1]+0.15,w=G.lons[0]-0.15,e=G.lons[G.nx-1]+0.15;
  const my=l=>Math.log(Math.tan(Math.PI/4+l*Math.PI/360));const yN=my(n),yS=my(s);
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;const x=cv.getContext('2d');const im=x.createImageData(W,H);const d=im.data;
  for(let r=0;r<H;r++){const lat=Math.atan(Math.sinh(yN-(yN-yS)*(r+.5)/H))*180/Math.PI;
    for(let c=0;c<W;c++){const lon=w+(e-w)*(c+.5)/W;let v=gridSample(G,arr,clamp(lat,G.lats[0],G.lats[G.ny-1]),clamp(lon,G.lons[0],G.lons[G.nx-1]));if(isNaN(v))continue;
      const col=colorFn(v);if(!col)continue;
      const edge=land?1:Math.pow(Math.min(c,W-1-c,r,H-1-r)/48,1.4);const k=(r*W+c)*4;d[k]=col[0];d[k+1]=col[1];d[k+2]=col[2];d[k+3]=col[3]*Math.min(1,edge)}}
  x.putImageData(im,0,0);
  if(land){x.globalCompositeOperation='destination-in';x.fillStyle='#000';x.beginPath();
    const P=(lon,lat)=>[(lon-w)/(e-w)*W,(yN-my(lat))/(yN-yS)*H];
    for(const c of TW.countyNames){const g=TW.counties[c].geom;const polys=g.type==='Polygon'?[g.coordinates]:g.coordinates;
      for(const poly of polys)for(const ring of poly){ring.forEach((pt,i)=>{const q=P(pt[0],pt[1]);i?x.lineTo(q[0],q[1]):x.moveTo(q[0],q[1])});x.closePath()}}
    x.fill('evenodd');x.globalCompositeOperation='source-over'}
  return {cv,bounds:[[s,w],[n,e]]};
}
const ramp=(stops)=>v=>{if(v<stops[0][0])return null;for(let i=stops.length-1;i>=0;i--)if(v>=stops[i][0]){const a=stops[i],b=stops[i+1];if(!b)return a[1];const t=(v-a[0])/(b[0]-a[0]);return a[1].map((x,j)=>x+(b[1][j]-x)*t)}return null};

/* ================= ① 天氣圖層頁 ================= */
const LAYERS={
  radar:{n:'雷達',i:'📡'},rain:{n:'雨量',i:'🌧'},wind:{n:'風',i:'🌬'},pm25:{n:'PM2.5',i:'😷'},thunder:{n:'打雷',i:'⚡'},typhoon:{n:'颱風',i:'🌀'},temp:{n:'氣溫',i:'🌡'},cloud:{n:'雲量',i:'☁️'}
};
const COL={
  rain:ramp([[0.1,[170,210,230,90]],[1,[110,175,220,170]],[3,[60,140,205,200]],[8,[70,170,110,215]],[15,[220,190,60,225]],[30,[230,120,45,235]],[50,[195,50,45,240]],[80,[140,55,165,245]]]),
  wind:ramp([[0,[230,220,200,0]],[3,[200,190,150,60]],[6,[214,170,90,110]],[10,[210,120,60,150]],[14,[180,60,50,175]],[20,[130,40,110,190]]]),
  pm25:ramp([[0,[111,157,76,110]],[15.5,[212,177,60,140]],[35.5,[224,137,58,170]],[54.5,[196,71,47,190]],[150,[142,59,143,210]]]),
  thunder:ramp([[0.15,[240,220,150,60]],[0.35,[240,190,70,130]],[0.6,[220,110,60,170]],[0.85,[160,60,150,200]]]),
  temp:ramp([[0,[90,110,170,150]],[10,[110,160,190,150]],[18,[150,190,150,140]],[24,[225,200,110,140]],[29,[225,140,70,150]],[33,[195,70,50,160]],[37,[140,40,60,170]]]),
  cloud:ramp([[10,[250,248,240,0]],[40,[240,236,226,90]],[70,[215,210,200,150]],[95,[180,176,170,190]]])
};
const LEGEND={
  radar:['雷達回波',[['弱回波',RADAR.PAL[1]],['小雨',RADAR.PAL[2]],['中雨',RADAR.PAL[3]],['大雨',RADAR.PAL[4]],['豪雨',RADAR.PAL[5]],['劇烈',RADAR.PAL[6]]]],
  rain:['時雨量 mm/h',[['0.1',[170,210,230]],['1',[110,175,220]],['3',[60,140,205]],['8',[70,170,110]],['15',[220,190,60]],['30',[230,120,45]],['50+',[195,50,45]]]],
  wind:['風速 m/s',[['3（2級）',[200,190,150]],['6（4級）',[214,170,90]],['10（6級）',[210,120,60]],['14（7級）',[180,60,50]],['20+（8級）',[130,40,110]]]],
  pm25:['PM2.5 μg/m³',[['≤15 良好',[111,157,76]],['≤35 普通',[212,177,60]],['≤54 敏感',[224,137,58]],['≤150 不健康',[196,71,47]],['>150',[142,59,143]]]],
  thunder:['雷雨潛勢',[['低',[240,220,150]],['中',[240,190,70]],['高',[220,110,60]],['很高',[160,60,150]]]],
  typhoon:['颱風（官方）',[['輕度颱風',[79,154,90]],['中度颱風',[224,138,44]],['強烈颱風',[210,58,55]],['潛勢範圍',[243,192,74]],['暴風圈',[224,90,58]]]],
  temp:['氣溫 °C',[['≤10',[110,160,190]],['18',[150,190,150]],['24',[225,200,110]],['29',[225,140,70]],['33+',[195,70,50]]]],
  cloud:['雲量 %',[['少雲',[236,232,224]],['多雲',[214,212,208]],['陰天',[176,174,172]]]]
};
const MapLayer={
  map:null,layer:'radar',grid:null,aq:null,mk:[],ti:0,steps:[],playing:false,
  async init(){
    $('#lyChips').innerHTML=Object.entries(LAYERS).map(([k,v])=>`<button class="btn ${k===this.layer?'on':''}" data-l="${k}">${v.i} ${v.n}</button>`).join('');
    $('#lyChips').onclick=e=>{const b=e.target.closest('[data-l]');if(!b)return;$$('#lyChips .btn').forEach(x=>x.classList.toggle('on',x===b));this.setLayer(b.dataset.l)};
    $('#tlRange').oninput=e=>{if(this.playing)this.stop();this.show(+e.target.value)};
    $('#tlPlay').onclick=()=>this.play();
    $('#tlNow').onclick=()=>{this.stop();this.show(this.nowIdx||0)};
    $('#tlSub').textContent='地圖載入中…';
    try{this.map=await GL.make('lyMap')}catch(e){$('#tlSub').textContent='⚠️ 這支手機無法顯示向量地圖（WebGL）';return}
    const m=this.map;
    $('#lyLoc').onclick=async()=>{const l=await Loc.locate(true);m.flyTo({center:[l.lon,l.lat],zoom:Math.max(m.getZoom(),9.5),duration:900});this.me(l)};
    $('#lyReload').onclick=()=>{NET.clearCache();RADAR.loadedAt=0;this.grid=this.aq=null;this.setLayer(this.layer)};
    $('#lyView').onclick=()=>{CFG.map3d=!CFG.map3d;saveCfg();this.view()};
    m.on('click',e=>this.probe({lat:e.lngLat.lat,lng:e.lngLat.lng}));
    Wind.init(m);this.me(Loc.get());
    this.view(true);
    this.setLayer(this.layer);
  },
  goTyphoon(){this.layer='typhoon';App.show('v-map');if(this.map){$$('#lyChips .btn').forEach(x=>x.classList.toggle('on',x.dataset.l==='typhoon'));this.setLayer('typhoon')}},
  view(first){const on=!!CFG.map3d;const b=$('#lyView');b.innerHTML=on?'🗺<small>2D</small>':'🧊<small>3D</small>';
    GL.set3D(this.map,on,on?{pitch:60,bearing:-15}:{});if(!first)this.legend(this.layer);if(on&&first)this.map.easeTo({zoom:6.9,center:[120.9,23.5],pitch:60,bearing:-15,duration:0})},
  me(l){if(this._me)this._me.remove();if(this.map)this._me=glMarker(this.map,l.lat,l.lon,'<div class="meDot"></div>')},
  async onTheme(){if(this.map)await GL.retheme(this.map);if(Area.map)await GL.retheme(Area.map)},
  legend(k){const L0=LEGEND[k];$('#lyLegend').innerHTML=`<b>${L0[0]}</b>`+L0[1].map(x=>`<div class="lg"><i style="background:rgb(${x[1].slice(0,3).join(',')})"></i>${x[0]}</div>`).join('')+(this.legendNote||'')+(['radar','rain','cloud','thunder','typhoon'].includes(k)?`<div class="sub" style="margin-top:4px">${CFG.map3d?'🧊 立體：雲層浮在空中、雨幕落到地面':'按 🧊 看立體雲雨'}</div>`:'')},
  async setLayer(k){
    if(!this.map)return;
    this.stop();this.layer=k;this.legendNote='';this.legend(k);$('#lyInfo').classList.add('hide');
    this.clear();Wind.stop();$('#tlSub').textContent='載入中…';
    try{
      if(k==='radar')await this.prepRadar();
      else if(k==='typhoon')await this.prepTyphoon();
      else if(k==='pm25'){this.aq=this.aq||await OM.grid('aq');this.prepGrid(this.aq);this.extraPM()}
      else{this.grid=this.grid||await OM.grid('wx');this.prepGrid(this.grid);if(k==='rain')this.extraRain();if(k==='thunder')this.extraThunder()}
    }catch(e){$('#tlSub').textContent='⚠️ '+e.message;console.error(e)}
    this.legend(k);
  },
  clear(){const m=this.map;WX3.clear(m);WX3.noImage(m);this.mk.forEach(x=>x.remove());this.mk=[];this.mkHour=null;if(this._eye){this._eye.remove();this._eye=null}TYV.clear(m);const tb=$('#tyRow');if(tb&&this.layer!=='typhoon')tb.style.display='none';if(this.layer!=='typhoon')document.body.classList.remove('tyOn')},
  setSteps(steps,nowIdx){this.steps=steps;this.nowIdx=nowIdx;const r=$('#tlRange');r.max=steps.length-1;r.value=nowIdx;
    const n=steps.length,ticks=[0,Math.round((n-1)/4),Math.round((n-1)/2),Math.round((n-1)*3/4),n-1];
    $('#tlTicks').innerHTML=ticks.map(i=>`<span>${steps[i]?steps[i].short:''}</span>`).join('');
    this.show(nowIdx)},
  show(i){
    this.ti=i;const s=this.steps[i];if(!s)return;$('#tlRange').value=i;
    $('#tlLabel').textContent=s.label;$('#tlSub').textContent=s.sub||'';
    s.draw();
    if(this.mkHour!=null)this.mk.forEach(x=>{x.getElement().style.display=i<=1?'':'none'});
    if(this.lastProbe)this.probe(this.lastProbe,true);
  },
  timeLabel(t){const d=new Date(t);return `${fmtDay(d)} ${fmtHM(d)}`},
  prepGrid(G){
    const steps=G.times.map((t,i)=>({t,label:this.timeLabel(t),short:i===0?'現在':(t.getHours()===0?fmtMD(t):pad(t.getHours())+'時'),sub:i===0?'目前':'+'+i+' 小時',draw:()=>this.drawGrid(G,i)}));
    let ni=0;const now=Date.now();G.times.forEach((t,i)=>{if(t<=now)ni=i});
    this.setSteps(steps,ni);
  },
  field(G,i){const k=this.layer,V=G.v;
    if(k==='rain')return V.precipitation[i];if(k==='wind')return V.wind_speed_10m[i];if(k==='temp')return V.temperature_2m[i];if(k==='cloud')return V.cloud_cover[i];if(k==='pm25')return V.pm2_5[i];
    if(k==='thunder'){const a=new Float32Array(G.nx*G.ny);for(let j=0;j<a.length;j++){const code=V.weather_code[i][j],cape=V.cape[i][j]||0,pop=(V.precipitation_probability[i][j]||0)/100;a[j]=Math.max(code>=95?.75+.25*pop:0,Math.min(1,cape/3000)*Math.max(.3,pop))}return a}
  },
  drawGrid(G,i){const k=this.layer,m=this.map;const f=this.field(G,i);
    if(k==='cloud'){const sh=cloudShadow(G,f);WX3.image(m,sh.cv,sh.bounds,false)}
    else{let {cv,bounds}=fieldCanvas(G,f,COL[k],k==='temp'||k==='pm25',k==='rain'?420:260,k==='rain'?600:380);if(k==='rain')cv=stylizeRain(cv);WX3.image(m,cv,bounds,k==='rain'||k==='thunder')}
    if(['rain','cloud','thunder'].includes(k))WX3.fromGrid(m,G,i,k,k==='thunder'&&i<=1&&this.strikes?this.strikes.slice(0,40).map(s=>({lat:s.lat,lon:s.lon,top:4200,seed:s.lat*7+s.lon})):null);
    if(k==='wind')Wind.set(G,i);
  },
  addMk(lat,lon,html,popup){const x=glMarker(this.map,lat,lon,html,'stmk',popup);this.mk.push(x);return x},
  async extraRain(){if(!CWA.has()){this.legendNote='<div class="sub" style="margin-top:4px">填 CWA 授權碼可疊雨量站</div>';this.legend('rain');return}
    try{const st=await CWA.rainGauges();this.mkHour=0;
      st.filter(s=>(s.h1||0)>=0.5).forEach(s=>{const c=rainColor(s.h1);this.addMk(s.lat,s.lon,`<div style="background:rgb(${c.slice(0,3)})">${s.h1.toFixed(1)}</div>`,`<b>${esc(s.name)}</b>（${esc(s.county||'')}${esc(s.town||'')}）<br>10 分鐘：${s.m10??'—'} mm<br>1 小時：${s.h1} mm<br>3 小時：${s.h3??'—'} mm<br>今日：${s.now??'—'} mm`)});
      this.legendNote=`<div class="sub" style="margin-top:4px">數字＝雨量站近 1 小時 mm（氣象署）</div>`;this.legend('rain');this.show(this.ti)}catch(e){}},
  async extraPM(){if(!CFG.moenvKey){this.legendNote='<div class="sub" style="margin-top:4px">填環境部 api_key 可疊測站</div>';this.legend('pm25');return}
    try{const st=await MOENV.sites();this.mkHour=0;st.filter(s=>s.pm25!=null).forEach(s=>{const c=pm25Level(s.pm25)[1];this.addMk(s.lat,s.lon,`<div style="background:${c}">${Math.round(s.pm25)}</div>`,`<b>${esc(s.name)}</b>（${esc(s.county)}）<br>PM2.5：${s.pm25} μg/m³<br>AQI：${s.aqi??'—'} ${esc(s.status||'')}<br><span class="sub">${esc(s.time||'')}</span>`)});
      this.legendNote='<div class="sub" style="margin-top:4px">數字＝環境部測站即時 PM2.5</div>';this.legend('pm25');this.show(this.ti)}catch(e){}},
  async extraThunder(){this.strikes=null;if(!CWA.has()){this.legendNote='<div class="sub" style="margin-top:4px">填 CWA 授權碼可疊即時閃電</div>';this.legend('thunder');return}
    try{const ls=await CWA.lightning();this.strikes=ls;this.mkHour=0;ls.forEach(s=>this.addMk(s.lat,s.lon,`<span class="bolt">${s.cg?'⚡':'✦'}</span>`,`${s.cg?'雲對地閃電':'雲間閃電'}<br>${s.time?fmtHM(s.time):''}`));
      this.legendNote=`<div class="sub" style="margin-top:4px">⚡ 過去 1 小時閃電 ${ls.length} 筆（氣象署）</div>`;this.legend('thunder');this.show(this.ti)}catch(e){this.legendNote='<div class="sub">閃電資料：'+esc(e.message)+'</div>';this.legend('thunder')}},
  async prepRadar(){
    const frames=await RADAR.load();if(!frames.length)throw new Error('雷達資料無法取得');
    const last=frames[frames.length-1];const l=Loc.get();const tr=RADAR.track(l.lat,l.lon);
    const steps=frames.map(f=>({label:this.timeLabel(f.time),short:fmtHM(f.time),sub:(f.src==='rv'?'RainViewer':'氣象署')+' 觀測',draw:()=>this.drawRadar(f)}));
    const nowIdx=steps.length-1;
    if(tr.moving){for(const mm of [10,20,30,40,50,60]){const ff=RADAR.extrapolate(last,tr.v,mm);steps.push({label:this.timeLabel(ff.time),short:'+'+mm+'分',sub:'回波外推預估',draw:()=>this.drawRadar(ff)})}}
    try{await QPF.load();const q=QPF.canvas();if(q)steps.push({label:'未來 1 小時累積雨量',short:'+1h',sub:'氣象署 F-B0046-001'+(QPF.data.issued?' '+fmtHM(QPF.data.issued)+' 發布':''),draw:()=>{WX3.clear(this.map);WX3.image(this.map,stylizeRain(q.cv),q.bounds,false);this.legendNote='<div class="sub">此格為 mm／1 小時</div>';this.legend('rain')}})}catch(e){}
    this.setSteps(steps,nowIdx);
  },
  drawRadar(f){const cv=stylizeRain(RADAR.toCanvas(f));WX3.image(this.map,cv,[[f.B.s,f.B.w],[f.B.n,f.B.e]],true);WX3.fromFrame(this.map,f);if(this.legendNote){this.legendNote='';this.legend('radar')}},
  async prepTyphoon(){return TYV.prep(this)},
  probe(ll,silent){
    this.lastProbe=ll;const k=this.layer,s=this.steps[this.ti];let html='';
    if(k==='radar'){if(RADAR.best){const t=RADAR.track(ll.lat,ll.lng);html=nowcastHTML(t,QPF.data?QPF.maxNear(ll.lat,ll.lng,2):null)}}
    else if(k==='typhoon'){return}
    else{const G=k==='pm25'?this.aq:this.grid;if(!G)return;const i=Math.min(this.ti,G.times.length-1);const v=(name)=>gridSample(G,G.v[name][i],ll.lat,ll.lng);
      if(k==='pm25'){const p=v('pm2_5');if(isNaN(p))return;html=`😷 PM2.5 約 <b>${Math.round(p)}</b> μg/m³（${pm25Level(p)[0]}）`}
      else{const r=v('precipitation'),w=v('wind_speed_10m'),t=v('temperature_2m'),p=v('precipitation_probability'),c=v('cloud_cover'),cape=v('cape');if(isNaN(t))return;
        html=`🌡 ${t.toFixed(1)}°C　☔ ${Math.round(p)}%<br>🌧 ${r.toFixed(1)} mm/h　☁️ ${Math.round(c)}%<br>🌬 ${w.toFixed(1)} m/s（${beaufort(w)} 級）`+(k==='thunder'?`<br>⚡ CAPE ${Math.round(cape)} J/kg`:'')}}
    if(!html)return;const tw=TW.locate(ll.lat,ll.lng);
    $('#lyInfo').innerHTML=`<b>${tw?tw.county+' '+tw.name:ll.lat.toFixed(2)+', '+ll.lng.toFixed(2)}</b><div class="sub">${s?s.label:''}</div><div style="margin-top:4px">${html}</div><div class="acts"><button class="btn sm" onclick="$('#lyInfo').classList.add('hide');MapLayer.lastProbe=null">關閉</button></div>`;
    $('#lyInfo').classList.remove('hide');
  },
  play(){if(this.playing)return this.stop();this.playing=true;$('#tlPlay').textContent='⏸';
    if(this.layer==='typhoon'&&TYV.sel){TYV.play();return}
    const tick=()=>{if(!this.playing)return;let i=this.ti+1;if(i>=this.steps.length)i=0;this.show(i);this._pt=setTimeout(tick,this.layer==='radar'?750:this.layer==='typhoon'?170:1000)};tick()},
  stop(){this.playing=false;clearTimeout(this._pt);TYV.halt();$('#tlPlay').textContent='▶'}
};

/* ================= 風場粒子動畫（經緯度粒子，2D／3D 都會跟著透視） ================= */
const Wind={
  map:null,cv:null,ctx:null,G:null,i:0,parts:[],run:false,
  init(map){this.map=map;this.cv=$('#windCv');this.ctx=this.cv.getContext('2d');
    map.on('movestart',()=>this.clear());map.on('resize',()=>this.size());window.addEventListener('resize',()=>this.size())},
  size(){const r=this.map.getContainer().getBoundingClientRect();const d=window.devicePixelRatio||1;this.cv.width=r.width*d;this.cv.height=r.height*d;this.cv.style.width=r.width+'px';this.cv.style.height=r.height+'px';this.ctx.setTransform(d,0,0,d,0,0);this.W=r.width;this.H=r.height},
  clear(){this.ctx&&this.ctx.clearRect(0,0,this.W||9999,this.H||9999)},
  set(G,i){this.G=G;this.i=i;if(!this.run){this.size();this.parts=[];this.run=true;this.loop()}},
  stop(){this.run=false;this.clear()},
  uv(lat,lon){const G=this.G;const s=gridSample(G,G.v.wind_speed_10m[this.i],lat,lon),d=gridSample(G,G.v.wind_direction_10m[this.i],lat,lon);if(isNaN(s))return null;const r=d*Math.PI/180;return [-s*Math.sin(r),-s*Math.cos(r),s]},
  spawn(){const b=this.map.getBounds(),G=this.G;const w=Math.max(b.getWest(),G.lons[0]),e=Math.min(b.getEast(),G.lons[G.nx-1]),s=Math.max(b.getSouth(),G.lats[0]),n=Math.min(b.getNorth(),G.lats[G.ny-1]);
    return {lon:w+Math.random()*(e-w),lat:s+Math.random()*(n-s),a:Math.random()*70|0}},
  loop(){if(!this.run||MapLayer.layer!=='wind'||!$('#v-map').classList.contains('on')){this.run=false;this.clear();return}
    const c=this.ctx,m=this.map;c.globalCompositeOperation='destination-in';c.fillStyle='rgba(0,0,0,.9)';c.fillRect(0,0,this.W,this.H);c.globalCompositeOperation='source-over';
    while(this.parts.length<1000)this.parts.push(this.spawn());
    const z=m.getZoom(),k=0.0016/Math.pow(2,Math.max(0,z-6.5));const dark=document.documentElement.dataset.theme==='dark';c.lineWidth=1.3;
    for(const p of this.parts){const w=this.uv(p.lat,p.lon);p.a++;
      if(!w||p.a>80){Object.assign(p,this.spawn(),{a:0});continue}
      const a=m.project([p.lon,p.lat]);p.lon+=w[0]*k/Math.cos(p.lat*Math.PI/180);p.lat+=w[1]*k;const b=m.project([p.lon,p.lat]);
      const sp=w[2];c.strokeStyle=sp>10?(dark?'rgba(255,170,130,.9)':'rgba(150,50,30,.85)'):sp>6?(dark?'rgba(250,215,160,.85)':'rgba(160,90,40,.8)'):(dark?'rgba(240,230,210,.7)':'rgba(90,70,50,.65)');
      if(a.y<0||a.y>this.H)continue;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke()}
    requestAnimationFrame(()=>this.loop())}
};
