import createObserver from "roamjs-components/dom/createObserver";
import getUids from "roamjs-components/dom/getUids";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import updateBlock from "roamjs-components/writes/updateBlock";
import { OnloadArgs } from "roamjs-components/types";
import { isArchivedText, toggleArchived } from "./archiveText";

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
export const replaceText = (text: string): void => {
  const textArea = document.activeElement as HTMLTextAreaElement;
  const oldValue = textArea.value;
  const start = textArea.selectionStart;
  const end = textArea.selectionEnd;
  const location = window.roamAlphaAPI.ui.getFocusedBlock();
  if (!location) return;
  const blockUid = location["block-uid"];
  window.roamAlphaAPI.updateBlock({ block: { string: text, uid: blockUid } });
  const diff = text.length - oldValue.length;
  if (diff !== 0) {
    let index = 0;
    const maxIndex = Math.min(
      Math.max(oldValue.length, text.length),
      Math.max(start, end) + 1,
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

const ARCHIVE_COMMAND_LABEL = "TODONT Hotkey";

const initializeTodont = (extensionAPI: OnloadArgs["extensionAPI"]) => {
  const unloads = new Set<() => void>();
  const cleanup = () => {
    unloads.forEach((u) => {
      void u();
    });
    unloads.clear();
  };

  const archiveBlock = (blockUid: string, value: string) => {
    updateBlock({ uid: blockUid, text: toggleArchived(value) });
  };

  const todontCallback = () => {
    const selectedBlocks = Array.from(
      document.getElementsByClassName("block-highlight-blue"),
    );
    if (selectedBlocks.length > 0) {
      const blocks = selectedBlocks
        .map(
          (d) => d.getElementsByClassName("roam-block")[0] as HTMLDivElement,
        )
        .filter((d) => !!d)
        .map((d) => {
          const { blockUid } = getUids(d);
          return { blockUid, value: getTextByBlockUid(blockUid) };
        });
      const allArchived = blocks.every(({ value }) => isArchivedText(value));
      blocks.forEach(({ blockUid, value }) => {
        if (allArchived || !isArchivedText(value)) archiveBlock(blockUid, value);
      });
      return;
    }
    if (document.activeElement?.tagName === "TEXTAREA") {
      const textArea = document.activeElement as HTMLTextAreaElement;
      replaceText(toggleArchived(textArea.value));
    }
  };

  const toggle = (todontMode: typeof TODONT_MODES[number]) => {
    cleanup();

    if (todontMode === "off") {
      return;
    }

    const archiveCommand = {
      label: ARCHIVE_COMMAND_LABEL,
      callback: todontCallback,
      "default-hotkey": "defmod-shift-enter",
    };
    extensionAPI.ui.commandPalette.addCommand(archiveCommand);
    unloads.add(() => {
      extensionAPI.ui.commandPalette.removeCommand({
        label: ARCHIVE_COMMAND_LABEL,
      });
    });

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
    color: transparent;
    background-color: #EF5151;
    border: #EA666656;
    border-width: 0 2px 2px 0;
    font-size: 0;
    line-height: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}
.bp3-button.bp3-small.${TODONT_CLASSNAME}::before {
    content: "x" / "";
    color: #2E2E2E;
    font-size: 12px;
    line-height: 14px;
    font-weight: 700;
}`;
    document.getElementsByTagName("head")[0].appendChild(css);
    unloads.add(() => {
      css.remove();
    });

    const isArchivedButton = (button: HTMLButtonElement): boolean =>
      button.textContent?.trim() === "ARCHIVED";
    const labelledButtons = new WeakSet<HTMLButtonElement>();
    const unstyleButton = (button: HTMLButtonElement): void => {
      button.classList.remove(TODONT_CLASSNAME);
      if (
        labelledButtons.delete(button) &&
        button.getAttribute("aria-label") === "ARCHIVED"
      ) {
        button.removeAttribute("aria-label");
      }
    };
    const syncArchivedButton = (button: HTMLButtonElement) => {
      if (isArchivedButton(button)) {
        button.classList.add(TODONT_CLASSNAME);
        if (!button.hasAttribute("aria-label")) {
          button.setAttribute("aria-label", "ARCHIVED");
          labelledButtons.add(button);
        }
      } else {
        unstyleButton(button);
      }
    };
    const syncArchivedButtons = (node?: HTMLElement | null) => {
      if (!node) {
        return;
      }
      if (node instanceof HTMLButtonElement) {
        syncArchivedButton(node);
        return;
      }
      node.querySelectorAll<HTMLButtonElement>("button").forEach(syncArchivedButton);
    };
    syncArchivedButtons(document.body);
    unloads.add(() => {
      document.querySelectorAll<HTMLButtonElement>(`.${TODONT_CLASSNAME}`).forEach(unstyleButton);
    });

    let previousActiveElement: HTMLElement | null = null;
    const todontIconButton = createMobileIcon(
      "mobile-todont-icon-button",
      "minus-square",
    );
    todontIconButton.onclick = () => {
      if (previousActiveElement?.tagName === "TEXTAREA") {
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
        if (record.target instanceof HTMLElement) {
          syncArchivedButtons(record.target);
        }
      });
      const mobileBackButton = document.getElementById(
        "mobile-back-icon-button",
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

    if (todontMode === "strikethrough") {
      const selectors = CLASSNAMES_TO_CHECK.map(
        (name) => `.${name}:has(button.${TODONT_CLASSNAME})`,
      );
      selectors.push(`.rm-zoom-item-content:has(button.${TODONT_CLASSNAME})`);
      css.textContent += `${selectors.join(", ")} { text-decoration: line-through; }`;
    }
  };

  return {
    toggle,
    cleanup,
  };
};

export default initializeTodont;
