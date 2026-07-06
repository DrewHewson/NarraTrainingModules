# Module 1 — Chapter quizzes (DRAFT)

**Status: DRAFT — pending Margie's clinical sign-off.**

These `NN-<chapter-slug>.json` files hold the end-of-chapter quiz questions
(`ParsedQuestion[]`, seeded into `quiz_questions` with `scope='chapter'`). They
were drafted from each chapter's own content to make the quiz feature testable —
they are **not** finalized clinical assessment content.

Same governance as the curriculum's `> ⚠ Verify…` callouts: every question and
its keyed answer must be reviewed and signed off by Nurse Margie (NP) before this
course is used with real learners. Track sign-off in `content/asset-register.md`.

- ~6 reasoning-based questions per chapter (minimize T/F).
- `correct` = zero-based option indices; `single` = one correct, `multiple` = a set.
- The answer key lives only in `quiz_questions.correct` (server-side); learners
  read questions via the `quiz_questions_public` view, which omits `correct`.
