import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JK Alianças | Portal",
  description: "Portal JK Alianças",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
