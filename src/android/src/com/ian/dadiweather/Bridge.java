package com.ian.dadiweather;

import android.Manifest;
import android.app.AlarmManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.PowerManager;
import android.webkit.JavascriptInterface;

import org.json.JSONObject;

public class Bridge {
    final MainActivity a;

    Bridge(MainActivity a) { this.a = a; }

    @JavascriptInterface
    public void saveConfig(String json) {
        Cfg.save(a, json);
        Sched.all(a);
        RainService.sync(a);
    }

    @JavascriptInterface
    public void setDigest(String json) {
        Cfg.prefs(a).edit().putString("digest", json).apply();
    }

    @JavascriptInterface
    public void notify(String title, String body, String kind) {
        Notif.show(a, title, body, kind == null ? "forecast" : kind);
    }

    @JavascriptInterface
    public String perms() {
        try {
            JSONObject o = new JSONObject();
            o.put("notif", Build.VERSION.SDK_INT < 33 ? Notif.enabled(a) : a.checkSelfPermission("android.permission.POST_NOTIFICATIONS") == PackageManager.PERMISSION_GRANTED);
            o.put("loc", a.hasLoc());
            o.put("bgloc", Build.VERSION.SDK_INT < 29 ? a.hasLoc() : a.checkSelfPermission("android.permission.ACCESS_BACKGROUND_LOCATION") == PackageManager.PERMISSION_GRANTED);
            PowerManager pm = (PowerManager) a.getSystemService(Context.POWER_SERVICE);
            o.put("battery", pm != null && pm.isIgnoringBatteryOptimizations(a.getPackageName()));
            boolean exact = true;
            if (Build.VERSION.SDK_INT >= 31) { AlarmManager am = (AlarmManager) a.getSystemService(Context.ALARM_SERVICE); exact = am != null && am.canScheduleExactAlarms(); }
            o.put("exact", exact);
            return o.toString();
        } catch (Exception e) { return "{}"; }
    }

    @JavascriptInterface
    public void requestPerm(String kind) { a.requestPerm(kind); }

    @JavascriptInterface
    public void openAppSettings() { a.openAppSettings(); }

    @JavascriptInterface
    public void openUrl(String u) { a.openUrl(u); }

    @JavascriptInterface
    public void setDark(boolean d) { a.setDark(d); }

    @JavascriptInterface
    public String version() { JSONObject m = a.otaUsable() ? a.otaMeta() : null; return "v" + (m != null ? m.optString("ver") + "（線上更新）・APK v" : "") + BuildInfo.VERSION + "（Android）"; }

    /** 線上更新資訊 */
    @JavascriptInterface
    public String appInfo() {
        try { JSONObject o = new JSONObject(); o.put("apk", BuildInfo.VERSION); o.put("code", BuildInfo.CODE); JSONObject m = a.otaMeta(); o.put("ota", m != null && a.otaUsable() ? m.optString("ver") : ""); return o.toString(); }
        catch (Exception e) { return "{}"; }
    }
    /** 寫入新版介面（下次開啟／重新載入生效） */
    @JavascriptInterface
    public boolean writeApp(String html, String ver, int minApk) {
        try {
            java.io.File d = new java.io.File(a.getFilesDir(), "www"); d.mkdirs();
            java.io.File t = new java.io.File(d, "index.html.tmp");
            try (java.io.FileOutputStream o = new java.io.FileOutputStream(t)) { o.write(html.getBytes("UTF-8")); }
            if (!t.renameTo(new java.io.File(d, "index.html"))) return false;
            JSONObject m = new JSONObject(); m.put("ver", ver); m.put("minApk", minApk); m.put("at", System.currentTimeMillis());
            try (java.io.FileOutputStream o = new java.io.FileOutputStream(new java.io.File(d, "meta.json"))) { o.write(m.toString().getBytes("UTF-8")); }
            return true;
        } catch (Exception e) { return false; }
    }
    @JavascriptInterface
    public void resetApp() { new java.io.File(a.getFilesDir(), "www/index.html").delete(); new java.io.File(a.getFilesDir(), "www/meta.json").delete(); }
    @JavascriptInterface
    public void downloadApk(String url, String name) { a.runOnUiThread(() -> a.downloadApk(url, name)); }
    @JavascriptInterface
    public boolean canInstall() { return android.os.Build.VERSION.SDK_INT < 26 || a.getPackageManager().canRequestPackageInstalls(); }
    @JavascriptInterface
    public void askInstall() { try { a.startActivity(new android.content.Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, android.net.Uri.parse("package:" + a.getPackageName()))); } catch (Exception e) { } }

    @JavascriptInterface
    public String history() { return Cfg.prefs(a).getString("hist", "[]"); }

    @JavascriptInterface
    public String rainStatus() {
        try {
            JSONObject o = new JSONObject(Cfg.prefs(a).getString("rainStatus", "{}"));
            o.put("running", RainService.running);
            return o.toString();
        } catch (Exception e) { return "{}"; }
    }
}
