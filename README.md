# Verbatim Rule Tagger
Live page: https://aamirtechs.github.io/verbatim-rule-tagger/

CX analysts hand-read open-text survey responses or send customer text to an AI service their policy forbids. Verbatim Rule Tagger applies your own transparent keyword rules to thousands of verbatims locally: multi-label tags, hit counts, co-occurrence and a reproducible audit sample, with no upload and no black box.

## Features
- CSV in: an id column plus a text column of survey verbatims or ticket comments
- Rule editor: label = any / all / not keywords, or a regex rule with error reporting
- Multi-label matching with rule precedence, hit counts and percentages per label
- Co-occurrence table showing which labels appear together
- Deterministic seeded audit sample with matched-rule highlighting, plus tagged CSV export

## How it works
Paste a CSV of comments and write one rule per line, such as `Billing = any: charged | not: refund`. The tagger applies every rule locally, reports hits and label overlaps, draws a seeded audit sample a reviewer can reproduce, and exports a tagged CSV. It runs entirely in the browser.

## Privacy
Runs 100% in your browser. Your files never leave this device, nothing is uploaded,
and there is no tracking.

## Development
Core logic lives in `src/logic.js` and is shared by the page and the tests.
Run the tests with `npm test`.

## License
MIT, Copyright 2026 Amir Hussain.
