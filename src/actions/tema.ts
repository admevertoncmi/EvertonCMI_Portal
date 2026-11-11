'use server'

import { getAdminSupabase } from '@/lib/supabase'
import { requireAdmin, requireEquipe } from '@/lib/auth-guard'
import { temaValido, type BrandColors } from '@/lib/tema'
import { lerTemaServidor } from '@/lib/tema-servidor'

/** Tema atual (para a tela de Configurações). */
export async function lerTemaEquipe(): Promise<BrandColors> {
  await requireEquipe()
  return lerTemaServidor()
}

/** Salva o tema para todo o sistema. Só admin. */
export async function salvarTema(cores: BrandColors) {
  const { user } = await requireAdmin()
  const tema = temaValido(cores)
  if (!tema) throw new Error('Cores inválidas')
  const { error } = await getAdminSupabase().from('configuracoes').upsert({
    chave: 'tema', valor: tema, atualizado_em: new Date().toISOString(), atualizado_por: user.id,
  })
  if (error) throw new Error(error.message)
  return tema
}

// Paleta pessoal de cada membro da equipe (linha 'paleta:<id>' na mesma tabela).
// Pode ler/mudar: o próprio membro, ou a admin quando "entra" no painel dele.
async function podeMexerNaPaleta(membroId: string) {
  const { perfil } = await requireEquipe()
  if (perfil.id !== membroId && perfil.role !== 'admin') throw new Error('Não autorizado')
}

export async function lerPaletaMembro(membroId: string): Promise<BrandColors | null> {
  await podeMexerNaPaleta(membroId)
  const { data } = await getAdminSupabase().from('configuracoes').select('valor').eq('chave', `paleta:${membroId}`).maybeSingle()
  return temaValido(data?.valor)
}

/** Salva a paleta do membro; null volta para o padrão do sistema. */
export async function salvarPaletaMembro(membroId: string, cores: BrandColors | null) {
  const { user } = await requireEquipe()
  await podeMexerNaPaleta(membroId)
  const db = getAdminSupabase().from('configuracoes')
  if (!cores) {
    const { error } = await db.delete().eq('chave', `paleta:${membroId}`)
    if (error) throw new Error(error.message)
    return null
  }
  const tema = temaValido(cores)
  if (!tema) throw new Error('Cores inválidas')
  const { error } = await db.upsert({ chave: `paleta:${membroId}`, valor: tema, atualizado_em: new Date().toISOString(), atualizado_por: user.id })
  if (error) throw new Error(error.message)
  return tema
}
