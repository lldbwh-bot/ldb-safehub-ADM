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
const globalStyles = await readFile(
  join(process.cwd(), 'src/index.css'),
  'utf8',
);

assert.match(
  loginSource,
  /\bshowPassword\b[\s\S]*type=\{showPassword\s*\?\s*['"]text['"]\s*:\s*['"]password['"]\}/,
  'Login password input must be masked by default and reveal only through the explicit eye toggle',
);
assert.match(
  loginSource,
  /aria-label=\{showPassword[\s\S]{0,220}ສະແດງລະຫັດຜ່ານ/,
  'Login password reveal control must be accessible and intentional',
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
  /type="password"[\s\S]{0,260}autoComplete="new-password"/,
  'Account password changes must use a masked input',
);
assert.match(
  globalStyles,
  /input\[type=['"]password['"]\]::?-ms-reveal[\s\S]{0,180}display:\s*none/,
  'Microsoft browser native password reveal controls must be hidden globally',
);

console.log('Password visibility security checks passed.');
