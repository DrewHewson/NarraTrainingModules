import { createClient } from "@supabase/supabase-js";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import { parseCourse, type ParsedQuestion } from "@/lib/content";

config({ path: process.env.ENV_FILE ?? ".env.local", quiet: true });

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

async function upsertQuestions(
  scope: "chapter" | "final",
  parentId: string,
  questions: ParsedQuestion[],
) {
  const keys = questions.map((q) => q.externalKey);
  if (questions.length > 0) {
    const rows = questions.map((q) => ({
      scope,
      parent_id: parentId,
      external_key: q.externalKey,
      question: q.question,
      options: q.options,
      correct: q.correct,
      type: q.type,
      order: q.order,
      explanation: q.explanation ?? null,
    }));
    const { error } = await db
      .from("quiz_questions")
      .upsert(rows, { onConflict: "scope,parent_id,external_key" });
    if (error) throw error;
  }
  // Prune: remove questions for this parent that are no longer in the source
  // (keeps the DB authoritative when a quiz shrinks or questions are renamed).
  let del = db.from("quiz_questions").delete().eq("scope", scope).eq("parent_id", parentId);
  if (keys.length > 0) del = del.not("external_key", "in", `(${keys.join(",")})`);
  const { error: delErr } = await del;
  if (delErr) throw delErr;
}

export async function seedCourse(dir: string): Promise<void> {
  const c = parseCourse(dir);

  const { data: course, error: courseErr } = await db
    .from("courses")
    .upsert(
      {
        slug: c.slug,
        title: c.title,
        description: c.description,
        passing_score: c.passingScore,
        status: c.status,
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();
  if (courseErr) throw courseErr;

  for (const ch of c.chapters) {
    const { data: chapter, error: chErr } = await db
      .from("chapters")
      .upsert(
        {
          course_id: course!.id,
          slug: ch.slug,
          title: ch.title,
          order: ch.order,
          body: ch.body,
          media: ch.media,
        },
        { onConflict: "course_id,slug" },
      )
      .select("id")
      .single();
    if (chErr) throw chErr;
    await upsertQuestions("chapter", chapter!.id, ch.questions);
  }

  await upsertQuestions("final", course!.id, c.finalQuestions);
}

async function main() {
  const root = "content/courses";
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      await seedCourse(join(root, entry.name));
      console.log(`seeded ${entry.name}`);
    }
  }
}

// Run as a script only when invoked directly.
if (process.argv[1]?.endsWith("seed.ts")) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
