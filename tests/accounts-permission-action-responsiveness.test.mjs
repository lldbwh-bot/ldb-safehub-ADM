import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const accountsSource = await readFile(
  join(process.cwd(), 'src/components/AccountsView.tsx'),
  'utf8',
);
const dataStoreSource = await readFile(
  join(process.cwd(), 'src/dataStore.ts'),
  'utf8',
);

const userDeleteBody = accountsSource.match(/const executeDeleteUser = async \(\) => \{([\s\S]*?)\n  \};/)?.[1] || '';
const userSaveBody = accountsSource.match(/const handleSave = async \(e: React\.FormEvent\) => \{([\s\S]*?)\n  \};/)?.[1] || '';

assert.ok(userDeleteBody, 'AccountsView must define executeDeleteUser');
assert.ok(userSaveBody, 'AccountsView must define handleSave');

assert.ok(
  userDeleteBody.indexOf('setDeleteUserConfirm(null)') !== -1 &&
    userDeleteBody.indexOf('persistUserList') !== -1 &&
    userDeleteBody.indexOf('setDeleteUserConfirm(null)') < userDeleteBody.indexOf('persistUserList'),
  'Delete confirmation modal must close before waiting for the user save API',
);

assert.ok(
  userSaveBody.indexOf('setIsOpen(false)') !== -1 &&
    userSaveBody.indexOf('persistUserList') !== -1 &&
    userSaveBody.indexOf('setIsOpen(false)') < userSaveBody.indexOf('persistUserList'),
  'Add/Edit user modal must close before waiting for the user save API',
);

assert.match(
  accountsSource,
  /const persistUserList = async \(nextUsers: UserAccount\[\], successMessage: string, rollbackUsers = users\) => \{/,
  'User permission actions should share a safe background persistence helper',
);

assert.match(
  accountsSource,
  /try \{[\s\S]*await onSaveUsers\(nextUsers\)[\s\S]*catch \(error\)/,
  'Background user persistence must catch API errors instead of leaving UI stuck',
);

assert.match(
  accountsSource,
  /const safeAccountText = \(value: unknown\): string =>/,
  'AccountsView must normalize optional user/master-data fields before filtering or rendering',
);

assert.doesNotMatch(
  accountsSource,
  /user\.(username|branch|status)\.toLowerCase\(\)/,
  'AccountsView must not call toLowerCase directly on nullable user fields',
);

assert.doesNotMatch(
  accountsSource,
  /\.(sparePart|repairSubCategory|repairSubItem)\.toLowerCase\(\)|\]\.toLowerCase\(\)|\]\.trim\(\)\.toLowerCase\(\)/,
  'AccountsView master-data filters must use safe text normalization for nullable imported records',
);

assert.doesNotMatch(
  accountsSource,
  /àº|à»|â€¢|�|Ã|Â|ðŸ|âœ/,
  'AccountsView Lao UI text must remain UTF-8 and not mojibake',
);

assert.match(
  accountsSource,
  /ຈັດການລະບົບ/,
  'AccountsView must contain readable Lao system administration text',
);

assert.doesNotMatch(
  dataStoreSource,
  /àº|à»|â€¢|�|Ã|Â|ðŸ|âœ|\?\?\?\?/,
  'dataStore master-data lookup keys must remain UTF-8 safe and not mojibake',
);

assert.match(
  dataStoreSource,
  /"\\u0EAA\\u0EB2\\u0E82\\u0EB2"/,
  'dataStore branch lookup must use the Lao branch key via unicode escapes',
);

console.log('Accounts permission action responsiveness checks passed.');
