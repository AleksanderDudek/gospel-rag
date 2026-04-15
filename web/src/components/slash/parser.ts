/**
 * Parse a user-facing slash command string into a structured form
 * that mirrors what the backend expects.
 */

export type ParsedCompare = {
  kind: "compare";
  reference: string;
  translation_ids: string[];
};

export type ParsedPassage = {
  kind: "passage";
  reference: string;
  include_parallels: boolean;
  synthesize: boolean;
};

export type ParsedSlash = ParsedCompare | ParsedPassage;

const COMPARE_RE = /^\/compare\s+([A-Za-z]{3}\s+\d+:\d+(?:-\d+)?)\s+((?:[A-Za-z]+\s*)+)/i;
const PASSAGE_RE = /^\/passage\s+([A-Za-z]{3}\s+\d+:\d+(?:-\d+)?)(.*)/i;

export function parseSlashCommand(input: string): ParsedSlash | null {
  const stripped = input.trim();

  const compareMatch = COMPARE_RE.exec(stripped);
  if (compareMatch) {
    return {
      kind: "compare",
      reference: compareMatch[1].trim().toUpperCase(),
      translation_ids: compareMatch[2].trim().split(/\s+/).map((t) => t.toUpperCase()),
    };
  }

  const passageMatch = PASSAGE_RE.exec(stripped);
  if (passageMatch) {
    const flags = passageMatch[2].toLowerCase();
    return {
      kind: "passage",
      reference: passageMatch[1].trim().toUpperCase(),
      include_parallels: flags.includes("--parallels"),
      synthesize: flags.includes("--synthesize"),
    };
  }

  return null;
}
