/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const androidNavigationPluginPath = resolve(
  process.cwd(),
  'android/app/src/main/java/com/digitaltolk/ex/mobile/ServerNavigationPlugin.java',
);
const iosNavigationPluginPath = resolve(process.cwd(), 'ios/App/App/ServerNavigation.swift');
const iosBridgeViewControllerPath = resolve(process.cwd(), 'ios/App/App/BridgeViewController.swift');
const stylesPath = resolve(process.cwd(), 'src/styles.css');
const androidAppBuildGradlePath = resolve(process.cwd(), 'android/app/build.gradle');
const androidVariablesPath = resolve(process.cwd(), 'android/variables.gradle');
const androidBuildGradlePath = resolve(process.cwd(), 'android/build.gradle');
const readAndroidNavigationPlugin = () => readFileSync(androidNavigationPluginPath, 'utf8');
const readIosNavigationPlugin = () => readFileSync(iosNavigationPluginPath, 'utf8');
const readIosBridgeViewController = () => readFileSync(iosBridgeViewControllerPath, 'utf8');
const readStyles = () => readFileSync(stylesPath, 'utf8');
const readAndroidAppBuildGradle = () => readFileSync(androidAppBuildGradlePath, 'utf8');
const readAndroidVariables = () => readFileSync(androidVariablesPath, 'utf8');
const readAndroidBuildGradle = () => readFileSync(androidBuildGradlePath, 'utf8');

