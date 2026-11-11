// How the study session looks on the lock screen and in the Dynamic Island.
import ActivityKit
import SwiftUI
import WidgetKit

private let pink = Color(red: 1.0, green: 0.56, blue: 0.67) // #ff8fab, the app's accent
private let ink = Color(red: 0.29, green: 0.23, blue: 0.32) // #4a3b52
private let paper = Color(red: 1.0, green: 0.95, blue: 0.91) // #fdf3e7

/// The time left. While running it counts down on its own; while paused it shows the frozen value.
struct TimeLeft: View {
    let state: StudyActivityAttributes.ContentState

    var body: some View {
        if state.paused {
            Text(state.remaining)
        } else {
            Text(timerInterval: Date.now...max(Date.now, state.endsAt), countsDown: true)
        }
    }
}

struct StudyLockScreenView: View {
    let context: ActivityViewContext<StudyActivityAttributes>

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: context.state.paused ? "pause.circle.fill" : "book.circle.fill")
                .font(.system(size: 40))
                .foregroundStyle(pink)
            VStack(alignment: .leading, spacing: 2) {
                Text(context.attributes.appName)
                    .font(.caption)
                    .foregroundStyle(ink.opacity(0.7))
                Text(context.state.title)
                    .font(.headline)
                    .foregroundStyle(ink)
                Text(context.state.text)
                    .font(.caption)
                    .foregroundStyle(ink.opacity(0.7))
            }
            Spacer(minLength: 8)
            TimeLeft(state: context.state)
                .font(.system(size: 34, weight: .bold, design: .rounded).monospacedDigit())
                .foregroundStyle(ink)
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: 130, alignment: .trailing)
        }
        .padding(16)
    }
}

struct StudyLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: StudyActivityAttributes.self) { context in
            StudyLockScreenView(context: context)
                .activityBackgroundTint(paper)
                .activitySystemActionForegroundColor(ink)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: context.state.paused ? "pause.circle.fill" : "book.circle.fill")
                        .font(.title)
                        .foregroundStyle(pink)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    TimeLeft(state: context.state)
                        .font(.title2.monospacedDigit().bold())
                        .frame(maxWidth: 110, alignment: .trailing)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text("\(context.state.title) · \(context.state.text)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            } compactLeading: {
                Image(systemName: context.state.paused ? "pause.fill" : "book.fill")
                    .foregroundStyle(pink)
            } compactTrailing: {
                TimeLeft(state: context.state)
                    .monospacedDigit()
                    .frame(maxWidth: 50)
            } minimal: {
                Image(systemName: "book.fill")
                    .foregroundStyle(pink)
            }
            .keylineTint(pink)
        }
    }
}
