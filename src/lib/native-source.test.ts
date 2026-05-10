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
    expect(source).toContain('document.elementFromPoint(x, y)');
    expect(source).toContain('window.addEventListener("resize", schedule)');
    expect(source).toContain('applyWebPageBackgroundColor');
    expect(source).toContain('webView.scrollView.backgroundColor = color');
    expect(source).toContain('webView.underPageBackgroundColor = color');
    expect(source).toContain('UIColor(cssColor: cssColor)');
  });
});