describe('native navigation source', () => {
  it('keeps Android callback handling aligned with the iOS mobile callback scheme', () => {
    const source = readAndroidNavigationPlugin();

    expect(source).toContain('ex://mobile/auth/callback');
    expect(source).not.toContain('ex://app/auth/callback');
  });

  it('keeps Android auth callbacks compatible with desktop code and token flows', () => {
    const source = readAndroidNavigationPlugin();

    expect(source).toContain('getQueryParameter("desktop_code")');
    expect(source).toContain('getQueryParameter("token")');
    expect(source).toContain('"/auth/desktop/complete"');
    expect(source).toContain('"/oidc/callback"');
  });

  it('keeps Kotlin aligned with OneSignal Android dependencies', () => {
    expect(readAndroidVariables()).toContain("kotlin_version = '1.9.25'");
    expect(readAndroidVariables()).toContain("oneSignalVersion = '5.8.1'");
    expect(readAndroidBuildGradle()).toContain('details.requested.group == \'org.jetbrains.kotlin\'');
    expect(readAndroidBuildGradle()).toContain('details.useVersion rootProject.ext.kotlin_version');
    expect(readAndroidAppBuildGradle()).toContain('implementation "com.onesignal:OneSignal:$oneSignalVersion"');
  });

  it('routes iOS notification clicks through the configured server WebView', () => {
    const source = readIosNavigationPlugin();

    expect(source).toContain('OSNotificationClickListener');
    expect(source).toContain('OneSignal.Notifications.addClickListener(self)');
    expect(source).toContain('registerNotificationRouting');
    expect(source).toContain('func onClick(event: OSNotificationClickEvent)');
    expect(source).toContain('isConfiguredServerURL(url)');
    expect(source).toContain('webView?.load(URLRequest(url: url))');
  });

  it('prefers OneSignal notification data URLs over launch URLs on iOS', () => {
    const source = readIosNavigationPlugin();

    expect(source).toMatch(
      /stringValue\(event\.notification\.additionalData\?\["url"\]\)[\s\S]*stringValue\(event\.notification\.rawPayload\["url"\]\)[\s\S]*event\.result\.url[\s\S]*event\.notification\.launchURL/,
    );
  });

  it('routes Android notification clicks through the configured server WebView', () => {
    const source = readAndroidNavigationPlugin();

    expect(source).toContain('implements INotificationClickListener');
    expect(source).toContain('OneSignal.getNotifications().addClickListener(this)');
    expect(source).toContain('registerNotificationRouting');
    expect(source).toContain('public void onClick(INotificationClickEvent event)');
    expect(source).toContain('isConfiguredServerURL(getContext(), url)');
    expect(source).toContain('getBridge().getWebView().loadUrl(url.toString())');
  });

  it('prefers OneSignal notification data URLs over launch URLs on Android', () => {
    const source = readAndroidNavigationPlugin();

    expect(source).toMatch(
      /stringValue\(event\.getNotification\(\)\.getAdditionalData\(\), "url"\)[\s\S]*jsonStringValue\(event\.getNotification\(\)\.getRawPayload\(\), "url"\)[\s\S]*event\.getResult\(\)\.getUrl\(\)[\s\S]*event\.getNotification\(\)\.getLaunchURL\(\)/,
    );
  });

  it('keeps the local setup screen from becoming document-scrollable on input focus', () => {
    const source = readStyles();

    expect(source).toMatch(/html,\s*body,\s*#root\s*{[\s\S]*overflow: hidden;/);
    expect(source).toMatch(/body\s*{[\s\S]*position: fixed;[\s\S]*inset: 0;/);
    expect(source).toMatch(/\.loading-screen,\s*\.setup-screen,\s*\.login-screen\s*{[\s\S]*position: fixed;[\s\S]*overflow: hidden;/);
    expect(source).toMatch(/input\s*{[\s\S]*font-size: 16px;/);
  });

  it('keeps the iOS WebView background synced with the loaded page', () => {
    const source = readIosBridgeViewController();

    expect(source).toContain('WKScriptMessageHandler');
    expect(source).toContain('backgroundMessageHandler = "exBackground"');
    expect(source).toContain('initialChromeScript');
    expect(source).toContain('injectionTime: .atDocumentStart');
    expect(source).toContain('background-color: rgb(10, 10, 10)');
    expect(source).toContain('color-scheme: dark');
    expect(source).toContain('view.window?.backgroundColor');
    expect(source).toContain('explicitKeyboardBackground');
    expect(source).toContain('getPropertyValue("--ex-keyboard-background")');
    expect(source).toContain('canvas.getContext("2d")');
    expect(source).toContain('colorLuminance');
    expect(source).toContain('prefersDark');
    expect(source).toContain('colors.sort((left, right) => colorLuminance(left) - colorLuminance(right))[0]');
    expect(source).toContain('colorLuminance(darkest) < 0.08 ? "rgb(10, 10, 10)" : darkest');
    expect(source).toMatch(/explicitKeyboardBackground\(\)[\s\S]*visibleBackground\(visibleComposerSurroundingElements\(\)\)[\s\S]*visibleBackground\(visibleKeyboardBackdropElements\(\)\)/);
    expect(source).toMatch(/const normalized = normalizeColor\(color\);[\s\S]*if \(normalized\) return normalized;/);
    expect(source).toContain('activeComposerElement');
    expect(source).toContain('visibleComposerSurroundingElements');
    expect(source).toContain("[contenteditable='true'], textarea, input, [role='textbox']");
    expect(source).toContain('rect.width >= window.innerWidth * 0.65');
    expect(source).toContain('rect.bottom >= window.innerHeight * 0.45');
    expect(source).toContain('document.addEventListener("focusin", schedule, true)');
    expect(source).toContain('let scheduled = false');
    expect(source).toContain('if (scheduled) return');
    expect(source).toContain('scheduled = true');
    expect(source).toMatch(/observer\.observe\(document\.documentElement,[\s\S]*childList: true[\s\S]*\);/);
    expect(source).toMatch(/observer\.observe\(document\.body,[\s\S]*childList: true,[\s\S]*subtree: true[\s\S]*\);/);
    expect(source).toContain('visibleKeyboardBackdropElements');
    expect(source).toContain('[edgeInset, height - bottomInset]');
    expect(source).toContain('document.elementFromPoint');
    expect(source).toContain('window.addEventListener("resize", schedule)');
    expect(source).toContain('applyWebPageBackgroundColor');
    expect(source).toContain('keyboardBackgroundView');
    expect(source).toContain('keyboardAccessoryBackdrop');
    expect(source).toContain('KeyboardAccessoryBackdropView');
    expect(source).toContain('height: 58');
    expect(source).toContain('isOpaque = true');
    expect(source).toContain('autoresizingMask = [.flexibleWidth]');
    expect(source).toContain('keyboardBackdropColor(for: color)');
    expect(source).toContain('color.luminance < 0.18');
    expect(source).toContain('red: 10 / 255, green: 10 / 255, blue: 10 / 255');
    expect(source).toContain('var luminance: CGFloat');
    expect(source).toContain('keyboardWillChangeFrameNotification');
    expect(source).toContain('keyboardFrameEndUserInfoKey');
    expect(source).toContain('view.bringSubviewToFront(keyboardBackgroundView)');
    expect(source).toContain('__exMobileRestoreFocus');
    expect(source).toContain('keepEditableVisibleSoon(target)');
    expect(source).toContain('scrollParents');
    expect(source).toContain('UIApplication.didBecomeActiveNotification');
    expect(source).toContain('keyboardVisible');
    expect(source).toContain('webView?.evaluateJavaScript("window.__exMobileRestoreFocus');
    expect(source).toContain('compactComposerAlignmentScript');
    expect(source).toContain('__exMobileCompactComposerAlignmentInstalled');
    expect(source).toContain('[data-composer-focused="true"]');
    expect(source).toContain('padding-bottom: 5px !important');
    expect(source).toContain('[data-composer-focused="true"] [data-message-composer]');
    expect(source).toContain('margin-bottom: 5px !important');
    expect(source).toContain('[data-composer-focused="false"] [data-message-composer]');
    expect(source).toContain('top: 50% !important');
    expect(source).toContain('transform: translateY(-50%) !important');
    expect(source).toContain('webView.scrollView.backgroundColor = color');
    expect(source).toContain('webView.underPageBackgroundColor = color');
    expect(source).toContain('UIColor(cssColor: cssColor)');
  });
});
