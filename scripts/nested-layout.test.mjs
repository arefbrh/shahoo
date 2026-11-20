import assert from "node:assert/strict";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import test from "node:test";
import ts from "typescript";

function loadLayout(entry, outfile) {
  const source = readFileSync(entry, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: entry,
  });
  writeFileSync(outfile, transpiled.outputText);
  return import(`${outfile}?t=${Date.now()}`);
}

async function renderChild(Layout) {
  const rootRoute = createRootRoute({
    component: () => createElement(Layout),
  });
  const childRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "detail",
    component: () => createElement("p", null, "CHILD-RENDERED"),
  });
  const routeTree = rootRoute.addChildren([childRoute]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/detail"] }),
  });
  await router.load();
  return renderToString(createElement(RouterProvider, { router }));
}

test("admin, customer, and magazine layouts render the child route", async () => {
  const outfile = new URL("./_layout-bundle.mjs", import.meta.url).pathname;
  try {
    for (const entry of ["src/routes/admin.orders.tsx", "src/routes/admin.customers.tsx", "src/routes/magazine.tsx"]) {
      const loaded = await loadLayout(entry, outfile);
      const Layout = loaded.OrdersLayout ?? loaded.CustomersLayout ?? loaded.MagazineLayout;
      assert.equal(typeof Layout, "function", `${entry} did not export a layout`);
      const html = await renderChild(Layout);
      assert.match(html, /CHILD-RENDERED/, `${entry} did not render its child`);
    }
  } finally {
    rmSync(outfile, { force: true });
  }
});

test("generated route tree nests detail pages and removes customer support", () => {
  const tree = readFileSync(new URL("../src/routeTree.gen.ts", import.meta.url), "utf8");
  assert.equal(tree.includes("account.support"), false);
  assert.equal(tree.includes("/account/support"), false);
  assert.match(tree, /AdminOrdersCodeRouteImport[\s\S]*parentRoute: typeof AdminOrdersRoute/);
  assert.match(tree, /AdminCustomersCustomerIdRouteImport[\s\S]*parentRoute: typeof AdminCustomersRoute/);
  assert.match(tree, /MagazineArticleIdRouteImport[\s\S]*parentRoute: typeof MagazineRoute/);
  assert.match(tree, /from '\.\/routes\/admin\.orders\.index'/);
  assert.match(tree, /from '\.\/routes\/magazine\.index'/);
});
