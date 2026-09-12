import { PublicShell } from '@/components/layout/PublicShell';
import { Skeleton, TripCardSkeleton } from '@/components/ui';

export default function Loading() {
  return (
    <PublicShell>
      <div className="border-b border-line bg-sand/50">
        <div className="shell py-10 md:py-14">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="mt-4 h-5 w-full max-w-xl" />
          <Skeleton className="mt-8 h-20 w-full" />
        </div>
      </div>

      <div className="shell py-8 md:py-10">
        <div className="grid gap-10 lg:grid-cols-[17rem_1fr] lg:gap-14">
          <div className="hidden space-y-6 lg:block">
            {[0, 1, 2, 3].map((index) => (
              <div key={index}>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-3 h-24 w-full" />
              </div>
            ))}
          </div>
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <TripCardSkeleton key={index} />
            ))}
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
