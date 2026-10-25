package com.ian.dadiweather;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.ConnectivityManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.PowerManager;

import org.json.JSONObject;

import java.io.File;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;
import java.util.TimeZone;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** 常駐的即時降雨監測：定時下載氣象署雷達回波，推算「幾分鐘後下雨」。 */
public class RainService extends Service {
    public static volatile boolean running = false;
    static final String S3 = "https://cwaopendata.s3.ap-northeast-1.amazonaws.com/Observation/O-A0058-003.png";
    static final int NID = 77;

    HandlerThread ht;
    Handler h;
    Nowcast.Frame prev, cur;
    long lastCheck = 0;
    LocationListener ll;

    public static void sync(Context c) {
        boolean on = Cfg.notif(c, "rain").optBoolean("on", false);
        Intent i = new Intent(c, RainService.class);
        try {
            if (on) { i.setAction("START"); c.startForegroundService(i); }
            else if (running) c.stopService(i);
        } catch (Exception e) { }
    }

    @Override
    public IBinder onBind(Intent i) { return null; }

    @Override
    public void onCreate() {
        super.onCreate();
        ht = new HandlerThread("rain");
        ht.start();
        h = new Handler(ht.getLooper());
        File d = getFilesDir();
        prev = Nowcast.load(new File(d, "radar_prev.bin"));
        cur = Nowcast.load(new File(d, "radar_cur.bin"));
        startLoc();
    }

