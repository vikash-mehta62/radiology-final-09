# Webhook Security Implementation

This document describes the webhook security implementation for the Orthanc PACS Bridge system.

## Overview

The webhook security system provides enterprise-grade security controls for webhook endpoints, including:

- HMAC-SHA256 signature validation
- Replay attack prevention with timestamp validation
- Rate limiting with sliding window algorithm
- Comprehensive security event logging
- IP-based access control

## Usage

### Basic Setup

```javascript
const WebhookSecurity = require('./src/middleware/webhookSecurity');

const webhookSecurity = new WebhookSecurity({
  secret: process.env.WEBHOOK_SECRET,
  timestampTolerance: 300, // 5 minutes
  rateLimit: 100, // requests per minute
  rateLimitWindow: 60 // window in seconds
});

// Apply to webhook endpoint
app.post('/api/webhook/orthanc', webhookSecurity.middleware(), (req, res) => {
  // Process webhook payload
  res.json({ success: true });
});
```

### Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `secret` | `process.env.WEBHOOK_SECRET` | Secret key for HMAC signature generation |
| `timestampTolerance` | 300 | Maximum age of requests in seconds (prevents replay attacks) |
| `rateLimit` | 100 | Maximum requests per IP per time window |
| `rateLimitWindow` | 60 | Rate limiting time window in seconds |

## Security Headers

All webhook requests must include these headers:

- `x-webhook-signature`: HMAC-SHA256 signature of the payload
- `x-webhook-timestamp`: Unix timestamp when the request was created
- `x-webhook-nonce`: Unique identifier to prevent duplicate processing

## Signature Generation

The signature is generated using the following format:

```
data = timestamp + "." + nonce + "." + JSON.stringify(payload)
signature = HMAC-SHA256(secret, data)
```

### Example Orthanc Lua Script

```lua
function OnStableStudy(studyId, tags, metadata)
    local payload = {
        ChangeType = "StableStudy",
        Date = os.date("%Y%m%dT%H%M%S"),
        ID = studyId,
        Path = "/studies/" .. studyId,
        ResourceType = "Study"
    }
    
    local timestamp = tostring(os.time())
    local nonce = GenerateUUID() -- Implement UUID generation
    local secret = "your-webhook-secret"
    
    -- Generate signature
    local data = timestamp .. "." .. nonce .. "." .. json.encode(payload)
    local signature = crypto.hmac.digest("sha256", secret, data, true)
    
    -- Send webhook
    local headers = {
        ["Content-Type"] = "application/json",
        ["x-webhook-signature"] = signature,
        ["x-webhook-timestamp"] = timestamp,
        ["x-webhook-nonce"] = nonce
    }
    
    HttpPost("http://bridge-server:8001/api/webhook/orthanc", json.encode(payload), headers)
end
```

## Security Features

### HMAC Signature Validation

- Uses HMAC-SHA256 for cryptographic signature verification
- Constant-time comparison prevents timing attacks
- Rejects requests with invalid or missing signatures

### Replay Attack Prevention

- Validates timestamp to ensure requests are recent
- Configurable tolerance window (default: 5 minutes)
- Rejects requests with timestamps outside the tolerance window

### Rate Limiting

- Sliding window algorithm tracks requests per IP address
- Configurable limits and time windows
- Returns HTTP 429 when limits are exceeded

### Security Event Logging

All security events are logged with:

- Event type (validation success, signature failure, rate limit exceeded, etc.)
- Client IP address
- Timestamp and correlation ID
- Request details (endpoint, headers)

### Supported Security Events

- `WEBHOOK_VALIDATED`: Successful webhook validation
- `INVALID_SIGNATURE`: Invalid HMAC signature provided
- `REPLAY_ATTACK_ATTEMPT`: Request with old/invalid timestamp
- `RATE_LIMIT_EXCEEDED`: Client exceeded rate limits
- `MISSING_SECURITY_HEADERS`: Required security headers missing

## Testing

Run the security tests:

```bash
npm run test:security
```

The test suite includes:

- HMAC signature validation tests
- Replay attack prevention tests
- Rate limiting tests
- Security event logging tests
- High-load scenario tests
- Integration tests with real webhook payloads

## Production Deployment

### Environment Variables

```bash
WEBHOOK_SECRET=your-secure-webhook-secret-key
```

### Monitoring

Monitor security logs for:

- High rates of invalid signatures (potential attacks)
- Replay attack attempts
- Rate limiting violations
- Unusual IP address patterns

### Best Practices

1. Use a strong, randomly generated webhook secret
2. Rotate webhook secrets regularly (90-day rotation recommended)
3. Monitor security logs for suspicious activity
4. Set appropriate rate limits based on expected traffic
5. Use HTTPS for all webhook communications
6. Implement proper secret management (HashiCorp Vault, AWS Secrets Manager)

## Error Responses

| Status Code | Error | Description |
|-------------|-------|-------------|
| 401 | Invalid signature | HMAC signature validation failed |
| 401 | Invalid timestamp | Request timestamp outside tolerance window |
| 401 | Missing security headers | Required headers not provided |
| 429 | Rate limit exceeded | Client exceeded rate limits |

## Integration with Existing Systems

The webhook security middleware integrates seamlessly with Express.js applications and can be applied to any webhook endpoint. It's designed to work with:

- Orthanc PACS webhook notifications
- DICOM processing pipelines
- Medical imaging workflows
- Any system requiring secure webhook communications

## Compliance

This implementation supports healthcare compliance requirements by:

- Providing comprehensive audit trails
- Ensuring data integrity through cryptographic signatures
- Preventing unauthorized access and replay attacks
- Maintaining detailed security event logs