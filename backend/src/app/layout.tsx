import "./globals.css";
import { AuthProvider } from "@/components/lovable/auth-context";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body><AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
