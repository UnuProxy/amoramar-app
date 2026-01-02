import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/shared/context/AuthContext';

export const metadata: Metadata = {
  title: 'Amor Amar - Management Dashboard',
  description: 'Manage your salon operations, bookings, and team',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

