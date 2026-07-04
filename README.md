# InboxSignal

Chrome extension that flags the Gmail inbox rows that actually need attention before you open them: deadlines, action items, payment requests, follow ups. Flagged rows get a short note on the right with the likely point of the email and up to two next actions.

Everything runs in the content script on mail.google.com. No backend, no server calls, email text never leaves the browser. The only permission is storage, used to tune the local ranking when you mark a flag as useful.

## Install

Open chrome://extensions, turn on developer mode, hit load unpacked, and select this folder. Then open Gmail. demo.html has a fake inbox with light, tinted, and dark rows if you want to try it without touching a real account.

## How ranking works

The content script scans visible subject lines and snippets for signals like deadlines, payment amounts, penalties, missing details, and contradictions. Clicking Useful on a highlight bumps that signal type locally. Clear signals in the popup resets everything.
