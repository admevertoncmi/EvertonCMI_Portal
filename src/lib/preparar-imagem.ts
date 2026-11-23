// Prepara imagens escolhidas no navegador antes de enviar para o Storage.
//
// Por quê: o Supabase Storage usa o tipo que o NAVEGADOR coloca no arquivo (File.type) e ignora
// o contentType informado no código. O iPhone muitas vezes entrega a foto sem tipo ("") ou com
// tipos fora do padrão ("image/jpg"), e os buckets com lista de tipos permitidos recusam
// ("mime type application/octet-stream is not supported") -> "Não foi possível enviar a foto".
// Aqui o arquivo sempre sai com um tipo válido e, quando possível, já convertido para JPEG reduzido.

const TIPOS: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  heic: 'image/heic', heif: 'image/heif', svg: 'image/svg+xml',
}

/** Tipo e extensão corretos da imagem, pelo tipo do arquivo ou, se faltar, pela extensão do nome. */
export function tipoDaImagem(f: File): { type: string; ext: string } {
  let type = String(f.type || '').toLowerCase().split(';')[0].trim()
  if (type === 'image/jpg' || type === 'image/pjpeg') type = 'image/jpeg'
  const porTipo = Object.entries(TIPOS).find(([, t]) => t === type)?.[0]
  if (porTipo) return { type, ext: porTipo === 'jpeg' ? 'jpg' : porTipo }
  const extNome = String(f.name || '').split('.').pop()?.toLowerCase() || ''
  if (TIPOS[extNome]) return { type: TIPOS[extNome], ext: extNome === 'jpeg' ? 'jpg' : extNome }
  return { type: 'image/jpeg', ext: 'jpg' } // sem pista nenhuma: foto de celular é JPEG/HEIC; a conversão abaixo resolve
}

/** O mesmo arquivo, com o tipo certo gravado nele (sem converter). */
export function comTipoCerto(f: File): { blob: Blob; type: string; ext: string } {
  const t = tipoDaImagem(f)
  return { blob: new Blob([f], { type: t.type }), ...t }
}

function carregarImagem(f: Blob): Promise<HTMLImageElement> {
  return new Promise((ok, falha) => {
    const url = URL.createObjectURL(f)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); ok(img) }
    img.onerror = () => { URL.revokeObjectURL(url); falha(new Error('não abriu a imagem')) }
    img.src = url
  })
}

/**
 * Foto pronta para enviar: JPEG (fundo branco onde era transparente), no máximo `max` px no maior lado.
 * GIF e SVG vão como estão. Se o navegador não conseguir abrir a imagem, vai o original com o tipo corrigido.
 */
export async function prepararFoto(f: File, max = 2048): Promise<{ blob: Blob; type: string; ext: string }> {
  const original = comTipoCerto(f)
  if (original.type === 'image/gif' || original.type === 'image/svg+xml') return original
  try {
    const img = await carregarImagem(f)
    const w = img.naturalWidth, h = img.naturalHeight
    if (!w || !h) return original
    const escala = Math.min(1, max / Math.max(w, h))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(w * escala)
    canvas.height = Math.round(h * escala)
    const ctx = canvas.getContext('2d')
    if (!ctx) return original
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const jpeg = await new Promise<Blob | null>(ok => canvas.toBlob(ok, 'image/jpeg', 0.86))
    if (!jpeg || !jpeg.size) return original
    // Imagem pequena que já era leve: mantém o original (com tipo certo) se a conversão não ajudou
    if (escala === 1 && original.type !== 'image/heic' && original.type !== 'image/heif' && jpeg.size >= f.size) return original
    return { blob: new Blob([jpeg], { type: 'image/jpeg' }), type: 'image/jpeg', ext: 'jpg' }
  } catch {
    return original
  }
}
