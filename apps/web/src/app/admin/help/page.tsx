import type { Metadata } from 'next';
import { AdminShell, Panel } from '@/components/admin/AdminShell';
import { readManual, renderManual } from '@/lib/manual';

export const metadata: Metadata = { title: 'Help & manual', robots: { index: false, follow: false } };
export const dynamic = 'force-static';


/** The Admin User Manual, rendered from docs/ADMIN-MANUAL.md at build time. */
export default function AdminHelpPage() {
  const { html, toc } = renderManual(readManual());
  return (
    <AdminShell
      title="Help & manual"
      actions={
        <a href="/manual/Enhakkore-Admin-Manual.pdf" download className="inline-flex h-10 items-center rounded-full bg-acacia-600 px-4 text-sm font-bold text-white">
          Download PDF
        </a>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <nav aria-label="Manual contents" className="lg:sticky lg:top-20 lg:self-start">
          <details className="rounded-2xl border border-line bg-white p-3" open>
            <summary className="cursor-pointer text-sm font-bold text-acacia-700">Contents</summary>
            <ol className="mt-2 grid gap-1 text-sm">
              {toc.map((item) => (
                <li key={item.id}>
                  <a href={`#${item.id}`} className="flex min-h-10 items-center rounded-lg px-2 py-1 text-ink-soft hover:bg-sand-50 hover:text-acacia-700">{item.title}</a>
                </li>
              ))}
            </ol>
          </details>
        </nav>
        <Panel>
          <article className="manual" dangerouslySetInnerHTML={{ __html: html }} />
        </Panel>
      </div>
    </AdminShell>
  );
}
