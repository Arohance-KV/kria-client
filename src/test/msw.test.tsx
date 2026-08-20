import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import API from '@/api/axios';
import { server } from './server';

// Proves MSW mocks at the network layer — the real axios `API` instance
// (interceptors and all) runs unchanged; only the wire is faked.
describe('MSW + axios API', () => {
  it('returns the mocked response for an API call', async () => {
    server.use(
      http.get('https://api.kria.club/ping', () =>
        HttpResponse.json({ ok: true, from: 'msw' }),
      ),
    );

    const res = await API.get('/ping');
    expect(res.data).toEqual({ ok: true, from: 'msw' });
  });
});
