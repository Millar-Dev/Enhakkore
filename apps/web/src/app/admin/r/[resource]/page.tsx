'use client';

import { use } from 'react';
import { notFound } from 'next/navigation';
import { resourceByKey } from '@enhakkore/shared';
import { AdminShell } from '@/components/admin/AdminShell';
import { ResourceList } from '@/components/admin/ResourceList';

export default function ResourceListPage({ params }: { params: Promise<{ resource: string }> }) {
  const { resource: key } = use(params);
  const resource = resourceByKey(key);
  if (!resource) notFound();
  return (
    <AdminShell title={resource.plural} permission={`${resource.permission}.view`}>
      <ResourceList resource={resource} />
    </AdminShell>
  );
}
