import type { Metadata } from "next";
import { Inter, Source_Code_Pro } from "next/font/google";
import { getSiteConfig } from "@prisnames/config";
import { Toaster } from "sonner";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const sourceCodePro = Source_Code_Pro({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export function generateMetadata(): Metadata {
  const site = getSiteConfig();
  return {
    title: {
      default: site.name,
      template: `%s | ${site.name}`,
    },
    description: site.description,
    metadataBase: new URL(site.url),
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      type: "website",
      siteName: site.name,
      title: site.name,
      description: site.description,
    },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${sourceCodePro.variable}`}
    >
      <body className="min-h-dvh flex flex-col">
        <Providers>
          {children}
        </Providers>
        <Toaster
          position="bottom-right"
          toastOptions={{
            className: "!rounded-[var(--radius-md)] !border-[var(--color-hairline)] !shadow-[var(--shadow-card)] !font-[var(--font-sans)]",
          }}
        />
      </body>
    </html>
  );
}
