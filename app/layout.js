import { Manrope } from "next/font/google";
import "./globals.css";

// One family, self-hosted at build time (CSP font-src 'self'). The variable goes on <html>
// because Tailwind's preflight sets font-family there (DESIGN_SYSTEM section 3).
const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
});

const DESCRIPTION =
  "Day-by-day travel plans for trips up to 14 days, with timed stops and an estimated budget. No account needed.";

export const metadata = {
  title: "Itinera · Day-by-day travel plans",
  description: DESCRIPTION,
  keywords: ["travel planner", "itinerary", "trip planner", "travel"],
  openGraph: {
    title: "Itinera · Day-by-day travel plans",
    description: DESCRIPTION,
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={manrope.variable}>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
