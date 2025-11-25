import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import ConditionalHeader from "@/components/ConditionalHeader";

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
          <Suspense fallback={
            <header className="bg-white border-b border-slate-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-200 rounded animate-pulse"></div>
                  <div className="h-4 w-48 bg-slate-200 rounded animate-pulse"></div>
                </div>
              </div>
            </header>
          }>
            <ConditionalHeader />
          </Suspense>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
