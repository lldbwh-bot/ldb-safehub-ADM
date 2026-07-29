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

assert.match(
  accountsSource,
  /visiblePasswordUsers|visiblePasswordMap/,
  'User Permissions must provide explicit per-user password visibility state',
);
assert.match(
  accountsSource,
  /canSeePassword\s*\?\s*\(user\.password_raw/,
  'User Permissions may render the stored password only after the explicit eye toggle is enabled',
);
assert.match(
  accountsSource,
  /EyeOff[\s\S]{0,600}Eye/,
  'User Permissions must render eye icons for show/hide password controls',
);
assert.match(
  accountsSource,
  /handleExportUsersExcel/,
  'User Permissions must provide an export/download action for the filtered user list',
);
assert.doesNotMatch(
  accountsSource,
  /password_raw:\s*user\.password_raw|Password['"]\s*:\s*user\.password_raw/,
  'User export must not include raw passwords',
);
assert.match(
  accountsSource,
  /viewingUser|setViewingUser/,
  'User Permissions must provide a user details view modal',
);
assert.match(
  accountsSource,
  /setImage\(user\.image\s*\|\|\s*''\)|user\.image\s*\?\s*<img/,
  'User Permissions must support an optional user image/avatar',
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
