import json,os
W='/home/claude/wx/web/'
t=open(W+'template.html',encoding='utf8').read()
js=''.join(open(W+f,encoding='utf8').read()+'\n' for f in ['core.js','data.js','home.js','places.js','gl.js','sky.js','map.js','typhoon.js','alerts.js','area.js','update.js','settings.js'])
VER=os.environ.get('VER') or open('/home/claude/wx/VERSION').read().split()[0]
js=js.replace("__APP_VER__",VER)
rep={'/*@@GL_CSS@@*/':open(W+'maplibre-gl.css').read(),'/*@@APP_CSS@@*/':open(W+'app.css',encoding='utf8').read(),
 '/*@@GL_JS@@*/':open(W+'maplibre-gl.js').read(),'/*@@TOPO_JS@@*/':open(W+'topojson-client.min.js').read(),
 '/*@@TW_TOPO@@*/':open(W+'tw.topo.json').read(),'/*@@APP_JS@@*/':js}
VER=os.environ.get('VER') or open('/home/claude/wx/VERSION').read().split()[0]
CODE=int(os.environ.get('CODE') or 0); MINAPK=int(os.environ.get('MINAPK') or CODE)
for k,v in rep.items(): t=t.replace(k,v.replace('</script','<\\/script'))
os.makedirs('/home/claude/wx/dist',exist_ok=True)
open('/home/claude/wx/dist/台灣即時天氣預報.html','w',encoding='utf8').write(t)
# GitHub Pages 用：index.html ＋ version.json（線上更新讀這兩個）
G='/home/claude/wx/dist/gh/';os.makedirs(G,exist_ok=True)
open(G+'index.html','w',encoding='utf8').write(t)
json.dump({'app':VER,'apk':CODE,'apkName':VER,'minApk':MINAPK,'notes':os.environ.get('NOTES','')},open(G+'version.json','w',encoding='utf8'),ensure_ascii=False)
print(len(t))
