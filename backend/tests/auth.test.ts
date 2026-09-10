import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hashPassword,
  verifyPassword,
  validatePassword,
  normalizeEmail,
} from "../lib/auth";

describe("Auth Module", () => {
  it("normalizes emails to lowercase and trimmed string", () => {
    assert.equal(normalizeEmail("  USER@Example.COM "), "user@example.com");
    assert.equal(normalizeEmail("test@test.org"), "test@test.org");
  });

  it("validates password length correctly", () => {
    assert.equal(validatePassword("short").valid, false);
    assert.equal(validatePassword("short").reason, "Password must be at least 8 characters long");
    assert.equal(validatePassword("validPass123!").valid, true);
  });

  it("hashes and verifies passwords securely", () => {
    const raw = "SuperSecretPassword123!";
    const hashed = hashPassword(raw);

    assert.notEqual(raw, hashed);
    assert.equal(verifyPassword(raw, hashed), true);
    assert.equal(verifyPassword("WrongPassword", hashed), false);
  });
});
