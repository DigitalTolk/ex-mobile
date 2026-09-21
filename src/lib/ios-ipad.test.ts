/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

function plistArray(plist: string, key: string): string[] {
  const match = plist.match(new RegExp(`<key>${key}</key>\\s*<array>([\\s\\S]*?)</array>`));
  if (!match) return [];
  return [...match[1].matchAll(/<string>([^<]+)<\/string>/g)].map(([, value]) => value);
}

describe('iPad support', () => {
  it('builds the app target for iPhone and iPad', () => {
    const families = [...read('ios/App/App.xcodeproj/project.pbxproj').matchAll(/TARGETED_DEVICE_FAMILY = "?([\d,]+)"?;/g)]
      .map(([, family]) => family);

    expect(families).toEqual(['1,2', '1,2']);
  });

  it('lets iPad windows use every orientation so multitasking stays available', () => {
    const plist = read('ios/App/App/Info.plist');

    expect(plistArray(plist, 'UISupportedInterfaceOrientations~ipad').sort()).toEqual([
      'UIInterfaceOrientationLandscapeLeft',
      'UIInterfaceOrientationLandscapeRight',
      'UIInterfaceOrientationPortrait',
      'UIInterfaceOrientationPortraitUpsideDown',
    ]);
    expect(plistArray(plist, 'UISupportedInterfaceOrientations')).toEqual(['UIInterfaceOrientationPortrait']);
    expect(plist).not.toContain('<key>UIRequiresFullScreen</key>');
    expect(plist).toMatch(/<key>UIApplicationSupportsIndirectInputEvents<\/key>\s*<true\/>/);
  });

  it('overrides the Capacitor iPhone-only orientation mask on iPad', () => {
    const source = read('ios/App/App/BridgeViewController.swift');

    expect(source).toContain('override var supportedInterfaceOrientations: UIInterfaceOrientationMask');
    expect(source).toContain('UIDevice.current.userInterfaceIdiom == .pad ? .all : super.supportedInterfaceOrientations');
  });

  it('keeps the responsive mobile WebView content mode on iPad', () => {
    expect(read('capacitor.config.ts')).toMatch(/ios: {[^}]*preferredContentMode: 'mobile',/);
  });

  it('skips the iPhone keyboard accessory backdrop on iPad', () => {
    const source = read('ios/App/App/BridgeViewController.swift');

    expect(source).toContain('UIDevice.current.userInterfaceIdiom == .pad ? nil : keyboardAccessoryBackdrop');
  });

  it('reports hardware keyboard state to the loaded page', () => {
    const source = read('ios/App/App/BridgeViewController.swift');

    expect(source).toContain('import GameController');
    expect(source).toContain('hardwareKeyboardMessageHandler = "exHardwareKeyboard"');
    expect(source).toMatch(/source: Self\.hardwareKeyboardScript,\s*injectionTime: \.atDocumentStart/);
    expect(source).toContain('configuration.userContentController.add(self, name: Self.hardwareKeyboardMessageHandler)');
    expect(source).toContain('forName: Self.hardwareKeyboardMessageHandler');
    expect(source).toContain('window.__EX_HARDWARE_KEYBOARD__ = value');
    expect(source).toContain('new CustomEvent("ex-mobile:hardware-keyboard", { detail: { connected: value } })');
    expect(source).toContain('handler.postMessage("sync")');
    expect(source).toContain('name: .GCKeyboardDidConnect');
    expect(source).toContain('name: .GCKeyboardDidDisconnect');
    expect(source).toContain('GCKeyboard.coalesced != nil && !softwareKeyboardVisible');
    expect(source).toContain('window.__exMobileSetHardwareKeyboard(\\(connected))');
    expect(source).toContain('softwareKeyboardMinimumHeight: CGFloat = 150');
    expect(source).toContain('let softwareKeyboard = keyboardIntersection.height >= Self.softwareKeyboardMinimumHeight');
    expect(source).toContain('setSoftwareKeyboardVisible(softwareKeyboard)');
    expect(source.match(/setSoftwareKeyboardVisible\(false\)/g)).toHaveLength(2);
  });

  it('leaves the hardware-keyboard shortcuts bar floating over the page', () => {
    const source = read('ios/App/App/BridgeViewController.swift');

    expect(source).toMatch(
      /setSoftwareKeyboardVisible\(softwareKeyboard\)[\s\S]*guard softwareKeyboard else {\s*keyboardBackgroundView\.isHidden = true\s*return\s*}[\s\S]*keyboardBackgroundView\.isHidden = false/,
    );
  });

  it('guards releases against dropping iPad support', () => {
    const fastfile = read('fastlane/Fastfile');

    expect(fastfile).not.toContain('assert_iphone_only');
    expect(fastfile).toContain('def assert_universal_device_family');
    expect(fastfile).toContain('family == "1,2"');
    expect(fastfile.match(/^\s+assert_universal_device_family$/gm)).toHaveLength(2);
  });

  it('offers an iPad simulator target', () => {
    const makefile = read('Makefile');

    expect(makefile).toMatch(/^IPAD_SIMULATOR \?= iPad/m);
    expect(makefile).toContain('$(MAKE) ios SIMULATOR="$(IPAD_SIMULATOR)"');
  });
});
