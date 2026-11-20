import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  loadAdminOrders,
  loadCustomer,
  loadCustomers,
  loadDashboard,
  loadInventoryDesk,
  loadReports,
  loadStaff,
  setAdminAccess,
  revokeAdminSessions,
  setCustomerStatus,
} from "./desk";

const orderQuery = z.object({
  q: z.string().max(40).default(""),
  status: z.string().max(40).default(""),
  paymentStatus: z.string().max(40).default(""),
  from: z.string().max(10).default(""),
  to: z.string().max(10).default(""),
  page: z.number().int().min(1).max(500).default(1),
});

const searchQuery = z.object({
  q: z.string().max(40).default(""),
  page: z.number().int().min(1).max(500).default(1),
  status: z.string().max(20).default(""),
  from: z.string().max(10).default(""),
  to: z.string().max(10).default(""),
});

export const getDashboardFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ range: z.string().max(10).default("30") }).parse(input ?? {}))
  .handler(async ({ data }) => loadDashboard(data.range));

export const listAdminOrdersFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => orderQuery.parse(input ?? {}))
  .handler(async ({ data }) => loadAdminOrders(data));

export const listCustomersFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => searchQuery.parse(input ?? {}))
  .handler(async ({ data }) => loadCustomers(data));

export const getCustomerFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ id: z.string().min(8).max(80) }).parse(input))
  .handler(async ({ data }) => loadCustomer(data.id));

export const setCustomerStatusFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ id: z.string().min(8).max(80), status: z.enum(["active", "blocked"]), reason: z.string().trim().min(2).max(400) }).parse(input))
  .handler(async ({ data }) => setCustomerStatus(data.id, data.status, data.reason));

export const getInventoryDeskFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ q: z.string().max(60).default(""), categoryId: z.string().max(80).default(""), stock: z.enum(["", "low", "out"]).default(""), page: z.number().int().min(1).max(500).default(1), logPage: z.number().int().min(1).max(500).default(1) }).parse(input ?? {}))
  .handler(async ({ data }) => loadInventoryDesk(data));

export const getReportsFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ range: z.enum(["today", "7", "30", "all"]).default("30") }).parse(input ?? {}))
  .handler(async ({ data }) => loadReports(data.range));

export const getStaffFn = createServerFn({ method: "GET" }).handler(async () => loadStaff());

export const setAdminAccessFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().min(4).max(80),
        status: z.enum(["active", "disabled"]),
        roles: z.array(z.string().min(2).max(40)).min(1).max(8),
      })
      .parse(input),
  )
  .handler(async ({ data }) => setAdminAccess(data));

export const revokeAdminSessionsFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ id: z.string().min(4).max(80) }).parse(input))
  .handler(async ({ data }) => revokeAdminSessions(data.id));
