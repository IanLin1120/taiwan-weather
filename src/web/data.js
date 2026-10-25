/* ================= 天氣代碼 ================= */
const WMO={0:['晴','☀️','🌙'],1:['晴時多雲','🌤','🌙'],2:['多雲','⛅','☁️'],3:['陰','☁️','☁️'],45:['霧','🌫'],48:['霧凇','🌫'],51:['毛毛雨','🌦'],53:['毛毛雨','🌦'],55:['較強毛毛雨','🌧'],56:['凍毛雨','🌧'],57:['凍毛雨','🌧'],61:['小雨','🌧'],63:['中雨','🌧'],65:['大雨','🌧'],66:['凍雨','🌧'],67:['凍雨','🌧'],71:['小雪','🌨'],73:['雪','🌨'],75:['大雪','❄️'],77:['冰霰','🌨'],80:['短暫陣雨','🌦'],81:['陣雨','🌧'],82:['豪大陣雨','⛈'],85:['陣雪','🌨'],86:['大陣雪','❄️'],95:['雷陣雨','⛈'],96:['雷雨夾冰雹','⛈'],99:['強雷雨夾冰雹','⛈']};
const wmoText=c=>(WMO[c]||['—'])[0];
const wmoIcon=(c,day=1)=>{const w=WMO[c];if(!w)return '🌡';return (!day&&w[2])?w[2]:w[1]};
function wxIcon(text,day=1){if(!text)return '🌡';if(/雷/.test(text))return '⛈';if(/雪/.test(text))return '🌨';if(/霧/.test(text))return '🌫';
  if(/雨/.test(text))return /短暫|陣|局部/.test(text)?'🌦':'🌧';if(/陰/.test(text))return '☁️';if(/多雲/.test(text))return /晴/.test(text)?(day?'🌤':'🌙'):'⛅';if(/晴/.test(text))return day?'☀️':'🌙';return '⛅'}
const BF=[0.3,1.6,3.4,5.5,8.0,10.8,13.9,17.2,20.8,24.5,28.5,32.7];
const beaufort=ms=>{if(ms==null)return null;let i=0;while(i<BF.length&&ms>BF[i])i++;return i};
const DIR16=['北','北北東','東北','東北東','東','東南東','東南','南南東','南','南南西','西南','西南西','西','西北西','西北','北北西'];
const dirText=d=>d==null?'—':DIR16[Math.round(((d%360)+360)%360/22.5)%16];
const pm25Level=v=>v==null?null:v<=15.4?['良好','#6f9d4c']:v<=35.4?['普通','#d4b13c']:v<=54.4?['對敏感族群不健康','#e0893a']:v<=150.4?['對所有族群不健康','#c4472f']:['非常不健康','#8e3b8f'];
const uvLevel=v=>v==null?null:v<3?['低量級','#6f9d4c']:v<6?['中量級','#d4b13c']:v<8?['高量級','#e0893a']:v<11?['過量級','#c4472f']:['危險級','#8e3b8f'];

/* 小寫化 JSON 鍵值（相容 CWA 新舊格式） */
function lcKeys(o){if(Array.isArray(o))return o.map(lcKeys);if(o&&typeof o==='object'){const r={};for(const k in o)r[k.toLowerCase()]=lcKeys(o[k]);return r}return o}
const tzDate=s=>s?new Date(String(s).replace(' ','T').replace(/(\d{2}:\d{2}:\d{2})$/,'$1+08:00')):null;

