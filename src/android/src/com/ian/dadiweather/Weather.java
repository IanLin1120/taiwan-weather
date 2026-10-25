package com.ian.dadiweather;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationManager;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.net.URLEncoder;
import java.util.Calendar;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Locale;
import java.util.Set;

/** 背景用：組合通知內容（優先用網頁剛算好的摘要，否則自己抓 Open-Meteo）。 */
public class Weather {

    public static class Place { double lat, lon; String name; String county; }

    static boolean hasLoc(Context c) {
        return c.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || c.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    @SuppressWarnings("MissingPermission")
    public static Location lastKnown(Context c) {
        if (!hasLoc(c)) return null;
        LocationManager lm = (LocationManager) c.getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) return null;
        Location best = null;
        String[] ps = Build.VERSION.SDK_INT >= 31 ? new String[]{"fused", LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER, LocationManager.PASSIVE_PROVIDER}
                : new String[]{LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER, LocationManager.PASSIVE_PROVIDER};
        for (String p : ps) {
            try {
                Location l = lm.getLastKnownLocation(p);
                if (l != null && (best == null || l.getTime() > best.getTime())) best = l;
            } catch (Exception e) { }
        }
        return best;
    }

    static double km(double a, double b, double c, double d) {
        double r = Math.PI / 180, x = (d - b) * r * Math.cos((a + c) / 2 * r), y = (c - a) * r;
        return 6371 * Math.hypot(x, y);
    }

    public static Place place(Context c, boolean preferGps) {
        JSONObject cfg = Cfg.get(c);
        JSONObject loc = Cfg.obj(cfg, "loc");
        Place p = new Place();
        p.lat = loc.optDouble("lat", 25.0324); p.lon = loc.optDouble("lon", 121.5199);
        p.county = loc.optString("county", "");
        p.name = loc.optString("county", "") + loc.optString("town", "");
        if (preferGps && "gps".equals(loc.optString("mode", "gps"))) {
            Location l = lastKnown(c);
            if (l != null && System.currentTimeMillis() - l.getTime() < 6 * 3600_000L) {
                if (km(p.lat, p.lon, l.getLatitude(), l.getLongitude()) > 4) p.name = "目前位置";
                p.lat = l.getLatitude(); p.lon = l.getLongitude();
            }
        }
        return p;
    }

    static String[] WMO_T = new String[100];
    static {
        WMO_T[0] = "晴"; WMO_T[1] = "晴時多雲"; WMO_T[2] = "多雲"; WMO_T[3] = "陰"; WMO_T[45] = "霧"; WMO_T[48] = "霧";
        WMO_T[51] = "毛毛雨"; WMO_T[53] = "毛毛雨"; WMO_T[55] = "毛毛雨"; WMO_T[61] = "小雨"; WMO_T[63] = "中雨"; WMO_T[65] = "大雨";
        WMO_T[80] = "短暫陣雨"; WMO_T[81] = "陣雨"; WMO_T[82] = "豪大陣雨"; WMO_T[95] = "雷陣雨"; WMO_T[96] = "雷雨"; WMO_T[99] = "強雷雨";
    }
    static String wmo(int c) { return c >= 0 && c < 100 && WMO_T[c] != null ? WMO_T[c] : "多雲"; }
    static String icon(int c) { return c >= 95 ? "⛈" : c >= 61 ? "🌧" : c >= 51 ? "🌦" : c == 45 || c == 48 ? "🌫" : c == 3 ? "☁️" : c == 2 ? "⛅" : c == 1 ? "🌤" : "☀️"; }
    static final String[] DIR = {"北", "北北東", "東北", "東北東", "東", "東南東", "東南", "南南東", "南", "南南西", "西南", "西南西", "西", "西北西", "西北", "北北西"};
    static final double[] BF = {0.3, 1.6, 3.4, 5.5, 8.0, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7};
    static int bf(double ms) { int i = 0; while (i < BF.length && ms > BF[i]) i++; return i; }

