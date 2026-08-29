import React from 'react';

export const metadata = {
  title: 'Healthiva — Clinic OS Reception & Admin',
  description: 'Fast OPD Clinic Assistant & Reception Workflow',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'Segoe UI, system-ui, sans-serif', backgroundColor: '#f0f7fa', color: '#1a202c' }}>
        {children}
      </body>
    </html>
  );
}
