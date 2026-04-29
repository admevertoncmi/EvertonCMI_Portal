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
}

// 3. Metadados e PWA
export const metadata: Metadata = {
  title: 'EvertonCMI - Aprovação de Materiais',
  description: 'Plataforma para aprovação de materiais',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
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
    <html lang="pt-BR" suppressHydrationWarning>
      {/* 👇 Substituímos a variável pela classe direta da fonte (openSans.className) */}
      <body suppressHydrationWarning className={`${openSans.className} min-h-screen bg-zinc-50 antialiased`}>
        {children}
        
        {/* Script para registrar o PWA (App instalável) */}
        <script
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