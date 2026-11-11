package com.example.studytown;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Our own plugin (the ongoing study notification) has to be registered before super.onCreate.
        registerPlugin(StudyNotificationPlugin.class);
        // super.onCreate must run before the window is touched: it switches from the splash theme
        // to the app theme, and touching the window earlier locks in the splash theme's title bar.
        super.onCreate(savedInstanceState);
        // Draw behind the status and navigation bars; the web layer pads itself with safe-area insets.
        EdgeToEdge.enable(this);
    }
}
