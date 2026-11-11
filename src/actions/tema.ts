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
