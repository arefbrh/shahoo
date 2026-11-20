import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CUSTOMER_AGE_GROUPS, CUSTOMER_GENDERS } from "@/lib/customer-profile";
import { loginAdmin, loadAdminSession, logoutAdmin } from "./admin";
import { loadCustomerAccount, logoutCustomer, requestCustomerOtp, updateCustomerProfile, verifyCustomerOtp } from "./customer";

const mobileSchema = z.object({ mobile: z.string().min(10).max(20) });
const verifySchema = z.object({
  mobile: z.string().min(10).max(20),
  code: z.string().min(4).max(12),
});
const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(40),
  lastName: z.string().trim().min(1).max(40),
  gender: z.enum(CUSTOMER_GENDERS).nullable().default(null),
  ageGroup: z.enum(CUSTOMER_AGE_GROUPS).nullable().default(null),
});
const adminSchema = z.object({
  identifier: z.string().trim().min(3).max(120),
  password: z.string().min(10).max(200),
});

export const getCustomerAccount = createServerFn({ method: "GET" }).handler(async () => loadCustomerAccount());

export const requestCustomerOtpFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => mobileSchema.parse(input))
  .handler(async ({ data }) => requestCustomerOtp(data.mobile));

export const verifyCustomerOtpFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => verifySchema.parse(input))
  .handler(async ({ data }) => verifyCustomerOtp(data.mobile, data.code));

export const logoutCustomerFn = createServerFn({ method: "POST" }).handler(async () => logoutCustomer());

export const updateCustomerProfileFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => profileSchema.parse(input))
  .handler(async ({ data }) => updateCustomerProfile(data));

export const getAdminSession = createServerFn({ method: "GET" }).handler(async () => loadAdminSession());

export const loginAdminFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => adminSchema.parse(input))
  .handler(async ({ data }) => loginAdmin(data.identifier, data.password));

export const logoutAdminFn = createServerFn({ method: "POST" }).handler(async () => logoutAdmin());
