import assert from "node:assert/strict";
import test from "node:test";
import { applyArchiveEdit, pickArchiveEdit } from "../src/utils/archiveText.ts";

test("archive edits toggle the first button tag consistently", () => {
  const cases = [
    ["{{[[TODO]]}} task", "{{[[ARCHIVED]]}} task"],
    ["{{[[DONE]]}} task", "{{[[ARCHIVED]]}} task"],
    ["{{[[ARCHIVED]]}} task", "task"],
    ["before {{[[ARCHIVED]]}} task", "before task"],
    ["plain task", "{{[[ARCHIVED]]}} plain task"],
    ["", "{{[[ARCHIVED]]}} "],
    ["{{[[OTHER]]}} {{[[TODO]]}} task", "{{[[ARCHIVED]]}} {{[[OTHER]]}} {{[[TODO]]}} task"],
  ];
  for (const [input, expected] of cases) {
    assert.equal(applyArchiveEdit(input, pickArchiveEdit(input)), expected);
  }
});
