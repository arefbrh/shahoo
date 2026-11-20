import { getRequest } from "@tanstack/react-start/server";
import { publicOrigin } from "../../lib/seo.ts";

export function requestOrigin(): string {
  const fromEnv = publicOrigin(process.env.APP_URL ?? "");
  if (fromEnv) return fromEnv;
  try {
    const request = getRequest();
    if (!request) return "";
    return publicOrigin(new URL(request.url).origin);
  } catch {
    return "";
  }
}
