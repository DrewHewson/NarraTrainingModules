// Preview-only content reader for the live authoring harness.
// Deliberately independent of lib/content.ts (which the Phase-1 seed/tests depend on)
// so the reading-view can surface extra frontmatter (part, estimatedMinutes), a
// sub-section table of contents, and inline figures without changing the tested parser.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { basename, join } from "node:path";
import matter from "gray-matter";
import { Marked, type Tokens } from "marked";

const COURSES_DIR = join(process.cwd(), "content", "courses");
const PUBLIC_DIR = join(process.cwd(), "public");
const RASTER_EXTS = ["png", "jpg", "jpeg", "webp", "avif", "gif"];

export type Section = { id: string; title: string; html: string };

export type ChapterMeta = {
  slug: string;
  title: string;
  order: number;
  part?: string;
  estimatedMinutes?: number;
};

export type CourseMeta = {
  slug: string;
  title: string;
  description?: string;
  status?: string;
  chapters: ChapterMeta[];
};

export type Chapter = ChapterMeta & { html: string; preamble: string; sections: Section[] };

function chapterMetaFromFile(courseSlug: string, file: string): ChapterMeta {
  const raw = readFileSync(join(COURSES_DIR, courseSlug, "chapters", file), "utf8");
  const { data } = matter(raw);
  return {
    slug: basename(file, ".md"),
    title: String(data.title ?? basename(file, ".md")),
    order: Number(data.order ?? 0),
    part: data.part ? String(data.part) : undefined,
    estimatedMinutes: data.estimatedMinutes ? Number(data.estimatedMinutes) : undefined,
  };
}

function readChapterFiles(courseSlug: string): string[] {
  const dir = join(COURSES_DIR, courseSlug, "chapters");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".md"));
}

export function listCourses(): CourseMeta[] {
  if (!existsSync(COURSES_DIR)) return [];
  return readdirSync(COURSES_DIR)
    .filter((slug) => existsSync(join(COURSES_DIR, slug, "course.json")))
    .map((slug) => getCourse(slug))
    .filter((c): c is CourseMeta => c !== null)
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function getCourse(slug: string): CourseMeta | null {
  const metaPath = join(COURSES_DIR, slug, "course.json");
  if (!existsSync(metaPath)) return null;
  const meta = JSON.parse(readFileSync(metaPath, "utf8")) as Partial<CourseMeta>;
  const chapters = readChapterFiles(slug)
    .map((f) => chapterMetaFromFile(slug, f))
    .sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
  return {
    slug,
    title: String(meta.title ?? slug),
    description: meta.description ? String(meta.description) : undefined,
    status: meta.status ? String(meta.status) : undefined,
    chapters,
  };
}

export function getChapter(courseSlug: string, chapterSlug: string): Chapter | null {
  const path = join(COURSES_DIR, courseSlug, "chapters", `${chapterSlug}.md`);
  if (!existsSync(path)) return null;
  const parsed = matter(readFileSync(path, "utf8"));
  const { html, preamble, sections } = renderChapter(parsed.content.trim(), courseSlug);
  return {
    slug: chapterSlug,
    title: String(parsed.data.title ?? chapterSlug),
    order: Number(parsed.data.order ?? 0),
    part: parsed.data.part ? String(parsed.data.part) : undefined,
    estimatedMinutes: parsed.data.estimatedMinutes
      ? Number(parsed.data.estimatedMinutes)
      : undefined,
    html,
    preamble,
    sections,
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Render a chapter's markdown to HTML and extract its H2 sub-sections for the TOC.
// A fresh Marked instance is created per call so the heading renderer's per-render
// closures (sections list + slug de-dup counter) never leak across requests, and so
// we avoid the global `marked.use` stacking trap.
function renderChapter(
  md: string,
  courseSlug: string,
): { html: string; preamble: string; sections: Section[] } {
  const withFigures = resolveFigures(md, courseSlug);

  const headings: { id: string; title: string }[] = [];
  const slugCounts = new Map<string, number>();
  const uniqueSlug = (text: string): string => {
    const base = slugify(text) || "section";
    const seen = slugCounts.get(base) ?? 0;
    slugCounts.set(base, seen + 1);
    return seen === 0 ? base : `${base}-${seen + 1}`;
  };

  const instance = new Marked({ gfm: true, breaks: false });
  instance.use({
    renderer: {
      heading(this: { parser: { parseInline(tokens: Tokens.Generic[]): string } }, token: Tokens.Heading) {
        const inner = this.parser.parseInline(token.tokens);
        if (token.depth === 2) {
          const id = uniqueSlug(token.text);
          headings.push({ id, title: token.text });
          return `<h2 id="${id}">${inner}</h2>\n`;
        }
        return `<h${token.depth}>${inner}</h${token.depth}>\n`;
      },
    },
  });

  let html = instance.parse(withFigures) as string;

  // Upgrade blockquotes to styled callouts; those starting with ⚠ become "verify" flags.
  html = html.replace(
    /<blockquote>\s*<p>(\s*)(⚠|✅|💡|📎|→)/g,
    (_m, _sp, glyph) => {
      const kind =
        glyph === "⚠" ? "warn" : glyph === "💡" ? "pearl" : glyph === "✅" ? "ok" : "note";
      return `<blockquote class="callout callout-${kind}"><p>${glyph}`;
    },
  );

  const { preamble, sections } = splitSections(html, headings);
  return { html, preamble, sections };
}

// Split the rendered chapter HTML into per-sub-section chunks (one <h2> block each),
// plus any preamble before the first <h2> (e.g. the "Where this fits" intro callout).
function splitSections(
  html: string,
  headings: { id: string; title: string }[],
): { preamble: string; sections: Section[] } {
  const re = /<h2 id="([^"]+)"[^>]*>/g;
  const marks: { id: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) marks.push({ id: m[1], index: m.index });

  if (marks.length === 0) return { preamble: html.trim(), sections: [] };

  const preamble = html.slice(0, marks[0].index).trim();
  const sections: Section[] = marks.map((mark, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].index : html.length;
    return {
      id: mark.id,
      title: headings.find((h) => h.id === mark.id)?.title ?? mark.id,
      html: html.slice(mark.index, end).trim(),
    };
  });
  return { preamble, sections };
}

