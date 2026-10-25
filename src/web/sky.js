/* ================= 自然雲層渲染器（MapLibre 自訂 WebGL 圖層） =================
   - 雲：一朵朵柔軟的積雲貼圖（程式產生），面向鏡頭，由遠到近疊畫，2D 從上看像衛星雲圖、3D 從側面看像雲海
   - 雨：雲底落下的雨絲動畫
   - 閃電：從雲底打到地面的鋸齒光束（含光暈、隨機閃爍）
   - 颱風：螺旋雲帶，逆時針旋轉 */
const CL={
  MZ:null,
  scene(m){return m._cl||(m._cl={puffs:[],rain:[],bolts:[],storm:null,dirty:true})},
  attach(m){
    if(m.getLayer('wx-cl'))return;
    const self=this;
    const layer={id:'wx-cl',type:'custom',renderingMode:'3d',
      onAdd(map,gl){self.init(map,gl)},
      render(gl,matrix){self.render(m,gl,matrix)}};
    try{m.addLayer(layer)}catch(e){console.warn(e)}
  },
  ex(z){const S=[[5,8],[7,4.2],[9,2.2],[12,1.1],[16,1]];if(z<=S[0][0])return S[0][1];for(let i=1;i<S.length;i++)if(z<=S[i][0]){const a=S[i-1],b=S[i],t=(z-a[0])/(b[0]-a[0]);return a[1]*Math.pow(b[1]/a[1],t)}return 1},
  /* ---------- 雲朵貼圖：4 種形狀 ---------- */
  atlas(){
    const N=256,cv=document.createElement('canvas');cv.width=cv.height=N*2;const x=cv.getContext('2d');
    let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
    for(let v=0;v<4;v++){const ox=(v%2)*N,oy=(v>>1)*N;x.save();x.beginPath();x.rect(ox,oy,N,N);x.clip();
      const cx=ox+N/2,cy=oy+N*.56;const n=14+v*3;
      for(let i=0;i<n;i++){const a=rnd()*Math.PI*2,d=Math.pow(rnd(),.7)*N*.24,r=N*(.13+rnd()*.14)*(i<4?1.25:1);
        const px=cx+Math.cos(a)*d*1.25,py=cy+Math.sin(a)*d*.7-(rnd()*N*.1);
        const g=x.createRadialGradient(px,py-r*.25,r*.1,px,py,r);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.55,'rgba(250,250,252,.9)');g.addColorStop(1,'rgba(245,246,250,0)');
        x.fillStyle=g;x.beginPath();x.arc(px,py,r,0,7);x.fill()}
      // 底部陰影（積雲底部較暗）、頂部受光
      x.globalCompositeOperation='source-atop';
      const sh=x.createLinearGradient(0,oy+N*.25,0,oy+N*.85);sh.addColorStop(0,'rgba(255,255,255,0)');sh.addColorStop(.6,'rgba(170,182,200,.18)');sh.addColorStop(1,'rgba(128,142,165,.38)');
      x.fillStyle=sh;x.fillRect(ox,oy,N,N);
      for(let i=0;i<260;i++){x.fillStyle=`rgba(${rnd()<.5?255:150},${rnd()<.5?255:160},${rnd()<.5?255:175},.06)`;const r=2+rnd()*7;x.beginPath();x.arc(ox+rnd()*N,oy+rnd()*N,r,0,7);x.fill()}
      x.restore();x.globalCompositeOperation='source-over'}
    return cv;
  },
  sh(gl,vs,fs){const c=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))console.warn(gl.getShaderInfoLog(o));return o};
    const p=gl.createProgram();gl.attachShader(p,c(gl.VERTEX_SHADER,vs));gl.attachShader(p,c(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);return p},
  init(m,gl){
    const S=this.scene(m);
    this.MZ=maplibregl.MercatorCoordinate.fromLngLat([121,23.6],1).z;
    S.pp=this.sh(gl,`attribute vec3 a_pos;attribute vec2 a_cn;attribute vec4 a_p;uniform mat4 u_m;uniform float u_mz,u_ex,u_asp;varying vec2 v_uv;varying float v_s,v_a;
      void main(){vec4 c=u_m*vec4(a_pos.xy,a_pos.z*u_mz*u_ex,1.0);float s=length(vec2(u_m[0][0],u_m[0][1]));float r=a_p.x*u_mz;
      c.x+=a_cn.x*r*s;c.y+=a_cn.y*r*s*u_asp;gl_Position=c;float v=a_p.w;v_uv=(vec2(mod(v,2.0),floor(v/2.0))+(a_cn*vec2(.5,-.5)+.5))*.5;v_s=a_p.y;v_a=a_p.z;}`,
      `precision mediump float;uniform sampler2D u_tex;uniform vec3 u_tint;varying vec2 v_uv;varying float v_s,v_a;
      void main(){vec4 t=texture2D(u_tex,v_uv);float a=t.a*v_a;vec3 col=t.rgb*v_s*u_tint;gl_FragColor=vec4(col*a,a);}`);
    S.lp=this.sh(gl,`attribute vec3 a_a;attribute vec3 a_b;attribute vec2 a_s;attribute vec4 a_c;attribute vec2 a_an;uniform mat4 u_m;uniform float u_mz,u_ex,u_t,u_w;uniform vec2 u_vp;varying vec4 v_c;varying float v_e;
      void main(){vec3 A=a_a,B=a_b;if(a_an.y>0.0){float f=fract(a_an.x+u_t*a_an.y);float top=a_a.z;float z1=top*(1.0-f);A=vec3(a_a.xy,z1);B=vec3(a_a.xy+vec2(-.000006,0.0),max(0.0,z1-top*.16));}
      vec4 pa=u_m*vec4(A.xy,A.z*u_mz*u_ex,1.0),pb=u_m*vec4(B.xy,B.z*u_mz*u_ex,1.0);vec2 d=(pb.xy/pb.w-pa.xy/pa.w)*u_vp;float l=length(d);d=l<1e-4?vec2(0.0,1.0):d/l;vec2 n=vec2(-d.y,d.x);
      vec4 p=a_s.x<0.5?pa:pb;p.xy+=n*a_s.y*u_w/u_vp*2.0*p.w;gl_Position=p;v_c=a_c;v_e=a_s.y;}`,
      `precision mediump float;uniform float u_al;varying vec4 v_c;varying float v_e;void main(){float k=1.0-abs(v_e);k=smoothstep(0.0,0.9,k+.15);float a=v_c.a*u_al*k;gl_FragColor=vec4(v_c.rgb*a,a);}`);
    S.tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,S.tex);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.atlas());
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    S.pb=gl.createBuffer();S.rb=gl.createBuffer();S.bb=gl.createBuffer();S.dirty=true;S.t0=performance.now();
  },
  set(m,{puffs=[],rain=[],bolts=[],storm=null}={}){
    const S=this.scene(m);
    S.puffs=puffs.map(p=>{const c=maplibregl.MercatorCoordinate.fromLngLat([p.lon,p.lat]);return {x:c.x,y:c.y,z:p.alt,r:p.r,s:p.s??1,a:p.a??.9,v:p.v??((Math.abs(p.lon*97+p.lat*131)|0)%4)}});
    S.rainN=0;const R=[];
    for(const c of rain){const n=c.n||6;for(let i=0;i<n;i++){const lon=c.lon+(Math.random()-.5)*c.d,lat=c.lat+(Math.random()-.5)*c.d;const q=maplibregl.MercatorCoordinate.fromLngLat([lon,lat]);R.push([q.x,q.y,c.top,Math.random(),.55+Math.random()*.5,c.col])}}
    S.rainArr=this.buildRain(R);
    S.boltArr=this.buildBolts(bolts);
    S.storm=storm?{...storm,c:maplibregl.MercatorCoordinate.fromLngLat([storm.lon,storm.lat]),a:0,t:performance.now()}:null;
    if(S.storm)S.stormPuffs=this.stormPuffs(storm);
    S.dirty=true;m.triggerRepaint();
  },
  clear(m){this.set(m,{})},
  quad(cb){for(const [sx,sy] of [[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]])cb(sx,sy)},
  buildRain(R){const F=15,a=new Float32Array(R.length*6*F);let o=0;
    for(const r of R){const col=r[5]||[.55,.7,.85,.55];for(const [e,sd] of [[0,-1],[1,-1],[1,1],[0,-1],[1,1],[0,1]]){a.set([r[0],r[1],r[2],0,0,0,e,sd,col[0],col[1],col[2],col[3],r[3],.9*r[4],0],o);o+=F}}
    return a},
  buildBolts(B){const F=15,segs=[];
    for(const b of B){let s=Math.abs(Math.sin(b.seed||b.lon*b.lat))*1e4;const rnd=()=>{s=(s*9301+49297)%233280;return s/233280-.5};
      const top=b.top||4500,N=8;let lon=b.lon,lat=b.lat,z=top;const pts=[];
      for(let i=0;i<=N;i++){pts.push(maplibregl.MercatorCoordinate.fromLngLat([lon,lat]));pts[i].alt=z;z=top*(1-(i+1)/N);lon+=rnd()*.022;lat+=rnd()*.022}
      for(let i=0;i<N;i++)segs.push([pts[i],pts[i+1]]);
      // 分岔
      const k=2+((s|0)%3);if(k<N){let bl=lon,bt=lat;const p0=pts[k];const q=maplibregl.MercatorCoordinate.fromLngLat([b.lon+rnd()*.05,b.lat+rnd()*.05]);q.alt=p0.alt*.45;segs.push([p0,q])}}
    const a=new Float32Array(segs.length*6*F);let o=0;
    for(const [p,q] of segs)for(const [e,sd] of [[0,-1],[1,-1],[1,1],[0,-1],[1,1],[0,1]]){a.set([p.x,p.y,p.alt,q.x,q.y,q.alt,e,sd,1,.97,.75,1,0,0,0],o);o+=F}
    return a},
  /* 颱風螺旋雲帶（極座標，渲染時旋轉） */
  /* 颱風移動：只換中心，旋轉不重來（動畫順暢）；半徑變很多才重建雲團 */
  moveStorm(m,st){const S=this.scene(m);const o=S.storm;
    if(!o||Math.abs(o.r-st.r)/o.r>.2){this.set(m,{storm:st});return}
    o.lat=st.lat;o.lon=st.lon;o.c=maplibregl.MercatorCoordinate.fromLngLat([st.lon,st.lat]);m.triggerRepaint()},
  stormPuffs(st){const P=[],R=st.r*1000;let seed=3;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
    // 眼牆
    for(let i=0;i<36;i++){const a=i/36*Math.PI*2,r=R*(.12+rnd()*.05);for(let h=0;h<3;h++)P.push({r,a,alt:2500+h*3200+rnd()*800,rad:R*.07*(1.1-h*.15),s:.95-h*.03})}
    // 中心密雲區
    for(let i=0;i<120;i++){const r=R*(.16+Math.pow(rnd(),.8)*.38),a=rnd()*Math.PI*2;P.push({r,a,alt:3000+rnd()*4000*(1-r/R),rad:R*(.09+rnd()*.05),s:.9+rnd()*.1})}
    for(let k=0;k<4;k++)for(let i=0;i<120;i++){const t=i/120,r=R*(.25+.95*t),a=k*Math.PI/2+t*Math.PI*1.8+(rnd()-.5)*.22,w=(1-t)*.7+.3;
      P.push({r:r+(rnd()-.5)*R*.12*w,a,alt:2200+rnd()*3800*(1.2-t),rad:R*(.11*w+.04),s:.84+rnd()*.16,al:.95-t*.35})}
    for(let i=0;i<120;i++){const r=R*(.4+rnd()*1.1),a=rnd()*Math.PI*2;P.push({r,a,alt:1800+rnd()*1500,rad:R*.06,s:.95,al:.45})}
    return P},
  sortPuffs(S,M){const L=S.puffs.concat(S.stormLive||[]);
    for(const p of L)p.w=M[3]*p.x+M[7]*p.y+M[11]*(p.z*this.MZ*S.ex)+M[15];
    L.sort((a,b)=>b.w-a.w);
    const F=9,a=new Float32Array(L.length*6*F);let o=0;
    for(const p of L)this.quad((sx,sy)=>{a[o++]=p.x;a[o++]=p.y;a[o++]=p.z;a[o++]=sx;a[o++]=sy;a[o++]=p.r;a[o++]=p.s;a[o++]=p.a;a[o++]=p.v});
    S.pArr=a;S.pN=L.length*6},
  render(m,gl,M){
    const S=this.scene(m);if(!S.pp)return;
    const now=performance.now(),z=m.getZoom();S.ex=this.ex(z);
    const dark=document.documentElement.dataset.theme==='dark';
    // 颱風旋轉
    if(S.storm){const st=S.storm;const dt=(now-st.t)/1000;
      S.stormLive=S.stormPuffs.map((p,i)=>{const a=p.a+dt*.12*(1.6-p.r/(st.r*1000));const dx=Math.cos(a)*p.r,dy=Math.sin(a)*p.r;const k=this.MZ;
        return {x:st.c.x+dx*k,y:st.c.y-dy*k,z:p.alt,r:p.rad,s:p.s,a:p.al||.92,v:i%4}})}else S.stormLive=null;
    const key=M.join(',').slice(0,200)+S.ex;
    if(S.dirty||key!==S.key||S.storm){this.sortPuffs(S,M);S.key=key;S.dirty=false}
    gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.disable(gl.DEPTH_TEST);gl.depthMask(false);
    const vp=[gl.drawingBufferWidth,gl.drawingBufferHeight],t=(now-S.t0)/1000;
    // 雨絲（只在 3D 視角）
    if(m._3d&&S.rainArr&&S.rainArr.length){this.lines(gl,S,M,S.rb,S.rainArr,{w:1.1*devicePixelRatio,al:1,t,vp})}
    // 雲
    if(S.pN){const p=S.pp;gl.useProgram(p);gl.bindBuffer(gl.ARRAY_BUFFER,S.pb);gl.bufferData(gl.ARRAY_BUFFER,S.pArr,gl.DYNAMIC_DRAW);
      const at=(n,sz,off)=>{const l=gl.getAttribLocation(p,n);gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,sz,gl.FLOAT,false,36,off*4);return l};
      const ls=[at('a_pos',3,0),at('a_cn',2,3),at('a_p',4,5)];
      gl.uniformMatrix4fv(gl.getUniformLocation(p,'u_m'),false,M);gl.uniform1f(gl.getUniformLocation(p,'u_mz'),this.MZ);gl.uniform1f(gl.getUniformLocation(p,'u_ex'),S.ex);gl.uniform1f(gl.getUniformLocation(p,'u_asp'),vp[0]/vp[1]);
      gl.uniform3fv(gl.getUniformLocation(p,'u_tint'),dark?[.62,.64,.72]:[1,1,1]);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,S.tex);gl.uniform1i(gl.getUniformLocation(p,'u_tex'),0);
      gl.drawArrays(gl.TRIANGLES,0,S.pN);ls.forEach(l=>gl.disableVertexAttribArray(l))}
    // 閃電（隨機閃爍：光暈＋核心）
    if(S.boltArr&&S.boltArr.length){if(!S.fl||now>S.flNext){S.fl=Math.random()<.4;S.flNext=now+(S.fl?70+Math.random()*90:120+Math.random()*500)}
      if(S.fl){this.lines(gl,S,M,S.bb,S.boltArr,{w:9*devicePixelRatio,al:.28,t,vp});this.lines(gl,S,M,S.bb,S.boltArr,{w:2.2*devicePixelRatio,al:1,t,vp,same:true})}
      try{m.setPaintProperty('wx-glow-l','circle-opacity',S.fl?.8:0)}catch(e){}}
    if((m._3d&&S.rainArr&&S.rainArr.length)||(S.boltArr&&S.boltArr.length)||S.storm){if(m.getContainer().offsetParent)m.triggerRepaint()}
  },
  lines(gl,S,M,buf,arr,{w,al,t,vp,same}){const p=S.lp;gl.useProgram(p);gl.bindBuffer(gl.ARRAY_BUFFER,buf);if(!same)gl.bufferData(gl.ARRAY_BUFFER,arr,gl.DYNAMIC_DRAW);
    const at=(n,sz,off)=>{const l=gl.getAttribLocation(p,n);gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,sz,gl.FLOAT,false,60,off*4);return l};
    const ls=[at('a_a',3,0),at('a_b',3,3),at('a_s',2,6),at('a_c',4,8),at('a_an',2,12)];
    gl.uniformMatrix4fv(gl.getUniformLocation(p,'u_m'),false,M);gl.uniform1f(gl.getUniformLocation(p,'u_mz'),this.MZ);gl.uniform1f(gl.getUniformLocation(p,'u_ex'),S.ex);
    gl.uniform1f(gl.getUniformLocation(p,'u_t'),t);gl.uniform1f(gl.getUniformLocation(p,'u_w'),w);gl.uniform2fv(gl.getUniformLocation(p,'u_vp'),vp);gl.uniform1f(gl.getUniformLocation(p,'u_al'),al);
    gl.drawArrays(gl.TRIANGLES,0,arr.length/15);ls.forEach(l=>gl.disableVertexAttribArray(l))}
};

