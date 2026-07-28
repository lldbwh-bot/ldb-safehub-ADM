import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [appSource, loginSource, cssSource] = await Promise.all([
  readFile(new URL('../src/App.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/LoginView.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/index.css', import.meta.url), 'utf8'),
]);

const [accountsSource, pmSource, incidentsSource, assessmentSource, inspectionsSource] = await Promise.all([
  readFile(new URL('../src/components/AccountsView.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/PreventiveMaintenanceView.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/IncidentsView.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/RepairAssessmentView.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/InspectionsView.tsx', import.meta.url), 'utf8'),
]);

assert.match(appSource, /className="[^"]*safehub-app-theme[^"]*"/);
assert.doesNotMatch(loginSource, /safehub-app-theme/);

for (const view of [
  'DashboardView', 'InspectionsView', 'PreventiveMaintenanceView', 'IncidentsView',
  'RepairAssessmentView', 'ApprovalsView', 'RepairTrackingView', 'RepairsView', 'AccountsView',
]) {
  const scopeStart = appSource.indexOf('safehub-app-theme');
  assert.ok(scopeStart >= 0 && appSource.indexOf(`<${view}`, scopeStart) > scopeStart, `${view} must render in theme scope`);
}

const expectedTokens = {
  '--safehub-app-bg': '#050a14',
  '--safehub-panel': '#04101f',
  '--safehub-surface': '#08182b',
  '--safehub-surface-hover': '#0d2139',
  '--safehub-text': '#f8fafc',
  '--safehub-text-secondary': '#cbd5e1',
  '--safehub-text-muted': '#94a3b8',
  '--safehub-cyan': '#67e8f9',
  '--safehub-gold': '#c5a059',
  '--safehub-info': '#93c5fd',
  '--safehub-indigo': '#c4b5fd',
  '--safehub-success': '#86efac',
  '--safehub-warning': '#fde68a',
  '--safehub-danger': '#fca5a5',
};

for (const [name, value] of Object.entries(expectedTokens)) {
  assert.match(cssSource.toLowerCase(), new RegExp(`${name}:\\s*${value}`));
}

function luminance(hex) {
  const rgb = hex.match(/[a-f\d]{2}/gi).map(channel => parseInt(channel, 16) / 255);
  const linear = rgb.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(foreground, background) {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

for (const [foreground, background] of [
  ['f8fafc', '04101f'], ['cbd5e1', '04101f'], ['94a3b8', '04101f'],
  ['f8fafc', '08182b'], ['cbd5e1', '08182b'], ['94a3b8', '08182b'],
  ['93c5fd', '04101f'], ['c4b5fd', '04101f'],
  ['86efac', '052529'], ['fde68a', '3d2612'], ['fca5a5', '42171b'],
]) assert.ok(contrast(foreground, background) >= 4.5, `${foreground} on ${background} must meet WCAG AA`);

for (const marker of [
  'Authenticated dark-theme compatibility layer',
  '--safehub-panel', '--safehub-surface', '--safehub-text-secondary',
  '.safehub-app-theme :where(.bg-white',
  '.safehub-app-theme :where(input, select, textarea)',
  '.safehub-app-theme :where(input, select, textarea)::placeholder',
  '.safehub-app-theme :where(input, select, textarea):disabled',
  '.safehub-app-theme :where(table)',
  '.safehub-app-theme :where(thead)',
  '.safehub-app-theme :where(tbody tr)',
  '.safehub-app-theme :where([role="dialog"])',
  '.safehub-app-theme :where(.bg-red-50',
  '.safehub-app-theme :where(.bg-amber-50',
  '.safehub-app-theme :where(.bg-emerald-50',
  '.safehub-app-theme :where(.text-red-950',
  '.safehub-app-theme :where(.text-amber-950',
  '.safehub-app-theme :where(.text-emerald-950',
  '.safehub-app-theme :where(.text-blue-950',
  '.safehub-app-theme :where(.text-slate-650',
]) assert.ok(cssSource.includes(marker), `missing scoped theme rule: ${marker}`);

for (const marker of [
  '.bg-slate-200', '.bg-slate-300', '.bg-gray-200', '.bg-gray-300',
  '.bg-slate-50\\/70', '.bg-slate-100\\/60',
  '.bg-sky-50', '.bg-sky-100',
]) assert.ok(cssSource.includes(marker), `missing remaining light-surface mapping: ${marker}`);

assert.match(pmSource, /bg-amber-400[^"']*text-\[#050a14\]|text-\[#050a14\][^"']*bg-amber-400/, 'gold Add Asset action must use dark navy text');
assert.match(
  pmSource,
  /id="pm-subtab-navigation"[^>]*bg-\[#071426\]/,
  'PM subtabs must use the same dark navy navigation surface as dashboard subtabs',
);
assert.equal(
  (pmSource.match(/border-b-2 border-cyan-300 !text-cyan-200 bg-cyan-300\/10/g) || []).length,
  3,
  'all three active PM subtabs must use the dashboard cyan active treatment',
);
assert.equal(
  (pmSource.match(/!text-slate-400 hover:!text-white hover:bg-white\/5/g) || []).length,
  3,
  'all three inactive PM subtabs must keep readable dashboard-style text',
);
assert.match(incidentsSource, /bg-\[#071f33\][^"']*text-sky-200/, 'linear-flow banner must use a dark sky surface');
assert.match(assessmentSource, /from-\[#071827\] to-\[#10152f\]/, 'assessment banner must use a dark gradient');
assert.match(accountsSource, /activeSubTab === 'branches'/, 'accounts tab contract must remain present');
assert.match(
  accountsSource,
  /id="accounts-subtab-navigation"[^>]*bg-\[#071426\]/,
  'accounts subtabs must use the same dark navy navigation surface as dashboard subtabs',
);
assert.equal(
  (accountsSource.match(/border-b-2 border-cyan-300 !text-cyan-200 bg-cyan-300\/10/g) || []).length,
  5,
  'all five active accounts subtabs must use the dashboard cyan active treatment',
);
assert.equal(
  (accountsSource.match(/!text-slate-400 hover:!text-white hover:bg-white\/5/g) || []).length,
  5,
  'all five inactive accounts subtabs must keep readable dashboard-style text',
);

const clearAllButtons = inspectionsSource.match(
  /className="[^"]*bg-amber-600[^"]*hover:bg-amber-700[^"]*text-white[^"]*"[^>]*>\s*× ລົບທັງໝົດ \(Clear All\)/g,
) || [];
assert.equal(clearAllButtons.length, 2, 'create and edit Clear All buttons must use the Direct Incident amber treatment');
assert.doesNotMatch(
  inspectionsSource,
  /bg-rose-50[^"']*hover:bg-rose-150[^"']*text-rose-750[^>]*>\s*× ລົບທັງໝົດ \(Clear All\)/,
  'Clear All buttons must not use unsupported rose utilities',
);

assert.doesNotMatch(cssSource, /^\.bg-white(?:\s|,)/m, 'light compatibility rules must not leak into Login');

console.log('application theme scope and contrast tests passed');
