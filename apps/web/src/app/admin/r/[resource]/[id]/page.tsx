'use client';

import { use } from 'react';
import { notFound } from 'next/navigation';
import { resourceByKey } from '@enhakkore/shared';
import { AdminShell } from '@/components/admin/AdminShell';
import { ResourceForm } from '@/components/admin/ResourceForm';

export default function EditResourcePage({ params }: { params: Promise<{ resource: string; id: string }> }) {
  const { resource: key, id } = use(params);
  const resource = resourceByKey(key);
  if (!resource) notFound();
  return (
    <AdminShell title={`Edit ${resource.label.toLowerCase()}`} permission={`${resource.permission}.view`}>
      <ResourceForm key={id} resource={resource} id={id} />
    </AdminShell>
  );
}
