import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { request, ApiError, setAuthHandlers, clearAuthHandlers } from '../../../src/api/apiClient';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('apiClient.request', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearAuthHandlers();
  });

  it('returns parsed JSON on success', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ status: 'ok' }));
    const result = await request<{ status: string }>('/health');
    expect(result).toEqual({ status: 'ok' });
  });

  it('returns undefined for a 204 response', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
    const result = await request('/bookings/abc');
    expect(result).toBeUndefined();
  });

  it('throws ApiError with the status and message on a non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ error: 'NotFoundError', message: 'Booking not found' }, 404),
    );
    await expect(request('/bookings/missing')).rejects.toMatchObject({
      status: 404,
      message: 'Booking not found',
    });
  });

  it('does not attach an Authorization header when no auth handlers are registered', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([]));
    await request('/admin/tables', { authenticated: true });
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('attaches an Authorization header from getAccessToken when authenticated', async () => {
    setAuthHandlers({
      getAccessToken: () => 'token-123',
      refreshAccessToken: vi.fn(),
      onAuthFailure: vi.fn(),
    });
    vi.mocked(fetch).mockResolvedValue(jsonResponse([]));
    await request('/admin/tables', { authenticated: true });
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer token-123');
  });

  it('refreshes once and retries on a 401, then succeeds', async () => {
    const refreshAccessToken = vi.fn().mockResolvedValue('new-token');
    setAuthHandlers({
      getAccessToken: () => 'stale-token',
      refreshAccessToken,
      onAuthFailure: vi.fn(),
    });
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ error: 'UnauthorizedError', message: 'expired' }, 401))
      .mockResolvedValueOnce(jsonResponse([{ id: 1 }]));

    const result = await request<unknown[]>('/admin/tables', { authenticated: true });

    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual([{ id: 1 }]);
  });

  it('calls onAuthFailure when refresh does not resolve the 401', async () => {
    const onAuthFailure = vi.fn();
    setAuthHandlers({
      getAccessToken: () => 'stale-token',
      refreshAccessToken: vi.fn().mockResolvedValue(null),
      onAuthFailure,
    });
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ error: 'UnauthorizedError', message: 'expired' }, 401),
    );

    await expect(request('/admin/tables', { authenticated: true })).rejects.toBeInstanceOf(ApiError);
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
  });
});
