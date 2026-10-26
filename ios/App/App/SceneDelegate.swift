import Capacitor
import UIKit

// UIKit from the iOS 27 SDK refuses to launch an app that has not adopted the
// scene lifecycle. The window and its BridgeViewController still come from
// Main.storyboard (UISceneStoryboardFile in Info.plist); this delegate only
// forwards scene events to Capacitor so deep links and universal links reach
// the plugins the same way they did through the app delegate.
final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
