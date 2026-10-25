# 把建置結果同步到 GitHub 儲存庫 IanLin1120/taiwan-weather（GitHub Pages 讀這些檔案做線上更新）
import json,os,shutil,datetime,subprocess,sys
R='/home/claude/taiwan-weather/';D='/home/claude/wx/dist/'
v=json.load(open(D+'gh/version.json',encoding='utf8'))
shutil.copy(D+'gh/index.html',R+'index.html');shutil.copy(D+'gh/version.json',R+'version.json')
open(R+'.nojekyll','w').close()
os.makedirs(R+'apk',exist_ok=True)
apk=f"台灣即時天氣預報_v{v['apkName']}.apk"
if os.path.exists(D+apk) and not os.path.exists(R+'apk/'+apk): shutil.copy(D+apk,R+'apk/'+apk)
lst=json.load(open(R+'apks.json',encoding='utf8')) if os.path.exists(R+'apks.json') else []
if not any(x['file']==apk for x in lst):
    lst.insert(0,{'v':v['apkName'],'code':v['apk'],'file':apk,'size':os.path.getsize(R+'apk/'+apk),'date':datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat(timespec='minutes'),'notes':v.get('notes','')})
json.dump(lst,open(R+'apks.json','w',encoding='utf8'),ensure_ascii=False,indent=1)
# 原始碼（不含簽章金鑰）
for d in ['web','android/src','android/res']:
    shutil.rmtree(R+'src/'+d,ignore_errors=True);shutil.copytree('/home/claude/wx/'+d,R+'src/'+d,ignore=shutil.ignore_patterns('__pycache__'))
for f in ['build.py','VERSION','publish.py','android/AndroidManifest.xml','android/build.sh']:
    os.makedirs(os.path.dirname(R+'src/'+f) or R+'src',exist_ok=True);shutil.copy('/home/claude/wx/'+f,R+'src/'+f)
print('synced',v['app'],apk)
