# Coding standards

## Fail with a thrown response, not a return value

A loader or an action that cannot continue throws. It does not return an
error shape for the component to unpack.

```ts
if (!course) throw data("Course not found.", { status: 404 });
```

The route then has one success path. A returned error shape gives every
component a second path to forget about.

## Parse untrusted input with a schema

Form data, search parameters and request bodies get a zod schema before the
values reach any query. Do not read `formData.get("x") as string`. The cast
is a lie the type checker believes.

## Do not write `any`, and do not write `!`

Both switch the type checker off at the exact point you are least sure. If a
value can be missing, narrow it with a check. If you cannot name the type,
the shape is wrong — fix the shape.

## Write user-facing text in the glossary's words

Every domain word a user reads — on a button, heading, badge, email or
error — is the canonical term from `GLOSSARY.md`. Name variables, functions
and constants after the same term, so the code and the screen say one thing.
The words on each term's _Avoid_ line are the ones this replaces.

- **Sentence case** for buttons, headings, labels, badges and tabs:
  "Save changes", "Back to course", "Unanswered comments".
- **Messages are sentences.** Error, validation and toast messages end with
  a period: "Course not found." Error-boundary titles are headings, so they
  stay in Sentence case without one: "Access denied".
- **Counts go through `pluralize`** from `~/lib/pluralize`, so a count of one
  reads "1 lesson": `pluralize(lessonCount, "lesson")`,
  `pluralize(quizCount, "quiz", "quizzes")`.
- **Plain English a Student already knows.** Describe what happens to them
  ("Regional discount"), in place of the term of art behind it.
