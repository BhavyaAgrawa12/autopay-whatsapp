# Meta WhatsApp Business Cloud API Webhook Setup Guide

This guide explains how an administrator configures Meta Webhooks in the **Meta Developer Console** for real-time delivery, read, and failure status updates.

---

## 1. Webhook Requirements Overview

Meta WhatsApp Cloud API sends real-time HTTP POST notifications when a message transitions through delivery states:
`SENT` → `DELIVERED` → `READ` (or `FAILED`).

The system processes incoming webhooks at:
- **Challenge Verification**: `GET /api/webhooks/whatsapp`
- **Event Notification**: `POST /api/webhooks/whatsapp`

---

## 2. Meta Developer Console Configuration Steps

1. Log into the [Meta for Developers Console](https://developers.facebook.com/).
2. Select your **WhatsApp Business App**.
3. Under **WhatsApp** in the left sidebar, navigate to **Configuration**.
4. Locate the **Webhooks** card and click **Edit**.
5. Configure the following values:

   | Setting Field | Production Value / Placeholder |
   | :--- | :--- |
   | **Callback URL** | `https://YOUR_PUBLIC_DOMAIN/api/webhooks/whatsapp` |
   | **Verify Token** | Use value configured in `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (in `server/.env`) |

6. Click **Verify and Save**. Meta will issue a `GET` request to verify the `hub.challenge`.
7. Under **Webhook Fields**, subscribe to the **`messages`** webhook field.

---

## 3. Server Signature Security (`X-Hub-Signature-256`)

All incoming `POST` webhook requests from Meta include an `X-Hub-Signature-256` header.
The system automatically validates HMAC SHA-256 over raw request bytes using `WHATSAPP_APP_SECRET`.

> [!IMPORTANT]
> Ensure `WHATSAPP_APP_SECRET` is set in `server/.env` to enable HMAC SHA-256 request signature validation.

---

## 4. Local Testing & Tunneling (Development Only)

`localhost` cannot directly receive public HTTP requests from Meta.
For local testing:
1. Run a local HTTPS tunnel (e.g. `ngrok http 5000` or `localtunnel`).
2. Provide the tunnel HTTPS URL (`https://<subdomain>.ngrok-free.app/api/webhooks/whatsapp`) as the Callback URL in Meta Developer Console.
3. Alternatively, execute the automated offline test suite (`scratch/test_phase8b_webhooks.js`).
