import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('central login refreshes from D1 instead of pushing stale browser data to D1', () => {
  assert.match(
    appSource,
    /await\s+pullCentralData\(\)/,
    'central login should pull the authoritative D1 data into the browser',
  );
  assert.doesNotMatch(
    appSource,
    /initializeCentralData/,
    'central login must not re-import stale localStorage snapshots into D1',
  );
  assert.doesNotMatch(
    appSource,
    /browser-to-D1 migration/,
    'old browser-to-D1 migration path should not remain in the login flow',
  );
});

