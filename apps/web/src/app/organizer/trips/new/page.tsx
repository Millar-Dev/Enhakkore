'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { DestinationSummary, ImpactProjectSummary } from '@enhakkore/shared';
import { TRAVEL_STYLES, TRAVEL_STYLE_LABELS, TRIP_TYPES, TRIP_TYPE_LABELS } from '@enhakkore/shared';
import { DashboardShell, ORGANIZER_NAV } from '@/components/layout/DashboardShell';
import { Alert, Button, Card, Divider, Icon, cx } from '@/components/ui';
import { Input, Select, Textarea } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';

/**
 * Create-trip flow.
 *
 * Four steps, each one a thing an operator already has written down somewhere:
 * the basics, the day-by-day, what is in and out, and the dates. Saving a draft
 * is always available — a listing half-built should never be lost because the
 * publish validation failed.
 */

interface DayDraft {
  title: string;
  summary: string;
  activities: string;
  meals: string;
  accommodation: string;
}

interface DepartureDraft {
  startDate: string;
  endDate: string;
  capacity: string;
  price: string;
}

const STEPS = ['Basics', 'Itinerary', 'Inclusions', 'Dates & publish'] as const;

export default function CreateTripPage() {
  const router = useRouter();
  const { organizer } = useSession();

  const [step, setStep] = useState(0);
  const [destinations, setDestinations] = useState<DestinationSummary[]>([]);
  const [projects, setProjects] = useState<ImpactProjectSummary[]>([]);

  const [basics, setBasics] = useState({
    title: '',
    destinationId: '',
    summary: '',
    description: '',
    type: 'GROUP',
    style: 'COMFORT',
    durationDays: '3',
    durationNights: '2',
    basePrice: '',
    heroImage: '',
    gallery: '',
    tags: '',
    difficulty: '',
    minAge: '',
    impactProjectId: '',
  });

  const [days, setDays] = useState<DayDraft[]>([
    { title: '', summary: '', activities: '', meals: '', accommodation: '' },
  ]);
  const [includes, setIncludes] = useState('');
  const [excludes, setExcludes] = useState('');
  const [requirements, setRequirements] = useState('');
  const [departures, setDepartures] = useState<DepartureDraft[]>([
    { startDate: '', endDate: '', capacity: '16', price: '' },
  ]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      try {
        const [destinationResult, projectResult] = await Promise.all([
          api.get<{ items: DestinationSummary[] }>('/destinations', { token: null }),
          api.get<{ items: ImpactProjectSummary[] }>('/impact/projects?pageSize=20', { token: null }),
        ]);
        setDestinations(destinationResult.items);
        setProjects(projectResult.items);
      } catch {
        /* the form still works; the selects are simply empty */
      }
    })();
  }, []);

  // Keep nights in step with days as the operator types, without locking it —
  // some trips genuinely are 3 days / 3 nights.
  function setDays_(value: string) {
    const parsed = Number(value);
    setBasics((current) => ({
      ...current,
      durationDays: value,
      durationNights: Number.isFinite(parsed) && parsed > 0 ? String(parsed - 1) : current.durationNights,
    }));
    setDaysList(parsed);
  }

  function setDaysList(count: number) {
    if (!Number.isFinite(count) || count < 1 || count > 30) return;
    setDays((current) => {
      const next = [...current];
      while (next.length < count) {
        next.push({ title: '', summary: '', activities: '', meals: '', accommodation: '' });
      }
      return next.slice(0, count);
    });
  }

  function lines(value: string): string[] {
    return value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function commaList(value: string): string[] {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  async function save(submitForReview: boolean) {
    setBusy(true);
    setError(null);
    setFields({});

    try {
      const payload = {
        title: basics.title,
        destinationId: basics.destinationId,
        summary: basics.summary,
        description: basics.description,
        type: basics.type,
        style: basics.style,
        durationDays: Number(basics.durationDays),
        durationNights: Number(basics.durationNights),
        basePrice: Number(basics.basePrice.replace(/[^0-9]/g, '')),
        currency: 'TZS',
        heroImage: basics.heroImage,
        gallery: commaList(basics.gallery),
        tags: commaList(basics.tags),
        includes: lines(includes),
        excludes: lines(excludes),
        requirements: lines(requirements),
        difficulty: basics.difficulty || undefined,
        minAge: basics.minAge ? Number(basics.minAge) : undefined,
        impactProjectId: basics.impactProjectId || null,
        itinerary: days
          .filter((day) => day.title.trim())
          .map((day, index) => ({
            dayNumber: index + 1,
            title: day.title,
            summary: day.summary || undefined,
            activities: lines(day.activities),
            meals: commaList(day.meals),
            accommodation: day.accommodation || undefined,
          })),
        departures: departures
          .filter((departure) => departure.startDate && departure.endDate)
          .map((departure) => ({
            startDate: departure.startDate,
            endDate: departure.endDate,
            capacity: Number(departure.capacity),
            price: departure.price ? Number(departure.price.replace(/[^0-9]/g, '')) : null,
          })),
        submit: submitForReview,
      };

      const trip = await api.post<{ id: string }>('/organizers/me/trips', payload);
      router.push(`/organizer/trips/${trip.id}?created=1`);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFields(caught.fields);
        // Send the operator back to the step holding the first bad field.
        const bad = Object.keys(caught.fields)[0] ?? '';
        if (bad.startsWith('itinerary')) setStep(1);
        else if (['includes', 'excludes', 'requirements'].some((key) => bad.startsWith(key))) setStep(2);
        else if (bad.startsWith('departures')) setStep(3);
        else setStep(0);
      } else {
        setError('We could not save this trip. Check your connection and try again.');
      }
      setBusy(false);
    }
  }

  const canPublish = organizer?.verificationStatus === 'VERIFIED';

  return (
    <DashboardShell nav={ORGANIZER_NAV} allow={['ORGANIZER']} title="Create a trip">
      <div className="mx-auto max-w-3xl">
        {/* Progress */}
        <ol className="mb-8 flex gap-1">
          {STEPS.map((label, index) => (
            <li key={label} className="flex-1">
              <button
                type="button"
                onClick={() => setStep(index)}
                className="w-full text-left"
                aria-current={step === index ? 'step' : undefined}
              >
                <span
                  className={cx(
                    'block h-1 rounded-full transition-colors',
                    index <= step ? 'bg-ink' : 'bg-line',
                  )}
                />
                <span
                  className={cx(
                    'mt-2 block text-[0.75rem] font-semibold transition-colors',
                    index === step ? 'text-ink' : 'text-ink-faint',
                  )}
                >
                  {label}
                </span>
              </button>
            </li>
          ))}
        </ol>

        {error && (
          <Alert tone="danger" className="mb-6" title="We could not save this trip" role="alert">
            {error}
          </Alert>
        )}

        {!canPublish && (
          <Alert tone="neutral" className="mb-6">
            Your account is not verified yet, so this listing can be saved as a draft but not submitted for
            review. <a href="/organizer/verification" className="font-semibold underline">Complete verification</a>{' '}
            to publish.
          </Alert>
        )}

        {/* Step 1 — Basics */}
        {step === 0 && (
          <Card className="space-y-5 p-6 md:p-8">
            <h2 className="text-h3">The basics</h2>

            <Input
              label="Trip name"
              required
              value={basics.title}
              onChange={(event) => setBasics({ ...basics, title: event.target.value })}
              error={fields.title}
              placeholder="e.g. Mikumi Adventure"
            />

            <Select
              label="Destination"
              required
              value={basics.destinationId}
              onChange={(event) => setBasics({ ...basics, destinationId: event.target.value })}
              error={fields.destinationId}
            >
              <option value="">Choose a destination</option>
              {destinations.map((destination) => (
                <option key={destination.id} value={destination.id}>
                  {destination.name} — {destination.country}
                </option>
              ))}
            </Select>

            <Textarea
              label="Short summary"
              required
              maxLength={300}
              value={basics.summary}
              onChange={(event) => setBasics({ ...basics, summary: event.target.value })}
              error={fields.summary}
              placeholder="One or two sentences. This is what appears on the trip card."
              hint={`${basics.summary.length}/300`}
              className="min-h-20"
            />

            <Textarea
              label="Full description"
              required
              value={basics.description}
              onChange={(event) => setBasics({ ...basics, description: event.target.value })}
              error={fields.description}
              placeholder="What the trip is actually like. Who it suits, what the pace is, what makes it yours rather than anyone else's. Separate paragraphs with a blank line."
              className="min-h-48"
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <Select
                label="Trip type"
                value={basics.type}
                onChange={(event) => setBasics({ ...basics, type: event.target.value })}
              >
                {TRIP_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {TRIP_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
              <Select
                label="Travel style"
                value={basics.style}
                onChange={(event) => setBasics({ ...basics, style: event.target.value })}
              >
                {TRAVEL_STYLES.map((style) => (
                  <option key={style} value={style}>
                    {TRAVEL_STYLE_LABELS[style]}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              <Input
                label="Days"
                type="number"
                min={1}
                max={30}
                required
                value={basics.durationDays}
                onChange={(event) => setDays_(event.target.value)}
                error={fields.durationDays}
              />
              <Input
                label="Nights"
                type="number"
                min={0}
                max={30}
                required
                value={basics.durationNights}
                onChange={(event) => setBasics({ ...basics, durationNights: event.target.value })}
                error={fields.durationNights}
              />
              <Input
                label="Price per person (TZS)"
                inputMode="numeric"
                required
                value={basics.basePrice}
                onChange={(event) => setBasics({ ...basics, basePrice: event.target.value })}
                error={fields.basePrice}
                placeholder="450000"
              />
            </div>

            <Divider />

            <Input
              label="Cover image URL"
              required
              value={basics.heroImage}
              onChange={(event) => setBasics({ ...basics, heroImage: event.target.value })}
              error={fields.heroImage}
              placeholder="https://…"
              hint="Direct file upload is not connected in this build — paste a hosted image URL for now."
            />

            <Input
              label="Gallery image URLs"
              value={basics.gallery}
              onChange={(event) => setBasics({ ...basics, gallery: event.target.value })}
              placeholder="https://…, https://…"
              hint="Comma separated. Up to 12."
            />

            <div className="grid gap-5 sm:grid-cols-3">
              <Input
                label="Tags"
                value={basics.tags}
                onChange={(event) => setBasics({ ...basics, tags: event.target.value })}
                placeholder="First safari, Weekend"
                hint="Comma separated"
              />
              <Input
                label="Difficulty"
                value={basics.difficulty}
                onChange={(event) => setBasics({ ...basics, difficulty: event.target.value })}
                placeholder="Easy"
              />
              <Input
                label="Minimum age"
                type="number"
                min={0}
                max={99}
                value={basics.minAge}
                onChange={(event) => setBasics({ ...basics, minAge: event.target.value })}
                placeholder="8"
              />
            </div>

            <Select
              label="Link an impact project"
              value={basics.impactProjectId}
              onChange={(event) => setBasics({ ...basics, impactProjectId: event.target.value })}
              hint="Travellers can add a contribution to this project at checkout. Optional — and Enhakkore takes no commission on contributions."
            >
              <option value="">No linked project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title} — {project.location}
                </option>
              ))}
            </Select>
          </Card>
        )}

        {/* Step 2 — Itinerary */}
        {step === 1 && (
          <Card className="p-6 md:p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-h3">Day by day</h2>
              <p className="text-[0.8125rem] text-ink-muted">
                {days.length} {days.length === 1 ? 'day' : 'days'}
              </p>
            </div>
            <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-muted">
              This is the part travellers read most closely. Times, meals and where they sleep each night
              answer the questions you would otherwise get asked one by one.
            </p>

            <div className="mt-7 space-y-6">
              {days.map((day, index) => (
                <div key={index} className="rounded-[--radius-card] border border-line p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-[0.9375rem] font-bold tracking-tight">Day {index + 1}</h3>
                    {days.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setDays(days.filter((_, i) => i !== index))}
                        className="text-[0.8125rem] font-semibold text-danger hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    <Input
                      label="Title"
                      value={day.title}
                      onChange={(event) =>
                        setDays(days.map((d, i) => (i === index ? { ...d, title: event.target.value } : d)))
                      }
                      error={fields[`itinerary.${index}.title`]}
                      placeholder="Dar es Salaam → Mikumi"
                    />
                    <Textarea
                      label="Summary"
                      value={day.summary}
                      onChange={(event) =>
                        setDays(days.map((d, i) => (i === index ? { ...d, summary: event.target.value } : d)))
                      }
                      placeholder="One line on what the day feels like."
                      className="min-h-16"
                    />
                    <Textarea
                      label="Activities"
                      value={day.activities}
                      onChange={(event) =>
                        setDays(
                          days.map((d, i) => (i === index ? { ...d, activities: event.target.value } : d)),
                        )
                      }
                      placeholder={'06:00 — Depart Dar es Salaam\n11:30 — Lunch in Morogoro\n14:00 — Afternoon game drive'}
                      hint="One per line."
                      className="min-h-28"
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input
                        label="Meals"
                        value={day.meals}
                        onChange={(event) =>
                          setDays(days.map((d, i) => (i === index ? { ...d, meals: event.target.value } : d)))
                        }
                        placeholder="Lunch, Dinner"
                        hint="Comma separated"
                      />
                      <Input
                        label="Accommodation"
                        value={day.accommodation}
                        onChange={(event) =>
                          setDays(
                            days.map((d, i) =>
                              i === index ? { ...d, accommodation: event.target.value } : d,
                            ),
                          )
                        }
                        placeholder="Lodge on the park boundary"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="secondary"
              className="mt-6"
              onClick={() =>
                setDays([...days, { title: '', summary: '', activities: '', meals: '', accommodation: '' }])
              }
            >
              <Icon.plus />
              Add a day
            </Button>
          </Card>
        )}

        {/* Step 3 — Inclusions */}
        {step === 2 && (
          <Card className="space-y-6 p-6 md:p-8">
            <h2 className="text-h3">What is and is not included</h2>
            <p className="text-[0.875rem] leading-relaxed text-ink-muted">
              Being specific here prevents most disputes. Say what is not included as plainly as what is.
            </p>

            <Textarea
              label="What's included"
              value={includes}
              onChange={(event) => setIncludes(event.target.value)}
              placeholder={'Return transport from Dar es Salaam\nTwo nights lodge accommodation, shared twin\nAll meals\nPark entry and conservation fees\nEnglish and Swahili speaking guide'}
              hint="One per line."
              className="min-h-36"
            />

            <Textarea
              label="What's not included"
              value={excludes}
              onChange={(event) => setExcludes(event.target.value)}
              placeholder={'Alcoholic drinks\nPersonal items and souvenirs\nTips for guides and drivers\nTravel insurance'}
              hint="One per line."
              className="min-h-28"
            />

            <Textarea
              label="Before you travel"
              value={requirements}
              onChange={(event) => setRequirements(event.target.value)}
              placeholder={'Valid national ID or passport\nComfortable closed shoes and a warm layer\nAny personal medication, clearly labelled'}
              hint="One per line. Visas, fitness, gear, vaccinations — anything a traveller must sort out themselves."
              className="min-h-28"
            />
          </Card>
        )}

        {/* Step 4 — Dates */}
        {step === 3 && (
          <Card className="p-6 md:p-8">
            <h2 className="text-h3">Departure dates</h2>
            <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-muted">
              Each date is a separate departure with its own capacity and, if you want, its own price. A
              listing with no dates can still be published as a private trip that travellers request.
            </p>

            <div className="mt-7 space-y-4">
              {departures.map((departure, index) => (
                <div
                  key={index}
                  className="grid items-end gap-4 rounded-[--radius-card] border border-line p-5 sm:grid-cols-4"
                >
                  <Input
                    label="Departs"
                    type="date"
                    value={departure.startDate}
                    onChange={(event) =>
                      setDepartures(
                        departures.map((d, i) =>
                          i === index ? { ...d, startDate: event.target.value } : d,
                        ),
                      )
                    }
                  />
                  <Input
                    label="Returns"
                    type="date"
                    value={departure.endDate}
                    onChange={(event) =>
                      setDepartures(
                        departures.map((d, i) => (i === index ? { ...d, endDate: event.target.value } : d)),
                      )
                    }
                  />
                  <Input
                    label="Capacity"
                    type="number"
                    min={1}
                    max={200}
                    value={departure.capacity}
                    onChange={(event) =>
                      setDepartures(
                        departures.map((d, i) =>
                          i === index ? { ...d, capacity: event.target.value } : d,
                        ),
                      )
                    }
                  />
                  <div className="flex items-end gap-2">
                    <Input
                      label="Price override"
                      inputMode="numeric"
                      value={departure.price}
                      onChange={(event) =>
                        setDepartures(
                          departures.map((d, i) =>
                            i === index ? { ...d, price: event.target.value } : d,
                          ),
                        )
                      }
                      placeholder="Optional"
                      containerClassName="flex-1"
                    />
                    {departures.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setDepartures(departures.filter((_, i) => i !== index))}
                        aria-label={`Remove departure ${index + 1}`}
                        className="mb-0.5 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[--radius-field] border border-line-strong text-ink-muted hover:border-danger hover:text-danger"
                      >
                        <Icon.close />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="secondary"
              className="mt-5"
              onClick={() =>
                setDepartures([...departures, { startDate: '', endDate: '', capacity: '16', price: '' }])
              }
            >
              <Icon.plus />
              Add a departure
            </Button>

            <Divider className="my-8" />

            <Alert tone="neutral">
              Submitting sends this listing to the Enhakkore team for review. We check the itinerary,
              pricing and inclusions before it goes live — usually within two working days. You can keep
              editing while it waits.
            </Alert>
          </Card>
        )}

        {/* Navigation */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            {step > 0 && (
              <Button type="button" variant="secondary" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="ghost" onClick={() => void save(false)} disabled={busy}>
              Save as draft
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={() => setStep(step + 1)}>
                Continue
                <Icon.arrow />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => void save(true)}
                disabled={busy || !canPublish}
                title={canPublish ? undefined : 'Complete verification first'}
              >
                {busy ? 'Submitting…' : 'Submit for review'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
