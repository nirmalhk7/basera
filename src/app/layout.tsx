import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Basera | Area Intelligence for India",
  description:
    "Source-attributed Current and Future evidence for one selected Indian area.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
