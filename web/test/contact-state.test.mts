// The contact form's checks match the service's (#784), so a message the page
// lets through is one the service takes.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EMPTY, MAX_TEXT, validate } from "../components/contact/state.ts";

const ok = { ...EMPTY, email: "a@b.dev", message: "hi" };

describe("validate", () => {
  it("passes a complete support message and ignores the workflow", () => {
    assert.deepEqual(validate(ok), {});
  });

  it("names every missing field", () => {
    assert.deepEqual(validate({ ...EMPTY, reason: "customize", message: "  " }), {
      email: "required",
      message: "required",
      workflow: "required",
    });
  });

  it("checks the email's shape and length", () => {
    assert.equal(validate({ ...ok, email: "a@b" }).email, "invalid");
    assert.equal(validate({ ...ok, email: `${"a".repeat(195)}@b.dev` }).email, "tooLong");
  });

  it("refuses text past the limit, counted after trimming", () => {
    assert.equal(validate({ ...ok, message: ` ${"x".repeat(MAX_TEXT)} ` }).message, undefined);
    assert.equal(validate({ ...ok, message: "x".repeat(MAX_TEXT + 1) }).message, "tooLong");
    assert.equal(
      validate({ ...ok, reason: "customize", workflow: "x".repeat(MAX_TEXT + 1) }).workflow,
      "tooLong",
    );
  });
});
