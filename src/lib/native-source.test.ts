/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const androidNavigationPluginPath = resolve(
  process.cwd(),
  'android/app/src/main/java/com/digitaltolk/ex/mobile/ServerNavigationPlugin.java',
);
const readAndroidNavigationPlugin = () => readFileSync(androidNavigationPluginPath, 'utf8');

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
});
