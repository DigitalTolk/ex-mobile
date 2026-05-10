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
      const normalizeColor = (color) => {
        if (!color) return "";
        const probe = document.createElement("span");
        probe.style.position = "fixed";
        probe.style.pointerEvents = "none";
        probe.style.opacity = "0";
        probe.style.backgroundColor = color;
        document.documentElement.appendChild(probe);
        const normalized = getComputedStyle(probe).backgroundColor;
        probe.remove();
        if (!normalized || transparent.has(normalized)) return "";

        if (normalized.startsWith("rgb") || normalized.startsWith("#")) {
          return normalized;
        }

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) return normalized;

        context.fillStyle = "#000000";
        context.fillStyle = normalized;
        return context.fillStyle || normalized;
      };
      const explicitKeyboardBackground = () => {
        const candidates = [document.documentElement, document.body].filter(Boolean);
        for (const node of candidates) {
          const color = getComputedStyle(node).getPropertyValue("--ex-keyboard-background").trim();
          const normalized = normalizeColor(color);
          if (normalized) return normalized;
        }
        return "";
      };
      const visibleKeyboardBackdropElements = () => {
        const width = Math.max(1, window.innerWidth);
        const height = Math.max(1, window.innerHeight);
        const edgeInset = 8;
        const bottomInset = 8;
        const points = [
          [edgeInset, height - bottomInset],
          [width - edgeInset, height - bottomInset],
          [edgeInset, height - 48],
          [width - edgeInset, height - 48],
          [Math.floor(width / 2), height - bottomInset],
        ];

        return points
          .map(([x, y]) => document.elementFromPoint(
            Math.max(1, Math.min(width - 1, x)),
            Math.max(1, Math.min(height - 1, y))
          ))
          .filter(Boolean);
      };
      const visibleBackground = (starts) => {
        const candidates = [];
        for (const start of starts) {
          let current = start;
          while (current && current.nodeType === Node.ELEMENT_NODE) {
            candidates.push(current);
            current = current.parentElement;
          }
        }
        candidates.push(document.body, document.documentElement);

        for (const node of candidates) {
          if (!node) continue;
          const color = getComputedStyle(node).backgroundColor;
          const normalized = normalizeColor(color);
          if (normalized) return normalized;
        }
        return "";
      };

      let lastColor = "";
      const send = () => {
        const color = explicitKeyboardBackground() || visibleBackground(visibleKeyboardBackdropElements());
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
      window.addEventListener("resize", schedule);
    })();
    """
    private static let focusRestoreScript = """
    (() => {
      if (window.__exMobileFocusRestoreInstalled) return;
      window.__exMobileFocusRestoreInstalled = true;

      let lastFocusedEditable = null;
      const isEditable = (element) => {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
        if (element.matches("textarea, input:not([type=button]):not([type=checkbox]):not([type=radio]):not([type=submit])")) {
          return !element.disabled && !element.readOnly;
        }
        return element.isContentEditable || Boolean(element.closest("[contenteditable='true']"));
      };
      const scrollParents = (element) => {
        const parents = [];
        let current = element && element.parentElement;
        while (current && current !== document.body && current !== document.documentElement) {
          const style = getComputedStyle(current);
          if (/(auto|scroll|overlay)/.test(style.overflowY) && current.scrollHeight > current.clientHeight) {
            parents.push(current);
          }
          current = current.parentElement;
        }
        return parents;
      };
      const keepEditableVisible = (target) => {
        const visualViewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        const bottomPadding = 24;

        try {
          target.scrollIntoView({ block: "nearest", inline: "nearest" });
        } catch (_) {
          target.scrollIntoView(false);
        }

        for (const parent of scrollParents(target)) {
          const targetRect = target.getBoundingClientRect();
          const parentRect = parent.getBoundingClientRect();
          if (targetRect.bottom > parentRect.bottom - bottomPadding) {
            parent.scrollTop += targetRect.bottom - parentRect.bottom + bottomPadding;
          }
        }

        const targetRect = target.getBoundingClientRect();
        if (targetRect.bottom > visualViewportHeight - bottomPadding) {
          window.scrollBy(0, targetRect.bottom - visualViewportHeight + bottomPadding);
        }
      };
      const keepEditableVisibleSoon = (target) => {
        requestAnimationFrame(() => keepEditableVisible(target));
        setTimeout(() => keepEditableVisible(target), 120);
        setTimeout(() => keepEditableVisible(target), 300);
      };

      document.addEventListener("focusin", (event) => {
        const target = event.target && event.target.closest
          ? event.target.closest("textarea, input, [contenteditable='true']")
          : event.target;
        if (isEditable(target)) {
          lastFocusedEditable = target;
        }
      }, true);

      window.__exMobileRestoreFocus = () => {
        const target = lastFocusedEditable;
        if (!isEditable(target) || !target.isConnected) return false;
        if (document.activeElement === target) return true;

        try {
          target.focus({ preventScroll: true });
        } catch (_) {
          target.focus();
        }
        keepEditableVisibleSoon(target);
        return document.activeElement === target;
      };
    })();
    """

    private let fallbackBackgroundColor = UIColor(red: 0.102, green: 0.114, blue: 0.129, alpha: 1)
    private let keyboardBackgroundView = UIView()
    private var lastPageBackgroundColor: UIColor?
    private var keyboardVisible = false

    override var preferredStatusBarStyle: UIStatusBarStyle {
        .lightContent
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        configureKeyboardBackgroundView()
        applyWebPageBackgroundColor(fallbackBackgroundColor)
        registerKeyboardBackgroundNotifications()
        registerApplicationFocusRestoreNotifications()
    }

    override func webView(with frame: CGRect, configuration: WKWebViewConfiguration) -> WKWebView {
        configuration.userContentController.addUserScript(
            WKUserScript(
                source: Self.backgroundSyncScript,
                injectionTime: .atDocumentEnd,
                forMainFrameOnly: true
            )
        )
        configuration.userContentController.addUserScript(
            WKUserScript(
                source: Self.focusRestoreScript,
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
        NotificationCenter.default.removeObserver(self)
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
        lastPageBackgroundColor = color
        view.backgroundColor = color
        keyboardBackgroundView.backgroundColor = color
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

    private func configureKeyboardBackgroundView() {
        keyboardBackgroundView.isHidden = true
        keyboardBackgroundView.isUserInteractionEnabled = false
        keyboardBackgroundView.backgroundColor = fallbackBackgroundColor
        view.addSubview(keyboardBackgroundView)
    }

    private func registerKeyboardBackgroundNotifications() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(keyboardWillChangeFrame(_:)),
            name: UIResponder.keyboardWillChangeFrameNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(keyboardWillHide(_:)),
            name: UIResponder.keyboardWillHideNotification,
            object: nil
        )
    }

    private func registerApplicationFocusRestoreNotifications() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(applicationDidBecomeActive),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )
    }

    @objc private func keyboardWillChangeFrame(_ notification: Notification) {
        guard let endFrame = notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else {
            return
        }

        let keyboardFrame = view.convert(endFrame, from: nil)
        let keyboardIntersection = view.bounds.intersection(keyboardFrame)
        guard !keyboardIntersection.isNull, keyboardIntersection.height > 0 else {
            keyboardVisible = false
            keyboardBackgroundView.isHidden = true
            return
        }

        keyboardVisible = true
        keyboardBackgroundView.backgroundColor = lastPageBackgroundColor ?? fallbackBackgroundColor
        keyboardBackgroundView.frame = keyboardIntersection
        keyboardBackgroundView.isHidden = false
        view.bringSubviewToFront(keyboardBackgroundView)
        animateKeyboardBackground(with: notification)
    }

    @objc private func keyboardWillHide(_ notification: Notification) {
        keyboardVisible = false
        animateKeyboardBackground(with: notification) { [weak self] in
            self?.keyboardBackgroundView.isHidden = true
        }
    }

    @objc private func applicationDidBecomeActive() {
        guard keyboardVisible else {
            return
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { [weak self] in
            self?.restoreLastFocusedEditable()
        }
    }

    private func restoreLastFocusedEditable() {
        webView?.evaluateJavaScript("window.__exMobileRestoreFocus && window.__exMobileRestoreFocus();")
    }

    private func animateKeyboardBackground(with notification: Notification, completion: (() -> Void)? = nil) {
        let duration = notification.userInfo?[UIResponder.keyboardAnimationDurationUserInfoKey] as? TimeInterval ?? 0
        let curveValue = notification.userInfo?[UIResponder.keyboardAnimationCurveUserInfoKey] as? UInt ?? 0
        let options = UIView.AnimationOptions(rawValue: curveValue << 16)

        UIView.animate(
            withDuration: duration,
            delay: 0,
            options: options,
            animations: { self.view.layoutIfNeeded() },
            completion: { _ in completion?() }
        )
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

        if value.hasPrefix("color(") {
            self.init(colorFunction: value)
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

    private convenience init?(colorFunction value: String) {
        guard let content = Self.parenthesizedContent(value) else {
            return nil
        }

        var tokens = Self.colorTokens(content)
        if !tokens.isEmpty, Double(tokens[0]) == nil {
            tokens.removeFirst()
        }
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
