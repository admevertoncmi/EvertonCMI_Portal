"use client"

// Painel do Editor / Designer. Mesma lógica de antes (fila, entrega por partes, relatar problema,
// avisos no ClickUp, registros e modo "Entrar" do admin), no visual do painel admin.
// Peças comuns com o painel do decupador: src/components/equipe/kit.tsx

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Toaster, toast } from 'sonner'
import {
  ListTodo, CheckCircle2, Clock, Flame, Calendar, List, CalendarRange, CalendarClock, AlertTriangle, Send,
  PlayCircle, Image as ImageIcon, FileVideo, Loader2, Check, Inbox,
} from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { formatRichText } from '@/lib/utils'
import { notificarClickUpChat } from '@/actions/clickup'
import { conversaEquipe } from '@/actions/conversa'
import ConversaMaterial, { type MensagemConversa } from '@/components/ConversaMaterial'
import {
  TeamShell, PageHeader, StatCards, Filtros, GrupoCliente, LinhaTarefa, Vazio, PainelTarefa, Secao, TextoRecolhivel,
  LinkPasta, Modal, CampoLinkDrive, ModalProblema, VisualizadorMidia, Chip, Prazo,
  useTemaEquipe, instrucaoParaPapel, entradasFeedback, passaFiltro, prazoInfo, btnInk, btnLine, cardCls, type FiltroPrazo,
} from '@/components/equipe/kit'

interface Material {
  id: string; cliente_id: string; titulo: string
  ciclo?: string | number; link_drive?: string; link_capa?: string; link_organizado?: string; link_bruto?: string
  data_limite?: string; data_limite_editor?: string; data_limite_designer?: string; roteiro?: string
  video_entregue?: boolean; design_entregue?: boolean
  status: any; created_at: string; tags?: string[]; feedback?: string | null; feedback_admin?: string | null
  editor_id?: string | null; designer_id?: string | null
  cliente?: { nome: string }
}

const PROBLEMA = ['faltando_material', 'verificar_material']

