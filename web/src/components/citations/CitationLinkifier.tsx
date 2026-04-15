"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CITATION_RE } from "@/lib/citations";
import { CitationMarker } from "./CitationMarker";
import type { Citation } from "@/types/api";

interface CitationLinkifierProps {
  content: string;
  citations: Citation[];
  onCitationClick: (citation: Citation) => void;
}

/**
 * Renders assistant markdown content, converting [BOOK CH:V, TRANS] markers
 * into interactive CitationMarker chips.
 */
export function CitationLinkifier({
  content,
  citations,
  onCitationClick,
}: CitationLinkifierProps) {
  // Build a lookup map so we can attach the resolved verse text
  const citationMap = new Map<string, Citation>();
  for (const c of citations) {
    const key = `${c.book} ${c.chapter}:${c.verse_start}${c.verse_start !== c.verse_end ? `-${c.verse_end}` : ""}, ${c.translation}`;
    citationMap.set(key, c);
  }

  function renderText(text: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const regex = new RegExp(CITATION_RE.source, "g");
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      const [full, book, chStr, verseStr, translation] = match;
      const key = `${book} ${chStr}:${verseStr}, ${translation}`;
      const resolvedCitation = citationMap.get(key) ?? {
        book,
        chapter: parseInt(chStr, 10),
        verse_start: parseInt(verseStr.split("-")[0], 10),
        verse_end: parseInt(verseStr.split("-").pop() ?? verseStr, 10),
        translation,
        text: "",
      };
      parts.push(
        <CitationMarker
          key={`${key}-${match.index}`}
          citation={resolvedCitation}
          onClick={onCitationClick}
        />,
      );
      lastIndex = match.index + full.length;
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  }

  return (
    <div className="prose-gospel">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Override the text renderer to intercept citation markers
          p({ children }) {
            return (
              <p>
                {React.Children.map(children, (child) => {
                  if (typeof child === "string") {
                    const parts = renderText(child);
                    return parts.length === 1 && typeof parts[0] === "string"
                      ? parts[0]
                      : parts;
                  }
                  return child;
                })}
              </p>
            );
          },
          li({ children }) {
            return (
              <li>
                {React.Children.map(children, (child) => {
                  if (typeof child === "string") {
                    return renderText(child);
                  }
                  return child;
                })}
              </li>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
