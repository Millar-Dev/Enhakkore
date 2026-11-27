import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/layout/PublicShell';
import { CopyButton } from '@/components/public/Actions';
import type { Project } from '@/components/public/impact';
import { WscLogo } from '@/components/site/BrandLogo';
import { SocialIcon } from '@/components/site/SocialIcon';
import { apiGet } from '@/lib/api';
import { getSite, waHref, waNumbers } from '@/lib/site';

export const metadata: Metadata = { title: 'Donate', description: 'Support Enhakkore Impact and its WSC — We Save Children initiative.' };
export const revalidate = 60;

/**
 * Donations by bank transfer. The account details are exactly those supplied
 * (and editable in Payment settings); nothing about the bank is added, and the
 * page never claims a transfer has been received — the team verifies each one.
 */
export default async function DonatePage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project: projectSlug } = await searchParams;
  const [{ settings, paymentMethods }, projects] = await Promise.all([getSite(), apiGet<Project[]>('/public/impact', 60)]);
  const accounts = paymentMethods.filter((method) => method.scopes.includes('DONATIONS'));
  const project = projects?.find((item) => item.slug === projectSlug);
  const numbers = waNumbers(settings);

  return (
    <PublicShell>
      <section className="bg-[color:var(--color-cream)]">
        <div className="shell py-14 md:py-20">
          <div className="flex items-center gap-4"><WscLogo src={settings.brand.wscLogoUrl} height={48} /><p className="kicker">Enhakkore Impact · WSC</p></div>
          <h1 className="display-xl mt-5 max-w-3xl text-acacia-700">Give to community outreach</h1>
          <p className="mt-5 max-w-2xl text-[1.0625rem] leading-relaxed text-ink-soft">{settings.impact.donationIntro}</p>
          {project && <p className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-acacia-700 ring-1 ring-line">Giving to: {project.title}</p>}
        </div>
      </section>

      <section className="shell grid gap-8 py-12 md:py-16 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <div className="rounded-[1.4rem] border-2 border-safari-500/30 bg-white p-6 md:p-8">
            <p className="kicker">Step 1 · Transfer</p>
            {accounts.length === 0 ? (
              <p className="mt-4 text-ink-soft">Donation details are being updated. Please message us on WhatsApp and we will share them.</p>
            ) : (
              accounts.map((account) => (
                <div key={account.id} className="mt-5">
                  <p className="font-display text-2xl text-acacia-700">{account.name}</p>
                  <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                    {account.accountName && (
                      <div className="rounded-xl bg-[color:var(--color-cream)] p-4">
                        <dt className="text-xs font-bold uppercase tracking-[0.12em] text-ink-muted">Account name</dt>
                        <dd className="mt-1 text-xl font-bold text-acacia-700">{account.accountName}</dd>
                      </div>
                    )}
                    {account.accountNumber && (
                      <div className="rounded-xl bg-[color:var(--color-cream)] p-4">
                        <dt className="text-xs font-bold uppercase tracking-[0.12em] text-ink-muted">Account number</dt>
                        <dd className="mt-1 flex flex-wrap items-center gap-3 font-mono text-xl font-bold text-acacia-700">
                          {account.accountNumber}
                          <CopyButton value={account.accountNumber} label="Copy number" />
                        </dd>
                      </div>
                    )}
                    {account.provider && <div className="text-sm text-ink-soft">Bank / provider: {account.provider}</div>}
                    {account.extraDetails && <div className="whitespace-pre-line text-sm text-ink-soft sm:col-span-2">{account.extraDetails}</div>}
                  </dl>
                  {account.instructions && <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink-soft">{account.instructions}</p>}
                  {account.referenceFormat && <p className="mt-2 text-sm text-ink-muted">Reference to use: {account.referenceFormat}</p>}
                </div>
              ))
            )}
            <p className="mt-5 text-sm text-ink-muted">Use a transfer method your bank supports. This site does not take card payments and cannot see your transfer.</p>
          </div>

          <div className="rounded-[1.4rem] border border-line bg-white p-6 md:p-8">
            <p className="kicker">Step 2 · Confirm</p>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">
              Send your payment confirmation (a screenshot or the transfer reference) to Enhakkore on WhatsApp. The team checks it against the account and records your donation. Until then it is not counted anywhere.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              {numbers.map((number, index) => (
                <a key={number.digits} href={waHref(settings, 'donation', null, index)} target="_blank" rel="noreferrer noopener" className={index === 0 ? 'inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#1f9d55] px-6 font-bold text-white' : 'inline-flex h-12 items-center justify-center gap-2 rounded-full border border-line-strong bg-white px-5 font-semibold text-acacia-700'}>
                  <SocialIcon platform="whatsapp" size={18} /> {index === 0 ? 'Send confirmation' : number.display}
                </a>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          {!settings.impact.donationAccountConfirmed && (
            <div className="rounded-[1.2rem] border border-[#f2e2c0] bg-[#fdf8ec] p-5 text-sm leading-relaxed text-ink-soft">
              <p className="font-bold text-warning">Before you give</p>
              <p className="mt-1">Please message us on WhatsApp first to confirm the current donation details and the project they go to. We confirm every donation personally.</p>
            </div>
          )}
          <div className="rounded-[1.2rem] border border-line bg-white p-5 text-sm leading-relaxed text-ink-soft">
            <p className="font-bold text-acacia-700">Where the money goes</p>
            <p className="mt-1">{settings.impact.donationUse}</p>
          </div>
          <div className="rounded-[1.2rem] border border-line bg-white p-5 text-sm leading-relaxed text-ink-soft">
            <p className="font-bold text-acacia-700">Who receives it</p>
            <p className="mt-1">Donations go to the account shown and are used for Enhakkore Impact’s community work, including WSC — We Save Children. They are recorded separately from Enhakkore’s business income.</p>
          </div>
          {(projects ?? []).length > 0 && (
            <div className="rounded-[1.2rem] border border-line bg-white p-5 text-sm">
              <p className="font-bold text-acacia-700">Projects</p>
              <ul className="mt-2 space-y-1.5">{projects!.map((item) => <li key={item.slug}><Link className="text-acacia-600 underline-offset-4 hover:underline" href={`/impact/${item.slug}`}>{item.title}</Link></li>)}</ul>
            </div>
          )}
        </aside>
      </section>
    </PublicShell>
  );
}
