/// <reference types="node" />

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The release lane uploads fastlane/screenshots wholesale and replaces the
// listing's images, so a wrong-sized or stray file would ship unreviewed.
// App Store Connect takes these two sizes for this app's device families.
const ACCEPTED = new Map([
  ['2752x2064', 'iPad 13-inch, landscape'],
  ['1320x2868', 'iPhone 6.9-inch, portrait'],
]);

const UPLOAD_DIR = resolve(process.cwd(), 'fastlane/screenshots/en-US');

function pngSize(path: string): string {
  const png = readFileSync(path);
  // IHDR width/height live at a fixed offset in every PNG.
  return `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`;
}

describe('App Store screenshots', () => {
  const files = readdirSync(UPLOAD_DIR).filter((name) => name.endsWith('.png'));

  it('ships only sizes App Store Connect accepts', () => {
    const wrong = files
      .map((name) => [name, pngSize(resolve(UPLOAD_DIR, name))] as const)
      .filter(([, size]) => !ACCEPTED.has(size));

    expect(wrong).toEqual([]);
  });

  it('covers every required device family', () => {
    const sizes = new Set(files.map((name) => pngSize(resolve(UPLOAD_DIR, name))));

    for (const size of ACCEPTED.keys()) expect(sizes).toContain(size);
  });

  it('keeps one orientation per device family, so a set is never mixed', () => {
    const byFamily = new Map<string, Set<string>>();
    for (const name of files) {
      const family = name.startsWith('iphone') ? 'iphone' : 'ipad';
      const [width, height] = pngSize(resolve(UPLOAD_DIR, name)).split('x').map(Number);
      const orientation = width > height ? 'landscape' : 'portrait';
      byFamily.set(family, (byFamily.get(family) ?? new Set()).add(orientation));
    }

    for (const [family, orientations] of byFamily) {
      expect(`${family}: ${[...orientations].join(', ')}`).toBe(`${family}: ${[...orientations][0]}`);
    }
  });

  it('uploads nothing that lives outside the locale folder', () => {
    const stray = readdirSync(resolve(process.cwd(), 'fastlane/screenshots')).filter((entry) => entry !== 'en-US');

    expect(stray).toEqual([]);
  });
});
