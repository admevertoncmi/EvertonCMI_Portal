import { getAdminSupabase } from '@/lib/supabase'
import { BUCKET_ANEXOS, transcreverAudio, type AnexoTipo, type MensagemConversa, type NovaMensagem } from '@/lib/conversa'

// Chat interno da equipe. Só roda no servidor: quem chama (src/actions/chat-equipe.ts)
// já confirmou que a pessoa está logada e é da equipe.

const EXT: Record<AnexoTipo, string[]> = {
  foto: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif'],
  audio: ['webm', 'ogg', 'mp4', 'm4a', 'mp3', 'aac', 'wav'],
}
const PASTA = 'equipe/'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type MembroChat = { id: string; nome: string; role: string; foto_url: string | null }
export type DemandaChat = { id: string; titulo: string; cliente: string | null }

/** Confere se a pessoa pode usar o canal (sala geral ou conversa em que ela é uma das duas pontas). */
export async function validarCanal(canal: string, euId: string) {
  if (canal === 'geral') return
  const [tipo, a, b] = String(canal).split(':')
  if (tipo !== 'dm' || !UUID.test(a || '') || !UUID.test(b || '') || a >= b || (a !== euId && b !== euId)) throw new Error('Conversa não encontrada')
}

export async function membrosDoChat(): Promise<MembroChat[]> {
  const { data } = await getAdminSupabase().from('perfis_equipe').select('id, nome, email, role, foto_url')
  return ((data || []) as any[])
    .map(m => ({ id: m.id, nome: m.nome || m.email || 'Sem nome', role: m.role, foto_url: m.foto_url ?? null }))
    .sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'))
}

const nomeCliente = (c: any) => (Array.isArray(c) ? c[0]?.nome : c?.nome) ?? null

/** Conteúdos que a pessoa pode citar numa mensagem: todos para a admin; para os demais, só os seus. */
export async function demandasDoChat(euId: string, ehAdmin: boolean): Promise<DemandaChat[]> {
  const { data } = await getAdminSupabase().from('materiais')
    .select('id, titulo, status, planner_id, editor_id, designer_id, responsaveis, cliente:clientes(nome)')
    .neq('status', 'concluido').order('created_at', { ascending: false }).limit(400)
  return ((data || []) as any[])
    .filter(m => ehAdmin || [m.planner_id, m.editor_id, m.designer_id, ...(Array.isArray(m.responsaveis) ? m.responsaveis : [])].includes(euId))
    .map(m => ({ id: m.id, titulo: m.titulo || 'Sem título', cliente: nomeCliente(m.cliente) }))
}

/** Não lidas por conversa (mensagens de outras pessoas depois da última leitura). */
export async function naoLidasDoChat(euId: string): Promise<Record<string, number>> {
  const admin = getAdminSupabase()
  const desde = new Date(Date.now() - 60 * 86400000).toISOString()
  const [{ data: msgs }, { data: leituras }] = await Promise.all([
    admin.from('mensagens_equipe').select('canal, created_at').neq('autor_id', euId).gte('created_at', desde)
      .or(`canal.eq.geral,canal.like.%${euId}%`).limit(3000),
    admin.from('leituras_chat_equipe').select('canal, lida_ate').eq('membro_id', euId),
  ])
  const lida = new Map<string, string>((leituras || []).map((l: any) => [l.canal, l.lida_ate]))
  const out: Record<string, number> = {}
  for (const m of (msgs || []) as any[]) {
    if (m.created_at > (lida.get(m.canal) || '')) out[m.canal] = (out[m.canal] || 0) + 1
  }
  return out
}

export async function marcarCanalLido(euId: string, canal: string) {
  await getAdminSupabase().from('leituras_chat_equipe')
    .upsert({ membro_id: euId, canal, lida_ate: new Date().toISOString() }, { onConflict: 'membro_id,canal' })
}

