// src/lib/invitesApi.ts
import { auth } from './firebase';

export type AdminInvite = {
  id: string;
  email: string;
  role: string;
  department: string;
  permissions: string[];
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  token: string | null;
  invitedByUid: string;
  invitedByEmail: string;
  createdAt: number | null;
  updatedAt: number | null;
  expiresAt: number | null;
};

export async function listInvites(limit = 100): Promise<AdminInvite[]> {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch(`/api/invites/list?limit=${limit}`, { 
    cache: 'no-store',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  const j = await r.json();
  if (!r.ok || !j.ok) throw new Error(j.error || 'List invites failed');
  return j.items as AdminInvite[];
}

export async function deleteInvite(id: string) {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch('/api/invites/delete', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ id }),
  });
  const j = await r.json();
  if (!r.ok || !j.ok) throw new Error(j.error || 'Delete invite failed');
}

export async function cancelInvite(id: string) {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch('/api/invites/cancel', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ id }),
  });
  const j = await r.json();
  if (!r.ok || !j.ok) throw new Error(j.error || 'Cancel invite failed');
}
