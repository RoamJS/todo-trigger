// This file was migrated from the preexisting Defer TODOs Smartblock workflow

import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import dateFnsFormat from "date-fns/format";
import endOfMonth from "date-fns/endOfMonth";
import endOfYear from "date-fns/endOfYear";
import addMonths from "date-fns/addMonths";
import differenceInDays from "date-fns/differenceInDays";
import createOverlayRender from "roamjs-components/util/createOverlayRender";
import { useState, useCallback, useRef, useEffect } from "react";
import { Alert, Classes, InputGroup, Label, H3 } from "@blueprintjs/core";
import updateBlock from "roamjs-components/writes/updateBlock";

type Props = {
  resolve: (value: string) => void;
};

const Prompt = ({ onClose, resolve }: { onClose: () => void } & Props) => {
  const [value, setValue] = useState(() => "");
  const [loaded, setLoaded] = useState(false);
  const resolveAndClose = useCallback(
    (s: string) => {
      onClose();
      setTimeout(() => resolve(s), 1);
    },
    [resolve, onClose]
  );
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!loaded) {
      setLoaded(true);
    }
  }, [loaded, setLoaded]);
  useEffect(() => {
    if (contentRef.current && loaded) {
      contentRef.current.closest<HTMLDivElement>(".bp3-overlay").style.zIndex =
        "1000";
    }
  }, [contentRef, loaded]);
  return (
    <Alert
      isOpen={true}
      canOutsideClickCancel
      canEscapeKeyCancel
      onCancel={() => resolveAndClose("")}
      onConfirm={() => resolveAndClose(value)}
      cancelButtonText={"cancel"}
    >
      <H3>SmartBlocks Input</H3>
      <div className={Classes.ALERT_BODY} ref={contentRef}>
        <Label style={{ whiteSpace: "pre-wrap" }}>
          {`How many days to defer?
OR pick random date:
tw = this week
nw = next week
tm = this month
nm = next month
ty = this year
ny = next year`}
          <InputGroup
            placeholder={"Enter value..."}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && resolveAndClose(value)}
          />
        </Label>
      </div>
    </Alert>
  );
};

