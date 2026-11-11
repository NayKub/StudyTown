package com.example.studytown;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The ongoing "studying" notification shown while the app is closed. While the timer runs, the
 * notification counts down by itself (like the Clock app), so the app does not need to keep running.
 * It removes itself when the time is up.
 */
@CapacitorPlugin(name = "StudyNotification")
public class StudyNotificationPlugin extends Plugin {

    private static final String CHANNEL_ID = "study_session";
    private static final int NOTIFICATION_ID = 7101;

    @PluginMethod
    public void show(PluginCall call) {
        Context context = getContext();
        if (!canNotify(context)) {
            call.resolve(); // the user said no to notifications; nothing to show
            return;
        }
        JSObject data = call.getData();
        long endsAt = data.optLong("endsAt", 0); // milliseconds since 1970; 0 while paused
        boolean paused = data.optBoolean("paused", false);
        String title = data.optString("title", "");
        String text = data.optString("text", "");
        createChannel(context, data.optString("channelName", "Study session"));

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_study)
            .setColor(0xFFFF8FAB)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(openAppIntent(context))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);

        long now = System.currentTimeMillis();
        if (!paused && endsAt > now) {
            builder
                .setWhen(endsAt)
                .setShowWhen(true)
                .setUsesChronometer(true)
                .setChronometerCountDown(true)
                .setTimeoutAfter(endsAt - now); // gone when the time is up; the "time's up" alert takes over
        } else {
            builder.setShowWhen(false);
        }

        NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, builder.build());
        call.resolve();
    }

    @PluginMethod
    public void hide(PluginCall call) {
        NotificationManagerCompat.from(getContext()).cancel(NOTIFICATION_ID);
        call.resolve();
    }

    private static boolean canNotify(Context context) {
        if (Build.VERSION.SDK_INT >= 33) {
            int granted = ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS);
            if (granted != PackageManager.PERMISSION_GRANTED) return false;
        }
        return NotificationManagerCompat.from(context).areNotificationsEnabled();
    }

    /** A quiet channel: no sound, no vibration, no badge on the app icon. */
    private static void createChannel(Context context, String name) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, NotificationManager.IMPORTANCE_LOW);
        channel.setShowBadge(false);
        channel.setSound(null, null);
        channel.enableVibration(false);
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    /** Tapping the notification brings the app back to the front. */
    private static PendingIntent openAppIntent(Context context) {
        Intent intent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (intent == null) intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
}
