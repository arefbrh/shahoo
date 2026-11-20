import { useState, type FormEvent } from "react";
import { loginAdminFn } from "@/server/auth/api";
import { buttonPrimary, fieldClass, panelClass } from "./ui";

export function AdminLogin() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (identifier.trim().length < 3 || password.length < 10) {
      setError("ایمیل یا موبایل و رمز را کامل وارد کنید.");
      return;
    }
    setPending(true);
    try {
      const result = await loginAdminFn({ data: { identifier, password } });
      if (!result.ok) {
        setError(result.message);
        setPending(false);
        return;
      }
      window.location.assign("/admin");
    } catch {
      setError("ارتباط با سرور برقرار نشد.");
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <img src="/assets/brand/shahoo-logo-primary.png" alt="شاهو | SHAHOO" className="h-16 w-auto" />
      <p className="mt-6 text-xs font-bold text-gold">مدیریت شاهو</p>
      <h1 className="mt-2 text-3xl font-bold text-forest">ورود مدیر</h1>
      <p className="mt-3 text-sm leading-8">
        حساب مدیر از داخل این صفحه ساخته نمی‌شود. تلاش‌های پشت‌سرهم موقتاً محدود می‌شوند.
      </p>
      <form onSubmit={submit} className={`${panelClass} mt-6 space-y-4 p-5`}>
        <label className="block text-sm font-bold text-forest">
          ایمیل یا موبایل
          <input
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            autoComplete="username"
            dir="ltr"
            className={`${fieldClass} mt-2 text-left`}
          />
        </label>
        <label className="block text-sm font-bold text-forest">
          رمز
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="current-password"
            dir="ltr"
            className={`${fieldClass} mt-2 text-left`}
          />
        </label>
        {error ? (
          <p className="text-sm font-bold text-forest" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className={buttonPrimary} disabled={pending}>
          {pending ? "در حال بررسی" : "ورود"}
        </button>
      </form>
    </div>
  );
}
