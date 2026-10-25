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
    public static final String CH_FC = "forecast2", CH_RAIN = "rain2", CH_WARN = "warn2", CH_QUIET = "quiet2", CH_MON = "monitor";

    /* 通知方式改由 App 自己控制（鈴聲＋震動／只震動／只顯示），所以頻道本身一律不發聲、不震動 */
    public static void channels(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;
        for (String old : new String[]{"forecast", "rain", "warn"}) try { nm.deleteNotificationChannel(old); } catch (Exception e) { }
        NotificationChannel a = new NotificationChannel(CH_FC, "天氣預報通知", NotificationManager.IMPORTANCE_HIGH);
        a.setDescription("未來三小時、今日、一週天氣（聲音與震動依 App 內設定）");
        NotificationChannel b = new NotificationChannel(CH_RAIN, "即時降雨提醒", NotificationManager.IMPORTANCE_HIGH);
        b.setDescription("雷達回波接近時提醒「X 分鐘後下雨」（聲音與震動依 App 內設定）");
        b.enableLights(true); b.setLightColor(Color.parseColor("#3f7fb8"));
        NotificationChannel w = new NotificationChannel(CH_WARN, "天氣警特報", NotificationManager.IMPORTANCE_HIGH);
        w.setDescription("豪雨、強風、颱風等警特報（聲音與震動依 App 內設定）");
        NotificationChannel q = new NotificationChannel(CH_QUIET, "靜音通知（只顯示）", NotificationManager.IMPORTANCE_LOW);
        q.setDescription("設定為「只顯示在通知欄」的通知");
        for (NotificationChannel ch : new NotificationChannel[]{a, b, w}) { ch.setSound(null, null); ch.enableVibration(false); }
        q.setSound(null, null); q.enableVibration(false);
        NotificationChannel m = new NotificationChannel(CH_MON, "背景降雨監測（常駐）", NotificationManager.IMPORTANCE_MIN);
        m.setShowBadge(false);
        nm.createNotificationChannel(a); nm.createNotificationChannel(b); nm.createNotificationChannel(w); nm.createNotificationChannel(q); nm.createNotificationChannel(m);
    }

    /** 這種通知用哪種方式：sound＝鈴聲＋震動、vibrate＝只震動、silent＝只顯示在通知欄 */
    public static String mode(Context c, String kind) {
        try {
            JSONObject cfg = Cfg.get(c);
            String key = "h3".equals(kind) || "today".equals(kind) || "week".equals(kind) || "rain".equals(kind) || "warn".equals(kind) ? kind : "today";
            JSONObject n = cfg.optJSONObject("notif"); JSONObject k = n == null ? null : n.optJSONObject(key);
            String m = k == null ? "" : k.optString("mode", "");
            if (m.isEmpty() || "default".equals(m)) m = cfg.optString("notifMode", "sound");
            return m;
        } catch (Exception e) { return "sound"; }
    }

    /** 依通知方式與手機目前的響鈴模式發出聲音／震動（手機在震動模式時不響；靜音模式時都不做） */
    static void feedback(Context c, String mode, String kind) {
        if ("silent".equals(mode)) return;
        try {
            android.media.AudioManager am = (android.media.AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
            int rm = am == null ? android.media.AudioManager.RINGER_MODE_NORMAL : am.getRingerMode();
            if (rm == android.media.AudioManager.RINGER_MODE_SILENT) return;
            android.os.Vibrator v = android.os.Build.VERSION.SDK_INT >= 31 ? ((android.os.VibratorManager) c.getSystemService(Context.VIBRATOR_MANAGER_SERVICE)).getDefaultVibrator() : (android.os.Vibrator) c.getSystemService(Context.VIBRATOR_SERVICE);
            long[] pat = "rain".equals(kind) || "warn".equals(kind) ? new long[]{0, 280, 140, 280, 140, 280} : new long[]{0, 220, 120, 220};
            android.media.AudioAttributes at = new android.media.AudioAttributes.Builder().setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION).build();
            if (v != null) v.vibrate(android.os.VibrationEffect.createWaveform(pat, -1), at);
            if ("sound".equals(mode) && rm == android.media.AudioManager.RINGER_MODE_NORMAL) {
                android.media.Ringtone r = android.media.RingtoneManager.getRingtone(c.getApplicationContext(), android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_NOTIFICATION));
                if (r != null) { r.setAudioAttributes(at); r.play(); }
            }
        } catch (Exception e) { }
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
        String md = mode(c, kind);
        String ch = "silent".equals(md) ? CH_QUIET : "rain".equals(kind) ? CH_RAIN : "warn".equals(kind) ? CH_WARN : CH_FC;
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
        try { nm.notify(id, nb.build()); feedback(c, md, kind); } catch (Exception e) { }
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
