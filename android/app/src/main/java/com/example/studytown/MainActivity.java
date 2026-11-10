package com.example.studytown;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Draw behind the status and navigation bars; the web layer pads itself with safe-area insets.
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);
    }
}
