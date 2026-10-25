"""
歷年颱風資料（給 App 的「📅 歷年颱風」用）
- 颱風清單、中文名、編號、生命期、最低氣壓、最大風速、暴風半徑、警報報數：中央氣象署颱風資料庫（rdc28.cwa.gov.tw/TDB）
- 路徑：IBTrACS（NOAA，彙整日本氣象廳 RSMC 東京等官方最佳路徑；當年資料為暫定值）
輸出：data/typhoon/index.json、data/typhoon/<年>.json
"""
import csv, io, json, os, re, sys, time, urllib.request, http.cookiejar, datetime

OUT = 'data/typhoon/'
B = 'https://rdc28.cwa.gov.tw/TDB/'
UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36'
IB = 'https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/ibtracs.WP.list.v04r01.csv'

def cwa_list():
    cj = http.cookiejar.CookieJar()
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    op.addheaders = [('User-Agent', UA)]
    op.open(B + 'public/typhoon_list/', timeout=60).read()
    rq = urllib.request.Request(B + 'public/typhoon_list/get_typhoon', data=b'year=all',
                                headers={'X-Requested-With': 'XMLHttpRequest', 'Referer': B + 'public/typhoon_list/',
                                         'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'})
    raw = op.open(rq, timeout=120).read().decode('utf-8-sig')
    return json.loads(raw)

def num(x):
    try:
        v = float(x); return None if v != v else v
    except Exception:
        return None

def norm(n):
    return re.sub(r'[^A-Z]', '', (n or '').upper())

def ibtracs():
    print('下載 IBTrACS…', flush=True)
    data = urllib.request.urlopen(urllib.request.Request(IB, headers={'User-Agent': UA}), timeout=600).read().decode('utf-8', 'replace')
    rd = csv.reader(io.StringIO(data))
    head = next(rd); next(rd)
    ix = {k: i for i, k in enumerate(head)}
    S = {}
    for r in rd:
        try:
            season = int(r[ix['SEASON']])
        except Exception:
            continue
        if season < 1958 or r[ix['TRACK_TYPE']] != 'main':
            continue
        sid = r[ix['SID']]
        t = r[ix['ISO_TIME']]
        hh = t[11:13]
        lat = num(r[ix['TOKYO_LAT']]) if r[ix['TOKYO_LAT']].strip() else num(r[ix['LAT']])
        lon = num(r[ix['TOKYO_LON']]) if r[ix['TOKYO_LON']].strip() else num(r[ix['LON']])
        if lat is None or lon is None:
            continue
        w = num(r[ix['TOKYO_WIND']]);
        if w is not None: w = round(w * 0.5144, 1)          # 10 分鐘平均（kt → m/s）
        else:
            u = num(r[ix['USA_WIND']]); w = round(u * 0.5144 * 0.88, 1) if u is not None else None   # 1 分鐘 → 約 10 分鐘
        p = num(r[ix['TOKYO_PRES']]) or num(r[ix['USA_PRES']]) or num(r[ix['WMO_PRES']])
        s = S.setdefault(sid, {'sid': sid, 'season': season, 'name': r[ix['NAME']], 'pts': []})
        s['pts'].append((t, hh, lat, lon, w, p))
    print('IBTrACS 颱風數', len(S), flush=True)
    return S

def main():
    os.makedirs(OUT, exist_ok=True)
    L = cwa_list()
    print('氣象署清單', len(L), flush=True)
    try:
        IBS = ibtracs()
    except Exception as e:
        print('IBTrACS 失敗', e); IBS = {}
    by = {}
    for s in IBS.values():
        by.setdefault((s['season'], norm(s['name'])), []).append(s)
    years = {}
    for x in L:
        tid = str(x.get('id', ''))
        y = int(tid[:4]) if tid[:4].isdigit() else None
        if not y:
            continue
        g = (x.get('genesis_datetime') or '').strip(); d = (x.get('dead_datetime') or '').strip()
        g = None if not g or g.startswith('0000') else g; d = None if not d or d.startswith('0000') else d
        en = (x.get('eng_name') or '').strip()
        item = {'id': tid, 'no': tid[4:], 'name': (x.get('cht_name') or '').strip() or en, 'en': en,
                'start': g, 'end': d, 'minP': num(x.get('min_pressure')), 'maxWind': num(x.get('max_intensity')),
                'gust': num(x.get('max_gust_speed')), 'r7': num(x.get('max_class7_radius')), 'r10': num(x.get('max_class10_radius')),
                'warn': int(num(x.get('warning_count')) or 0), 'track': []}
        # 對應 IBTrACS 路徑：同年同英文名；同名多個時取時間最接近生成時間的
        cand = by.get((y, norm(en)), []) + by.get((y - 1, norm(en)), [])
        best = None
        if cand:
            gt = g[:10] if g else None
            best = min(cand, key=lambda s: abs((datetime.date.fromisoformat(s['pts'][0][0][:10]) - datetime.date.fromisoformat(gt)).days) if gt else 0)
        if best:
            tr = [p for p in best['pts'] if p[1] in ('00', '06', '12', '18')] or best['pts']
            item['track'] = [[p[0][:16].replace(' ', 'T') + 'Z', round(p[2], 2), round(p[3], 2), p[4], p[5]] for p in tr]
        years.setdefault(y, []).append(item)
    idx = {'updated': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='minutes'), 'years': {}}
    for y, items in sorted(years.items()):
        items.sort(key=lambda i: i['id'], reverse=True)
        js = json.dumps({'year': y, 'storms': items}, ensure_ascii=False, separators=(',', ':'))
        old = open(OUT + f'{y}.json', encoding='utf8').read() if os.path.exists(OUT + f'{y}.json') else ''
        if js != old:
            open(OUT + f'{y}.json', 'w', encoding='utf8').write(js)
        idx['years'][y] = {'n': len(items), 'warned': sum(1 for i in items if i['warn']), 'tracks': sum(1 for i in items if i['track'])}
    json.dump(idx, open(OUT + 'index.json', 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
    print('完成', len(years), '年', flush=True)

if __name__ == '__main__':
    main()
