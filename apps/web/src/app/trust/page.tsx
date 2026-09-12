import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/layout/PublicShell';
import { Alert, Card, Eyebrow, Icon, SectionHead } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Trust & safety',
  description:
    'How operators are verified, how reviews work, how trip groups stay private, and what this pre-launch build does and does not do.',
};

const SECTIONS = [
  {
    title: 'Operator verification',
    body: [
      'Every company listing trips on Enhakkore submits their certificate of incorporation, a current tour operator licence for the country they work in, a tax identification certificate and a contact number. A member of the Enhakkore team reviews all of it and calls that number.',
      'There is no automatic approval and no self-service path to a badge. The "Verified operator" mark appears only after a person has approved that specific account, and it disappears the moment an account is suspended.',
    ],
  },
  {
    title: 'Listing review',
    body: [
      'Verification covers the company. Each individual trip is read separately before it publishes — the itinerary against the price, whether inclusions and exclusions are specific enough to hold anyone to, and whether the imagery is the operator’s to use.',
      'Editing a published listing sends it back for review before the changes go live. Adding a new date to an existing trip does not.',
    ],
  },
  {
    title: 'Reviews',
    body: [
      'A review on Enhakkore must be attached to a booking that was completed. The database enforces one review per booking, and there is no route in the application that creates a review without one.',
      'This means new listings have no reviews for a while, and popular ones have fewer than you might expect on a site that lets anyone post. That is the trade-off, and it is deliberate.',
    ],
  },
  {
    title: 'Trip groups',
    body: [
      'Each departure has one private group. Membership comes from a confirmed booking on that specific departure, plus the organizer running it.',
      'Requesting a group you are not in returns the same response as a group that does not exist, so it is not possible to discover who is travelling where. Administrators can read groups for moderation but cannot post into them.',
    ],
  },
  {
    title: 'Your data',
    body: [
      'Other travellers in your group see your name, your photo if you set one and your country. They do not see your email, your phone number or anything else on your account.',
      'The operator running your trip sees the traveller names on your booking and anything you told them at checkout. Nothing you write in a booking note reaches anyone else.',
      'Passwords are stored as bcrypt hashes and are never recoverable, only resettable.',
    ],
  },
  {
    title: 'Payments',
    body: [
      'Enhakkore does not collect or store card numbers, bank credentials or mobile money PINs. When a payment provider is connected, card entry happens in that provider’s own hosted flow and the platform only ever stores a reference.',
      'Commission is charged on the travel value of a booking. Impact contributions are excluded from that base entirely.',
    ],
  },
  {
    title: 'Impact contributions',
    body: [
      'Every contribution goes to one named project with a stated goal and a public running total. There is no general fund.',
      'Each project publishes dated updates describing what has actually been done, and everyone who contributed is notified when one goes up.',
      'The allocation shown on a project page is the plan agreed before work began. Where actual spend differs, the updates say so.',
    ],
  },
];

export default function TrustPage() {
  return (
    <PublicShell>
      <div className="border-b border-line bg-sand/50">
        <div className="shell py-14 md:py-20">
          <Eyebrow>Trust &amp; safety</Eyebrow>
          <h1 className="mt-4 max-w-3xl text-h1 text-balance">
            What we check, what we do not, and what this build actually does
          </h1>
          <p className="mt-5 max-w-2xl text-[1.0625rem] leading-relaxed text-ink-muted">
            A platform that asks for money and trust should be able to say exactly what stands behind both.
          </p>
        </div>
      </div>

      {/* The most important thing on the page */}
      <div className="shell pt-10">
        <Alert tone="neutral" title="This is a pre-launch build">
          <p className="mt-1">
            Enhakkore is not operating commercially yet. Every trip, operator, impact project, review and
            contribution total currently on the site is demonstration content created for development and
            design review.
          </p>
          <ul className="mt-3 space-y-1.5">
            <li>· No payment provider is connected. Transactions are simulated in-process.</li>
            <li>· No company has been through a real verification check.</li>
            <li>· No funds have been raised, held or disbursed to any project.</li>
            <li>· No independent audit of anything has taken place.</li>
          </ul>
          <p className="mt-3">
            The processes described below are how the platform is built to work and what live operation will
            be held to — not a description of activity that has already happened.
          </p>
        </Alert>
      </div>

      <section className="section">
        <div className="shell">
          <SectionHead eyebrow="How it works" title="The mechanics" />

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {SECTIONS.map((section) => (
              <Card key={section.title} className="p-6 md:p-8">
                <h2 className="text-h3">{section.title}</h2>
                <div className="prose-body mt-4 text-[0.9375rem]">
                  {section.body.map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="section-tight bg-sand">
        <div className="shell">
          <Card className="p-7 md:p-9">
            <h2 className="text-h3">Reporting a problem</h2>
            <p className="mt-3 max-w-2xl text-[0.9375rem] leading-relaxed text-ink-muted">
              If something on the platform looks wrong — a listing that misrepresents a trip, an operator
              behaving badly, a review that does not look genuine, or a project whose updates do not add up —
              tell us. We would rather hear it than not.
            </p>
            <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-[0.9375rem]">
              <a
                href="mailto:support@enhakkore.com"
                className="inline-flex items-center gap-2 font-semibold text-acacia-700 hover:underline"
              >
                <Icon.chat size={16} />
                support@enhakkore.com
              </a>
              <a
                href="mailto:verify@enhakkore.com"
                className="inline-flex items-center gap-2 font-semibold text-acacia-700 hover:underline"
              >
                <Icon.shield size={16} />
                verify@enhakkore.com
              </a>
            </div>
            <p className="mt-6 text-[0.8125rem] text-ink-faint">
              See also our{' '}
              <Link href="/legal/terms" className="underline hover:text-ink">
                terms
              </Link>{' '}
              and{' '}
              <Link href="/legal/privacy" className="underline hover:text-ink">
                privacy policy
              </Link>
              .
            </p>
          </Card>
        </div>
      </section>
    </PublicShell>
  );
}
