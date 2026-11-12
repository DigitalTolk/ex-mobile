package com.digitaltolk.ex.mobile;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebBackForwardList;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;
import com.onesignal.OneSignal;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ServerNavigationPlugin.class);
        super.onCreate(savedInstanceState);
        keepWebViewInsideSystemBars();
        // OneSignal must be initialized before anything calls into it: its
        // Android plugin throws (and takes the app down) on login() before
        // init, and the server page logs the user in as soon as they sign in.
        // The shell's own JS init is async and can lose that race.
        if (!BuildConfig.ONESIGNAL_APP_ID.isEmpty()) {
            OneSignal.initWithContext(this, BuildConfig.ONESIGNAL_APP_ID);
        }
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().setLongClickable(false);
            getBridge().getWebView().setOnLongClickListener(view -> true);
        }
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                handleBack();
            }
        });
    }

    // Android 15+ draws every app edge to edge. Capacitor's default then hands
    // the page the bar heights through env(safe-area-inset-*), which some
    // WebView builds report as 0, so the chat's bottom tab bar ended up under
    // the system navigation bar. Pad the window by the bars (and the keyboard,
    // which edge to edge no longer resizes for) instead, so the WebView only
    // ever gets the safe area, and tell the page there is nothing left to
    // avoid. capacitor.config.ts turns Capacitor's own handling off.
    private void keepWebViewInsideSystemBars() {
        final int bars = WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout();
        View decor = getWindow().getDecorView();
        ViewCompat.setOnApplyWindowInsetsListener(decor, (view, insets) -> {
            Insets safe = insets.getInsets(bars);
            boolean keyboardVisible = insets.isVisible(WindowInsetsCompat.Type.ime());
            int bottom = keyboardVisible ? insets.getInsets(WindowInsetsCompat.Type.ime()).bottom : safe.bottom;
            view.setPadding(safe.left, safe.top, safe.right, bottom);
            // Not CONSUMED: that stops the WebView recalculating its insets
            // (https://issues.chromium.org/issues/461332423).
            return new WindowInsetsCompat.Builder(insets).setInsets(bars, Insets.NONE).build();
        });
        ViewCompat.requestApplyInsets(decor);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        ServerNavigationPlugin.handleCallback(this, getBridge(), intent);
    }

    // Back is the chat's first: it closes an open sheet or panel, from a chat
    // shows the channel list, and on the list hands the app to the background
    // (AppLayout's __exMobileBack). A page without that hook (the shell's own
    // setup screen, a wider layout) falls back to walking WebView history.
    // Never finish(): that threw the user out of the app and cost a cold start.
    private static final String ASK_PAGE_BACK =
        "(function(){try{return window.__exMobileBack?(window.__exMobileBack()||null):null}catch(e){return null}})()";

    private void handleBack() {
        WebView webView = getBridge() == null ? null : getBridge().getWebView();
        if (webView == null) {
            moveTaskToBack(true);
            return;
        }
        webView.evaluateJavascript(ASK_PAGE_BACK, (result) -> {
            if ("\"handled\"".equals(result)) {
                return;
            }
            if (!"\"background\"".equals(result) && canGoBackWithinServer(webView)) {
                webView.goBack();
                return;
            }
            moveTaskToBack(true);
        });
    }

    // The entry before the first server page is the shell's own loader, which
    // would bounce straight back to the server: never step onto it.
    private boolean canGoBackWithinServer(WebView webView) {
        WebBackForwardList history = webView.copyBackForwardList();
        int index = history.getCurrentIndex();
        if (index <= 0) {
            return false;
        }

        String previous = history.getItemAtIndex(index - 1).getUrl();
        String localUrl = getBridge().getLocalUrl();
        if (previous == null || localUrl == null) {
            return false;
        }

        String previousOrigin = ServerBridgeScript.origin(Uri.parse(previous));
        String localOrigin = ServerBridgeScript.origin(Uri.parse(localUrl));
        return previousOrigin != null && !previousOrigin.equals(localOrigin);
    }
}
