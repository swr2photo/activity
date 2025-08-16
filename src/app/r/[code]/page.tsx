// src/app/r/[code]/page.tsx
import { redirect } from 'next/navigation';

export default async function R({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const normalized = decodeURIComponent(code || '').trim().toUpperCase();
  if (!normalized) redirect('/');
  redirect(`/register?activity=${encodeURIComponent(normalized)}`);
}
