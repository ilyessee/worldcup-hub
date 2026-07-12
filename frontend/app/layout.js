import "./globals.css";

export const metadata = {
  title: "WorldCup Hub",
  description: "World Cup 2026 companion — predictions, favorites and live scores",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
