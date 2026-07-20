import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-archivo",
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "MTG Life Counter",
  description:
    "Magic: The Gathering life counter — track life totals for Commander and other formats",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#292A2A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${archivo.variable} h-full antialiased`}>
      <head>
        <meta name="apple-mobile-web-app-title" content="Life Counter" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
