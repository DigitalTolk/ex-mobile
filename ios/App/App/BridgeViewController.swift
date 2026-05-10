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
      const colorLuminance = (color) => {
        const rgb = color.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
        if (rgb) {
          return (Number(rgb[1]) * 0.2126 + Number(rgb[2]) * 0.7152 + Number(rgb[3]) * 0.0722) / 255;
        }
        const hex = color.match(/^#([0-9a-f]{6})$/i);
        if (!hex) return 1;
        const value = Number.parseInt(hex[1], 16);
        return (((value >> 16) & 255) * 0.2126 + ((value >> 8) & 255) * 0.7152 + (value & 255) * 0.0722) / 255;
      };
      const prefersDark = () => Boolean(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
      const explicitKeyboardBackground = () => {
        const candidates = [document.documentElement, document.body].filter(Boolean);
        for (const node of candidates) {
          const color = getComputedStyle(node).getPropertyValue("--ex-keyboard-background").trim();
          const normalized = normalizeColor(color);
          if (normalized) return normalized;
        }
        return "";
      };
      const pointElement = (x, y) => {
        const width = Math.max(1, window.innerWidth);
        const height = Math.max(1, window.innerHeight);
        return document.elementFromPoint(
          Math.max(1, Math.min(width - 1, x)),
          Math.max(1, Math.min(height - 1, y))
        );
      };
      const activeComposerElement = () => {
        const active = document.activeElement && document.activeElement.closest
          ? document.activeElement.closest("[contenteditable='true'], textarea, input, [role='textbox']")
          : document.activeElement;
        if (!active || active === document.body || active === document.documentElement) return null;

        let composer = active;
        let current = active;
        while (current && current !== document.body && current !== document.documentElement) {
          const rect = current.getBoundingClientRect();
          if (
            rect.width >= window.innerWidth * 0.65
            && rect.height >= 44
            && rect.height <= 260
            && rect.bottom >= window.innerHeight * 0.45
          ) {
            composer = current;
          }
          current = current.parentElement;
        }
        return composer;
      };
      const visibleComposerSurroundingElements = () => {
        const composer = activeComposerElement();
        if (!composer) return [];
        const rect = composer.getBoundingClientRect();
        if (!rect.width || !rect.height) return [];
        const xInset = Math.min(16, Math.max(4, rect.width / 8));
        const yInset = Math.min(16, Math.max(4, rect.height / 8));
        const points = [
          [rect.left - 4, rect.top + yInset],
          [rect.right + 4, rect.top + yInset],
          [rect.left + xInset, rect.bottom + 4],
          [rect.right - xInset, rect.bottom + 4],
          [rect.left + xInset, rect.top - 4],
          [rect.right - xInset, rect.top - 4],
        ];

        return points
          .map(([x, y]) => pointElement(x, y))
          .filter((node) => node && node !== composer && !composer.contains(node));
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
          .map(([x, y]) => pointElement(x, y))
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

        const colors = [];
        for (const node of candidates) {
          if (!node) continue;
          const color = getComputedStyle(node).backgroundColor;
          const normalized = normalizeColor(color);
          if (normalized) colors.push(normalized);
        }
        if (!colors.length) return "";
        if (!prefersDark()) return colors[0];
        const darkest = colors.sort((left, right) => colorLuminance(left) - colorLuminance(right))[0];
        return colorLuminance(darkest) < 0.08 ? "rgb(10, 10, 10)" : darkest;
      };

      let lastColor = "";
      let scheduled = false;
      const send = () => {
        scheduled = false;
        const color = explicitKeyboardBackground()
          || visibleBackground(visibleComposerSurroundingElements())
          || visibleBackground(visibleKeyboardBackdropElements());
        if (!color || color === lastColor) return;
        lastColor = color;
        handler.postMessage(color);
      };
      const schedule = () => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(send);
      };

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", schedule, { once: true });
      }
      schedule();

      const observer = new MutationObserver(schedule);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "style"],
        childList: true
      });

      const observeBody = () => {
        if (document.body) {
          observer.observe(document.body, {
            attributes: true,
            attributeFilter: ["class", "style"],
            childList: true,
            subtree: true
          });
        }
      };
      observeBody();
      document.addEventListener("DOMContentLoaded", observeBody, { once: true });

      const media = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
      if (media && media.addEventListener) {
        media.addEventListener("change", schedule);
      }
      window.addEventListener("resize", schedule);
      document.addEventListener("focusin", schedule, true);
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
    private static let compactComposerAlignmentScript = """
    (() => {
      if (window.__exMobileCompactComposerAlignmentInstalled) return;
      window.__exMobileCompactComposerAlignmentInstalled = true;

      const style = document.createElement("style");
      style.id = "ex-mobile-compact-composer-alignment";
      style.textContent = `
        @media (max-width: 767px) {
          [data-composer-focused="true"] {
            padding-bottom: 5px !important;
          }

          [data-composer-focused="true"] [data-message-composer] {
            margin-bottom: 5px !important;
          }

          [data-composer-focused="false"] [data-message-composer] [role="textbox"].wysiwyg-editor {
            align-items: center !important;
            display: flex !important;
            line-height: 1.25rem !important;
          }

          [data-composer-focused="false"] [data-message-composer] [role="textbox"].wysiwyg-editor > *,
          [data-composer-focused="false"] [data-message-composer] [role="textbox"].wysiwyg-editor p {
            line-height: 1.25rem !important;
            margin-bottom: 0 !important;
            margin-top: 0 !important;
          }

          [data-composer-focused="false"] [data-message-composer] [role="textbox"].wysiwyg-editor + div {
            line-height: 1.25rem !important;
            top: 50% !important;
            transform: translateY(-50%) !important;
          }
        }
      `;

      const install = () => {
        if (!document.head || document.getElementById(style.id)) return;
        document.head.appendChild(style);
      };

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", install, { once: true });
      }
      install();
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
        configuration.userContentController.addUserScript(
            WKUserScript(
                source: Self.compactComposerAlignmentScript,
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
        keyboardBackgroundView.backgroundColor = keyboardBackdropColor(for: color)
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

        if let appWebView = webView as? AppWebView {
            appWebView.keyboardAccessoryBackdrop.backgroundColor = keyboardBackdropColor(for: color)
        }
    }

    private func keyboardBackdropColor(for color: UIColor) -> UIColor {
        if traitCollection.userInterfaceStyle == .dark, color.luminance < 0.18 {
            return UIColor(red: 10 / 255, green: 10 / 255, blue: 10 / 255, alpha: 1)
        }

        return color
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
        keyboardBackgroundView.backgroundColor = keyboardBackdropColor(for: lastPageBackgroundColor ?? fallbackBackgroundColor)
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
    let keyboardAccessoryBackdrop = KeyboardAccessoryBackdropView()

    override var inputAccessoryView: UIView? {
        keyboardAccessoryBackdrop
    }
}

private final class KeyboardAccessoryBackdropView: UIView {
    override var intrinsicContentSize: CGSize {
        CGSize(width: UIView.noIntrinsicMetric, height: 58)
    }
}

private extension UIColor {
    var luminance: CGFloat {
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0
        getRed(&red, green: &green, blue: &blue, alpha: &alpha)
        return red * 0.2126 + green * 0.7152 + blue * 0.0722
    }

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
