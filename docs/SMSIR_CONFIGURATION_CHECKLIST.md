# SMS.ir configuration checklist

Status: not configured; no real SMS.ir account, credential, sandbox, or handset delivery was used.

## Account and template

- [ ] Create/confirm the SMS.ir account and API access.
- [ ] Generate an API key and store it only as `SMS_IR_API_KEY` in the Windows VPS secret/environment store.
- [ ] Create and obtain approval for the OTP Verify template.
- [ ] Record the numeric template ID in `SMS_IR_OTP_TEMPLATE_ID`.
- [ ] Confirm the template parameter name is exactly `Code`, or update the adapter only after account documentation confirms a different name.
- [ ] Confirm the provider accepts the normalized mobile format used by the adapter: `9123456789` without the leading zero.

## Operating mode

- [ ] Keep `SMS_MODE=disabled` until controlled testing begins.
- [ ] For local automated tests only, use `SMS_MODE=sandbox`, `SMS_PROVIDER=mock`, and `ALLOW_MOCK_SMS=1`. This is a local mock, not an SMS.ir sandbox.
- [ ] Do not use live credentials in sandbox mode; sandbox never falls through to live.
- [ ] For live testing, set `NODE_ENV=production`, `SMS_MODE=live`, `SMS_LIVE=1`, `SMS_PROVIDER=smsir`, the API key, and template ID together.
- [ ] Confirm invalid or contradictory environment values fail closed before enabling traffic.

## Delivery and OTP checks

- [ ] Send a controlled test OTP to an authorized test number.
- [ ] Verify API acceptance, notification audit status, OTP expiry, one-time redemption, maximum attempts, mobile cooldown, and IP bucket behavior.
- [ ] Simulate timeout/network failure and confirm the notification is recorded as `unknown`; do not blindly resend.
- [ ] Confirm OTP values never appear in logs, notification bodies, audit metadata, or client responses outside the explicit development-only echo path.
- [ ] Confirm the provider response is treated as API acceptance, not proof of handset delivery.
