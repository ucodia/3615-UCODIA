import { test } from "node:test";
import assert from "node:assert/strict";
import { eventName } from "../slice/utils.js";

test("strips the leading date from a product title", () => {
  assert.equal(eventName("OCTOBER 1 - OPENING NIGHT with @marielelizabella"), "OPENING NIGHT with @marielelizabella");
  assert.equal(eventName('July 22 - "Weird Dreams!" by @miokinon'), '"Weird Dreams!" by @miokinon');
});

test("tolerates a dash without surrounding spaces", () => {
  assert.equal(eventName("October 14- 土生妹 Local Born Girl by @adamsisha"), "土生妹 Local Born Girl by @adamsisha");
});

test("strips date ranges", () => {
  assert.equal(eventName("SEPTEMBER 25 - OCTOBER  5 - 19+ COLLECTIVE"), "19+ COLLECTIVE");
  assert.equal(eventName("OCTOBER 9-19 - ORANGE COLLECTIVE"), "ORANGE COLLECTIVE");
  assert.equal(eventName("NOVEMBER 20 - 30 - FANTASY COLLECTIVE"), "FANTASY COLLECTIVE");
});

test("falls back to the whole title when there is no date prefix", () => {
  assert.equal(eventName("Mystery show"), "Mystery show");
});