/* ================= 氣象場景（給圖層頁、區域頁共用） ================= */
const WX3={
  CB:1800,
  ensure(m){
    const fc={type:'FeatureCollection',features:[]};
    for(const id of ['wx-glow','wx-track','wx-trackf','wx-circ'])if(!m.getSource(id))m.addSource(id,{type:'geojson',data:fc});
    const add=l=>{if(!m.getLayer(l.id))m.addLayer(l)};
    add({id:'wx-circ-l',type:'fill',source:'wx-circ',paint:{'fill-color':'#e0893a','fill-opacity':.1,'fill-outline-color':'#c0562b'}});
    add({id:'wx-track-l',type:'line',source:'wx-track',paint:{'line-color':'#5a4632','line-width':3}});
    add({id:'wx-trackf-l',type:'line',source:'wx-trackf',paint:{'line-color':'#c0562b','line-width':3,'line-dasharray':[2,2]}});
    add({id:'wx-glow-l',type:'circle',source:'wx-glow',paint:{'circle-color':'#fff4b8','circle-radius':['interpolate',['linear'],['zoom'],6,10,12,46],'circle-blur':1,'circle-opacity':0}});
    CL.attach(m);
    m.on('zoomend',()=>{const z=m.getZoom();const c=this.cellFor(z);if(m._sceneFn&&c!==m._sceneCell){m._sceneFn()}});
    m.on('moveend',()=>{if(m._sceneFn&&m._sceneB){const b=m.getBounds();const o=m._sceneB;if(b.getWest()<o[0]||b.getSouth()<o[1]||b.getEast()>o[2]||b.getNorth()>o[3])m._sceneFn()}});
  },
  set(m,id,features){const s=m.getSource(id);if(s)s.setData({type:'FeatureCollection',features:features||[]})},
  clear(m){m._sceneFn=null;CL.clear(m);for(const id of ['wx-glow','wx-track','wx-trackf','wx-circ'])this.set(m,id,[]);try{m.setPaintProperty('wx-glow-l','circle-opacity',0)}catch(e){}},
  vis(m){if(m.getLayer('wx-img-l'))m.setPaintProperty('wx-img-l','raster-opacity',m._3d&&m._imgFaint?.45:.92);if(m._sceneFn)m._sceneFn();m.triggerRepaint()},
  cellFor(z){return z<6.5?0.12:z<7.6?0.08:z<8.6?0.05:z<9.6?0.03:z<10.8?0.018:0.011},
  view(m){const b=m.getBounds();const pad=1.2;return [b.getWest()-pad,b.getSouth()-pad,b.getEast()+pad,b.getNorth()+pad]},
  /* 平面圖（2D 主圖、3D 時當地面投影） */
  image(m,cv,bounds,faint3d){
    const [[s,w],[n,e]]=bounds,coords=[[w,n],[e,n],[e,s],[w,s]],url=cv.toDataURL();const src=m.getSource('wx-img');
    if(src){m._imgNext={url,coordinates:coords};if(!m._imgBusy)this._pump(m)}
    else{m._imgBusy=true;const done=e=>{if(e.sourceId==='wx-img'&&e.isSourceLoaded!==false){m.off('sourcedata',done);m._imgBusy=false;this._pump(m)}};m.on('sourcedata',done);setTimeout(()=>{if(m._imgBusy){m.off('sourcedata',done);m._imgBusy=false;this._pump(m)}},1500);
      m.addSource('wx-img',{type:'image',url,coordinates:coords});m.addLayer({id:'wx-img-l',type:'raster',source:'wx-img',paint:{'raster-opacity':.92,'raster-fade-duration':0,'raster-resampling':'linear'}},GL.firstSymbol(m)||(m.getLayer('wx-circ-l')?'wx-circ-l':undefined))}
    m._imgFaint=!!faint3d;if(m.getLayer('wx-img-l'))m.setPaintProperty('wx-img-l','raster-opacity',m._3d&&faint3d?.45:.92);
  },
  _pump(m){const nx=m._imgNext;if(!nx)return;m._imgNext=null;const src=m.getSource('wx-img');if(!src)return;m._imgBusy=true;
    const done=e=>{if(e.sourceId==='wx-img'&&e.isSourceLoaded!==false){m.off('sourcedata',done);m._imgBusy=false;this._pump(m)}};
    m.on('sourcedata',done);setTimeout(()=>{if(m._imgBusy){m.off('sourcedata',done);m._imgBusy=false;this._pump(m)}},1500);
    try{src.updateImage(nx)}catch(e){m._imgBusy=false}},
  noImage(m){m._imgNext=null;m._imgBusy=false;if(m.getLayer('wx-img-l'))m.removeLayer('wx-img-l');if(m.getSource('wx-img'))m.removeSource('wx-img')},
  RCOL:[null,[.75,.82,.9,.4],[.45,.66,.88,.55],[.35,.58,.85,.65],[.3,.5,.82,.75],[.28,.42,.78,.8],[.3,.35,.72,.85]],
  /* 雷達回波 → 雲朵＋雨絲 */
  fromFrame(m,f){
    const run=()=>{
      const z=m.getZoom(),cell=this.cellFor(z),vb=this.view(m);m._sceneCell=cell;m._sceneB=vb;
      const B=f.B,W=f.w,H=f.h,step=(B.e-B.w)/W,k=Math.max(1,Math.round(cell/step)),nx=Math.ceil(W/k),ny=Math.ceil(H/k);
      const x0=Math.max(0,Math.floor((vb[0]-B.w)/step)),x1=Math.min(W,Math.ceil((vb[2]-B.w)/step)),y0=Math.max(0,Math.floor((B.n-vb[3])/step)),y1=Math.min(H,Math.ceil((B.n-vb[1])/step));
      const mx=new Uint8Array(nx*ny),sum=new Float32Array(nx*ny);
      for(let y=y0;y<y1;y++){const cy=(y/k)|0;for(let x=x0;x<x1;x++){const v=f.lv[y*W+x];if(v){const i=cy*nx+((x/k)|0);if(v>mx[i])mx[i]=v;sum[i]+=v}}}
      const puffs=[],rain=[],dc=k*step,kk=k*k,R=dc*111e3,three=!!m._3d;let seed=1;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
      for(let cy=0;cy<ny;cy++)for(let cx=0;cx<nx;cx++){const i=cy*nx+cx,v=mx[i];if(!v)continue;
        const cov=Math.min(1,sum[i]/kk/Math.max(1,v)*1.6);const lon=B.w+(cx+.5)*dc,lat=B.n-(cy+.5)*dc;
        if(!three&&v>=2)continue;           // 2D：有雨的格子讓底下的彩色雨區露出
        const q=v+cov,layers=three?1+Math.floor(q/2.2):1;
        for(let h=0;h<layers;h++){const top=h===layers-1;
          puffs.push({lon:lon+(rnd()-.5)*dc*.5,lat:lat+(rnd()-.5)*dc*.5,alt:this.CB+h*1500+rnd()*500+(top&&v>=5?1500:0),r:R*(.62+cov*.35+rnd()*.15)*(top&&v>=5?1.25:1),
            s:three?[1,1,.93,.84,.76,.68,.6][v]+(top?.06:0):(.98),a:three?.92:(.35+cov*.4)})}
        if(three&&v>=2)rain.push({lon,lat,d:dc,top:this.CB,n:Math.min(14,2+v*2),col:this.RCOL[v]});
      }
      if(puffs.length>5000)puffs.length=5000;
      CL.set(m,{puffs,rain});
    };
    m._sceneFn=run;run();
  },
  /* 模式格點 → 雲量／雨／雷雨雲塔 */
  fromGrid(m,G,ti,kind,bolts){
    const run=()=>{
      const z=m.getZoom(),cell=Math.max(0.05,this.cellFor(z)),vb=this.view(m);m._sceneCell=this.cellFor(z);m._sceneB=vb;const three=!!m._3d;
      const V=G.v,puffs=[],rain=[],bl=[];const R=cell*111e3;let seed=5;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
      const la0=Math.max(G.lats[0],vb[1]),la1=Math.min(G.lats[G.ny-1],vb[3]),lo0=Math.max(G.lons[0],vb[0]),lo1=Math.min(G.lons[G.nx-1],vb[2]);
      for(let lat=la0;lat<=la1;lat+=cell)for(let lon=lo0;lon<=lo1;lon+=cell){
        const pr=gridSample(G,V.precipitation[ti],lat,lon),cc=gridSample(G,V.cloud_cover[ti],lat,lon);
        if(isNaN(cc))continue;const jl=(rnd()-.5)*cell*.6,jo=(rnd()-.5)*cell*.6;
        if(kind==='cloud'){const ed=Math.min(1,Math.min(lat-G.lats[0],G.lats[G.ny-1]-lat,lon-G.lons[0],G.lons[G.nx-1]-lon)/.45);if(cc>=20&&rnd()*100<(cc+15)*ed)puffs.push({lon:lon+jo,lat:lat+jl,alt:2000+rnd()*1600+cc*8,r:R*(.55+cc/100*.5)*(.7+.3*ed),s:1-(cc>85?.08:0),a:(three?.9:.4+cc/100*.5)*(.4+.6*ed)})}
        if(kind==='rain'&&pr>=0.2){const lv=pr<1?2:pr<5?3:pr<15?4:pr<30?5:6;
          if(three){for(let h=0;h<1+Math.floor(lv/2.5);h++)puffs.push({lon:lon+jo,lat:lat+jl,alt:this.CB+h*1400+rnd()*400,r:R*(.7+rnd()*.2),s:[1,1,.93,.84,.76,.68,.6][lv],a:.92});
            rain.push({lon,lat,d:cell,top:this.CB,n:Math.min(14,2+lv*2),col:this.RCOL[lv]})}
          else if(pr<1)puffs.push({lon:lon+jo,lat:lat+jl,alt:this.CB,r:R*.7,s:.98,a:.45})}
        if(kind==='thunder'){const code=gridSample(G,V.weather_code[ti],lat,lon),cape=gridSample(G,V.cape[ti],lat,lon)||0,pop=(gridSample(G,V.precipitation_probability[ti],lat,lon)||0)/100;
          const idx=Math.max(code>=94?.75+.25*pop:0,Math.min(1,cape/3000)*Math.max(.3,pop));
          if(idx>=.3){const n=three?2+Math.round(idx*5):1;
            for(let h=0;h<n;h++){const top=h===n-1;puffs.push({lon:lon+jo*(top?1.6:1),lat:lat+jl,alt:1200+h*2000+rnd()*600,r:R*(top&&idx>.6?1.15:.72),s:top?.92:.58+h*.07,a:three?.94:.55})}
            if(three&&pr>=.3)rain.push({lon,lat,d:cell,top:1200,n:Math.min(14,4+pr*2|0),col:this.RCOL[4]});
            if(idx>=.6&&rnd()>.55)bl.push({lat:lat+jl,lon:lon+jo,top:1200+idx*2600,seed:lat*1000+lon})}}
      }
      if(bolts)bl.push(...bolts);
      if(puffs.length>5000)puffs.length=5000;
      CL.set(m,{puffs,rain,bolts:bl});this.set(m,'wx-glow',bl.map(b=>({type:'Feature',properties:{},geometry:{type:'Point',coordinates:[b.lon,b.lat]}})));
    };
    m._sceneFn=run;run();
  },
  storm(m,lat,lon,rKm){m._sceneFn=null;CL.set(m,{storm:{lat,lon,r:Math.max(rKm||200,120)}})},
  moveStorm(m,lat,lon,rKm){m._sceneFn=null;CL.moveStorm(m,{lat,lon,r:Math.max(rKm||200,120)})},
  circle(lat,lon,km,n=64){const kx=1/(111.32*Math.cos(lat*Math.PI/180)),ky=1/110.57,c=[];for(let i=0;i<=n;i++){const a=i/n*Math.PI*2;c.push([lon+km*Math.cos(a)*kx,lat+km*Math.sin(a)*ky])}return {type:'Polygon',coordinates:[c]}}
};

