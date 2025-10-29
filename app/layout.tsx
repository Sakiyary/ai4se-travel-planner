import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppShell } from '../components/layout/AppShell';
import { AppProviders } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AI 旅行规划师',
  description: '基于语音输入和大模型的智能旅行规划工具',
  applicationName: 'AI Travel Planner',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg'
  }
};

export const viewport = {
  themeColor: '#0ea5e9'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="zh-CN"
      className={inter.className}
      data-theme="light"
      style={{ colorScheme: 'light' }}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <AppProviders>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
