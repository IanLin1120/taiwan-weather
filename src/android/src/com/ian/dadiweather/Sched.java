package com.ian.dadiweather;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import org.json.JSONObject;

import java.util.Calendar;

/** 用 AlarmManager 排定：今日、一週、未來三小時、警特報檢查。 */
public class Sched {
    static final String[] KINDS = {"today", "week", "h3", "warn"};

    static PendingIntent pi(Context c, String kind) {
        Intent i = new Intent(c, AlarmReceiver.class);
        i.setAction("com.ian.dadiweather.ALARM." + kind);
        i.putExtra("kind", kind);
        return PendingIntent.getBroadcast(c, kind.hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    public static void all(Context c) { for (String k : KINDS) one(c, k); }

    public static void one(Context c, String kind) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent p = pi(c, kind);
        am.cancel(p);
        long t = next(c, kind);
        if (t <= 0) return;
        boolean exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
        try {
            if (exact && !"warn".equals(kind)) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, p);
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, p);
        } catch (SecurityException e) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, p);
        }
    }

    static int[] hm(String s, int dh, int dm) {
        try { String[] a = s.split(":"); return new int[]{Integer.parseInt(a[0]), Integer.parseInt(a[1])}; } catch (Exception e) { return new int[]{dh, dm}; }
    }

    /** 下一次觸發時間（毫秒），0 = 不排程 */
    public static long next(Context c, String kind) {
        JSONObject cfg = Cfg.get(c);
        JSONObject n = Cfg.obj(cfg, "notif", kind);
        long now = System.currentTimeMillis();
        Calendar k = Calendar.getInstance();
        k.set(Calendar.SECOND, 0); k.set(Calendar.MILLISECOND, 0);
        switch (kind) {
            case "today": {
                if (!n.optBoolean("on", true)) return 0;
                int[] x = hm(n.optString("time", "06:30"), 6, 30);
                k.set(Calendar.HOUR_OF_DAY, x[0]); k.set(Calendar.MINUTE, x[1]);
                if (k.getTimeInMillis() <= now + 30000) k.add(Calendar.DAY_OF_MONTH, 1);
                return k.getTimeInMillis();
            }
            case "week": {
                if (!n.optBoolean("on", true)) return 0;
                int[] x = hm(n.optString("time", "20:00"), 20, 0);
                int day = n.optInt("day", 0);
                k.set(Calendar.HOUR_OF_DAY, x[0]); k.set(Calendar.MINUTE, x[1]);
                for (int i = 0; i < 8; i++) {
                    boolean dayOk = day == 7 || (k.get(Calendar.DAY_OF_WEEK) - 1) == day;
                    if (dayOk && k.getTimeInMillis() > now + 30000) return k.getTimeInMillis();
                    k.add(Calendar.DAY_OF_MONTH, 1);
                }
                return 0;
            }
            case "h3": {
                if (!n.optBoolean("on", true)) return 0;
                int every = Math.max(1, n.optInt("every", 3));
                k.set(Calendar.MINUTE, 0);
                do {
                    k.add(Calendar.HOUR_OF_DAY, 1);
                } while (k.get(Calendar.HOUR_OF_DAY) % every != 0 || k.get(Calendar.HOUR_OF_DAY) < 6 || k.get(Calendar.HOUR_OF_DAY) > 22);
                return k.getTimeInMillis();
            }
            case "warn": {
                if (!n.optBoolean("on", true) || cfg.optString("cwaKey", "").isEmpty()) return 0;
                return now + 30 * 60_000L;
            }
        }
        return 0;
    }
}
