export function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "Previous 7 days";
  return "Older";
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatCost(usd: number | null | undefined): string {
  if (usd == null) return "";
  if (usd < 0.001) return "<$0.001";
  return `$${usd.toFixed(4)}`;
}

export function groupByDate<T extends { updated_at: string }>(
  items: T[],
): Array<{ label: string; items: T[] }> {
  const groups: Map<string, T[]> = new Map();

  for (const item of items) {
    const label = formatDate(item.updated_at);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(item);
  }

  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}
