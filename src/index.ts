// import toConfigPageName from "roamjs-components/util/toConfigPageName";
import runExtension from "roamjs-components/util/runExtension";
// import { createConfigObserver } from "roamjs-components/components/ConfigPage";
import format from "date-fns/format";
import isControl from "roamjs-components/util/isControl";
import createHTMLObserver from "roamjs-components/dom/createHTMLObserver";
import createTagRegex from "roamjs-components/util/createTagRegex";
import { DAILY_NOTE_PAGE_REGEX } from "roamjs-components/date/constants";
import getBlockUidFromTarget from "roamjs-components/dom/getBlockUidFromTarget";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getUids from "roamjs-components/dom/getUids";
import toRoamDate from "roamjs-components/date/toRoamDate";
import updateBlock from "roamjs-components/writes/updateBlock";
import { getPageTitleByBlockUid } from "roamjs-components";

const ATTR_REGEX = /^(.*?)::(.*?)$/;
const getConfigFromPage = (inputPage?: string) => {
  const page =
    inputPage ||
    document.getElementsByClassName("rm-title-display")[0]?.textContent;
  if (!page) {
    return {};
  }
  const uid = getPageUidByPageTitle(page);
  const allAttrs = window.roamAlphaAPI
    .q(
      `[:find (pull ?c [:block/string]) :where [?b :block/uid "${uid}"] [?c :block/parents ?b] [?c :block/refs]]`
    )
    .map((a) => a?.[0]?.string as string)
    .filter((a) => ATTR_REGEX.test(a))
    .map((r) =>
      (ATTR_REGEX.exec(r) || ["", "", ""])
        .slice(1, 3)
        .map((s: string) =>
          (s.trim().startsWith("{{or: ")
            ? s.substring("{{or: ".length, s.indexOf("|"))
            : s
          ).trim()
        )
    )
    .filter(([k]) => !!k);
  return Object.fromEntries(allAttrs);
};

