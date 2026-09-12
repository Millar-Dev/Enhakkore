import { PublicShell } from '@/components/layout/PublicShell';
import { Skeleton, TripCardSkeleton } from '@/components/ui';

export default function Loading() {
  return (
    <PublicShell>
      <div className="shell py-16">
        <Skeleton className="h-14 w-full max-w-2xl" />
        <Skeleton className="mt-5 h-6 w-full max-w-xl" />
        <div className="mt-12 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <TripCardSkeleton key={index} />
          ))}
        </div>
      </div>
    </PublicShell>
  );
}