export default function EditorDashboard() {
  const router = useRouter()
  const supabase = createClient()

  const registrarLog = async (materialId: string, evento: string) => {
    await supabase.from('logs_acesso').insert([{ material_id: materialId, evento }])
  }

  const [aba, setAba] = useState<'tarefas' | 'entregues'>('tarefas')
  const [filtro, setFiltro] = useState<FiltroPrazo>('todas')
  const [materiais, setMateriais] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const { theme, alternar } = useTemaEquipe('editorTheme', userId)
  const [userProfile, setUserProfile] = useState<{ nome: string; role: string } | null>(null)
  const [comoAdmin, setComoAdmin] = useState<string | null>(null) // nome do membro quando a admin "entra" no painel dele

  const [abertoId, setAbertoId] = useState<string | null>(null)
  const [conversa, setConversa] = useState<MensagemConversa[]>([])
  const [carregandoConversa, setCarregandoConversa] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const [entregaAberta, setEntregaAberta] = useState(false)
  const [newDriveLink, setNewDriveLink] = useState('')
  const [newCapaLink, setNewCapaLink] = useState('')
  const [problemaAberto, setProblemaAberto] = useState(false)
  const [issueType, setIssueType] = useState<'faltando_material' | 'verificar_material'>('verificar_material')
  const [issueText, setIssueText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    // Modo "Entrar" do admin (?como=<id>): mostra o painel daquele membro. Só vale se quem está logado for admin.
    let alvoId = user.id
    const comoId = new URLSearchParams(window.location.search).get('como')
    if (comoId && comoId !== user.id) {
      const { data: eu } = await supabase.from('perfis_equipe').select('role').eq('id', user.id).maybeSingle()
      if (eu?.role === 'admin') alvoId = comoId
    }
    setUserId(alvoId)
    const { data: profile } = await supabase.from('perfis_equipe').select('*').eq('id', alvoId).single()
    if (profile) {
      // No modo admin, o nome leva "(via admin)": aparece nos registros e avisos das ações feitas aqui
      setUserProfile(alvoId !== user.id ? { ...(profile as any), nome: `${profile.nome || profile.email} (via admin)` } : profile as any)
      setComoAdmin(alvoId !== user.id ? (profile.nome || profile.email) : null)
    }
    const { data: m } = await supabase.from('materiais').select(`*, cliente:clientes(nome)`)
      .or(`editor_id.eq.${alvoId},designer_id.eq.${alvoId}`)
      .order('ordem', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false })
    if (m) setMateriais(m as Material[])
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (!userId) return
    const atualizar = (payload: any) => setMateriais(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new, cliente: m.cliente } : m))
    const channel = supabase.channel('editor-realtime-sync')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'materiais', filter: `editor_id=eq.${userId}` }, atualizar)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'materiais', filter: `designer_id=eq.${userId}` }, atualizar)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'materiais' }, () => loadData())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'materiais' }, (payload) => setMateriais(prev => prev.filter(m => m.id !== payload.old.id)))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadData, userId])

  const papel = userProfile?.role === 'designer' ? 'designer' : 'editor'
  const papelLabel = papel === 'designer' ? 'Designer' : 'Editor'
  const prazoDe = (m: Material) => papel === 'designer' ? (m.data_limite_designer || m.data_limite) : (m.data_limite_editor || m.data_limite)
  const souEditorDe = (m: Material) => m.editor_id === userId
  const souDesignerDe = (m: Material) => m.designer_id === userId
  const comProblema = (m: Material) => PROBLEMA.includes(m.status)

  // Fila: em produção, em ajuste ou com problema relatado, e a minha parte ainda não entregue
  const fila = useMemo(() => materiais.filter(m => {
    if (!['ajustes', 'em_edicao', ...PROBLEMA].includes(m.status)) return false
    return (souEditorDe(m) && !m.video_entregue) || (souDesignerDe(m) && !m.design_entregue)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [materiais, userId])

  const entregues = useMemo(() => materiais.filter(m => {
    const ed = souEditorDe(m), de = souDesignerDe(m)
    if (m.status === 'revisao') return true
    if (m.status === 'ajustes' || m.status === 'em_edicao') {
      if (ed && !de && m.video_entregue) return true
      if (de && !ed && m.design_entregue) return true
      if (ed && de && m.video_entregue && m.design_entregue) return true
    }
    return false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [materiais, userId])

  const filaFiltrada = useMemo(() => fila.filter(m => passaFiltro(prazoDe(m), filtro)), [fila, filtro, papel])
  const stats = useMemo(() => ({
    total: fila.length,
    hoje: fila.filter(m => prazoInfo(prazoDe(m)).hoje).length,
    atrasadas: fila.filter(m => prazoInfo(prazoDe(m)).late).length,
    ajustes: fila.filter(m => m.status === 'ajustes').length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [fila, papel])

  const porCliente = (lista: Material[]) => {
    const g: Record<string, { nome: string; itens: Material[] }> = {}
    lista.forEach(m => { (g[m.cliente_id] = g[m.cliente_id] || { nome: m.cliente?.nome || 'Sem cliente', itens: [] }).itens.push(m) })
    Object.values(g).forEach(x => x.itens.sort((a, b) => (prazoDe(a) || '9999').localeCompare(prazoDe(b) || '9999')))
    return Object.values(g).sort((a, b) => a.nome.localeCompare(b.nome))
  }

  const aberto = materiais.find(m => m.id === abertoId) || null

  // Conversa com o cliente (pedido de ajuste com fotos e áudios), só leitura para a equipe de produção
  useEffect(() => {
    setConversa([])
    if (!aberto || aberto.status !== 'ajustes') return
    setCarregandoConversa(true)
    conversaEquipe(aberto.id).then(setConversa).catch(() => setConversa([])).finally(() => setCarregandoConversa(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abertoId, aberto?.status])

  const statusDe = (m: Material) => {
    if (m.status === 'revisao') return <Chip cor="green">Entregue</Chip>
    if (comProblema(m)) return <Chip cor="amber">Problema relatado</Chip>
    if (m.status === 'ajustes') return <Chip cor="red">Ajuste do cliente</Chip>
    if ((souEditorDe(m) && m.video_entregue) || (souDesignerDe(m) && m.design_entregue)) return <Chip cor="green">Minha parte entregue</Chip>
    return <Chip cor="blue">Em produção</Chip>
  }

  const partes = (m: Material) => (
    <span className="inline-flex items-center gap-1.5">
      {m.editor_id && <span title={m.video_entregue ? 'Vídeo entregue' : 'Vídeo pendente'} className={`inline-flex items-center gap-1 ${m.video_entregue ? 'text-green-600 dark:text-green-400' : ''}`}><FileVideo size={13} />Vídeo{m.video_entregue && <Check size={12} strokeWidth={3} />}</span>}
      {m.editor_id && m.designer_id && <span className="text-zinc-300 dark:text-zinc-600">·</span>}
      {m.designer_id && <span title={m.design_entregue ? 'Capa entregue' : 'Capa pendente'} className={`inline-flex items-center gap-1 ${m.design_entregue ? 'text-green-600 dark:text-green-400' : ''}`}><ImageIcon size={13} />Capa{m.design_entregue && <Check size={12} strokeWidth={3} />}</span>}
    </span>
  )

  // ---------- ações ----------
  const abrirEntrega = (m: Material) => {
    setAbertoId(m.id)
    // Campos começam vazios: não dá para "entregar" o link antigo nem o vídeo do colega por engano
    setNewDriveLink(''); setNewCapaLink('')
    setEntregaAberta(true)
  }
  const abrirProblema = (m: Material) => {
    setAbertoId(m.id); setIssueType('verificar_material'); setIssueText(''); setProblemaAberto(true)
  }

  const handleSendNewVersion = async () => {
    const sel = aberto
    if (!sel) return
    const souEditor = souEditorDe(sel), souDesigner = souDesignerDe(sel)
    const isVideoFilled = !!newDriveLink.trim()
    const isDesignFilled = !!newCapaLink.trim()
    // Precisa enviar a(s) parte(s) que são suas e ainda não foram entregues
    if ((souEditor && !sel.video_entregue && !isVideoFilled) || (souDesigner && !sel.design_entregue && !isDesignFilled)) {
      return toast.error('Envie o link da sua parte antes de entregar.')
    }
    setIsSubmitting(true)
    const willVideoBeDone = souEditor ? (isVideoFilled || !!sel.video_entregue) : sel.video_entregue
    const willDesignBeDone = souDesigner ? (isDesignFilled || !!sel.design_entregue) : sel.design_entregue
    const isGlobalComplete = (!sel.editor_id || willVideoBeDone) && (!sel.designer_id || willDesignBeDone)
    const statusFinal = isGlobalComplete ? 'revisao' : sel.status

    const { error } = await supabase.from('materiais').update({
      link_drive: (souEditor && isVideoFilled ? newDriveLink.trim() : null) || sel.link_drive,
      link_capa: (souDesigner && isDesignFilled ? newCapaLink.trim() : null) || sel.link_capa,
      video_entregue: willVideoBeDone,
      design_entregue: willDesignBeDone,
      status: statusFinal,
    }).eq('id', sel.id)

    if (error) toast.error('Erro ao enviar: ' + error.message)
    else {
      const roleTag = papel === 'designer' ? 'DESIGNER' : 'EDITOR'
      if (isGlobalComplete) {
        toast.success('Tudo entregue! O material foi para a revisão da agência.')
        await notificarClickUpChat(`🔔 REVISÃO PENDENTE (ADMIN)\n\n👤: ${roleTag}\n${userProfile?.nome || 'Equipe'}\n\n📍 **${sel.cliente?.nome}**\n🎬 ${sel.titulo}`)
      } else {
        toast.success('Sua parte foi entregue! O admin já pode ir conferindo.')
      }
      registrarLog(sel.id, `✅ ${roleTag} (${userProfile?.nome || 'Equipe'}) entregou a parte dele(a)`)
      setEntregaAberta(false)
      setAbertoId(null)
      loadData()
    }
    setIsSubmitting(false)
  }

  const handleReportIssue = async () => {
    const sel = aberto
    if (!sel || !issueText.trim()) return toast.error('Descreva o problema.')
    setIsSubmitting(true)
    const sanitized = issueText.replace(/\n\n/g, '\n \n')
    const now = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    const feedback = `[ID:${userId}] [DATE:${now}] ${sanitized}${sel.feedback ? `\n\n${sel.feedback}` : ''}`
    const { error } = await supabase.from('materiais').update({ status: issueType, feedback }).eq('id', sel.id)
    if (error) toast.error('Erro ao relatar o problema.')
    else {
      registrarLog(sel.id, `❌ Devolvido por ${papelLabel} (${userProfile?.nome || 'Equipe'}): ${sanitized}`)
      toast.success('Problema enviado para o admin.')
      const roleTag = papel === 'designer' ? 'DESIGNER' : 'EDITOR'
      await notificarClickUpChat(`🔔 PROBLEMA NA PRODUÇÃO\n\n👤: ${roleTag}\n${userProfile?.nome || 'Equipe'}\n\n📍 **${sel.cliente?.nome}**\n🎬 ${sel.titulo}\n\n🔔 MOTIVO: ${issueText.toUpperCase()}`)
      setProblemaAberto(false)
      loadData()
    }
    setIsSubmitting(false)
  }

  // ---------- tela ----------
  const linha = (m: Material, modo: 'fila' | 'entregue') => (
    <LinhaTarefa key={m.id} onClick={() => setAbertoId(m.id)} apagada={modo === 'fila' && comProblema(m)}
      titulo={m.titulo}
      sub={<><span>Ciclo {m.ciclo || 1}</span><span className="text-zinc-300 dark:text-zinc-600">·</span>{partes(m)}</>}
      status={statusDe(m)}
      prazo={modo === 'fila' ? <Prazo data={prazoDe(m)} /> : null}
      acao={modo === 'entregue'
        ? ((m.link_drive || m.link_capa) ? <button type="button" className={`${btnLine} !py-1.5 !px-3 !text-xs`} onClick={() => setPreviewUrl(m.link_drive || m.link_capa || null)}><PlayCircle size={14} /> Ver entrega</button> : null)
        : comProblema(m)
          ? <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400"><Clock size={13} /> Aguardando admin</span>
          : <button type="button" className={`${btnInk} !py-2 !px-3.5`} onClick={() => abrirEntrega(m)}><Send size={14} /> Entregar</button>}
    />
  )

  const feedbackEquipe = aberto ? entradasFeedback(aberto.feedback).filter(e => e.daEquipe) : []
  const instrucao = aberto ? instrucaoParaPapel(aberto.feedback_admin, papel) : ''
  const precisaVideo = !!aberto && souEditorDe(aberto) && !aberto.video_entregue
  const precisaCapa = !!aberto && souDesignerDe(aberto) && !aberto.design_entregue
  const podeEntregar = (!precisaVideo || !!newDriveLink.trim()) && (!precisaCapa || !!newCapaLink.trim())
  const naFila = !!aberto && fila.some(m => m.id === aberto.id)

  return (
    <TeamShell papel={papelLabel} membroId={userId} nome={(comoAdmin || userProfile?.nome || '').replace(' (via admin)', '')}
      menu={[
        { id: 'tarefas', label: 'Minhas tarefas', icon: ListTodo, count: fila.length },
        { id: 'entregues', label: 'Entregues', icon: CheckCircle2 },
      ]}
      ativo={aba} onMenu={(id) => setAba(id as any)} theme={theme} alternarTema={alternar}
      comoAdmin={comoAdmin} onSair={() => supabase.auth.signOut().then(() => router.push('/'))}>
      <Toaster position="top-right" richColors theme={theme} />

      {loading ? (
        <div className="flex items-center justify-center py-24 text-zinc-500"><Loader2 className="animate-spin mr-2" size={18} /> Carregando suas tarefas…</div>
      ) : aba === 'tarefas' ? (
        <>
          <PageHeader icon={ListTodo} titulo={`Olá${userProfile?.nome ? `, ${(comoAdmin || userProfile.nome).split(' ')[0]}` : ''}`}
            meta={stats.total ? `${stats.total} ${stats.total === 1 ? 'tarefa' : 'tarefas'} para fazer${stats.atrasadas ? ` · ${stats.atrasadas} atrasada${stats.atrasadas > 1 ? 's' : ''}` : ''}` : 'Nada pendente por aqui'} />
          <StatCards itens={[
            { label: 'Para fazer', valor: stats.total, icon: ListTodo, onClick: () => setFiltro('todas'), ativo: filtro === 'todas' },
            { label: 'Para hoje', valor: stats.hoje, icon: Calendar, destaque: 'amber', onClick: () => setFiltro('hoje'), ativo: filtro === 'hoje' },
            { label: 'Atrasadas', valor: stats.atrasadas, icon: Flame, destaque: 'red', onClick: () => setFiltro('atrasadas'), ativo: filtro === 'atrasadas' },
            { label: 'Ajustes do cliente', valor: stats.ajustes, icon: AlertTriangle, destaque: 'red' },
          ]} />
          <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
            <h2 className="text-lg font-semibold">Minhas tarefas</h2>
            <div className="md:ml-auto">
              <Filtros<FiltroPrazo> valor={filtro} onChange={setFiltro} opcoes={[
                { id: 'todas', label: 'Todas', icon: List }, { id: 'hoje', label: 'Para hoje', icon: Calendar },
                { id: 'atrasadas', label: 'Atrasadas', icon: Flame }, { id: 'semana', label: 'Esta semana', icon: CalendarRange },
                { id: 'futura', label: 'Próximas', icon: CalendarClock },
              ]} />
            </div>
          </div>
          {filaFiltrada.length === 0
            ? <Vazio icon={Inbox} titulo={fila.length ? 'Nada neste filtro' : 'Tudo em dia!'} texto={fila.length ? 'Troque o filtro para ver as outras tarefas.' : 'Quando o admin te passar uma tarefa, ela aparece aqui.'} />
            : porCliente(filaFiltrada).map(g => (
              <GrupoCliente key={g.nome} nome={g.nome} meta={`${g.itens.length} ${g.itens.length === 1 ? 'tarefa' : 'tarefas'}`}>
                {g.itens.map(m => linha(m, 'fila'))}
              </GrupoCliente>
            ))}
        </>
      ) : (
        <>
          <PageHeader icon={CheckCircle2} titulo="Entregues" meta={`${entregues.length} ${entregues.length === 1 ? 'material entregue' : 'materiais entregues'} aguardando a agência`} />
          {entregues.length === 0
            ? <Vazio icon={CheckCircle2} titulo="Nenhuma entrega em revisão" texto="O que você entregar aparece aqui até a agência aprovar." />
            : porCliente(entregues).map(g => (
              <GrupoCliente key={g.nome} nome={g.nome} meta={`${g.itens.length} ${g.itens.length === 1 ? 'entrega' : 'entregas'}`}>
                {g.itens.map(m => linha(m, 'entregue'))}
              </GrupoCliente>
            ))}
        </>
      )}

      {/* PAINEL DA TAREFA */}
      <PainelTarefa aberto={!!aberto && !entregaAberta && !problemaAberto} onFechar={() => setAbertoId(null)}
        crumb={`${aberto?.cliente?.nome || ''} · Ciclo ${aberto?.ciclo || 1}`} titulo={aberto?.titulo || ''}
        status={aberto && <>{statusDe(aberto)}<Prazo data={prazoDe(aberto)} /></>}
        acoes={aberto && naFila && (comProblema(aberto)
          ? <p className="text-[13px] text-amber-700 dark:text-amber-400 flex items-center gap-1.5"><Clock size={14} /> Você relatou um problema. Aguardando o admin resolver.</p>
          : <>
            <button type="button" className={btnInk} onClick={() => abrirEntrega(aberto)}><Send size={15} /> Entregar minha parte</button>
            <button type="button" className={btnLine} onClick={() => abrirProblema(aberto)}><AlertTriangle size={15} /> Relatar problema</button>
          </>)}>
        {aberto && <>
          <Secao titulo="Partes do material">
            <div className="grid sm:grid-cols-2 gap-2">
              {aberto.editor_id && (
                <div className={`${cardCls} rounded-xl px-3.5 py-3 flex items-center gap-3`}>
                  <FileVideo size={18} className="text-zinc-400" />
                  <div className="flex-1 min-w-0"><p className="text-[13px] font-medium">Vídeo {souEditorDe(aberto) && <span className="text-zinc-400 font-normal">(seu)</span>}</p><p className={`text-xs ${aberto.video_entregue ? 'text-green-600 dark:text-green-400' : 'text-zinc-500'}`}>{aberto.video_entregue ? 'Entregue' : 'Pendente'}</p></div>
                  {aberto.link_drive && <button type="button" className={`${btnLine} !py-1.5 !px-3 !text-xs`} onClick={() => setPreviewUrl(aberto.link_drive!)}>Ver</button>}
                </div>
              )}
              {aberto.designer_id && (
                <div className={`${cardCls} rounded-xl px-3.5 py-3 flex items-center gap-3`}>
                  <ImageIcon size={18} className="text-zinc-400" />
                  <div className="flex-1 min-w-0"><p className="text-[13px] font-medium">Capa {souDesignerDe(aberto) && <span className="text-zinc-400 font-normal">(sua)</span>}</p><p className={`text-xs ${aberto.design_entregue ? 'text-green-600 dark:text-green-400' : 'text-zinc-500'}`}>{aberto.design_entregue ? 'Entregue' : 'Pendente'}</p></div>
                  {aberto.link_capa && <button type="button" className={`${btnLine} !py-1.5 !px-3 !text-xs`} onClick={() => setPreviewUrl(aberto.link_capa!)}>Ver</button>}
                </div>
              )}
            </div>
            {aberto.status === 'ajustes' && (aberto.link_drive || aberto.link_capa) && <p className="text-xs text-zinc-500 mt-2">Os links acima são da versão que o cliente viu.</p>}
          </Secao>

          {aberto.status === 'ajustes' && (
            <Secao titulo="O que o cliente pediu">
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <ConversaMaterial somenteLeitura className="max-h-[360px]" mensagens={conversa} carregando={carregandoConversa} perspectiva="equipe"
                  dark={theme === 'dark'} onEnviar={async () => false} vazio="O pedido de ajuste ainda não tem detalhes." />
              </div>
            </Secao>
          )}

          {feedbackEquipe.length > 0 && (
            <Secao titulo="Problemas relatados">
              <div className="space-y-2">
                {feedbackEquipe.map((e, i) => (
                  <div key={i} className={`rounded-xl px-3.5 py-2.5 text-[13px] ${i === 0 ? 'bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200' : 'bg-zinc-50 text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300'}`}>
                    {e.data && <p className="text-xs opacity-70 mb-0.5">{e.data}</p>}
                    <p className="whitespace-pre-wrap">{e.texto}</p>
                  </div>
                ))}
              </div>
            </Secao>
          )}

          {instrucao && (
            <Secao titulo="Instrução do admin">
              <div className="rounded-xl bg-blue-50/60 dark:bg-blue-900/15 border border-blue-100 dark:border-blue-900/40 px-4 py-3 text-zinc-800 dark:text-zinc-100"><TextoRecolhivel texto={instrucao} /></div>
            </Secao>
          )}

          <Secao titulo="Pastas">
            <div className="space-y-2">
              <LinkPasta label="Pasta decupada (material organizado)" url={aberto.link_organizado} />
              <LinkPasta label="Pasta bruta (material original)" url={aberto.link_bruto} />
            </div>
          </Secao>

          <Secao titulo="Roteiro">
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-3.5">
              <div className="ql-editor !p-0 text-sm leading-relaxed whitespace-pre-wrap break-words [&_a]:text-brand [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: formatRichText(aberto.roteiro, 'Nenhum roteiro nesta tarefa.') }} />
            </div>
          </Secao>
        </>}
      </PainelTarefa>

      {/* ENTREGA */}
      <Modal aberto={entregaAberta && !!aberto} onFechar={() => setEntregaAberta(false)} titulo="Entregar minha parte" descricao={aberto?.titulo}
        rodape={<>
          <button type="button" className={btnLine} onClick={() => setEntregaAberta(false)} disabled={isSubmitting}>Cancelar</button>
          <button type="button" className={btnInk} onClick={handleSendNewVersion} disabled={isSubmitting || !podeEntregar}>{isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Entregar</button>
        </>}>
        {aberto && <>
          {aberto.status === 'ajustes' && <p className="text-[13px] rounded-xl bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200 px-3.5 py-2.5">É um ajuste: envie o link da <b>nova versão</b>, já corrigida.</p>}
          {precisaVideo && <CampoLinkDrive label="Link do vídeo" valor={newDriveLink} onChange={setNewDriveLink} tipo="file" placeholder="Cole o link do vídeo no Drive" />}
          {precisaCapa && <CampoLinkDrive label="Link da capa" valor={newCapaLink} onChange={setNewCapaLink} tipo="file" placeholder="Cole o link da capa no Drive" />}
          {!precisaVideo && !precisaCapa && <p className="text-[13px] text-zinc-500">Sua parte deste material já foi entregue.</p>}
          {aberto.editor_id && aberto.designer_id && <p className="text-xs text-zinc-500">Este material tem vídeo e capa. Ele vai para a revisão da agência quando as duas partes estiverem entregues.</p>}
        </>}
      </Modal>

      <ModalProblema aberto={problemaAberto && !!aberto} onFechar={() => setProblemaAberto(false)} titulo={aberto?.titulo || ''}
        tipo={issueType} onTipo={setIssueType} texto={issueText} onTexto={setIssueText} enviando={isSubmitting} onEnviar={handleReportIssue} />

      <VisualizadorMidia url={previewUrl} onFechar={() => setPreviewUrl(null)} />
    </TeamShell>
  )
}
