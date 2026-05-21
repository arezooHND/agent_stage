// Import Next.js Metadata type for type-safe page metadata
import type { Metadata } from "next";

// Import global CSS styles (Tailwind base styles live here)
import "./globals.css";

// Define metadata shown in the browser tab and search engines
export const metadata: Metadata = {
  // Browser tab title
  title: "AgentStage",

  // Description shown in search engine results
  description: "Voice-driven character interactions for exhibitions and events",
};

// RootLayout wraps every page in the app
// Next.js requires this file — it provides the <html> and <body> tags
// children = whatever page is currently being rendered (e.g. page.tsx or creator/page.tsx)
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // lang="en" helps screen readers and browsers know the page language
    <html lang="en">
      {/* antialiased = smoother font rendering on all screens */}
      <body className="antialiased">{children}</body>
    </html>
  );
}
