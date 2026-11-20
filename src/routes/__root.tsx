import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { Shell } from "@/components/site/shell";
import { getShell } from "@/server/storefront/api";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  loader: () => getShell(),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "شاهو | محصولات طبیعی" },
      { name: "description", content: "فروشگاه محصولات طبیعی شاهو؛ روغن پرس سرد، کره مغزیجات و گیاهان دست‌چین." },
      { name: "theme-color", content: "#173D28" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "icon", href: "/favicon.ico" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const shell = Route.useLoaderData();
  return (
    <>
      <PreviewHostBridge />
      <AuthProvider>
        <Shell shell={shell}>
          <Outlet />
        </Shell>
      </AuthProvider>
    </>
  );
}
