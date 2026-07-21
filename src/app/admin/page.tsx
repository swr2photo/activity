// app/admin/page.tsx
'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const App = dynamic(() => import('./App'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <div className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center px-6">
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
      </div>
      <div className="flex flex-1">
        <div className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-6 hidden md:block">
          <div className="space-y-4">
            <div className="h-10 w-full bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
            <div className="h-10 w-full bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
            <div className="h-10 w-full bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex-1 p-8">
          <div className="h-8 w-64 bg-slate-200 dark:bg-slate-800 rounded animate-pulse mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
            <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
            <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
          </div>
          <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse mt-6" />
        </div>
      </div>
    </div>
  ),
});

const AdminPage: React.FC = () => {
  return <App />;
};

export default AdminPage;
