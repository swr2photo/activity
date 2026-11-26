import { Skeleton } from '@/components/ui/skeleton';

/** โครงหน้าแอดมินระหว่างโหลด — หน้าตาตรงกับ AdminLayout จริง เพื่อไม่ให้ layout กระโดด */
export default function AdminShellSkeleton() {
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[hsl(var(--background))]" aria-busy="true" aria-label="กำลังโหลด">
      <aside className="fixed left-0 top-0 hidden h-screen w-[272px] flex-col gap-4 border-r border-white/[0.06] bg-[#060b17] p-4 md:flex">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-blink rounded-xl bg-brand-gradient" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-24 rounded bg-white/10" />
            <div className="h-2.5 w-32 rounded bg-white/[0.06]" />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
              <div className="h-8 w-8 rounded-lg bg-white/[0.06]" />
              <div className="h-3 flex-1 rounded bg-white/[0.06]" />
            </div>
          ))}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col md:ml-[272px]">
        <div className="flex h-14 items-center gap-3 border-b border-slate-200/70 bg-white/80 px-4 sm:h-16 dark:border-white/[0.06] dark:bg-transparent">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-5 w-40 rounded-lg" />
          <div className="flex-1" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-8">
          <Skeleton className="h-40 w-full rounded-3xl" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 rounded-3xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Skeleton className="h-72 rounded-3xl" />
            <Skeleton className="h-72 rounded-3xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
