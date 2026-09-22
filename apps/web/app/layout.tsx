import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-plus-jakarta-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Healthiva — Run Your Clinic Smarter | All-in-One Clinic Management Software',
  description: 'Healthiva helps you simplify appointments, manage patients, billing, inventory and reports — all in one place.',
  icons: {
    icon: '/healthiva-logo.png',
  },
};

import { BranchProvider } from '../context/branch-context';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${plusJakartaSans.variable} h-full antialiased`}>
      <body className={`${plusJakartaSans.className} min-h-full bg-white text-slate-900 overflow-x-hidden`}>
        <BranchProvider>
          {children}
        </BranchProvider>
      </body>
    </html>
  );
}
