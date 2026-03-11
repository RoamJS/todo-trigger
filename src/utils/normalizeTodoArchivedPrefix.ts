const TODO_ARCHIVED_PREFIX_REGEX =
  /^(\{\{\[\[TODO\]\]\}})\s*\{\{\[\[ARCHIVED\]\]\}}/;

const normalizeTodoArchivedPrefix = (value: string): string =>
  value.replace(TODO_ARCHIVED_PREFIX_REGEX, "$1");

export default normalizeTodoArchivedPrefix;
