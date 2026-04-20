export default function Loading() {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center gap-4">
      <div className="animate-heartbeat">
        <svg
          viewBox="0 0 40 58"
          className="h-16 w-11 fill-primary drop-shadow-[0_0_12px_hsl(var(--primary)/0.5)]"
          aria-label="Loading"
          role="img"
        >
          {/* Vertical bar */}
          <rect x="15" y="0" width="10" height="58" rx="3" />
          {/* Horizontal bar */}
          <rect x="0" y="14" width="40" height="10" rx="3" />
        </svg>
      </div>
      <p className="text-xs text-muted-foreground tracking-widest uppercase">
        Loading
      </p>
    </div>
  );
}
