import { createConfigObserver } from "roamjs-components/components/ConfigPage";
import getSubTree from "roamjs-components/util/getSubTree";
import runExtension from "roamjs-components/util/runExtension";
import FlagPanel from "roamjs-components/components/ConfigPanels/FlagPanel";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import createHTMLObserver from "roamjs-components/dom/createHTMLObserver";
import createObserver from "roamjs-components/dom/createObserver";
import toFlexRegex from "roamjs-components/util/toFlexRegex";
import isControl from "roamjs-components/util/isControl";
import getUids from "roamjs-components/dom/getUids";
import { OnloadArgs } from "roamjs-components/types";

const CLASSNAMES_TO_CHECK = [
  "rm-block-ref",
  "kanban-title",
  "kanban-card",
  "roam-block",
];

const createMobileIcon = (id: string, iconType: string): HTMLButtonElement => {
  const iconButton = document.createElement("button");
  iconButton.id = id;
  iconButton.className =
    "bp3-button bp3-minimal rm-mobile-button dont-unfocus-block";
  iconButton.style.padding = "6px 4px 4px;";
  const icon = document.createElement("i");
  icon.className = `zmdi zmdi-hc-fw-rc zmdi-${iconType}`;
  icon.style.cursor = "pointer";
  icon.style.color = "rgb(92, 112, 128)";
  icon.style.fontSize = "18px";
  icon.style.transform = "scale(1.2)";
  icon.style.fontWeight = "1.8";
  icon.style.margin = "8px 4px";
  iconButton.appendChild(icon);
  return iconButton;
};

// TODO replace this garbage
export const replaceText = ({
  before,
  after,
  prepend,
}: {
  before: string;
  after: string;
  prepend?: boolean;
}): void => {
  const textArea = document.activeElement as HTMLTextAreaElement;
  const oldValue = textArea.value;
  const start = textArea.selectionStart;
  const end = textArea.selectionEnd;
  const text = !before
    ? prepend
      ? `${after} ${oldValue}`
      : `${oldValue}${after}`
    : oldValue.replace(`${before}${!after && prepend ? " " : ""}`, after);
  const location = window.roamAlphaAPI.ui.getFocusedBlock();
  const blockUid = location["block-uid"];
  window.roamAlphaAPI.updateBlock({ block: { string: text, uid: blockUid } });
  const diff = text.length - oldValue.length;
  if (diff !== 0) {
    let index = 0;
    const maxIndex = Math.min(
      Math.max(oldValue.length, text.length),
      Math.max(start, end) + 1
    );
    for (index = 0; index < maxIndex; index++) {
      if (oldValue.charAt(index) !== text.charAt(index)) {
        break;
      }
    }
    const newStart = index > start ? start : start + diff;
    const newEnd = index > end ? end : end + diff;
    if (newStart !== start || newEnd !== end) {
      window.roamAlphaAPI.ui.setBlockFocusAndSelection({
        location,
        selection: { start: newStart, end: newEnd },
      });
    }
  }
};

export const TODONT_MODES = ["off", "icon", "strikethrough"] as const;