/* ================= Open-Meteo（免金鑰，CC BY 4.0） ================= */
const OM={
  base:'https://api.open-meteo.com/v1/forecast',
  aqBase:'https://air-quality-api.open-meteo.com/v1/air-quality',
  async point(lat,lon,elev){
    const u=`${this.base}?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}${elev?'&elevation='+Math.round(elev):''}&timezone=Asia%2FTaipei&wind_speed_unit=ms&forecast_days=8`+
      '&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,is_day'+
      '&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,cloud_cover,relative_humidity_2m,is_day'+
      '&minutely_15=precipitation'+
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,precipitation_sum,uv_index_max,sunrise,sunset,wind_speed_10m_max';
    const d=await NET.json(u,{ttl:10*60e3,proxy:false});
    const H=d.hourly,hourly=H.time.map((t,i)=>({time:new Date(t+':00+08:00'),t:H.temperature_2m[i],feel:H.apparent_temperature[i],pop:H.precipitation_probability[i],rain:H.precipitation[i],code:H.weather_code[i],wind:H.wind_speed_10m[i],dir:H.wind_direction_10m[i],gust:H.wind_gusts_10m[i],uv:H.uv_index[i],cloud:H.cloud_cover[i],rh:H.relative_humidity_2m[i],day:H.is_day[i]}));
    const D=d.daily,daily=D.time.map((t,i)=>({date:new Date(t+'T00:00:00+08:00'),hi:D.temperature_2m_max[i],lo:D.temperature_2m_min[i],feelHi:D.apparent_temperature_max[i],feelLo:D.apparent_temperature_min[i],pop:D.precipitation_probability_max[i],rain:D.precipitation_sum[i],code:D.weather_code[i],uv:D.uv_index_max[i],sunrise:new Date(D.sunrise[i]+':00+08:00'),sunset:new Date(D.sunset[i]+':00+08:00'),windMax:D.wind_speed_10m_max[i]}));
    const M=d.minutely_15,min15=M?M.time.map((t,i)=>({time:new Date(t+':00+08:00'),rain:M.precipitation[i]})):[];
    const C=d.current;
    const now={t:C.temperature_2m,feel:C.apparent_temperature,rh:C.relative_humidity_2m,rain:C.precipitation,code:C.weather_code,cloud:C.cloud_cover,wind:C.wind_speed_10m,dir:C.wind_direction_10m,gust:C.wind_gusts_10m,uv:C.uv_index,day:C.is_day,text:wmoText(C.weather_code),src:'Open-Meteo 模式'};
    return {now,hourly,daily,min15};
  },
  async aqPoint(lat,lon){
    const u=`${this.aqBase}?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&timezone=Asia%2FTaipei&current=pm2_5,pm10,us_aqi&hourly=pm2_5&forecast_days=3`;
    const d=await NET.json(u,{ttl:30*60e3,proxy:false});
    return {pm25:d.current.pm2_5,pm10:d.current.pm10,aqi:d.current.us_aqi,src:'Open-Meteo (CAMS)',hourly:d.hourly.time.map((t,i)=>({time:new Date(t+':00+08:00'),v:d.hourly.pm2_5[i]}))};
  },
  /* 全台格點（地圖圖層／時間軸用）*/
  gridDef(){const lats=[],lons=[];for(let y=21.85;y<=25.46;y+=0.3)lats.push(+y.toFixed(2));for(let x=119.3;x<=122.01;x+=0.3)lons.push(+x.toFixed(2));return {lats,lons}},
  async grid(kind){
    const {lats,lons}=this.gridDef();const LA=[],LO=[];
    for(const la of lats)for(const lo of lons){LA.push(la);LO.push(lo)}
    let u,vars;
    if(kind==='aq'){vars=['pm2_5'];u=`${this.aqBase}?latitude=${LA.join(',')}&longitude=${LO.join(',')}&timezone=Asia%2FTaipei&hourly=pm2_5&forecast_days=3`}
    else{vars=['precipitation','wind_speed_10m','wind_direction_10m','weather_code','cape','temperature_2m','cloud_cover','precipitation_probability'];
      u=`${this.base}?latitude=${LA.join(',')}&longitude=${LO.join(',')}&timezone=Asia%2FTaipei&wind_speed_unit=ms&forecast_hours=49&hourly=${vars.join(',')}`}
    let d=await NET.json(u,{ttl:30*60e3,proxy:false,key:'grid-'+kind,timeout:45000});
    if(!Array.isArray(d))d=[d];
    const now=Date.now();
    const times=d[0].hourly.time.map(t=>new Date(t+':00+08:00'));
    let i0=times.findIndex(t=>t.getTime()>now-3600e3);if(i0<0)i0=0;
    const nt=Math.min(49,times.length-i0),nx=lons.length,ny=lats.length;
    const v={};for(const k of vars){v[k]=[];for(let ti=0;ti<nt;ti++){const a=new Float32Array(nx*ny);for(let j=0;j<d.length;j++){const x=d[j].hourly[k][i0+ti];a[j]=x==null?NaN:x}v[k].push(a)}}
    return {lats,lons,nx,ny,times:times.slice(i0,i0+nt),v};
  }
};
/* 雙線性取樣 */
function gridSample(G,arr,lat,lon){
  const fy=(lat-G.lats[0])/(G.lats[1]-G.lats[0]),fx=(lon-G.lons[0])/(G.lons[1]-G.lons[0]);
  if(fx<0||fy<0||fx>G.nx-1||fy>G.ny-1)return NaN;
  const x0=Math.floor(fx),y0=Math.floor(fy),x1=Math.min(x0+1,G.nx-1),y1=Math.min(y0+1,G.ny-1),dx=fx-x0,dy=fy-y0;
  const a=arr[y0*G.nx+x0],b=arr[y0*G.nx+x1],c=arr[y1*G.nx+x0],d=arr[y1*G.nx+x1];
  return a*(1-dx)*(1-dy)+b*dx*(1-dy)+c*(1-dx)*dy+d*dx*dy;
}

