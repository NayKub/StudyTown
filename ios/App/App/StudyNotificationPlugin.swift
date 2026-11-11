// The "studying" Live Activity on the lock screen and in the Dynamic Island while the app is closed.
// It counts down by itself, so the app does not need to keep running. Same JavaScript name as the
// Android plugin (StudyNotificationPlugin.java), so the web code calls one plugin on both.
import Foundation
import Capacitor

#if canImport(ActivityKit)
import ActivityKit
#endif

@objc(StudyNotificationPlugin)
public class StudyNotificationPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "StudyNotificationPlugin"
    public let jsName = "StudyNotification"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hide", returnType: CAPPluginReturnPromise),
    ]

    /// Start the Live Activity, or update the one already showing.
    @objc func show(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        guard #available(iOS 16.2, *) else { return call.resolve() }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return call.resolve() }

        let endsAtMs = call.getDouble("endsAt") ?? 0
        let paused = call.getBool("paused") ?? false
        let state = StudyActivityAttributes.ContentState(
            endsAt: Date(timeIntervalSince1970: endsAtMs / 1000),
            paused: paused,
            remaining: call.getString("remaining") ?? "",
            title: call.getString("title") ?? "",
            text: call.getString("text") ?? ""
        )
        // after the end time the activity is marked stale, so it can never look like it is still running
        let content = ActivityContent(state: state, staleDate: paused ? nil : state.endsAt)
        let appName = call.getString("appName") ?? ""

        Task {
            if let current = Activity<StudyActivityAttributes>.activities.first {
                await current.update(content)
            } else {
                do {
                    _ = try Activity.request(
                        attributes: StudyActivityAttributes(appName: appName),
                        content: content,
                        pushType: nil
                    )
                } catch {
                    call.reject("Could not start the Live Activity: \(error.localizedDescription)")
                    return
                }
            }
            call.resolve()
        }
        #else
        call.resolve()
        #endif
    }

    /// Remove the Live Activity (the app is open again, or the session ended).
    @objc func hide(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        guard #available(iOS 16.2, *) else { return call.resolve() }
        Task {
            for activity in Activity<StudyActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            call.resolve()
        }
        #else
        call.resolve()
        #endif
    }
}
