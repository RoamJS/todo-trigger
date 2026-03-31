import assert from "node:assert/strict";
import test from "node:test";
import {
  captureInitialTodoState,
  getTodoState,
  markHandledTodoState,
  shouldHandleManualDoneOnFocusout,
} from "../src/utils/todoStateTracking.ts";

test("getTodoState classifies todo prefixes", () => {
  assert.equal(getTodoState("{{[[TODO]]}} task"), "todo");
  assert.equal(getTodoState("{{[[DONE]]}} task"), "done");
  assert.equal(getTodoState("plain task"), "other");
});

test("handled keyboard toggles update tracked state", () => {
  const trackedStates = new Map();
  captureInitialTodoState(trackedStates, "abc", "plain task");

  markHandledTodoState(trackedStates, "abc", "{{[[DONE]]}} task");

  assert.equal(trackedStates.get("abc"), "done");
  assert.equal(
    shouldHandleManualDoneOnFocusout(
      trackedStates.get("abc"),
      "{{[[DONE]]}} task",
    ),
    false,
  );
});

test("focusout still fires for untouched other to done edits", () => {
  const trackedStates = new Map();
  captureInitialTodoState(trackedStates, "abc", "plain task");

  assert.equal(
    shouldHandleManualDoneOnFocusout(
      trackedStates.get("abc"),
      "{{[[DONE]]}} task",
    ),
    true,
  );
});
