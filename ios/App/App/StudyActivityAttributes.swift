// What the study Live Activity shows. This file is compiled into both the app (which starts and
// updates the activity) and the StudyWidget extension (which draws it).
import Foundation

#if canImport(ActivityKit)
import ActivityKit

@available(iOS 16.1, *)
struct StudyActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        /// When the session ends. While paused this is not used.
        var endsAt: Date
        var paused: Bool
        /// Time left as "12:34", shown while paused.
        var remaining: String
        /// "Studying" or "Paused", already in the user's language.
        var title: String
        /// "Ends at 15:32" or "12:34 left".
        var text: String
    }

    var appName: String
}
#endif
