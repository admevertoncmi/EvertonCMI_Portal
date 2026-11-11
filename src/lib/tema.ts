// Cores do tema (Configurações › Cores do tema), salvas no banco (tabela configuracoes, chave 'tema').
// O layout raiz lê do banco e já entrega as variáveis CSS em toda página; o painel salva por server action.

export type BrandColors = { soft: string; brand: string; ink: string }
export const DEFAULT_BRAND: BrandColors = { soft: '#F9E2D2', brand: '#A25431', ink: '#212013' }

const HEX = /^#[0-9a-fA-F]{6}$/

/** Aceita só um objeto com as 3 cores em #RRGGBB; senão devolve null. */
export function temaValido(v: any): BrandColors | null {
  if (!v || typeof v !== 'object') return null
  const { soft, brand, ink } = v
  return [soft, brand, ink].every(c => typeof c === 'string' && HEX.test(c)) ? { soft, brand, ink } : null
}

export const hexToRgbChannels = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}

/** CSS que sobrescreve as variáveis da marca definidas em globals.css. */
export const cssDoTema = (c: BrandColors) =>
  `html:root{--brand-soft:${hexToRgbChannels(c.soft)};--brand:${hexToRgbChannels(c.brand)};--brand-ink:${hexToRgbChannels(c.ink)};}`
