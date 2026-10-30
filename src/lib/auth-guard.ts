import { createServerClient } from '@/lib/supabase-server'
import { getAdminSupabase } from '@/lib/supabase'
import { normalizePortalToken } from '@/lib/utils'

/**
 * Garante que quem chamou a server action está logado E pertence à equipe
 * (tem linha em perfis_equipe). Server actions são endpoints públicos:
 * toda action do painel precisa chamar isto antes de fazer qualquer coisa.
 */
export async function requireEquipe(roles?: string[]) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado')

  const { data: perfil } = await getAdminSupabase()
    .from('perfis_equipe')
    .select('id, role, email')
    .eq('id', user.id)
    .maybeSingle()

  if (!perfil) throw new Error('Não autorizado')
  if (roles && !roles.includes(perfil.role)) throw new Error('Não autorizado')

  return { user, perfil }
}

export const requireAdmin = () => requireEquipe(['admin'])

/** Resolve o cliente dono de um token mágico do portal, ou lança erro. */
export async function requireClientePorToken(token: string) {
  const admin = getAdminSupabase()
  const tokenUUID = normalizePortalToken(token)
  if (!tokenUUID) throw new Error('Não autorizado')

  let { data: cliente } = await admin.from('clientes').select('*').eq('token_magico', tokenUUID).maybeSingle()
  if (!cliente && tokenUUID !== token) {
    const fallback = await admin.from('clientes').select('*').eq('token_magico', token).maybeSingle()
    cliente = fallback.data
  }
  if (!cliente) throw new Error('Não autorizado')

  return cliente
}
