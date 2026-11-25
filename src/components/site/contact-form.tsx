import type { StoreProfile } from "@/lib/store-types";
import { ContactLines } from "./contact-lines";

export function ContactForm({ profile }: { profile: StoreProfile }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold text-forest">تماس با شاهو</h1>
      <p className="mt-3 text-sm leading-8">
        برای سفارش، موجودی و ارسال از راه‌هایی استفاده کنید که فروشگاه خودش اعلام کرده است. برای پیگیری خرید مهمان، کد سفارش و شرح درخواست را به پشتیبانی اعلام کنید. مشاوره پزشکی ارائه نمی‌شود.
      </p>
      <div className="mt-6 rounded-3xl border border-line bg-paper p-6 text-sm font-bold text-forest">
        <ContactLines profile={profile} />
      </div>
    </div>
  );
}
