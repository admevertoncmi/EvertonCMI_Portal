import { getAdminSupabase } from '@/lib/supabase'

// Conversa por conteúdo (portal do cliente <-> equipe). Só roda no servidor:
// quem chama (src/actions/portal.ts e src/actions/conversa.ts) já validou o acesso.

export const BUCKET_ANEXOS = 'portal-anexos'

export type AnexoTipo = 'foto' | 'audio'
const EXT_PERMITIDAS: Record<AnexoTipo, string[]> = {
  foto: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif'],
  audio: ['webm', 'ogg', 'mp4', 'm4a', 'mp3', 'aac', 'wav'],
}

export type MensagemConversa = {
  id: string
  autor: 'cliente' | 'equipe'
  autor_nome: string | null
  feito_pela_agencia: boolean
  texto: string | null
  fotos: string[]                       // links assinados (temporários)
  audio: { url: string; dur: number } | null
  ajuste: boolean
  alvo: 'video' | 'capa' | 'ambos' | null
  evento: string | null
  created_at: string
}

export type NovaMensagem = {
  texto?: string | null
  fotos?: string[]                      // caminhos devolvidos por prepararUpload
  audio?: { path: string; dur: number } | null
  ajuste?: boolean
  alvo?: 'video' | 'capa' | 'ambos' | null
  evento?: string | null
}

const prefixo = (clienteId: string, materialId: string) => `${clienteId}/${materialId}/`

/** Cria um link de envio direto para o Storage, restrito à pasta do material. */
export async function criarUploadAnexo(clienteId: string, materialId: string, tipo: AnexoTipo, ext: string) {
  const e = String(ext || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!EXT_PERMITIDAS[tipo]?.includes(e)) throw new Error('Tipo de arquivo não permitido')
  const path = `${prefixo(clienteId, materialId)}${tipo}-${crypto.randomUUID()}.${e}`
  const { data, error } = await getAdminSupabase().storage.from(BUCKET_ANEXOS).createSignedUploadUrl(path)
  if (error || !data) throw new Error(error?.message || 'Falha ao preparar envio')
  return { path: data.path, token: data.token }
}

/** Grava a mensagem, aceitando só anexos que estejam na pasta do próprio material. */
export async function inserirMensagem(base: {
  materialId: string; clienteId: string; autor: 'cliente' | 'equipe'
  autorId?: string | null; autorNome?: string | null; feitoPelaAgencia?: boolean
}, msg: NovaMensagem) {
  const pasta = prefixo(base.clienteId, base.materialId)
  const fotos = (msg.fotos || []).filter(p => typeof p === 'string' && p.startsWith(pasta)).slice(0, 10)
  const audio = msg.audio && typeof msg.audio.path === 'string' && msg.audio.path.startsWith(pasta) ? msg.audio : null
  const texto = msg.texto ? String(msg.texto).slice(0, 4000).trim() : null
  if (!texto && !fotos.length && !audio && !msg.evento) throw new Error('Mensagem vazia')

  const { data, error } = await getAdminSupabase().from('mensagens_material').insert([{
    material_id: base.materialId,
    cliente_id: base.clienteId,
    autor: base.autor,
    autor_id: base.autorId ?? null,
    autor_nome: base.autorNome ?? null,
    feito_pela_agencia: !!base.feitoPelaAgencia,
    texto,
    fotos,
    audio_path: audio?.path ?? null,
    audio_dur: audio ? Math.max(1, Math.min(3600, Math.round(Number(audio.dur) || 1))) : null,
    ajuste: !!msg.ajuste,
    alvo: msg.alvo && ['video', 'capa', 'ambos'].includes(msg.alvo) ? msg.alvo : null,
    evento: msg.evento ? String(msg.evento).slice(0, 60) : null,
    // quem escreveu já "leu" a própria mensagem
    lida_pelo_cliente: base.autor === 'cliente',
    lida_pela_equipe: base.autor === 'equipe',
  }]).select('id').single()
  if (error) throw new Error(error.message)
  return data.id as string
}

