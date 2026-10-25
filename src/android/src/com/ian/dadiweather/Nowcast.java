package com.ian.dadiweather;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;

import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;

/** 雷達回波分級與移動外推（與網頁版 RADAR.cls / RADAR.track 相同演算法）。 */
public class Nowcast {
    public static final double S = 20.5, N = 26.5, W = 118, E = 124;
    public static final int G = 1200;
    public static final String[] LV = {"無", "零星弱回波", "小雨", "中雨", "大雨", "豪雨", "劇烈降雨"};

    public static class Frame {
        public long time; public int w, h; public byte[] lv;
    }

    public static class Result {
        public boolean ok, moving; public int nowLv, etaLv, hereLv, near8Lv; public Integer eta, stopIn; public double spd, dirFrom, dirTo, nearestKm = -1, age; public int echoN;
    }

    static int cls(int r, int g, int b) {
        int mx = Math.max(r, Math.max(g, b)), mn = Math.min(r, Math.min(g, b)), d = mx - mn;
        if (d < 38) return 0;
        double hh;
        if (mx == r) hh = (((g - b) / (double) d) + 6) % 6; else if (mx == g) hh = (b - r) / (double) d + 2; else hh = (r - g) / (double) d + 4;
        hh *= 60;
        if (hh >= 165 && hh < 250) return 1;
        if (hh >= 75 && hh < 165) return 2;
        if (hh >= 48 && hh < 75) return 3;
        if (hh >= 22 && hh < 48) return 4;
        if (hh >= 250 && hh < 330) return 6;
        return 5;
    }

    static boolean mask(int r, int c) {
        return (r >= .70 * G && r < .945 * G && c >= .855 * G && c < .93 * G) || (r >= .905 * G && c >= .405 * G && c < .555 * G) || (r < .035 * G);
    }

    public static Frame fromPng(byte[] png, long time) {
        BitmapFactory.Options b0 = new BitmapFactory.Options();
        b0.inJustDecodeBounds = true;
        BitmapFactory.decodeByteArray(png, 0, png.length, b0);
        BitmapFactory.Options o = new BitmapFactory.Options();
        o.inSampleSize = Math.max(1, b0.outWidth / G);
        o.inPreferredConfig = Bitmap.Config.ARGB_8888;
        Bitmap bm = BitmapFactory.decodeByteArray(png, 0, png.length, o);
        if (bm == null) return null;
        if (bm.getWidth() != G || bm.getHeight() != G) { Bitmap s = Bitmap.createScaledBitmap(bm, G, G, false); bm.recycle(); bm = s; }
        byte[] lv = new byte[G * G];
        int[] row = new int[G];
        for (int r = 0; r < G; r++) {
            bm.getPixels(row, 0, G, 0, r, G, 1);
            for (int c = 0; c < G; c++) {
                if (mask(r, c)) continue;
                int p = row[c];
                if (((p >>> 24) & 0xff) < 40) continue;
                lv[r * G + c] = (byte) cls((p >> 16) & 0xff, (p >> 8) & 0xff, p & 0xff);
            }
        }
        bm.recycle();
        byte[] out = lv.clone();
        for (int r = 1; r < G - 1; r++) for (int c = 1; c < G - 1; c++) {
            int i = r * G + c;
            if (lv[i] == 0) continue;
            if (lv[i - 1] == 0 && lv[i + 1] == 0 && lv[i - G] == 0 && lv[i + G] == 0) out[i] = 0;
        }
        Frame f = new Frame(); f.time = time; f.w = G; f.h = G; f.lv = out;
        return f;
    }

    public static void save(Frame f, File file) {
        try (DataOutputStream o = new DataOutputStream(new FileOutputStream(file))) {
            o.writeLong(f.time); o.writeInt(f.w); o.writeInt(f.h); o.write(f.lv);
        } catch (Exception e) { }
    }

    public static Frame load(File file) {
        if (!file.exists()) return null;
        try (DataInputStream in = new DataInputStream(new FileInputStream(file))) {
            Frame f = new Frame(); f.time = in.readLong(); f.w = in.readInt(); f.h = in.readInt();
            f.lv = new byte[f.w * f.h]; in.readFully(f.lv); return f;
        } catch (Exception e) { return null; }
    }

    static int at(Frame f, double x, double y) {
        int xi = (int) Math.round(x), yi = (int) Math.round(y);
        if (xi < 0 || yi < 0 || xi >= f.w || yi >= f.h) return 0;
        return f.lv[yi * f.w + xi];
    }

