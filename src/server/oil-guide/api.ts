import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  readOilGuideArea,
  readOilGuideCategory,
  readOilGuideConcern,
  readOilGuideLanding,
  readOilGuideProfile,
  searchOilGuideRecords,
} from "@/server/oil-encyclopedia/guide";

const slugSchema = z.string().min(1).max(80).regex(/^[a-z0-9-]+$/i);

export const getOilGuideLanding = createServerFn({ method: "GET" }).handler(async () => readOilGuideLanding());

export const getOilGuideArea = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ areaSlug: slugSchema }).parse(input))
  .handler(async ({ data }) => readOilGuideArea(data.areaSlug));

export const getOilGuideCategory = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ areaSlug: slugSchema, categorySlug: slugSchema }).parse(input))
  .handler(async ({ data }) => readOilGuideCategory(data.areaSlug, data.categorySlug));

export const getOilGuideConcern = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({
    areaSlug: slugSchema,
    categorySlug: slugSchema,
    concernSlug: slugSchema,
  }).parse(input))
  .handler(async ({ data }) => readOilGuideConcern(data.areaSlug, data.categorySlug, data.concernSlug));

export const getOilGuideOilProfile = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ oilSlug: z.string().min(1).max(80) }).parse(input))
  .handler(async ({ data }) => readOilGuideProfile(data.oilSlug));

export const searchOilGuide = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ query: z.string().max(80) }).parse(input))
  .handler(async ({ data }) => searchOilGuideRecords(data.query));
