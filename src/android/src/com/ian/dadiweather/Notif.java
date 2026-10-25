package com.ian.dadiweather;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;

import org.json.JSONArray;
import org.json.JSONObject;

public class Notif {
    public static final String CH_FC = "forecast", CH_RAIN = "rain", CH_WARN = "warn", CH_MON = "monitor";

    public static void channels(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;
        NotificationChannel a = new NotificationChannel(CH_FC, "天氣預報通知", NotificationManager.IMPORTANCE_DEFAULT);
        a.setDescription("未來三小時、今日、一週天氣");
        NotificationChannel b = new NotificationChannel(CH_RAIN, "即時降雨提醒", NotificationManager.IMPORTANCE_HIGH);
        b.setDescription("雷達回波接近時提醒「X 分鐘後下雨」");
        b.enableVibration(true);
        b.setVibrationPattern(new long[]{0, 250, 120, 250});
        b.enableLights(true);
        b.setLightColor(Color.parseColor("#3f7fb8"));
        NotificationChannel w = new NotificationChannel(CH_WARN, "天氣警特報", NotificationManager.IMPORTANCE_HIGH);
        NotificationChannel m = new NotificationChannel(CH_MON, "背景降雨監測（常駐）", NotificationManager.IMPORTANCE_MIN);
        m.setShowBadge(false);
        nm.createNotificationChannel(a);
        nm.createNotificationChannel(b);
        nm.createNotificationChannel(w);
        nm.createNotificationChannel(m);
    }

    public static boolean enabled(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        return nm != null && nm.areNotificationsEnabled();
    }

    static PendingIntent open(Context c, String page) {
        Intent i = new Intent(c, MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        i.putExtra("page", page);
        return PendingIntent.getActivity(c, page.hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    public static void show(Context c, String title, String body, String kind) {
        channels(c);
        String ch = "rain".equals(kind) ? CH_RAIN : "warn".equals(kind) ? CH_WARN : CH_FC;
        int id = "h3".equals(kind) ? 103 : "today".equals(kind) ? 101 : "week".equals(kind) ? 102 : "rain".equals(kind) ? 201 : "warn".equals(kind) ? (300 + (title.hashCode() & 0xff)) : 400;
        Notification.Builder nb = new Notification.Builder(c, ch)
                .setSmallIcon(R.drawable.ic_stat)
                .setColor(Color.parseColor("#a2613a"))
                .setContentTitle(title)
                .setContentText(body.replace('\n', ' '))
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setContentIntent(open(c, "rain".equals(kind) ? "v-area" : "v-home"));
        if ("rain".equals(kind) || "warn".equals(kind)) nb.setCategory(Notification.CATEGORY_ALARM);
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        try { nm.notify(id, nb.build()); } catch (Exception e) { }
        hist(c, title, body, kind);
    }

    static synchronized void hist(Context c, String title, String body, String kind) {
        try {
            JSONArray a = new JSONArray(Cfg.prefs(c).getString("hist", "[]"));
            JSONArray n = new JSONArray();
            JSONObject o = new JSONObject();
            o.put("t", System.currentTimeMillis()); o.put("title", title); o.put("body", body); o.put("kind", kind);
            n.put(o);
            for (int i = 0; i < a.length() && i < 39; i++) n.put(a.get(i));
            Cfg.prefs(c).edit().putString("hist", n.toString()).apply();
        } catch (Exception e) { }
    }

    public static Notification monitor(Context c, String text) {
        channels(c);
        return new Notification.Builder(c, CH_MON)
                .setSmallIcon(R.drawable.ic_stat)
                .setColor(Color.parseColor("#a2613a"))
                .setContentTitle("即時降雨監測中")
                .setContentText(text)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setContentIntent(open(c, "v-area"))
                .build();
    }
}