/* ================= 2D 雨區樣式：平滑色塊＋柔光邊＋斜雨紋 ================= */
function stylizeRain(src){
  const W=src.width,H=src.height,cv=document.createElement('canvas');cv.width=W;cv.height=H;const x=cv.getContext('2d');
  const s=W/600;
  x.filter=`blur(${Math.max(2,7*s)}px)`;x.globalAlpha=.55;x.drawImage(src,0,0);
  x.filter=`blur(${Math.max(.6,1.4*s)}px)`;x.globalAlpha=1;x.drawImage(src,0,0);x.filter='none';
  // 斜雨紋
  const p=document.createElement('canvas');const ps=Math.max(8,Math.round(14*s));p.width=p.height=ps;const px=p.getContext('2d');
  px.strokeStyle='rgba(255,255,255,.55)';px.lineWidth=Math.max(1,1.4*s);px.beginPath();px.moveTo(ps*.25,0);px.lineTo(0,ps*.55);px.moveTo(ps,ps*.4);px.lineTo(ps*.7,ps);px.stroke();
  x.globalCompositeOperation='source-atop';x.fillStyle=x.createPattern(p,'repeat');x.fillRect(0,0,W,H);
  // 邊緣深色描線
  x.globalCompositeOperation='destination-over';x.filter=`blur(${Math.max(1,2.5*s)}px)`;x.globalAlpha=.35;x.drawImage(src,0,0);x.filter='none';x.globalAlpha=1;x.globalCompositeOperation='source-over';
  return cv;
}
/* 2D 雲影：雲朵下方投在地面的柔和陰影，讓雲層更立體明顯 */
function cloudShadow(G,arr,W=300,H=420){
  const {cv,bounds}=fieldCanvas(G,arr,v=>v<25?null:[70,62,52,Math.min(120,(v-25)*1.6)],false,W,H);
  const o=document.createElement('canvas');o.width=W;o.height=H;const x=o.getContext('2d');x.filter='blur(5px)';x.drawImage(cv,6,8);return {cv:o,bounds};
}
