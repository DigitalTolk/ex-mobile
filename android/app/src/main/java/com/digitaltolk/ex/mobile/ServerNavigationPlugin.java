package com.digitaltolk.ex.mobile;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;

import com.getcapacitor.Bridge;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ServerNavigation")
public class ServerNavigationPlugin extends Plugin {
    private static final String STORAGE_NAME = "CapacitorStorage";
    private static final String SERVER_URL_KEY = "server-url";
    private static final String MOBILE_CALLBACK = "ex://mobile/auth/callback";

    @PluginMethod
    public void open(PluginCall call) {
        String rawUrl = call.getString("url");
        Uri url = rawUrl == null ? null : Uri.parse(rawUrl);
        if (!isHttpUrl(url)) {
            call.reject("Invalid server URL");
            return;
        }

        getActivity().runOnUiThread(() -> {
            getBridge().getWebView().loadUrl(url.toString());
            call.resolve(new JSObject());
        });
    }

    @PluginMethod
    public void resetServer(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            getContext()
                .getSharedPreferences(STORAGE_NAME, Context.MODE_PRIVATE)
                .edit()
                .remove(SERVER_URL_KEY)
                .apply();
            String localURL = getBridge().getLocalUrl();
            if (localURL != null) {
                getBridge().getWebView().loadUrl(localURL);
            }
            call.resolve(new JSObject());
        });
    }

    @Override
    public Boolean shouldOverrideLoad(Uri url) {
        if (url == null) {
            return null;
        }

        if (isOIDCLoginURL(url) && isConfiguredServerURL(getContext(), url)) {
            openAuthenticationSession(url);
            return true;
        }

        if (shouldOpenExternally(getContext(), url)) {
            openExternal(url);
            return true;
        }

        return null;
    }

    public static boolean handleCallback(Activity activity, Bridge bridge, Intent intent) {
        if (bridge == null) {
            return false;
        }

        Uri callbackURL = intent == null ? null : intent.getData();
        if (callbackURL == null
            || !"ex".equals(callbackURL.getScheme())
            || !"mobile".equals(callbackURL.getHost())) {
            return false;
        }

        String code = callbackURL.getQueryParameter("desktop_code");
        if (code == null || code.isEmpty()) {
            return false;
        }

        Uri serverURL = storedServerURL(activity);
        if (serverURL == null) {
            return false;
        }

        Uri completionURL = serverURL.buildUpon()
            .path("/auth/desktop/complete")
            .clearQuery()
            .appendQueryParameter("code", code)
            .build();
        bridge.getWebView().post(() -> bridge.getWebView().loadUrl(completionURL.toString()));
        return true;
    }

    private void openAuthenticationSession(Uri loginURL) {
        Uri.Builder builder = loginURL.buildUpon().clearQuery();
        for (String name : loginURL.getQueryParameterNames()) {
            if ("redirect_to".equals(name)) {
                continue;
            }
            for (String value : loginURL.getQueryParameters(name)) {
                builder.appendQueryParameter(name, value);
            }
        }
        builder.appendQueryParameter("redirect_to", MOBILE_CALLBACK);
        openExternal(builder.build());
    }

    private void openExternal(Uri url) {
        Intent intent = new Intent(Intent.ACTION_VIEW, url);
        getActivity().startActivity(intent);
    }

    private static boolean isOIDCLoginURL(Uri url) {
        return "/auth/oidc/login".equals(url.getPath());
    }

    private static boolean shouldOpenExternally(Context context, Uri url) {
        return isHttpUrl(url) && !isConfiguredServerURL(context, url);
    }

    private static boolean isConfiguredServerURL(Context context, Uri url) {
        Uri serverURL = storedServerURL(context);
        if (serverURL == null) {
            return false;
        }

        return equalsIgnoreCase(url.getScheme(), serverURL.getScheme())
            && equalsIgnoreCase(url.getHost(), serverURL.getHost())
            && normalizedPort(url) == normalizedPort(serverURL);
    }

    private static Uri storedServerURL(Context context) {
        SharedPreferences preferences = context.getSharedPreferences(STORAGE_NAME, Context.MODE_PRIVATE);
        String rawURL = preferences.getString(SERVER_URL_KEY, null);
        Uri url = rawURL == null ? null : Uri.parse(rawURL);
        return isHttpUrl(url) ? url : null;
    }

    private static boolean isHttpUrl(Uri url) {
        if (url == null) {
            return false;
        }
        String scheme = url.getScheme();
        return "http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme);
    }

    private static int normalizedPort(Uri url) {
        int port = url.getPort();
        if (port != -1) {
            return port;
        }
        if ("http".equalsIgnoreCase(url.getScheme())) {
            return 80;
        }
        if ("https".equalsIgnoreCase(url.getScheme())) {
            return 443;
        }
        return -1;
    }

    private static boolean equalsIgnoreCase(String left, String right) {
        if (left == null || right == null) {
            return left == right;
        }
        return left.equalsIgnoreCase(right);
    }
}
