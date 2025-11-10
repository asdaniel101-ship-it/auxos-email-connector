import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BrokerZero",
  description: "The modern operating system for insurance submissions and carrier workflows.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-50 text-slate-900`}
      >
        <div className="min-h-screen flex flex-col">
          <header className="bg-white border-b border-slate-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <Link href="/" className="flex items-center gap-3">
                <Image
                  src="/images/brokerzero-logo.png"
                  alt="BrokerZero Logo"
                  width={44}
                  height={44}
                  priority
                />
                <div>
                  <span className="block text-xl font-semibold tracking-tight text-slate-900">BrokerZero</span>
                  <span className="block text-sm text-slate-500">
                    Monitor submissions, pipelines, and quoting progress in real time.
                  </span>
                </div>
              </Link>
              <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
                <Link href="/intake" className="hover:text-slate-900 transition-colors">
                  Business Portal
                </Link>
                <Link href="/carrier" className="hover:text-slate-900 transition-colors">
                  Carrier Portal
                </Link>
                <Link
                  href="/request-demo"
                  className="px-4 py-2 rounded-full bg-slate-900 text-white hover:bg-slate-800 transition-colors font-semibold"
                >
                  Request Demo
                </Link>
              </nav>
              <div className="md:hidden flex flex-col gap-3 text-sm text-slate-600">
                <Link href="/request-demo" className="px-4 py-2 rounded-full bg-slate-900 text-white text-center font-semibold">
                  Request Demo
                </Link>
                <div className="flex gap-4 justify-center">
                  <Link href="/intake" className="hover:text-slate-900 transition-colors">
                    Business Portal
                  </Link>
                  <span className="text-slate-300">•</span>
                  <Link href="/carrier" className="hover:text-slate-900 transition-colors">
                    Carrier Portal
                  </Link>
                </div>
              </div>
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