/** Lê a conversa de um material, troca caminhos por links assinados e marca como lida pelo lado que abriu. */
export async function lerConversa(materialId: string, leitor: 'cliente' | 'equipe'): Promise<MensagemConversa[]> {
  const admin = getAdminSupabase()
  const { data } = await admin
    .from('mensagens_material')
    .select('*')
    .eq('material_id', materialId)
    .order('created_at', { ascending: true })
  const rows: any[] = data || [] // se a tabela ainda não existir, mostra pelo menos os pedidos antigos

  const caminhos = rows.flatMap(r => [...(r.fotos || []), ...(r.audio_path ? [r.audio_path] : [])])
  const assinados = new Map<string, string>()
  if (caminhos.length) {
    const { data } = await admin.storage.from(BUCKET_ANEXOS).createSignedUrls(caminhos, 60 * 60 * 6)
    data?.forEach(d => { if (d.path && d.signedUrl) assinados.set(d.path, d.signedUrl) })
  }

  const naoLidas = rows.filter(r => r.autor !== leitor && !(leitor === 'cliente' ? r.lida_pelo_cliente : r.lida_pela_equipe)).map(r => r.id)
  if (naoLidas.length) {
    await admin.from('mensagens_material')
      .update(leitor === 'cliente' ? { lida_pelo_cliente: true } : { lida_pela_equipe: true })
      .in('id', naoLidas)
  }

  const atuais: MensagemConversa[] = rows.map((r: any) => ({
    id: r.id,
    autor: r.autor,
    autor_nome: r.autor_nome,
    feito_pela_agencia: !!r.feito_pela_agencia,
    texto: r.texto,
    fotos: (r.fotos || []).map((p: string) => assinados.get(p)).filter(Boolean) as string[],
    audio: r.audio_path && assinados.get(r.audio_path) ? { url: assinados.get(r.audio_path)!, dur: r.audio_dur || 0 } : null,
    ajuste: !!r.ajuste,
    alvo: r.alvo,
    evento: r.evento,
    created_at: r.created_at,
  }))

  // Pedidos de ajuste antigos (campo "feedback" do material) entram na mesma conversa:
  // ajuste e conversa com o cliente são uma coisa só.
  const { data: material } = await admin.from('materiais').select('feedback, created_at').eq('id', materialId).maybeSingle()
  const legados = ajustesLegados(materialId, material?.feedback, material?.created_at, atuais)
  return [...legados, ...atuais].sort((a, b) => a.created_at.localeCompare(b.created_at))
}

// "[DATE:06/11/2026, 18:21] texto" (horário de Brasília) -> ISO
function dataDoFeedback(s: string | undefined, fallback: string) {
  const m = s && /(\d{2})\/(\d{2})\/(\d{2,4}),?\s+(\d{2}):(\d{2})/.exec(s)
  if (!m) return fallback
  const ano = m[3].length === 2 ? `20${m[3]}` : m[3]
  const d = new Date(`${ano}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00-03:00`)
  return isNaN(d.getTime()) ? fallback : d.toISOString()
}

/** Converte os pedidos do cliente gravados em "feedback" em mensagens, sem repetir os que já estão na conversa. */
function ajustesLegados(materialId: string, feedback: string | null | undefined, criadoEm: string | undefined, atuais: MensagemConversa[]): MensagemConversa[] {
  if (!feedback) return []
  const textosAtuais = atuais.filter(m => m.ajuste).map(m => (m.texto || '').trim()).filter(Boolean)
  const base = criadoEm || new Date(0).toISOString()
  return feedback.split('\n\n').map((bloco, idx) => {
    if (!bloco.trim() || bloco.includes('[ID:')) return null // [ID:...] = ajuste interno da equipe, não é do cliente
    const data = /\[DATE:(.*?)\]/.exec(bloco)?.[1]
    const texto = bloco.replace(/\[DATE:.*?\]/g, '').trim()
    if (!texto) return null
    // O portal novo grava o pedido na conversa e também no feedback: não mostra duas vezes
    if (texto.startsWith('Pedido enviado por foto/áudio.') || textosAtuais.some(t => texto.startsWith(t))) return null
    return {
      id: `legado-${materialId}-${idx}`,
      autor: 'cliente' as const,
      autor_nome: null,
      feito_pela_agencia: false,
      texto,
      fotos: [],
      audio: null,
      ajuste: true,
      alvo: null,
      evento: null,
      created_at: dataDoFeedback(data, base),
    }
  }).filter(Boolean) as MensagemConversa[]
}

/** Quantas mensagens não lidas há por material, do ponto de vista de quem lê. */
export async function contarNaoLidas(filtro: { clienteId?: string; materialIds?: string[] }, leitor: 'cliente' | 'equipe') {
  let q = getAdminSupabase().from('mensagens_material').select('material_id')
    .eq('autor', leitor === 'cliente' ? 'equipe' : 'cliente')
    .eq(leitor === 'cliente' ? 'lida_pelo_cliente' : 'lida_pela_equipe', false)
  if (filtro.clienteId) q = q.eq('cliente_id', filtro.clienteId)
  if (filtro.materialIds?.length) q = q.in('material_id', filtro.materialIds)
  const { data } = await q
  const contagem: Record<string, number> = {}
  data?.forEach(r => { contagem[r.material_id] = (contagem[r.material_id] || 0) + 1 })
  return contagem
}
