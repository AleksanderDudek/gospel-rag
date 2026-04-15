import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar/Sidebar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME ?? "Gospel RAG",
  description: "AI-powered Bible study with streaming answers and inline citations",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} flex h-screen overflow-hidden font-sans antialiased`}>
        {/* Sidebar — hidden on mobile, shown via Sheet in the chat header */}
        <div className="hidden md:flex">
          <Sidebar />
        </div>
        <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
      </body>
    </html>
  );
}
