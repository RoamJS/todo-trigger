export type ArchiveEdit = {
  before: string;
  after: string;
  prepend?: boolean;
};

export const isArchivedText = (value: string): boolean =>
  value.includes("{{[[ARCHIVED]]}}");

export const pickArchiveEdit = (value: string): ArchiveEdit => {
  if (isArchivedText(value)) {
    return { before: "{{[[ARCHIVED]]}}", after: "", prepend: true };
  }
  const firstButtonTag = /{{\[\[([A-Z]{4,8})\]\]}}/.exec(value)?.[1];
  if (firstButtonTag === "TODO" || firstButtonTag === "DONE") {
    return { before: `{{[[${firstButtonTag}]]}}`, after: "{{[[ARCHIVED]]}}" };
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
    : value.replace(
        !after && prepend && value.indexOf(`${before} `) === value.indexOf(before)
          ? `${before} `
          : before,
        after,
      );
