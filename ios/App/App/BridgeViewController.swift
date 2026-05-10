import Capacitor
import UIKit
import WebKit

final class BridgeViewController: CAPBridgeViewController, WKScriptMessageHandler {
    private static let backgroundMessageHandler = "exBackground"
    private static let backgroundSyncScript = """
    (() => {
      const handler = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.exBackground;
      if (!handler) return;

      const transparent = new Set(["transparent", "rgba(0, 0, 0, 0)"]);
      const pageBackground = () => {
        const candidates = [document.body, document.documentElement].filter(Boolean);
        for (const node of candidates) {
          const color = getComputedStyle(node).backgroundColor;
          if (color && !transparent.has(color)) return color;
        }
        return "";
      };

      let lastColor = "";
      const send = () => {
        const color = pageBackground();
        if (!color || color === lastColor) return;
        lastColor = color;
        handler.postMessage(color);
      };
      const schedule = () => requestAnimationFrame(send);

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", schedule, { once: true });
      }
      schedule();

      const observer = new MutationObserver(schedule);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });

      const observeBody = () => {
        if (document.body) {
          observer.observe(document.body, { attributes: true, attributeFilter: ["class", "style"] });
        }
      };
      observeBody();
      document.addEventListener("DOMContentLoaded", observeBody, { once: true });

      const media = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
      if (media && media.addEventListener) {
        media.addEventListener("change", schedule);
      }
    })();
    """

    private let fallbackBackgroundColor = UIColor.systemBackground

    override var preferredStatusBarStyle: UIStatusBarStyle {
        .lightContent
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        applyWebPageBackgroundColor(fallbackBackgroundColor)
    }

    override func webView(with frame: CGRect, configuration: WKWebViewConfiguration) -> WKWebView {
        configuration.userContentController.addUserScript(
            WKUserScript(
                source: Self.backgroundSyncScript,
                injectionTime: .atDocumentEnd,
                forMainFrameOnly: true
            )
        )
        configuration.userContentController.add(self, name: Self.backgroundMessageHandler)

        let webView = AppWebView(frame: frame, configuration: configuration)
        configureWebViewBackground(webView, color: fallbackBackgroundColor)
        return webView
    }

    deinit {
        webView?.configuration.userContentController.removeScriptMessageHandler(
            forName: Self.backgroundMessageHandler
        )
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(ServerNavigation())
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == Self.backgroundMessageHandler,
              let cssColor = message.body as? String,
              let color = UIColor(cssColor: cssColor)
        else {
            return
        }

        DispatchQueue.main.async { [weak self] in
            self?.applyWebPageBackgroundColor(color)
        }
    }

    private func applyWebPageBackgroundColor(_ color: UIColor) {
        view.backgroundColor = color
        if let webView {
            configureWebViewBackground(webView, color: color)
        }
    }

    private func configureWebViewBackground(_ webView: WKWebView, color: UIColor) {
        webView.backgroundColor = color
        webView.scrollView.backgroundColor = color
        webView.isOpaque = false
        webView.allowsLinkPreview = false

        if #available(iOS 15.0, *) {
            webView.underPageBackgroundColor = color
        }
    }
}

private final class AppWebView: WKWebView {
    override var inputAccessoryView: UIView? {
        nil
    }
}

private extension UIColor {
    convenience init?(cssColor rawValue: String) {
        let value = rawValue.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

        if value.hasPrefix("#") {
            self.init(hexColor: value)
            return
        }

        if value.hasPrefix("rgb") {
            self.init(rgbColor: value)
            return
        }

        if value.hasPrefix("color(srgb") {
            self.init(srgbColor: value)
            return
        }

        return nil
    }

    private convenience init?(hexColor value: String) {
        let hex = String(value.dropFirst())
        guard hex.count == 6, let number = Int(hex, radix: 16) else {
            return nil
        }

        self.init(
            red: CGFloat((number >> 16) & 0xff) / 255,
            green: CGFloat((number >> 8) & 0xff) / 255,
            blue: CGFloat(number & 0xff) / 255,
            alpha: 1
        )
    }

    private convenience init?(rgbColor value: String) {
        guard let content = Self.parenthesizedContent(value) else {
            return nil
        }

        let tokens = Self.colorTokens(content)
        guard tokens.count >= 3,
              let red = Self.rgbComponent(tokens[0]),
              let green = Self.rgbComponent(tokens[1]),
              let blue = Self.rgbComponent(tokens[2])
        else {
            return nil
        }

        let alpha = tokens.count >= 4 ? Self.alphaComponent(tokens[3]) ?? 1 : 1
        self.init(red: red, green: green, blue: blue, alpha: alpha)
    }

    private convenience init?(srgbColor value: String) {
        guard let content = Self.parenthesizedContent(value) else {
            return nil
        }

        let tokens = Self.colorTokens(content.replacingOccurrences(of: "srgb", with: ""))
        guard tokens.count >= 3,
              let red = Double(tokens[0]),
              let green = Double(tokens[1]),
              let blue = Double(tokens[2])
        else {
            return nil
        }

        let alpha = tokens.count >= 4 ? Self.alphaComponent(tokens[3]) ?? 1 : 1
        self.init(red: CGFloat(red), green: CGFloat(green), blue: CGFloat(blue), alpha: alpha)
    }

    private static func parenthesizedContent(_ value: String) -> String? {
        guard let open = value.firstIndex(of: "("),
              let close = value.lastIndex(of: ")"),
              open < close
        else {
            return nil
        }

        return String(value[value.index(after: open)..<close])
    }

    private static func colorTokens(_ content: String) -> [String] {
        content
            .replacingOccurrences(of: "/", with: " ")
            .split { character in
                character == "," || character == " "
            }
            .map(String.init)
    }

    private static func rgbComponent(_ token: String) -> CGFloat? {
        if token.hasSuffix("%") {
            guard let percent = Double(token.dropLast()) else {
                return nil
            }
            return CGFloat(percent / 100)
        }

        guard let value = Double(token) else {
            return nil
        }
        return CGFloat(value / 255)
    }

    private static func alphaComponent(_ token: String) -> CGFloat? {
        if token.hasSuffix("%") {
            guard let percent = Double(token.dropLast()) else {
                return nil
            }
            return CGFloat(percent / 100)
        }

        guard let value = Double(token) else {
            return nil
        }
        return CGFloat(value)
    }
}
