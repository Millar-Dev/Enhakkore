'use client';

import { use } from 'react';
import { notFound } from 'next/navigation';
import { resourceByKey } from '@enhakkore/shared';
import { AdminShell } from '@/components/admin/AdminShell';
import { ResourceForm } from '@/components/admin/ResourceForm';

export default function NewResourcePage({ params }: { params: Promise<{ resource: string }> }) {
  const { resource: key } = use(params);
  const resource = resourceByKey(key);
  if (!resource) notFound();
  return (
    <AdminShell title={`New ${resource.label.toLowerCase()}`} permission={`${resource.permission}.create`}>
      <ResourceForm resource={resource} />
    </AdminShell>
  );
}
