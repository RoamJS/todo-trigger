import assert from "node:assert/strict";
import test from "node:test";
import { isArchivedText, toggleArchived } from "../src/utils/archiveText.ts";

test("archive edits toggle the first button tag consistently", () => {
  const cases = [
    ["{{[[TODO]]}} task", "{{[[ARCHIVED]]}} task"],
    ["{{[[TODO]]}} a {{[[ARCHIVED]]}}", "{{[[ARCHIVED]]}} a {{[[ARCHIVED]]}}"],
    ["{{[[DONE]]}} task", "{{[[ARCHIVED]]}} task"],
    ["{{[[ARCHIVED]]}} task", "task"],
    ["{{[[ARCHIVED]]}}", ""],
    ["task {{[[ARCHIVED]]}}", "task "],
    ["before {{[[ARCHIVED]]}} task", "before task"],
    ["plain task", "{{[[ARCHIVED]]}} plain task"],
    ["", "{{[[ARCHIVED]]}} "],
    ["{{[[OTHER]]}} {{[[TODO]]}} task", "{{[[ARCHIVED]]}} {{[[OTHER]]}} {{[[TODO]]}} task"],
  ];
  for (const [input, expected] of cases) {
    assert.equal(toggleArchived(input), expected);
  }
  assert.equal(isArchivedText("{{[[TODO]]}} a {{[[ARCHIVED]]}}"), false);
  assert.equal(isArchivedText("before {{[[ARCHIVED]]}} task"), true);
  assert.equal(isArchivedText("{{[[OTHER]]}} {{[[ARCHIVED]]}}"), false);
});
