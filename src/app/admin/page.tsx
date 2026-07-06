// app/admin/page.tsx
'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const App = dynamic(() => import('./App'), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-700">
      <div className="text-center text-white">
        <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
        <p className="text-base font-medium opacity-90">กำลังโหลดระบบแอดมิน...</p>
      </div>
    </div>
  ),
});

const AdminPage: React.FC = () => {
  return <App />;
};

export default AdminPage;
