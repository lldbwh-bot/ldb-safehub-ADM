import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const loginSource = await readFile(
  join(process.cwd(), 'src/components/LoginView.tsx'),
  'utf8',
);
const accountsSource = await readFile(
  join(process.cwd(), 'src/components/AccountsView.tsx'),
  'utf8',
);

assert.doesNotMatch(
  loginSource,
  /\bshowPassword\b|setShowPassword|EyeOff/,
  'Login must not contain a password reveal state or control',
);
assert.match(
  loginSource,
  /type="password"/,
  'Login password input must always be masked',
);

assert.doesNotMatch(
  accountsSource,
  /showPasswordMap|togglePasswordVisibility|canSeePassword\s*\?/,
  'User Permissions must not contain a password reveal state or control',
);
assert.doesNotMatch(
  accountsSource,
  /\{\s*user\.password_raw\s*\}/,
  'User Permissions must never render a stored password',
);
assert.match(
  accountsSource,
  /setPassword\(''\);[\s\S]{0,250}setStatus\(user\.status\)/,
  'Editing an account must not preload its existing password',
);
assert.match(
  accountsSource,
  /type="password"[\s\S]{0,180}autoComplete="new-password"/,
  'Account password changes must use a masked input',
);

console.log('Password visibility security checks passed.');
