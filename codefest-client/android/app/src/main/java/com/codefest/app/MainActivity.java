package com.codefest.app;

import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Register the LockTask plugin before super.onCreate
        registerPlugin(LockTaskPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Auto-start lock task if device owner
        if (isDeviceOwner()) {
            try {
                startLockTask();
            } catch (Exception e) {
                // Not device owner or lock task not allowed
            }
        }
    }

    public boolean isDeviceOwner() {
        DevicePolicyManager dpm = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName admin = new ComponentName(this, AdminReceiver.class);
        return dpm != null && dpm.isDeviceOwnerApp(getPackageName());
    }
}
