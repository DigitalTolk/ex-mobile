package com.digitaltolk.ex.mobile;

import android.net.Uri;
import android.webkit.WebView;

import androidx.webkit.ScriptHandler;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import com.getcapacitor.Bridge;
import com.getcapacitor.Logger;

import java.lang.reflect.Method;
import java.util.Collections;
import java.util.Locale;
import java.util.Map;
import java.util.WeakHashMap;

/**
 * Gives the chat server's pages the Capacitor bridge on Android.
 *
 * Capacitor Android injects its bridge script only into the app's own origin
 * (https://localhost) through a document-start script, and with that path in
 * use it turns off the fallback that injected into allowNavigation pages. The
 * server page therefore had no window.Capacitor: OneSignal.login never ran
 * (so no push ever reached an Android phone), and haptics and "Change server"
 * were dead. iOS injects into every page, so it never had this gap.
 *
 * The script is registered for the configured server's origin only, so no
 * other site the WebView might show can reach native plugins. One handler per
 * WebView, swapped when the server changes.
 */
final class ServerBridgeScript {
    private static final class Registration {
        final String origin;
        final ScriptHandler handler;

        Registration(String origin, ScriptHandler handler) {
            this.origin = origin;
            this.handler = handler;
        }
    }

    private static final Map<WebView, Registration> registrations = new WeakHashMap<>();

    private ServerBridgeScript() {}

    /** Call on the UI thread before loading any page of {@code serverUrl}. */
    static void prepare(Bridge bridge, Uri serverUrl) {
        if (bridge == null || serverUrl == null) {
            return;
        }
        // Without document-start scripts Capacitor keeps its own injector,
        // which already serves proxied allowNavigation pages.
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            return;
        }

        WebView webView = bridge.getWebView();
        String origin = origin(serverUrl);
        if (webView == null || origin == null) {
            return;
        }

        Registration current = registrations.get(webView);
        if (current != null && current.origin.equals(origin)) {
            return;
        }

        String script = bridgeScript(bridge);
        if (script == null) {
            return;
        }
        // A build without a OneSignal app id never initializes OneSignal, and
        // its Android plugin crashes the app on any call before init. Keep the
        // plugin away from the server page then: the web app skips push
        // identity when the plugin is absent.
        if (BuildConfig.ONESIGNAL_APP_ID.isEmpty()) {
            script += "\n;try{delete window.Capacitor.Plugins.OneSignalCapacitor;}catch(e){}";
        }

        if (current != null) {
            current.handler.remove();
            registrations.remove(webView);
        }

        try {
            ScriptHandler handler = WebViewCompat.addDocumentStartJavaScript(webView, script, Collections.singleton(origin));
            registrations.put(webView, new Registration(origin, handler));
        } catch (IllegalArgumentException exception) {
            Logger.warn("ServerBridgeScript", "Could not inject the bridge into " + origin + ": " + exception.getMessage());
        }
    }

    static String origin(Uri url) {
        String scheme = url.getScheme();
        String host = url.getHost();
        if (scheme == null || host == null) {
            return null;
        }
        String origin = scheme.toLowerCase(Locale.ROOT) + "://" + host.toLowerCase(Locale.ROOT);
        return url.getPort() == -1 ? origin : origin + ":" + url.getPort();
    }

    // Capacitor builds the bridge script (core bridge + every registered
    // plugin) in a private method; it has no public accessor. Release builds
    // are not minified, so the names are stable for a given Capacitor version.
    private static String bridgeScript(Bridge bridge) {
        try {
            Method getInjector = Bridge.class.getDeclaredMethod("getJSInjector");
            getInjector.setAccessible(true);
            Object injector = getInjector.invoke(bridge);
            if (injector == null) {
                return null;
            }
            Method getScript = injector.getClass().getDeclaredMethod("getScriptString");
            getScript.setAccessible(true);
            return (String) getScript.invoke(injector);
        } catch (ReflectiveOperationException | RuntimeException exception) {
            Logger.error("ServerBridgeScript", "Capacitor bridge script unavailable", exception);
            return null;
        }
    }
}
