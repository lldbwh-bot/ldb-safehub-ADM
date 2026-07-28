import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const temporaryDirectory = await mkdtemp(join(process.cwd(), 'tests', '.inspection-master-data-'));
const componentBundle = join(temporaryDirectory, 'InspectionsView.mjs');
const dataStoreBundle = join(temporaryDirectory, 'dataStore.mjs');

await Promise.all([
  build({
    entryPoints: [join(process.cwd(), 'src/components/InspectionsView.tsx')],
    outfile: componentBundle,
    bundle: true,
    platform: 'node',
    format: 'esm',
    external: ['react', 'react-dom', 'lucide-react', 'xlsx'],
    logLevel: 'silent',
  }),
  build({
    entryPoints: [join(process.cwd(), 'src/dataStore.ts')],
    outfile: dataStoreBundle,
    bundle: true,
    platform: 'node',
    format: 'esm',
    logLevel: 'silent',
  }),
]);

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
  localStorage: window.localStorage,
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: window.navigator });

try {
  const React = await import('react');
  const { act } = React;
  const { createRoot } = await import('react-dom/client');
  const { default: InspectionsView } = await import(pathToFileURL(componentBundle).href);
  const dataStore = await import(pathToFileURL(dataStoreBundle).href);

  const masterChecklist = [
    {
      Form_Type: 'ສຳນັກງານໃຫຍ່',
      ລະບົບທີ່ກວດ: 'MASTER SYSTEM ONLY',
      ໝວດລະບົບກວດ: 'MASTER AREA ONLY',
      ລາຍການກວດ: 'MASTER INSPECTION ITEM ONLY',
    },
    {
      Form_Type: 'ສຳນັກງານໃຫຍ່',
      ລະບົບທີ່ກວດ: 'MASTER SYSTEM ONLY',
      ໝວດລະບົບກວດ: 'SECOND MASTER AREA',
      ລາຍການກວດ: 'SECOND MASTER ITEM',
    },
    {
      Form_Type: 'ສຳນັກງານໃຫຍ່',
      ລະບົບທີ່ກວດ: 'MASTER SYSTEM ONLY',
      ໝວດລະບົບກວດ: 'THIRD MASTER AREA',
      ລາຍການກວດ: 'THIRD MASTER ITEM',
    },
    {
      Form_Type: 'ສຳນັກງານໃຫຍ່',
      ລະບົບທີ່ກວດ: 'ຊັບສິນ',
      ໝວດລະບົບກວດ: 'MASTER ASSET AREA ONLY',
      ລາຍການກວດ: 'MASTER ASSET ITEM ONLY',
    },
    {
      Form_Type: 'ຫ້ອງຮັບເງິນ',
      ລະບົບທີ່ກວດ: 'MASTER CASH SYSTEM',
      ໝວດລະບົບກວດ: 'MASTER CASH AREA',
      ລາຍການກວດ: 'MASTER CASH ITEM',
    },
  ];

  const rootElement = document.querySelector('#root');
  const root = createRoot(rootElement);

  const adminUser = {
    username: 'Admin',
    password_raw: '',
    status: 'Admin',
    branch: '00.ສໍານັກງານໃຫຍ່',
  };
  const createInspectionView = (checklistItems, currentUser = adminUser) => React.createElement(InspectionsView, {
      key: currentUser.branch,
      inspections: [],
      onAddInspection: () => {},
      currentUser,
      incidents: [],
      onAddIncident: () => {},
      checklistItems,
      sectors: [{ ຂະແໜງ: 'none' }],
    });

  await act(async () => {
    root.render(createInspectionView(masterChecklist));
  });

  const openButton = [...document.querySelectorAll('button')]
    .find(button => button.textContent?.includes('New Inspection'));
  assert.ok(openButton, 'New Inspection action is rendered');

  await act(async () => {
    openButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  const modalHeading = [...document.querySelectorAll('h4')]
    .find(element => element.textContent?.includes('New Safety Inspection'));
  const modal = modalHeading?.parentElement?.parentElement?.parentElement;
  assert.ok(modal, 'New Safety Inspection modal is open');

  const systemSelect = [...modal.querySelectorAll('select')]
    .find(select => [...select.options].some(option => option.value === 'MASTER SYSTEM ONLY'));
  assert.ok(systemSelect, 'System Category options come from the supplied Master Data');
  assert.equal(systemSelect.value, 'MASTER SYSTEM ONLY', 'the first valid Master System is selected');
  assert.deepEqual(
    [...systemSelect.options].map(option => option.value),
    ['MASTER SYSTEM ONLY', 'ຊັບສິນ'],
    'System Category does not mix static systems into the live Master Data',
  );

  const areaSelect = [...modal.querySelectorAll('select')]
    .find(select => [...select.options].some(option => option.value === 'MASTER AREA ONLY'));
  assert.ok(areaSelect, 'Area / Point options come from the selected Master System');
  assert.equal(
    modal.textContent.includes('MASTER INSPECTION ITEM ONLY'),
    true,
    'Inspection Items come from the selected Master Area / Point',
  );

  await act(async () => {
    areaSelect.value = 'SECOND MASTER AREA';
    areaSelect.dispatchEvent(new Event('change', { bubbles: true }));
  });
  assert.equal(
    modal.textContent.includes('SECOND MASTER ITEM'),
    true,
    'a non-first Area / Point can be selected',
  );

  await act(async () => {
    root.render(createInspectionView(masterChecklist.map(item => ({ ...item }))));
  });
  assert.equal(
    modal.textContent.includes('📁 SECOND MASTER AREA'),
    true,
    'a valid selected Area / Point remains selected after an equivalent Master Data refresh',
  );
  assert.equal(
    modal.textContent.includes('SECOND MASTER ITEM'),
    true,
    'inspection items remain scoped to the retained Area / Point after refresh',
  );

  await act(async () => {
    systemSelect.value = 'ຊັບສິນ';
    systemSelect.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const assetAreaSelect = [...modal.querySelectorAll('select')]
    .find(select => [...select.options].some(option => option.value === 'MASTER ASSET AREA ONLY'));
  assert.ok(
    assetAreaSelect,
    'the Asset system also uses its Master Area / Point instead of a synthetic category',
  );

  await act(async () => {
    root.render(createInspectionView(masterChecklist, {
      username: 'CashUser',
      password_raw: '',
      status: 'Branch User',
      branch: '00.ຫ້ອງຮັບເງິນ ຫຮ01',
    }));
  });

  const cashOpenButton = [...document.querySelectorAll('button')]
    .find(button => button.textContent?.includes('New Inspection'));
  assert.ok(cashOpenButton);
  await act(async () => {
    cashOpenButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  const cashModalHeading = [...document.querySelectorAll('h4')]
    .find(element => element.textContent?.includes('New Safety Inspection'));
  const cashModal = cashModalHeading?.parentElement?.parentElement?.parentElement;
  assert.ok(cashModal);
  const cashSystemSelect = [...cashModal.querySelectorAll('select')]
    .find(select => [...select.options].some(option => option.value === 'MASTER CASH SYSTEM'));
  assert.ok(
    cashSystemSelect,
    'a cash-office user under branch 00 automatically receives cash-office Master Data',
  );
  assert.equal(
    [...cashSystemSelect.options].some(option => option.value === 'MASTER SYSTEM ONLY'),
    false,
    'cash-office Master Data does not leak HQ systems',
  );

  dataStore.saveChecklistItems([]);
  assert.deepEqual(
    dataStore.getSavedChecklistItems(),
    [],
    'an intentionally empty saved Master Data list stays empty instead of restoring static rows',
  );

  await act(async () => {
    root.unmount();
  });

  console.log('Inspection Master Data linkage behavior checks passed.');
} finally {
  dom.window.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}
