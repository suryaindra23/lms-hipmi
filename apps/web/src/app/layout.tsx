import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001"),
  title: {
    default: "Sunrise Academy",
    template: "%s | Sunrise Academy",
  },
  description:
    "Platform pembelajaran digital, praktik toko, dan affiliate multi-sekolah yang aman, terukur, dan ramah siswa.",
  applicationName: "Sunrise Academy",
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "/",
    siteName: "Sunrise Academy",
    title: "Sunrise Academy",
    description: "Pendidikan inklusif adaptif untuk wirausaha digital.",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "Sunrise Academy" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sunrise Academy",
    description: "Pendidikan inklusif adaptif untuk wirausaha digital.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${jakartaSans.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
