import { Link, type ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { buttonGhost, buttonPrimary, pageTitle } from "@/components/site/ui";

/**
 * Route error screen. The thrown error is never shown to the customer: its text can
 * carry database, path or internal details. It is logged to the console for the
 * developer only.
 */
export const ERROR_TITLE = "مشکلی پیش آمد";
export const ERROR_BODY = "این صفحه بارگذاری نشد. چند لحظه بعد دوباره تلاش کنید. اگر مشکل ادامه داشت با ما تماس بگیرید.";

export function AppErrorComponent({ error, reset }: ErrorComponentProps) {
  if (typeof console !== "undefined") console.error(error);
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-3 px-6 py-16 text-center" role="alert">
      <span className="text-gold" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className={pageTitle}>{ERROR_TITLE}</h1>
      <p className="text-sm leading-8 text-muted">{ERROR_BODY}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <button type="button" className={buttonPrimary} onClick={() => reset()}>
          تلاش دوباره
        </button>
        <Link to="/" className={buttonGhost}>
          صفحه اصلی
        </Link>
      </div>
    </div>
  );
}

export const NOT_FOUND_TITLE = "صفحه پیدا نشد";
export const NOT_FOUND_BODY = "نشانی را بررسی کنید یا از فهرست محصولات ادامه دهید. ممکن است این صفحه برداشته شده باشد.";

export function AppNotFoundComponent() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-3 px-6 py-16 text-center">
      <p className="font-display text-xs tracking-widest text-gold">۴۰۴</p>
      <h1 className={pageTitle}>{NOT_FOUND_TITLE}</h1>
      <p className="text-sm leading-8 text-muted">{NOT_FOUND_BODY}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Link to="/products" className={buttonPrimary}>
          محصولات
        </Link>
        <Link to="/" className={buttonGhost}>
          صفحه اصلی
        </Link>
      </div>
    </div>
  );
}
