import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/layout/PublicShell';
import { PageHero } from '@/components/public/Cards';
import { PublishActivityForm } from '@/components/public/PublishActivityForm';
import { SocialIcon } from '@/components/site/SocialIcon';
import { getCatalogue } from '@/lib/public';
import { getSite, waHref } from '@/lib/site';

export const metadata: Metadata = { title: 'Create an experience', description: 'Submit your activity or event to Enhakkore. Every submission is reviewed before it is published.' };

export default async function PublishPage() {
  const [{ settings }, catalogue] = await Promise.all([getSite(), getCatalogue()]);
  const categories = catalogue.categories.filter((item) => item.kind === 'ACTIVITY' || item.kind === 'EVENT').map((item) => ({ id: item.id, name: item.name, group: item.group ?? null }));
  return (
    <PublicShell>
      <PageHero kicker="Host & Organise" title="Create an experience" intro="Small, free, low-risk activities can be hosted by any member once approved. Large, paid or higher-risk events need enhanced approval and organiser verification." />
      <section className="shell grid gap-8 py-10 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-[1.4rem] border border-line bg-white p-5 md:p-8">
          <PublishActivityForm categories={categories} />
        </div>
        <aside className="space-y-4">
          <div className="rounded-[1.2rem] border border-line bg-[color:var(--color-cream)] p-5 text-sm leading-relaxed text-ink-soft">
            <p className="font-bold text-acacia-700">How review works</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>You submit — it is saved as “Pending review”, visible only to you and the team.</li>
              <li>The team checks the details, and may contact you.</li>
              <li>Once approved it is published, and you can approve participants from My account → Hosting.</li>
            </ol>
          </div>
          <a href={waHref(settings, 'activityHost')} target="_blank" rel="noreferrer noopener" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1f9d55] font-bold text-white">
            <SocialIcon platform="whatsapp" size={18} /> Prefer WhatsApp? Host an activity
          </a>
          <p className="text-xs text-ink-muted">Read the <Link href="/legal/activityRules" className="underline">event and activity rules</Link> first.</p>
        </aside>
      </section>
    </PublicShell>
  );
}
