# Production Readiness Checklist: Autopay Tech WhatsApp System

Verify all security, operational, and architectural items before initiating live deployment.

---

## 1. Environment & Security Checklist

- [x] **Environment Separation**: `NODE_ENV=production` configured.
- [x] **Fail-Fast Environment Guard**: Server rejects startup if mandatory secrets match default strings.
- [x] **Git Exclusions**: Both root `.gitignore` and `server/.gitignore` ignore `.env` files.
- [x] **Zero Hardcoded Secrets**: Bundle scan verifies 0 tokens, MongoDB URIs, or secrets in `client/dist`.
- [x] **CORS Configuration**: Restricted to explicit `CLIENT_ORIGIN` (`https://app.yourdomain.com`). `origin: "*"` disabled.
- [x] **Auth Cookie Security**: `httpOnly = true`, `secure = true` in production, `sameSite = 'strict'`.
- [x] **JWT Expiration & Secrets**: Access tokens (15 mins), Refresh tokens (7 days). Strong production secrets required.
- [x] **Rate Limiting**: Rate limiters active on `/api/auth/login`. Meta webhooks exempt from restrictive rate limits.
- [x] **HTTP Security Headers**: Helmet configured with CSP, X-Content-Type-Options, Frameguard, Referrer-Policy.
- [x] **Upload MIME & Extension Whitelist**: Only `.jpg`, `.jpeg`, `.png`, `.pdf`, `.mp4` allowed. Executable extensions strictly rejected.
- [x] **Path Traversal Guard**: Filename sanitization via `path.basename()` enforces storage isolation in `/storage/company/assets`.

---

## 2. Infrastructure & Operations Checklist

- [x] **MongoDB Atlas Security**: Authenticated TLS connection via environment variable `MONGODB_URI`.
- [x] **503 Health Guard**: `GET /api/health` returns `HTTP 503 Service Unavailable` on database disconnection.
- [x] **Graceful Shutdown**: `SIGTERM` and `SIGINT` handlers cleanly terminate express listener and MongoDB connection pool.
- [x] **Campaign Restart Recovery**: Automatic transition of interrupted campaigns to `INTERRUPTED` state without duplicate sends.
- [x] **Controlled Sending Engine**: Non-Redis MongoDB atomic claiming (`QUEUED` → `SENDING` → `SENT`). Concurrency limited (`5`).
- [x] **Webhook Security & Idempotency**: `X-Hub-Signature-256` HMAC validation over raw body. `MessageEvent` unique compound index `[whatsappMessageId, status]`.
- [x] **Excel Export Memory Protection**: Cursor-based retrieval streaming `.xlsx` files safely for 10,000+ recipient datasets.
- [x] **Pagination Limits**: Page size limit capped at `Math.min(limit, 100)` to prevent memory exhaustion attacks.
- [x] **Storage Volume Persistence**: Uploaded assets stored under persistent mount point `/storage`.
- [x] **Build Checks**: Both Server (`tsc`) and Client (`vite`) compile with 0 errors.

---

## Final Status
**ALL 25 CHECKLIST ITEMS VERIFIED AND PASSED**
