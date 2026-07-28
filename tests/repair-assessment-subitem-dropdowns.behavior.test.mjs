import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const temporaryDirectory = await mkdtemp(join(process.cwd(), 'tests', '.repair-assessment-dropdowns-'));
const bundle = join(temporaryDirectory, 'RepairAssessmentView.mjs');

await build({
  entryPoints: [join(process.cwd(), 'src/components/RepairAssessmentView.tsx')],
  outfile: bundle,
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
  KeyboardEvent: window.KeyboardEvent,
  localStorage: window.localStorage,
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: window.navigator });

window.localStorage.setItem('ldb_repair_presets_v3', JSON.stringify([
  {
    id: 'preset-a',
    repairSubCategory: 'Electrical',
    repairSubItem: 'Lamp broken',
    sparePart: 'LED A',
    workType: 'ກວດເຊັກ-ສ້ອມ',
    unit: 'item',
    estimatedUnitCost: 0,
  },
  {
    id: 'preset-b',
    repairSubCategory: 'Electrical',
    repairSubItem: 'Lamp broken',
    sparePart: 'LED B',
    workType: 'ປ່ຽນອະໄຫຼ່',
    unit: 'item',
    estimatedUnitCost: 0,
  },
]));

try {
  const React = await import('react');
  const { act } = React;
  const { createRoot } = await import('react-dom/client');
  const componentUrl = pathToFileURL(bundle).href + '?t=' + Date.now();
  const { default: RepairAssessmentView } = await import(componentUrl);
  const rootElement = document.querySelector('#root');
  const root = createRoot(rootElement);

  const incident = {
    PID: 'INC-DROPDOWN-1',
    ລະຫັດກວດກາ: 'INC-DROPDOWN-1',
    ລະບົບທີ່ກວດ: 'Electrical',
    ໝວດລະບົບກວດ: 'Lamp broken',
    ລາຍການກວດ: 'Lamp',
    ລະຫັດຊັບສິນ: '',
    ພາກສ່ວນຊັບສົມບັດ: '',
    ໝວດລາຍການ: '',
    ລາຍການ: '',
    ລາຍລະອຽດປັນຫາທີ່ພົບ: 'Lamp does not work',
    ປະເມີນຜົນກະທົບ: 'ຕ່ຳ',
    ວີທີແກ້ໄຂ: '',
    ວັນທີ່ກວດ: '2026-07-27',
    ເວລາກວດ: '09:00',
    ຜູ້ກວດກາ: 'Admin',
    ຊື່ຜູ້ກວດ: 'Admin',
    'ສາຂາ ': '00.HQ',
    'ຝ່າຍ/ໜ່ວຍບໍລິການ': 'Facilities',
    ຂະແໜງ: 'none',
    ຊັ້ນອາຄານ: 'ຊັ້ນ 1',
    ເດືອນ: 7,
    ປີ: 2026,
    order: 1,
    ຮັບອໍເດີ: 0,
    ຈຳນວນຄົງຄ້າງ: 1,
    ສະຖານະ: 'ລໍຖ້າປະເມີນ',
  };
  const assessment = {
    PID: 'ASM-DROPDOWN-1',
    assessmentId: 'ASM-DROPDOWN-1',
    incidentId: incident.PID,
    branch: '00.HQ',
    division: 'Facilities',
    sector: 'none',
    roomOrLocation: 'ຊັ້ນ 1',
    assetCode: '',
    assetName: '',
    assessorName: 'Admin',
    assessorType: '',
    assessmentDate: '2026-07-27',
    assessmentStatus: 'ກຳລັງປະເມີນ',
    subItems: [{
      id: 'sub-dropdown-1',
      repairSubCategory: 'Electrical',
      repairSubItem: 'Lamp broken',
      workType: 'ກວດເຊັກ-ສ້ອມ',
      repairerType: 'ຊ່າງພາຍໃນ',
      internalRepairerName: 'Admin',
      vendorName: '',
      partSource: 'No Part Required',
      sparePart: 'LED A',
      quantity: 1,
      unit: 'item',
      estimatedUnitCost: 0,
      estimatedTotalCost: 0,
    }],
  };

  await act(async () => {
    root.render(React.createElement(RepairAssessmentView, {
      incidents: [incident],
      assessments: [assessment],
      repairTracking: [],
      onAddAssessment: () => {},
      onUpdateAssessment: () => {},
      onUpdateIncidentStatus: () => {},
      currentUser: {
        username: 'Admin',
        password_raw: '',
        status: 'Admin',
        branch: '00.HQ',
      },
      initialIncidentId: incident.PID,
      onClearInitialIncidentId: () => {},
    }));
  });

  const repairRow = [...document.querySelectorAll('tr')]
    .find(row => row.querySelectorAll('select').length >= 6);
  assert.ok(repairRow, 'the existing repair sub-item row is rendered');
  let selects = [...repairRow.querySelectorAll('select')];
  const sparePartSelect = selects[2];
  const partSourceSelect = selects[3];
  const repairerTypeSelect = selects[5];

  assert.equal(
    sparePartSelect.disabled,
    false,
    'spare part/service selection stays enabled when source is No Part Required',
  );

  await act(async () => {
    sparePartSelect.value = 'LED B';
    sparePartSelect.dispatchEvent(new Event('change', { bubbles: true }));
  });
  selects = [...repairRow.querySelectorAll('select')];
  assert.equal(selects[2].value, 'LED B', 'the selected spare part/service changes');
  assert.equal(
    selects[3].value,
    'No Part Required',
    'changing the spare part/service does not overwrite its independently selected source',
  );

  await act(async () => {
    repairerTypeSelect.value = 'Vendor';
    repairerTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));
  });
  selects = [...repairRow.querySelectorAll('select')];
  assert.equal(selects[5].value, 'Vendor', 'repairer type changes from internal repairer to Vendor');

  await act(async () => {
    selects[5].value = 'ຊ່າງພາຍໃນ';
    selects[5].dispatchEvent(new Event('change', { bubbles: true }));
  });
  selects = [...repairRow.querySelectorAll('select')];
  assert.equal(
    selects[5].value,
    'ຊ່າງພາຍໃນ',
    'repairer type can change back from Vendor to internal repairer',
  );

  await act(async () => {
    root.unmount();
  });

  console.log('Repair Assessment sub-item dropdown behavior checks passed.');
} finally {
  dom.window.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}
