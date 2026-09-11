import type { Metadata } from "next";
import { Archivo_Black, DM_Sans } from "next/font/google";

import { AppGate } from "@/features/auth/identity-controls";
import { IdentityProvider } from "@/features/auth/identity-provider";

import "./globals.css";

const displayFont = Archivo_Black({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

const bodyFont = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Who's That Pokemon?",
  description: "Read the Pokedex. Make your pick. Prove you know your Pokemon.",
};

const RootLayout = ({ children }: LayoutProps<"/">) => {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>
        <IdentityProvider>
          <AppGate>{children}</AppGate>
        </IdentityProvider>
      </body>
    </html>
  );
};

export default RootLayout;
