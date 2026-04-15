import type { Citation } from "@/types/api";

/** Matches [MAT 5:3, WEB] or [MAT 5:3-12, KJV] anywhere in text */
export const CITATION_RE =
  /\[([A-Z]{3})\s+(\d+):(\d+(?:-\d+)?),\s*([A-Z]+)\]/g;

export function parseCitations(text: string): Citation[] {
  const result: Citation[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(CITATION_RE)) {
    const [, book, chapterStr, verseStr, translation] = match;
    const chapter = parseInt(chapterStr, 10);
    let verse_start: number;
    let verse_end: number;

    if (verseStr.includes("-")) {
      const [s, e] = verseStr.split("-");
      verse_start = parseInt(s, 10);
      verse_end = parseInt(e, 10);
    } else {
      verse_start = verse_end = parseInt(verseStr, 10);
    }

    const key = `${book}${chapter}:${verse_start}-${verse_end},${translation}`;
    if (seen.has(key)) continue;
    seen.add(key);

    result.push({ book, chapter, verse_start, verse_end, translation, text: "" });
  }

  return result;
}

export function formatCitationLabel(c: Citation): string {
  const verseRange =
    c.verse_start === c.verse_end
      ? `${c.verse_start}`
      : `${c.verse_start}-${c.verse_end}`;
  return `${c.book} ${c.chapter}:${verseRange}, ${c.translation}`;
}

export const BOOK_NAMES: Record<string, string> = {
  MAT: "Matthew",
  MRK: "Mark",
  LUK: "Luke",
  JHN: "John",
};
