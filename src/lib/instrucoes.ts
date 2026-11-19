// Instruções internas da equipe (campo materiais.feedback_admin).
//
// Formato gravado: entradas separadas por "\n\n---\n\n". Cada entrada pode ter blocos
// [EDITOR]...[/EDITOR] / [DESIGNER]...[/DESIGNER] (texto fora dos blocos vale para todos),
// a marca de autor [ID:uuid] e, a partir de agora, a data em [DATE:dd/mm/aaaa, hh:mm]
// logo no começo do texto. Entradas antigas não têm data.

export type EntradaInstrucao = { texto: string; data: string | null }

/** Data/hora de agora no formato das marcas [DATE:...] (mesmo formato do campo feedback). */
export const agoraMarca = () => new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

/** Prefixo de data para uma entrada nova. */
export const marcaData = (data = agoraMarca()) => `[DATE:${data}] `

const SEPARADOR = /\n\s*-{3,}\s*\n|^\s*-{3,}\s*\n|\n\s*-{3,}\s*$/g
const RE_DATA = /\[DATE:([^\]]+)\]\s*/

function entrada(bruto: string): EntradaInstrucao | null {
  const data = RE_DATA.exec(bruto)?.[1]?.trim() || null
  const texto = bruto.replace(/\[DATE:[^\]]+\]\s*/g, '').replace(/^(\s|-)+|(\s|-)+$/g, '').trim()
  return texto ? { texto, data } : null
}

/**
 * Entradas da instrução que valem para o papel, da mais antiga para a mais recente.
 * papel 'editor' vê os blocos [EDITOR] + texto comum; 'designer' vê [DESIGNER] + comum;
 * qualquer outro papel (decupador) vê só o texto comum.
 */
export function entradasInstrucao(text?: string | null, papel?: string): EntradaInstrucao[] {
  if (!text) return []
  const t = text.replace(/\[ID:[^\]]+\]\s*/g, '')
  const tagDoPapel = papel === 'editor' ? 'EDITOR' : papel === 'designer' ? 'DESIGNER' : null
  const pedacos: string[] = []
  const re = /\[(EDITOR|DESIGNER)\]([\s\S]*?)\[\/\1\]/g
  let ultimo = 0
  for (const m of Array.from(t.matchAll(re))) {
    pedacos.push(t.slice(ultimo, m.index))
    if (m[1] === tagDoPapel) pedacos.push(m[2])
    ultimo = (m.index || 0) + m[0].length
  }
  pedacos.push(t.slice(ultimo))
  return pedacos
    .flatMap(p => p.split(SEPARADOR))
    .map(entrada)
    .filter(Boolean) as EntradaInstrucao[]
}

/** "dd/mm/aaaa, hh:mm" (horário de Brasília) -> Date */
export function dataDaMarca(s?: string | null): Date | null {
  const m = s && /(\d{2})\/(\d{2})\/(\d{2,4}),?\s+(\d{2}):(\d{2})/.exec(s)
  if (!m) return null
  const ano = m[3].length === 2 ? `20${m[3]}` : m[3]
  const d = new Date(`${ano}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00-03:00`)
  return isNaN(d.getTime()) ? null : d
}

/** "Hoje às 09:15", "Ontem às 18:40" ou "17/11 às 10:02". */
export function rotuloQuando(d: Date | string | null | undefined): string {
  const data = typeof d === 'string' ? (dataDaMarca(d) || new Date(d)) : d
  if (!data || isNaN(data.getTime())) return ''
  const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const dia = new Date(data); dia.setHours(0, 0, 0, 0)
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const diff = Math.round((hoje.getTime() - dia.getTime()) / 86400000)
  if (diff === 0) return `Hoje às ${hora}`
  if (diff === 1) return `Ontem às ${hora}`
  return `${data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${hora}`
}

/**
 * Para o modal "Editar instrução": tira as marcas de data do texto mostrado e guarda
 * cada entrada -> data, para devolver a data certa ao salvar (entrada nova ou alterada ganha a data de agora).
 */
export function separarDatas(textoComMarcas: string): { texto: string; datas: Record<string, string> } {
  const datas: Record<string, string> = {}
  const partes = textoComMarcas.split(SEPARADOR).map(p => {
    const e = entrada(p)
    if (e) datas[e.texto] = e.data || '' // '' = entrada antiga, sem data: continua sem data
    return e?.texto || ''
  }).filter(Boolean)
  return { texto: partes.join('\n\n---\n\n'), datas }
}

export function recolocarDatas(textoEditado: string, datas: Record<string, string>): string {
  return textoEditado.split(SEPARADOR).map(p => p.trim()).filter(Boolean)
    .map(p => p in datas ? (datas[p] ? `${marcaData(datas[p])}${p}` : p) : `${marcaData()}${p}`)
    .join('\n\n---\n\n')
}
