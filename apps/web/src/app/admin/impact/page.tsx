'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { ImpactProjectSummary, Paginated } from '@enhakkore/shared';
import { IMPACT_CATEGORIES, IMPACT_CATEGORY_LABELS } from '@enhakkore/shared';
import { DashboardShell, ADMIN_NAV } from '@/components/layout/DashboardShell';
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  Icon,
  Progress,
  Skeleton,
  cx,
} from '@/components/ui';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api';
import { price } from '@/lib/format';

/**
 * Impact administration.
 *
 * Two jobs live here: creating projects, and publishing the updates that make
 * the transparency promise real. Publishing an update notifies everyone who
 * contributed, which is why it is one click away rather than buried.
 */
export default function AdminImpactPage() {
  const [projects, setProjects] = useState<ImpactProjectSummary[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    title: '',
    category: 'EDUCATION',
    summary: '',
    description: '',
    location: '',
    country: 'Tanzania',
    goal: '',
    heroImage: '',
    beneficiaries: '',
    partnerName: '',
    status: 'DRAFT',
  });

  const [update, setUpdate] = useState({ title: '', body: '', images: '', milestone: false });

  const load = useCallback(async () => {
    setProjects(null);
    try {
      const result = await api.get<Paginated<ImpactProjectSummary>>('/admin/impact/projects?pageSize=50');
      setProjects(result.items);
    } catch {
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createProject(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/admin/impact/projects', {
        title: form.title,
        category: form.category,
        summary: form.summary,
        description: form.description,
        location: form.location,
        country: form.country,
        goal: Number(form.goal.replace(/[^0-9]/g, '')),
        currency: 'TZS',
        heroImage: form.heroImage,
        beneficiaries: form.beneficiaries ? Number(form.beneficiaries) : undefined,
        partnerName: form.partnerName || undefined,
        status: form.status,
        allocation: [],
      });
      setNotice('Project created.');
      setCreating(false);
      setForm({ ...form, title: '', summary: '', description: '', location: '', goal: '', heroImage: '' });
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'We could not create that project.');
    } finally {
      setBusy(false);
    }
  }

  async function publishUpdate(projectId: string) {
    if (!update.title.trim() || !update.body.trim()) {
      setError('An update needs a title and a body.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post(`/admin/impact/projects/${projectId}/updates`, {
        title: update.title,
        body: update.body,
        images: update.images
          .split(',')
          .map((image) => image.trim())
          .filter(Boolean),
        milestone: update.milestone,
        published: true,
      });
      setNotice('Update published. Everyone who contributed has been notified.');
      setUpdate({ title: '', body: '', images: '', milestone: false });
      setUpdatingId(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'We could not publish that update.');
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(project: ImpactProjectSummary, status: string) {
    setBusy(true);
    try {
      await api.patch(`/admin/impact/projects/${project.id}`, { status });
      setNotice(`${project.title} set to ${status.toLowerCase()}.`);
      await load();
    } catch {
      setError('We could not change that status.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardShell
      nav={ADMIN_NAV}
      allow={['ADMIN']}
      title="Impact projects"
      wide
      action={
        <Button onClick={() => setCreating((open) => !open)}>
          <Icon.plus />
          {creating ? 'Close' : 'New project'}
        </Button>
      }
    >
      {notice && (
        <Alert tone="success" className="mb-6">
          {notice}
        </Alert>
      )}
      {error && (
        <Alert tone="danger" className="mb-6" role="alert">
          {error}
        </Alert>
      )}

      <Alert tone="neutral" className="mb-6">
        Publish a project only once it has a named location, a committee or partner accountable for
        delivery, and a costed goal. Everything on a project page is a public commitment.
      </Alert>

      {creating && (
        <Card className="mb-8 p-6 md:p-8">
          <h2 className="text-h3">New project</h2>
          <form onSubmit={createProject} className="mt-6 space-y-5">
            <Input
              label="Title"
              required
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="Classroom Block — Morogoro"
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <Select
                label="Category"
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
              >
                {IMPACT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {IMPACT_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </Select>
              <Select
                label="Status"
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value })}
              >
                <option value="DRAFT">Draft — not public</option>
                <option value="ACTIVE">Active — taking contributions</option>
                <option value="PAUSED">Paused</option>
              </Select>
            </div>

            <Textarea
              label="Summary"
              required
              maxLength={300}
              value={form.summary}
              onChange={(event) => setForm({ ...form, summary: event.target.value })}
              placeholder="One or two sentences. This appears on the project card."
              className="min-h-20"
            />

            <Textarea
              label="Full description"
              required
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="What the situation is, what this funds, who delivers it, and how the money is released."
              className="min-h-40"
            />

            <div className="grid gap-5 sm:grid-cols-3">
              <Input
                label="Location"
                required
                value={form.location}
                onChange={(event) => setForm({ ...form, location: event.target.value })}
                placeholder="Morogoro"
              />
              <Input
                label="Country"
                value={form.country}
                onChange={(event) => setForm({ ...form, country: event.target.value })}
              />
              <Input
                label="Goal (TZS)"
                inputMode="numeric"
                required
                value={form.goal}
                onChange={(event) => setForm({ ...form, goal: event.target.value })}
                placeholder="15000000"
              />
            </div>

            <Input
              label="Cover image URL"
              required
              value={form.heroImage}
              onChange={(event) => setForm({ ...form, heroImage: event.target.value })}
              placeholder="https://…"
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <Input
                label="People reached (planned)"
                type="number"
                value={form.beneficiaries}
                onChange={(event) => setForm({ ...form, beneficiaries: event.target.value })}
                hint="A stated plan, not a claim of results."
              />
              <Input
                label="Implementing partner"
                value={form.partnerName}
                onChange={(event) => setForm({ ...form, partnerName: event.target.value })}
                placeholder="Leave blank until a partnership is documented"
              />
            </div>

            <Button type="submit" disabled={busy}>
              {busy ? 'Creating…' : 'Create project'}
            </Button>
          </form>
        </Card>
      )}

      {projects === null ? (
        <div className="space-y-4">
          {[0, 1].map((index) => (
            <Skeleton key={index} className="h-40 w-full" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<Icon.ripple size={34} />}
          title="No projects yet"
          description="Create the first impact project. Nothing appears on the public impact pages until a project is set to active."
          action={<Button onClick={() => setCreating(true)}>New project</Button>}
        />
      ) : (
        <div className="space-y-5">
          {projects.map((project) => (
            <Card key={project.id} className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="impact">{IMPACT_CATEGORY_LABELS[project.category]}</Badge>
                    <Badge
                      tone={
                        project.status === 'ACTIVE'
                          ? 'success'
                          : project.status === 'COMPLETED'
                            ? 'brand'
                            : 'neutral'
                      }
                    >
                      {project.status.toLowerCase()}
                    </Badge>
                    {project.isDemo && <Badge tone="neutral">Demo</Badge>}
                  </div>
                  <h2 className="mt-2.5 text-h3">{project.title}</h2>
                  <p className="mt-1 text-[0.875rem] text-ink-muted">
                    {project.location}, {project.country}
                  </p>
                </div>

                <Link
                  href={`/impact/${project.slug}`}
                  target="_blank"
                  className="shrink-0 text-[0.8125rem] font-semibold text-acacia-700 hover:underline"
                >
                  View public page →
                </Link>
              </div>

              <div className="mt-5 max-w-md">
                <Progress percent={project.progress} />
                <p className="mt-2 text-[0.875rem]">
                  <span className="font-bold text-clay-600">{price(project.raised)}</span>
                  <span className="text-ink-muted"> of {price(project.goal)}</span>
                  <span className="ml-2 font-semibold">{project.progress}%</span>
                  <span className="ml-2 text-ink-muted">
                    · {project.contributorCount.toLocaleString('en-GB')} contributors
                  </span>
                </p>
              </div>

              <Divider className="my-5" />

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={updatingId === project.id ? 'secondary' : 'primary'}
                  onClick={() => setUpdatingId(updatingId === project.id ? null : project.id)}
                >
                  {updatingId === project.id ? 'Cancel' : 'Publish an update'}
                </Button>
                {project.status !== 'ACTIVE' && (
                  <Button size="sm" variant="secondary" onClick={() => setStatus(project, 'ACTIVE')} disabled={busy}>
                    Set active
                  </Button>
                )}
                {project.status === 'ACTIVE' && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => setStatus(project, 'PAUSED')} disabled={busy}>
                      Pause
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setStatus(project, 'COMPLETED')} disabled={busy}>
                      Mark complete
                    </Button>
                  </>
                )}
              </div>

              {updatingId === project.id && (
                <div className="mt-6 rounded-[--radius-card] border border-line bg-sand/40 p-5">
                  <h3 className="text-[0.9375rem] font-bold tracking-tight">New update</h3>
                  <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-muted">
                    Everyone who has contributed to this project gets a notification. Say what actually
                    happened, including anything that went slower than planned.
                  </p>

                  <div className="mt-5 space-y-4">
                    <Input
                      label="Title"
                      value={update.title}
                      onChange={(event) => setUpdate({ ...update, title: event.target.value })}
                      placeholder="School supplies delivered"
                    />
                    <Textarea
                      label="What happened"
                      value={update.body}
                      onChange={(event) => setUpdate({ ...update, body: event.target.value })}
                      placeholder="The first delivery reached the school on Wednesday: 60 desk frames, exercise books and chalk for the term…"
                      className="min-h-32"
                    />
                    <Input
                      label="Image URLs"
                      value={update.images}
                      onChange={(event) => setUpdate({ ...update, images: event.target.value })}
                      placeholder="https://…, https://…"
                      hint="Comma separated. Optional."
                    />
                    <Checkbox
                      checked={update.milestone}
                      onChange={(event) => setUpdate({ ...update, milestone: event.target.checked })}
                      label="This is a milestone"
                      description="Milestones are marked differently on the public timeline — use them for completed stages, not routine notes."
                    />
                    <Button
                      variant="impact"
                      onClick={() => publishUpdate(project.id)}
                      disabled={busy || !update.title.trim() || !update.body.trim()}
                    >
                      {busy ? 'Publishing…' : 'Publish update'}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
