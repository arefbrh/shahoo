import { createServerFn } from "@tanstack/react-start";
import { requestOrigin } from "./origin";

export const getSeoOrigin = createServerFn({ method: "GET" }).handler(async () => requestOrigin());
