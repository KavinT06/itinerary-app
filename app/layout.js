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

export const metadata = {
  title: "AI Travel Planner",
  description: "Plan your perfect trip with a personalised AI-generated itinerary. Enter your destination and travel dates to get started.",
  keywords: ["travel planner", "AI itinerary", "trip planner", "travel"],
  openGraph: {
    title: "AI Travel Planner",
    description: "Get a personalised AI-generated travel itinerary in seconds.",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
