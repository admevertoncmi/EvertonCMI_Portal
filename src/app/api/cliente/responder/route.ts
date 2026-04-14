import { getAdminSupabase } from '@/lib/supabase'
const adminSupabase = getAdminSupabase()
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { material_id, action, feedback = '' } = body

    if (!['aprovar', 'ajustes'].includes(action)) {
      return NextResponse.json({ error: 'Action must be "aprovar" or "ajustes"' }, { status: 400 })
    }

    const { data: material } = await adminSupabase
      .from('materiais')
      .select('*, cliente(nome, telefone)')
      .eq('id', material_id)
      .single()

    if (!material) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 })
    }

    const newStatus = action === 'aprovar' ? 'aprovado' : 'ajustes'

    const { error: updateError } = await adminSupabase
      .from('materiais')
      .update({ status: newStatus })
      .eq('id', material_id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    const token = process.env.CLICKUP_API_TOKEN
    if (!token) {
      console.error('No CLICKUP_API_TOKEN')
      return NextResponse.json({ success: true, clickup: 'skipped' })
    }

    // ClickUp status IDs - REPLACE WITH YOUR WORKSPACE IDs
    const statusId = action === 'aprovado' ? 9 : 4 // e.g. 9=Complete, 4=In Review

    // Update task status
    const statusResponse = await fetch(`https://api.clickup.com/api/v2/task/${material.clickup_task_id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `pk_${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: {
          status: statusId,
          type: 'generic'
        }
      })
    })

    if (!statusResponse.ok) {
      console.error('ClickUp status update failed', await statusResponse.text())
    }

    // Add comment if feedback or ajustes
    if (feedback || action === 'ajustes') {
      const comment = `Cliente respondeu: ${action === 'aprovado' ? 'APROVADO' : 'AJUSTES'} ${feedback ? '\\nFeedback: ' + feedback : ''}`

      const commentResponse = await fetch(`https://api.clickup.com/api/v2/task/${material.clickup_task_id}/comment`, {
        method: 'POST',
        headers: {
          'Authorization': `pk_${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comment
        })
      })

      if (!commentResponse.ok) {
        console.error('ClickUp comment failed', await commentResponse.text())
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Responder error', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

