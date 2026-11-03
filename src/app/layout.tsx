import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteSans = Inter({
  variable: "--font-site-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Parth Thirwani",
    template: "%s | Parth Thirwani"
  },
  description: "Parth Thirwani is a founding engineer working on agent memory and context engineering.",
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'Parth Thirwani',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${siteSans.variable} antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="site-theme">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
