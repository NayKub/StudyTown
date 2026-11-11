// The app's widget extension. It only contains the study Live Activity.
import WidgetKit
import SwiftUI

@main
struct StudyWidgetBundle: WidgetBundle {
    var body: some Widget {
        StudyLiveActivity()
    }
}