const addDeferTODOsCommand = () => {
  window.roamAlphaAPI.ui.commandPalette.addCommand({
    label: "Defer TODO",
    callback: () => {
      const blockUid = window.roamAlphaAPI.ui.getFocusedBlock()["block-uid"];
      if (!blockUid) return;
      const blockText = getTextByBlockUid(blockUid);
      const varDefDate = blockText.match(/varDefDate=([^}]+)}/)?.[1];
      const varTodayDNP = window.roamAlphaAPI.util.dateToPageTitle(new Date());
      var foundButton = blockText.indexOf("(Deferrals:") > -1;
      var rmDateFormatStr = typeof varDefDate === "undefined" ? "" : varDefDate;
      var usingDNP = false;
      if (!foundButton) {
        //No button found which means no date variable set so need to parse out a DNP date
        //Find the last date in the block
        var arrDnp = blockText.split(
          /(\[\[[^\]]*?\s[0-9]+(?:st|nd|rd|th),\s[0-9]{4}\]\])/
        );
        if (arrDnp.length > 1) {
          var lastDate = arrDnp[arrDnp.length - 2];
        } else {
          var lastDate = varTodayDNP;
          usingDNP = true;
        }
        rmDateFormatStr = lastDate
          .replace("[[", "")
          .replace("]]", "")
          .replace("st,", "")
          .replace("rd,", "")
          .replace("th,", "")
          .replace("nd,", "");
      }

      //Set some variables
      var btnCounter = 0;
      var finalString = "";
      var rmDateParse = new Date(Date.parse(rmDateFormatStr));
      new Promise<string>((resolve) =>
        createOverlayRender<Props>("defer-todos-prompt", Prompt)({ resolve })
      ).then((howManyDays) => {
        var howManyDaysInt = parseInt(howManyDays);

        if (isNaN(howManyDaysInt)) {
          //Random dates for this week, next week, etc.
          switch (howManyDays) {
            //Sunday = 0, Saturday = 6
            case "tw":
              var curDayOfWeek = rmDateParse.getDay();
              if (curDayOfWeek == 6) {
                curDayOfWeek = 0;
              }
              howManyDaysInt =
                1 + Math.floor(Math.random() * Math.floor(6 - curDayOfWeek));
              break;
            case "nw":
              var curDayOfWeek = rmDateParse.getDay();
              howManyDaysInt =
                6 -
                curDayOfWeek +
                1 +
                Math.floor(Math.random() * Math.floor(7));
              break;
            case "tm":
              var curDayOfMonth = rmDateParse.getDate();
              var endOfMonthDate = endOfMonth(rmDateParse).getDate();
              var endOfNextMonth = endOfMonth(
                addMonths(rmDateParse, 1)
              ).getDate();
              if (curDayOfMonth == endOfMonthDate) {
                curDayOfMonth = 1;
                endOfMonthDate = endOfNextMonth;
              }
              howManyDaysInt =
                1 +
                Math.floor(
                  Math.random() * Math.floor(endOfMonthDate - curDayOfMonth)
                );
              break;
            case "nm":
              var curDayOfMonth = rmDateParse.getDate();
              var endOfMonthDate = endOfMonth(rmDateParse).getDate();
              var endOfNextMonth = endOfMonth(
                addMonths(rmDateParse, 1)
              ).getDate();
              howManyDaysInt =
                endOfMonthDate -
                curDayOfMonth +
                1 +
                Math.floor(Math.random() * Math.floor(endOfNextMonth));
              break;
            case "ty":
              var daysLeftInYear = differenceInDays(
                endOfYear(rmDateParse),
                new Date()
              );
              howManyDaysInt =
                1 + Math.floor(Math.random() * Math.floor(daysLeftInYear));
              break;
            case "ny":
              var daysLeftInYear = differenceInDays(
                endOfYear(rmDateParse),
                new Date()
              );
              howManyDaysInt =
                1 +
                daysLeftInYear +
                Math.floor(Math.random() * Math.floor(365));
              break;
            default:
              howManyDaysInt = 1;
              break;
          }
        }

        var nextDate = new Date(
          rmDateParse.getFullYear(),
          rmDateParse.getMonth(),
          rmDateParse.getDate() + howManyDaysInt
        );
        var rmDateFormat =
          "[[" + dateFnsFormat(nextDate, "MMMM do, yyyy") + "]]";
        rmDateFormatStr = rmDateFormat
          .replace("[[", "")
          .replace("]]", "")
          .replace(/(st|nd|rd|th)?, /, " ");
        if (blockText.split(/(\(Deferrals:.*\))/).length > 1) {
          var foundNum = parseInt(
            blockText
              .split(/(\(Deferrals:.*\))/)[1]
              .replace("(Deferrals:", "")
              .replace(")", "")
              .trim()
          );
          if (Number.isInteger(foundNum)) {
            btnCounter = foundNum;
          }
          btnCounter++;
          finalString =
            rmDateFormat +
            " (Deferrals: " +
            btnCounter +
            ") {{Defer:varDefDate=" +
            rmDateFormatStr +
            "}}";
        } else {
          btnCounter++;
          if (usingDNP) {
            finalString = varTodayDNP + " ";
          }
          finalString =
            finalString +
            "**Deferred To:** " +
            rmDateFormat +
            " (Deferrals: " +
            btnCounter +
            ") {{Defer:varDefDate=" +
            rmDateFormatStr +
            "}}";
        }

        updateBlock({
          uid: blockUid,
          text: `${blockText.replace(
            /\[\[[a-zA-Z]+ \d{1\,2}[sthndr]{2}\, \d{4}\]\] \(Deferrals:.*$/,
            ""
          )} ${finalString}`,
        });
      });
    },
  });
};

export default addDeferTODOsCommand;
