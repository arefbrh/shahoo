import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { readOilGuideQuestionnaire, recommendOilGuide } from "@/server/oil-encyclopedia/recommendations";

const idSchema = z.string().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/);
const slugSchema = z.string().min(1).max(80).regex(/^[a-z0-9-]+$/i);

const answersSchema = z.object({
  areaSlugs: z.array(slugSchema).max(3),
  categoryIds: z.array(idSchema).max(10),
  concernIds: z.array(idSchema).max(20),
  texture: z.string().max(80).default(""),
}).refine((answers) => answers.areaSlugs.length > 0 && answers.categoryIds.length > 0, {
  message: "Select at least one area and category.",
});

export const getOilGuideQuestionnaire = createServerFn({ method: "GET" })
  .handler(async () => readOilGuideQuestionnaire());

export const submitOilGuideAnswers = createServerFn({ method: "POST" })
  .validator((input: unknown) => answersSchema.parse(input))
  .handler(async ({ data }) => recommendOilGuide(data));