// Resolve `[[figure: <stem> | <caption> | <asset-id>]]` shortcodes into inline <figure>
// blocks. The SVG file is read from the course's images/ dir and inlined, so the preview
// renders with zero Storage/public infra. Content is authored in-house (trusted).
//
// Forward-compat: when the deferred Storage image-sync lands, swap the inlined <svg>
// branch below for `<img src={storageURL} alt={caption}>`. The shortcode syntax and the
// surrounding <figure>/<figcaption> markup stay identical, so no chapter prose changes.
function resolveFigures(md: string, courseSlug: string): string {
  // [[figure: <stem> | <caption>? | <asset-id>? | <credit>? ]]
  const shortcode = /^\[\[figure:\s*([^\|\]]+?)\s*(?:\|\s*([^\|\]]*?)\s*)?(?:\|\s*([^\|\]]*?)\s*)?(?:\|\s*([^\|\]]*?)\s*)?\]\]\s*$/gm;
  return md.replace(
    shortcode,
    (_m, stemRaw: string, captionRaw?: string, idRaw?: string, creditRaw?: string) => {
      const stem = stemRaw.trim();
      const caption = (captionRaw ?? "").trim();
      const assetId = (idRaw ?? "").trim();
      const credit = (creditRaw ?? "").trim();

      const capHtml = caption ? escapeHtml(caption) : "";
      const idHtml = assetId ? ` <span class="np-figure-id">${escapeHtml(assetId)}</span>` : "";
      const creditHtml = credit
        ? `\n    <span class="np-figure-credit">${escapeHtml(credit)}</span>`
        : "";
      const captionBlock =
        capHtml || idHtml || credit
          ? `\n  <figcaption class="np-figure-cap">${capHtml}${idHtml}${creditHtml}</figcaption>`
          : "";

      // 1) In-house SVG (inlined) — content/courses/{course}/images/{stem}.svg
      const svgFile = join(COURSES_DIR, courseSlug, "images", `${stem}.svg`);
      if (existsSync(svgFile)) {
        try {
          const svg = readFileSync(svgFile, "utf8")
            .replace(/^﻿/, "")
            .replace(/<\?xml[\s\S]*?\?>/i, "")
            .replace(/<!DOCTYPE[\s\S]*?>/i, "")
            // Collapse blank lines: a blank line would terminate the Markdown HTML
            // block early, splitting the SVG and mis-parsing the remainder.
            .replace(/\n\s*\n+/g, "\n")
            .trim();
          if (svg) {
            return `\n\n<figure class="np-figure">\n  <div class="np-figure-media">${svg}</div>${captionBlock}\n</figure>\n\n`;
          }
        } catch {
          /* fall through */
        }
      }

      // 2) Sourced image served from /public/images/{course}/{stem}.{ext}
      //    (raster, or a third-party .svg served as <img> — kept out of the inline path)
      const ext = [...RASTER_EXTS, "svg"].find((e) =>
        existsSync(join(PUBLIC_DIR, "images", courseSlug, `${stem}.${e}`)),
      );
      if (ext) {
        const src = `/images/${courseSlug}/${stem}.${ext}`;
        const alt = escapeHtml(caption || assetId || stem);
        return `\n\n<figure class="np-figure">\n  <div class="np-figure-media"><img src="${src}" alt="${alt}" loading="lazy" /></div>${captionBlock}\n</figure>\n\n`;
      }

      // 3) Not yet produced — tasteful "in production" card (not an error).
      const tag = `Illustration in production${assetId ? ` · ${escapeHtml(assetId)}` : ""}`;
      return `\n\n<figure class="np-figure np-figure-planned">\n  <div class="np-figure-planned-tag">${tag}</div>${captionBlock}\n</figure>\n\n`;
    },
  );
}
