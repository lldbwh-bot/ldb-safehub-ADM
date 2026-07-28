import { describe, expect, it } from 'vitest';
import {
  buildDatasetRecords,
  getStableRecordId,
  unwrapDataset,
} from './centralDataStore';

describe('central datastore compatibility mapping', () => {
  it('uses canonical IDs for transactional and master records', () => {
    expect(getStableRecordId('incidents', { PID: 'INC-1' }, 0)).toBe('INC-1');
    expect(getStableRecordId('pm-assets', { assetCode: 'PM-1' }, 0)).toBe('PM-1');
    expect(
      getStableRecordId(
        'branches',
        { ສາຂາ: '00.HQ', 'ຝ່າຍ/ໜ່ວຍບໍລິການ': 'IT' },
        0,
      ),
    ).toBe('00.HQ::IT');
  });

  it('builds API envelopes and unwraps bootstrap records without changing keys', () => {
    const source = [{ PID: 'INC-1', ສາຂາ: '00.HQ', detail: 'original' }];
    const records = buildDatasetRecords('incidents', source);
    expect(records).toEqual([{ recordId: 'INC-1', record: source[0] }]);
    expect(
      unwrapDataset(records.map((entry) => ({ ...entry, version: 1 }))),
    ).toEqual(source);
  });
});
