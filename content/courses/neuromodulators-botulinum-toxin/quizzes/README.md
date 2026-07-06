# Module 1 — Chapter quizzes (DRAFT)

**Status: DRAFT — pending Margie's clinical sign-off.**

These `NN-<chapter-slug>.json` files hold the end-of-chapter quiz questions
(`ParsedQuestion[]`, seeded into `quiz_questions` with `scope='chapter'`). They
are **extracted from each chapter's own inline "Knowledge Check"** — the graded
quiz IS the chapter's knowledge check (there is no longer a separate inline
version). The answer + `explanation` are shown to the learner only **after** they
submit.

Same governance as the curriculum's `> ⚠ Verify…` callouts: every question and
its keyed answer must be reviewed and signed off by Nurse Margie (NP) before this
course is used with real learners. Track sign-off in `content/asset-register.md`.

- Reasoning-based questions (counts follow the source Knowledge Checks).
- `correct` = zero-based option indices; `single` = one correct, `multiple` = a set.
- `explanation` = the "✅ Correct" rationale from the source; revealed post-submit.
- The answer key + explanation live only in `quiz_questions` (server-side); learners
  read questions via the `quiz_questions_public` view, which omits both.
