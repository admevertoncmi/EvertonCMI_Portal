"use client"

// Painel do Decupador. Mesma lógica de antes (fila, começar decupagem, relatar problema, entregar pasta,
// limpar "Cópia de", avisos no ClickUp, registros e modo "Entrar" do admin), no visual do painel admin.
// Peças comuns com o painel do editor: src/components/equipe/kit.tsx

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Toaster, toast } from 'sonner'
import {
  FolderDown, FolderCheck, ListTodo, Calendar, Flame, List, CalendarRange, CalendarClock, AlertTriangle, Play,
  CheckCircle2, Loader2, Eraser, Inbox, Undo2, Clock, ExternalLink,
} from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { formatRichText } from '@/lib/utils'
import { notificarClickUpChat } from '@/actions/clickup'
import { cleanCopyOfPrefix } from '@/actions/google-mutations'
import {
  TeamShell, PageHeader, StatCards, Filtros, GrupoCliente, LinhaTarefa, Vazio, PainelTarefa, Secao, TextoRecolhivel,
  LinkPasta, Modal, CampoLinkDrive, ModalProblema, Chip, Prazo,
  useTemaEquipe, instrucaoParaPapel, entradasFeedback, passaFiltro, prazoInfo, getGoogleDriveId, garantirGoogleIdentity,
  btnInk, btnLine, type FiltroPrazo,
} from '@/components/equipe/kit'

interface Material {
  id: string; cliente_id: string; titulo: string
  link_drive?: string; link_bruto?: string; link_organizado?: string
  data_limite?: string; status: any; created_at: string
  roteiro?: string | null; planner_id?: string | null
  feedback?: string | null; feedback_admin?: string | null; ciclo?: number
  cliente?: { nome: string }
}

const FILA = ['planejamento', 'em_organizacao', 'faltando_material', 'verificar_material']
const PROBLEMA = ['faltando_material', 'verificar_material']

// link_bruto pode trazer "pasta do ciclo" e "pasta da tarefa" separadas por espaço (convenção do painel admin)
const brutoDoCiclo = (m: Material) => (m.link_bruto || m.link_drive || '').split(' ')[0]
const brutoDaTarefa = (m: Material) => { const p = (m.link_bruto || m.link_drive || '').split(' ').filter(Boolean); return p[1] || p[0] || '' }

