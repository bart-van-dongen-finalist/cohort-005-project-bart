## Verification checks

Do these checks in this order before you report a change to `app/` as complete:

1. `npm run typecheck`
2. `npm run test`

## Domain language

Before you name a domain concept or write user-facing text, read `GLOSSARY.md` for the canonical word and the "Write user-facing text" section of `CODING_STANDARDS.md` for the style rules.

## When something breaks

| Symptom                                         | Cause                                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 401 "Log in required" / "Log in to continue."   | No user in the session — switch users and country in the floating DevUI panel (`app/components/dev-ui.tsx`). |
| `tsc` reports every `./+types/*` import missing | Typegen has not run. Use `npm run typecheck`, which runs `react-router typegen` first.                       |

## Agent skills

### Issue tracker

Issues and PRDs live as GitHub issues on your own copy of this repo (the `origin` remote), never on `ai-hero-dev/cohort-005-project`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.
