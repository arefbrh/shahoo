import { contactRows } from "@/lib/public-profile";
import type { StoreProfile } from "@/lib/store-types";

export function ContactLines({ profile, className }: { profile: StoreProfile; className?: string }) {
  const rows = contactRows(profile);
  if (rows.length === 0) {
    return <p className={className ?? "text-sm leading-7"}>راه‌های تماس هنوز توسط فروشگاه اعلام نشده است.</p>;
  }
  return (
    <ul className={className ?? "space-y-2 text-sm leading-7"}>
      {rows.map((row) => (
        <li key={row.key}>
          {row.href ? (
            <a href={row.href} className="hover:text-gold-soft">
              {row.label}: {row.text}
            </a>
          ) : (
            <span>
              {row.label}: {row.text}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