    void fg(String text) {
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                int type = 0x40000000; // SPECIAL_USE
                if (Weather.hasLoc(this)) type |= 0x8; // LOCATION
                try { startForeground(NID, Notif.monitor(this, text), type); }
                catch (Exception e) { startForeground(NID, Notif.monitor(this, text), 0x40000000); }
            } else if (Build.VERSION.SDK_INT >= 29) {
                startForeground(NID, Notif.monitor(this, text), Weather.hasLoc(this) ? 0x8 : 0);
            } else startForeground(NID, Notif.monitor(this, text));
        } catch (Exception e) {
            try { startForeground(NID, Notif.monitor(this, text)); } catch (Exception e2) { }
        }
    }

    @Override
    public int onStartCommand(Intent i, int flags, int id) {
        if (!Cfg.notif(this, "rain").optBoolean("on", false)) { stopSelf(); return START_NOT_STICKY; }
        running = true;
        fg(statusText());
        h.removeCallbacks(loop);
        long iv = intervalMs();
        long wait = Math.max(0, lastCheck + iv - 60_000 - System.currentTimeMillis());
        h.postDelayed(loop, i != null && "START".equals(i.getAction()) ? 1500 : wait);
        return START_STICKY;
    }

    long intervalMs() { return Math.max(5, Cfg.notif(this, "rain").optInt("interval", 5)) * 60_000L; }

    final Runnable loop = new Runnable() {
        @Override public void run() {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            PowerManager.WakeLock wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "dadi:rain");
            wl.acquire(90_000);
            try { check(); } catch (Throwable t) { status("檢查失敗：" + t.getClass().getSimpleName()); }
            finally { try { wl.release(); } catch (Exception e) { } }
            long iv = intervalMs();
            h.postDelayed(this, iv);
            alarm(iv + 60_000);
        }
    };

    /** 萬一處於 Doze，用鬧鐘把服務叫醒 */
    void alarm(long delay) {
        AlarmManager am = (AlarmManager) getSystemService(ALARM_SERVICE);
        Intent i = new Intent(this, RainService.class).setAction("CHECK");
        PendingIntent p = PendingIntent.getForegroundService(this, 9, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        try { am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + delay, p); } catch (Exception e) { }
    }

    @SuppressWarnings("MissingPermission")
    void startLoc() {
        if (!Weather.hasLoc(this)) return;
        try {
            LocationManager lm = (LocationManager) getSystemService(LOCATION_SERVICE);
            ll = new LocationListener() {
                public void onLocationChanged(Location l) { }
                public void onStatusChanged(String p, int s, Bundle b) { }
                public void onProviderEnabled(String p) { }
                public void onProviderDisabled(String p) { }
            };
            String p = lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER) ? LocationManager.NETWORK_PROVIDER : LocationManager.PASSIVE_PROVIDER;
            lm.requestLocationUpdates(p, 5 * 60_000L, 300f, ll, ht.getLooper());
        } catch (Exception e) { }
    }

    static long httpDate(String s) {
        if (s == null) return 0;
        try { SimpleDateFormat f = new SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss zzz", Locale.US); f.setTimeZone(TimeZone.getTimeZone("GMT")); return f.parse(s).getTime(); }
        catch (Exception e) { return 0; }
    }

    void check() throws Exception {
        lastCheck = System.currentTimeMillis();
        JSONObject R = Cfg.notif(this, "rain");
        int lead = R.optInt("lead", 10);
        double lat, lon; String name;
        if ("region".equals(R.optString("target")) && R.has("lat")) { lat = R.optDouble("lat"); lon = R.optDouble("lon"); name = R.optString("town", "選定區域"); }
        else { Weather.Place p = Weather.place(this, true); lat = p.lat; lon = p.lon; name = p.name.isEmpty() ? "目前位置" : p.name; }

        android.content.SharedPreferences sp = Cfg.prefs(this);
        long now = System.currentTimeMillis();
        long lastFetch = sp.getLong("radarFetch", 0);
        float lastNear = sp.getFloat("lastNearKm", -1);
        boolean metered = false;
        try { ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE); metered = cm.isActiveNetworkMetered(); } catch (Exception e) { }
        long minGap = 0;
        if (metered && R.optBoolean("wifiOnly")) minGap = 20 * 60_000L;
        if ((lastNear < 0 || lastNear > 80) && cur != null) minGap = Math.max(minGap, 30 * 60_000L);
        boolean fetch = now - lastFetch >= minGap - 30_000;

        if (fetch) {
            Net.Resp r = Net.open(S3, sp.getString("radarLM", null), 30000);
            if (r.code == 200 && r.stream != null) {
                byte[] png = Net.readAll(r.stream);
                long t = httpDate(r.lastModified);
                if (t == 0) t = now;
                if (cur == null || t > cur.time + 60_000) {
                    Nowcast.Frame f = Nowcast.fromPng(png, t);
                    if (f != null) { prev = cur; cur = f; Nowcast.save(cur, new File(getFilesDir(), "radar_cur.bin")); if (prev != null) Nowcast.save(prev, new File(getFilesDir(), "radar_prev.bin")); }
                }
                sp.edit().putString("radarLM", r.lastModified).putLong("radarFetch", now).apply();
            } else if (r.code == 304) sp.edit().putLong("radarFetch", now).apply();
        }
        if (cur == null) { status("尚未取得雷達資料"); return; }
        // 移動向量：優先用兩張 S3 回波；剛啟動缺上一張時，改用氣象署網站兩張同來源歷史圖估速度
        double[] v = null;
        if (prev != null && cur.time - prev.time >= 5 * 60_000L && cur.time - prev.time <= 35 * 60_000L) v = Nowcast.motion(prev, cur, lat, lon, false);
        if (v == null && Nowcast.track(cur, null, lat, lon).echoN > 12) { try { Nowcast.Frame[] p2 = cv1Pair(); if (p2 != null) v = Nowcast.motion(p2[0], p2[1], lat, lon, true); } catch (Exception e) { } }
        Nowcast.Result res = Nowcast.track(cur, v, lat, lon);
        if (!res.ok) { status("位置超出雷達範圍"); return; }
        sp.edit().putFloat("lastNearKm", (float) res.nearestKm).apply();

        boolean wasRaining = sp.getBoolean("raining", false);
        long alertAt = sp.getLong("rainAlertAt", 0);
        String msg;
        if (res.nowLv >= 2) {
            msg = "正在下" + Nowcast.LV[res.nowLv];
            if (!wasRaining && now - alertAt > 30 * 60_000L) {
                Notif.show(this, "🌧 開始下雨了｜" + name, "雷達顯示目前" + Nowcast.LV[res.nowLv] + (res.stopIn != null ? "，約 " + res.stopIn + " 分鐘後趨緩" : "") + "。", "rain");
                sp.edit().putLong("rainAlertAt", now).apply();
            }
        } else if (res.eta != null) {
            msg = "約 " + res.eta + " 分鐘後可能下雨";
            if (res.eta <= lead && now - alertAt > 45 * 60_000L) {
                String mv = res.moving && res.spd > 3 ? "雨帶由" + Weather.DIR[(int) Math.round(res.dirFrom / 22.5) % 16] + "方移入，時速約 " + Math.round(res.spd) + " 公里，" : "";
                Notif.show(this, "☔ 約 " + res.eta + " 分鐘後下雨｜" + name, mv + "預估" + Nowcast.LV[res.etaLv] + "。出門記得帶雨具！", "rain");
                sp.edit().putLong("rainAlertAt", now).apply();
            }
        } else if (res.nearestKm >= 0 && res.nearestKm < 60) msg = Math.round(res.nearestKm) + " 公里外有降雨回波";
        else msg = "附近沒有降雨回波";
        // 雨停判斷（避免颱風外圍毛毛雨、外推誤差造成誤報）：
        //  1. 此刻雷達圖上本地 3 公里內沒有任何回波（連弱回波也沒有）、8 公里內沒有小雨以上回波
        //  2. 30 分鐘內不會再下
        //  3. 連續兩張雷達圖（間隔 ≥ 15 分鐘）都符合
        //  4. 有授權碼時，附近雨量站最近 10 分鐘也要是 0 mm
        boolean rainingNow = res.nowLv >= 2 || res.hereLv >= 2 || (wasRaining && res.hereLv >= 1);
        boolean dry = !rainingNow && res.hereLv == 0 && res.near8Lv < 2 && (res.eta == null || res.eta > 30);
        long dryFrame = sp.getLong("dryFrame", 0);
        if (wasRaining && dry) {
            if (dryFrame == 0) { sp.edit().putLong("dryFrame", cur.time).apply(); rainingNow = true; }
            else if (cur.time - dryFrame >= 15 * 60_000L) {
                Double g = gauge10(lat, lon);
                if (g != null && g > 0) { rainingNow = true; sp.edit().putLong("dryFrame", 0).apply(); msg = "附近雨量站仍有降雨"; }
                else if (R.optBoolean("stop", true)) Notif.show(this, "🌤 雨停了｜" + name, "雷達連續 " + Math.round((cur.time - dryFrame) / 60000.0) + " 分鐘沒有降雨回波" + (g != null ? "，附近雨量站也沒有雨量" : "") + "。", "rain");
            } else rainingNow = true;
        }
        if (!dry) sp.edit().putLong("dryFrame", 0).apply();
        if (rainingNow && res.nowLv < 2 && !msg.startsWith("附近雨量")) msg = "仍有零星降雨";
        sp.edit().putBoolean("raining", rainingNow).apply();
        Calendar k = Calendar.getInstance(); k.setTimeInMillis(cur.time);
        status(String.format(Locale.TAIWAN, "%s・%s（雷達 %02d:%02d）", name, msg, k.get(Calendar.HOUR_OF_DAY), k.get(Calendar.MINUTE)));
    }

    /** 附近（6 公里內）雨量站最近 10 分鐘雨量最大值；沒有授權碼或讀取失敗回傳 null */
    Double gauge10(double lat, double lon) {
        try {
            String key = Cfg.get(this).optString("cwaKey", "");
            if (key.isEmpty()) return null;
            JSONObject d = new JSONObject(Net.text("https://opendata.cwa.gov.tw/api/v1/rest/datastore/O-A0002-001?Authorization=" + java.net.URLEncoder.encode(key, "UTF-8") + "&format=JSON", 30000));
            org.json.JSONArray st = d.getJSONObject("records").getJSONArray("Station");
            Double mx = null;
            for (int i = 0; i < st.length(); i++) {
                JSONObject s = st.getJSONObject(i), gi = s.optJSONObject("GeoInfo");
                if (gi == null) continue;
                org.json.JSONArray cs = gi.optJSONArray("Coordinates"); if (cs == null) continue;
                double la = Double.NaN, lo = Double.NaN;
                for (int k = 0; k < cs.length(); k++) { JSONObject c = cs.getJSONObject(k); if (k == 0 || c.optString("CoordinateName").contains("WGS84")) { la = c.optDouble("StationLatitude"); lo = c.optDouble("StationLongitude"); } }
                double dk = Math.hypot((lo - lon) * 111.32 * Math.cos(Math.toRadians(lat)), (la - lat) * 110.57);
                if (!(dk <= 6)) continue;
                JSONObject re = s.optJSONObject("RainfallElement"); if (re == null) continue;
                JSONObject p = re.optJSONObject("Past10Min"); if (p == null) continue;
                double v = p.optDouble("Precipitation", Double.NaN);
                if (Double.isNaN(v) || v < 0) continue;
                mx = mx == null ? v : Math.max(mx, v);
            }
            return mx;
        } catch (Exception e) { return null; }
    }

    String cvKey; Nowcast.Frame[] cvPair;
    /** 氣象署網站 CV1_3600 兩張歷史圖（投影與 S3 不同，只用來估移動速度） */
    Nowcast.Frame[] cv1Pair() throws Exception {
        String js = Net.text("https://www.cwa.gov.tw/Data/js/obs_img/Observe_radar.js?t=" + (System.currentTimeMillis() / 120_000), 20000);
        Matcher m = Pattern.compile("CV1_3600_(\\d{12})\\.png").matcher(js);
        SimpleDateFormat f = new SimpleDateFormat("yyyyMMddHHmm", Locale.US);
        f.setTimeZone(TimeZone.getTimeZone("Asia/Taipei"));
        String last = null; long lt = 0;
        java.util.TreeMap<Long, String> all = new java.util.TreeMap<>();
        while (m.find()) { long t = f.parse(m.group(1)).getTime(); all.put(t, m.group(0)); if (t > lt) { lt = t; last = m.group(0); } }
        if (last == null) return null;
        if (last.equals(cvKey)) return cvPair;
        String prevN = null; long pt = 0;
        for (java.util.Map.Entry<Long, String> e : all.descendingMap().entrySet()) { long d = lt - e.getKey(); if (d >= 9 * 60_000L && d <= 21 * 60_000L) { prevN = e.getValue(); pt = e.getKey(); break; } }
        if (prevN == null) return null;
        Nowcast.Frame a = Nowcast.fromPng(Net.bytes("https://www.cwa.gov.tw/Data/radar/" + prevN, 30000), pt);
        Nowcast.Frame b = Nowcast.fromPng(Net.bytes("https://www.cwa.gov.tw/Data/radar/" + last, 30000), lt);
        if (a == null || b == null) return null;
        cvKey = last; cvPair = new Nowcast.Frame[]{a, b};
        return cvPair;
    }

    void status(String msg) {
        try {
            JSONObject o = new JSONObject();
            o.put("last", System.currentTimeMillis()); o.put("msg", msg);
            Cfg.prefs(this).edit().putString("rainStatus", o.toString()).apply();
        } catch (Exception e) { }
        NotificationManager nm = getSystemService(NotificationManager.class);
        try { nm.notify(NID, Notif.monitor(this, msg)); } catch (Exception e) { }
    }

    String statusText() {
        try { return new JSONObject(Cfg.prefs(this).getString("rainStatus", "{}")).optString("msg", "準備中…"); } catch (Exception e) { return "準備中…"; }
    }

    @Override
    @SuppressWarnings("MissingPermission")
    public void onDestroy() {
        running = false;
        h.removeCallbacksAndMessages(null);
        try { if (ll != null) ((LocationManager) getSystemService(LOCATION_SERVICE)).removeUpdates(ll); } catch (Exception e) { }
        AlarmManager am = (AlarmManager) getSystemService(ALARM_SERVICE);
        try { am.cancel(PendingIntent.getForegroundService(this, 9, new Intent(this, RainService.class).setAction("CHECK"), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE)); } catch (Exception e) { }
        ht.quitSafely();
        super.onDestroy();
    }
}
