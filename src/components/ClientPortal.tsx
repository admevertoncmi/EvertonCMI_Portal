"use client"
// Portal do cliente (link mágico). Layout: lista por ciclo | conteúdo | conversa.
// Visual do painel novo (zinc + cor da marca). Referência: docs/redesign/mockup-portal-cliente.html
// e docs/redesign/mockups/mockup-07a/07b.

import { formatRichText } from '@/lib/utils'
import {
  carregarPortal, atualizarMateriaisPortal, registrarLogPortal, notificarEquipePortal,
  conversaPortal, prepararAnexoPortal, enviarMensagemPortal, transcreverAudioPortal,
} from '@/actions/portal'
import { useState, useEffect, useMemo, useCallback, useRef, use, type ReactNode } from 'react'
import { ScaledGoogleDrivePlayer } from './ScaledGoogleDrivePlayer'
import ConversaMaterial, { enviarAnexos, type EnvioConversa, type MensagemConversa } from './ConversaMaterial'
import { getDriveFolderFiles } from '@/actions/google'
import { createClient } from '@/lib/supabase-browser'
import {
  CheckCircle2, ExternalLink, Calendar, Loader2, PlayCircle, Clock, MessageSquare, FileText, X,
  MessageCircle, Image as ImageIcon, ChevronDown, ChevronLeft, ChevronRight, Check, Play, Maximize2,
} from 'lucide-react'
import { Toaster, toast } from 'sonner'
import useEmblaCarousel from 'embla-carousel-react'

// ---------- utilidades de mídia (iguais às da versão anterior) ----------
const getEmbedUrl = (url: string) => {
  if (!url) return null;
  try {
    const ytMatch = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/.exec(url);
    if (ytMatch?.[1]) return `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`;
    if (url.includes('/preview') || url.includes('embeddedfolderview')) return url;
    const folderMatch = /\/folders\/([a-zA-Z0-9_-]+)/.exec(url);
    if (folderMatch?.[1]) return `https://drive.google.com/embeddedfolderview?id=${folderMatch[1]}#grid`;
    const driveMatch1 = /\/file\/d\/([a-zA-Z0-9_-]+)/.exec(url);
    if (driveMatch1?.[1]) return `https://drive.google.com/file/d/${driveMatch1[1]}/preview`;
    const driveMatch2 = /id=([a-zA-Z0-9_-]+)/.exec(url);
    if (driveMatch2?.[1] && url.includes('drive.google.com')) return `https://drive.google.com/file/d/${driveMatch2[1]}/preview`;
    return null;
  } catch { return null; }
}
const isGoogleDriveVideo = (url: string) => !!url && url.includes('drive.google.com') && (url.includes('/file/d/') || url.includes('id='))
const isImagem = (url: string) => /\.(jpeg|jpg|gif|png|webp|avif|jfif)$/i.test(url || '')

// ---------- status do ponto de vista do cliente: só 4 ----------
type StatusCliente = 'wait' | 'fix' | 'prod' | 'ok'
type Aba = 'videos' | 'roteiros'
const STATUS_UI: Record<StatusCliente, { label: string; cls: string }> = {
  wait: { label: 'Aguardando você', cls: 'bg-orange-50 text-orange-700' },
  fix: { label: 'Em ajuste', cls: 'bg-red-50 text-red-600' },
  prod: { label: 'Em produção', cls: 'bg-blue-50 text-blue-600' },
  ok: { label: 'Aprovado', cls: 'bg-green-50 text-green-600' },
}
const ETAPA: Record<string, string> = {
  roteiro_aprovado: 'início da produção',
  planejamento: 'preparação do material', em_organizacao: 'preparação do material', organizado: 'preparação do material',
  faltando_material: 'preparação do material', verificar_material: 'preparação do material',
  em_edicao: 'edição', revisao: 'revisão final da equipe',
}
const temMidia = (m: any) => !!(m?.link_drive || m?.link_capa)
function statusCliente(m: any, aba: Aba): StatusCliente {
  const s = String(m?.status || '').toLowerCase()
  if (aba === 'videos') {
    if (s === 'pendente') return 'wait'
    if (s === 'ajustes') return 'fix'
    return 'ok'
  }
  if (s === 'roteiro_pendente') return 'wait'
  if (s === 'ajustes') return temMidia(m) ? 'ok' : 'fix'
  if (['pendente', 'aprovado', 'post_aprovado', 'concluido'].includes(s)) return 'ok'
  if (s in ETAPA) return 'prod'
  return 'wait'
}
const chip = (st: StatusCliente) => (
  <span className={`inline-flex items-center gap-1.5 text-[11.5px] font-medium px-2 py-0.5 rounded-md whitespace-nowrap ${STATUS_UI[st].cls}`}>
    <span className="w-1.5 h-1.5 rounded-full bg-current" />{STATUS_UI[st].label}
  </span>
)

const btnInk = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] bg-brand-ink text-white text-[13px] font-medium hover:opacity-90 disabled:opacity-50 transition-all whitespace-nowrap'
const btnLine = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 text-[13px] font-medium disabled:opacity-50 transition-colors whitespace-nowrap'

