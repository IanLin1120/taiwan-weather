package com.ian.dadiweather;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

/** 讀取網頁端存下的設定（與 JS 的 CFG 同結構）。 */
public class Cfg {
    public static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("wx", Context.MODE_PRIVATE);
    }

    public static void save(Context c, String json) {
        prefs(c).edit().putString("cfg", json).apply();
    }

    public static JSONObject get(Context c) {
        try { return new JSONObject(prefs(c).getString("cfg", "{}")); } catch (Exception e) { return new JSONObject(); }
    }

    public static JSONObject obj(JSONObject o, String... path) {
        JSONObject x = o;
        for (String p : path) { x = x == null ? null : x.optJSONObject(p); }
        return x == null ? new JSONObject() : x;
    }

    public static JSONObject notif(Context c, String k) { return obj(get(c), "notif", k); }
}
