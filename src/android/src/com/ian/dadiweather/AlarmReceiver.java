package com.ian.dadiweather;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.PowerManager;

public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        final String kind = i.getStringExtra("kind");
        if (kind == null) return;
        final PendingResult pr = goAsync();
        final Context app = c.getApplicationContext();
        PowerManager pm = (PowerManager) app.getSystemService(Context.POWER_SERVICE);
        final PowerManager.WakeLock wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "dadi:alarm");
        wl.acquire(55_000);
        new Thread(() -> {
            try {
                if ("warn".equals(kind)) Weather.checkWarnings(app);
                else {
                    String[] tb = Weather.compose(app, kind);
                    if (tb != null) Notif.show(app, tb[0], tb[1], kind);
                }
            } catch (Exception e) {
            } finally {
                Sched.one(app, kind);
                try { wl.release(); } catch (Exception e) { }
                pr.finish();
            }
        }).start();
    }
}
