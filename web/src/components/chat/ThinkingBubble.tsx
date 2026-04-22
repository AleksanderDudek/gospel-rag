export function ThinkingBubble() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl rounded-tl-sm bg-card px-4 py-3.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:-300ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:-150ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40" />
        </div>
      </div>
    </div>
  );
}
