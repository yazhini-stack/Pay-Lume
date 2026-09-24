import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Paylume — Upload. Ask. Understand.",
  description: "Multimodal RAG chatbot designed to help people understand suspicious payment-related content with calm and clinical clarity.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen selection:bg-emerald-500/30 selection:text-emerald-200">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
