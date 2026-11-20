import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { moderateReviewForAdmin, productReviews, reviewQueueForAdmin, submitReviewForSession } from "./reviews";

export const getProductReviewsFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ productId: z.string().min(2).max(80) }).parse(input))
  .handler(async ({ data }) => productReviews(data.productId));

export const submitReviewFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ productId: z.string().min(2).max(80), rating: z.number().int().min(1).max(5), body: z.string().max(800) }).parse(input),
  )
  .handler(async ({ data }) => submitReviewForSession(data.productId, data.rating, data.body));

export const reviewQueueFn = createServerFn({ method: "GET" }).handler(async () => reviewQueueForAdmin());

export const moderateReviewFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ id: z.string().min(4).max(80), action: z.enum(["approve", "reject", "delete"]) }).parse(input),
  )
  .handler(async ({ data }) => moderateReviewForAdmin(data.id, data.action));
