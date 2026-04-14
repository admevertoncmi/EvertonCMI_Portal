import { AdminDashboard } from '@/components/AdminDashboard'
import type { Material, Cliente } from '@/types/assent'
import { createServerClient } from '@/lib/supabase-server'

export default async function Dashboard() {
const supabase = await createServerClient()

  const [materiaisResult, clientesResult] = await Promise.all([
    supabase
      .from('materiais')
      .select(`
        *,
        cliente:clientes(nome, token_magico, telefone),
        logs_acesso(created_at, evento)
      `)
      .order('created_at', { ascending: false }),
    supabase.from('clientes').select('*')
  ])

  const materiais = materiaisResult.data as Material[] || []
  const clientes = clientesResult.data as Cliente[] || []

  if (materiaisResult.error) {
    throw new Error(`Erro ao buscar materiais: ${materiaisResult.error.message}`)
  }

  if (clientesResult.error) {
    throw new Error(`Erro ao buscar clientes: ${clientesResult.error.message}`)
  }

  return <AdminDashboard materials={materiais} initialClientes={clientes} />






}
