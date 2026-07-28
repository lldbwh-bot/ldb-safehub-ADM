import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const constantsSource = read('src/locationFloorOptions.ts');
const componentPaths = [
  'src/components/InspectionsView.tsx',
  'src/components/PreventiveMaintenanceView.tsx',
  'src/components/IncidentsView.tsx',
  'src/components/RepairAssessmentView.tsx',
  'src/components/RepairsView.tsx'
];
const componentSource = componentPaths.map(read).join('\n');
const dataStoreSource = read('src/dataStore.ts');
const typesSource = read('src/types.ts');

assert.match(constantsSource, /LOCATION_FLOOR_LABEL\s*=\s*['"]ສະຖານທີ່\/ຊັ້ນອາຄານ['"]/);

const optionMatches = [...constantsSource.matchAll(/['"]ຊັ້ນ ([1-7])['"]/g)].map((match) => match[1]);
assert.deepEqual(optionMatches, ['1', '2', '3', '4', '5', '6', '7']);
assert.doesNotMatch(constantsSource, /ຊັ້ນ (8|9|10)|ຊັ້ນໃຕ້ດິນ|Other/);

assert.doesNotMatch(componentSource, /ສະຖານທີ່ \/ ຫ້ອງ|Specify Room\/Location|Room\/Location/);
assert.doesNotMatch(componentSource, /custom_room_options|custom_inspection_rooms|ເພີ່ມຄ່າໃໝ່/);
assert.match(componentSource, /LOCATION_FLOOR_OPTIONS/);
assert.match(componentSource, /LOCATION_FLOOR_LABEL/);

// Existing persistence contracts and legacy import aliases must remain intact.
assert.match(dataStoreSource, /ສະຖານທີ່_ຫ້ອງ/);
assert.match(dataStoreSource, /item\["ສະຖານທີ່ \/ ຫ້ອງ"\]/);
assert.match(dataStoreSource, /item\["Specify Room\/Location"\]/);
assert.match(typesSource, /ສະຖານທີ່_ຫ້ອງ\?: string/);
assert.match(typesSource, /roomOrLocation: string/);

// Read-only views must use an explicit safe fallback.
assert.match(componentSource, /\|\| ['"]—['"]/);

console.log('Location floor field checks passed: exact label, seven options, legacy keys preserved.');
