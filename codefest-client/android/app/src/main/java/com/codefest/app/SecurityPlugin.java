package com.codefest.app;

import android.content.pm.PackageManager;
import android.os.Build;
import android.view.WindowManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.security.MessageDigest;

/**
 * Capacitor plugin for security enforcement on Android.
 *
 * Handles:
 * - FLAG_SECURE to block screenshots, screen recording, casting content
 * - Root detection (su binary, Magisk, SuperSU, test-keys)
 * - Device info for audit trail
 *
 * JS API:
 *   Security.blockScreenCapture()
 *   Security.isRooted()
 *   Security.getDeviceInfo()
 */
@CapacitorPlugin(name = "Security")
public class SecurityPlugin extends Plugin {

    @PluginMethod
    public void blockScreenCapture(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            getActivity().getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE
            );
        });

        JSObject ret = new JSObject();
        ret.put("blocked", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void isRooted(PluginCall call) {
        boolean rooted = checkRootIndicators();

        JSObject ret = new JSObject();
        ret.put("isRooted", rooted);
        ret.put("indicators", getRootIndicators());
        call.resolve(ret);
    }

    @PluginMethod
    public void getDeviceInfo(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("manufacturer", Build.MANUFACTURER);
        ret.put("model", Build.MODEL);
        ret.put("androidVersion", Build.VERSION.RELEASE);
        ret.put("apiLevel", Build.VERSION.SDK_INT);
        ret.put("serialHash", getDeviceHash());
        call.resolve(ret);
    }

    private boolean checkRootIndicators() {
        // Check 1: su binary exists in known locations
        String[] paths = {
            "/system/bin/su", "/system/xbin/su",
            "/sbin/su", "/data/local/xbin/su",
            "/data/local/bin/su", "/data/local/su"
        };
        for (String path : paths) {
            if (new File(path).exists()) return true;
        }

        // Check 2: Build tags contain "test-keys"
        if (Build.TAGS != null && Build.TAGS.contains("test-keys")) return true;

        // Check 3: Known root management apps installed
        String[] rootApps = {
            "com.topjohnwu.magisk",
            "eu.chainfire.supersu",
            "com.koushikdutta.superuser"
        };
        PackageManager pm = getContext().getPackageManager();
        for (String pkg : rootApps) {
            try {
                pm.getPackageInfo(pkg, 0);
                return true;
            } catch (PackageManager.NameNotFoundException e) {
                // Not installed
            }
        }

        return false;
    }

    private String getRootIndicators() {
        StringBuilder indicators = new StringBuilder();

        String[] paths = {
            "/system/bin/su", "/system/xbin/su",
            "/sbin/su", "/data/local/xbin/su",
            "/data/local/bin/su", "/data/local/su"
        };
        for (String path : paths) {
            if (new File(path).exists()) {
                if (indicators.length() > 0) indicators.append(",");
                indicators.append("su_binary");
                break;
            }
        }

        if (Build.TAGS != null && Build.TAGS.contains("test-keys")) {
            if (indicators.length() > 0) indicators.append(",");
            indicators.append("test_keys");
        }

        String[] rootApps = {
            "com.topjohnwu.magisk",
            "eu.chainfire.supersu",
            "com.koushikdutta.superuser"
        };
        PackageManager pm = getContext().getPackageManager();
        for (String pkg : rootApps) {
            try {
                pm.getPackageInfo(pkg, 0);
                if (indicators.length() > 0) indicators.append(",");
                indicators.append(pkg.substring(pkg.lastIndexOf('.') + 1));
            } catch (PackageManager.NameNotFoundException e) {
                // Not installed
            }
        }

        return indicators.toString();
    }

    private String getDeviceHash() {
        String raw = Build.MANUFACTURER + Build.MODEL + Build.BOARD;
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(raw.getBytes());
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) hex.append(String.format("%02x", b));
            return hex.toString().substring(0, 16);
        } catch (Exception e) {
            return "unknown";
        }
    }
}
