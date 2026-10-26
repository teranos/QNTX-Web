# BDD

"exclusively gherkin, gherkin owns stories"

Stories live in `stories/*.feature`, in Gherkin.

"Stories are describing what is possible"

"i dont want to see stories about how there isn't a pink elephant on the moon."

`bun run stories` walks them in Chromium against the mock.

A step binds to a line of a story by its exact text, in `stories/steps/*.ts`.

`playwright.config.ts` names the stories walked; a story is walked once every line of it is bound.

What a story touches is answered by the mock: `mock/server.ts`, `mock/world.ts`, `mock/fixtures/`.

Every pull request walks them ([ci/ts.nix](ci/ts.nix)).
