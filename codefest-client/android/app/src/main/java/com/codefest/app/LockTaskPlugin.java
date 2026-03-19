package com.codefest.app;

import android.app.Activity;
import android.app.ActivityManager;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Capacitor plugin for Android Lock Task (Kiosk) mode.
 *
 * Level 1 (Screen Pinning): Works without device owner, user sees confirmation dialog.
 * Level 2 (Lock Task): Requires device owner, no user confirmation needed.
 *
 * JS API:
 *   LockTask.startLockTask()
 *   LockTask.stopLockTask({ pin: '1234' })
 *   LockTask.isInLockTaskMode()
 *   LockTask.isDeviceOwner()
 */
@CapacitorPlugin(name = "LockTask")
public class LockTaskPlugin extends Plugin {

    // Default teacher PIN — override via plugin call
    private static final String DEFAULT_PIN = "1234";

    @PluginMethod
    public void startLockTask(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity not available");
            return;
        }

        try {
            // If device owner, set this package as an allowed lock task package
            DevicePolicyManager dpm = (DevicePolicyManager) activity.getSystemService(Context.DEVICE_POLICY_SERVICE);
            ComponentName admin = AdminReceiver.getComponentName(activity);

            if (dpm != null && dpm.isDeviceOwnerApp(activity.getPackageName())) {
                // Level 2: Enterprise lock task — no user confirmation
                dpm.setLockTaskPackages(admin, new String[]{activity.getPackageName()});
                activity.startLockTask();
            } else {
                // Level 1: Screen pinning — user sees confirmation dialog
                activity.startLockTask();
            }

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("level", dpm != null && dpm.isDeviceOwnerApp(activity.getPackageName()) ? 2 : 1);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to start lock task: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopLockTask(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity not available");
            return;
        }

        String pin = call.getString("pin", "");
        String expectedPin = DEFAULT_PIN;

        if (!expectedPin.equals(pin)) {
            call.reject("Invalid PIN");
            return;
        }

        try {
            activity.stopLockTask();

            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to stop lock task: " + e.getMessage());
        }
    }

    @PluginMethod
    public void isInLockTaskMode(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity not available");
            return;
        }

        ActivityManager am = (ActivityManager) activity.getSystemService(Context.ACTIVITY_SERVICE);
        boolean isLocked = false;

        if (am != null) {
            int lockTaskMode = am.getLockTaskModeState();
            isLocked = lockTaskMode != ActivityManager.LOCK_TASK_MODE_NONE;
        }

        JSObject result = new JSObject();
        result.put("isLocked", isLocked);
        call.resolve(result);
    }

    @PluginMethod
    public void isDeviceOwner(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity not available");
            return;
        }

        DevicePolicyManager dpm = (DevicePolicyManager) activity.getSystemService(Context.DEVICE_POLICY_SERVICE);
        boolean isOwner = dpm != null && dpm.isDeviceOwnerApp(activity.getPackageName());

        JSObject result = new JSObject();
        result.put("isDeviceOwner", isOwner);
        call.resolve(result);
    }
}
