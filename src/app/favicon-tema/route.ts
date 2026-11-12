import sharp from 'sharp'
import { lerTemaServidor } from '@/lib/tema-servidor'
import { LOGO_MASCARA_PNG, LOGO_PROPORCAO } from '@/lib/favicon-logo'

// Favicon redondo nas cores do tema (Configurações › Cores do tema):
// círculo na cor clara (soft) com o logo na cor escura (ink).
// O layout aponta para /favicon-tema?v=<cores>, então trocar o tema muda o endereço
// e o navegador busca o ícone novo.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TAMANHO = 192

export async function GET() {
  const { soft, ink } = await lerTemaServidor()

  const fundo = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TAMANHO}" height="${TAMANHO}"><circle cx="${TAMANHO / 2}" cy="${TAMANHO / 2}" r="${TAMANHO / 2}" fill="${soft}"/></svg>`,
  )

  // Logo pintado: cor "ink" com a máscara do logo como transparência
  const h = Math.round(TAMANHO * 0.6)
  const w = Math.round(h * LOGO_PROPORCAO)
  const alfa = await sharp(LOGO_MASCARA_PNG).resize(w, h).extractChannel(0).raw().toBuffer()
  const logo = await sharp({ create: { width: w, height: h, channels: 3, background: ink } })
    .joinChannel(alfa, { raw: { width: w, height: h, channels: 1 } })
    .png()
    .toBuffer()

  const png = await sharp(fundo)
    .composite([{ input: logo, left: Math.round((TAMANHO - w) / 2), top: Math.round((TAMANHO - h) / 2) }])
    .png()
    .toBuffer()

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      // o endereço muda junto com o tema, então dá para guardar em cache por bastante tempo
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  })
}
