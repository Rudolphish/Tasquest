import type { Metadata, Viewport } from 'next';
import { M_PLUS_1, Rajdhani } from 'next/font/google';
import './globals.css';

const body = M_PLUS_1({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-body',
  display: 'swap',
});

const display = Rajdhani({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Tasquest',
  description: '複数の目標を章とクエストに分けて進める、個人用の目標管理',
};

export const viewport: Viewport = {
  themeColor: '#05090d',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${body.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
