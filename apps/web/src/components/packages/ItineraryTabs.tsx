'use client';

import { useState } from 'react';
import { ARUSHA } from '@/content/arusha';
import { Icon, cx } from '@/components/ui';

/**
 * The three days, one at a time.
 *
 * A tab list rather than three stacked blocks: the whole weekend is legible at
 * a glance, and choosing a day is how most people read an itinerary — "what
 * are we actually doing on Saturday?". Keyboard support is the standard tab
 * pattern, arrows included, because a list of buttons that only works with a
 * mouse is not a tab list.
 */
export function ItineraryTabs() {
  const days = ARUSHA.itinerary;
  const [active, setActive] = useState(0);

  function onKeyDown(event: React.KeyboardEvent) {
    const last = days.length - 1;
    if (event.key === 'ArrowRight') setActive((i) => (i === last ? 0 : i + 1));
    else if (event.key === 'ArrowLeft') setActive((i) => (i === 0 ? last : i - 1));
    else if (event.key === 'Home') setActive(0);
    else if (event.key === 'End') setActive(last);
    else return;
    event.preventDefault();
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Itinerary by day"
        onKeyDown={onKeyDown}
        className="flex gap-2 overflow-x-auto pb-1 no-scrollbar"
      >
        {days.map((day, index) => {
          const selected = index === active;
          return (
            <button
              key={day.day}
              role="tab"
              type="button"
              id={`day-tab-${index}`}
              aria-selected={selected}
              aria-controls={`day-panel-${index}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(index)}
              className={cx(
                'shrink-0 rounded-[var(--radius-pill)] border px-5 py-3 text-left transition-all duration-200',
                'focus:outline-none focus-visible:ring-4 focus-visible:ring-gold-500/25',
                selected
                  ? 'border-navy-700 bg-navy-700 text-white shadow-sm'
                  : 'border-line-strong bg-white text-ink hover:-translate-y-0.5 hover:border-navy-500',
              )}
            >
              <span className="block text-[0.9375rem] font-bold leading-none">{day.day}</span>
              <span
                className={cx(
                  'mt-1 block text-[0.75rem] leading-none',
                  selected ? 'text-white/70' : 'text-ink-muted',
                )}
              >
                {day.date}
              </span>
            </button>
          );
        })}
      </div>

      {days.map((day, index) => (
        <div
          key={day.day}
          role="tabpanel"
          id={`day-panel-${index}`}
          aria-labelledby={`day-tab-${index}`}
          hidden={index !== active}
          className="mt-6"
        >
          <h3 className="text-[1.25rem] font-bold tracking-tight md:text-[1.5rem]">{day.title}</h3>
          <p className="mt-2 max-w-2xl text-[0.9375rem] leading-relaxed text-ink-muted">{day.summary}</p>

          <ol className="mt-7 space-y-0">
            {day.stops.map((stop, stopIndex) => (
              <li key={stop.name} className="relative flex gap-5 pb-7 last:pb-0">
                {/* The thread running down the day. */}
                {stopIndex < day.stops.length - 1 && (
                  <span aria-hidden className="absolute left-[11px] top-7 bottom-0 w-px bg-line-strong" />
                )}
                <span
                  aria-hidden
                  className="relative z-10 mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-gold-500 bg-white text-[0.625rem] font-bold text-navy-700"
                >
                  {stopIndex + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[1rem] font-bold leading-snug tracking-tight">{stop.name}</p>
                  <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-muted">{stop.detail}</p>
                  {'provisional' in stop && stop.provisional && (
                    <p className="mt-2 inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-warning/10 px-3 py-1 text-[0.75rem] font-medium text-warning">
                      <Icon.shield size={12} />
                      {'provisionalNote' in stop ? stop.provisionalNote : 'Subject to confirmation'}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