    /** 回傳 {title, body}；null = 這次不發 */
    public static String[] compose(Context c, String kind) throws Exception {
        Place p = place(c, true);
        JSONObject cfg = Cfg.get(c);
        JSONObject n = Cfg.obj(cfg, "notif", kind);
        // 1) 網頁 25 分鐘內算好的摘要（含氣象署鄉鎮預報）
        try {
            JSONObject d = new JSONObject(Cfg.prefs(c).getString("digest", "{}"));
            if (System.currentTimeMillis() - d.optLong("at") < 25 * 60_000L && km(d.optDouble("lat"), d.optDouble("lon"), p.lat, p.lon) < 5) {
                JSONObject x = d.optJSONObject(kind);
                if (x != null) {
                    if ("h3".equals(kind) && n.optBoolean("onlyChange") && !x.optBoolean("rainy") && x.optString("key").equals(Cfg.prefs(c).getString("h3key", ""))) return null;
                    Cfg.prefs(c).edit().putString("h3key", x.optString("key")).apply();
                    return new String[]{x.optString("title"), x.optString("body")};
                }
            }
        } catch (Exception e) { }
        // 2) 自己抓 Open-Meteo
        String u = String.format(Locale.US, "https://api.open-meteo.com/v1/forecast?latitude=%.3f&longitude=%.3f&timezone=Asia%%2FTaipei&wind_speed_unit=ms&forecast_days=8"
                + "&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,uv_index"
                + "&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,uv_index_max", p.lat, p.lon);
        JSONObject j = new JSONObject(Net.text(u, 25000));
        JSONObject H = j.getJSONObject("hourly"), D = j.getJSONObject("daily");
        JSONArray ht = H.getJSONArray("time");
        Calendar now = Calendar.getInstance();
        String key = String.format(Locale.US, "%04d-%02d-%02dT%02d:00", now.get(Calendar.YEAR), now.get(Calendar.MONTH) + 1, now.get(Calendar.DAY_OF_MONTH), now.get(Calendar.HOUR_OF_DAY));
        int i0 = 0;
        for (int i = 0; i < ht.length(); i++) if (ht.getString(i).compareTo(key) <= 0) i0 = i;
        String place = p.name.isEmpty() ? "目前位置" : p.name;
        if ("h3".equals(kind)) {
            double tmin = 99, tmax = -99, rain = 0, wind = 0; int pop = 0; int[] cnt = new int[100]; int dir = 0;
            for (int i = i0; i < i0 + 3 && i < ht.length(); i++) {
                double t = H.getJSONArray("temperature_2m").optDouble(i); tmin = Math.min(tmin, t); tmax = Math.max(tmax, t);
                pop = Math.max(pop, H.getJSONArray("precipitation_probability").optInt(i));
                rain += H.getJSONArray("precipitation").optDouble(i, 0);
                wind = Math.max(wind, H.getJSONArray("wind_speed_10m").optDouble(i, 0));
                int wc = H.getJSONArray("weather_code").optInt(i); if (wc >= 0 && wc < 100) cnt[wc]++;
                dir = H.getJSONArray("wind_direction_10m").optInt(i);
            }
            int code = 0; for (int k = 0; k < 100; k++) if (cnt[k] > cnt[code]) code = k;
            String k2 = wmo(code) + "|" + (pop / 20);
            boolean rainy = pop >= 50 || rain >= 1;
            if (n.optBoolean("onlyChange") && !rainy && k2.equals(Cfg.prefs(c).getString("h3key", ""))) return null;
            Cfg.prefs(c).edit().putString("h3key", k2).apply();
            int h = now.get(Calendar.HOUR_OF_DAY);
            return new String[]{"未來 3 小時｜" + place,
                    String.format(Locale.TAIWAN, "%02d–%02d 時 %s，降雨機率 %d%%%s\n氣溫 %d–%d°C，%s風 %d 級", h, (h + 3) % 24, wmo(code), pop,
                            rain >= 0.5 ? String.format(Locale.US, "（約 %.1f mm）", rain) : "", Math.round(tmin), Math.round(tmax), DIR[Math.round(((dir % 360) + 360) % 360 / 22.5f) % 16], bf(wind))};
        }
        if ("today".equals(kind)) {
            double fmax = -99, fmin = 99, uv = 0; int pop = 0;
            for (int i = i0; i < i0 + 12 && i < ht.length(); i++) {
                double f = H.getJSONArray("apparent_temperature").optDouble(i); fmax = Math.max(fmax, f); fmin = Math.min(fmin, f);
                pop = Math.max(pop, H.getJSONArray("precipitation_probability").optInt(i));
                uv = Math.max(uv, H.getJSONArray("uv_index").optDouble(i, 0));
            }
            JSONObject me = Cfg.obj(cfg, "me");
            double off = me.optDouble("feel", 0), hi = fmax + off;
            String wear = hi >= 31 ? "👕 短袖＋短褲" : hi >= 27 ? "👕 短袖" : hi >= 23 ? "👕 短袖＋薄外套" : hi >= 19 ? "🧥 長袖＋薄外套" : hi >= 15 ? "🧶 毛衣／夾克" : hi >= 11 ? "🧥 厚外套＋圍巾" : "🧣 羽絨外套＋圍巾＋毛帽";
            String rainTip = pop >= 60 ? ("scooter".equals(me.optString("ride")) ? "　🧥 要穿雨衣" : "　☂️ 一定要帶傘") : pop >= 30 ? "　🌂 帶折疊傘" : "";
            String uvTip = uv >= 6 ? "　🧴 高溫防曬" : "";
            int code = D.getJSONArray("weather_code").optInt(0);
            return new String[]{"今日天氣｜" + place,
                    String.format(Locale.TAIWAN, "%s，%d–%d°C（體感 %d–%d°C），降雨機率 %d%%\n%s%s%s", wmo(code),
                            Math.round(D.getJSONArray("temperature_2m_min").optDouble(0)), Math.round(D.getJSONArray("temperature_2m_max").optDouble(0)),
                            Math.round(fmin), Math.round(fmax), pop, wear, rainTip, uvTip)};
        }
        if ("week".equals(kind)) {
            StringBuilder sb = new StringBuilder();
            JSONArray dt = D.getJSONArray("time");
            String[] wd = {"日", "一", "二", "三", "四", "五", "六"};
            StringBuilder rainy = new StringBuilder();
            for (int i = 0; i < Math.min(7, dt.length()); i++) {
                Calendar k = Calendar.getInstance(); k.add(Calendar.DAY_OF_MONTH, i);
                String dn = i == 0 ? "今天" : i == 1 ? "明天" : "週" + wd[k.get(Calendar.DAY_OF_WEEK) - 1];
                int pop = D.getJSONArray("precipitation_probability_max").optInt(i);
                if (pop >= 60) rainy.append(rainy.length() > 0 ? "、" : "").append(dn);
                sb.append(String.format(Locale.TAIWAN, "%s %s %d–%d° ☔%d%%\n", dn, icon(D.getJSONArray("weather_code").optInt(i)),
                        Math.round(D.getJSONArray("temperature_2m_min").optDouble(i)), Math.round(D.getJSONArray("temperature_2m_max").optDouble(i)), pop));
            }
            if (rainy.length() > 0) sb.append("記得帶傘：").append(rainy);
            return new String[]{"一週天氣｜" + place, sb.toString().trim()};
        }
        return null;
    }

