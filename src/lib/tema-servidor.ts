import { getAdminSupabase } from '@/lib/supabase'
import { DEFAULT_BRAND, temaValido, type BrandColors } from '@/lib/tema'

// Só no servidor (usa a service role). As cores do tema não são segredo: valem para todas as páginas.
export async function lerTemaServidor(): Promise<BrandColors> {
  try {
    const { data } = await getAdminSupabase().from('configuracoes').select('valor').eq('chave', 'tema').maybeSingle()
    return temaValido(data?.valor) || DEFAULT_BRAND
  } catch {
    return DEFAULT_BRAND // tabela ainda não criada ou banco fora do ar: usa o padrão
  }
}
