-- Store the per-question explanation (shown to the learner AFTER they submit a
-- quiz). Nullable so existing rows are unaffected. The answer-hiding view
-- `quiz_questions_public` is intentionally NOT changed — it still exposes only
-- id/scope/parent_id/question/options/type/order, so neither `correct` nor
-- `explanation` is visible before submission.
alter table quiz_questions add column if not exists explanation text;
