export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
  };
  requestId: string;
}

export interface HealthResponse {
  status: 'ok';
  environment: string;
  version: string;
  timestamp: string;
  services: {
    d1: 'ok' | 'disabled';
    r2: 'ok' | 'disabled';
  };
  requestId: string;
}

export interface VersionResponse {
  environment: string;
  version: string;
  requestId: string;
}

export const DATASET_NAMES = [
  'inspections',
  'incidents',
  'assessments',
  'approvals',
  'repair-tracking',
  'repairs',
  'pm-assets',
  'pm-history',
  'branches',
  'checklist-items',
  'sectors',
  'repair-presets',
] as const;

export type DatasetName = (typeof DATASET_NAMES)[number];

export const isDatasetName = (value: string): value is DatasetName =>
  DATASET_NAMES.some((dataset) => dataset === value);

export interface AuthenticatedUser {
  usernameNorm: string;
  username: string;
  status: string;
  branch: string;
  image?: string;
  allowedTabs: string[];
}

export interface CentralRecordEnvelope {
  recordId: string;
  branch: string;
  record: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface BatchMutationRequest {
  upserts: Array<{
    recordId: string;
    record: Record<string, unknown>;
    version?: number;
  }>;
  deletes: string[];
}
