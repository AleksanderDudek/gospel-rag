export interface SlashCommand {
  name: string;
  description: string;
  example: string;
  usage: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: "/compare",
    description: "Compare a passage across multiple translations side-by-side",
    example: "/compare MAT 5:3-12 KJV WEB YLT",
    usage: "/compare <BOOK CH:V[-V]> <TRANS1> <TRANS2> ...",
  },
  {
    name: "/passage",
    description: "Show a passage with optional cross-Gospel parallels and synthesis",
    example: "/passage MAT 14:13-21 --parallels --synthesize",
    usage: "/passage <BOOK CH:V[-V]> [--parallels] [--synthesize]",
  },
];

export function matchSlashCommand(input: string): SlashCommand | null {
  if (!input.startsWith("/")) return null;
  const lower = input.toLowerCase();
  return SLASH_COMMANDS.find((cmd) => lower.startsWith(cmd.name)) ?? null;
}
