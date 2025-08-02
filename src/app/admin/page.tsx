// app/admin/page.tsx
'use client';

import React from 'react';
import dynamic from 'next/dynamic';

// Dynamic import - แก้ไข path ตามตำแหน่งไฟล์ App.tsx จริง
// ถ้า App.tsx อยู่ที่ src/App.tsx
const App = dynamic(() => import('./App'), {
  ssr: false,
  loading: () => (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: '#f5f5f5'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div 
          style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e3f2fd',
            borderTop: '4px solid #1976d2',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px auto'
          }} 
        />
        <p style={{ color: '#666', fontSize: '16px' }}>กำลังโหลดระบบแอดมิน...</p>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  )
});

const AdminPage: React.FC = () => {
  return <App />;
};

export default AdminPage;