/* ================= 中央氣象署 CWA（需授權碼） ================= */
const TOWN_FX={'宜蘭縣':1,'桃園市':5,'新竹縣':9,'苗栗縣':13,'彰化縣':17,'南投縣':21,'雲林縣':25,'嘉義縣':29,'屏東縣':33,'臺東縣':37,'花蓮縣':41,'澎湖縣':45,'基隆市':49,'新竹市':53,'嘉義市':57,'臺北市':61,'高雄市':65,'新北市':69,'臺中市':73,'臺南市':77,'連江縣':81,'金門縣':85};
const CWA={
  rest:'https://opendata.cwa.gov.tw/api/v1/rest/datastore/',
  file:'https://opendata.cwa.gov.tw/fileapi/v1/opendataapi/',
  s3:'https://cwaopendata.s3.ap-northeast-1.amazonaws.com/',
  has(){return !!CFG.cwaKey},
  async get(id,params='',ttl=10*60e3){
    if(!CFG.cwaKey)throw new Error('尚未設定 CWA 授權碼');
    const u=`${this.rest}${id}?Authorization=${encodeURIComponent(CFG.cwaKey)}&format=JSON${params}`;
    const d=await NET.json(u,{ttl,key:'cwa-'+id+params});
    if(d&&d.success===false||d&&d.success==='false')throw new Error('CWA 回應失敗');
    return lcKeys(d);
  },
  async test(key){
    const u=`${this.rest}F-C0032-001?Authorization=${encodeURIComponent(key)}&format=JSON&locationName=${encodeURIComponent('臺北市')}`;
    const d=await NET.json(u);return d&&(d.success===true||d.success==='true');
  },
  /* 解析鄉鎮預報（新：Locations/Location/WeatherElement/Time/ElementValue；舊：locations/location/weatherElement/time/elementValue） */
  parseTown(d,town){
    const rec=d.records||{};const L0=(rec.locations||rec.location||[])[0]||{};
    const locs=L0.location||[];const loc=locs.find(l=>(l.locationname||'')===town)||locs[0];
    if(!loc)return null;
    const els={};
    for(const e of (loc.weatherelement||[])){
      const name=e.elementname||e.description;
      els[name]=(e.time||[]).map(t=>({start:tzDate(t.starttime||t.datatime),end:tzDate(t.endtime),v:(t.elementvalue||[])[0]||{}}));
    }
    return {name:loc.locationname,lat:num(loc.latitude||loc.lat),lon:num(loc.longitude||loc.lon),els};
  },
  pick(v,...keys){for(const k of keys){if(v[k]!=null&&v[k]!==''&&v[k]!==' ')return v[k]}if(v.value!=null)return v.value;return null},
  async townForecast(county,town){
    const n=TOWN_FX[county];if(!n)return null;
    const id='F-D0047-'+String(n).padStart(3,'0');
    const d=await this.get(id,'&LocationName='+encodeURIComponent(town),20*60e3);
    const p=this.parseTown(d,town);if(!p)return null;
    const E=p.els,g=(...names)=>{for(const n of names)if(E[n])return E[n];return []};
    const T=g('溫度','T'),AT=g('體感溫度','AT'),POP=g('3小時降雨機率','PoP3h','PoP6h'),WX=g('天氣現象','Wx'),DESC=g('天氣預報綜合描述','WeatherDescription'),WS=g('風速','WS'),RH=g('相對濕度','RH');
    const slots=POP.length?POP:WX;
    const at=(arr,time,...keys)=>{let best=null;for(const x of arr){if(x.start<=time&&(!x.end||x.end>time)){best=x;break}}
      if(!best){let bd=1e15;for(const x of arr){const dd=Math.abs(x.start-time);if(dd<bd){bd=dd;best=x}}}return best?this.pick(best.v,...keys):null};
    const out=slots.map(s=>{const tm=new Date(+s.start+60e3);return{
      start:s.start,end:s.end,
      pop:num(at(POP,tm,'probabilityofprecipitation')),
      wx:at(WX,tm,'weather'),wxCode:at(WX,tm,'weathercode'),
      desc:at(DESC,tm,'weatherdescription'),
      t:num(at(T,tm,'temperature')),feel:num(at(AT,tm,'apparenttemperature')),
      wind:num(at(WS,tm,'windspeed')),bf:at(WS,tm,'beaufortscale'),rh:num(at(RH,tm,'relativehumidity'))}});
    return {src:'中央氣象署 '+id,slots:out};
  },
  async townWeek(county,town){
    const n=TOWN_FX[county];if(!n)return null;
    const id='F-D0047-'+String(n+2).padStart(3,'0');
    const d=await this.get(id,'&LocationName='+encodeURIComponent(town),60*60e3);
    const p=this.parseTown(d,town);if(!p)return null;const E=p.els;
    const g=(...names)=>{for(const n of names)if(E[n])return E[n];return []};
    const MX=g('最高溫度','MaxT'),MN=g('最低溫度','MinT'),POP=g('12小時降雨機率','PoP12h'),WX=g('天氣現象','Wx'),UV=g('紫外線指數','UVI'),DESC=g('天氣預報綜合描述','WeatherDescription');
    const days={};
    const put=(arr,key,...ks)=>arr.forEach(x=>{const dd=new Date(x.start);const k=dd.getFullYear()+'-'+(dd.getMonth()+1)+'-'+dd.getDate();const o=days[k]=days[k]||{date:new Date(dd.getFullYear(),dd.getMonth(),dd.getDate()),slots:[]};const v=this.pick(x.v,...ks);
      if(key==='hi')o.hi=Math.max(o.hi??-99,num(v)??-99);else if(key==='lo')o.lo=Math.min(o.lo??99,num(v)??99);else if(key==='pop')o.pop=Math.max(o.pop??0,num(v)??0);else if(key==='uv'){o.uv=Math.max(o.uv??0,num(v)??0)}else if(key==='wx'){if(dd.getHours()>=6&&dd.getHours()<18||!o.wx)o.wx=v}else if(key==='desc'){if(!o.desc||dd.getHours()>=6&&dd.getHours()<18)o.desc=v}});
    put(MX,'hi','maxtemperature','temperature');put(MN,'lo','mintemperature','temperature');put(POP,'pop','probabilityofprecipitation');put(WX,'wx','weather');put(UV,'uv','uvindex');put(DESC,'desc','weatherdescription');
    return {src:'中央氣象署 '+id,days:Object.values(days).sort((a,b)=>a.date-b.date)};
  },
  /* 即時觀測（自動站＋署屬站） */
  async stations(){
    const res=await Promise.allSettled([this.get('O-A0003-001','',10*60e3),this.get('O-A0001-001','',10*60e3)]);
    const list=[];
    for(const r of res){if(r.status!=='fulfilled')continue;for(const s of (r.value.records&&r.value.records.station)||[]){
      const gi=s.geoinfo||{};const co=(gi.coordinates||[]).find(c=>/WGS84/i.test(c.coordinatename||''))||(gi.coordinates||[])[0]||{};
      const we=s.weatherelement||{};
      list.push({id:s.stationid,name:s.stationname,county:gi.countyname,town:gi.townname,lat:num(co.stationlatitude),lon:num(co.stationlongitude),alt:num(gi.stationaltitude??s.stationaltitude),
        time:tzDate(s.obstime&&s.obstime.datetime),t:num(we.airtemperature),rh:num(we.relativehumidity),wind:num(we.windspeed),dir:num(we.winddirection),
        gust:num(we.gustinfo&&we.gustinfo.peakgustspeed),weather:we.weather&&!/^-?99/.test(we.weather)?we.weather:null,rain:num(we.now&&we.now.precipitation),uv:num(we.uvindex)})}}
    return list.filter(s=>s.lat&&s.lon);
  },
  async rainGauges(){
    const d=await this.get('O-A0002-001','',10*60e3);
    return ((d.records&&d.records.station)||[]).map(s=>{const gi=s.geoinfo||{};const co=(gi.coordinates||[]).find(c=>/WGS84/i.test(c.coordinatename||''))||(gi.coordinates||[])[0]||{};const re=s.rainfallelement||{};
      const g=k=>num(re[k]&&re[k].precipitation);
      return {name:s.stationname,county:gi.countyname,town:gi.townname,lat:num(co.stationlatitude),lon:num(co.stationlongitude),now:g('now'),m10:g('past10min'),h1:g('past1hr'),h3:g('past3hr'),h24:g('past24hr'),time:tzDate(s.obstime&&s.obstime.datetime)}}).filter(s=>s.lat);
  },
  async warnings(county){
    const d=await this.get('W-C0033-001',county?'&locationName='+encodeURIComponent(county):'',10*60e3);
    const out=[];for(const l of (d.records&&d.records.location)||[]){for(const hz of (l.hazardconditions&&l.hazardconditions.hazards)||[]){const i=hz.info||{};out.push({loc:l.locationname,name:(i.phenomena||'')+(i.significance||''),start:tzDate(hz.validtime&&hz.validtime.starttime),end:tzDate(hz.validtime&&hz.validtime.endtime)})}}
    return out;
  },
  async typhoons(){
    const d=await this.get('W-C0034-005','',15*60e3);
    const tcs=(d.records&&d.records.tropicalcyclones&&d.records.tropicalcyclones.tropicalcyclone)||[];
    const pc=s=>{if(!s)return null;const a=String(s).split(',').map(Number);return a.length>=2?{lon:a[0],lat:a[1]}:null};
    return tcs.map(t=>{
      const past=((t.analysisdata&&t.analysisdata.fix)||[]).map(f=>({time:tzDate(f.fixtime),...pc(f.coordinate),wind:num(f.maxwindspeed),gust:num(f.maxgustspeed),p:num(f.pressure),r15:num(f.circleof15ms&&f.circleof15ms.radius),r25:num(f.circleof25ms&&f.circleof25ms.radius),move:f.movingdirection,spd:num(f.movingspeed)})).filter(x=>x.lat);
      const fc=((t.forecastdata&&t.forecastdata.fix)||[]).map(f=>{const it=tzDate(f.inittime);const tau=num(f.tau)||0;return {time:it?new Date(+it+tau*3600e3):null,tau,...pc(f.coordinate),wind:num(f.maxwindspeed),p:num(f.pressure),r70:num(f.radiusof70percentprobability),r15:num(f.circleof15ms&&f.circleof15ms.radius)}}).filter(x=>x.lat&&x.time);
      return {name:t.cwatyphoonname||t.typhoonname||'熱帶性低氣壓',en:t.typhoonname,past,fc};
    }).filter(t=>t.past.length||t.fc.length);
  },
  /* 閃電（KMZ，過去 1 小時） */
  async lightning(){
    if(!CFG.cwaKey)throw new Error('尚未設定 CWA 授權碼');
    const u=`${this.file}O-A0039-001?Authorization=${encodeURIComponent(CFG.cwaKey)}&downloadType=WEB&format=KMZ`;
    const {buf}=await NET.buf(u,{timeout:30000});
    let kml;const b=new Uint8Array(buf);
    if(b[0]===0x50&&b[1]===0x4b)kml=await unzipFirst(b,/\.kml$/i);else kml=new TextDecoder().decode(b);
    const out=[];const re=/<Placemark[\s\S]*?<\/Placemark>/g;let m;
    while((m=re.exec(kml))){const pm=m[0];const c=/<coordinates>\s*([-\d.]+)\s*,\s*([-\d.]+)/.exec(pm);if(!c)continue;
      const w=/<when>([^<]+)<\/when>/.exec(pm)||/(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?)/.exec(pm);
      out.push({lon:+c[1],lat:+c[2],time:w?tzDate(w[1]):null,cg:/雲對地|CG|cloud.?to.?ground/i.test(pm)})}
    return out;
  }
};
/* 極簡 ZIP 解壓（只取第一個符合的檔案） */
async function unzipFirst(b,re){
  const dv=new DataView(b.buffer,b.byteOffset,b.byteLength);let p=0;
  while(p+30<b.length&&dv.getUint32(p,true)===0x04034b50){
    const method=dv.getUint16(p+8,true),csize=dv.getUint32(p+18,true),nlen=dv.getUint16(p+26,true),xlen=dv.getUint16(p+28,true);
    const name=new TextDecoder().decode(b.subarray(p+30,p+30+nlen));const start=p+30+nlen+xlen;const data=b.subarray(start,start+csize);
    if(re.test(name)){if(method===0)return new TextDecoder().decode(data);
      const ds=new DecompressionStream('deflate-raw');const out=await new Response(new Blob([data]).stream().pipeThrough(ds)).arrayBuffer();return new TextDecoder().decode(out)}
    p=start+csize;
  }
  throw new Error('KMZ 內沒有 KML');
}

