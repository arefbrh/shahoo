import { useState, type FormEvent } from "react";
import { useGuardedAction } from "./use-guarded-action";
import type { PublicReview } from "@/server/catalog/reviews";
import { submitReviewFn } from "@/server/catalog/review-api";
import { toPersianNum } from "@/lib/format";
import { buttonPrimary, fieldClass, panelClass } from "./ui";

export function ReviewsPanel({ productId, reviews }: { productId: string; reviews: PublicReview[] }) {
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const { pending, message, run } = useGuardedAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    await run(() => submitReviewFn({ data: { productId, rating, body } }), {
      failure: "نظر ثبت نشد. دوباره تلاش کنید.",
      onOk: () => setBody(""),
    });
  }

  return (
    <section className="mx-auto max-w-6xl px-4 pb-12">
      <h2 className="text-xl font-bold text-forest">نظر خریداران</h2>
      <p className="mt-2 text-sm leading-7 text-muted">فقط نظر تأییدشده نمایش داده می‌شود. امتیاز ساختگی ساخته نمی‌شود.</p>
      {reviews.length === 0 ? <p className="mt-4 text-sm">هنوز نظر تأییدشده‌ای نیست.</p> : null}
      <ul className="mt-4 space-y-3">
        {reviews.map((review) => (
          <li key={review.id} className={`${panelClass} p-4 text-sm`}>
            <p className="font-bold text-forest">
              {review.authorName} · {toPersianNum(review.rating)} از ۵
              {review.verifiedPurchase ? " · خرید تأییدشده" : ""}
            </p>
            <p className="mt-2 leading-7">{review.body}</p>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className={`${panelClass} mt-4 space-y-3 p-4`}>
        <label className="block text-sm font-bold text-forest">
          امتیاز
          <select className={`${fieldClass} mt-2`} value={rating} onChange={(event) => setRating(Number(event.target.value))}>
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>
                {toPersianNum(value)}
              </option>
            ))}
          </select>
        </label>
        <textarea className={fieldClass} value={body} onChange={(event) => setBody(event.target.value)} rows={4} aria-label="تجربه خرید" placeholder="تجربه خرید" />
        {message ? (
          <p className="text-sm font-bold text-forest" role={message.error ? "alert" : "status"}>
            {message.text}
          </p>
        ) : null}
        <button className={buttonPrimary} type="submit" disabled={pending}>
          ثبت نظر برای بررسی
        </button>
      </form>
    </section>
  );
}
