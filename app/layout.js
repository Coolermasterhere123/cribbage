export const metadata = {
  title: 'Cribbage',
  description: 'Classic cribbage',
  manifest: '/manifest.json',
  themeColor: '#0f172a',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Cribbage' }
};
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body style={{ margin: 0, background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui,sans-serif' }}>
        {children}
        <script dangerouslySetInnerHTML={{ __html: "if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));}" }} />
      </body>
    </html>
  );
}