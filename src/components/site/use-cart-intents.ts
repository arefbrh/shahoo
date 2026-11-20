import { useEffect, useState } from "react";
import { getCartIntents, type CartIntentState } from "./cart-client";

export function useCartIntents(): CartIntentState | null {
  const [state, setState] = useState<CartIntentState | null>(null);
  useEffect(() => {
    const refresh = () => setState(getCartIntents());
    refresh();
    window.addEventListener("shahoo-cart-retry", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      window.removeEventListener("shahoo-cart-retry", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, []);
  return state;
}
