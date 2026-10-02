import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Yureeh Dairy Hub',
  description: 'Milk sales and buffalo performance management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
