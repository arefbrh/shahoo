import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const hasExt = /\.(ts|tsx|js|mjs|cjs|json)$/;

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    return nextResolve(pathToFileURL(join(root, "src", `${specifier.slice(2)}.ts`)).href, context);
  }
  if (specifier.startsWith(".") && !hasExt.test(specifier)) {
    const parent = context.parentURL ? fileURLToPath(context.parentURL) : root;
    const base = join(dirname(parent), specifier);
    if (existsSync(`${base}.ts`)) return nextResolve(pathToFileURL(`${base}.ts`).href, context);
    if (existsSync(join(base, "index.ts"))) return nextResolve(pathToFileURL(join(base, "index.ts")).href, context);
  }
  return nextResolve(specifier, context);
}
