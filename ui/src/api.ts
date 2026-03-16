import type { HttpService } from '@docker/extension-api-client-types/dist/v1';

export interface MailHogStatus {
  running: boolean;
  containerID?: string;
  containerName?: string;
  smtpHostPort?: string;
  uiHostPort?: string;
}

export interface StartConfig {
  smtpHostPort: number;
  uiHostPort: number;
}

export interface TestEmailPayload {
  from: string;
  to: string;
  subject: string;
  body: string;
}

type Service = HttpService;

// ServiceError (non-2xx) has { message, statusCode } but is not an Error instance.
export function extractMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  if (typeof err === 'string') return err;
  return 'Unknown error';
}

export class ConflictError extends Error {
  constructor(public readonly container: MailHogStatus) {
    super('Container name conflict');
  }
}

async function handleResponse<T>(promise: Promise<unknown>): Promise<T> {
  const result = await promise;
  console.log('[api] response:', result);
  const data = result as { error?: string } & T;
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(data.error as string);
  }
  return data as T;
}

export async function fetchStatus(svc: Service): Promise<MailHogStatus> {
  console.log('[api] GET /mailhog/status');
  return handleResponse<MailHogStatus>(svc.get('/mailhog/status'));
}

export async function startMailHog(svc: Service, cfg: StartConfig): Promise<void> {
  console.log('[api] POST /mailhog/start', cfg);
  try {
    await handleResponse<{ status: string }>(
      svc.post('/mailhog/start', { smtpHostPort: cfg.smtpHostPort, uiHostPort: cfg.uiHostPort })
    );
  } catch (err) {
    const msg = extractMessage(err);
    if (msg.includes('Conflict') || msg.includes('already in use')) {
      const container = await fetchStatus(svc);
      throw new ConflictError(container);
    }
    throw err;
  }
}

export async function stopMailHog(svc: Service): Promise<void> {
  console.log('[api] POST /mailhog/stop');
  await handleResponse<{ status: string }>(svc.post('/mailhog/stop', {}));
}

export async function removeMailHog(svc: Service): Promise<void> {
  console.log('[api] POST /mailhog/remove');
  await handleResponse<{ status: string }>(svc.post('/mailhog/remove', {}));
}

export async function restartMailHog(svc: Service, cfg: StartConfig): Promise<void> {
  console.log('[api] POST /mailhog/restart', cfg);
  await handleResponse<{ status: string }>(
    svc.post('/mailhog/restart', { smtpHostPort: cfg.smtpHostPort, uiHostPort: cfg.uiHostPort })
  );
}

export async function sendTestEmail(
  svc: Service,
  payload: TestEmailPayload
): Promise<{ delivered: boolean }> {
  console.log('[api] POST /mailhog/test', payload);
  return handleResponse<{ delivered: boolean }>(svc.post('/mailhog/test', payload));
}

export interface Settings {
  smtpPort?: number;
  uiPort?: number;
  zoom?: number;
  testFrom?: string;
  testTo?: string;
  testSubject?: string;
  testBody?: string;
}

export async function fetchSettings(svc: Service): Promise<Settings> {
  return handleResponse<Settings>(svc.get('/mailhog/settings'));
}

export async function saveSettings(svc: Service, s: Settings): Promise<void> {
  await handleResponse<Settings>(svc.post('/mailhog/settings', s));
}
