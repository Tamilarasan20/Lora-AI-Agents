import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * E2E smoke tests — requires a running Postgres instance.
 * Set DATABASE_URL in .env.test before running.
 * These tests use real HTTP and test the full request/response cycle.
 */
describe('Loraloop API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );

    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  describe('Health', () => {
    it('GET /health → 200', async () => {
      const res = await request(app.getHttpServer()).get('/health');
      expect(res.status).toBe(200);
    });
  });

  describe('Auth', () => {
    const testEmail = `e2e-${Date.now()}@test.com`;
    const testPassword = 'TestPass123!';
    let accessToken: string;

    it('POST /v1/auth/register → 201 with tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email: testEmail, password: testPassword, fullName: 'E2E User' });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
      accessToken = res.body.data.accessToken;
    });

    it('POST /v1/auth/register → 409 on duplicate email', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email: testEmail, password: testPassword, fullName: 'Duplicate' });

      expect(res.status).toBe(409);
    });

    it('POST /v1/auth/login → 200 with tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: testEmail, password: testPassword });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('accessToken');
      accessToken = res.body.data.accessToken;
    });

    it('POST /v1/auth/login → 401 with wrong password', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: testEmail, password: 'WrongPassword' });

      expect(res.status).toBe(401);
    });

    it('GET /v1/auth/me → 200 with valid token', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('email', testEmail);
    });

    it('GET /v1/auth/me → 401 without token', async () => {
      const res = await request(app.getHttpServer()).get('/v1/auth/me');
      expect(res.status).toBe(401);
    });
  });

  describe('Content (authenticated)', () => {
    let accessToken: string;
    let contentId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          email: `content-e2e-${Date.now()}@test.com`,
          password: 'Pass123!',
          fullName: 'Content E2E',
        });
      accessToken = res.body.data?.accessToken;
    });

    it('POST /v1/content → 201 creates draft', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/content')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          caption: 'E2E test post — summer vibes',
          targetPlatforms: ['instagram'],
          contentType: 'IMAGE',
          hashtags: ['e2e', 'summer'],
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.status).toBe('DRAFT');
      contentId = res.body.data.id;
    });

    it('GET /v1/content → 200 lists content', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/content')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('items');
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('GET /v1/content/:id → 200 returns content detail', async () => {
      if (!contentId) return;

      const res = await request(app.getHttpServer())
        .get(`/v1/content/${contentId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(contentId);
    });

    it('PATCH /v1/content/:id → 200 updates status to APPROVED', async () => {
      if (!contentId) return;

      const res = await request(app.getHttpServer())
        .patch(`/v1/content/${contentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ status: 'APPROVED' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('APPROVED');
    });

    it('DELETE /v1/content/:id → 204 deletes content', async () => {
      if (!contentId) return;

      const res = await request(app.getHttpServer())
        .delete(`/v1/content/${contentId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect([200, 204]).toContain(res.status);
    });
  });

  describe('Notifications (authenticated)', () => {
    let accessToken: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          email: `notif-e2e-${Date.now()}@test.com`,
          password: 'Pass123!',
          fullName: 'Notif E2E',
        });
      accessToken = res.body.data?.accessToken;
    });

    it('GET /v1/notifications → 200 returns list', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/notifications')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('items');
    });

    it('GET /v1/notifications/unread-count → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('unread');
    });
  });
});
