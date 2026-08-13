import "./globals.css";
import type { Metadata } from "next";
import { Press_Start_2P, VT323 } from "next/font/google";
import { WalletProvider } from "./components/WalletProvider";

const pixelHeading = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel-heading",
});

const pixelBody = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel-body",
});

export const metadata: Metadata = {
  title: "Fogpot — Raid the Dark Pool",
  description: "A confidential boss raid that feeds a Megapot jackpot pool.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${pixelHeading.variable} ${pixelBody.variable}`}>
      <body>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
