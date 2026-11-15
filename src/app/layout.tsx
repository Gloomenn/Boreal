import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Boreal",
  description: "Tu gestor de confianza",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <footer className="border-t border-slate-200 bg-white px-4 py-3 text-center text-xs text-slate-600">
          Buzones nuevos por{" "}
          <a
            href="https://www.mailslurp.com/"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-purple-700 underline"
          >
            MailSlurp
          </a>
          {" "}y buzones anteriores por{" "}
          <a
            href="https://mail.tm/"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-purple-700 underline"
          >
            Mail.tm
          </a>
        </footer>
      </body>
    </html>
  );
}
