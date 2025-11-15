import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HOTZONES - Presence & Activity Tracking",
  description: "A lightweight presence tracking and activity monitoring MVP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