/* ================= 環境部 空品（需 api_key） ================= */
const MOENV={
  async sites(key=CFG.moenvKey){
    if(!key)throw new Error('尚未設定環境部 api_key');
    const u=`https://data.moenv.gov.tw/api/v2/aqx_p_432?api_key=${encodeURIComponent(key)}&limit=1000&format=JSON`;
    let d=await NET.json(u,{ttl:key===CFG.moenvKey?20*60e3:0,key:'moenv'});
    const recs=Array.isArray(d)?d:(d.records||d.Records||[]);
    return recs.map(r=>({name:r.sitename||r.SiteName,county:r.county||r.County,aqi:num(r.aqi||r.AQI),status:r.status||r.Status,pm25:num(r['pm2.5']??r['PM2.5']??r.pm25),pm10:num(r.pm10||r.PM10),lat:num(r.latitude||r.Latitude),lon:num(r.longitude||r.Longitude),time:r.publishtime||r.PublishTime})).filter(s=>s.lat&&s.lon);
  }
};

const nearest=(list,lat,lon,maxKm=30,pred=()=>true)=>{let b=null,bd=1e9;for(const s of list){if(!pred(s))continue;const d=kmDist(lat,lon,s.lat,s.lon);if(d<bd){bd=d;b=s}}return bd<=maxKm?{...b,km:bd}:null};
function kmDist(a,b,c,d){const R=6371,r=Math.PI/180;const x=(d-b)*r*Math.cos((a+c)/2*r),y=(c-a)*r;return R*Math.hypot(x,y)}

