# Meta Instagram Integration — Production Guide

## Architecture Overview

```
loraloop.com (Next.js / Vercel)
  ├── /api/auth/meta/login         → OAuth entry: generates state, redirects to Meta
  ├── /api/auth/meta/callback      → OAuth return: validates state, hands off to API
  ├── /api/webhooks/meta           → Webhook receiver (GET verify + POST events)
  ├── /api/instagram/accounts      → Proxy → NestJS GET /meta/instagram/accounts
  ├── /api/instagram/publish       → Proxy → NestJS POST /meta/instagram/publish
  ├── /api/instagram/schedule      → Proxy → NestJS POST /meta/instagram/schedule
  └── /api/instagram/refresh-token → Proxy → NestJS POST /meta/instagram/refresh-token/:id

api.loraloop.com (NestJS / Hetzner)
  └── /v1/meta/...                 → MetaController (auth, accounts, publish, webhook)

BullMQ Queues (Redis)
  ├── webhook-events               → WebhookEventsProcessor (concurrency: 10)
  ├── refresh-token                → TokenRefreshProcessor (concurrency: 3)
  └── publish-post                 → PublishPostProcessor (concurrency: 5)

Postgres (Supabase)
  ├── instagram_accounts           → IG Business Account per Meta connection
  ├── webhook_events               → Raw inbound events (processed async)
  └── token_refresh_jobs           → Tracks proactive 60-day refresh schedule
```

---

## Environment Variables

### Web App (Vercel)
```env
META_APP_ID=1011129944932547
META_APP_SECRET=f86e3801073a01bda3c51e0a649f1aa4
META_CONFIG_ID=28024283373826478
META_REDIRECT_URI=https://loraloop.com/api/auth/meta/callback
META_WEBHOOK_VERIFY_TOKEN=loraloop_secure_webhook_token_2026
META_OAUTH_STATE_SECRET=<64-char hex — openssl rand -hex 32>
NEXT_PUBLIC_APP_URL=https://loraloop.com
API_URL=https://api.loraloop.com
```

### API App (NestJS)
```env
META_APP_ID=1011129944932547
META_APP_SECRET=f86e3801073a01bda3c51e0a649f1aa4
META_CONFIG_ID=28024283373826478
META_REDIRECT_URI=https://loraloop.com/api/auth/meta/callback
META_WEBHOOK_VERIFY_TOKEN=loraloop_secure_webhook_token_2026
ENCRYPTION_KEY=<64-char hex>
```

---

## OAuth Flow (Step by Step)

1. User clicks **Connect Instagram** → `POST /api/auth/meta/login`
2. Server generates HMAC-signed state, stores in HttpOnly cookie
3. Redirect to `https://www.facebook.com/v23.0/dialog/oauth?...`
4. User approves permissions on Meta
5. Meta redirects to `https://loraloop.com/api/auth/meta/callback?code=...&state=...`
6. Callback validates CSRF state from cookie
7. Calls NestJS `POST /v1/meta/oauth/complete` with `{ code }`
8. NestJS:
   a. Exchanges code → short-lived token
   b. Upgrades to long-lived token (~60 days)
   c. Calls `/me/accounts` → Facebook Pages
   d. For each Page: fetches Instagram Business Account ID + profile
   e. Stores encrypted tokens in `platform_connections`
   f. Stores IG accounts in `instagram_accounts`
   g. Schedules token refresh job 50 days out (via BullMQ)
9. Redirect to `/dashboard/instagram?connected=true&accounts=N`

---

## Token Management

Meta long-lived tokens expire after **~60 days**.

- On connection: token refresh scheduled for **50 days** out
- On refresh: new token scheduled for another 50 days
- If refresh fails: `platform_connections.connectionStatus = EXPIRED`, user notified
- `TokenRefreshProcessor` handles retries (max 3 attempts, exponential backoff)

Manual refresh: `POST /api/instagram/refresh-token` with `{ connectionId }`

---

## Webhook Setup

### 1. Configure in Meta Developer Console
- URL: `https://loraloop.com/api/webhooks/meta`
- Verify Token: `loraloop_secure_webhook_token_2026`
- Subscribe to: `comments`, `mentions`, `messages`, `feed`

### 2. Verification (GET)
Meta sends `GET /api/webhooks/meta?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...`
Returns the challenge string if token matches.

### 3. Event Processing (POST)
- HMAC-256 signature validated immediately
- Raw event stored in `webhook_events` table
- Processing delegated to `WEBHOOK_EVENTS` BullMQ queue
- `WebhookEventsProcessor` handles: comments, mentions, DMs, publish status
- Always returns `200 OK` immediately (Meta retries on non-200)

---

## Publishing Flow

### Image Post
```json
POST /api/instagram/publish
{
  "igAccountDbId": "<instagram_accounts.id>",
  "type": "IMAGE",
  "caption": "Your caption #hashtags",
  "mediaUrls": ["https://cdn.loraloop.com/image.jpg"]
}
```

### Carousel
```json
{
  "type": "CAROUSEL",
  "mediaUrls": ["https://cdn/img1.jpg", "https://cdn/img2.jpg", "..."]
}
```

### Reel
```json
{
  "type": "REEL",
  "mediaUrls": ["https://cdn/video.mp4"]
}
```

