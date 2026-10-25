package com.ian.dadiweather;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        Sched.all(c);
        RainService.sync(c);
    }
}
