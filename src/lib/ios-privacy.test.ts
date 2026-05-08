/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const infoPlistPath = resolve(process.cwd(), 'ios/App/App/Info.plist');

function infoPlist(): string {
  return readFileSync(infoPlistPath, 'utf8');
}

describe('iOS privacy usage descriptions', () => {
  it.each([
    ['NSCameraUsageDescription', /take photos or videos/],
    ['NSMicrophoneUsageDescription', /record videos/],
    ['NSPhotoLibraryUsageDescription', /attach existing photos or videos/],
    ['NSPhotoLibraryAddUsageDescription', /save downloaded chat attachments/],
  ])('keeps %s present for App Review media attachment flows', (key, expectedText) => {
    const plist = infoPlist();

    expect(plist).toContain(`<key>${key}</key>`);
    expect(plist).toMatch(expectedText);
  });
});
