import type { Metadata, Viewport } from "next";
import { Nunito, Fraunces } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { TopBar } from "@/components/TopBar";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { SyncProvider } from "@/components/SyncProvider";
import "./globals.css";

const body = Nunito({
  variable: "--font-body",
  subsets: ["latin"],
});

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Viola House — Picture Book Studio",
  description:
    "Write, illustrate, and export children's picture books ready for Amazon KDP.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Viola House", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#b5476b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${body.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegister />
        <SyncProvider />
        <TopBar />
        {children}
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              background: "var(--surface)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
            },
          }}
        />
      </body>
    </html>
  );
}
