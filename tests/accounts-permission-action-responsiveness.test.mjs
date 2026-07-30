import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const accountsSource = await readFile(
  join(process.cwd(), 'src/components/AccountsView.tsx'),
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

console.log('Accounts permission action responsiveness checks passed.');
