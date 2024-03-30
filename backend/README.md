# Human in the Loop Backend

A small REST API put on Cloudflare Workers to demonstrate a simple Human in the Loop system.

Uses:
- Cloudflare Workers
- Cloudflare D1
- Cloudflare Queue

## GET /get-message
```bash
curl https://human-in-the-loop.groff.workers.dev/get-oldest-message
```

## POST /add-message
```bash
curl -X POST https://human-in-the-loop.groff.workers.dev/add-message      -H "Content-Type: application/json"      -d '{"message":"Hello, World!"}'
```

## PUT /update-message-status/{messageId}
```bash
curl -X PUT https://human-in-the-loop.groff.workers.dev/update-message-status/<message_id>      -H "Content-Type: application/json"      -d '{"status":"approved"}'
```

or

```bash
curl -X PUT https://human-in-the-loop.groff.workers.dev/update-message-status/<message_id>      -H "Content-Type: application/json"      -d '{"status":"denied"}'
```

## GET /get-reviewed/messages
```bash
curl "https://human-in-the-loop.groff.workers.dev/get-reviewed-messages?page=1"
```