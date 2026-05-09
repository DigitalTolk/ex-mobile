import AuthenticationServices
import Capacitor
import Foundation
import OneSignalFramework
import WebKit

@objc(ServerNavigation)
public class ServerNavigation: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding, OSNotificationClickListener {
    public let identifier = "ServerNavigation"
    public let jsName = "ServerNavigation"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resetServer", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "registerNotificationRouting", returnType: CAPPluginReturnPromise)
    ]

    private var authSession: ASWebAuthenticationSession?
    private var notificationClickListenerRegistered = false

    public override func load() {
        super.load()
        registerNotificationClickListener()
    }

    deinit {
        if notificationClickListenerRegistered {
            OneSignal.Notifications.removeClickListener(self)
        }
    }

    @objc func open(_ call: CAPPluginCall) {
        guard
            let rawURL = call.getString("url"),
            let url = URL(string: rawURL),
            let scheme = url.scheme?.lowercased(),
            ["http", "https"].contains(scheme)
        else {
            call.reject("Invalid server URL")
            return
        }

        DispatchQueue.main.async { [weak self] in
            self?.webView?.load(URLRequest(url: url))
            call.resolve()
        }
    }

    @objc func registerNotificationRouting(_ call: CAPPluginCall) {
        registerNotificationClickListener()
        call.resolve()
    }

    @objc func resetServer(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            UserDefaults.standard.removeObject(forKey: "CapacitorStorage.server-url")
            if let localURL = self?.bridge?.config.localURL {
                self?.webView?.load(URLRequest(url: localURL))
            }
            call.resolve()
        }
    }

    public override func shouldOverrideLoad(_ navigationAction: WKNavigationAction) -> NSNumber? {
        guard
            navigationAction.targetFrame?.isMainFrame != false,
            let url = navigationAction.request.url
        else {
            return nil
        }

        if isOIDCLoginURL(url), isConfiguredServerURL(url) {
            openAuthenticationSession(from: url)
            return true
        }

        if shouldOpenExternally(url) {
            UIApplication.shared.open(url)
            return true
        }

        return nil
    }

    public func onClick(event: OSNotificationClickEvent) {
        guard
            let url = notificationURL(from: event),
            isConfiguredServerURL(url)
        else {
            return
        }

        DispatchQueue.main.async { [weak self] in
            self?.webView?.load(URLRequest(url: url))
        }
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }

    private func registerNotificationClickListener() {
        guard !notificationClickListenerRegistered else {
            return
        }

        OneSignal.Notifications.addClickListener(self)
        notificationClickListenerRegistered = true
    }

    private func notificationURL(from event: OSNotificationClickEvent) -> URL? {
        return [
            stringValue(event.notification.additionalData?["url"]),
            stringValue(event.notification.rawPayload["url"]),
            event.result.url,
            event.notification.launchURL
        ]
        .compactMap { $0 }
        .compactMap { URL(string: $0) }
        .first { url in
            guard let scheme = url.scheme?.lowercased() else {
                return false
            }
            return ["http", "https"].contains(scheme)
        }
    }

    private func stringValue(_ value: Any?) -> String? {
        guard let rawValue = value as? String else {
            return nil
        }

        let trimmedValue = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmedValue.isEmpty ? nil : trimmedValue
    }

    private func isOIDCLoginURL(_ url: URL) -> Bool {
        return url.path == "/auth/oidc/login"
    }

    private func shouldOpenExternally(_ url: URL) -> Bool {
        guard
            let scheme = url.scheme?.lowercased(),
            ["http", "https"].contains(scheme)
        else {
            return false
        }

        return !isConfiguredServerURL(url)
    }

    private func isConfiguredServerURL(_ url: URL) -> Bool {
        guard let serverURL = storedServerURL() else {
            return false
        }

        return url.scheme?.lowercased() == serverURL.scheme?.lowercased()
            && url.host?.lowercased() == serverURL.host?.lowercased()
            && normalizedPort(url) == normalizedPort(serverURL)
    }

    private func storedServerURL() -> URL? {
        guard
            let rawURL = UserDefaults.standard.string(forKey: "CapacitorStorage.server-url"),
            let url = URL(string: rawURL),
            let scheme = url.scheme?.lowercased(),
            ["http", "https"].contains(scheme)
        else {
            return nil
        }

        return url
    }

    private func normalizedPort(_ url: URL) -> Int? {
        if let port = url.port {
            return port
        }
        switch url.scheme?.lowercased() {
        case "http":
            return 80
        case "https":
            return 443
        default:
            return nil
        }
    }

    private func openAuthenticationSession(from loginURL: URL) {
        var components = URLComponents(url: loginURL, resolvingAgainstBaseURL: false)
        var queryItems = components?.queryItems ?? []
        queryItems.removeAll { $0.name == "redirect_to" }
        queryItems.append(URLQueryItem(name: "redirect_to", value: "ex://mobile/auth/callback"))
        components?.queryItems = queryItems

        guard let authURL = components?.url else {
            return
        }

        authSession?.cancel()
        authSession = ASWebAuthenticationSession(url: authURL, callbackURLScheme: "ex") { [weak self] callbackURL, _ in
            guard let self, let callbackURL else {
                return
            }
            DispatchQueue.main.async {
                self.finishAuthentication(callbackURL: callbackURL, serverURL: loginURL)
            }
        }
        authSession?.presentationContextProvider = self
        authSession?.prefersEphemeralWebBrowserSession = false
        authSession?.start()
    }

    private func finishAuthentication(callbackURL: URL, serverURL: URL) {
        guard
            callbackURL.scheme == "ex",
            callbackURL.host == "mobile",
            let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false)
        else {
            return
        }

        let queryItems = components.queryItems ?? []
        if let code = queryItems.first(where: { $0.name == "desktop_code" })?.value {
            loadDesktopCompletion(code: code, serverURL: serverURL)
            return
        }

        if let token = queryItems.first(where: { $0.name == "token" })?.value {
            loadWebCallback(token: token, serverURL: serverURL)
        }
    }

    private func loadDesktopCompletion(code: String, serverURL: URL) {
        var components = URLComponents()
        components.scheme = serverURL.scheme
        components.host = serverURL.host
        components.port = serverURL.port
        components.path = "/auth/desktop/complete"
        components.queryItems = [URLQueryItem(name: "code", value: code)]
        guard let url = components.url else {
            return
        }
        webView?.load(URLRequest(url: url))
    }

    private func loadWebCallback(token: String, serverURL: URL) {
        var components = URLComponents()
        components.scheme = serverURL.scheme
        components.host = serverURL.host
        components.port = serverURL.port
        components.path = "/oidc/callback"
        components.queryItems = [URLQueryItem(name: "token", value: token)]
        guard let url = components.url else {
            return
        }
        webView?.load(URLRequest(url: url))
    }
}
