# InboxSignal

InboxSignal is a Chrome extension that marks important Gmail inbox rows before you open them.

## Privacy

1. Email text stays in the browser.
2. There is no backend.
3. There is no telemetry.
4. There are no server calls.
5. Feedback only tunes local ranking on this device.

## What It Marks

InboxSignal scans visible inbox rows and marks text that looks like:

1. Action items
2. Deadlines
3. Payment requests
4. Follow up requests
5. Penalties
6. Missing details
7. Contradictions

Marked rows get a short note on the far right with the likely point of the email and up to two next actions.

## Load In Chrome

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select this folder.
5. Open Gmail in Chrome.

## Local Preview

Open `demo.html` in a browser.

The preview includes inbox rows with light, tinted, and dark backgrounds so the highlights can be checked quickly.

## Permissions

`storage`

Needed to save local feedback and ranking counts on this device. It does not grant read, write, delete, or send access to Gmail.

Gmail page access

The content script runs only on `https://mail.google.com/*` so it can read visible subject lines and snippets in the current Gmail tab and draw local highlights. It does not request broader web access.

## Manual Check

1. Load the unpacked extension in Chrome.
2. Open Gmail inbox list view.
3. Confirm the control says `100% local. No data leaves your browser.`
4. Confirm deadline, action, payment, or follow up rows are marked before opening them.
5. Confirm marked rows show a short note and action items on the far right.
6. Confirm normal low signal rows are not marked.
7. Confirm tinted or dark rows still have readable highlights.
8. Click a highlight and press Useful.
9. Open the extension popup and confirm the tuned signal count increased.
10. Press Clear signals and confirm the inbox text returns to normal.
