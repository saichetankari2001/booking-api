import request from 'supertest';
import { Express } from 'express';
import { seedAdmin } from './seedAdmin';

export async function getAuthToken(
  app: Express,
  email = 'admin@test.com',
  password = 'password123',
): Promise<string> {
  await seedAdmin(email, password);
  const res = await request(app).post('/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(
      `getAuthToken: login failed with status ${res.status}: ${JSON.stringify(res.body)}`,
    );
  }
  return res.body.accessToken as string;
}
