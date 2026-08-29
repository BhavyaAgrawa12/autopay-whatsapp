# Production Deployment Guide: Autopay Tech WhatsApp System

This document outlines the complete production deployment guide for the **Autopay Tech WhatsApp Promotional Campaign Management System**.

---

## 1. System Requirements

- **Runtime**: Node.js v20.x or v24.x LTS.
- **Database**: MongoDB Atlas Cluster (v6.0+ or v7.0+) or Self-Hosted Replica Set with TLS enabled.
- **Meta WhatsApp Business Account**: Verified WhatsApp Business Account (WABA) with WhatsApp Cloud API enabled.
- **Hosting / OS**: Linux (Ubuntu 22.04 LTS / Debian 12 / RHEL 9) or Windows Server 2022.
- **Reverse Proxy**: Nginx, Caddy, or Cloudflare Tunnel with valid SSL/TLS certificate (HTTPS required for Meta webhooks).

---

## 2. Mandatory Environment Variables

Set the following environment variables on the production server (e.g. in system environment or `/etc/environment` / PM2 ecosystem file):

> [!IMPORTANT]
> **Zero Hardcoded Credentials**: Never write real credentials in `.env.example`, source code, or frontend files.

```env
NODE_ENV=production
PORT=5000
CLIENT_ORIGIN=https://app.yourdomain.com
CLIENT_URL=https://app.yourdomain.com

# Administrator Authentication
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD_HASH=$2a$12$YourStrongBcryptPasswordHashHere
JWT_SECRET=YourSuperLongRandomJWTSecretKeyAtLeast64CharsLong
JWT_REFRESH_SECRET=YourSuperLongRandomJWTRefreshSecretKeyAtLeast64CharsLong

# Permanent MongoDB Atlas Connection (TLS Enabled)
MONGODB_URI=mongodb+srv://db_user:StrongPassword@cluster.mongodb.net/whatsapp_campaign_manager?retryWrites=true&w=majority

# Official WhatsApp Business Cloud API
WHATSAPP_ACCESS_TOKEN=EAAG.....(YourPermanentSystemUserToken)
WHATSAPP_PHONE_NUMBER_ID=1240050135864285
WHATSAPP_BUSINESS_ACCOUNT_ID=1823628351959290
WHATSAPP_API_VERSION=v18.0
WHATSAPP_WEBHOOK_VERIFY_TOKEN=YourCustomWebhookVerifyToken2026
WHATSAPP_APP_SECRET=YourMetaAppSecret32HexChars

# Engine Tuning
WHATSAPP_SEND_CONCURRENCY=5
WHATSAPP_MAX_RETRIES=3
```

---

## 3. Storage Persistence & File Systems

Company media assets and logo uploads are stored on disk at:
- Asset Media Directory: `/storage/company/assets`
- Logo Directory: `/storage/company/logo`

> [!WARNING]
> **Persistent Disk Requirement**: Ensure `/storage` is mapped to a persistent volume (e.g., AWS EBS, Docker volume mount, or persistent block storage). Ephemeral containers (like Heroku dynos or stateless serverless functions) will lose uploaded media assets upon restart.

---

## 4. Building & Running Production Code

### Step A: Install Production Dependencies
```bash
npm install --omit=dev
```

### Step B: Build Backend & Frontend
```bash
# Compile Server TypeScript
npm --prefix server run build

# Compile Client Production Bundle
npm --prefix client run build
```

### Step C: Start Process Manager (PM2 / Systemd)
```bash
# Using PM2
pm2 start server/dist/index.js --name "whatsapp-backend" --env production
pm2 save
```

---

## 5. Reverse Proxy & Nginx Configuration (HTTPS)

Meta WhatsApp Cloud API webhooks **require an HTTPS URL**. Sample Nginx configuration:

```nginx
server {
    listen 443 ssl http2;
    server_name app.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/app.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.yourdomain.com/privkey.pem;

    # Serve React SPA Frontend Static Assets
    location / {
        root /var/www/whatsapp-campaign/client/dist;
        try_files $uri $uri/ /index.html;
    }

    # Proxy Node.js Express Backend API & Webhooks
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Serve Media Storage Static Files
    location /storage/ {
        proxy_pass http://127.0.0.1:5000/storage/;
    }
}
```

---

## 6. Meta Developer Console Webhook Setup

1. In Meta Developer Console, navigate to **WhatsApp** → **Configuration**.
2. **Callback URL**: `https://app.yourdomain.com/api/webhooks/whatsapp`
3. **Verify Token**: Enter your configured `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
4. Click **Verify and Save** (Server responds `HTTP 200` with `hub.challenge`).
5. Subscribe to the **`messages`** webhook field.

---

## 7. Operational Health Check & Monitoring

- **Health Endpoint**: `GET https://app.yourdomain.com/api/health`
- Returns `HTTP 200 OK` when healthy, or `HTTP 503 Service Unavailable` if MongoDB is disconnected.
- **Graceful Shutdown**: On `SIGTERM` or `SIGINT`, backend closes HTTP server and terminates MongoDB connection pool cleanly.