### Schedule a Post
```json
POST /api/instagram/schedule
{
  "igAccountDbId": "<id>",
  "type": "IMAGE",
  "mediaUrls": ["https://cdn/image.jpg"],
  "caption": "Scheduled post!",
  "scheduledAt": "2026-06-01T10:00:00.000Z"
}
```

---

## Vercel Deployment

### vercel.json (root)
```json
{
  "buildCommand": "pnpm --filter @loraloop/web build",
  "outputDirectory": "apps/web/.next",
  "framework": "nextjs",
  "env": {
    "META_APP_ID": "@meta-app-id",
    "META_APP_SECRET": "@meta-app-secret",
    "META_CONFIG_ID": "@meta-config-id",
    "META_REDIRECT_URI": "@meta-redirect-uri",
    "META_WEBHOOK_VERIFY_TOKEN": "@meta-webhook-verify-token",
    "META_OAUTH_STATE_SECRET": "@meta-oauth-state-secret"
  }
}
```

Add each env var as a **Vercel Secret** via:
```bash
vercel env add META_APP_SECRET production
```

---

## Database Migration

```bash
# Run on NestJS API server
cd apps/api
pnpm prisma migrate deploy
pnpm prisma generate
```

---

## Redis Setup (BullMQ)

For production, use Redis with TLS (Upstash or Redis Cloud):
```env
REDIS_URL=rediss://user:pass@hostname:6380
```

Queue concurrency limits:
| Queue | Concurrency |
|---|---|
| instagram-publish | 5 |
| webhook-events | 10 |
| refresh-token | 3 |

---

## Security Checklist

- [x] OAuth state validated with HMAC-256 (stored in HttpOnly, Secure, SameSite=Lax cookie)
- [x] Webhook signature verified via `x-hub-signature-256` header on every POST
- [x] Access tokens encrypted with AES-256-GCM before DB storage
- [x] Page access tokens encrypted separately per Instagram account
- [x] All API routes require Supabase JWT authentication
- [x] Meta App Secret never exposed to frontend
- [x] Audit logs written for all OAuth completions
- [x] CSRF protection on OAuth initiation
- [x] Token expiry monitored; notifications sent proactively
- [x] Webhook returns 200 even on invalid signatures (prevents Meta disabling webhook)
- [x] Rate limiting on all API routes (ThrottlerModule)

---

## Meta App Review Checklist

### Required Screenshots / Screencast
Record a full walkthrough showing:
1. User clicks "Connect Instagram" on Loraloop
2. Meta OAuth dialog with all requested permissions visible
3. User approves and is redirected back
4. Instagram account appears in the dashboard
5. User creates and publishes a post
6. User schedules a future post
7. Webhook events being received (show logs)

### Permission Justifications

| Permission | Justification |
|---|---|
| `instagram_basic` | Read profile, media, and account info to display connected account details |
| `instagram_content_publish` | Publish images, carousels, and reels on behalf of the business |
| `pages_show_list` | List Facebook Pages to find linked Instagram Business Accounts |
| `pages_read_engagement` | Read engagement metrics for published content |
| `business_management` | Access Business Manager to verify Instagram account ownership |
| `instagram_manage_comments` | Monitor and respond to comments via the AI engagement agent |
| `instagram_manage_messages` | Receive and respond to Instagram DMs via the AI agent |

### Test Account Setup
1. Create a Meta Business account at business.facebook.com
2. Create a Facebook Page (any category)
3. Link an Instagram Professional/Business account to that Page
4. Add the test user as an admin in Meta Developer Console → App Roles
5. Use the test user to complete the OAuth flow

### Data Deletion Callback
URL: `https://loraloop.com/data-deletion`
When triggered:
1. Find user by `signed_request` HMAC
2. Delete all `platform_connections` for that user
3. Delete all `instagram_accounts` for that user
4. Return confirmation URL

---

## Production Readiness Checklist

### Before Launch
- [ ] Run `prisma migrate deploy` on production DB
- [ ] Set all env vars in Vercel (web) and deployment server (API)
- [ ] Configure Meta webhook URL in Developer Console
- [ ] Verify webhook with `hub.verify_token`
- [ ] Subscribe to webhook fields: `comments`, `mentions`, `messages`, `feed`
- [ ] Test full OAuth flow with a real Instagram Business Account
- [ ] Verify token encryption/decryption works end-to-end
- [ ] Confirm BullMQ workers start and connect to Redis
- [ ] Enable Sentry on both web and API apps
- [ ] Set up alerts for `TOKEN_EXPIRED` notifications

### Monitoring
- [ ] Sentry error tracking enabled
- [ ] Queue metrics dashboards (BullBoard or similar)
- [ ] Alert on `webhook_events.processed = false` older than 5 minutes
- [ ] Alert on `token_refresh_jobs.status = FAILED`
- [ ] Alert on `platform_connections.connectionStatus = EXPIRED`

### Scaling to 10,000+ Customers
- BullMQ workers are stateless — scale horizontally by running multiple instances
- Each queue worker processes jobs independently (idempotency via `jobId`)
- Webhook events stored first, processed async — no data loss under load
- Token refresh jobs scheduled per-connection with individual BullMQ delays
- Redis connection pooling handled by BullMQ internally
- Postgres connection pooling via PgBouncer recommended at scale
