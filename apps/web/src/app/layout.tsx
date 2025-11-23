import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuxoLogo from "@/components/AuxoLogo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Auxo - Restaurant Back Office Support",
  description: "Get the right insurance rates and coverage. Access funding easily. Focus on running your restaurant while we handle the back office.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-50 text-slate-900`}>
        <div className="min-h-screen flex flex-col">
          <header className="bg-white border-b border-slate-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <Link href="/" className="flex items-center gap-3">
                {/* Logo */}
                <AuxoLogo />
                <div>
                  <span className="block text-sm text-slate-500">
                    Insurance & funding made easy for restaurants.
                  </span>
                </div>
              </Link>
              <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
                <Link href="/partners/dashboard" className="hover:text-slate-900 transition-colors">
                  Partner Portal
                </Link>
              </nav>
              <div className="md:hidden flex flex-col gap-3 text-sm text-slate-600">
                <div className="flex gap-4 justify-center">
                  <Link href="/partners/dashboard" className="hover:text-slate-900 transition-colors">
                    Partner Portal
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
