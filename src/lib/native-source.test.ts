/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const androidNavigationPluginPath = resolve(
  process.cwd(),
  'android/app/src/main/java/com/digitaltolk/ex/mobile/ServerNavigationPlugin.java',
);
const androidVariablesPath = resolve(process.cwd(), 'android/variables.gradle');
const androidBuildGradlePath = resolve(process.cwd(), 'android/build.gradle');
const readAndroidNavigationPlugin = () => readFileSync(androidNavigationPluginPath, 'utf8');
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
    expect(readAndroidBuildGradle()).toContain('details.requested.group == \'org.jetbrains.kotlin\'');
    expect(readAndroidBuildGradle()).toContain('details.useVersion rootProject.ext.kotlin_version');
  });
});
