import './globals.css';

export const metadata = {
  title: 'Şarkıdle - Türkçe Şarkı Tahmin',
  description: 'Günün şarkısını tahmin et.',
  icons: {
    icon: '/favicon.webp',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
