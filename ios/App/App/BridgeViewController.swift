import Capacitor
import UIKit
import WebKit

final class BridgeViewController: CAPBridgeViewController {
    override var preferredStatusBarStyle: UIStatusBarStyle {
        .lightContent
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.102, green: 0.114, blue: 0.129, alpha: 1)
        webView?.backgroundColor = view.backgroundColor
        webView?.isOpaque = false
        webView?.allowsLinkPreview = false
    }

    override func webView(with frame: CGRect, configuration: WKWebViewConfiguration) -> WKWebView {
        let webView = AppWebView(frame: frame, configuration: configuration)
        webView.allowsLinkPreview = false
        return webView
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(ServerNavigation())
    }
}

private final class AppWebView: WKWebView {
    override var inputAccessoryView: UIView? {
        nil
    }
}
