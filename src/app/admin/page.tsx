// app/admin/page.tsx
'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import AdminShellSkeleton from '@/components/admin/AdminShellSkeleton';

const App = dynamic(() => import('./App'), {
  ssr: false,
  loading: () => <AdminShellSkeleton />,
});

const AdminPage: React.FC = () => {
  return <App />;
};

export default AdminPage;
