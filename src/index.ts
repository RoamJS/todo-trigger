import runExtension from "roamjs-components/util/runExtension";
import format from "date-fns/format";
import isControl from "roamjs-components/util/isControl";
import createHTMLObserver from "roamjs-components/dom/createHTMLObserver";
import createTagRegex from "roamjs-components/util/createTagRegex";
import { DAILY_NOTE_PAGE_REGEX } from "roamjs-components/date/constants";
import getBlockUidFromTarget from "roamjs-components/dom/getBlockUidFromTarget";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import getUids from "roamjs-components/dom/getUids";
import updateBlock from "roamjs-components/writes/updateBlock";
import getPageTitleByBlockUid from "roamjs-components/queries/getPageTitleByBlockUid";
import explode from "./utils/exploder";
import addDeferTODOsCommand from "./utils/deferTodos";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import extractRef from "roamjs-components/util/extractRef";
import extractTag from "roamjs-components/util/extractTag";
import getChildrenLengthByParentUid from "roamjs-components/queries/getChildrenLengthByParentUid";
import initializeTodont, { TODONT_MODES } from "./utils/todont";
import normalizeTodoArchivedPrefix from "./utils/normalizeTodoArchivedPrefix";

export default runExtension(async ({ extensionAPI }) => {
  const { toggle: toggleTodont, cleanup: cleanupTodont } =
    initializeTodont(extensionAPI);
  const getTodontMode = (): (typeof TODONT_MODES)[number] => {
    const configuredMode = extensionAPI.settings.get("todont-mode");
    return TODONT_MODES.includes(
      configuredMode as (typeof TODONT_MODES)[number],
    )
      ? (configuredMode as (typeof TODONT_MODES)[number])
      : "icon";
  };
  extensionAPI.settings.panel.create({
    tabTitle: "TODO Trigger",
    settings: [
      {
        id: "append-text",
        name: "Append Text",
        description:
          "The text to add to the end of a block, when an item flips from TODO to DONE",
        action: { type: "input", placeholder: "Finished at {now}" },
      },
      {
        id: "on-todo",
        name: "On Todo",
        description:
          "The text to add to the end of a block, when a block first becomes a TODO",
        action: { type: "input", placeholder: "#toRead" },
      },
      {
        id: "replace-tags",
        name: "Replace Tags",
        description:
          "The set of pairs that you would want to be replaced upon switching between todo and done",
        action: { type: "input", placeholder: "#toRead, #Read" },
      },
      {
        id: "todont-mode",
        name: "TODONT Mode",
        description:
          "Whether to incorporate styling when TODOS turn into ARCHIVED buttons.",
        action: {
          type: "select",
          items: TODONT_MODES.slice(0),
          onChange: (e) =>
            toggleTodont(e.target.value as (typeof TODONT_MODES)[number]),
        },
      },
      {
        id: "ignore-tags",
        name: "Ignore Tags",
        description:
          "Comma- or pipe-separated list of tags that should skip TODO/DONE triggers",
        action: { type: "input", placeholder: "#no-trigger, #skip" },
      },
      {
        id: "strikethrough",
        name: "Strikethrough",
        description: "Enable to strikethrough blocks with `{{[[DONE]]}}`",
        action: { type: "switch" },
      },
      {
        id: "classname",
        name: "Classname",
        description:
          "Enable to add a `roamjs-done` classname to blocks with `{{[[DONE]]}}`",
        action: { type: "switch" },
      },
      {
        id: "trim",
        name: "Trim Whitespace",
        description:
          "Trim the whitespace at the front and end when blocks become TODO or DONE",
        action: { type: "switch" },
      },
      {
        id: "explode",
        name: "Explode",
        description: "Enable to play a fun animation when the TODO is finished",
        action: { type: "switch" },
      },
      {
        id: "send-to-block",
        name: "Send To Block",
        description:
          "Specify a block reference or page name to send completed TODOs",
        action: {
          type: "input",
          placeholder: "Block reference or page name",
        },
      },
    ],
  });
  const settingsCaretStyle = document.createElement("style");
  settingsCaretStyle.textContent = `
.rm-settings .bp3-button .bp3-icon-caret-up {
  transform: rotate(180deg);
}
`;
  document.head.appendChild(settingsCaretStyle);

  if (
    !TODONT_MODES.includes(
      extensionAPI.settings.get("todont-mode") as (typeof TODONT_MODES)[number],
    )
  ) {
    await extensionAPI.settings.set("todont-mode", "icon");
  }

  const CLASSNAMES_TO_CHECK = [
    "rm-block-ref",
    "kanban-title",
    "kanban-card",
    "roam-block",
  ];

  const shouldIgnoreBlock = (value: string) => {
    const ignoreTags = extensionAPI.settings.get("ignore-tags") as string;
    if (!ignoreTags) {
      return false;
    }
    return ignoreTags
      .split(/[,|]/)
      .map((tag) =>
        tag.trim().replace(/^#/, "").replace(/^\[\[/, "").replace(/\]\]$/, ""),
      )
      .filter((tag) => !!tag)
      .some((tag) => createTagRegex(tag).test(value));
  };

  const onTodo = (blockUid: string, oldValue: string) => {
    if (shouldIgnoreBlock(oldValue)) {
      return;
    }
    const text = extensionAPI.settings.get("append-text") as string;
    let value = oldValue;
    // Roam's Cmd/Ctrl+Enter prepends TODO for non-checkbox blocks.
    // If the block starts with ARCHIVED, collapse TODO+ARCHIVED into TODO.
    value = normalizeTodoArchivedPrefix(value);
    if (text) {
      const formattedText = ` ${text
        .replace(new RegExp("\\^", "g"), "\\^")
        .replace(new RegExp("\\[", "g"), "\\[")
        .replace(new RegExp("\\]", "g"), "\\]")
        .replace(new RegExp("\\(", "g"), "\\(")
        .replace(new RegExp("\\)", "g"), "\\)")
        .replace(new RegExp("\\|", "g"), "\\|")
        .replace(new RegExp("\\*", "g"), "\\|")
        .replace("/Current Time", "[0-2][0-9]:[0-5][0-9]")
        .replace("/Today", `\\[\\[${DAILY_NOTE_PAGE_REGEX.source}\\]\\]`)
        .replace(
          /{now(?::([^}]+))?}/,
          `\\[\\[${DAILY_NOTE_PAGE_REGEX.source}\\]\\]`,
        )}`;
      value = value.replace(new RegExp(formattedText), "");
    }
    const replaceTags = extensionAPI.settings.get("replace-tags") as string;
    if (replaceTags) {
      const pairs = replaceTags.split("|") as string[];
      const formattedPairs = pairs.map((p) =>
        p
          .split(",")
          .map((pp) =>
            pp
              .trim()
              .replace(/^#/, "")
              .replace(/^\[\[/, "")
              .replace(/\]\]$/, ""),
          )
          .reverse(),
      );
      if (formattedPairs.filter((p) => p.length === 1).length < 2) {
        formattedPairs.forEach(([before, after]) => {
          if (after) {
            value = value
              .replace(
                `#${before}`,
                `#${/\s/.test(after) ? `[[${after}]]` : after}`,
              )
              .replace(new RegExp(`\\[\\[${before}\\]\\]`), `[[${after}]]`);
          } else {
            value = `${value}#[[${before}]]`;
          }
        });
      }
    }

    const onTodo = extensionAPI.settings.get("on-todo") as string;
    if (onTodo) {
      const today = new Date();
      const formattedText = ` ${onTodo
        .replace("/Current Time", format(today, "HH:mm"))
        .replace(
          "/Today",
          `[[${window.roamAlphaAPI.util.dateToPageTitle(today)}]]`,
        )
        .replace(/{now(?::([^}]+))?}/, (_: string, group: string) => {
          const date = window.roamAlphaAPI.util.dateToPageTitle(today);
          if (
            /skip dnp/i.test(group) &&
            date === getPageTitleByBlockUid(blockUid)
          ) {
            return "";
          } else {
            return `[[${date}]]`;
          }
        })}`;
      value = value.includes(formattedText)
        ? value
        : `${value}${formattedText}`;
    }
    const trim = extensionAPI.settings.get("trim") as boolean;
    if (trim) {
      // replace whitespace after {{[[TODO]]}}
      value = value.replace(/(\{\{\[\[TODO\]\]\}})\s+/g, "$1");
      value = value.trim();
    }

    if (value !== oldValue) {
      updateBlock({ uid: blockUid, text: value });
    }
  };

  const onDone = (blockUid: string, oldValue: string) => {
    if (shouldIgnoreBlock(oldValue)) {
      return { explode: false };
    }
    const text = extensionAPI.settings.get("append-text") as string;
    let value = oldValue;
    if (text) {
      const today = new Date();
      const formattedText = ` ${text
        .replace("/Current Time", format(today, "HH:mm"))
        .replace(
          "/Today",
          `[[${window.roamAlphaAPI.util.dateToPageTitle(today)}]]`,
        )
        .replace(/{now(?::([^}]+))?}/, (_: string, group: string) => {
          const date = window.roamAlphaAPI.util.dateToPageTitle(today);
          if (
            /skip dnp/i.test(group) &&
            date === getPageTitleByBlockUid(blockUid)
          ) {
            return "";
          } else {
            return `[[${date}]]`;
          }
        })}`;
      value = `${value}${formattedText}`;
    }
    const replaceTags = extensionAPI.settings.get("replace-tags") as string;
    if (replaceTags) {
      const pairs = replaceTags.split("|") as string[];
      const formattedPairs = pairs.map((p) =>
        p
          .split(",")
          .map((pp) =>
            pp
              .trim()
              .replace(/^#/, "")
              .replace(/^\[\[/, "")
              .replace(/\]\]$/, ""),
          )
          .map((pp) =>
            pp === "{date}"
              ? DAILY_NOTE_PAGE_REGEX.source
              : pp === "{today}"
                ? window.roamAlphaAPI.util.dateToPageTitle(new Date())
                : pp,
          ),
      );
      formattedPairs.forEach(([before, after]) => {
        if (after) {
          value = value
            .replace(
              `#${before}`,
              `#${/\s/.test(after) ? `[[${after}]]` : after}`,
            )
            .replace(new RegExp(`\\[\\[${before}\\]\\]`), `[[${after}]]`);
        } else {
          value = value.replace(createTagRegex(before), "");
        }
      });
    }
    const trim = extensionAPI.settings.get("trim") as boolean;
    if (trim) {
      // replace whitespace after {{[[DONE]]}}
      value = value.replace(/(\{\{\[\[DONE\]\]\}})\s+/g, "$1");
      value = value.trim();
    }
    if (value !== oldValue) {
      updateBlock({ uid: blockUid, text: value });
    }
    const sendToBlock = extensionAPI.settings.get("send-to-block") as string;
    if (sendToBlock) {
      const uid = extractRef(
        getPageUidByPageTitle(extractTag(sendToBlock)) || sendToBlock,
      );
      if (uid) {
        const bottom = getChildrenLengthByParentUid(uid);
        window.roamAlphaAPI.moveBlock({
          location: { "parent-uid": uid, order: bottom },
          block: { uid: blockUid },
        });
      }
    }
    return { explode: !!extensionAPI.settings.get("explode") };
  };

  type TodoState = "todo" | "done" | "other";
  const getTodoState = (value: string): TodoState => {
    if (value.startsWith("{{[[DONE]]}}")) {
      return "done";
    }
    if (value.startsWith("{{[[TODO]]}}")) {
      return "todo";
    }
    return "other";
  };
  const initialEditStateByBlock = new Map<string, TodoState>();
  const focusinListener = (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName !== "TEXTAREA") {
      return;
    }
    const textArea = target as HTMLTextAreaElement;
    const { blockUid } = getUids(textArea);
    const value = getTextByBlockUid(blockUid) || textArea.value;
    initialEditStateByBlock.set(blockUid, getTodoState(value));
  };
  const focusoutListener = (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName !== "TEXTAREA") {
      return;
    }
    const textArea = target as HTMLTextAreaElement;
    const { blockUid } = getUids(textArea);
    const initialState = initialEditStateByBlock.get(blockUid) || "other";
    initialEditStateByBlock.delete(blockUid);
    const value = getTextByBlockUid(blockUid) || textArea.value || "";
    if (initialState === "other" && getTodoState(value) === "done") {
      onDone(blockUid, value);
    }
  };

  createHTMLObserver({
    tag: "LABEL",
    className: "check-container",
    callback: (_l) => {
      const l = _l as HTMLLabelElement;
      const inputTarget = l.querySelector("input");
      if (inputTarget?.type === "checkbox") {
        const blockUid = getBlockUidFromTarget(inputTarget);
        inputTarget.addEventListener("click", () => {
          const position = inputTarget.getBoundingClientRect();
          setTimeout(() => {
            const oldValue = getTextByBlockUid(blockUid);
            if (inputTarget.checked) {
              onTodo(blockUid, oldValue);
            } else {
              const config = onDone(blockUid, oldValue);
              if (config.explode) {
                setTimeout(() => {
                  explode(position.x, position.y);
                }, 50);
              }
            }
          }, 50);
        });
      }
    },
  });

  const clickListener = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const menuItem = target.closest(".bp3-menu-item");
    if (!menuItem) {
      return;
    }
    const menuLabel = menuItem
      .querySelector(".bp3-text-overflow-ellipsis")
      ?.textContent?.trim();
    if (menuLabel !== "TODO") {
      return;
    }
    const textarea = target
      .closest(".roam-block-container")
      ?.getElementsByTagName?.("textarea")?.[0];
    if (textarea) {
      const { blockUid } = getUids(textarea);
      onTodo(blockUid, textarea.value);
    }
  };
  document.addEventListener("click", clickListener);

  const keydownEventListener = async (_e: Event) => {
    const e = _e as KeyboardEvent;
    const ROAM_STATE_SETTLE_MS = 50;
    if (e.key === "Enter") {
      if (isControl(e)) {
        // Cmd/Ctrl+Shift+Enter is reserved for the Archive TODO command.
        if (e.shiftKey) {
          return;
        }
        const target = e.target as HTMLElement;
        if (target.tagName === "TEXTAREA") {
          const textArea = target as HTMLTextAreaElement;
          const { blockUid } = getUids(textArea);
          // Read from Roam's data layer — the textarea DOM value may lag
          // behind after a recent API update (e.g. toggling to ARCHIVED).
          const blockText =
            getTextByBlockUid(blockUid) || textArea.value;
          if (blockText.startsWith("{{[[ARCHIVED]]}}")) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            const withoutArchived = blockText.replace(
              /^\{\{\[\[ARCHIVED\]\]\}}\s*/,
              "",
            );
            const normalized = withoutArchived
              ? `{{[[TODO]]}} ${withoutArchived}`
              : "{{[[TODO]]}}";
            if (normalized !== blockText) {
              updateBlock({ uid: blockUid, text: normalized });
            }
          } else {
            setTimeout(() => {
              const value = getTextByBlockUid(blockUid);
              if (value.startsWith("{{[[DONE]]}}")) {
                onDone(blockUid, value);
              } else if (value.startsWith("{{[[TODO]]}}")) {
                onTodo(blockUid, value);
              }
            }, ROAM_STATE_SETTLE_MS);
          }
          return;
        }
        const blockUids = Array.from(
          document.getElementsByClassName("block-highlight-blue"),
        )
          .map(
            (d) => d.getElementsByClassName("roam-block")[0] as HTMLDivElement,
          )
          .map((d) => getUids(d).blockUid);
        setTimeout(() => {
          blockUids.forEach((blockUid) => {
            const value = getTextByBlockUid(blockUid);
            if (value.startsWith("{{[[DONE]]}}")) {
              onDone(blockUid, value);
            } else if (value.startsWith("{{[[TODO]]}}")) {
              onTodo(blockUid, value);
            }
          });
        }, ROAM_STATE_SETTLE_MS);
      } else {
        const target = e.target as HTMLElement;
        if (target.tagName === "TEXTAREA") {
          const todoItem = Array.from(
            target.parentElement?.querySelectorAll<HTMLDivElement>(
              ".bp3-text-overflow-ellipsis",
            ) || [],
          ).find((t) => t.innerText === "TODO");
          if (
            todoItem &&
            todoItem.parentElement &&
            getComputedStyle(todoItem.parentElement).backgroundColor ===
              "rgb(213, 218, 223)"
          ) {
            const textArea = target as HTMLTextAreaElement;
            const { blockUid } = getUids(textArea);
            onTodo(blockUid, textArea.value);
          }
        }
      }
    }
  };

  document.addEventListener("keydown", keydownEventListener);
  document.addEventListener("focusin", focusinListener, true);
  document.addEventListener("focusout", focusoutListener, true);

  const isStrikethrough = !!extensionAPI.settings.get("strikethrough");
  const isClassname = !!extensionAPI.settings.get("classname");
  const styleBlock = (block: HTMLElement) => {
    if (isStrikethrough) {
      block.style.textDecoration = "line-through";
    }
    if (isClassname) {
      block.classList.add("roamjs-done");
    }
  };
  const unstyleBlock = (block: HTMLElement) => {
    block.style.textDecoration = "none";
    block.classList.remove("roamjs-done");
  };

  if (isStrikethrough || isClassname) {
    createHTMLObserver({
      callback: (l) => {
        const input = l.getElementsByTagName("input")[0];
        if (input.checked && !input.disabled) {
          const zoom = l.closest(".rm-zoom-item-content") as HTMLSpanElement;
          if (zoom) {
            const blockUid = getBlockUidFromTarget(input);
            const zoomElement = zoom.firstElementChild
              ?.firstElementChild as HTMLDivElement;
            if (blockUid && shouldIgnoreBlock(getTextByBlockUid(blockUid))) {
              unstyleBlock(zoomElement);
            } else {
              styleBlock(zoomElement);
            }
            return;
          }
          const block = CLASSNAMES_TO_CHECK.map(
            (c) => l.closest(`.${c}`) as HTMLElement,
          ).find((d) => !!d);
          if (block) {
            const blockUid = getBlockUidFromTarget(input);
            if (blockUid && shouldIgnoreBlock(getTextByBlockUid(blockUid))) {
              unstyleBlock(block);
              return;
            }
          }
          if (block) {
            styleBlock(block);
          }
        } else {
          const zoom = l.closest(".rm-zoom-item-content") as HTMLSpanElement;
          if (zoom) {
            unstyleBlock(
              zoom.firstElementChild?.firstElementChild as HTMLDivElement,
            );
            return;
          }
          const block = CLASSNAMES_TO_CHECK.map(
            (c) => l.closest(`.${c}`) as HTMLElement,
          ).find((d) => !!d);
          if (block) {
            const blockUid = getBlockUidFromTarget(input);
            if (blockUid && shouldIgnoreBlock(getTextByBlockUid(blockUid))) {
              unstyleBlock(block);
              return;
            }
          }
          if (block) {
            unstyleBlock(block);
          }
        }
      },
      tag: "LABEL",
      className: "check-container",
    });
  }

  addDeferTODOsCommand();
  toggleTodont(getTodontMode());

  return {
    domListeners: [
      { type: "keydown", el: document, listener: keydownEventListener },
      { type: "click", el: document, listener: clickListener },
    ],
    commands: ["Defer TODO"],
    unload: () => {
      cleanupTodont();
      settingsCaretStyle.remove();
      document.removeEventListener("focusin", focusinListener, true);
      document.removeEventListener("focusout", focusoutListener, true);
      initialEditStateByBlock.clear();
    },
  };
});
