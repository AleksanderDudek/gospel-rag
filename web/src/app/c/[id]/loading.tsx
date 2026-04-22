import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Skeleton className="h-4 w-44" />
      </header>

      {/* Message skeletons */}
      <div className="flex-1 overflow-hidden px-4 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          {/* User */}
          <div className="flex justify-end">
            <Skeleton className="h-10 w-[55%] rounded-2xl rounded-tr-sm" />
          </div>
          {/* Assistant */}
          <div className="flex justify-start">
            <div className="flex w-[72%] flex-col gap-2">
              <Skeleton className="h-3.5 w-full rounded" />
              <Skeleton className="h-3.5 w-[88%] rounded" />
              <Skeleton className="h-3.5 w-[65%] rounded" />
            </div>
          </div>
          {/* User */}
          <div className="flex justify-end">
            <Skeleton className="h-10 w-[42%] rounded-2xl rounded-tr-sm" />
          </div>
          {/* Assistant */}
          <div className="flex justify-start">
            <div className="flex w-[78%] flex-col gap-2">
              <Skeleton className="h-3.5 w-full rounded" />
              <Skeleton className="h-3.5 w-[92%] rounded" />
              <Skeleton className="h-3.5 w-[78%] rounded" />
              <Skeleton className="h-3.5 w-[55%] rounded" />
            </div>
          </div>
          {/* User */}
          <div className="flex justify-end">
            <Skeleton className="h-10 w-[60%] rounded-2xl rounded-tr-sm" />
          </div>
          {/* Assistant */}
          <div className="flex justify-start">
            <div className="flex w-[68%] flex-col gap-2">
              <Skeleton className="h-3.5 w-full rounded" />
              <Skeleton className="h-3.5 w-[74%] rounded" />
            </div>
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border bg-background px-4 py-3">
        <div className="mx-auto max-w-2xl">
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
