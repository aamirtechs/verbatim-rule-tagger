# Good first issues

## Add rule import and export as JSON
Let users save their rule set to a JSON file and reload it later.
Validate imported rules with the same parser used by the editor.

## Add a stopword helper for rule discovery
List the most frequent words in untagged comments to suggest new keyword rules.
Keep it a simple frequency count in src/logic.js with tests.

## Add per-label CSV split export
Offer one CSV per label in addition to the combined tagged file.
Reuse the existing tagged CSV builder per label.
