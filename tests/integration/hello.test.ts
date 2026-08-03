import request from 'supertest';
import { createApp } from '../../src/app';

describe('GET /hello', () => {
  it('returns a hello world message', async () => {
    const app = createApp();
    const res = await request(app).get('/hello');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Hello World' });
  });
});
