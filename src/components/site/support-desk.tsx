import { onlineReturnsEnabled } from "@/lib/order-flow";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { adminReplyFn, adminThreadFn, adminTicketsFn, myThreadFn, myTicketsFn, openTicketFn, replyTicketFn } from "@/server/support/api";
import { recordRefundFn, returnQueueFn, reviewReturnFn } from "@/server/commerce/fulfillment-api";
import { finishReturnAction, replaceReturnQueue, type ReturnDeskRow } from "@/lib/return-desk";
import { buttonGhost, buttonPrimary, fieldClass, pageTitle, panelClass } from "./ui";
import { AdminHelp } from "./admin-help";

type ThreadMessage = { id: string; authorType: string; body: string; createdAt: string };
type Thread = { id: string; publicCode: string; subject: string; status: string; category: string; messages: ThreadMessage[] };

const TICKET_STATUS: Record<string, string> = { open: "باز", reviewing: "در حال بررسی", closed: "بسته" };
const RETURN_STATUS: Record<string, string> = {
  requested: "ثبت‌شده",
  reviewing: "در بررسی",
  approved: "تأییدشده",
  rejected: "ردشده",
  received: "کالا رسیده",
};
const ORDER_STATUS: Record<string, string> = {
  delivered: "تحویل‌شده",
  returned: "مرجوع‌شده",
  refunded: "مستردشده",
  partially_refunded: "استرداد جزئی",
  paid: "پرداخت‌شده",
};

type ReturnRow = ReturnDeskRow;
const AUTHOR_LABEL: Record<string, string> = { customer: "مشتری", admin: "پشتیبانی", system: "سامانه" };

function statusLabel(status: string) {
  return TICKET_STATUS[status] ?? status;
}

