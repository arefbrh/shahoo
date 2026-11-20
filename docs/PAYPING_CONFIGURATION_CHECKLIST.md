# PayPing configuration checklist

Status: not configured; no real credentials or sandbox payment were used.

## Merchant and API setup

- [ ] Create/confirm the PayPing merchant account and token permissions.
- [ ] Generate a dedicated API token with only the payment permissions required by `/v3/pay` and `/v3/pay/verify`.
- [ ] Store the token only in the Windows VPS secret/environment store as `PAYPING_API_KEY`; never commit it or expose it to the browser.
- [ ] Confirm the merchant account allows the intended callback/return URL.
- [ ] Set `PAYPING_RETURN_URL` to the HTTPS application callback URL ending in `/api/payment/payping/callback`.
- [ ] Set `PAYMENT_PROVIDER=payping` and `PAYPING_LIVE=1` only during an approved controlled activation. The application also requires production mode and a valid HTTPS return URL.

## Amount and sandbox verification

- [ ] Confirm with PayPing/merchant account that SHAHOO’s integer IRR amount must be divided by 10 and sent as integer Toman.
- [ ] Use a disposable sandbox/test order whose total is divisible by 10 IRR.
- [ ] Verify request amount, `clientRefId`, returned `paymentCode`, redirect host, callback fields, and `/v3/pay/verify` response.
- [ ] Test provider rejection, timeout/unknown creation outcome, duplicate callback, and documented HTTP 409 `metaData.code=110` behavior.
- [ ] Verify the dashboard can identify an unknown creation outcome by order/client reference. If it cannot, keep the attempt in manual review and do not create a replacement payment.

## Live activation gate

- [ ] Sandbox evidence reviewed by the owner.
- [ ] Real callback URL reachable over trusted HTTPS from PayPing.
- [ ] Merchant amount convention confirmed.
- [ ] PostgreSQL migration `0013`–`0015` applied through the guarded migration procedure.
- [ ] Rollback/recovery contact and dashboard procedure documented.
- [ ] Enable live configuration only after all above checks; no code change should be needed to add the token.
