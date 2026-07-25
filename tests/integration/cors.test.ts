import request from 'supertest';
import { createApp } from '../../src/app';

const app = createApp();

describe('CORS', () => {
  it('reflects an allowed origin in Access-Control-Allow-Origin', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('responds to a preflight OPTIONS request', async () => {
    const res = await request(app)
      .options('/bookings')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});
