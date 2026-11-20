const PERSIAN = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC = "٠١٢٣٤٥٦٧٨٩";

export function normalizeIranMobile(input: string): string | null {
  let digits = "";
  for (const char of input.trim()) {
    const persian = PERSIAN.indexOf(char);
    const arabic = ARABIC.indexOf(char);
    if (persian >= 0) digits += String(persian);
    else if (arabic >= 0) digits += String(arabic);
    else if (char >= "0" && char <= "9") digits += char;
    else if (char === "+" || char === " " || char === "-" || char === "\u200c" || char === "(" || char === ")") continue;
    else return null;
  }
  if (digits.startsWith("0098")) digits = digits.slice(4);
  else if (digits.startsWith("98") && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith("098") && digits.length === 13) digits = digits.slice(3);
  if (digits.length === 10 && digits.startsWith("9")) digits = `0${digits}`;
  if (!/^09\d{9}$/.test(digits)) return null;
  return digits;
}

export function normalizeOtpCode(input: string): string | null {
  let digits = "";
  for (const char of input.trim()) {
    const persian = PERSIAN.indexOf(char);
    const arabic = ARABIC.indexOf(char);
    if (persian >= 0) digits += String(persian);
    else if (arabic >= 0) digits += String(arabic);
    else if (char >= "0" && char <= "9") digits += char;
  }
  return /^\d{5}$/.test(digits) ? digits : null;
}

export function maskMobile(mobile: string): string {
  if (mobile.length < 8) return "موبایل";
  return `${mobile.slice(0, 4)}***${mobile.slice(-4)}`;
}

export function maskIdentifier(value: string): string {
  const mobile = normalizeIranMobile(value);
  if (mobile) return maskMobile(mobile);
  const at = value.indexOf("@");
  if (at > 0 && at < value.length - 1) {
    return `${value.slice(0, 1)}***@${value.slice(at + 1).slice(0, 40)}`;
  }
  return "نامشخص";
}