const initializeTodont = () => {
  const unloads = new Set<() => void>();
  return async (todontMode: typeof TODONT_MODES[number]) => {
    if (todontMode !== "off") {
      const TODONT_CLASSNAME = "roamjs-todont";
      const css = document.createElement("style");
      css.textContent = `.bp3-button.bp3-small.${TODONT_CLASSNAME} {
    padding: 0;
    min-height: 0;
    min-width: 0;
    top: -1px;
    left: -2px;
    height: 14px;
    border-radius: 4px;
    width: 14px;
    color: #2E2E2E;
    background-color: #EF5151;
    border: #EA666656;
    border-width: 0 2px 2px 0;
}`;
      document.getElementsByTagName("head")[0].appendChild(css);
      unloads.add(() => {
        css.remove();
      });

      const styleArchivedButtons = (node: HTMLElement) => {
        const buttons = node.getElementsByTagName("button");
        Array.from(buttons).forEach((button) => {
          if (
            button.innerText === "ARCHIVED" &&
            button.className.indexOf(TODONT_CLASSNAME) < 0
          ) {
            button.innerText = "x";
            button.className = `${button.className} ${TODONT_CLASSNAME}`;
          }
        });
      };
      styleArchivedButtons(document.body);
      unloads.add(() => {
        document
          .querySelectorAll<HTMLButtonElement>(`.${TODONT_CLASSNAME}`)
          .forEach((b) => {
            if (b.innerText === "x") {
              b.innerText = "ARCHIVED";
            }
            b.classList.remove(TODONT_CLASSNAME);
          });
      });

      let previousActiveElement: HTMLElement;
      const todontIconButton = createMobileIcon(
        "mobile-todont-icon-button",
        "minus-square"
      );
      todontIconButton.onclick = () => {
        if (previousActiveElement.tagName === "TEXTAREA") {
          previousActiveElement.focus();
          todontCallback();
        }
      };

      todontIconButton.onmousedown = () => {
        previousActiveElement = document.activeElement as HTMLElement;
      };
      unloads.add(() => {
        todontIconButton.remove();
      });

      const iconObserver = createObserver((mutationList: MutationRecord[]) => {
        mutationList.forEach((record) => {
          styleArchivedButtons(record.target as HTMLElement);
        });
        const mobileBackButton = document.getElementById(
          "mobile-back-icon-button"
        );
        if (
          !!mobileBackButton &&
          !document.getElementById("mobile-todont-icon-button")
        ) {
          const mobileBar = document.getElementById("rm-mobile-bar");
          if (mobileBar) {
            mobileBar.insertBefore(todontIconButton, mobileBackButton);
          }
        }
      });
      unloads.add(() => {
        iconObserver.disconnect();
      });

      const todontCallback = () => {
        if (document.activeElement.tagName === "TEXTAREA") {
          const textArea = document.activeElement as HTMLTextAreaElement;
          const firstButtonTag = /{{\[\[([A-Z]{4,8})\]\]}}/.exec(
            textArea.value
          )?.[1];
          if (firstButtonTag === "TODO") {
            replaceText({ before: "{{[[TODO]]}}", after: "{{[[ARCHIVED]]}}" });
          } else if (firstButtonTag === "DONE") {
            replaceText({ before: "{{[[DONE]]}}", after: "{{[[ARCHIVED]]}}" });
          } else if (firstButtonTag === "ARCHIVED") {
            replaceText({
              before: "{{[[ARCHIVED]]}}",
              after: "",
              prepend: true,
            });
          } else {
            replaceText({
              before: "",
              prepend: true,
              after: "{{[[ARCHIVED]]}}",
            });
          }
        }
      };

      const keydownEventListener = async (e: KeyboardEvent) => {
        if (e.key === "Enter" && e.shiftKey && isControl(e)) {
          todontCallback();
        }
      };

      document.addEventListener("keydown", keydownEventListener);
      unloads.add(() => {
        document.removeEventListener("keydown", keydownEventListener);
      });

      if (todontMode === "strikethrough") {
        const styleBlock = (block?: HTMLElement) => {
          if (block) {
            block.style.textDecoration = "line-through";
          }
        };
        const strikethroughObserver = createHTMLObserver({
          callback: (b: HTMLButtonElement) => {
            const zoom = b.closest(".rm-zoom-item-content") as HTMLSpanElement;
            if (zoom) {
              styleBlock(
                zoom.firstElementChild.firstElementChild as HTMLDivElement
              );
              return;
            }
            const block = CLASSNAMES_TO_CHECK.map(
              (c) => b.closest(`.${c}`) as HTMLElement
            ).find((d) => !!d);
            if (block) {
              styleBlock(block);
            }
          },
          tag: "BUTTON",
          className: TODONT_CLASSNAME,
        });
        unloads.add(() => strikethroughObserver.disconnect());
      }
    } else {
      unloads.forEach((u) => u());
      unloads.clear();
    }
  };
};

export default initializeTodont;
