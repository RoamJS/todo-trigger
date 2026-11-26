const buttonTag = /{{\[\[([A-Z]{4,8})\]\]}}/;
const archivedTag = "{{[[ARCHIVED]]}}";

const archivedIndex = (value: string): number => {
  const first = buttonTag.exec(value);
  if (!first) return -1;
  if (first[1] === "ARCHIVED") return first.index;
  if (first[1] === "TODO" || first[1] === "DONE") {
    const rest = value.slice(first.index + first[0].length);
    const adjacent = /^(\s*){{\[\[ARCHIVED\]\]}}/.exec(rest);
    if (adjacent) return first.index + first[0].length + adjacent[1].length;
  }
  return -1;
};

export const isArchivedText = (value: string): boolean =>
  archivedIndex(value) !== -1;

export const toggleArchived = (value: string): string => {
  const index = archivedIndex(value);
  if (index !== -1) {
    const end = index + archivedTag.length;
    return value.slice(0, index) + value.slice(end + (value[end] === " " ? 1 : 0));
  }
  const first = buttonTag.exec(value);
  if (first && (first[1] === "TODO" || first[1] === "DONE")) {
    return value.slice(0, first.index) + archivedTag + value.slice(first.index + first[0].length);
  }
  return `${archivedTag} ${value}`;
};
