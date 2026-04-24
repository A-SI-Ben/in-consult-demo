import './globals.css';

export const metadata = {
  title: 'In-Consult — Clinical Visual Reference',
  description: 'A cleaner, curated way to explain a diagnosis in the room.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
