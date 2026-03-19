package com.codefest.app;

import android.app.admin.DeviceAdminReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;

/**
 * Device Admin Receiver for enterprise-grade kiosk mode (Level 2).
 *
 * To set as device owner (requires factory reset or no accounts on device):
 *   adb shell dpm set-device-owner com.codefest.app/.AdminReceiver
 *
 * To remove device owner:
 *   adb shell dpm remove-active-admin com.codefest.app/.AdminReceiver
 */
public class AdminReceiver extends DeviceAdminReceiver {

    public static ComponentName getComponentName(Context context) {
        return new ComponentName(context.getApplicationContext(), AdminReceiver.class);
    }

    @Override
    public void onEnabled(Context context, Intent intent) {
        super.onEnabled(context, intent);
    }

    @Override
    public void onDisabled(Context context, Intent intent) {
        super.onDisabled(context, intent);
    }
}
