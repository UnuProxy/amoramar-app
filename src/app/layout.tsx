import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/shared/context/AuthContext';

export const metadata: Metadata = {
  title: 'Amor Amar - Management Dashboard',
  description: 'Manage your salon operations, bookings, and team',
  applicationName: 'Amor Amar',
  manifest: '/manifest.webmanifest',
  themeColor: '#111827',
  appleWebApp: {
    capable: true,
    title: 'Amor Amar',
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
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
