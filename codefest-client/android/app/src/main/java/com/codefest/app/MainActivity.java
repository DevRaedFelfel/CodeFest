package com.codefest.app;

import android.app.ActivityManager;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Log;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "CodeFest";

    private DevicePolicyManager dpm;
    private ComponentName adminComponent;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Register Capacitor plugins BEFORE super.onCreate
        registerPlugin(LockTaskPlugin.class);
        registerPlugin(DisplayPlugin.class);
        registerPlugin(SecurityPlugin.class);

        super.onCreate(savedInstanceState);

        dpm = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        adminComponent = new ComponentName(this, AdminReceiver.class);

        // Set FLAG_SECURE immediately to block screenshots/recording
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        );

        setupDeviceOwnerPolicies();
        enterLockTaskMode();
    }

    private void setupDeviceOwnerPolicies() {
        if (dpm == null || !dpm.isDeviceOwnerApp(getPackageName())) {
            Log.w(TAG, "Not Device Owner. Kiosk will be soft-locked (Level 1).");
            return;
        }

        // Whitelist this app for lock task mode (no user prompt) — API 21+
        dpm.setLockTaskPackages(adminComponent, new String[]{getPackageName()});

        // Disable all system features in lock task mode — API 28+ only
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            dpm.setLockTaskFeatures(adminComponent,
                DevicePolicyManager.LOCK_TASK_FEATURE_NONE);
        }

        // Block uninstallation of this app — API 21+
        dpm.setUninstallBlocked(adminComponent, getPackageName(), true);

        // Disable status bar expansion — API 23+
        dpm.setStatusBarDisabled(adminComponent, true);

        // Keep screen on while plugged in (AC, USB, or wireless)
        try {
            dpm.setGlobalSetting(adminComponent,
                Settings.Global.STAY_ON_WHILE_PLUGGED_IN, "7");
        } catch (Exception e) {
            Log.w(TAG, "Could not set stay-on-while-plugged: " + e.getMessage());
        }

        Log.i(TAG, "Device Owner policies configured (API " + Build.VERSION.SDK_INT + ")");
    }

    private void enterLockTaskMode() {
        try {
            if (dpm != null && dpm.isDeviceOwnerApp(getPackageName())) {
                // Level 2: silent lock — no user prompt
                startLockTask();
                Log.i(TAG, "Lock Task Mode entered (Device Owner - Level 2)");
            } else {
                // Level 1: will show system confirmation dialog
                startLockTask();
                Log.i(TAG, "Lock Task Mode entered (user-confirmed - Level 1)");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to enter lock task mode: " + e.getMessage());
        }
    }

    @Override
    public void onBackPressed() {
        // Block the back button entirely during exam
        Log.d(TAG, "Back button blocked");
    }

    @Override
    public void onPause() {
        super.onPause();
        Log.w(TAG, "App paused — possible security event");
    }

    @Override
    public void onResume() {
        super.onResume();
        // getLockTaskModeState() requires API 23+, which is our min
        ActivityManager am = (ActivityManager) getSystemService(ACTIVITY_SERVICE);
        if (am != null && am.getLockTaskModeState() == ActivityManager.LOCK_TASK_MODE_NONE) {
            enterLockTaskMode();
            Log.w(TAG, "Lock Task Mode was not active on resume — re-entered");
        }
    }

    public boolean isDeviceOwner() {
        return dpm != null && dpm.isDeviceOwnerApp(getPackageName());
    }
}
