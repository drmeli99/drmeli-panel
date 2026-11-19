import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Panel MeLi', description: 'Operación, ventas y competencia de tus tiendas de MercadoLibre' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0d0c14' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
