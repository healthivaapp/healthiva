import React from 'react';

export default function ReceptionDashboard() {
  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{
        background: 'linear-gradient(135deg, #1a6f8a 0%, #0d9373 100%)',
        color: 'white',
        padding: '30px 40px',
        borderRadius: '16px',
        marginBottom: '30px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{
            fontSize: '32px',
            background: 'rgba(255,255,255,0.2)',
            width: '60px',
            height: '60px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>🏥</div>
          <div>
            <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 800 }}>Healthiva</h1>
            <p style={{ margin: '4px 0 0 0', opacity: 0.9, fontSize: '15px' }}>
              Clinic Assistant & Reception Control Center — Day 1 Setup Active
            </p>
          </div>
        </div>
      </header>

      <main style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        <div style={{ background: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ color: '#1a6f8a', marginTop: 0 }}>📋 Receptionist Queue</h3>
          <p style={{ color: '#4a5568', fontSize: '14px' }}>Fast Walk-In & Phone Call appointment token registration system.</p>
          <div style={{ background: '#f0f7fa', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #1a6f8a', fontSize: '13px' }}>
            Status: Ready for Day 2 Token Queue Integration
          </div>
        </div>

        <div style={{ background: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ color: '#0d9373', marginTop: 0 }}>💊 In-House Medicine Master</h3>
          <p style={{ color: '#4a5568', fontSize: '14px' }}>Manage clinic-tailored drug inventory with instant search & import.</p>
          <div style={{ background: '#f0fff4', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #0d9373', fontSize: '13px' }}>
            Status: Clinic-scoped inventory ready
          </div>
        </div>

        <div style={{ background: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ color: '#6b46c1', marginTop: 0 }}>🔐 Multi-Tenant Security</h3>
          <p style={{ color: '#4a5568', fontSize: '14px' }}>Supabase PostgreSQL with strict Row Level Security (RLS) by Clinic ID.</p>
          <div style={{ background: '#faf5ff', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #6b46c1', fontSize: '13px' }}>
            Status: Migration Script Created
          </div>
        </div>
      </main>
    </div>
  );
}
