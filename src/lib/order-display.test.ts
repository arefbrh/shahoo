import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { staffOnlyOrderNote } from "./order-display.ts";

describe("customer-safe order details", () => {
  it("hides staff shipment/event notes while preserving them for staff", () => {
    const note = "اطلاعات داخلی ارسال";
    assert.equal(staffOnlyOrderNote(note, false), "");
    assert.equal(staffOnlyOrderNote(null, false), "");
    assert.equal(staffOnlyOrderNote(note, true), note);
  });
});