export default function DecupadorDashboard() {
  const router = useRouter()
  const supabase = createClient()

  const registrarLog = async (materialId: string, evento: string) => {
    await supabase.from('logs_acesso').insert([{ material_id: materialId, evento }])
  }

  const [aba, setAba] = useState<'fila' | 'prontas'>('fila')
  const [filtro, setFiltro] = useState<FiltroPrazo>('todas')
  const [materiais, setMateriais] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const { theme, alternar } = useTemaEquipe('plannerTheme', userId)
  const [userProfile, setUserProfile] = useState<{ nome: string; role: string } | null>(null)
  const [comoAdmin, setComoAdmin] = useState<string | null>(null) // nome do membro quando a admin "entra" no painel dele

  const [abertoId, setAbertoId] = useState<string | null>(null)
  const [entregaAberta, setEntregaAberta] = useState(false)
  const [newDriveLink, setNewDriveLink] = useState('')
  const [problemaAberto, setProblemaAberto] = useState(false)
  const [issueType, setIssueType] = useState<'faltando_material' | 'verificar_material'>('faltando_material')
  const [issueText, setIssueText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mudandoStatus, setMudandoStatus] = useState<string | null>(null)
  const [limpando, setLimpando] = useState<Record<string, boolean>>({})

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
    const { data: m } = await supabase.from('materiais').select(`*, cliente:clientes(nome)`).eq('planner_id', alvoId)
      .order('ordem', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false })
    if (m) setMateriais(m as Material[])
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (!userId) return
    // Atualiza em silêncio (antes avisava a cada mudança, inclusive as do próprio decupador)
    const channel = supabase.channel('decupador-realtime-sync')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'materiais', filter: `planner_id=eq.${userId}` }, (payload) =>
        setMateriais(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new, cliente: m.cliente } : m)))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'materiais', filter: `planner_id=eq.${userId}` }, () => loadData())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'materiais', filter: `planner_id=eq.${userId}` }, (payload) =>
        setMateriais(prev => prev.filter(m => m.id !== payload.old.id)))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadData, userId])

  const fila = useMemo(() => materiais.filter(m => FILA.includes(m.status)), [materiais])
  const prontas = useMemo(() => materiais.filter(m => m.status === 'organizado'), [materiais])
  const filaFiltrada = useMemo(() => fila.filter(m => passaFiltro(m.data_limite, filtro)), [fila, filtro])
  const stats = useMemo(() => ({
    total: fila.length,
    hoje: fila.filter(m => prazoInfo(m.data_limite).hoje).length,
    atrasadas: fila.filter(m => prazoInfo(m.data_limite).late).length,
    problema: fila.filter(m => PROBLEMA.includes(m.status)).length,
  }), [fila])

  // Cliente > ciclo (cada ciclo mostra a pasta bruta geral e o "Limpar Cópia de")
  const agrupar = (lista: Material[]) => {
    const g: Record<string, { nome: string; ciclos: Record<string, { itens: Material[]; bruto: string }> }> = {}
    lista.forEach(m => {
      const c = (g[m.cliente_id] = g[m.cliente_id] || { nome: m.cliente?.nome || 'Sem cliente', ciclos: {} })
      const k = String(m.ciclo || 1)
      const ciclo = (c.ciclos[k] = c.ciclos[k] || { itens: [], bruto: '' })
      ciclo.itens.push(m)
      if (!ciclo.bruto) ciclo.bruto = brutoDoCiclo(m)
    })
    Object.values(g).forEach(c => Object.values(c.ciclos).forEach(ci => ci.itens.sort((a, b) => (a.data_limite || '9999').localeCompare(b.data_limite || '9999'))))
    return Object.values(g).sort((a, b) => a.nome.localeCompare(b.nome))
  }

  const aberto = materiais.find(m => m.id === abertoId) || null

  const statusDe = (m: Material) => {
    if (m.status === 'organizado') return <Chip cor="green">Pasta entregue</Chip>
    if (PROBLEMA.includes(m.status)) return <Chip cor="amber">{m.status === 'faltando_material' ? 'Falta material' : 'Material com problema'}</Chip>
    if (m.status === 'em_organizacao') return <Chip cor="blue">Decupando</Chip>
    return <Chip cor="zinc">Na fila</Chip>
  }

  // ---------- ações ----------
  const mudarStatus = async (m: Material, novo: 'planejamento' | 'em_organizacao') => {
    setMudandoStatus(m.id)
    setMateriais(prev => prev.map(x => x.id === m.id ? { ...x, status: novo } : x))
    const { error } = await supabase.from('materiais').update({ status: novo }).eq('id', m.id)
    if (error) { toast.error('Erro ao atualizar.'); loadData() }
    else {
      toast.success(novo === 'em_organizacao' ? 'Decupagem iniciada.' : 'Tarefa voltou para a fila.')
      registrarLog(m.id, `🔄 Status alterado para: ${novo} (por ${userProfile?.nome || 'Decupador'})`)
    }
    setMudandoStatus(null)
  }

  const abrirEntrega = (m: Material) => { setAbertoId(m.id); setNewDriveLink(''); setEntregaAberta(true) } // começa vazio (antes vinha a pasta bruta)
  const abrirProblema = (m: Material) => { setAbertoId(m.id); setIssueType('faltando_material'); setIssueText(''); setProblemaAberto(true) }

  const handleReportIssue = async () => {
    const sel = aberto
    if (!sel || !issueText.trim()) return toast.error('Descreva o problema.')
    setIsSubmitting(true)
    // Soma ao histórico (antes apagava os relatos anteriores)
    const now = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    const feedback = `[ID:${userId}] [DATE:${now}] ${issueText.replace(/\n\n/g, '\n \n')}${sel.feedback ? `\n\n${sel.feedback}` : ''}`
    const { error } = await supabase.from('materiais').update({ status: issueType, feedback }).eq('id', sel.id)
    if (error) toast.error('Erro: ' + error.message)
    else {
      toast.success('Problema enviado para o admin.')
      registrarLog(sel.id, `⚠️ Devolvido com problema pelo DECUPADOR (${userProfile?.nome || 'Equipe'}): ${issueText}`)
      await notificarClickUpChat(`🔔 PROBLEMA NA DECUPAGEM\n\n👤: DECUPADOR\n${userProfile?.nome || 'Equipe'}\n\n📍 **${sel.cliente?.nome}**\n🎬 ${sel.titulo}\n\n🔔 MOTIVO: ${issueText.toUpperCase()}`)
      setProblemaAberto(false)
      loadData()
    }
    setIsSubmitting(false)
  }

  const handleDeliverOrganization = async () => {
    const sel = aberto
    if (!sel || !newDriveLink.trim()) return toast.error('Informe o link da pasta organizada.')
    if (newDriveLink.trim() === brutoDaTarefa(sel) || newDriveLink.trim() === brutoDoCiclo(sel)) {
      return toast.error('Esse é o link da pasta bruta. Envie a pasta já organizada.')
    }
    setIsSubmitting(true)
    const { error } = await supabase.from('materiais').update({ link_organizado: newDriveLink.trim(), status: 'organizado' }).eq('id', sel.id)
    if (error) toast.error('Erro: ' + error.message)
    else {
      toast.success('Pasta entregue!')
      registrarLog(sel.id, `📁 Pasta entregue pelo DECUPADOR (${userProfile?.nome || 'Equipe'})`)
      await notificarClickUpChat(`📁 PASTA PRONTA (DECUPAGEM)\n\n👤: DECUPADOR\n${userProfile?.nome || 'Equipe'}\n\n📍 **${sel.cliente?.nome}**\n🎬 ${sel.titulo}`)
      setEntregaAberta(false)
      setAbertoId(null)
      setNewDriveLink('')
      loadData()
    }
    setIsSubmitting(false)
  }

  const limparCopias = async (url: string) => {
    const driveId = getGoogleDriveId(url)
    if (!driveId) return toast.error('Não encontrei a pasta do Google Drive nesse link.')
    const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!CLIENT_ID) return toast.error('Configuração do Google Drive não encontrada.')
    setLimpando(p => ({ ...p, [driveId]: true }))
    try {
      await garantirGoogleIdentity()
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/drive',
        callback: async (resp: any) => {
          if (resp.error) {
            toast.error(`Erro na autorização do Google: ${resp.error_description || resp.error}`)
          } else if (resp.access_token) {
            const t = toast.loading('Tirando o "Cópia de" dos arquivos…')
            const res = await cleanCopyOfPrefix(driveId, resp.access_token)
            toast.dismiss(t)
            if (res.success) res.count > 0 ? toast.success(res.message) : toast.info('A pasta já está limpa.')
            else toast.error(res.error || 'Não foi possível renomear os arquivos.')
          }
          setLimpando(p => ({ ...p, [driveId]: false }))
        },
      })
      client.requestAccessToken()
    } catch {
      toast.error('Não foi possível conectar ao Google. Tente de novo.')
      setLimpando(p => ({ ...p, [driveId]: false }))
    }
  }
  const botaoLimpar = (url: string, compacto = false) => {
    const id = getGoogleDriveId(url) || ''
    return (
      <button type="button" disabled={!url || limpando[id]} onClick={(e) => { e.stopPropagation(); limparCopias(url) }}
        title='Tira o "Cópia de" do nome dos arquivos da pasta' className={`${btnLine} !py-1.5 !px-3 !text-xs`}>
        {limpando[id] ? <Loader2 size={13} className="animate-spin" /> : <Eraser size={13} />}{compacto ? 'Limpar "Cópia de"' : 'Limpar "Cópia de"'}
      </button>
    )
  }

  // ---------- tela ----------
  const acaoLinha = (m: Material) => {
    if (PROBLEMA.includes(m.status)) return <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400"><Clock size={13} /> Aguardando admin</span>
    if (m.status === 'planejamento') return <button type="button" className={`${btnLine} !py-2 !px-3.5`} disabled={mudandoStatus === m.id} onClick={() => mudarStatus(m, 'em_organizacao')}>{mudandoStatus === m.id ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Começar</button>
    return <button type="button" className={`${btnInk} !py-2 !px-3.5`} onClick={() => abrirEntrega(m)}><FolderCheck size={14} /> Finalizar</button>
  }

  const problemas = aberto ? entradasFeedback(aberto.feedback) : []
  const instrucao = aberto ? instrucaoParaPapel(aberto.feedback_admin, 'planner') : ''

  return (
    <TeamShell papel="Decupador" membroId={userId} nome={(comoAdmin || userProfile?.nome || '').replace(' (via admin)', '')}
      menu={[
        { id: 'fila', label: 'Fila de decupagem', icon: ListTodo, count: fila.length },
        { id: 'prontas', label: 'Pastas prontas', icon: FolderCheck },
      ]}
      ativo={aba} onMenu={(id) => setAba(id as any)} theme={theme} alternarTema={alternar}
      comoAdmin={comoAdmin} onSair={() => supabase.auth.signOut().then(() => router.push('/'))}>
      <Toaster position="top-right" richColors theme={theme} />

      {loading ? (
        <div className="flex items-center justify-center py-24 text-zinc-500"><Loader2 className="animate-spin mr-2" size={18} /> Carregando sua fila…</div>
      ) : aba === 'fila' ? (
        <>
          <PageHeader icon={FolderDown} titulo={`Olá${userProfile?.nome ? `, ${(comoAdmin || userProfile.nome).split(' ')[0]}` : ''}`}
            meta={stats.total ? `${stats.total} ${stats.total === 1 ? 'pasta para decupar' : 'pastas para decupar'}${stats.atrasadas ? ` · ${stats.atrasadas} atrasada${stats.atrasadas > 1 ? 's' : ''}` : ''}` : 'Nada na fila por aqui'} />
          <StatCards itens={[
            { label: 'Na fila', valor: stats.total, icon: ListTodo, onClick: () => setFiltro('todas'), ativo: filtro === 'todas' },
            { label: 'Para hoje', valor: stats.hoje, icon: Calendar, destaque: 'amber', onClick: () => setFiltro('hoje'), ativo: filtro === 'hoje' },
            { label: 'Atrasadas', valor: stats.atrasadas, icon: Flame, destaque: 'red', onClick: () => setFiltro('atrasadas'), ativo: filtro === 'atrasadas' },
            { label: 'Com problema', valor: stats.problema, icon: AlertTriangle, destaque: 'amber' },
          ]} />
          <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
            <h2 className="text-lg font-semibold">Fila de decupagem</h2>
            <div className="md:ml-auto">
              <Filtros<FiltroPrazo> valor={filtro} onChange={setFiltro} opcoes={[
                { id: 'todas', label: 'Todas', icon: List }, { id: 'hoje', label: 'Para hoje', icon: Calendar },
                { id: 'atrasadas', label: 'Atrasadas', icon: Flame }, { id: 'semana', label: 'Esta semana', icon: CalendarRange },
                { id: 'futura', label: 'Próximas', icon: CalendarClock },
              ]} />
            </div>
          </div>
          {filaFiltrada.length === 0
            ? <Vazio icon={Inbox} titulo={fila.length ? 'Nada neste filtro' : 'Fila vazia!'} texto={fila.length ? 'Troque o filtro para ver as outras pastas.' : 'Quando o admin te passar uma pasta para decupar, ela aparece aqui.'} />
            : agrupar(filaFiltrada).map(c => (
              <GrupoCliente key={c.nome} nome={c.nome} meta={`${Object.values(c.ciclos).reduce((a, x) => a + x.itens.length, 0)} na fila`}>
                {Object.entries(c.ciclos).sort((a, b) => Number(b[0]) - Number(a[0])).map(([ciclo, dados]) => (
                  <div key={ciclo} className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap px-1 pt-1">
                      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-500"><Calendar size={13} /> Ciclo {ciclo}</span>
                      {dados.bruto && <div className="ml-auto flex items-center gap-2">
                        <a href={dados.bruto} target="_blank" rel="noopener noreferrer" className={`${btnLine} !py-1.5 !px-3 !text-xs`}><ExternalLink size={13} /> Pasta bruta do ciclo</a>
                        {botaoLimpar(dados.bruto, true)}
                      </div>}
                    </div>
                    {dados.itens.map(m => (
                      <LinhaTarefa key={m.id} onClick={() => setAbertoId(m.id)} apagada={PROBLEMA.includes(m.status)}
                        titulo={m.titulo} sub={<span>Ciclo {m.ciclo || 1}</span>}
                        status={statusDe(m)} prazo={<Prazo data={m.data_limite} />} acao={acaoLinha(m)} />
                    ))}
                  </div>
                ))}
              </GrupoCliente>
            ))}
        </>
      ) : (
        <>
          <PageHeader icon={FolderCheck} titulo="Pastas prontas" meta={`${prontas.length} ${prontas.length === 1 ? 'pasta entregue' : 'pastas entregues'}`} />
          {prontas.length === 0
            ? <Vazio icon={FolderCheck} titulo="Nenhuma pasta entregue ainda" texto="As pastas que você finalizar aparecem aqui." />
            : agrupar(prontas).map(c => (
              <GrupoCliente key={c.nome} nome={c.nome} meta={`${Object.values(c.ciclos).reduce((a, x) => a + x.itens.length, 0)} entregues`}>
                {Object.values(c.ciclos).flatMap(x => x.itens).map(m => (
                  <LinhaTarefa key={m.id} onClick={() => setAbertoId(m.id)} titulo={m.titulo} sub={<span>Ciclo {m.ciclo || 1}</span>}
                    status={statusDe(m)} prazo={null}
                    acao={m.link_organizado ? <a href={m.link_organizado} target="_blank" rel="noopener noreferrer" className={`${btnLine} !py-1.5 !px-3 !text-xs`}><ExternalLink size={13} /> Abrir pasta</a> : null} />
                ))}
              </GrupoCliente>
            ))}
        </>
      )}

      {/* PAINEL DA TAREFA */}
      <PainelTarefa aberto={!!aberto && !entregaAberta && !problemaAberto} onFechar={() => setAbertoId(null)}
        crumb={`${aberto?.cliente?.nome || ''} · Ciclo ${aberto?.ciclo || 1}`} titulo={aberto?.titulo || ''}
        status={aberto && <>{statusDe(aberto)}<Prazo data={aberto.data_limite} /></>}
        acoes={aberto && (
          PROBLEMA.includes(aberto.status)
            ? <p className="text-[13px] text-amber-700 dark:text-amber-400 flex items-center gap-1.5"><Clock size={14} /> Você relatou um problema. Aguardando o admin resolver.</p>
            : aberto.status === 'planejamento' ? <>
              <button type="button" className={btnInk} disabled={mudandoStatus === aberto.id} onClick={() => mudarStatus(aberto, 'em_organizacao')}><Play size={15} /> Começar decupagem</button>
              <button type="button" className={btnLine} onClick={() => abrirProblema(aberto)}><AlertTriangle size={15} /> Relatar problema</button>
            </> : aberto.status === 'em_organizacao' ? <>
              <button type="button" className={btnInk} onClick={() => abrirEntrega(aberto)}><FolderCheck size={15} /> Finalizar decupagem</button>
              <button type="button" className={btnLine} onClick={() => abrirProblema(aberto)}><AlertTriangle size={15} /> Relatar problema</button>
              <button type="button" className={btnLine} disabled={mudandoStatus === aberto.id} onClick={() => mudarStatus(aberto, 'planejamento')}><Undo2 size={15} /> Voltar para a fila</button>
            </> : null
        )}>
        {aberto && <>
          <Secao titulo="Pastas">
            <div className="space-y-2">
              <LinkPasta label="Pasta bruta (material original)" url={brutoDaTarefa(aberto)} extra={brutoDaTarefa(aberto) ? botaoLimpar(brutoDaTarefa(aberto)) : null} />
              {aberto.link_organizado && <LinkPasta label="Pasta organizada (entregue)" url={aberto.link_organizado} />}
            </div>
          </Secao>

          {problemas.length > 0 && (
            <Secao titulo="Problemas e ajustes">
              <div className="space-y-2">
                {problemas.map((e, i) => (
                  <div key={i} className={`rounded-xl px-3.5 py-2.5 text-[13px] ${i === 0 && PROBLEMA.includes(aberto.status) ? 'bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200' : 'bg-zinc-50 text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300'}`}>
                    <p className="text-xs opacity-70 mb-0.5">{e.daEquipe ? 'Equipe' : 'Cliente'}{e.data ? ` · ${e.data}` : ''}</p>
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

          <Secao titulo="Roteiro de apoio">
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-3.5">
              <div className="ql-editor !p-0 text-sm leading-relaxed whitespace-pre-wrap break-words [&_a]:text-brand [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: formatRichText(aberto.roteiro, 'Nenhum roteiro nesta tarefa.') }} />
            </div>
          </Secao>
        </>}
      </PainelTarefa>

      {/* FINALIZAR */}
      <Modal aberto={entregaAberta && !!aberto} onFechar={() => setEntregaAberta(false)} titulo="Finalizar decupagem" descricao={aberto?.titulo}
        rodape={<>
          <button type="button" className={btnLine} onClick={() => setEntregaAberta(false)} disabled={isSubmitting}>Cancelar</button>
          <button type="button" className={btnInk} onClick={handleDeliverOrganization} disabled={isSubmitting || !newDriveLink.trim()}>{isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Entregar pasta</button>
        </>}>
        <CampoLinkDrive label="Link da pasta organizada" valor={newDriveLink} onChange={setNewDriveLink} tipo="folder" placeholder="Cole o link da pasta já decupada" />
        <p className="text-xs text-zinc-500">Envie a pasta com o material já organizado, não a pasta bruta.</p>
      </Modal>

      <ModalProblema aberto={problemaAberto && !!aberto} onFechar={() => setProblemaAberto(false)} titulo={aberto?.titulo || ''}
        tipo={issueType} onTipo={setIssueType} texto={issueText} onTexto={setIssueText} enviando={isSubmitting} onEnviar={handleReportIssue} />
    </TeamShell>
  )
}
