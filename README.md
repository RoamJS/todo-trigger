# TODO Trigger
      
Tie special actions to converting between TODOs and DONEs!

## Usage

This extension supports the following configuration options, to be specified in the `TODO Triggers Home` settings panel within Roam Depot:

- `Append Text` - (Optional) The text to add to the end of a block when an item flips from TODO to DONE. It supports the following place holders:

    - `/Current Time` - inserts the current time

    - `/Today` **(deprecated)** - inserts the the current day

    - `{now}`- inserts the current day. Use `{now:skip dnp}` to skip adding the current day when the TODO is on a daily note page.

- `On Todo` - (Optional) The text to add to the end of a block, when a block first becomes a TODO. It supports the following place holders:

    - `/Current Time` - inserts the current time

    - `/Today` **(deprecated)** - inserts the the current day

    - `{now}`- inserts the current day. Use `{now:skip dnp}` to skip adding the current day when the TODO is on a daily note page.

- `Replace Tags` - (Optional) The set of pairs that you would want to be replaced upon switching between todo and done. Multiple pairs are deliminited by `|` and each pair is delimited by `,`. For example, `Replace Tags:: #toRead, #Read | #toWrite, #Written`

    - There are a couple of placeholders this option supports. `{date}` maps to any date tag and `{today}` maps to today. So you could configure `Replace Tags:: {date}, {today}` to replace a date tag with today's date.

- `Strikethrough` - (Optional) Set to `True` to strikethrough blocks with `{{[[DONE]]}}`.

- `Classname` - (Optional) Set to `True` to add a `roamjs-done` classname to blocks with `{{[[DONE]]}}`. You could then style the block to your liking with `roam/css`.

- `Explode` - (Optional) Set to `True` to play a fun animation when the TODO is finished


Anytime a TODO checkbox becomes DONE, either by user click or keyboard shortbut, the "Done" action fires. Similarly, when a DONE checkbox becomes TODO, the "Todo" action fires. This extension also works on multiple blocks at once.

When "Append Text" is configured, the "Done" action appends the configured text to the end of the block. The "Todo" action removes the configured text from the end of the block.

When "Replace Tags" is configured, the "Done" action replaces each pair's first tag with the second tag. The "Todo" action does the same replacement in reverse.

When "Strikethrough" is configured the "Done" action adds a strikethrough to the block. The "Todo" action removes it.

When None are configured, nothing happens.

### Demo

<video src="https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2F7LAMTNJU8a.mp4?alt=media&token=e008cb7f-105a-4033-9858-258cc13e283b" controls="controls" height="600"></video>
