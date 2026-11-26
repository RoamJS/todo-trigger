export type ArchiveEdit = {
  before: string;
  after: string;
  prepend?: boolean;
};

export const pickArchiveEdit = (value: string): ArchiveEdit => {
  const firstButtonTag = /{{\[\[([A-Z]{4,8})\]\]}}/.exec(value)?.[1];
  if (firstButtonTag === "TODO" || firstButtonTag === "DONE") {
    return { before: `{{[[${firstButtonTag}]]}}`, after: "{{[[ARCHIVED]]}}" };
  }
  if (firstButtonTag === "ARCHIVED") {
    return { before: "{{[[ARCHIVED]]}}", after: "", prepend: true };
  }
  return { before: "", after: "{{[[ARCHIVED]]}}", prepend: true };
};

export const applyArchiveEdit = (
  value: string,
  { before, after, prepend }: ArchiveEdit,
): string =>
  !before
    ? prepend
      ? `${after} ${value}`
      : `${value}${after}`
    : value.replace(`${before}${!after && prepend ? " " : ""}`, after);
