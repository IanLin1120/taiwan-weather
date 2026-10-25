package com.ian.dadiweather;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.view.Window;
import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.File;
import org.json.JSONObject;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    static final String HOST = "appassets.androidplatform.net";
    static final String START = "https://" + HOST + "/index.html";
    WebView web;
    GeolocationPermissions.Callback geoCb;
    String geoOrigin;
    String pendingPerm;
    String pendingPage;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        Notif.channels(this);
        Window w = getWindow();
        w.setStatusBarColor(Color.parseColor("#efe5d3"));
        w.setNavigationBarColor(Color.parseColor("#efe5d3"));
        setLight(true);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#efe5d3"));
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setGeolocationEnabled(true);
        s.setAllowFileAccess(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setTextZoom(100);
        s.setUserAgentString(s.getUserAgentString() + " DadiWeather/" + BuildInfo.VERSION);
        web.addJavascriptInterface(new Bridge(this), "WXN");
        pendingPage = getIntent() == null ? null : getIntent().getStringExtra("page");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView v, String url) {
                if (pendingPage != null) { js("setTimeout(function(){App.show('" + pendingPage + "')},300)"); pendingPage = null; }
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (!HOST.equals(u.getHost())) return null;
                String path = u.getPath() == null ? "/" : u.getPath();
                if (path.equals("/p")) return proxy(u.getQueryParameter("u"), r.getRequestHeaders());
                if (path.equals("/radar/cur.bin") || path.equals("/radar/prev.bin")) {
                    try {
                        java.io.File f = new java.io.File(getFilesDir(), path.equals("/radar/cur.bin") ? "radar_cur.bin" : "radar_prev.bin");
                        if (f.exists()) return new WebResourceResponse("application/octet-stream", null, new java.io.FileInputStream(f));
                    } catch (Exception e) { }
                    return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<>(), null);
                }
                return asset(path);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (HOST.equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb) {
                if (hasLoc()) { cb.invoke(origin, true, false); return; }
                geoCb = cb; geoOrigin = origin;
                pendingPerm = "loc";
                requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, 11);
            }
        });
        if (b != null) web.restoreState(b); else web.loadUrl(START);
    }

    /* ===== 線上更新：GitHub 下載的新版介面放在 files/www/，比 APK 內建的新才使用 ===== */
    File otaFile() { return new File(getFilesDir(), "www/index.html"); }
    JSONObject otaMeta() { try { return new JSONObject(new String(Net.readAll(new java.io.FileInputStream(new File(getFilesDir(), "www/meta.json"))), "UTF-8")); } catch (Exception e) { return null; } }
    static int cmpVer(String a, String b) {
        String[] x = a.split("\\."), y = b.split("\\.");
        for (int i = 0; i < Math.max(x.length, y.length); i++) {
            int p = i < x.length ? parseInt(x[i]) : 0, q = i < y.length ? parseInt(y[i]) : 0;
            if (p != q) return p < q ? -1 : 1;
        }
        return 0;
    }
    static int parseInt(String s) { try { return Integer.parseInt(s.replaceAll("[^0-9]", "")); } catch (Exception e) { return 0; } }
    boolean otaUsable() {
        JSONObject m = otaMeta();
        if (m == null || !otaFile().exists()) return false;
        if (m.optInt("minApk", 0) > BuildInfo.CODE) return false;                  // 需要新版 APK 才能用
        if (cmpVer(m.optString("ver", "0"), BuildInfo.VERSION) <= 0) return false;  // APK 內建的比較新（例如剛裝了新 APK）
        return true;
    }

    WebResourceResponse asset(String path) {
        if (path.equals("/") || path.isEmpty()) path = "/index.html";
        try {
            if (path.equals("/index.html") && otaUsable()) return new WebResourceResponse("text/html", "utf-8", new java.io.FileInputStream(otaFile()));
            InputStream in = getAssets().open(path.substring(1));
            String mime = path.endsWith(".html") ? "text/html" : path.endsWith(".js") ? "application/javascript" : path.endsWith(".css") ? "text/css" : path.endsWith(".png") ? "image/png" : path.endsWith(".json") ? "application/json" : "application/octet-stream";
            return new WebResourceResponse(mime, "utf-8", in);
        } catch (Exception e) {
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<>(), null);
        }
    }

    /** 用系統下載管理員下載 APK（存到「下載」資料夾），完成後跳出安裝畫面 */
    long dlId = -1;
    void downloadApk(String url, String name) {
        try {
            android.app.DownloadManager dm = (android.app.DownloadManager) getSystemService(DOWNLOAD_SERVICE);
            android.app.DownloadManager.Request q = new android.app.DownloadManager.Request(android.net.Uri.parse(url))
                    .setTitle(name).setDescription("台灣即時天氣預報 安裝檔").setMimeType("application/vnd.android.package-archive")
                    .setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    .setDestinationInExternalPublicDir(android.os.Environment.DIRECTORY_DOWNLOADS, name);
            dlId = dm.enqueue(q);
            android.content.BroadcastReceiver br = new android.content.BroadcastReceiver() {
                public void onReceive(android.content.Context c, android.content.Intent i) {
                    long id = i.getLongExtra(android.app.DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                    if (id != dlId) return;
                    try { unregisterReceiver(this); } catch (Exception e) { }
                    android.net.Uri u = dm.getUriForDownloadedFile(id);
                    js("window.onNativeEvent&&onNativeEvent('apk'," + JSONObject.quote(u == null ? "fail" : "ok") + ")");
                    if (u == null) return;
                    try {
                        android.content.Intent in = new android.content.Intent(android.content.Intent.ACTION_VIEW).setDataAndType(u, "application/vnd.android.package-archive")
                                .addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION | android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(in);
                    } catch (Exception e) { }
                }
            };
            android.content.IntentFilter f = new android.content.IntentFilter(android.app.DownloadManager.ACTION_DOWNLOAD_COMPLETE);
            if (android.os.Build.VERSION.SDK_INT >= 33) registerReceiver(br, f, 0x2 /* RECEIVER_EXPORTED */); else registerReceiver(br, f);
        } catch (Exception e) { js("window.onNativeEvent&&onNativeEvent('apk','fail')"); }
    }

    WebResourceResponse proxy(String url, Map<String, String> reqH) {
        Map<String, String> h = new HashMap<>();
        h.put("Access-Control-Allow-Origin", "*");
        h.put("Cache-Control", "no-store");
        if (url == null || !(url.startsWith("https://"))) return new WebResourceResponse("text/plain", "utf-8", 400, "Bad Request", h, null);
        try {
            Net.Resp r = Net.open(url, null, 30000);
            if (r.lastModified != null) { h.put("X-Last-Modified", r.lastModified); h.put("Last-Modified", r.lastModified); }
            String mime = r.mime == null ? "application/octet-stream" : r.mime;
            String enc = null;
            int sc = mime.indexOf(';');
            if (sc > 0) { String rest = mime.substring(sc + 1); mime = mime.substring(0, sc).trim(); int ci = rest.toLowerCase().indexOf("charset="); if (ci >= 0) enc = rest.substring(ci + 8).trim(); }
            if (enc == null && (mime.contains("json") || mime.startsWith("text") || mime.contains("javascript"))) enc = "utf-8";
            String reason = r.code >= 200 && r.code < 300 ? "OK" : "Error";
            return new WebResourceResponse(mime, enc, r.code, reason, h, r.stream);
        } catch (Exception e) {
            return new WebResourceResponse("text/plain", "utf-8", 502, "Bad Gateway", h, null);
        }
    }

    boolean hasLoc() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    void setLight(boolean light) {
        View d = getWindow().getDecorView();
        int f = d.getSystemUiVisibility();
        if (light) f |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        else f &= ~(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        d.setSystemUiVisibility(f);
    }

    void setDark(boolean dark) {
        runOnUiThread(() -> {
            int c = Color.parseColor(dark ? "#1d1812" : "#efe5d3");
            getWindow().setStatusBarColor(c);
            getWindow().setNavigationBarColor(c);
            web.setBackgroundColor(c);
            setLight(!dark);
        });
    }

    void requestPerm(String kind) {
        runOnUiThread(() -> {
            pendingPerm = kind;
            if ("notif".equals(kind)) {
                if (Build.VERSION.SDK_INT >= 33) requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 12);
                else openAppSettings();
            } else if ("loc".equals(kind)) {
                requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, 11);
            } else if ("bgloc".equals(kind)) {
                if (!hasLoc()) { requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, 11); return; }
                if (Build.VERSION.SDK_INT >= 29) requestPermissions(new String[]{"android.permission.ACCESS_BACKGROUND_LOCATION"}, 13);
            } else if ("battery".equals(kind)) {
                try {
                    Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getPackageName()));
                    startActivity(i);
                } catch (Exception e) {
                    try { startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)); } catch (Exception e2) { }
                }
            } else if ("exact".equals(kind)) {
                if (Build.VERSION.SDK_INT >= 31) try { startActivity(new Intent("android.settings.REQUEST_SCHEDULE_EXACT_ALARM", Uri.parse("package:" + getPackageName()))); } catch (Exception e) { }
            }
        });
    }

    void openAppSettings() {
        runOnUiThread(() -> {
            try {
                Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()));
                startActivity(i);
            } catch (Exception e) { }
        });
    }

    void openUrl(String u) {
        runOnUiThread(() -> { try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(u))); } catch (Exception e) { } });
    }

    void js(String code) {
        runOnUiThread(() -> { if (web != null) web.evaluateJavascript(code, null); });
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] res) {
        boolean ok = res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED;
        if (code == 11 && geoCb != null) { geoCb.invoke(geoOrigin, hasLoc(), false); geoCb = null; }
        String k = pendingPerm == null ? "" : pendingPerm;
        js("window.onNativeEvent&&onNativeEvent('perm','" + k + "')");
        if (ok && code == 11) RainService.sync(this);
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        String p = i.getStringExtra("page");
        if (p != null && p.matches("v-[a-z]+")) js("App.show('" + p + "')");
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) js("window.onNativeEvent&&onNativeEvent('resume')");
    }

    @Override
    protected void onSaveInstanceState(Bundle o) {
        super.onSaveInstanceState(o);
        if (web != null) web.saveState(o);
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.onAndroidBack?String(window.onAndroidBack()):'false'", v -> {
            if (v == null || !v.contains("true")) moveTaskToBack(true);
        });
    }
}
