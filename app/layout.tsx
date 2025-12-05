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
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body className="antialiased">
        {children}
        <div className="fixed bottom-0 left-0 right-0 bg-red-600 text-white text-xs font-bold text-center p-1 z-[999999]">
          DEPLOYMENT CHECK: v2.0.0-ios-fix
        </div>
      </body>
    </html>
  );
}
