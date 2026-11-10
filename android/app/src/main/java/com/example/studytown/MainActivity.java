package com.example.studytown;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // super.onCreate must run first: it switches from the splash theme to the app theme.
        // Touching the window before that locks in the splash theme and shows a title bar.
        super.onCreate(savedInstanceState);
        // Draw behind the status and navigation bars; the web layer pads itself with safe-area insets.
        EdgeToEdge.enable(this);
    }
}
