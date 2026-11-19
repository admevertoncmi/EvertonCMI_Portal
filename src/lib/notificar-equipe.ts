import { getAdminSupabase } from '@/lib/supabase'
import { enviarWhatsApp } from '@/lib/whatsapp'
import { enviarClickUpChat, chatsDosAdmins } from '@/lib/clickup-chat'

// Avisos para a equipe quando o cliente age no portal. Só roda no servidor.
// Canais: 1) notificação dentro da plataforma (sino no topo de todos os painéis),
//         2) WhatsApp de cada membro (campo "WhatsApp para avisos" no cadastro da equipe),
//         3) chat do ClickUp (como antes).

export type TipoAviso = 'mensagem' | 'ajuste' | 'aprovado'

type Membro = { id: string; role: string; nome?: string | null; telegram_thread_id?: string | null; whatsapp?: string | null }

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://evertoncmi.vercel.app').replace(/\/+$/, '')
const ANTI_REPETICAO_MIN = 10 // não manda outro WhatsApp da mesma tarefa à mesma pessoa enquanto o anterior não foi lido

/** Link que abre a tarefa no painel da pessoa. */
function linkDoPainel(m: Membro, materialId: string) {
  if (m.role === 'admin') return `${SITE}/admin/dashboard?conversa=${materialId}`
  if (m.role === 'planner') return `${SITE}/planner?tarefa=${materialId}`
  return `${SITE}/editor?tarefa=${materialId}`
}

export async function avisarEquipe(opts: {
  materialId: string
  tipo: TipoAviso
  titulo: string                  // ex.: "Igor Calixto mandou um áudio"
  texto?: string | null           // ex.: título do conteúdo + trecho da mensagem
  paraAdmins: boolean
  paraResponsaveis: boolean
  whatsapp: boolean
  clickup?: { texto: string; incluirAdmins: boolean } | null
}) {
  const admin = getAdminSupabase()
  const { data: material } = await admin.from('materiais').select('*').eq('id', opts.materialId).maybeSingle()
  if (!material) return

  const { data: perfis } = await admin.from('perfis_equipe').select('*')
  const membros = (perfis || []) as Membro[]
  const idsResponsaveis = new Set([material.planner_id, material.editor_id, material.designer_id, ...(Array.isArray(material.responsaveis) ? material.responsaveis : [])].filter(Boolean))
  const destinatarios = membros.filter(m =>
    (opts.paraAdmins && String(m.role).toLowerCase() === 'admin') || (opts.paraResponsaveis && idsResponsaveis.has(m.id)))
  const responsaveis = membros.filter(m => idsResponsaveis.has(m.id))

  // Quem já tem aviso não lido desta tarefa há pouco tempo não recebe outro WhatsApp (evita enxurrada)
  let recentes = new Set<string>()
  if (opts.whatsapp && destinatarios.length) {
    const desde = new Date(Date.now() - ANTI_REPETICAO_MIN * 60000).toISOString()
    const { data } = await admin.from('notificacoes').select('membro_id')
      .eq('material_id', opts.materialId).eq('lida', false).gte('created_at', desde)
      .in('membro_id', destinatarios.map(d => d.id))
    recentes = new Set((data || []).map(r => r.membro_id as string))
  }

  const tarefas: Promise<unknown>[] = []

  // 1) Dentro da plataforma
  if (destinatarios.length) {
    tarefas.push(Promise.resolve(admin.from('notificacoes').insert(destinatarios.map(d => ({
      membro_id: d.id, material_id: opts.materialId, tipo: opts.tipo,
      titulo: opts.titulo.slice(0, 200), texto: opts.texto ? opts.texto.slice(0, 600) : null,
    })))).then(({ error }) => { if (error) console.error('Notificação na plataforma falhou (rodou supabase-notificacoes.sql?):', error.message) }))
  }

  // 2) WhatsApp
  if (opts.whatsapp) {
    for (const d of destinatarios) {
      const numero = String(d.whatsapp || '').trim()
      if (!numero || recentes.has(d.id)) continue
      const destino = numero.includes('@') || numero.includes('-') ? numero : numero.replace(/\D/g, '')
      if (!destino) continue
      const msg = `🔔 *${opts.titulo}*\n\n${opts.texto || ''}\n\nAbrir a tarefa:\n${linkDoPainel(d, opts.materialId)}`.trim()
      tarefas.push(enviarWhatsApp(msg.slice(0, 3000), destino).catch(e => console.error('WhatsApp da equipe falhou:', e)))
    }
  }

  // 3) ClickUp (responsáveis sempre; admins só quando pedido)
  if (opts.clickup) {
    const ck = opts.clickup
    tarefas.push((async () => {
      const admins = await chatsDosAdmins()
      const chatsResp = responsaveis.map(r => String(r.telegram_thread_id || '').trim()).filter(Boolean)
      const destinos = [...(ck.incluirAdmins ? admins : []), ...chatsResp.filter(c => !admins.includes(c))]
      if (destinos.length) await enviarClickUpChat(ck.texto.slice(0, 4000), destinos)
    })().catch(e => console.error('Aviso no ClickUp falhou:', e)))
  }

  await Promise.all(tarefas)
}
