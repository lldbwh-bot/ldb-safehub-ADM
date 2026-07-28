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
    d1: 'ok';
    r2: 'ok';
  };
  requestId: string;
}

export interface VersionResponse {
  environment: string;
  version: string;
  requestId: string;
}
