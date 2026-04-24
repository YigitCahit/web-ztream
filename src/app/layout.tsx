import type { Metadata } from "next";
import { Saira_Stencil_One, Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "700"],
});

const sairaStencil = Saira_Stencil_One({
  variable: "--font-saira-stencil",
  subsets: ["latin", "latin-ext"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Web Ztream",
  description:
    "Kick hesabınla giriş yap, kişisel OBS overlay URL'i al ve chat mesajlarında hareketli karakterlerini göster.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${spaceGrotesk.variable} ${sairaStencil.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
