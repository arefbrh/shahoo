import { hasUnsafeText } from "./text-safety.ts";

export const CUSTOMER_GENDERS = ["female", "male", "prefer_not_to_say"] as const;
export const CUSTOMER_AGE_GROUPS = ["under_18", "18_24", "25_34", "35_44", "45_54", "55_plus", "prefer_not_to_say"] as const;

export type CustomerGender = (typeof CUSTOMER_GENDERS)[number];
export type CustomerAgeGroup = (typeof CUSTOMER_AGE_GROUPS)[number];
export type CustomerProfileInput = { firstName: string; lastName: string; gender: string | null; ageGroup: string | null };
export type CustomerProfileValue = { firstName: string; lastName: string; fullName: string; gender: CustomerGender | null; ageGroup: CustomerAgeGroup | null };

export function parseCustomerProfile(input: CustomerProfileInput): { ok: true; value: CustomerProfileValue } | { ok: false; message: string } {
  const firstName = input.firstName.trim().replace(/\s+/g, " ");
  const lastName = input.lastName.trim().replace(/\s+/g, " ");
  const fullName = `${firstName} ${lastName}`.trim();
  if (firstName.length < 1 || firstName.length > 40 || hasUnsafeText(firstName) || lastName.length < 1 || lastName.length > 40 || hasUnsafeText(lastName) || fullName.length > 80) {
    return { ok: false, message: "نام و نام خانوادگی را به‌درستی وارد کنید." };
  }
  const gender = input.gender || null;
  const ageGroup = input.ageGroup || null;
  if ((gender !== null && !(CUSTOMER_GENDERS as readonly string[]).includes(gender)) || (ageGroup !== null && !(CUSTOMER_AGE_GROUPS as readonly string[]).includes(ageGroup))) {
    return { ok: false, message: "مقدار اطلاعات اختیاری معتبر نیست." };
  }
  return { ok: true, value: { firstName, lastName, fullName, gender: gender as CustomerGender | null, ageGroup: ageGroup as CustomerAgeGroup | null } };
}
