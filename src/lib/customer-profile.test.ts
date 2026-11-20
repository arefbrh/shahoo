import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCustomerProfile } from "./customer-profile.ts";

describe("customer profile rules", () => {
  it("normalizes required name fields and preserves optional validated values", () => {
    assert.deepEqual(parseCustomerProfile({
      firstName: "  نازنین   ",
      lastName: " رضایی  ",
      gender: "female",
      ageGroup: "25_34",
    }), {
      ok: true,
      value: { firstName: "نازنین", lastName: "رضایی", fullName: "نازنین رضایی", gender: "female", ageGroup: "25_34" },
    });
  });

  it("allows customers to leave optional demographics blank or decline to say", () => {
    assert.deepEqual(parseCustomerProfile({ firstName: "علی", lastName: "کریمی", gender: null, ageGroup: null }), {
      ok: true,
      value: { firstName: "علی", lastName: "کریمی", fullName: "علی کریمی", gender: null, ageGroup: null },
    });
    assert.deepEqual(parseCustomerProfile({ firstName: "علی", lastName: "کریمی", gender: "prefer_not_to_say", ageGroup: "prefer_not_to_say" }).ok, true);
  });

  it("rejects empty, unsafe, overlong names and unsupported demographic values", () => {
    for (const input of [
      { firstName: "", lastName: "کریمی", gender: null, ageGroup: null },
      { firstName: "علی", lastName: "کریمی", gender: "unknown", ageGroup: null },
      { firstName: "علی", lastName: "کریمی", gender: null, ageGroup: "17_18" },
      { firstName: "A".repeat(41), lastName: "کریمی", gender: null, ageGroup: null },
    ]) assert.equal(parseCustomerProfile(input).ok, false);
  });
});