/* ================= 雷達回波（CWA 整合回波圖 / RainViewer 備援） ================= */
const RADAR={
  B:{s:20.5,n:26.5,w:118,e:124},   // O-A0058-003 / CV1_3600 鄰近地區範圍
  G:1200,
  /* 依 CWA 色階把像素分為 0~6 級：1 弱回波(雲/毛毛雨) 2 小雨 3 中雨 4 大雨 5 豪雨 6 劇烈 */
  cls(r,g,b){
    const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;
    if(d<38)return 0;                       // 灰、黑、白：底圖/海岸線/文字
    let hh;if(mx===r)hh=((g-b)/d+6)%6;else if(mx===g)hh=(b-r)/d+2;else hh=(r-g)/d+4;hh*=60;
    if(hh>=165&&hh<250)return 1;            // 青～藍
    if(hh>=75&&hh<165)return 2;             // 綠
    if(hh>=48&&hh<75)return 3;              // 黃
    if(hh>=22&&hh<48)return 4;              // 橙
    if(hh>=250&&hh<330)return 6;            // 紫、洋紅
    return 5;                               // 紅
  },
  PAL:[null,[150,196,222,110],[74,163,223,200],[60,170,110,215],[236,196,48,225],[232,118,44,235],[200,48,44,240],[150,62,178,245]],
  frames:[],src:null,
  fromImage(img,time,src='cwa'){
    const G=this.G,cv=document.createElement('canvas');cv.width=G;cv.height=G;const x=cv.getContext('2d',{willReadFrequently:true});
    x.imageSmoothingEnabled=false;x.drawImage(img,0,0,G,G);
    const px=x.getImageData(0,0,G,G).data;const lv=new Uint8Array(G*G);
    const mask=(r,c)=>(r>=.70*G&&r<.945*G&&c>=.855*G&&c<.93*G)||(r>=.905*G&&c>=.405*G&&c<.555*G)||(r<.035*G);
    for(let r=0;r<G;r++)for(let c=0;c<G;c++){const i=r*G+c;if(mask(r,c))continue;const k=i*4;if(px[k+3]<40)continue;lv[i]=this.cls(px[k],px[k+1],px[k+2])}
    // 去除孤立雜點
    const out=new Uint8Array(lv);for(let r=1;r<G-1;r++)for(let c=1;c<G-1;c++){const i=r*G+c;if(!lv[i])continue;let n=0;if(lv[i-1])n++;if(lv[i+1])n++;if(lv[i-G])n++;if(lv[i+G])n++;if(n===0)out[i]=0}
    return {time,src,w:G,h:G,B:this.B,lv:out};
  },
  /* 轉成 Web Mercator 對齊的顯示圖層 */
  toCanvas(f,minLv=1){
    const W=f.w,H=f.h,B=f.B;const my=l=>Math.log(Math.tan(Math.PI/4+l*Math.PI/360));
    const yN=my(B.n),yS=my(B.s);const cv=document.createElement('canvas');cv.width=W;cv.height=H;const x=cv.getContext('2d');const im=x.createImageData(W,H);const d=im.data;
    for(let r=0;r<H;r++){const yy=yN-(yN-yS)*(r+.5)/H;const lat=Math.atan(Math.sinh(yy))*180/Math.PI;const sr=Math.round((B.n-lat)/(B.n-B.s)*H-.5);if(sr<0||sr>=H)continue;
      for(let c=0;c<W;c++){const v=f.lv[sr*W+c];if(v<minLv)continue;const p=this.PAL[v];const k=(r*W+c)*4;d[k]=p[0];d[k+1]=p[1];d[k+2]=p[2];d[k+3]=p[3]}}
    x.putImageData(im,0,0);return cv;
  },
  async cwaLatest(){
    const {img,lm}=await NET.image(CWA.s3+'Observation/O-A0058-003.png');
    return this.fromImage(img,lm?new Date(lm):new Date(),'cwa');
  },
  /* 氣象署網站 CV1_3600 歷史圖：投影與 S3 版不同（海報式、偏 0.3–0.7 度），只拿來算「移動向量」，不拿來疊圖 */
  async cv1Pair(){
    const js=await NET.text('https://www.cwa.gov.tw/Data/js/obs_img/Observe_radar.js?t='+Math.floor(Date.now()/120e3));
    const names=[...new Set((js.match(/CV1_3600_\d{12}\.png/g)||[]))].sort();if(names.length<2)return null;
    const tm=nm=>{const m=nm.match(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/);return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+08:00`)};
    const last=names[names.length-1],tl=tm(last);const prev=names.slice(0,-1).reverse().find(n=>{const d=(tl-tm(n))/60e3;return d>=9&&d<=21});if(!prev)return null;
    const [a,b]=await Promise.all([prev,last].map(async nm=>{const {img}=await NET.image('https://www.cwa.gov.tw/Data/radar/'+nm);return this.fromImage(img,tm(nm),'cv1')}));
    return {A:a,B:b,src:'cv1'};
  },
  /* RainViewer：與 S3 一樣是正確座標的過去 2 小時影格（z6 拼接） */
  async rainviewer(n=7){
    const meta=await NET.json('https://api.rainviewer.com/public/weather-maps.json',{proxy:false});
    const past=(meta.radar&&meta.radar.past||[]).slice(-n);const z=6;
    const lon2x=l=>(l+180)/360*2**z,lat2y=l=>(1-Math.log(Math.tan(l*Math.PI/180)+1/Math.cos(l*Math.PI/180))/Math.PI)/2*2**z;
    const B=this.B,x0=Math.floor(lon2x(B.w)),x1=Math.floor(lon2x(B.e)),y0=Math.floor(lat2y(B.n)),y1=Math.floor(lat2y(B.s));
    const frames=[];
    for(const p of past){
      const W=(x1-x0+1)*256,Hh=(y1-y0+1)*256;const cv=document.createElement('canvas');cv.width=W;cv.height=Hh;const cx=cv.getContext('2d',{willReadFrequently:true});
      let got=0;
      await Promise.all([...Array((x1-x0+1)*(y1-y0+1))].map(async(_,k)=>{const tx=x0+k%(x1-x0+1),ty=y0+Math.floor(k/(x1-x0+1));
        const im=new Image();im.crossOrigin='anonymous';im.src=`${meta.host}${p.path}/256/${z}/${tx}/${ty}/2/1_0.png`;try{await im.decode();cx.drawImage(im,(tx-x0)*256,(ty-y0)*256);got++}catch(e){}}));
      if(!got)continue;
      const G=360,px=cx.getImageData(0,0,W,Hh).data,lv=new Uint8Array(G*G);
      for(let r=0;r<G;r++){const lat=B.n-(B.n-B.s)*(r+.5)/G;const py=Math.floor((lat2y(lat)-y0)*256);for(let c=0;c<G;c++){const lon=B.w+(B.e-B.w)*(c+.5)/G;const pxx=Math.floor((lon2x(lon)-x0)*256);const k=(py*W+pxx)*4;if(px[k+3]<30)continue;lv[r*G+c]=this.rvCls(px[k],px[k+1],px[k+2])}}
      frames.push({time:new Date(p.time*1000),src:'rv',w:G,h:G,B,lv});
    }
    return frames;
  },
  rvCls(r,g,b){const mx=Math.max(r,g,b),mn=Math.min(r,g,b),L=(mx+mn)/510;const c=this.cls(r,g,b);if(c===1||c===0){return L>.72?1:L>.55?2:L>.4?3:4}return Math.max(3,c)},
  /* 上一張 S3 回波（IndexedDB；APK 另可取背景服務存的那張） */
  idb(){return this._db||(this._db=new Promise((res,rej)=>{const r=indexedDB.open('wx-radar',1);r.onupgradeneeded=()=>r.result.createObjectStore('f');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}))},
  async idbGet(k){try{const db=await this.idb();return await new Promise(res=>{const q=db.transaction('f').objectStore('f').get(k);q.onsuccess=()=>res(q.result||null);q.onerror=()=>res(null)})}catch(e){return null}},
  async idbPut(k,v){try{const db=await this.idb();db.transaction('f','readwrite').objectStore('f').put(v,k)}catch(e){}},
  async nativeFrame(name){if(!isApp)return null;try{const r=await fetch(location.origin+'/radar/'+name+'.bin');if(!r.ok)return null;const b=await r.arrayBuffer();const dv=new DataView(b);const time=new Date(Number(dv.getBigInt64(0)));const w=dv.getInt32(8),h=dv.getInt32(12);return {time,src:'cwa',w,h,B:this.B,lv:new Uint8Array(b,16,w*h)}}catch(e){return null}},
  async load(force){
    if(!force&&this.frames.length&&Date.now()-this.loadedAt<5*60e3)return this.frames;
    const [s3r,rvr]=await Promise.allSettled([this.cwaLatest(),this.rainviewer(7)]);
    const s3=s3r.status==='fulfilled'?s3r.value:null,rv=rvr.status==='fulfilled'?rvr.value:[];
    // 顯示用影格：RainViewer 過去影格＋氣象署最新一張
    let frames=s3?[...rv.filter(f=>f.time<s3.time-4*60e3),s3]:rv;
    frames.sort((a,b)=>a.time-b.time);
    this.best=s3||frames[frames.length-1]||null;this.src=s3?'cwa':'rv';
    // 移動向量用的影格對（同來源）
    let pair=null;
    if(s3){
      const cands=[await this.idbGet('s3prev'),await this.idbGet('s3last'),await this.nativeFrame('cur'),await this.nativeFrame('prev')].filter(Boolean);
      const old=cands.filter(f=>{const d=(s3.time-f.time)/60e3;return d>=8&&d<=32&&f.w===s3.w}).sort((a,b)=>b.time-a.time)[0];
      if(old)pair={A:old,B:s3,src:'cwa'};
      const last=await this.idbGet('s3last');
      if(!last||s3.time-last.time>3*60e3){if(last)this.idbPut('s3prev',last);this.idbPut('s3last',{time:s3.time,src:'cwa',w:s3.w,h:s3.h,B:s3.B,lv:s3.lv})}
    }
    if(!pair&&rv.length>=2){const B=rv[rv.length-1];const A=[...rv].reverse().find(f=>{const d=(B.time-f.time)/60e3;return d>=9&&d<=32});if(A)pair={A,B,src:'rv'}}
    if(!pair&&isApp){try{pair=await this.cv1Pair()}catch(e){}}
    this.pair=pair;this.frames=frames;this.loadedAt=Date.now();
    return frames;
  },
  /* 在 (lat,lon) 附近估計回波移動（度/分鐘） */
  motion(lat,lon){
    const P=this.pair;if(!P)return null;const {A,B}=P;const W=B.w,H=B.h,BB=B.B;
    const cx=(lon-BB.w)/(BB.e-BB.w)*W,cy=(BB.n-lat)/(BB.n-BB.s)*H;const kmPx=(BB.n-BB.s)/H*111.2;
    const win=Math.round((P.src==='cv1'?90:60)/kmPx);const dt=(B.time-A.time)/60e3;if(dt<5)return null;
    const lvAt=(f,x,y)=>{x=Math.round(x);y=Math.round(y);return (x<0||y<0||x>=W||y>=H)?0:f.lv[y*W+x]};
    const S=Math.ceil(100/60*dt/kmPx),step=Math.max(1,Math.round(win/45));
    const pts=[];for(let y=cy-win;y<=cy+win;y+=step)for(let x=cx-win;x<=cx+win;x+=step){const a=lvAt(A,x,y);if(a>=1)pts.push([x,y,a])}
    if(pts.length<15)return null;
    const cost=(dx,dy)=>{let c=0;for(const p of pts)c+=Math.abs(p[2]-lvAt(B,p[0]+dx,p[1]+dy));return c};
    const base=cost(0,0);let best=1e18,bx=0,by=0;const ss=Math.max(1,Math.round(S/20));
    for(let dy=-S;dy<=S;dy+=ss)for(let dx=-S;dx<=S;dx+=ss){const c=cost(dx,dy);if(c<best){best=c;bx=dx;by=dy}}
    const bx0=bx,by0=by;for(let dy=by0-ss;dy<=by0+ss;dy++)for(let dx=bx0-ss;dx<=bx0+ss;dx++){const c=cost(dx,dy);if(c<best){best=c;bx=dx;by=dy}}
    return {lon:bx/dt*(BB.e-BB.w)/W,lat:-by/dt*(BB.n-BB.s)/H,conf:base>0?clamp(1-best/base,0,1):0,src:P.src};
  },
  /* 回波追蹤：以最新一張回波＋移動向量，外推到達時間 */
  track(lat,lon){
    const B1=this.best;if(!B1)return {ok:false,msg:'沒有雷達資料'};
    const W=B1.w,H=B1.h,B=B1.B;
    const cx=(lon-B.w)/(B.e-B.w)*W,cy=(B.n-lat)/(B.n-B.s)*H;
    if(cx<0||cy<0||cx>=W||cy>=H)return {ok:false,msg:'位置超出雷達範圍'};
    const kmPx=(B.n-B.s)/H*111.2;const win=Math.round(60/kmPx);
    const lvAt=(x,y)=>{x=Math.round(x);y=Math.round(y);return (x<0||y<0||x>=W||y>=H)?0:B1.lv[y*W+x]};
    let echoN=0,nearest=1e9;const st=Math.max(1,Math.round(win/60));
    for(let y=cy-win;y<=cy+win;y+=st)for(let x=cx-win;x<=cx+win;x+=st){if(lvAt(x,y)>=2){echoN++;const d=Math.hypot(x-cx,y-cy)*kmPx;if(d<nearest)nearest=d}}
    const m=echoN>12?this.motion(lat,lon):null;
    const vx=m?m.lon/(B.e-B.w)*W:0,vy=m?-m.lat/(B.n-B.s)*H:0;
    const age=Math.max(0,(Date.now()-B1.time)/60e3);
    const rad=Math.max(2,Math.round(1.6/kmPx));
    const lvNear=t=>{const sx=cx-vx*t,sy=cy-vy*t;let mx=0;for(let y=-rad;y<=rad;y++)for(let x=-rad;x<=rad;x++){if(x*x+y*y>rad*rad)continue;const v=lvAt(sx+x,sy+y);if(v>mx)mx=v}return mx};
    const series=[];for(let tau=0;tau<=90;tau+=5)series.push({tau,lv:lvNear(age+tau)});
    const nowLv=lvNear(age);let eta=null,etaLv=0,stopIn=null;
    if(nowLv<2){for(let tau=1;tau<=90;tau++){const v=lvNear(age+tau);if(v>=2){eta=tau;etaLv=v;break}}}
    else{for(let tau=1;tau<=90;tau++){if(lvNear(age+tau)<2){stopIn=tau;break}}}
    const spd=Math.hypot(vx,vy)*kmPx*60,dirTo=(Math.atan2(vx,-vy)*180/Math.PI+360)%360;
    return {ok:true,frameTime:B1.time,age,nowLv,eta,etaLv,stopIn,spd,dirFrom:(dirTo+180)%360,dirTo,conf:m?m.conf:0,nearestKm:nearest<1e9?nearest:null,echoN,series,v:m,moving:!!m};
  },
  /* 外推影格（純平移；v 為度/分鐘） */
  extrapolate(f,v,minutes){
    const W=f.w,H=f.h,dx=Math.round(v.lon/(f.B.e-f.B.w)*W*minutes),dy=Math.round(-v.lat/(f.B.n-f.B.s)*H*minutes);const lv=new Uint8Array(W*H);
    for(let y=0;y<H;y++){const sy=y-dy;if(sy<0||sy>=H)continue;for(let x=0;x<W;x++){const sx=x-dx;if(sx<0||sx>=W)continue;lv[y*W+x]=f.lv[sy*W+sx]}}
    return {...f,lv,time:new Date(+f.time+minutes*60e3),fc:true};
  }
};
const LV_TEXT=['無','零星弱回波','小雨','中雨','大雨','豪雨','劇烈降雨'];

/* ================= 未來 1 小時雷達定量降雨預報 F-B0046-001（S3 免金鑰） ================= */
const QPF={
  data:null,
  async load(force){
    if(!force&&this.data&&Date.now()-this.data.at<8*60e3)return this.data;
    const raw=await NET.json(CWA.s3+'Forecast/F-B0046-001.json',{timeout:40000});
    const d=lcKeys(raw);const ds=(d.cwaopendata||d).dataset||{};const di=ds.datasetinfo||{};const ps=di.parameterset||{};
    const nx=+ps.griddimensionx||441,ny=+ps.griddimensiony||561,res=+ps.gridresolution||0.0125;
    const txt=(ds.contents&&ds.contents.content)||'';const arr=new Float32Array(nx*ny);let i=0,s=0;
    for(let k=0;k<=txt.length&&i<arr.length;k++){const ch=txt.charCodeAt(k);if(ch===44||k===txt.length){arr[i++]=parseFloat(txt.slice(s,k));s=k+1}}
    this.data={at:Date.now(),nx,ny,res,lon0:117.975,lat0:19.975,v:arr,issued:tzDate(ps.datetime)||null};
    return this.data;
  },
  at(lat,lon){const q=this.data;if(!q)return null;const ix=Math.round((lon-q.lon0)/q.res),iy=Math.round((lat-q.lat0)/q.res);if(ix<0||iy<0||ix>=q.nx||iy>=q.ny)return null;const v=q.v[iy*q.nx+ix];return v<0?0:v},
  maxNear(lat,lon,km=3){const q=this.data;if(!q)return null;const r=Math.ceil(km/111/q.res);let m=0;const ix=Math.round((lon-q.lon0)/q.res),iy=Math.round((lat-q.lat0)/q.res);for(let y=iy-r;y<=iy+r;y++)for(let x=ix-r;x<=ix+r;x++){if(x<0||y<0||x>=q.nx||y>=q.ny)continue;const v=q.v[y*q.nx+x];if(v>m)m=v}return m},
  canvas(){const q=this.data;if(!q)return null;const cv=document.createElement('canvas');cv.width=q.nx;cv.height=q.ny;const x=cv.getContext('2d');const im=x.createImageData(q.nx,q.ny);
    const my=l=>Math.log(Math.tan(Math.PI/4+l*Math.PI/360));const s=q.lat0-q.res/2,n=q.lat0+q.res*(q.ny-.5);const yN=my(n),yS=my(s);
    for(let r=0;r<q.ny;r++){const yy=yN-(yN-yS)*(r+.5)/q.ny;const lat=Math.atan(Math.sinh(yy))*180/Math.PI;const iy=Math.round((lat-q.lat0)/q.res);if(iy<0||iy>=q.ny)continue;
      for(let c=0;c<q.nx;c++){const v=q.v[iy*q.nx+c];if(!(v>=0.5))continue;const col=rainColor(v);const k=(r*q.nx+c)*4;im.data[k]=col[0];im.data[k+1]=col[1];im.data[k+2]=col[2];im.data[k+3]=col[3]}}
    x.putImageData(im,0,0);return {cv,bounds:[[s,q.lon0-q.res/2],[n,q.lon0+q.res*(q.nx-.5)]]}}
};
/* 雨量色階 (mm/h) */
const RAIN_SCALE=[[0.5,[170,210,230,150],'0.5'],[2,[110,175,220,190],'2'],[5,[60,140,205,210],'5'],[10,[70,170,110,220],'10'],[15,[220,190,60,225],'15'],[30,[230,120,45,235],'30'],[50,[195,50,45,240],'50'],[80,[140,55,165,245],'80+']];
function rainColor(v){let c=null;for(const s of RAIN_SCALE)if(v>=s[0])c=s[1];return c||[0,0,0,0]}
