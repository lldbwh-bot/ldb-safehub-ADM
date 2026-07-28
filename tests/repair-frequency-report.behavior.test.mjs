import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const temporaryDirectory = await mkdtemp(join(process.cwd(), 'tests', '.repair-frequency-report-'));
const bundle = join(temporaryDirectory, 'RepairFrequencyReport.mjs');

await build({
  entryPoints: [join(process.cwd(), 'src/components/dashboard/RepairFrequencyReport.tsx')],
  outfile: bundle,
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['react', 'react-dom'],
  logLevel: 'silent',
});

const dom = new JSDOM('<!doctype html><html><body><main id="root"></main></body></html>', {
  pretendToBeVisual: true,
  url: 'http://localhost/',
});
const { window } = dom;
Object.assign(globalThis, {
  window,
  document: window.document,
  HTMLElement: window.HTMLElement,
  Node: window.Node,
  Event: window.Event,
  MouseEvent: window.MouseEvent,
  KeyboardEvent: window.KeyboardEvent,
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: window.navigator });

try {
  const React = await import('react');
  const { act } = React;
  const { createRoot } = await import('react-dom/client');
  const componentUrl = pathToFileURL(bundle).href + '?t=' + Date.now();
  const { default: RepairFrequencyReport } = await import(componentUrl);
  const rootElement = document.querySelector('#root');
  const root = createRoot(rootElement);
  const report = {
    subcategories: [{
      name: 'Electrical',
      inspectRepair: 1,
      replacePart: 0,
      service: 0,
      total: 1,
      cases: [{
        key: 'asm-1::sub-1',
        assessmentId: 'ASM-1',
        incidentId: 'INC-1',
        branch: 'North',
        repairSubCategory: 'Electrical',
        repairSubItem: 'Broken lamp',
        sparePart: 'LED lamp',
        workType: 'ກວດເຊັກ-ສ້ອມ',
        quantity: 2,
        estimatedTotalCost: 500,
      }],
    }],
    subItems: [],
    spareParts: [],
  };

  await act(async () => {
    root.render(React.createElement(RepairFrequencyReport, { report }));
  });

  const rankingTables = [...rootElement.querySelectorAll('[data-repair-ranking-table]')];
  assert.equal(rankingTables.length, 3, 'all three ranking tables render at full report width');
  for (const table of rankingTables) {
    assert.equal(table.querySelectorAll('thead th').length, 6, 'each ranking table exposes all six columns');
    assert.match(table.className, /\btable-fixed\b/, 'fixed layout keeps all columns visible without horizontal scrolling');
    assert.doesNotMatch(table.className, /min-w-\[640px\]/, 'ranking tables do not force clipped horizontal width');
  }

  const trigger = [...rootElement.querySelectorAll('button')]
    .find(button => button.textContent.trim() === 'Electrical');
  assert.ok(trigger, 'the ranking row exposes an activatable button');

  trigger.focus();
  await act(async () => {
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  let dialog = document.querySelector('[role="dialog"]');
  assert.ok(dialog, 'pointer activation opens the detail dialog');
  assert.match(dialog.textContent, /ASM-1/);
  assert.match(dialog.textContent, /INC-1/);
  assert.match(dialog.textContent, /Broken lamp/);
  assert.match(dialog.textContent, /LED lamp/);

  const closeButton = dialog.querySelector('button[aria-label="Close repair case details"]');
  await act(async () => {
    closeButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  assert.equal(document.querySelector('[role="dialog"]'), null, 'closing removes the detail dialog');
  assert.equal(document.activeElement, trigger, 'closing restores focus to the activating row');

  assert.equal(trigger.tagName, 'BUTTON', 'keyboard activation uses native button semantics');
  trigger.focus();
  await act(async () => {
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    trigger.click();
  });
  dialog = document.querySelector('[role="dialog"]');
  assert.ok(dialog, 'Enter activation opens the matching detail dialog');
  assert.match(dialog.textContent, /ASM-1/);

  await act(async () => {
    dialog.querySelector('button[aria-label="Close repair case details"]')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  assert.equal(document.activeElement, trigger, 'keyboard activation also restores focus after close');
  await act(async () => {
    root.unmount();
  });

  console.log('repair frequency report behavior tests passed');
} finally {
  dom.window.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}
