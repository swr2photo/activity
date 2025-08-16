import { redirect } from 'next/navigation';

export default function R({ params }: { params: { code: string } }) {
  const code = decodeURIComponent(params.code || '').trim().toUpperCase();
  if (!code) redirect('/');
  redirect(`/register?activity=${encodeURIComponent(code)}`);
}