export async function lerCanal(canal: string, euId: string, marcarLida = true): Promise<MensagemConversa[]> {
  const admin = getAdminSupabase()
  const { data } = await admin.from('mensagens_equipe').select('*').eq('canal', canal)
    .order('created_at', { ascending: false }).limit(300)
  const rows: any[] = (data || []).reverse()

  const caminhos = rows.flatMap(r => [...(r.fotos || []), ...(r.audio_path ? [r.audio_path] : [])])
  const assinados = new Map<string, string>()
  if (caminhos.length) {
    const { data: ass } = await admin.storage.from(BUCKET_ANEXOS).createSignedUrls(caminhos, 60 * 60 * 6)
    ass?.forEach(d => { if (d.path && d.signedUrl) assinados.set(d.path, d.signedUrl) })
  }

  const ids = Array.from(new Set<string>(rows.map(r => r.material_id).filter(Boolean)))
  const demandas = new Map<string, DemandaChat>()
  if (ids.length) {
    const { data: mats } = await admin.from('materiais').select('id, titulo, cliente:clientes(nome)').in('id', ids)
    ;((mats || []) as any[]).forEach(m => demandas.set(m.id, { id: m.id, titulo: m.titulo || 'Sem título', cliente: nomeCliente(m.cliente) }))
  }

  if (marcarLida) await marcarCanalLido(euId, canal)

  return rows.map(r => ({
    id: r.id, autor: 'equipe' as const, autor_id: r.autor_id, autor_nome: r.autor_nome, feito_pela_agencia: false,
    texto: r.texto,
    fotos: (r.fotos || []).map((p: string) => assinados.get(p)).filter(Boolean) as string[],
    audio: r.audio_path && assinados.get(r.audio_path) ? { url: assinados.get(r.audio_path)!, dur: r.audio_dur || 0, transcricao: r.audio_transcricao ?? null } : null,
    ajuste: false, alvo: null, evento: null,
    demanda: r.material_id ? demandas.get(r.material_id) ?? null : null,
    created_at: r.created_at,
  }))
}

export async function criarUploadChat(tipo: AnexoTipo, ext: string) {
  const e = String(ext || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!EXT[tipo]?.includes(e)) throw new Error('Tipo de arquivo não permitido')
  const path = `${PASTA}${tipo}-${crypto.randomUUID()}.${e}`
  const { data, error } = await getAdminSupabase().storage.from(BUCKET_ANEXOS).createSignedUploadUrl(path)
  if (error || !data) throw new Error(error?.message || 'Falha ao preparar envio')
  return { path: data.path, token: data.token }
}

export async function inserirMensagemChat(base: { canal: string; autorId: string; autorNome: string }, msg: NovaMensagem & { materialId?: string | null }) {
  const fotos = (msg.fotos || []).filter(p => typeof p === 'string' && p.startsWith(PASTA)).slice(0, 10)
  const audio = msg.audio && typeof msg.audio.path === 'string' && msg.audio.path.startsWith(PASTA) ? msg.audio : null
  const texto = msg.texto ? String(msg.texto).slice(0, 4000).trim() : null
  if (!texto && !fotos.length && !audio) throw new Error('Mensagem vazia')
  const materialId = msg.materialId && UUID.test(msg.materialId) ? msg.materialId : null

  const { data, error } = await getAdminSupabase().from('mensagens_equipe').insert([{
    canal: base.canal, autor_id: base.autorId, autor_nome: base.autorNome, material_id: materialId,
    texto, fotos,
    audio_path: audio?.path ?? null,
    audio_dur: audio ? Math.max(1, Math.min(3600, Math.round(Number(audio.dur) || 1))) : null,
  }]).select('id').single()
  if (error) throw new Error(error.message)
  await marcarCanalLido(base.autorId, base.canal) // quem escreveu já leu até aqui
  return data.id as string
}

export const transcreverAudioChat = (mensagemId: string) => transcreverAudio(null, mensagemId, 'mensagens_equipe')
