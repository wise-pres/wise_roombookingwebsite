import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "WISE Room Requests",
  description: "Room-request intake and coordination for WISE U of T.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
