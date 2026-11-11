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

/** Paletas prontas (as mesmas de Configurações › Cores do tema). */
export const PALETAS_TEMA: { nome: string; cores: BrandColors }[] = [
  { nome: 'Everton', cores: DEFAULT_BRAND },
  { nome: 'Areia', cores: { soft: '#EFE6DA', brand: '#7A6A55', ink: '#2B2620' } },
  { nome: 'Sálvia', cores: { soft: '#DDE8DF', brand: '#4C7A5A', ink: '#1E2B22' } },
  { nome: 'Céu', cores: { soft: '#DCE8F5', brand: '#3B6EA8', ink: '#1B2633' } },
  { nome: 'Rosé', cores: { soft: '#F6DDE4', brand: '#A84865', ink: '#2E1B22' } },
  { nome: 'Grafite', cores: { soft: '#E8E8E8', brand: '#3A3A3A', ink: '#1A1A1A' } },
]

/** Aplica as cores só nesta tela (por cima do tema do sistema). */
export function aplicarCoresNaTela(c: BrandColors) {
  const s = document.documentElement.style
  s.setProperty('--brand-soft', hexToRgbChannels(c.soft))
  s.setProperty('--brand', hexToRgbChannels(c.brand))
  s.setProperty('--brand-ink', hexToRgbChannels(c.ink))
}

/** Volta para as cores do sistema (as que vêm do banco pelo layout). */
export function limparCoresDaTela() {
  const s = document.documentElement.style
  s.removeProperty('--brand-soft'); s.removeProperty('--brand'); s.removeProperty('--brand-ink')
}

/** CSS que sobrescreve as variáveis da marca definidas em globals.css. */
export const cssDoTema = (c: BrandColors) =>
  `html:root{--brand-soft:${hexToRgbChannels(c.soft)};--brand:${hexToRgbChannels(c.brand)};--brand-ink:${hexToRgbChannels(c.ink)};}`
