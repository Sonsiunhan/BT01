import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../apps/server/src/app.js';
import type { FastifyInstance } from 'fastify';

describe('CSRF & Token Validation (D-02.03, D-02.01)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.ALLOWED_ORIGINS = 'https://frontend.example.com';
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('D-02.03-POS: allows valid origin and x-ott-request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/room/create',
      headers: {
        'origin': 'https://frontend.example.com',
        'x-ott-request': '1'
      }
    });
    // Can fail with 401 if unauthenticated, but should NOT be 403 CSRF
    expect(res.statusCode).not.toBe(403);
  });

  it('D-02.03-NEG1: rejects evil origin', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/room/create',
      headers: {
        'origin': 'https://evil.com',
        'x-ott-request': '1'
      }
    });
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.message).toMatch(/not allowed/i);
  });

  it('D-02.03-NEG2: rejects null origin', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/room/create',
      headers: {
        'origin': 'null',
        'x-ott-request': '1'
      }
    });
    expect(res.statusCode).toBe(403);
  });

  it('D-02.03-NEG3: rejects missing origin and referer', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/room/create',
      headers: {
        'x-ott-request': '1'
      }
    });
    expect(res.statusCode).toBe(403);
  });

  it('D-02.03-NEG4: rejects missing x-ott-request header', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/room/create',
      headers: {
        'origin': 'https://frontend.example.com'
      }
    });
    expect(res.statusCode).toBe(403);
  });
});
