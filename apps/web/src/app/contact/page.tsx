import type { Metadata } from 'next';
import { PublicShell } from '@/components/layout/PublicShell';
import { EnquiryForm } from '@/components/public/Actions';
import { PageHero } from '@/components/public/Cards';
import { SocialIcon } from '@/components/site/SocialIcon';
import { getSite, waHref, waNumbers } from '@/lib/site';

export const metadata: Metadata = { title: 'Contact', description: 'WhatsApp, Instagram and TikTok — the ways to reach Enhakkore.' };

export default async function ContactPage() {
  const { settings } = await getSite();
  const numbers = waNumbers(settings);
  return (
    <PublicShell>
      <PageHero kicker="Contact" title="Talk to us" intro="WhatsApp is the quickest way to reach the team. Choose either number." />
      <section className="shell grid gap-10 py-12 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-5">
          {numbers.map((number, index) => (
            <div key={number.digits} className="rounded-[1.2rem] border border-line bg-white p-6">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-clay-600">{number.label}</p>
              <p className="mt-1 font-display text-3xl text-acacia-700">{number.display}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href={waHref(settings, 'general', null, index)} target="_blank" rel="noreferrer noopener" className="inline-flex h-11 items-center gap-2 rounded-full bg-[#1f9d55] px-5 text-sm font-bold text-white"><SocialIcon platform="whatsapp" size={18} /> WhatsApp</a>
                {number.calls && <a href={`tel:+${number.digits}`} className="inline-flex h-11 items-center rounded-full border border-line-strong bg-white px-5 text-sm font-semibold">Call</a>}
              </div>
            </div>
          ))}
          {settings.contact.emails.map((email) => <p key={email.address}><a href={`mailto:${email.address}`} className="font-semibold text-acacia-600">{email.label}: {email.address}</a></p>)}
          {settings.contact.address && <p className="text-ink-soft">{settings.contact.address}</p>}
          {settings.contact.hours && <p className="text-sm text-ink-muted">{settings.contact.hours}</p>}
          <div className="rounded-[1.2rem] border border-line bg-[color:var(--color-cream)] p-6">
            <p className="font-bold text-acacia-700">Follow us</p>
            <ul className="mt-3 grid gap-2">
              {settings.social.map((link) => (
                <li key={link.url}><a href={link.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-2 font-semibold text-acacia-600"><SocialIcon platform={link.platform} size={18} />{link.label} <span className="font-normal text-ink-muted">{link.handle}</span></a></li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-ink-muted">A WhatsApp message or enquiry is not a confirmed booking. We reply to confirm availability and details.</p>
        </div>
        <div className="rounded-[1.2rem] border border-line bg-white p-6">
          <EnquiryForm type="GENERAL" heading="Or send us a message" whatsappHref={waHref(settings, 'general')} />
        </div>
      </section>
    </PublicShell>
  );
}
