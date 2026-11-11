// The app's root view controller. Capacitor finds plugins from npm packages by itself; plugins that
// live in this app's own code have to be registered here.
import UIKit
import Capacitor

class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(StudyNotificationPlugin())
    }
}
