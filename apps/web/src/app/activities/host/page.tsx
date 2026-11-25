import type { Metadata } from 'next';
import { PublicShell } from '@/components/layout/PublicShell';
import { SocialIcon } from '@/components/site/SocialIcon';
import { getSite, waHref, waNumbers } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Host an activity',
  description: 'Organise a run, a game, a hike or a gaming night and invite others. Submitting is free; every activity is reviewed before it is published.',
};

const STEPS = [
  ['Message us on WhatsApp', 'Tap the button below. The message is written for you — just send it.'],
  ['Get the requirements', 'We reply with what we need: what, where, when, how many people, any cost or equipment.'],
  ['Send the details', 'Share your activity’s information and a photo if you have one.'],
  ['We review it', 'The team checks every activity before it goes live — including that it meets in a public place.'],
  ['It goes live', 'Your activity is published on Enhakkore, and people can ask to join.'],
  ['People join', 'You (or the team) approve requests, and approved participants get the details.'],
];

export default async function HostPage() {
  const { settings } = await getSite();
  const numbers = waNumbers(settings);
  return (
    <PublicShell>
      <section className="bg-acacia-600 text-white">
        <div className="shell grid gap-10 py-14 md:py-24 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <p className="kicker !text-clay-400">Community activities</p>
            <h1 className="display-xl mt-4">Host an activity</h1>
            <p className="mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-white/80">
              Basketball on Saturday, a 5k before work, an FC tournament, a hike, a cooking night — organise it and invite others. Submitting an activity is free.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {numbers.map((number, index) => (
                <a
                  key={number.digits}
                  href={waHref(settings, 'activityHost', null, index)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={
                    index === 0
                      ? 'inline-flex h-14 items-center justify-center gap-3 rounded-full bg-[#1f9d55] px-7 text-[1rem] font-bold text-white shadow-lg transition hover:brightness-110'
                      : 'inline-flex h-14 items-center justify-center gap-3 rounded-full border border-white/30 px-6 font-semibold text-white hover:bg-white/10'
                  }
                >
                  <SocialIcon platform="whatsapp" size={22} />
                  {index === 0 ? 'Submit on WhatsApp' : `Or ${number.display}`}
                </a>
              ))}
            </div>
            <p className="mt-4 text-sm text-white/60">Activities are reviewed before publication. Submitting does not guarantee it will be published.</p>
          </div>
          <div className="rounded-[1.4rem] bg-white/5 p-6 ring-1 ring-white/10">
            <p className="font-display text-2xl">How it works</p>
            <ol className="mt-5 space-y-4">
              {STEPS.map(([title, body], index) => (
                <li key={title} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-clay-400 text-sm font-bold text-acacia-700">{index + 1}</span>
                  <div>
                    <p className="font-semibold">{title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-white/70">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
      <section className="shell py-14">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-[1.1rem] border border-line bg-[color:var(--color-cream)] p-6">
            <p className="font-display text-2xl text-acacia-700">What to have ready</p>
            <ul className="mt-4 list-disc space-y-1.5 pl-5 text-[0.9375rem] text-ink-soft">
              <li>The activity, and its category (e.g. Basketball, Running, PlayStation)</li>
              <li>Country, city and a public meeting place — or the platform, if online</li>
              <li>Date, time and how long it lasts</li>
              <li>How many people can join, and the experience level</li>
              <li>Equipment needed, and the price if there is one</li>
              <li>Your name as organiser, and a photo if you have one</li>
            </ul>
          </div>
          <div className="rounded-[1.1rem] border border-line bg-white p-6">
            <p className="font-display text-2xl text-acacia-700">Safety first</p>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">{settings.legal.safety}</p>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
