import type { Metadata } from 'next';
import { PublicShell } from '@/components/layout/PublicShell';
import { Reveal } from '@/components/packages/Reveal';
import { Card, Icon, SectionHead } from '@/components/ui';
import { CONTACT } from '@/content/contact';

/**
 * Contact.
 *
 * Phone numbers only, because phone numbers are what was given. No email
 * address, office or social account is invented to fill the page out — an
 * address nobody reads is worse than none, and a visitor who writes to it and
 * hears nothing is a visitor lost.
 */

export const metadata: Metadata = {
  title: 'Contact us',
  description:
    'Talk to Enhakkore about a trip, an experience, or supporting our community work. Reach us by phone in Tanzania or Malaysia.',
};

const REASONS = [
  {
    title: 'Trips and gateways',
    body: 'Ask about an upcoming departure, what a package covers, or whether places are still open.',
  },
  {
    title: 'Experiences and events',
    body: 'Ask about an event, or tell us about one you would like us to organise.',
  },
  {
    title: 'Supporting our impact work',
    body: 'Ask how to support community outreach. Contributions are handled separately from trip payments.',
  },
];

export default function ContactPage() {
  return (
    <PublicShell>
      <section className="section">
        <div className="shell max-w-4xl">
          <Reveal>
            <SectionHead
              eyebrow="Contact"
              title="Talk to us"
              description="Call or message any of the numbers below. Tell us which trip, event or project you are asking about and we will come back to you."
            />
          </Reveal>

          <Reveal delay={80}>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {CONTACT.phones.map((phone) => (
                <Card key={phone.dial} className="p-6">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                    {phone.label}
                  </p>
                  <a
                    href={`tel:${phone.dial}`}
                    className="mt-2 block font-mono text-[1.125rem] font-bold tracking-[0.02em] text-navy-700 underline-offset-4 hover:underline"
                  >
                    {phone.display}
                  </a>
                </Card>
              ))}
            </div>
          </Reveal>

          {CONTACT.email && (
            <Reveal delay={120}>
              <p className="mt-6 text-[0.9375rem]">
                Or email{' '}
                <a href={`mailto:${CONTACT.email}`} className="font-semibold text-acacia-700 underline">
                  {CONTACT.email}
                </a>
                .
              </p>
            </Reveal>
          )}

          <Reveal delay={130}>
            <div className="mt-8 flex flex-wrap gap-3">
              {CONTACT.social.map((account) => (
                <a
                  key={account.href}
                  href={account.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-line-strong bg-white px-4 py-2.5 text-[0.875rem] font-semibold text-ink transition-colors hover:border-ink"
                >
                  {account.handle}
                  <span className="text-[0.75rem] font-normal text-ink-muted">{account.label}</span>
                </a>
              ))}
              <a
                href={CONTACT.partnerSocial.href}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-dashed border-line-strong px-4 py-2.5 text-[0.875rem] font-semibold text-ink-muted transition-colors hover:border-ink hover:text-ink"
              >
                {CONTACT.partnerSocial.handle}
                <span className="text-[0.75rem] font-normal text-ink-faint">impact</span>
              </a>
            </div>
          </Reveal>

          <Reveal delay={140}>
            <div className="mt-12 grid gap-6 sm:grid-cols-3">
              {REASONS.map((reason) => (
                <div key={reason.title}>
                  <h2 className="flex items-center gap-2 text-[0.9375rem] font-bold tracking-tight">
                    <Icon.chat size={15} className="text-acacia-600" />
                    {reason.title}
                  </h2>
                  <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-muted">{reason.body}</p>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={200}>
            <p className="mt-12 border-t border-line pt-6 text-[0.8125rem] leading-relaxed text-ink-muted">
              Payments are never taken over the phone by anyone claiming to be from Enhakkore without a
              booking you have already made. Always confirm a trip and its payment instructions with the
              organiser before sending money.
            </p>
          </Reveal>
        </div>
      </section>
    </PublicShell>
  );
}
