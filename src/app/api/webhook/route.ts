import { createServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

const CLICKUP_TOKEN = 'pk_81597562_SYUPP3VKNK8LXG76KMSPE2VUJLBOKIE4'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('🔔 Webhook ClickUp Recebido:', body.event)

    // 1. Validar se o evento é a mudança de status para 'Aprovação'
    if (body.event === 'taskStatusUpdated' && body.history_items?.[0]?.after?.status === 'aprovação') {
      const taskId = body.task_id

      // 2. Buscar detalhes da tarefa (API v2)
      const taskRes = await fetch(`https://api.clickup.com/api/v2/task/${taskId}`, {
        headers: {
          'Authorization': CLICKUP_TOKEN,
          'Content-Type': 'application/json'
        }
      })

      if (!taskRes.ok) return NextResponse.json({ error: 'Falha ao buscar tarefa no ClickUp' }, { status: 500 })

      const taskData = await taskRes.json() 

      // 3. Extrair Título, Descrição (Roteiro) e o Link Bruto do Drive
      const title = taskData.name
      const description = taskData.description || '' 
      
      const driveRegex = /(https:\/\/drive\.google\.com\/[^\s]+)/
      const driveMatch = description.match(driveRegex)
      
      // ✅ O link extraído do ClickUp agora será o nosso link_bruto!
      const linkExtraido = driveMatch ? driveMatch[0] : null

      // 4. Extrair ClienteID dos Custom Fields (para saber de qual cliente é a tarefa)
      let cliente_id = null
      if (taskData.custom_fields) {
        const clienteField = taskData.custom_fields.find((field: any) => 
          field.name.toLowerCase().includes('clienteid') || 
          field.name.toLowerCase() === 'cliente'
        )
        cliente_id = clienteField?.value
      }

      if (!cliente_id) {
        console.warn('⚠️ Tarefa sem ClienteID:', taskId)
        return NextResponse.json({ error: 'ClienteID não encontrado na tarefa' }, { status: 400 })
      }

      // 5. Integração com o Supabase
      const supabase = await createServerClient()

      // Verificar se o cliente existe no banco
      const { data: client } = await supabase
        .from('clientes')
        .select('id')
        .eq('id', cliente_id)
        .single()

      if (!client) return NextResponse.json({ error: 'Cliente não cadastrado no Assent' }, { status: 404 })

      // 🚨 REGRA INTELIGENTE DE STATUS
      // Se houver um link, trata-se de um vídeo para aprovação ('pendente'). Se for só texto, é 'roteiro_pendente'.
      const statusDefinido = linkExtraido ? 'pendente' : 'roteiro_pendente'

      // 6. Inserir Material com as novas colunas
      const { error } = await supabase
        .from('materiais')
        .insert({
          cliente_id: client.id,
          titulo: title,
          roteiro: description,     // Salva o texto do roteiro
          link_bruto: linkExtraido, // ✅ Salva na coluna link_bruto
          status: statusDefinido,   // Direciona para a aba correta do portal
          clickup_task_id: taskId,
          ciclo: 1                  // Padrão para ciclo 1
        })

      if (error) throw error

      return NextResponse.json({ success: true, message: 'Material sincronizado com sucesso!' })
    }

    return NextResponse.json({ success: true, message: 'Evento ignorado' })
  } catch (error: any) {
    console.error('❌ Erro no Webhook:', error.message)
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 })
  }
}