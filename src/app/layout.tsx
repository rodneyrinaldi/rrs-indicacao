import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { BrandHeader } from "@/components/brand-header";
import "./globals.css";
import { PwaRegister } from "./pwa-register";

const appFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-app-sans",
});

export const metadata: Metadata = {
  title: "Indicacao | SaaS White Label",
  description: "Plataforma privada de indicacoes juridicas",
  applicationName: "Indicacao",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Indicacao",
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={appFont.variable}>
        <PwaRegister />
        <div className="app-frame">
          <BrandHeader />
          <div className="app-content">{children}</div>
        </div>
      </body>
    </html>
  );
}
