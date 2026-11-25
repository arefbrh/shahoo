export interface CarrierTrackingInfo {
  url: string | null;
  buttonLabel: string;
  carrierLabel: string;
}

/**
 * Return the carrier's public tracking portal. The current official pages
 * expose an input form; no query-string prefill parameter has been verified,
 * so the order UI keeps the tracking code visible for the customer to paste.
 */
export function resolveCarrierTracking(carrier: string, trackingCode: string): CarrierTrackingInfo {
  const norm = (carrier || "").toLowerCase();
  const hasTrackingCode = Boolean(trackingCode.trim());
  if (!hasTrackingCode) {
    return { url: null, buttonLabel: "", carrierLabel: carrier.trim() || "حمل‌ونقل" };
  }

  if (norm.includes("تیپاکس") || norm.includes("tipax")) {
    return {
      url: "https://tipaxco.com/tracking",
      buttonLabel: "رهگیری در سامانه تیپاکس ↗",
      carrierLabel: "تیپاکس",
    };
  }
  if (norm.includes("چاپار") || norm.includes("chapar")) {
    return {
      url: "https://www.chaparnet.com/track",
      buttonLabel: "رهگیری در سامانه چاپار ↗",
      carrierLabel: "کالارسان چاپار",
    };
  }
  if (norm.includes("پست") || norm.includes("پیشتاز") || norm.includes("سفارشی") || !carrier.trim()) {
    return {
      url: "https://tracking.post.ir/",
      buttonLabel: "رهگیری در سامانه شرکت ملی پست ↗",
      carrierLabel: carrier.trim() || "پست پیشتاز",
    };
  }
  return {
    url: null,
    buttonLabel: "",
    carrierLabel: carrier.trim(),
  };
}