    static JSONObject lc(JSONObject o) throws Exception {
        JSONObject r = new JSONObject();
        Iterator<String> it = o.keys();
        while (it.hasNext()) { String k = it.next(); Object v = o.get(k); r.put(k.toLowerCase(Locale.US), lcv(v)); }
        return r;
    }
    static Object lcv(Object v) throws Exception {
        if (v instanceof JSONObject) return lc((JSONObject) v);
        if (v instanceof JSONArray) { JSONArray a = (JSONArray) v, b = new JSONArray(); for (int i = 0; i < a.length(); i++) b.put(lcv(a.get(i))); return b; }
        return v;
    }

    /** 天氣警特報：有新的就通知 */
    public static void checkWarnings(Context c) throws Exception {
        JSONObject cfg = Cfg.get(c);
        String key = cfg.optString("cwaKey", "");
        if (key.isEmpty()) return;
        String county = Cfg.obj(cfg, "loc").optString("county", "");
        String u = "https://opendata.cwa.gov.tw/api/v1/rest/datastore/W-C0033-001?Authorization=" + URLEncoder.encode(key, "UTF-8") + "&format=JSON"
                + (county.isEmpty() ? "" : "&locationName=" + URLEncoder.encode(county, "UTF-8"));
        JSONObject d = lc(new JSONObject(Net.text(u, 25000)));
        JSONArray locs = d.optJSONObject("records") == null ? null : d.getJSONObject("records").optJSONArray("location");
        if (locs == null) return;
        Set<String> seen = new HashSet<>(Cfg.prefs(c).getStringSet("warnSeen", new HashSet<>()));
        Set<String> cur = new HashSet<>();
        for (int i = 0; i < locs.length(); i++) {
            JSONObject l = locs.getJSONObject(i);
            JSONObject hc = l.optJSONObject("hazardconditions");
            JSONArray hz = hc == null ? null : hc.optJSONArray("hazards");
            if (hz == null) continue;
            for (int k = 0; k < hz.length(); k++) {
                JSONObject h = hz.getJSONObject(k);
                JSONObject info = h.optJSONObject("info"); JSONObject vt = h.optJSONObject("validtime");
                String name = (info == null ? "" : info.optString("phenomena") + info.optString("significance"));
                String st = vt == null ? "" : vt.optString("starttime"), en = vt == null ? "" : vt.optString("endtime");
                String id = l.optString("locationname") + "|" + name + "|" + st;
                cur.add(id);
                if (!seen.contains(id)) Notif.show(c, "⚠️ " + l.optString("locationname") + " " + name, "有效時間：" + st.replace("T", " ") + " 至 " + en.replace("T", " ") + "\n請留意中央氣象署最新資訊。", "warn");
            }
        }
        Cfg.prefs(c).edit().putStringSet("warnSeen", cur).apply();
    }
}
