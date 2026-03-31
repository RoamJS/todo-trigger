export type TodoState = "todo" | "done" | "other";

export const getTodoState = (value: string): TodoState => {
  if (value.startsWith("{{[[DONE]]}}")) {
    return "done";
  }
  if (value.startsWith("{{[[TODO]]}}")) {
    return "todo";
  }
  return "other";
};

export const captureInitialTodoState = (
  trackedStates: Map<string, TodoState>,
  blockUid: string,
  value: string,
): void => {
  trackedStates.set(blockUid, getTodoState(value));
};

export const markHandledTodoState = (
  trackedStates: Map<string, TodoState>,
  blockUid: string,
  value: string,
): void => {
  trackedStates.set(blockUid, getTodoState(value));
};

export const shouldHandleManualDoneOnFocusout = (
  initialState: TodoState | undefined,
  value: string,
): boolean => (initialState || "other") === "other" && getTodoState(value) === "done";