export default function PortalCliente({ params }: { params: Promise<{ token_magico: string }> }) {
  const { token_magico: token } = use(params)

  const [cliente, setCliente] = useState<any>(null)
  const [todosMateriais, setTodosMateriais] = useState<any[]>([])
  const [naoLidas, setNaoLidas] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<Aba>('videos')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detalheAberto, setDetalheAberto] = useState(false) // só no celular: conteúdo por cima da lista
  const [mediaTab, setMediaTab] = useState<'video' | 'capa'>('video')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [collapsedCycles, setCollapsedCycles] = useState<string[]>([])
  const [modoAjuste, setModoAjuste] = useState(false)
  const [mensagens, setMensagens] = useState<MensagemConversa[]>([])
  const [carregandoConversa, setCarregandoConversa] = useState(false)
  const [confirmar, setConfirmar] = useState<{ tipo: 'um' | 'lote'; itens: any[]; label?: string } | null>(null)
  const [expandedCapaLinks, setExpandedCapaLinks] = useState<string[]>([])
  const [isExpandingFolder, setIsExpandingFolder] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, skipSnaps: false })
  const materiaisVisualizados = useRef<Set<string>>(new Set())
  // Celular: roteiro começa recolhido para a conversa ficar perto; "Pedir ajuste" rola até a conversa e foca o campo
  const [roteiroAberto, setRoteiroAberto] = useState(false)
  const [focarConversa, setFocarConversa] = useState(0)
  const convRef = useRef<HTMLElement>(null)

  // Modo admin: a admin "entra" no portal pela lista de clientes (?admin=1).
  // Só vale com sessão de admin no navegador; o parâmetro sozinho não liga nada.
  const [modoAdmin, setModoAdmin] = useState(false)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const tab = sp.get('tab')
    if (tab === 'videos' || tab === 'roteiros') setActiveTab(tab)
    if (sp.get('admin') === '1') {
      const supabase = createClient()
      supabase.auth.getUser().then(async ({ data }) => {
        if (!data.user) return
        const { data: perfil } = await supabase.from('perfis_equipe').select('role').eq('id', data.user.id).maybeSingle()
        if (perfil?.role === 'admin') setModoAdmin(true)
      })
    }
  }, [])
  const autoria = modoAdmin ? ' (feito pela agência)' : ''
  const isDesktop = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches

  // ---------- dados ----------
  const loadPortal = useCallback(async () => {
    if (!token || token === 'undefined') return
    try {
      const r = await carregarPortal(token)
      if (!r.cliente) return
      setCliente(r.cliente)
      setTodosMateriais(r.materiais || [])
      setNaoLidas(r.naoLidas || {})
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [token])
  useEffect(() => { loadPortal() }, [loadPortal])
  useEffect(() => {
    if (!cliente) return
    const t = setInterval(loadPortal, 30000)
    return () => clearInterval(t)
  }, [cliente, loadPortal])

  const roteirosList = useMemo(() => todosMateriais.filter(m => m.status !== 'analise_roteiro'), [todosMateriais])
  const videosList = useMemo(() => todosMateriais.filter(m => temMidia(m) && ['pendente', 'ajustes', 'aprovado', 'post_aprovado'].includes(String(m.status).toLowerCase())), [todosMateriais])
  const currentList = activeTab === 'videos' ? videosList : roteirosList
  const isRoteiro = activeTab === 'roteiros'
  const selected = useMemo(() => currentList.find(m => m.id === selectedId) || null, [currentList, selectedId])
  const stSel = selected ? statusCliente(selected, activeTab) : null

  const ordem: Record<StatusCliente, number> = { wait: 0, fix: 1, prod: 2, ok: 3 }
  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {}
    currentList.forEach(m => { const k = `Ciclo ${m.ciclo || 1}`; (groups[k] = groups[k] || []).push(m) })
    Object.values(groups).forEach(l => l.sort((a, b) => ordem[statusCliente(a, activeTab)] - ordem[statusCliente(b, activeTab)]))
    return groups
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentList, activeTab])
  const ciclosOrdenados = useMemo(() => Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0], undefined, { numeric: true })), [grouped])

  // Ciclos 100% aprovados começam recolhidos
  useEffect(() => {
    setCollapsedCycles(ciclosOrdenados.filter(([, itens]) => itens.every(m => ['ok', 'prod'].includes(statusCliente(m, activeTab)))).map(([k]) => `${activeTab}-${k}`))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, ciclosOrdenados.length])

  const pendentesAba = (aba: Aba) => (aba === 'videos' ? videosList : roteirosList).filter(m => statusCliente(m, aba) === 'wait')
  const totalPendencias = pendentesAba('videos').length + pendentesAba('roteiros').length

  const progresso = useMemo(() => {
    if (!currentList.length) return { ciclo: 1, total: 0, aprovados: 0 }
    const ciclo = Math.max(...todosMateriais.map(m => m.ciclo || 1), 1)
    const doCiclo = currentList.filter(m => (m.ciclo || 1) === ciclo)
    const aprovados = doCiclo.filter(m => ['ok', 'prod'].includes(statusCliente(m, activeTab))).length
    return { ciclo, total: doCiclo.length, aprovados }
  }, [currentList, todosMateriais, activeTab])

  // Abre sozinho o primeiro conteúdo esperando o cliente (ou o primeiro da lista)
  useEffect(() => {
    if (loading) return
    if (selectedId && currentList.some(m => m.id === selectedId)) return
    const prox = currentList.find(m => statusCliente(m, activeTab) === 'wait') || ciclosOrdenados[0]?.[1]?.[0]
    setSelectedId(prox?.id || null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, activeTab, currentList])

  // Ao trocar de conteúdo
  useEffect(() => {
    setModoAjuste(false)
    setRoteiroAberto(false)
    setCurrentSlide(0)
    if (selected) setMediaTab(!selected.link_drive && selected.link_capa ? 'capa' : 'video')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  // Expande pasta do Drive / lista de links da capa em carrossel
  useEffect(() => {
    const link = selected?.link_capa
    if (!link) { setExpandedCapaLinks([]); return }
    const folder = /\/folders\/([a-zA-Z0-9_-]+)/.exec(link)
    if (!folder?.[1]) { setExpandedCapaLinks(link.split(/[\n,;]+/).map((l: string) => l.trim()).filter(Boolean)); return }
    setIsExpandingFolder(true)
    getDriveFolderFiles(folder[1])
      .then(files => setExpandedCapaLinks(files?.length ? files : [link]))
      .catch(() => setExpandedCapaLinks([link]))
      .finally(() => setIsExpandingFolder(false))
  }, [selected?.id, selected?.link_capa])
  useEffect(() => {
    if (!emblaApi) return
    const onSelect = () => setCurrentSlide(emblaApi.selectedScrollSnap())
    emblaApi.on('select', onSelect)
    return () => { emblaApi.off('select', onSelect) }
  }, [emblaApi])

  // Registro de visualização (a admin abrindo não conta; no celular só quando o conteúdo está aberto)
  const registrarLogAcesso = useCallback((materialId: string, evento: string) => registrarLogPortal(token, materialId, evento), [token])
  useEffect(() => {
    if (!selected || modoAdmin || new URLSearchParams(window.location.search).get('admin') === '1') return
    if (!isDesktop() && !detalheAberto) return
    if (materiaisVisualizados.current.has(selected.id)) return
    materiaisVisualizados.current.add(selected.id)
    registrarLogAcesso(selected.id, `👀 Cliente visualizou o ${isRoteiro ? 'Roteiro' : 'Post'}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, detalheAberto, modoAdmin])

  // ---------- conversa ----------
  const carregarConversa = useCallback(async (id: string, silencioso = false) => {
    if (!silencioso) setCarregandoConversa(true)
    try {
      const msgs = await conversaPortal(token, id)
      setMensagens(msgs)
      setNaoLidas(prev => prev[id] ? { ...prev, [id]: 0 } : prev)
    } catch {
      if (!silencioso) setMensagens([])
    } finally {
      if (!silencioso) setCarregandoConversa(false)
    }
  }, [token])
  useEffect(() => {
    if (!selectedId) { setMensagens([]); return }
    carregarConversa(selectedId)
    const t = setInterval(() => carregarConversa(selectedId, true), 20000)
    return () => clearInterval(t)
  }, [selectedId, carregarConversa])

  const prepararAnexo = (tipo: 'foto' | 'audio', ext: string) => prepararAnexoPortal(token, selectedId!, tipo, ext)

  const enviarConversa = async (envio: EnvioConversa) => {
    const mat = selected
    if (!mat) return false
    try {
      const anexos = await enviarAnexos(prepararAnexo, envio.fotos, envio.audio)
      const ajuste = modoAjuste
      await enviarMensagemPortal(token, mat.id, { texto: envio.texto, fotos: anexos.fotos, audio: anexos.audio, ajuste, alvo: ajuste ? envio.alvo : null }, { feitoPelaAgencia: modoAdmin })
      if (ajuste) await registrarAjuste(mat, envio)
      else toast.success('Mensagem enviada para a equipe.')
      await carregarConversa(mat.id, true)
      return true
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível enviar. Tente de novo.')
      return false
    }
  }

  // Pedido de ajuste: além da mensagem na conversa, mantém o fluxo antigo (status + feedback) que o painel usa
  const registrarAjuste = async (mat: any, envio: EnvioConversa) => {
    const alvo = envio.alvo || 'video'
    let flagVideo = mat.video_entregue
    let flagDesign = mat.design_entregue
    if (!isRoteiro && mat.link_capa && mat.link_drive) {
      if (alvo === 'video') flagVideo = false
      else if (alvo === 'capa') flagDesign = false
      else { flagVideo = false; flagDesign = false }
    } else if (!isRoteiro) {
      if (mat.link_capa && !mat.link_drive) flagDesign = false; else flagVideo = false
    }
    const anexosTxt = [envio.fotos.length ? `${envio.fotos.length} foto(s)` : '', envio.audio ? 'áudio' : ''].filter(Boolean).join(' e ')
    const base = envio.texto || 'Pedido enviado por foto/áudio.'
    const textoBase = anexosTxt ? `${base} (+ ${anexosTxt} na conversa do portal)` : base
    const now = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    const textoFinal = `[DATE:${now}] ${textoBase.replace(/\n\n/g, '\n \n')}${mat.feedback ? `\n\n${mat.feedback}` : ''}`
    const patch = { status: 'ajustes', feedback: textoFinal, video_entregue: flagVideo, design_entregue: flagDesign }
    setTodosMateriais(prev => prev.map(m => m.id === mat.id ? { ...m, ...patch } : m))
    setModoAjuste(false)
    await atualizarMateriaisPortal(token, [mat.id], patch)
    await registrarLogAcesso(mat.id, `⚠️ Pedido de Ajuste${autoria}`)
    const ondeTxt = !isRoteiro && mat.link_capa && mat.link_drive ? ` (${alvo === 'ambos' ? 'VÍDEO E CAPA' : alvo === 'capa' ? 'CAPA' : 'VÍDEO'})` : ''
    await notificarEquipePortal(token, `🔔 SOLICITAÇÃO DE AJUSTE${autoria.toUpperCase()}${ondeTxt}\n\n**${cliente.nome}**\n${mat.titulo}\n🔔 INSTRUÇÃO: ${textoBase.toUpperCase()}`)
    toast.success('Pedido de ajuste enviado. A equipe já foi avisada.')
  }

  const cancelarAjuste = async (mat: any) => {
    setActionLoading(true)
    const anterior = isRoteiro ? 'roteiro_pendente' : 'pendente'
    const fbs = mat.feedback?.split('\n\n').filter(Boolean) || []
    const historico = fbs.slice(1).join('\n\n') || null
    setTodosMateriais(prev => prev.map(m => m.id === mat.id ? { ...m, status: anterior, feedback: historico } : m))
    await atualizarMateriaisPortal(token, [mat.id], { status: anterior, feedback: historico })
    await registrarLogAcesso(mat.id, modoAdmin ? '❌ Agência cancelou o pedido de ajuste' : '❌ Cliente cancelou o pedido de ajuste')
    toast.info('Pedido de ajuste cancelado.')
    setActionLoading(false)
  }

  // ---------- aprovação ----------
  const proximoPendente = (excluir: string[]) => currentList.find(m => !excluir.includes(m.id) && statusCliente(m, activeTab) === 'wait')

  const aprovar = async (itens: any[], label?: string) => {
    if (!itens.length) return
    setActionLoading(true)
    try {
      const ids = itens.map(m => m.id)
      const novoStatus = isRoteiro ? 'roteiro_aprovado' : 'post_aprovado'
      setTodosMateriais(prev => prev.map(m => ids.includes(m.id) ? { ...m, status: novoStatus, feedback: null } : m))
      await atualizarMateriaisPortal(token, ids, { status: novoStatus, feedback: null })
      await Promise.all(ids.map(id => registrarLogAcesso(id, `✅ ${isRoteiro ? 'Roteiro' : 'POST'} Aprovado${itens.length > 1 ? ' (Lote)' : ''}${autoria}`)))
      await Promise.all(ids.map(id => enviarMensagemPortal(token, id, { evento: 'aprovado' }, { feitoPelaAgencia: modoAdmin, avisarEquipe: false }).catch(() => null)))
      const msg = itens.length > 1
        ? `📝✅ LOTE DE ROTEIROS APROVADOS (${(label || '').toUpperCase()})${autoria.toUpperCase()}\n\nCLIENTE: ${cliente.nome.toUpperCase()}\n\nMATERIAIS:\n${itens.map(m => `• ${m.titulo}`).join('\n')}\n\n🚀 A equipe de produção pode iniciar os trabalhos.`
        : `${isRoteiro ? '📝✅ ROTEIRO APROVADO' : '✅ POST APROVADO'}${autoria.toUpperCase()}\n\n**${cliente.nome}**\n${itens[0].titulo}`
      await notificarEquipePortal(token, msg)
      const prox = proximoPendente(ids)
      toast.success(prox ? `Aprovado! Próximo: ${prox.titulo}` : 'Aprovado! A equipe já foi avisada.')
      if (prox) setSelectedId(prox.id)
      else if (selectedId && ids.includes(selectedId)) { setDetalheAberto(false); carregarConversa(selectedId, true) }
    } catch {
      toast.error('Não foi possível aprovar. Tente de novo.')
    } finally {
      setActionLoading(false)
      setConfirmar(null)
    }
  }

  const abrir = (m: any) => {
    setSelectedId(m.id)
    setDetalheAberto(true)
  }
  const trocarAba = (aba: Aba) => {
    if (aba === activeTab) return
    setActiveTab(aba)
    setSelectedId(null)
    setDetalheAberto(false)
  }

  // ---------- telas de carregamento / link inválido ----------
  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-zinc-50 text-zinc-500">
      <Loader2 className="animate-spin mb-3 text-brand" size={32} />
      <span className="text-[13px] font-medium">Carregando seu portal…</span>
    </div>
  )
  if (!cliente) return (
    <div className="h-screen flex items-center justify-center text-center p-4 bg-zinc-50">
      <div className="max-w-sm w-full bg-white p-8 rounded-2xl border border-zinc-200">
        <h1 className="text-xl font-medium text-zinc-900">Link inválido</h1>
        <p className="text-zinc-500 mt-2 text-sm">Este link de acesso não existe. Peça um novo link para a agência.</p>
      </div>
    </div>
  )

  const corMarca = cliente?.cor_marca || '#A25431'
  // A conversa só aparece ao tocar em "Pedir ajuste" ou quando já há um pedido de ajuste em andamento
  const mostrarConversa = !!selected && (modoAjuste || stSel === 'fix')
  const pendAba = (aba: Aba) => pendentesAba(aba).length
  const ehVideoComCapa = !isRoteiro && !!selected?.link_drive && !!selected?.link_capa
  const linkAtualCapa = expandedCapaLinks[currentSlide] || selected?.link_capa || ''

  // ---------- partes da tela ----------
  const linhaLista = (m: any) => {
    const st = statusCliente(m, activeTab)
    const sel = m.id === selectedId
    const muted = st === 'ok'
    return (
      <button key={m.id} type="button" onClick={() => abrir(m)}
        className={`w-full text-left flex items-center gap-2.5 bg-white border rounded-xl px-2.5 py-2 mb-1.5 transition-colors ${sel ? 'border-brand bg-[#FFFBF8] ring-[3px] ring-brand/10' : 'border-zinc-200 hover:bg-zinc-50'}`}>
        {isRoteiro
          ? <span className={`w-[30px] h-[30px] rounded-lg inline-flex items-center justify-center shrink-0 ${muted ? 'bg-zinc-100 text-zinc-400' : 'bg-brand-soft text-brand'}`}><FileText size={15} /></span>
          : <span className={`w-[30px] h-[50px] rounded-[7px] inline-flex items-center justify-center shrink-0 text-white bg-gradient-to-br from-[#F0C9AE] to-brand ${muted ? 'grayscale-[.6] opacity-70' : ''}`}><Play size={12} fill="currentColor" /></span>}
        <span className="flex-1 min-w-0">
          <span className="block text-[13.5px] font-medium truncate text-zinc-800">{m.titulo}</span>
          <span className="flex items-center gap-1.5 mt-1 flex-wrap">
            {chip(st)}
            {(naoLidas[m.id] || 0) > 0 && <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand"><span className="w-1.5 h-1.5 rounded-full bg-brand" />Nova mensagem</span>}
          </span>
        </span>
        <ChevronRight size={16} className="text-zinc-300 shrink-0 lg:hidden" />
      </button>
    )
  }

  const midia = () => {
    if (!selected) return null
    // Roteiro vem inteiro; só recolhe no celular quando a área de ajuste está aberta, para ela caber na tela
    const recolher = mostrarConversa && !roteiroAberto
    if (isRoteiro) return (
      <div className={`relative bg-zinc-50 border border-zinc-200 rounded-xl p-5 max-w-[680px] mx-auto ${recolher ? 'max-h-[260px] overflow-hidden lg:max-h-none lg:overflow-visible' : ''}`}>
        {recolher && (
          <div className="lg:hidden absolute inset-x-0 bottom-0 pt-12 pb-3 flex justify-center bg-gradient-to-t from-zinc-50 via-zinc-50/90 to-transparent rounded-b-xl">
            <button type="button" onClick={() => setRoteiroAberto(true)} className={`${btnLine} !py-1.5 !px-3 !text-xs`}><ChevronDown size={14} /> Ler roteiro inteiro</button>
          </div>
        )}
        <div onClick={(e) => { const a = (e.target as HTMLElement).closest('a'); if (a) { e.preventDefault(); const href = a.getAttribute('href'); if (href) window.open(href, '_blank', 'noopener,noreferrer') } }}
          className="ql-editor !p-0 max-w-none text-zinc-700 whitespace-pre-wrap leading-relaxed text-sm [&_a]:text-blue-600 [&_a]:underline break-words"
          dangerouslySetInnerHTML={{ __html: formatRichText(selected.roteiro, 'Nenhum roteiro registrado nesta tarefa.') }} />
      </div>
    )
    // Celular: vídeo compacto à esquerda (como no mockup 07b) para a conversa caber logo abaixo
    const quadro = 'relative w-[46%] max-w-[190px] shrink-0 lg:w-full lg:max-w-[340px] lg:mx-auto aspect-[9/16] bg-black rounded-2xl overflow-hidden'
    let conteudo: ReactNode
    if (mediaTab === 'video') {
      conteudo = selected.link_drive ? (
        isGoogleDriveVideo(selected.link_drive)
          ? <ScaledGoogleDrivePlayer url={selected.link_drive} zoomMode="fit" aspectRatio="9/16" />
          : <iframe title="Vídeo" src={getEmbedUrl(selected.link_drive) || selected.link_drive} className="absolute inset-0 w-full h-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
      ) : <div className="absolute inset-0 flex items-center justify-center text-zinc-400 text-xs">Nenhum vídeo disponível no momento.</div>
    } else if (isExpandingFolder) {
      conteudo = <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="animate-spin text-white/50" size={28} /></div>
    } else if (expandedCapaLinks.length > 1) {
      conteudo = (
        <div className="absolute inset-0">
          <div className="w-full h-full overflow-hidden" ref={emblaRef}>
            <div className="flex w-full h-full">
              {expandedCapaLinks.map((link, idx) => (
                <div key={idx} onClick={() => setPreviewUrl(link)} className="flex-[0_0_100%] min-w-0 h-full relative flex items-center justify-center bg-black cursor-zoom-in">
                  {Math.abs(idx - currentSlide) <= 1 || (idx === 0 && currentSlide === expandedCapaLinks.length - 1) || (idx === expandedCapaLinks.length - 1 && currentSlide === 0)
                    ? (isImagem(link) ? <img src={link} loading="lazy" className="w-full h-full object-contain select-none" alt={`Imagem ${idx + 1}`} /> : <iframe title={`Imagem ${idx + 1}`} src={getEmbedUrl(link) || link} className="w-full h-full border-0 pointer-events-none" />)
                    : <Loader2 className="animate-spin text-white/30" size={22} />}
                </div>
              ))}
            </div>
          </div>
          <button type="button" aria-label="Imagem anterior" onClick={(e) => { e.stopPropagation(); emblaApi?.scrollPrev() }} className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 text-white inline-flex items-center justify-center"><ChevronLeft size={18} /></button>
          <button type="button" aria-label="Próxima imagem" onClick={(e) => { e.stopPropagation(); emblaApi?.scrollNext() }} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 text-white inline-flex items-center justify-center"><ChevronRight size={18} /></button>
          <span className="absolute top-2 right-2 text-[11px] font-semibold bg-black/40 text-white px-2 py-0.5 rounded-md">{currentSlide + 1}/{expandedCapaLinks.length}</span>
        </div>
      )
    } else {
      const link = expandedCapaLinks[0] || selected.link_capa
      const emb = getEmbedUrl(link)
      conteudo = emb ? <iframe title="Capa" src={emb} className="absolute inset-0 w-full h-full border-0" allowFullScreen />
        : isImagem(link) ? <img src={link} className="absolute inset-0 w-full h-full object-contain" alt="Capa" />
        : <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-400 text-xs p-4 text-center">Este link precisa ser aberto no navegador.<a href={link} target="_blank" rel="noopener noreferrer" className={btnLine}>Abrir imagens <ExternalLink size={13} /></a></div>
    }
    const linkTelaCheia = mediaTab === 'video' ? selected.link_drive : linkAtualCapa
    const alternancia = (vertical: boolean) => ehVideoComCapa && (
      <div className={`inline-flex gap-0.5 p-1 bg-zinc-100 rounded-xl ${vertical ? 'flex-col w-full' : ''}`}>
        {([['video', 'Vídeo', PlayCircle], ['capa', 'Capa', ImageIcon]] as const).map(([k, l, Ic]) => (
          <button key={k} type="button" onClick={() => setMediaTab(k)} className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${vertical ? 'justify-start min-h-[40px]' : ''} ${mediaTab === k ? 'bg-white text-brand shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}><Ic size={15} />{l}</button>
        ))}
      </div>
    )
    const qtdMsgs = mensagens.filter(m => !m.evento).length
    return (
      <>
        {ehVideoComCapa && <div className="hidden lg:flex justify-center mb-3">{alternancia(false)}</div>}
        <div className="flex items-start gap-3 lg:block">
          <div className={quadro}>{conteudo}</div>
          {/* Celular: controles ao lado do vídeo */}
          <div className="flex-1 min-w-0 flex flex-col gap-2 lg:hidden">
            {alternancia(true)}
            {linkTelaCheia && <button type="button" onClick={() => setPreviewUrl(linkTelaCheia)} className={`${btnLine} w-full min-h-[40px]`}><Maximize2 size={14} /> Tela cheia</button>}
            {mostrarConversa && (
              <button type="button" onClick={() => convRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className={`${btnLine} w-full min-h-[40px]`}>
                <MessageSquare size={14} /> Ajuste{qtdMsgs ? ` (${qtdMsgs})` : ''}
              </button>
            )}
          </div>
        </div>
        {linkTelaCheia && (
          <div className="hidden lg:flex justify-center mt-3">
            <button type="button" onClick={() => setPreviewUrl(linkTelaCheia)} className={`${btnLine} !py-1.5 !px-3 !text-xs`}><Maximize2 size={13} /> Abrir em tela cheia</button>
          </div>
        )}
      </>
    )
  }

  const aviso = () => {
    if (!selected || !stSel) return null
    const box = 'rounded-xl px-3 py-2.5 text-[13px] mb-4 border'
    if (stSel === 'fix') return <div className={`${box} bg-red-50 border-red-100 text-red-800`}>A equipe está fazendo o ajuste que você pediu. Avisamos quando a nova versão estiver pronta.</div>
    if (stSel === 'prod') return <div className={`${box} bg-blue-50 border-blue-100 text-blue-800`}>Você já aprovou este roteiro. Agora a equipe está na etapa de {ETAPA[String(selected.status).toLowerCase()] || 'produção'}.</div>
    if (stSel === 'ok') return <div className={`${box} bg-green-50 border-green-100 text-green-800`}>{isRoteiro ? 'Roteiro aprovado. O conteúdo já está pronto na aba Posts.' : 'Você aprovou este conteúdo.'}</div>
    return null
  }

  return (
    <div className="min-h-[100dvh] bg-zinc-50 font-sans text-zinc-800">
      <Toaster position="top-center" richColors />

      {/* Faixa do modo admin */}
      {modoAdmin && (
        <div className="sticky top-0 z-[60] bg-zinc-900 text-white">
          <div className="max-w-[1440px] mx-auto px-4 md:px-6 py-2 flex items-center gap-3 text-[12px] md:text-[13px]">
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <p className="flex-1 min-w-0"><span className="font-semibold">Você está no portal de {cliente?.nome}.</span> <span className="text-white/70">Aprovações, ajustes e mensagens feitos aqui valem de verdade e ficam registrados como feitos pela agência.</span></p>
            <a href="/admin/dashboard" className="shrink-0 px-3 py-1 rounded-md bg-white/10 hover:bg-white/20 font-medium transition-colors">Voltar ao painel</a>
          </div>
        </div>
      )}

      {/* Topo white-label */}
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-[1440px] mx-auto h-16 px-4 md:px-6 flex items-center gap-3">
          {cliente.logo_url
            ? <img src={cliente.logo_url} alt={`Logo ${cliente.nome}`} className="h-9 max-w-[140px] object-contain" />
            : <span className="w-9 h-9 rounded-[10px] text-white text-sm font-semibold inline-flex items-center justify-center shrink-0" style={{ background: corMarca }}>{(cliente.nome || '?').trim()[0]?.toUpperCase()}</span>}
          <div className="min-w-0">
            <div className="text-xs text-zinc-500">Portal de conteúdo</div>
            <div className="text-[15px] font-semibold leading-tight truncate">Olá, {cliente.nome}</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {totalPendencias > 0
              ? <span className="hidden sm:inline-flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded-[10px] bg-orange-50 text-orange-700"><Clock size={14} /> {totalPendencias} {totalPendencias === 1 ? 'pendente' : 'pendentes'}</span>
              : <span className="hidden sm:inline-flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded-[10px] bg-green-50 text-green-600"><Check size={14} /> Tudo em dia</span>}
            <a href={`https://wa.me/${String(cliente?.wpp_suporte || '').replace(/\D/g, '')}?text=${encodeURIComponent('Olá! Estou no meu Portal de Cliente e preciso de uma ajuda.')}`}
              target="_blank" rel="noopener noreferrer" className={`${btnLine} ${cliente?.wpp_suporte ? '' : 'hidden'}`} title="Falar com a agência no WhatsApp">
              <MessageCircle size={16} /><span className="hidden md:inline">Falar no WhatsApp</span>
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-4 md:px-6 pt-4 pb-6">
        {/* Abas + progresso do ciclo */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <nav className="inline-flex gap-0.5 p-1 bg-zinc-100 rounded-xl" aria-label="Tipo de conteúdo">
            {([['videos', 'Posts', PlayCircle], ['roteiros', 'Roteiros', FileText]] as const).map(([k, l, Ic]) => (
              <button key={k} type="button" onClick={() => trocarAba(k)} className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[9px] text-[13.5px] font-medium transition-colors ${activeTab === k ? 'bg-white text-brand shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}>
                <Ic size={15} />{l}
                {pendAba(k) > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-brand text-white text-[11px] font-semibold inline-flex items-center justify-center">{pendAba(k)}</span>}
              </button>
            ))}
          </nav>
          {progresso.total > 0 && (
            <div className="w-full sm:w-auto sm:ml-auto flex items-center gap-3 bg-white border border-zinc-200 rounded-xl px-3.5 py-2 text-[13px]">
              <span className="font-medium whitespace-nowrap">Ciclo {progresso.ciclo}</span>
              <span className="flex-1 sm:w-36 h-1.5 bg-zinc-100 rounded-full overflow-hidden"><span className="block h-full bg-green-600 rounded-full transition-all" style={{ width: `${Math.round(progresso.aprovados / progresso.total * 100)}%` }} /></span>
              <span className="text-zinc-500 whitespace-nowrap">{progresso.aprovados} de {progresso.total} aprovados</span>
            </div>
          )}
        </div>

        {currentList.length === 0 ? (
          <div className="bg-white border border-dashed border-zinc-200 rounded-2xl p-10 text-center">
            <CheckCircle2 size={28} className="text-zinc-300 mx-auto mb-2" />
            <p className="text-sm text-zinc-500">Nada por aqui ainda. A agência está preparando os próximos conteúdos.</p>
          </div>
        ) : (
          <div className={`lg:grid lg:grid-cols-[280px_minmax(0,1fr)] ${mostrarConversa ? 'xl:grid-cols-[300px_minmax(0,1fr)_380px]' : 'xl:grid-cols-[300px_minmax(0,1fr)]'} gap-4 xl:h-[calc(100dvh-150px)] xl:min-h-[560px]`}>
            {/* COLUNA 1: lista por ciclo */}
            <section className="lg:bg-white lg:border lg:border-zinc-200 lg:rounded-2xl lg:p-3 lg:overflow-y-auto lg:self-start xl:self-auto lg:max-h-[calc(100dvh-150px)] xl:max-h-none" aria-label="Conteúdos">
              {ciclosOrdenados.map(([ciclo, itens]) => {
                const key = `${activeTab}-${ciclo}`
                const fechado = collapsedCycles.includes(key)
                const pend = itens.filter(m => statusCliente(m, activeTab) === 'wait')
                const okN = itens.filter(m => ['ok', 'prod'].includes(statusCliente(m, activeTab))).length
                return (
                  <div key={key} className="mb-2">
                    <div className="flex items-center gap-2 px-1 mt-2 mb-2">
                      <button type="button" onClick={() => setCollapsedCycles(p => p.includes(key) ? p.filter(c => c !== key) : [...p, key])} aria-expanded={!fechado}
                        className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold tracking-wider uppercase text-zinc-400 hover:text-zinc-600">
                        <ChevronDown size={13} className={`transition-transform ${fechado ? '-rotate-90' : ''}`} /><Calendar size={13} /> {ciclo}
                      </button>
                      {okN === itens.length && <span className="ml-auto text-[11.5px] font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-md">{okN}/{itens.length}</span>}
                    </div>
                    {!fechado && isRoteiro && pend.length > 1 && (
                      <button type="button" disabled={actionLoading} onClick={() => setConfirmar({ tipo: 'lote', itens: pend, label: ciclo })} className={`${btnLine} w-full mb-2 !py-2 !text-[12.5px]`}>
                        <Check size={14} strokeWidth={2.6} /> Aprovar todos os roteiros ({pend.length})
                      </button>
                    )}
                    {!fechado && itens.map(linhaLista)}
                  </div>
                )
              })}
            </section>

            {/* COLUNAS 2 e 3: conteúdo + conversa (no celular abrem por cima da lista) */}
            {selected && (
              <div className={`${detalheAberto ? 'flex' : 'hidden'} fixed inset-0 z-[70] bg-zinc-50 flex-col overflow-y-auto lg:static lg:z-auto lg:flex lg:bg-transparent lg:overflow-visible lg:gap-4 lg:min-w-0 xl:contents`}>
                <section className="bg-white lg:border lg:border-zinc-200 lg:rounded-2xl flex flex-col xl:min-h-0 xl:overflow-hidden" aria-label="Conteúdo aberto">
                  <div className={`sticky top-0 lg:static z-10 bg-white px-4 lg:px-5 py-3 lg:py-4 border-b border-zinc-200 flex flex-wrap lg:flex-nowrap items-start gap-3`}>
                    <button type="button" onClick={() => setDetalheAberto(false)} aria-label="Voltar para a lista" className="lg:hidden w-10 h-10 rounded-[10px] border border-zinc-200 inline-flex items-center justify-center text-zinc-500 shrink-0"><ChevronLeft size={18} /></button>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-zinc-500">{`Ciclo ${selected.ciclo || 1}`} · {isRoteiro ? 'Roteiro' : selected.link_drive && selected.link_capa ? 'Vídeo e capa' : selected.link_drive ? 'Vídeo' : 'Capa'}</div>
                      <h2 className="text-[17px] lg:text-[19px] font-medium tracking-tight leading-snug my-0.5 break-words">{selected.titulo}</h2>
                      {stSel && chip(stSel)}
                    </div>
                    {stSel === 'wait' && (
                      <div className="flex gap-2 w-full lg:w-auto order-last lg:order-none">
                        <button type="button" onClick={() => {
                          const ligar = !modoAjuste
                          setModoAjuste(ligar)
                          // Pedir ajuste = abrir a conversa: no celular rola até ela e foca o campo de mensagem
                          if (ligar) {
                            setFocarConversa(n => n + 1)
                            if (!isDesktop()) setTimeout(() => convRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
                          }
                        }} className={`${btnLine} flex-1 lg:flex-none min-h-[44px] lg:min-h-0 ${modoAjuste ? '!border-orange-300 !bg-orange-50 !text-orange-700' : ''}`}><MessageSquare size={15} /> Pedir ajuste</button>
                        <button type="button" disabled={actionLoading} onClick={() => setConfirmar({ tipo: 'um', itens: [selected] })} className={`${btnInk} flex-1 lg:flex-none lg:min-w-[120px] min-h-[44px] lg:min-h-0`}>{actionLoading ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} strokeWidth={2.6} />} Aprovar</button>
                      </div>
                    )}
                    {stSel === 'fix' && (
                      <button type="button" disabled={actionLoading} onClick={() => cancelarAjuste(selected)} className={`${btnLine} w-full lg:w-auto order-last lg:order-none`}>Cancelar pedido de ajuste</button>
                    )}
                  </div>
                  <div className="px-4 lg:px-5 py-4 xl:flex-1 xl:overflow-y-auto">
                    {aviso()}
                    {midia()}
                  </div>
                </section>

                {mostrarConversa && <section ref={convRef} className="scroll-mt-[150px] lg:scroll-mt-0 bg-white border-t lg:border border-zinc-200 lg:rounded-2xl flex flex-col flex-1 lg:flex-none lg:h-[560px] xl:h-auto xl:min-h-0 lg:overflow-hidden" aria-label="Conversa">
                  <div className="px-4 py-3.5 border-b border-zinc-200 flex items-center gap-2 shrink-0">
                    <h3 className="text-[15px] font-semibold m-0">Pedido de ajuste</h3>
                    <span className="text-xs text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md">sobre este {isRoteiro ? 'roteiro' : 'post'}</span>
                  </div>
                  <ConversaMaterial
                    className="flex-1 min-h-[260px] lg:min-h-0"
                    mensagensClassName="overflow-visible lg:overflow-y-auto"
                    composerClassName="sticky bottom-0 z-10 pb-[calc(12px+env(safe-area-inset-bottom))] shadow-[0_-6px_20px_rgba(0,0,0,0.05)] lg:static lg:pb-3 lg:shadow-none"
                    focarSinal={focarConversa}
                    mensagens={mensagens}
                    carregando={carregandoConversa}
                    perspectiva="cliente"
                    onEnviar={enviarConversa}
                    onTranscrever={(mensagemId) => transcreverAudioPortal(token, selectedId!, mensagemId)}
                    modoAjuste={modoAjuste}
                    onCancelarAjuste={() => setModoAjuste(false)}
                    mostrarSobre={modoAjuste && ehVideoComCapa}
                    alvoInicial={mediaTab === 'capa' ? 'capa' : 'video'}
                    vazio="Conte o que você quer ajustar. Você pode escrever, mandar fotos ou gravar um áudio."
                    placeholder={modoAjuste ? 'O que você quer ajustar?' : 'Escreva sobre o ajuste…'}
                  />
                </section>}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Tela cheia */}
      {previewUrl && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black p-4">
          <div className="w-full flex-1 flex items-center justify-center min-h-0">
            <div className="relative w-full max-w-[420px] aspect-[9/16] max-h-full bg-black rounded-2xl overflow-hidden">
              {isGoogleDriveVideo(previewUrl)
                ? <ScaledGoogleDrivePlayer url={previewUrl} zoomMode="fit" aspectRatio="9/16" />
                : isImagem(previewUrl)
                  ? <img src={previewUrl} alt="Visualização" className="absolute inset-0 w-full h-full object-contain" />
                  : <iframe title="Visualização" src={getEmbedUrl(previewUrl) || previewUrl} className="absolute inset-0 w-full h-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />}
            </div>
          </div>
          <div className="flex items-center gap-3 pt-4 pb-[env(safe-area-inset-bottom)]">
            <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-white/15 text-white text-[13px] font-medium hover:bg-white/25"><ExternalLink size={15} /> Abrir original</a>
            <button type="button" onClick={() => setPreviewUrl(null)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-white text-zinc-900 text-[13px] font-medium"><X size={15} /> Fechar</button>
          </div>
        </div>
      )}

      {/* Confirmação de aprovação */}
      {confirmar && (
        <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-zinc-950/40 sm:p-4" onClick={() => !actionLoading && setConfirmar(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl">
            <div className="px-5 pt-5 pb-2">
              <h3 className="text-[17px] font-medium m-0">{confirmar.tipo === 'lote' ? `Aprovar ${confirmar.itens.length} roteiros?` : isRoteiro ? 'Aprovar este roteiro?' : 'Aprovar este post?'}</h3>
              <p className="text-[13px] text-zinc-500 mt-1 mb-0">
                {isRoteiro ? 'A equipe é avisada na hora e começa a gravação e a edição.' : 'O conteúdo fica marcado como aprovado e pronto para postar.'}
              </p>
              {confirmar.tipo === 'lote' && (
                <ul className="mt-3 mb-0 pl-0 list-none max-h-40 overflow-y-auto space-y-1.5">
                  {confirmar.itens.map(m => <li key={m.id} className="flex items-start gap-2 text-[13px] text-zinc-700"><FileText size={14} className="text-brand mt-0.5 shrink-0" />{m.titulo}</li>)}
                </ul>
              )}
            </div>
            <div className="px-5 pt-3 pb-5 flex justify-end gap-2">
              <button type="button" disabled={actionLoading} onClick={() => setConfirmar(null)} className={btnLine}>Voltar</button>
              <button type="button" disabled={actionLoading} onClick={() => aprovar(confirmar.itens, confirmar.label)} className={btnInk}>{actionLoading ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} strokeWidth={2.6} />} Confirmar aprovação</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
