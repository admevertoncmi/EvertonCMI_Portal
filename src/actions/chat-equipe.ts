'use server'

import { getAdminSupabase } from '@/lib/supabase'
import { requireEquipe } from '@/lib/auth-guard'
import type { AnexoTipo, MensagemConversa, NovaMensagem } from '@/lib/conversa'
import {
  validarCanal, membrosDoChat, demandasDoChat, naoLidasDoChat, lerCanal, criarUploadChat,
  inserirMensagemChat, transcreverAudioChat, type MembroChat, type DemandaChat,
} from '@/lib/chat-equipe'

// Chat interno da equipe. Toda action exige membro da equipe logado e confere o canal.

export type ChatInicial = { euId: string; membros: MembroChat[]; demandas: DemandaChat[]; naoLidas: Record<string, number> }

export async function chatEquipeInicial(): Promise<ChatInicial> {
  const { user, perfil } = await requireEquipe()
  const [membros, demandas, naoLidas] = await Promise.all([
    membrosDoChat(), demandasDoChat(user.id, perfil.role === 'admin'), naoLidasDoChat(user.id).catch(() => ({})),
  ])
  return { euId: user.id, membros, demandas, naoLidas }
}

/** Contagem leve para o aviso no menu (tabela ainda não criada = zero). */
export async function chatEquipeNaoLidas(): Promise<Record<string, number>> {
  try {
    const { user } = await requireEquipe()
    return await naoLidasDoChat(user.id)
  } catch { return {} }
}

export async function chatEquipeConversa(canal: string, opts?: { marcarLida?: boolean }): Promise<{ mensagens: MensagemConversa[]; erro?: string }> {
  try {
    const { user } = await requireEquipe()
    await validarCanal(canal, user.id)
    return { mensagens: await lerCanal(canal, user.id, opts?.marcarLida !== false) }
  } catch (e: any) {
    return { mensagens: [], erro: e?.message || 'Não foi possível abrir a conversa' }
  }
}

export async function prepararAnexoChat(tipo: AnexoTipo, ext: string) {
  await requireEquipe()
  return criarUploadChat(tipo, ext)
}

export async function enviarMensagemChat(canal: string, msg: NovaMensagem & { materialId?: string | null }) {
  const { user, perfil } = await requireEquipe()
  await validarCanal(canal, user.id)
  const { data: membro } = await getAdminSupabase().from('perfis_equipe').select('nome').eq('id', user.id).maybeSingle()
  return inserirMensagemChat({ canal, autorId: user.id, autorNome: membro?.nome || perfil.email || 'Equipe' }, msg)
}

export async function transcreverAudioChatAction(canal: string, mensagemId: string): Promise<{ texto?: string; erro?: string }> {
  try {
    const { user } = await requireEquipe()
    await validarCanal(canal, user.id)
    const { data: m } = await getAdminSupabase().from('mensagens_equipe').select('canal').eq('id', mensagemId).maybeSingle()
    if (!m || m.canal !== canal) throw new Error('Áudio não encontrado')
    return { texto: await transcreverAudioChat(mensagemId) }
  } catch (e: any) {
    return { erro: e?.message || 'Não foi possível transcrever o áudio' }
  }
}

export type PerfilChat = {
  id: string; nome: string; role: string; foto_url: string | null; desde: string | null
  total: number; entregues: number; emAndamento: number
  ajustes: number | null; atrasadas: number | null   // só a admin vê estes dois
  recentes: { id: string; titulo: string; cliente: string | null; status: string }[]
}

/** Resumo de trabalho de um colega (mesma regra de "entrega" dos relatórios do admin). */
export async function perfilMembroChat(membroId: string): Promise<PerfilChat | { erro: string }> {
  try {
    const { perfil: eu } = await requireEquipe()
    const admin = getAdminSupabase()
    const { data: m } = await admin.from('perfis_equipe').select('*').eq('id', membroId).maybeSingle()
    if (!m) return { erro: 'Pessoa não encontrada' }
    const { data } = await admin.from('materiais')
      .select('id, titulo, status, data_limite, video_entregue, design_entregue, editor_id, designer_id, planner_id, cliente:clientes(nome)')
      .or(`editor_id.eq.${membroId},designer_id.eq.${membroId},planner_id.eq.${membroId}`)
      .order('created_at', { ascending: false }).limit(1000)
    const hoje = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10) // horário de Brasília
    const fechado = ['aprovado', 'post_aprovado', 'concluido']
    let total = 0, entregues = 0, ajustes = 0, atrasadas = 0
    const abertas: any[] = []
    for (const x of (data || []) as any[]) {
      total++
      const entregou = x.editor_id === membroId ? !!x.video_entregue : x.designer_id === membroId ? !!x.design_entregue : !['planejamento', 'em_organizacao'].includes(x.status)
      if (entregou) entregues++
      else if (!fechado.includes(x.status)) abertas.push(x)
      if (x.status === 'ajustes') ajustes++
      if (x.data_limite && String(x.data_limite).slice(0, 10) < hoje && !fechado.includes(x.status) && !entregou) atrasadas++
    }
    const ehAdmin = eu.role === 'admin'
    return {
      id: m.id, nome: m.nome || m.email || 'Sem nome', role: m.role, foto_url: m.foto_url ?? null, desde: m.created_at ?? null,
      total, entregues, emAndamento: abertas.length,
      ajustes: ehAdmin ? ajustes : null, atrasadas: ehAdmin ? atrasadas : null,
      recentes: abertas.slice(0, 5).map(x => ({ id: x.id, titulo: x.titulo || 'Sem título', cliente: (Array.isArray(x.cliente) ? x.cliente[0]?.nome : x.cliente?.nome) ?? null, status: x.status })),
    }
  } catch (e: any) {
    return { erro: e?.message || 'Não foi possível abrir o perfil' }
  }
}
