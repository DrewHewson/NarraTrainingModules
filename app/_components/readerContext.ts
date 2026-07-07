// Tiny client-side store the reader (ChapterView) uses to publish the exact
// chapter + focused sub-section, so the FeedbackWidget can log feedback within
// that precise scope instead of guessing from the URL/DOM. Both components
// import this same module → they share the singleton.

export type ReaderContext = {
  chapterSlug: string;
  chapterTitle: string;
  sectionId: string | null;
  sectionTitle: string | null;
};

let current: ReaderContext | null = null;
const listeners = new Set<() => void>();

export function setReaderContext(ctx: ReaderContext | null) {
  current = ctx;
  listeners.forEach((l) => l());
}

export function getReaderContext(): ReaderContext | null {
  return current;
}

export function subscribeReaderContext(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