function when(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function MessageList({ messages }: { messages: ThreadMessage[] }) {
  if (messages.length === 0) return <p className="text-sm text-muted">پیامی ثبت نشده است.</p>;
  return (
    <ol className="mt-3 space-y-2">
      {messages.map((message) => (
        <li key={message.id} className="rounded-2xl border border-line bg-cream p-3 text-sm">
          <p className="font-bold text-forest">
            {AUTHOR_LABEL[message.authorType] ?? "پیام"} <span className="font-normal text-muted">{when(message.createdAt)}</span>
          </p>
          <p className="mt-1 leading-7">{message.body}</p>
        </li>
      ))}
    </ol>
  );
}

export function CustomerSupport() {
  const [tickets, setTickets] = useState<Array<{ id: string; publicCode: string; subject: string; status: string; category: string }>>([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ category: "order", subject: "", body: "" });
  const [active, setActive] = useState("");
  const [thread, setThread] = useState<Thread | null | undefined>(undefined);
  const [reply, setReply] = useState("");

  async function load() {
    const result = await myTicketsFn();
    if (result.ok) setTickets(result.tickets);
    else setMessage(result.message);
  }
  useEffect(() => {
    void load();
  }, []);

  async function openThread(id: string) {
    setActive(id);
    setThread(undefined);
    const result = await myThreadFn({ data: { id } });
    setThread(result);
    if (!result) setMessage("گفتگو خوانده نشد.");
  }

  async function open(event: FormEvent) {
    event.preventDefault();
    const result = await openTicketFn({ data: form });
    setMessage(result.ok ? `درخواست ${result.publicCode} ثبت شد.` : result.message);
    if (result.ok) {
      setForm({ category: "order", subject: "", body: "" });
      await load();
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className={pageTitle}>پشتیبانی</h1>
      <form onSubmit={open} className={`${panelClass} mt-4 space-y-3 p-4`}>
        <select className={fieldClass} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
          <option value="order">سفارش</option>
          <option value="shipping">ارسال</option>
          <option value="product">محصول</option>
          <option value="payment">پرداخت</option>
          <option value="other">سایر</option>
        </select>
        <input className={fieldClass} placeholder="موضوع" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} />
        <textarea className={fieldClass} rows={4} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} />
        <button className={buttonPrimary} type="submit">
          ثبت درخواست
        </button>
      </form>
      {message ? <p className="mt-3 text-sm font-bold text-forest">{message}</p> : null}
      {tickets.length === 0 ? <p className="mt-4 text-sm text-muted">درخواستی ثبت نشده است.</p> : null}
      <ul className="mt-4 space-y-2">
        {tickets.map((ticket) => (
          <li key={ticket.id} className={`${panelClass} p-4 text-sm`}>
            <button type="button" className="font-bold text-forest" onClick={() => void openThread(ticket.id)}>
              {ticket.publicCode} · {ticket.subject} · {statusLabel(ticket.status)}
            </button>
            {active === ticket.id ? (
              thread === undefined ? (
                <p className="mt-3 text-muted">در حال خواندن گفتگو...</p>
              ) : thread ? (
                <div className="mt-3">
                  <p className="text-xs text-muted">
                    {thread.category} · {statusLabel(thread.status)}
                  </p>
                  <MessageList messages={thread.messages} />
                  {thread.status !== "closed" ? (
                    <form
                      className="mt-3 space-y-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void replyTicketFn({ data: { id: ticket.id, body: reply } }).then(async (result) => {
                          setMessage(result.ok ? "پاسخ ثبت شد." : result.message);
                          if (result.ok) {
                            setReply("");
                            await openThread(ticket.id);
                            await load();
                          }
                        });
                      }}
                    >
                      <textarea className={fieldClass} value={reply} onChange={(event) => setReply(event.target.value)} aria-label="پاسخ شما" />
                      <button className={buttonGhost} type="submit">
                        ارسال پاسخ
                      </button>
                    </form>
                  ) : (
                    <p className="mt-3 text-muted">این درخواست بسته شده است.</p>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-muted">گفتگو در دسترس نیست.</p>
              )
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdminSupport() {
  const [tickets, setTickets] = useState<Array<{ id: string; publicCode: string; subject: string; status: string; category: string }>>([]);
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [message, setMessage] = useState("");
  const [active, setActive] = useState("");
  const [thread, setThread] = useState<Thread | null | undefined>(undefined);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState("");
  const [returnReasons, setReturnReasons] = useState<Record<string, string>>({});
  const lock = useRef(false);

  function mapReturn(row: {
    id: string;
    status: string;
    reason: string;
    amountIrr: number | bigint;
    note: string;
    orderCode: string;
    orderStatus: string;
    updatedAt: Date | string;
    history?: { status: string; note: string; actor: string; createdAt: Date | string }[];
  }): ReturnRow {
    return {
      id: row.id,
      status: row.status,
      reason: row.reason,
      amountIrr: Number(row.amountIrr),
      note: row.note,
      orderCode: row.orderCode,
      orderStatus: row.orderStatus,
      updatedAt: new Date(row.updatedAt).toISOString(),
      history: (row.history ?? []).map((event) => ({
        status: event.status,
        note: event.note,
        actor: event.actor,
        at: new Date(event.createdAt).toISOString(),
      })),
    };
  }

  async function loadTickets() {
    const result = await adminTicketsFn();
    if (result.ok) setTickets(result.tickets);
    else setMessage(result.message);
  }

  async function openThread(id: string) {
    setActive(id);
    setThread(undefined);
    const result = await adminThreadFn({ data: { id } });
    if (result.ok && result.thread) setThread(result.thread);
    else {
      setThread(null);
      setMessage(result.message);
    }
  }

  async function review(id: string, status: "approved" | "rejected" | "received", success: string) {
    const reason = (returnReasons[id] ?? "").trim();
    if (reason.length < 2) { setMessage("برای تغییر وضعیت مرجوعی، دلیل را وارد کنید."); return; }
    if (!window.confirm(`${success} دلیل: ${reason}`)) return;
    if (lock.current) return;
    lock.current = true;
    setBusy(id);
    const snapshot = returns;
    try {
      const result = await reviewReturnFn({ data: { id, status, note: reason } });
      if (!result.ok) {
        const settled = finishReturnAction(snapshot, { ok: false, message: result.message });
        setReturns(settled.rows);
        setMessage(settled.error ?? "بررسی مرجوعی انجام نشد.");
        return;
      }
      const merged = finishReturnAction(snapshot, { ok: true, row: mapReturn(result.row) });
      setReturns(merged.rows);
      const fresh = await returnQueueFn();
      const reloaded = replaceReturnQueue(merged.rows, fresh.ok ? { ok: true, rows: fresh.rows.map(mapReturn) } : { ok: false, message: fresh.message });
      setReturns(reloaded.rows);
      setMessage(reloaded.error ? `${success} بازخوانی فهرست کامل ناموفق بود: ${reloaded.error}` : success);
    } finally {
      lock.current = false;
      setBusy("");
    }
  }

  useEffect(() => {
    void loadTickets();
    void returnQueueFn().then((result) => {
      if (result.ok) setReturns(result.rows.map(mapReturn));
      else setMessage(result.message);
    });
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold text-forest">پشتیبانی و مرجوعی</h1><AdminHelp title="پشتیبانی و مرجوعی">درخواست‌های مشتری را باز کنید، گفتگو را بخوانید و پاسخ را همراه با وضعیت مناسب ثبت کنید. بخش مرجوعی پایین صفحه صف جداگانه‌ای دارد؛ تأیید درخواست به‌تنهایی به معنی ثبت دریافت کالا یا استرداد وجه نیست. هر اقدام را فقط پس از بررسی سفارش و ثبت دلیل انجام دهید.</AdminHelp>
      {message ? <p className="mt-3 text-sm font-bold text-forest">{message}</p> : null}
      {tickets.length === 0 ? <p className="mt-4 text-sm text-muted">درخواستی نیست.</p> : null}
      <ul className="mt-4 space-y-3">
        {tickets.map((ticket) => (
          <li key={ticket.id} className={`${panelClass} space-y-2 p-4 text-sm`}>
            <button type="button" className="font-bold text-forest" onClick={() => void openThread(ticket.id)}>
              {ticket.publicCode} · {ticket.category} · {statusLabel(ticket.status)}
            </button>
            <p>{ticket.subject}</p>
            {active === ticket.id ? (
              thread === undefined ? (
                <p className="text-muted">در حال خواندن گفتگو...</p>
              ) : thread ? (
                <>
                  <MessageList messages={thread.messages} />
                  <form
                    className="space-y-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const status = (event.currentTarget.elements.namedItem("status") as HTMLSelectElement).value;
                      void adminReplyFn({ data: { id: ticket.id, body, status: status as "open" | "reviewing" | "closed" } }).then(async (result) => {
                        setMessage(result.ok ? "پاسخ ذخیره شد." : result.message);
                        if (result.ok) {
                          setBody("");
                          await openThread(ticket.id);
                          await loadTickets();
                        }
                      });
                    }}
                  >
                    <textarea name="body" className={fieldClass} value={body} onChange={(event) => setBody(event.target.value)} aria-label="پاسخ پشتیبانی" />
                    <select name="status" className={fieldClass} defaultValue={thread.status === "closed" ? "closed" : "reviewing"}>
                      <option value="open">باز</option>
                      <option value="reviewing">در حال بررسی</option>
                      <option value="closed">بسته</option>
                    </select>
                    <button className={buttonPrimary} type="submit">
                      پاسخ
                    </button>
                  </form>
                </>
              ) : (
                <p className="text-muted">گفتگو خوانده نشد.</p>
              )
            ) : null}
          </li>
        ))}
      </ul>
      {onlineReturnsEnabled && <>
      <h2 className="mt-8 text-xl font-bold text-forest">مرجوعی</h2>
      {returns.length === 0 ? <p className="mt-3 text-sm text-muted">درخواست مرجوعی نیست.</p> : null}
      <ul className="mt-3 space-y-3">
        {returns.map((item) => (
          <li key={item.id} className={`${panelClass} space-y-2 p-4 text-sm`}>
            <p className="font-bold text-forest">
              {item.orderCode} · {RETURN_STATUS[item.status] ?? item.status}
            </p>
            <p>{item.reason}</p>
            <p className="text-muted">
              سفارش {ORDER_STATUS[item.orderStatus] ?? item.orderStatus}
              {item.note ? ` · ${item.note}` : ""} · {when(item.updatedAt)}
            </p>
            {item.history.length > 0 ? (
              <ol className="space-y-1 text-xs leading-6 text-muted">
                {item.history.map((event, index) => (
                  <li key={`${item.id}-${index}`}>
                    {RETURN_STATUS[event.status] ?? event.status} · {AUTHOR_LABEL[event.actor] ?? event.actor} · {when(event.at)}
                    {event.note ? ` · ${event.note}` : ""}
                  </li>
                ))}
              </ol>
            ) : null}
            <label className="block text-xs font-bold text-forest">دلیل اقدام<input value={returnReasons[item.id] ?? ""} onChange={(event) => setReturnReasons((current) => ({ ...current, [item.id]: event.target.value }))} className={`${fieldClass} mt-2`} minLength={2} maxLength={400} required aria-label={`دلیل برای سفارش ${item.orderCode}`} /></label>
            <div className="flex flex-wrap gap-2">
              {item.status === "requested" || item.status === "reviewing" ? (
                <>
                  <button type="button" className={buttonGhost} disabled={busy !== ""} onClick={() => void review(item.id, "approved", "مرجوعی تأیید شد.")}>
                    تأیید
                  </button>
                  <button type="button" className={buttonGhost} disabled={busy !== ""} onClick={() => void review(item.id, "rejected", "مرجوعی رد شد.")}>
                    رد
                  </button>
                </>
              ) : null}
              {item.status === "approved" ? (
                <button type="button" className={buttonGhost} disabled={busy !== ""} onClick={() => void review(item.id, "received", "دریافت کالا ثبت شد.")}>
                  کالا رسید
                </button>
              ) : null}
              <button
                type="button"
                className={buttonGhost}
                disabled={busy !== ""}
                onClick={() => {
                  const reason = (returnReasons[item.id] ?? "").trim();
                  if (reason.length < 2) { setMessage("دلیل ثبت استرداد را وارد کنید."); return; }
                  if (!window.confirm(`مبلغ فقط در دفتر داخلی ثبت می‌شود؛ هیچ وجهی به درگاه برنمی‌گردد. دلیل: ${reason}. ادامه می‌دهید؟`)) return;
                  if (lock.current) return;
                  lock.current = true;
                  setBusy(item.id);
                  const snapshot = returns;
                  void recordRefundFn({ data: { id: item.id, kind: "full", requestedIrr: 0, reason } }).then(async (result) => {
                    try {
                      if (!result.ok) {
                        const settled = finishReturnAction(snapshot, { ok: false, message: result.message });
                        setReturns(settled.rows);
                        setMessage(settled.error ?? "ثبت مبلغ انجام نشد.");
                        return;
                      }
                      const merged = result.row
                        ? finishReturnAction(snapshot, { ok: true, row: mapReturn(result.row) }).rows
                        : snapshot;
                      const fresh = await returnQueueFn();
                      const reloaded = replaceReturnQueue(
                        merged,
                        fresh.ok ? { ok: true, rows: fresh.rows.map(mapReturn) } : { ok: false, message: fresh.message },
                      );
                      setReturns(reloaded.rows);
                      setMessage(reloaded.error ? `${result.message} بازخوانی فهرست کامل ناموفق بود: ${reloaded.error}` : result.message);
                    } finally {
                      lock.current = false;
                      setBusy("");
                    }
                  });
                }}
              >
                ثبت استرداد دفتری
              </button>
            </div>
          </li>
        ))}
      </ul>
      </>}
    </div>
  );
}

export function AdminReviews() {
  const [rows, setRows] = useState<Array<{ id: string; productName: string; authorName: string; rating: number; body: string; status: string; verifiedPurchase: boolean }>>([]);
  const [message, setMessage] = useState("");
  useEffect(() => {
    void import("@/server/catalog/review-api").then(({ reviewQueueFn }) =>
      reviewQueueFn().then((result) => {
        if (result.ok) setRows(result.rows);
        else setMessage(result.message);
      }),
    );
  }, []);
  return (
    <div>
      <h1 className="text-3xl font-bold text-forest">نظرها</h1><AdminHelp title="نظرهای مشتریان">نظرها را پیش از نمایش عمومی بررسی کنید. تأیید یعنی انتشار نظر برای کاربران؛ ردکردن یعنی عدم نمایش آن. در تصمیم‌گیری به محتوای نظر و ارتباط آن با محصول توجه کنید؛ این بخش برای پاسخ‌گویی به تیکت‌ها نیست.</AdminHelp>
      {message ? <p className="mt-3 text-sm">{message}</p> : null}
      <ul className="mt-4 space-y-3">
        {rows.map((row) => (
          <li key={row.id} className={`${panelClass} space-y-2 p-4 text-sm`}>
            <p className="font-bold text-forest">
              {row.productName} · {row.authorName} · {row.status}
              {row.verifiedPurchase ? " · خرید تأییدشده" : ""}
            </p>
            <p>{row.body}</p>
            <div className="flex gap-2">
              <button type="button" className={buttonGhost} onClick={() => void import("@/server/catalog/review-api").then(({ moderateReviewFn }) => moderateReviewFn({ data: { id: row.id, action: "approve" } }))}>
                تأیید
              </button>
              <button type="button" className={buttonGhost} onClick={() => void import("@/server/catalog/review-api").then(({ moderateReviewFn }) => moderateReviewFn({ data: { id: row.id, action: "reject" } }))}>
                رد
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
