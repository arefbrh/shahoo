import { useRef, useState } from "react";

export type ActionMessage = { text: string; error: boolean };

/**
 * One async action at a time. While it runs `pending` is true and a second call is
 * ignored (duplicate-click guard). A thrown error becomes the fixed Persian `failure`
 * text; no technical message reaches the screen. Success is announced only when the
 * server answered `ok: true`.
 */
export function useGuardedAction() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<ActionMessage | null>(null);
  const running = useRef(false);

  async function run<T extends { ok: boolean; message?: string }>(
    action: () => Promise<T>,
    options: { failure: string; success?: string; onOk?: (result: T) => void },
  ): Promise<boolean> {
    if (running.current) return false;
    running.current = true;
    setPending(true);
    setMessage(null);
    try {
      const result = await action();
      if (!result.ok) {
        setMessage({ text: result.message || options.failure, error: true });
        return false;
      }
      const text = options.success ?? result.message;
      if (text) setMessage({ text, error: false });
      options.onOk?.(result);
      return true;
    } catch {
      setMessage({ text: options.failure, error: true });
      return false;
    } finally {
      running.current = false;
      setPending(false);
    }
  }

  return { pending, message, run, clear: () => setMessage(null) };
}
