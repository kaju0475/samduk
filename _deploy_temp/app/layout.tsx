import type { Metadata } from "next";
import { BpacScript } from "@/components/Common/BpacScript";
import { ColorSchemeScript, MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { ModalsProvider } from "@mantine/modals";
import { theme } from "@/theme/theme";
import { AppBackTrap } from "@/components/Common/AppBackTrap";
import "./globals.css";
import "@mantine/dates/styles.css";

// [Fix] Force dynamic rendering for the entire app
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "삼덕가스공업(주) 용기관리시스템",
  description: "High Pressure Gas Cylinder Management System",
  icons: {
    icon: '/emblem_v2.png',
    apple: '/emblem_v2.png',
  },
  manifest: '/manifest.json',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" translate="no" suppressHydrationWarning>
      <head>
        {/* Prevent browser auto-translation (Google Translate, etc.) */}
        <meta name="google" content="notranslate" />
        <meta httpEquiv="Content-Language" content="ko" />
        <ColorSchemeScript />
      </head>
      <body suppressHydrationWarning>
        <BpacScript />
        <MantineProvider theme={theme} defaultColorScheme="dark">
             <ModalsProvider labels={{ confirm: '확인', cancel: '취소' }}>
                <AppBackTrap />
                <Notifications position="top-center" zIndex={9999} autoClose={3000} limit={1} />
                {children}
            </ModalsProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
