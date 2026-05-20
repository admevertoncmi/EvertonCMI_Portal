import type { Metadata, Viewport } from 'next'
import { Open_Sans } from 'next/font/google'
import '@/app/globals.css'

// 1. Configuração da Fonte (Adicionamos os pesos para os textos em Negrito e Black funcionarem perfeitamente)
const openSans = Open_Sans({ 
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800']
})

// 2. Configurações Visuais (Viewport) - Resolve os avisos do Next.js
export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
}

// 3. Metadados e PWA
export const metadata: Metadata = {
  title: 'EvertonCMI - Aprovação de Materiais',
  description: 'Plataforma para aprovação de materiais',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'EvertonCMI',
  },
}

// 4. Componente Principal
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className="antialiased">
      <head>
        {/* Script para bloquear injeções de atributos por extensões (como bis_skin_checked) e evitar erros de Hydration Mismatch */}
        <script
          suppressHydrationWarning={true}
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const orgSet = Element.prototype.setAttribute;
                  Element.prototype.setAttribute = function(name, value) {
                    if (name === 'bis_skin_checked') return;
                    orgSet.call(this, name, value);
                  };
                  const orgSetNS = Element.prototype.setAttributeNS;
                  Element.prototype.setAttributeNS = function(ns, name, value) {
                    if (name === 'bis_skin_checked') return;
                    orgSetNS.call(this, ns, name, value);
                  };
                  const orgSetNode = Element.prototype.setAttributeNode;
                  Element.prototype.setAttributeNode = function(attr) {
                    if (attr && attr.name === 'bis_skin_checked') return attr;
                    return orgSetNode.call(this, attr);
                  };
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      {/* 👇 Removemos bg-zinc-50 fixo para evitar barras brancas no Safari mobile */}
      <body suppressHydrationWarning className={`${openSans.className} min-h-[100dvh] antialiased`}>
        {children}
        
        {/* Script para registrar o PWA (App instalável) */}
        <script
          suppressHydrationWarning={true}
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
            `,
          }}
        />
      </body>
    </html>
  )
}