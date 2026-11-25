function Read-ShahooRuntimeEnv([string]$Path) {
    $allowed = @(
        "DATABASE_URL",
        "APP_URL",
        "SHAHOO_TRUST_PROXY",
        "SHAHOO_ADMIN_EMAIL",
        "SHAHOO_ADMIN_PASSWORD_HASH",
        "SHAHOO_ADMIN_NAME",
        "SHAHOO_ADMIN_MOBILE",
        "SHAHOO_ADMIN_ROTATE",
        "SHAHOO_ADMIN_RECOVER",
        "STORAGE_PROVIDER",
        "ALLOW_LOCAL_STORAGE",
        "STORAGE_LOCAL_DIR",
        "STORAGE_S3_ENDPOINT",
        "STORAGE_S3_BUCKET",
        "STORAGE_S3_REGION",
        "STORAGE_S3_ACCESS_KEY_ID",
        "STORAGE_S3_SECRET_ACCESS_KEY",
        "STORAGE_S3_PREFIX",
        "S3_ENDPOINT",
        "S3_BUCKET",
        "S3_REGION",
        "S3_ACCESS_KEY",
        "S3_SECRET_KEY",
        "S3_PREFIX",
        "AWS_ENDPOINT_URL_S3",
        "AWS_REGION",
        "AWS_ACCESS_KEY_ID",
        "AWS_SECRET_ACCESS_KEY",
        "PAYMENT_PROVIDER",
        "PAYPING_API_KEY",
        "PAYPING_LIVE",
        "PAYPING_RETURN_URL",
        "SMS_PROVIDER",
        "SMS_MODE",
        "SMS_LIVE",
        "SMS_API_KEY",
        "SMS_SENDER",
        "SMS_IR_API_KEY",
        "SMS_IR_OTP_TEMPLATE_ID"
    )
    $values = @{}
    foreach ($raw in Get-Content -LiteralPath $Path) {
        if ($raw.Trim() -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$' -and $allowed -contains $matches[1]) {
            $values[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'")
        }
    }
    return $values
}
