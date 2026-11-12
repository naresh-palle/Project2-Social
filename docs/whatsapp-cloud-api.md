# WhatsApp Cloud API (FLUGR)

Webhook stub is live on the API:

- Verify: `GET https://project2-social.onrender.com/api/webhooks/whatsapp`
- Receive: `POST https://project2-social.onrender.com/api/webhooks/whatsapp`

## Meta Developer Console

1. App → **WhatsApp** → **Configuration** → **Callback URL**
2. Callback URL: `https://project2-social.onrender.com/api/webhooks/whatsapp`
3. Verify token: any strong random string you also set on Render as `WHATSAPP_VERIFY_TOKEN`
4. Subscribe to `messages` (and optionally `message_template_status_update`)

## Render environment

```text
WHATSAPP_VERIFY_TOKEN=<same as Meta verify token>
WHATSAPP_ACCESS_TOKEN=<permanent / system-user token>
WHATSAPP_PHONE_NUMBER_ID=<from WhatsApp → API Setup>
WHATSAPP_BUSINESS_ACCOUNT_ID=<WABA id>
```

## Status

| Piece | Status |
|---|---|
| Webhook verify handshake | Implemented |
| Inbound event ack + Mongo `webhook_events` store | Implemented |
| Outbound send / template messages | Not wired yet |
| OTP via WhatsApp | Not wired (mobile OTP still Fast2SMS) |

Check `/api/oauth/providers` → `whatsapp` block for configured flags (no secrets leaked).
