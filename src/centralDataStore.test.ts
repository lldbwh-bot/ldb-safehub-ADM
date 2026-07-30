import { describe, expect, it } from 'vitest';
import {
  buildDatasetRecords,
  getStableRecordId,
  unwrapDataset,
} from './centralDataStore';
import { isProductionHost } from './apiClient';

describe('central datastore compatibility mapping', () => {
  it('enables D1/R2 only on Production hosts', () => {
    expect(isProductionHost('ldb-adm-safehub.com')).toBe(true);
    expect(isProductionHost('ldb-safehub-prod.lldbwh.workers.dev')).toBe(true);
    expect(isProductionHost('localhost')).toBe(false);
  });

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
