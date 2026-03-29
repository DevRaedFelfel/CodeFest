package com.codefest.app;

import android.content.Context;
import android.hardware.display.DisplayManager;
import android.view.Display;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Capacitor plugin for detecting external displays and screen mirroring.
 *
 * Detects HDMI, USB-C, MHL, Chromecast, Miracast, and wireless display connections.
 * Fires events when displays are connected/disconnected so the Angular app can
 * show a blocking overlay during exams.
 *
 * JS API:
 *   Display.getConnectedDisplays()
 *   Display.isScreenMirroring()
 *   Display.addListener('displayChanged', callback)
 */
@CapacitorPlugin(name = "Display")
public class DisplayPlugin extends Plugin {

    private DisplayManager displayManager;
    private DisplayManager.DisplayListener displayListener;

    @Override
    public void load() {
        displayManager = (DisplayManager)
            getContext().getSystemService(Context.DISPLAY_SERVICE);

        displayListener = new DisplayManager.DisplayListener() {
            @Override
            public void onDisplayAdded(int displayId) {
                reportDisplayChange();
            }

            @Override
            public void onDisplayRemoved(int displayId) {
                reportDisplayChange();
            }

            @Override
            public void onDisplayChanged(int displayId) {
                reportDisplayChange();
            }
        };

        displayManager.registerDisplayListener(displayListener, null);
    }

    @PluginMethod
    public void getConnectedDisplays(PluginCall call) {
        Display[] displays = displayManager.getDisplays();

        JSObject ret = new JSObject();
        ret.put("count", displays.length);

        JSArray arr = new JSArray();
        for (Display d : displays) {
            JSObject info = new JSObject();
            info.put("id", d.getDisplayId());
            info.put("name", d.getName());
            info.put("isDefault", d.getDisplayId() == Display.DEFAULT_DISPLAY);
            info.put("width", d.getMode().getPhysicalWidth());
            info.put("height", d.getMode().getPhysicalHeight());
            arr.put(info);
        }
        ret.put("displays", arr);
        call.resolve(ret);
    }

    @PluginMethod
    public void isScreenMirroring(PluginCall call) {
        Display[] displays = displayManager.getDisplays(
            DisplayManager.DISPLAY_CATEGORY_PRESENTATION);

        JSObject ret = new JSObject();
        ret.put("isMirroring", displays.length > 0);
        ret.put("presentationDisplayCount", displays.length);
        call.resolve(ret);
    }

    private void reportDisplayChange() {
        Display[] displays = displayManager.getDisplays();
        JSObject data = new JSObject();
        data.put("count", displays.length);
        data.put("timestamp", System.currentTimeMillis());

        Display[] presentationDisplays = displayManager.getDisplays(
            DisplayManager.DISPLAY_CATEGORY_PRESENTATION);
        data.put("isMirroring", presentationDisplays.length > 0);

        notifyListeners("displayChanged", data);
    }

    @Override
    protected void handleOnDestroy() {
        if (displayManager != null && displayListener != null) {
            displayManager.unregisterDisplayListener(displayListener);
        }
        super.handleOnDestroy();
    }
}