    /** 在 (lat,lon) 附近用同來源兩張回波估計移動速度，回傳 {經度°/分, 緯度°/分}；資料不足回 null */
    public static double[] motion(Frame A, Frame B, double lat, double lon, boolean wide) {
        if (A == null || B == null || A.w != B.w || A.h != B.h) return null;
        double dt = (B.time - A.time) / 60000.0;
        if (dt < 5 || dt > 40) return null;
        int Wd = B.w, H = B.h;
        double cx = (lon - W) / (E - W) * Wd, cy = (N - lat) / (N - S) * H;
        double kmPx = (N - S) / H * 111.2;
        int win = (int) Math.round((wide ? 90 : 60) / kmPx);
        int Sx = (int) Math.ceil(100 / 60.0 * dt / kmPx);
        int step = Math.max(1, Math.round(win / 45f));
        int cap = (2 * win / step + 3) * (2 * win / step + 3);
        int[] px = new int[cap], py = new int[cap], pv = new int[cap];
        int n = 0;
        for (double y = cy - win; y <= cy + win; y += step) for (double x = cx - win; x <= cx + win; x += step) {
            int a = at(A, x, y);
            if (a >= 1 && n < cap) { px[n] = (int) Math.round(x); py[n] = (int) Math.round(y); pv[n] = a; n++; }
        }
        if (n < 15) return null;
        int ss = Math.max(1, Math.round(Sx / 20f));
        long best = Long.MAX_VALUE; int bx = 0, by = 0;
        for (int dy = -Sx; dy <= Sx; dy += ss) for (int dx = -Sx; dx <= Sx; dx += ss) {
            long c = cost(B, px, py, pv, n, dx, dy); if (c < best) { best = c; bx = dx; by = dy; }
        }
        int bx0 = bx, by0 = by;
        for (int dy = by0 - ss; dy <= by0 + ss; dy++) for (int dx = bx0 - ss; dx <= bx0 + ss; dx++) {
            long c = cost(B, px, py, pv, n, dx, dy); if (c < best) { best = c; bx = dx; by = dy; }
        }
        return new double[]{bx / dt * (E - W) / Wd, -by / dt * (N - S) / H};
    }

    /** 以最新回波 B 與移動速度 v（°/分）推算此地降雨狀態 */
    public static Result track(Frame B, double[] v, double lat, double lon) {
        Result R = new Result();
        if (B == null) return R;
        int Wd = B.w, H = B.h;
        double cx = (lon - W) / (E - W) * Wd, cy = (N - lat) / (N - S) * H;
        if (cx < 0 || cy < 0 || cx >= Wd || cy >= H) return R;
        R.ok = true;
        double kmPx = (N - S) / H * 111.2;
        int win = (int) Math.round(60 / kmPx);
        int echoN = 0; double nearest = 1e9;
        int st = Math.max(1, Math.round(win / 60f));
        for (double y = cy - win; y <= cy + win; y += st) for (double x = cx - win; x <= cx + win; x += st) {
            if (at(B, x, y) >= 2) { echoN++; double d = Math.hypot(x - cx, y - cy) * kmPx; if (d < nearest) nearest = d; }
        }
        R.echoN = echoN; R.nearestKm = nearest < 1e9 ? nearest : -1;
        double vx = 0, vy = 0;
        if (v != null && echoN > 12) { vx = v[0] / (E - W) * Wd; vy = -v[1] / (N - S) * H; R.moving = true; }
        double age = Math.max(0, (System.currentTimeMillis() - B.time) / 60000.0);
        R.age = age;
        int rad = Math.max(2, (int) Math.round(1.6 / kmPx));
        R.nowLv = near(B, cx, cy, vx, vy, age, rad);
        // 不外推的「此刻雷達圖上」：本地 3 公里、周圍 8 公里內的最強回波（判斷雨停用，避免外推誤差）
        R.hereLv = near(B, cx, cy, 0, 0, 0, Math.max(2, (int) Math.round(3 / kmPx)));
        R.near8Lv = near(B, cx, cy, 0, 0, 0, Math.max(3, (int) Math.round(8 / kmPx)));
        if (R.nowLv < 2) {
            for (int t = 1; t <= 90; t++) { int lv = near(B, cx, cy, vx, vy, age + t, rad); if (lv >= 2) { R.eta = t; R.etaLv = lv; break; } }
        } else {
            for (int t = 1; t <= 90; t++) { if (near(B, cx, cy, vx, vy, age + t, rad) < 2) { R.stopIn = t; break; } }
        }
        R.spd = Math.hypot(vx, vy) * kmPx * 60;
        R.dirTo = (Math.toDegrees(Math.atan2(vx, -vy)) + 360) % 360;
        R.dirFrom = (R.dirTo + 180) % 360;
        return R;
    }

    static long cost(Frame B, int[] px, int[] py, int[] pv, int n, int dx, int dy) {
        long c = 0;
        for (int i = 0; i < n; i++) c += Math.abs(pv[i] - at(B, px[i] + dx, py[i] + dy));
        return c;
    }

    static int near(Frame B, double cx, double cy, double vx, double vy, double t, int rad) {
        double sx = cx - vx * t, sy = cy - vy * t;
        int m = 0;
        for (int y = -rad; y <= rad; y++) for (int x = -rad; x <= rad; x++) {
            if (x * x + y * y > rad * rad) continue;
            int v = at(B, sx + x, sy + y); if (v > m) m = v;
        }
        return m;
    }
}
