import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const temporaryDirectory = await mkdtemp(join(process.cwd(), 'tests', '.direct-incident-form-type-'));
const componentBundle = join(temporaryDirectory, 'IncidentsView.mjs');

await build({
  entryPoints: [join(process.cwd(), 'src/components/IncidentsView.tsx')],
  outfile: componentBundle,
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['react', 'react-dom', 'lucide-react', 'xlsx'],
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
  localStorage: window.localStorage,
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: window.navigator });

const masterChecklist = [
  {
    Form_Type: 'ສຳນັກງານໃຫຍ່',
    ລະບົບທີ່ກວດ: 'HQ SYSTEM',
    ໝວດລະບົບກວດ: 'HQ AREA',
    ລາຍການກວດ: 'HQ ITEM',
  },
  {
    Form_Type: 'ສາຂາ',
    ລະບົບທີ່ກວດ: 'BRANCH SYSTEM',
    ໝວດລະບົບກວດ: 'BRANCH AREA',
    ລາຍການກວດ: 'BRANCH ITEM',
  },
  {
    Form_Type: 'ໜ່ວຍບໍລິການ',
    ລະບົບທີ່ກວດ: 'SERVICE SYSTEM',
    ໝວດລະບົບກວດ: 'SERVICE AREA',
    ລາຍການກວດ: 'SERVICE ITEM',
  },
  {
    Form_Type: 'ຫ້ອງຮັບເງິນ',
    ລະບົບທີ່ກວດ: 'CASH SYSTEM',
    ໝວດລະບົບກວດ: 'CASH AREA',
    ລາຍການກວດ: 'CASH ITEM',
  },
];

localStorage.setItem('ldb_checklist_items_v10', JSON.stringify(masterChecklist));
localStorage.setItem('ldb_branches', JSON.stringify([
  {
    ລຳດັບ: 1,
    ສາຂາ: '00.ສໍານັກງານໃຫຍ່',
    'ຝ່າຍ/ໜ່ວຍບໍລິການ': 'ຝ່າຍບໍລິຫານ',
  },
  {
    ລຳດັບ: 2,
    ສາຂາ: '00.ສໍານັກງານໃຫຍ່',
    'ຝ່າຍ/ໜ່ວຍບໍລິການ': 'ຫ້ອງຮັບເງິນ ຫຮ01',
  },
  {
    ລຳດັບ: 3,
    ສາຂາ: '23.ສາຂາ ວັງວຽງ',
    'ຝ່າຍ/ໜ່ວຍບໍລິການ': '23.ສາຂາ ວັງວຽງ',
  },
  {
    ລຳດັບ: 4,
    ສາຂາ: '24.ໜ່ວຍບໍລິການ ນບ01',
    'ຝ່າຍ/ໜ່ວຍບໍລິການ': 'ໜ່ວຍບໍລິການ ນບ01',
  },
]));

const selectWithOption = (root, value) =>
  [...root.querySelectorAll('select')]
    .find(select => [...select.options].some(option => option.value === value));

const optionValues = select => [...select.options].map(option => option.value);

try {
  const React = await import('react');
  const { act } = React;
  const { createRoot } = await import('react-dom/client');
  const { default: IncidentsView } = await import(pathToFileURL(componentBundle).href);

  const root = createRoot(document.querySelector('#root'));
  await act(async () => {
    root.render(React.createElement(IncidentsView, {
      incidents: [],
      onAddIncident: () => {},
      onUpdateIncident: () => {},
      onApproveIncident: () => {},
      currentUser: {
        username: 'Admin',
        password_raw: '',
        status: 'Admin',
        branch: '00.ສໍານັກງານໃຫຍ່',
      },
      inspections: [],
      sectors: [{ ຂະແໜງ: 'none' }],
    }));
  });

  const openButton = [...document.querySelectorAll('button')]
    .find(button => button.textContent?.includes('Direct Incident Report'));
  assert.ok(openButton);
  await act(async () => {
    openButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  const modalHeading = [...document.querySelectorAll('h4')]
    .find(element => element.textContent?.includes('Direct Incident Report'));
  const modal = modalHeading?.parentElement?.parentElement?.parentElement;
  assert.ok(modal);

  let systemSelect = selectWithOption(modal, 'HQ SYSTEM');
  assert.ok(systemSelect, 'Direct Incident loads System Category from saved HQ Master Data');
  assert.deepEqual(optionValues(systemSelect), ['HQ SYSTEM']);
  let areaSelect = selectWithOption(modal, 'HQ AREA');
  assert.ok(areaSelect);
  assert.deepEqual(optionValues(areaSelect), ['HQ AREA']);

  const branchSelect = selectWithOption(modal, '23.ສາຂາ ວັງວຽງ');
  assert.ok(branchSelect);
  await act(async () => {
    branchSelect.value = '23.ສາຂາ ວັງວຽງ';
    branchSelect.dispatchEvent(new Event('change', { bubbles: true }));
  });

  systemSelect = selectWithOption(modal, 'BRANCH SYSTEM');
  assert.ok(systemSelect, 'changing to a branch replaces HQ systems with branch systems');
  assert.deepEqual(optionValues(systemSelect), ['BRANCH SYSTEM']);
  areaSelect = selectWithOption(modal, 'BRANCH AREA');
  assert.ok(areaSelect);
  assert.deepEqual(optionValues(areaSelect), ['BRANCH AREA']);

  await act(async () => {
    branchSelect.value = '00.ສໍານັກງານໃຫຍ່';
    branchSelect.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const divisionSelect = selectWithOption(modal, 'ຫ້ອງຮັບເງິນ ຫຮ01');
  assert.ok(divisionSelect);
  await act(async () => {
    divisionSelect.value = 'ຫ້ອງຮັບເງິນ ຫຮ01';
    divisionSelect.dispatchEvent(new Event('change', { bubbles: true }));
  });

  systemSelect = selectWithOption(modal, 'CASH SYSTEM');
  assert.ok(systemSelect, 'cash-office division under branch 00 uses cash-office systems');
  assert.deepEqual(optionValues(systemSelect), ['CASH SYSTEM']);
  areaSelect = selectWithOption(modal, 'CASH AREA');
  assert.ok(areaSelect);

  await act(async () => {
    branchSelect.value = '24.ໜ່ວຍບໍລິການ ນບ01';
    branchSelect.dispatchEvent(new Event('change', { bubbles: true }));
  });
  systemSelect = selectWithOption(modal, 'SERVICE SYSTEM');
  assert.ok(systemSelect, 'service-unit branch uses service-unit systems');
  assert.deepEqual(optionValues(systemSelect), ['SERVICE SYSTEM']);
  areaSelect = selectWithOption(modal, 'SERVICE AREA');
  assert.ok(areaSelect);

  assert.equal(modal.textContent.includes('undefined'), false);
  assert.equal(modal.textContent.includes('null'), false);

  await act(async () => {
    root.unmount();
  });

  console.log('Direct Incident form-type Master Data behavior checks passed.');
} finally {
  dom.window.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}
