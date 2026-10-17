import { Icon } from '@/components/ui';

/* ==========================================================================
   The two strips
   --------------------------------------------------------------------------
   Reassurance under the hero, and what the platform does near the foot. Both
   are four plain items with an icon — no cards, no shadows, no colour blocks.
   They are there to be scanned on the way past, not to be looked at.

   Each icon keeps one colour from the palette and keeps it everywhere: green
   for nature and impact, navy for people and trust, gold for what you do.
   ========================================================================== */

const TRUST = [
  {
    icon: <Icon.compass size={18} />,
    tone: 'text-safari-500',
    title: 'Breathtaking destinations',
    body: 'Tanzania and beyond',
  },
  {
    icon: <Icon.users size={18} />,
    tone: 'text-acacia-600',
    title: 'Travel with great people',
    body: 'Groups worth joining',
  },
  {
    icon: <Icon.heart size={18} />,
    tone: 'text-safari-500',
    title: 'Support real change',
    body: 'Work you can check',
  },
  {
    icon: <Icon.shield size={18} />,
    tone: 'text-acacia-600',
    title: 'Safe and straight with you',
    body: 'No surprises on price',
  },
];

export function TrustStrip() {
  return (
    <section className="border-b border-line bg-white">
      <div className="shell py-6 md:py-7">
        <ul className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
          {TRUST.map((item) => (
            <li key={item.title} className="flex items-start gap-3">
              <span className={`mt-0.5 shrink-0 ${item.tone}`}>{item.icon}</span>
              <span className="min-w-0">
                <span className="block text-[0.8125rem] font-bold leading-tight text-acacia-600 md:text-[0.875rem]">
                  {item.title}
                </span>
                <span className="mt-0.5 block text-[0.75rem] leading-tight text-ink-muted">{item.body}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const HOW = [
  {
    icon: <Icon.ticket size={20} />,
    title: 'Easy booking',
    body: 'Ask about a trip in a minute. A person answers, and confirms your place once payment is checked.',
  },
  {
    icon: <Icon.users size={20} />,
    title: 'Join a group',
    body: 'Travelling alone? Join a departure that is already going and meet the others before you leave.',
  },
  {
    icon: <Icon.heart size={20} />,
    title: 'Make an impact',
    body: 'Our community work is recorded as it happened — the day, the place, the photographs.',
  },
  {
    icon: <Icon.ripple size={20} />,
    title: 'Beyond Tanzania',
    body: 'We start here, where we know the ground. International departures follow.',
  },
];

export function HowStrip() {
  return (
    <section className="border-t border-line bg-sand">
      <div className="shell py-12 md:py-16">
        <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {HOW.map((item) => (
            <li key={item.title}>
              <span className="grid h-11 w-11 place-items-center rounded-[var(--radius-field)] bg-clay-100 text-clay-700">
                {item.icon}
              </span>
              <h3 className="mt-4 text-[1rem] font-bold tracking-tight text-acacia-600">{item.title}</h3>
              <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-muted">{item.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
