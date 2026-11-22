import type { ReactNode } from "react";

export function AdminHelp({ title, children, example }: { title: string; children: ReactNode; example?: string }) {
  return (
    <aside className="mt-3 rounded-2xl border border-line bg-cream px-4 py-3 text-sm leading-7 text-muted" aria-label={`راهنمای ${title}`}>
      <p className="font-bold text-forest">راهنمای این بخش · {title}</p>
      <div className="mt-1">{children}</div>
      {example ? <p className="mt-1"><span className="font-bold text-forest">مثال:</span> {example}</p> : null}
    </aside>
  );
}