const ID = "todo-trigger";
// const CONFIG = toConfigPageName(ID);
runExtension(ID, () => {
  // createConfigObserver({ title: CONFIG, config: { tabs: [] } }); Soon...

  const CLASSNAMES_TO_CHECK = [
    "rm-block-ref",
    "kanban-title",
    "kanban-card",
    "roam-block",
  ];

  const onTodo = (blockUid: string, oldValue: string) => {
    const config = getConfigFromPage("roam/js/todo-trigger");
    const text = config["Append Text"];
    let value = oldValue;
    if (text) {
      const formattedText = ` ${text
        .replace(new RegExp("\\^", "g"), "\\^")
        .replace(new RegExp("\\[", "g"), "\\[")
        .replace(new RegExp("\\]", "g"), "\\]")
        .replace(new RegExp("\\(", "g"), "\\(")
        .replace(new RegExp("\\)", "g"), "\\)")
        .replace(new RegExp("\\|", "g"), "\\|")
        .replace("/Current Time", "[0-2][0-9]:[0-5][0-9]")
        .replace("/Today", `\\[\\[${DAILY_NOTE_PAGE_REGEX.source}\\]\\]`)
        .replace(
          /{now(?::([^}]+))?}/,
          `\\[\\[${DAILY_NOTE_PAGE_REGEX.source}\\]\\]`
        )}`;
      value = value.replace(new RegExp(formattedText), "");
    }
    const replaceTags = config["Replace Tags"];
    if (replaceTags) {
      const pairs = replaceTags.split("|") as string[];
      const formattedPairs = pairs.map((p) =>
        p
          .split(",")
          .map((pp) =>
            pp.trim().replace("#", "").replace("[[", "").replace("]]", "")
          )
          .reverse()
      );
      if (formattedPairs.filter((p) => p.length === 1).length < 2) {
        formattedPairs.forEach(([before, after]) => {
          if (after) {
            value = value.replace(before, after);
          } else {
            value = `${value}#[[${before}]]`;
          }
        });
      }
    }

    const onTodo = config["On Todo"];
    if (onTodo) {
      const today = new Date();
      const formattedText = ` ${onTodo
        .replace("/Current Time", format(today, "HH:mm"))
        .replace("/Today", `[[${toRoamDate(today)}]]`)
        .replace(
          /{now(?::([^}]+))?}/,
          (orig: string, _: string, group: string) => {
            const date = toRoamDate(today);
            if (
              /skip dnp/i.test(group) &&
              date === getPageTitleByBlockUid(blockUid)
            ) {
              return orig;
            } else {
              return `[[${date}]]`;
            }
          }
        )}`;
      value = value.includes(formattedText)
        ? value
        : `${value}${formattedText}`;
    }

    if (value !== oldValue) {
      updateBlock({ uid: blockUid, text: value });
    }
  };

  const onDone = (blockUid: string, oldValue: string) => {
    const config = getConfigFromPage("roam/js/todo-trigger");
    const text = config["Append Text"];
    let value = oldValue;
    if (text) {
      const today = new Date();
      const formattedText = ` ${text
        .replace("/Current Time", format(today, "HH:mm"))
        .replace("/Today", `[[${toRoamDate(today)}]]`)
        .replace(
          /{now(?::([^}]+))?}/,
          (orig: string, _: string, group: string) => {
            const date = toRoamDate(today);
            if (
              /skip dnp/i.test(group) &&
              date === getPageTitleByBlockUid(blockUid)
            ) {
              return orig;
            } else {
              return `[[${date}]]`;
            }
          }
        )}`;
      value = `${value}${formattedText}`;
    }
    const replaceTags = config["Replace Tags"];
    if (replaceTags) {
      const pairs = replaceTags.split("|") as string[];
      const formattedPairs = pairs.map((p) =>
        p
          .split(",")
          .map((pp) =>
            pp.trim().replace("#", "").replace("[[", "").replace("]]", "")
          )
          .map((pp) =>
            pp === "{date}"
              ? DAILY_NOTE_PAGE_REGEX.source
              : pp === "{today}"
              ? toRoamDate()
              : pp
          )
      );
      formattedPairs.forEach(([before, after]) => {
        if (after) {
          value = value.replace(new RegExp(before), after);
        } else {
          value = value.replace(createTagRegex(before), "");
        }
      });
    }
    if (value !== oldValue) {
      updateBlock({ uid: blockUid, text: value });
    }
  };

  createHTMLObserver({
    tag: "LABEL",
    className: "check-container",
    callback: (l: HTMLLabelElement) => {
      const inputTarget = l.querySelector("input");
      if (inputTarget.type === "checkbox") {
        const blockUid = getBlockUidFromTarget(inputTarget);
        inputTarget.addEventListener("click", () => {
          setTimeout(() => {
            const oldValue = getTextByBlockUid(blockUid);
            if (inputTarget.checked) {
              onTodo(blockUid, oldValue);
            } else {
              onDone(blockUid, oldValue);
            }
          }, 50);
        });
      }
    },
  });

  document.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement;
    if (
      target.parentElement.getElementsByClassName(
        "bp3-text-overflow-ellipsis"
      )[0]?.innerHTML === "TODO"
    ) {
      const textarea = target
        .closest(".roam-block-container")
        ?.getElementsByTagName?.("textarea")?.[0];
      if (textarea) {
        const { blockUid } = getUids(textarea);
        onTodo(blockUid, textarea.value);
      }
    }
  });

  const keydownEventListener = async (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      if (isControl(e)) {
        const target = e.target as HTMLElement;
        if (target.tagName === "TEXTAREA") {
          const textArea = target as HTMLTextAreaElement;
          const { blockUid } = getUids(textArea);
          if (textArea.value.startsWith("{{[[DONE]]}}")) {
            onDone(blockUid, textArea.value);
          } else if (textArea.value.startsWith("{{[[TODO]]}}")) {
            onTodo(blockUid, textArea.value);
          }
          return;
        }
        Array.from(document.getElementsByClassName("block-highlight-blue"))
          .map(
            (d) => d.getElementsByClassName("roam-block")[0] as HTMLDivElement
          )
          .map((d) => getUids(d).blockUid)
          .map((blockUid) => ({ blockUid, text: getTextByBlockUid(blockUid) }))
          .forEach(({ blockUid, text }) => {
            if (text.startsWith("{{[[DONE]]}}")) {
              onTodo(blockUid, text);
            } else if (text.startsWith("{{[[TODO]]}}")) {
              onDone(blockUid, text);
            }
          });
      } else {
        const target = e.target as HTMLElement;
        if (target.tagName === "TEXTAREA") {
          const todoItem = Array.from(
            target.parentElement.querySelectorAll<HTMLDivElement>(
              ".bp3-text-overflow-ellipsis"
            )
          ).find((t) => t.innerText === "TODO");
          if (
            todoItem &&
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

  const config = getConfigFromPage("roam/js/todo-trigger");
  const isStrikethrough = !!config["Strikethrough"];
  const isClassname = !!config["Classname"];
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
      callback: (l: HTMLLabelElement) => {
        const input = l.getElementsByTagName("input")[0];
        if (input.checked && !input.disabled) {
          const zoom = l.closest(".rm-zoom-item-content") as HTMLSpanElement;
          if (zoom) {
            styleBlock(
              zoom.firstElementChild.firstElementChild as HTMLDivElement
            );
            return;
          }
          const block = CLASSNAMES_TO_CHECK.map(
            (c) => l.closest(`.${c}`) as HTMLElement
          ).find((d) => !!d);
          if (block) {
            styleBlock(block);
          }
        } else {
          const zoom = l.closest(".rm-zoom-item-content") as HTMLSpanElement;
          if (zoom) {
            unstyleBlock(
              zoom.firstElementChild.firstElementChild as HTMLDivElement
            );
            return;
          }
          const block = CLASSNAMES_TO_CHECK.map(
            (c) => l.closest(`.${c}`) as HTMLElement
          ).find((d) => !!d);
          if (block) {
            unstyleBlock(block);
          }
        }
      },
      tag: "LABEL",
      className: "check-container",
    });
  }
});
