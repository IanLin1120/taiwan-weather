/* ================= 向量地圖（MapLibre + OpenFreeMap，與行跡導航相同圖資，免金鑰） ================= */
const GL={
  OFM:'https://tiles.openfreemap.org/styles/liberty',
  DEM:'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
  styleRaw:null,
  dark(){return document.documentElement.dataset.theme==='dark'},
  async raw(){
    if(this.styleRaw)return this.styleRaw;
    const c=lsGet('wx.glstyle',null);if(c&&c.st&&Date.now()-c.t<7*864e5)return this.styleRaw=c.st;
    try{const st=await NET.json(this.OFM,{proxy:false,timeout:20000});if(st&&st.layers){try{localStorage.setItem('wx.glstyle',JSON.stringify({t:Date.now(),st}))}catch(e){}return this.styleRaw=st}}catch(e){}
    if(c&&c.st)return this.styleRaw=c.st;
    // 備援：ArcGIS 點陣街道圖（行跡導航也用）
    return this.styleRaw={version:8,glyphs:'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',sources:{esri:{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:18,attribution:'© Esri'}},layers:[{id:'bg',type:'background',paint:{'background-color':'#efe5d3'}},{id:'esri',type:'raster',source:'esri',paint:{'raster-saturation':-.35,'raster-opacity':.9}}],_raster:true};
  },
  /* 大地色化＋繁中地名 */
  earth(src){
    const st=JSON.parse(JSON.stringify(src)),D=this.dark();
    const C=D?{bg:'#1f1913',water:'#22343a',land:'#29231b',green:'#273021',wood:'#232b1d',bld:'#3a3026',road:'#4a3f33',road2:'#5d4c3a',txt:'#e8dcc6',halo:'#1f1913'}
             :{bg:'#efe5d3',water:'#b7cccb',land:'#e9dcc4',green:'#d9dbb4',wood:'#cdd2a6',bld:'#e0cfb4',road:'#fbf6ec',road2:'#f1d7a6',txt:'#5a4632',halo:'#f6efe2'};
    const ZH=['coalesce',['get','name:zh-Hant'],['get','name:zh-TW'],['get','name'],['get','name:zh'],['get','name_int']];
    for(const l of st.layers||[]){
      const id=l.id||'',p=l.paint=l.paint||{};
      if(l.type==='background')p['background-color']=C.bg;
      else if(l.type==='fill'){if(/water|ocean|sea|lake|river/.test(id))p['fill-color']=C.water;else if(/wood|forest/.test(id))p['fill-color']=C.wood;else if(/park|grass|landcover|green|farmland|scrub/.test(id))p['fill-color']=C.green;else if(/building/.test(id))p['fill-color']=C.bld;else if(/landuse|residential|land/.test(id))p['fill-color']=C.land}
      else if(l.type==='fill-extrusion'){p['fill-extrusion-color']=C.bld;p['fill-extrusion-opacity']=.85}
      else if(l.type==='line'){if(/water|river|stream/.test(id))p['line-color']=C.water;else if(/motorway|trunk|primary/.test(id)&&!/casing/.test(id))p['line-color']=C.road2;else if(/road|street|minor|secondary|tertiary|service|path|track/.test(id)&&!/casing/.test(id))p['line-color']=C.road}
      else if(l.type==='symbol'&&l.layout&&l.layout['text-field']){l.layout['text-field']=ZH;p['text-color']=C.txt;p['text-halo-color']=C.halo;p['text-halo-width']=1.4}
      else if(l.type==='raster'&&D){p['raster-brightness-max']=.62;p['raster-saturation']=-.45}
    }
    return st;
  },
  firstSymbol(m){const L=m.getStyle().layers;const s=L.find(l=>l.type==='symbol');return s?s.id:undefined},
  /* 保留自己加的來源與圖層（切換明暗時） */
  carry(prev,next){if(!prev)return next;for(const k in prev.sources)if(/^(wx|tw|dem|ty)/.test(k))next.sources[k]=prev.sources[k];
    const mine=prev.layers.filter(l=>/^(wx|tw|hs|ty)/.test(l.id)&&l.type!=='custom');const sym=next.layers.findIndex(l=>l.type==='symbol');
    const below=mine.filter(l=>l.type==='raster'||l.type==='hillshade'||/^tw-.*fill$/.test(l.id)),above=mine.filter(l=>!below.includes(l));
    if(sym<0)next.layers.push(...below);else next.layers.splice(sym,0,...below);next.layers.push(...above);
    if(prev.terrain)next.terrain=prev.terrain;return next},
  async make(el,{center=[120.95,23.65],zoom=6.4}={}){
    const st=this.earth(await this.raw());
    const m=new maplibregl.Map({container:el,style:st,center,zoom,minZoom:4.5,maxZoom:15.5,maxPitch:75,attributionControl:false,
      localIdeographFontFamily:'"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif',fadeDuration:0,dragRotate:true,pitchWithRotate:true});
    m.touchZoomRotate.enableRotation();
    await new Promise(r=>m.once('load',r));
    this.addBase(m);
    window.addEventListener('resize',()=>m.resize());
    return m;
  },
  addBase(m){
    if(!m.getSource('dem'))m.addSource('dem',{type:'raster-dem',tiles:[this.DEM],tileSize:256,encoding:'terrarium',maxzoom:12,attribution:'地形 © Mapzen/AWS'});
    if(!m.getLayer('hs-relief'))try{m.addLayer({id:'hs-relief',type:'hillshade',source:'dem',paint:{'hillshade-exaggeration':.35,'hillshade-shadow-color':this.dark()?'#000':'#6b5236','hillshade-highlight-color':this.dark()?'#4a3f33':'#fff8ea','hillshade-accent-color':'#8a6a48'}},this.firstSymbol(m))}catch(e){}
    if(!m.getSource('tw-cty'))m.addSource('tw-cty',{type:'geojson',data:{type:'FeatureCollection',features:TW.countyNames.map(c=>({type:'Feature',properties:{c},geometry:TW.counties[c].geom}))}});
    if(!m.getLayer('tw-cty-fill'))m.addLayer({id:'tw-cty-fill',type:'fill',source:'tw-cty',paint:{'fill-color':'#000','fill-opacity':0}});
    if(!m.getLayer('tw-cty-line'))m.addLayer({id:'tw-cty-line',type:'line',source:'tw-cty',paint:{'line-color':this.dark()?'#e8d6b8':'#7a5c3e','line-width':1.1,'line-opacity':.6}});
    WX3.ensure(m);
  },
  async retheme(m){if(!m)return;const st=this.earth(await this.raw());m.setStyle(st,{transformStyle:(p,n)=>this.carry(p,n)});
    m.once('styledata',()=>{CL.attach(m);try{m.setPaintProperty('tw-cty-line','line-color',this.dark()?'#e8d6b8':'#7a5c3e')}catch(e){}})},
  set3D(m,on,opt={}){
    try{m.setTerrain(on?{source:'dem',exaggeration:1.5}:null)}catch(e){}
    try{m.setSky&&m.setSky(on?{'sky-color':this.dark()?'#1b2230':'#bcd3e0','horizon-color':this.dark()?'#3a2f24':'#efe5d3','fog-color':this.dark()?'#2a231b':'#efe5d3','sky-horizon-blend':.5,'horizon-fog-blend':.6,'fog-ground-blend':.4}:{})}catch(e){}
    m.easeTo({pitch:on?(opt.pitch||62):0,bearing:on?(opt.bearing??-18):0,duration:900});
    m._3d=on;WX3.vis(m);
  }
};

/* 簡易 HTML 標記 */
function glMarker(m,lat,lon,html,cls='',popup){const el=document.createElement('div');el.className=cls;el.innerHTML=html;const mk=new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([lon,lat]);if(popup)mk.setPopup(new maplibregl.Popup({offset:12,maxWidth:'260px'}).setHTML(popup));mk.addTo(m);return mk}
