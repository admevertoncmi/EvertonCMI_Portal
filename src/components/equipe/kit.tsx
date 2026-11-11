"use client"

// Peças compartilhadas das telas da equipe (Editor/Designer em /editor e Decupador em /planner).
// Mesmo visual do painel admin: barra lateral clara, cabeçalho com ícone, cards de números,
// filtros em pílulas, linhas de tarefa em card e painel lateral ao abrir a tarefa.

import { useEffect, useState, type ReactNode } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import {
  X, Menu, LogOut, Sun, Moon, ChevronLeft, ChevronRight, Loader2, ExternalLink, AlertTriangle, Flag, Calendar, Palette, CheckCircle2,
} from 'lucide-react'
import { PALETAS_TEMA, aplicarCoresNaTela, limparCoresDaTela, temaValido, type BrandColors } from '@/lib/tema'
import { lerPaletaMembro, salvarPaletaMembro } from '@/actions/tema'
import { toast } from 'sonner'
import { ScaledGoogleDrivePlayer } from '@/components/ScaledGoogleDrivePlayer'
import GoogleDrivePicker from '@/components/GoogleDrivePicker'
import { getDriveFolderFiles } from '@/actions/google'
import { isDateLate } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Utilidades de texto e mídia
// ---------------------------------------------------------------------------

/** Tira as marcas internas [ID:...] e [DATE:...] do texto. */
export const textoLimpo = (t?: string | null) => (t || '').replace(/\[ID:[^\]]+\]\s*/g, '').replace(/\[DATE:[^\]]+\]\s*/g, '').trim()

export function TextoComLinks({ texto }: { texto?: string | null }) {
  const limpo = textoLimpo(texto)
  if (!limpo) return null
  const re = /(https?:\/\/[^\s]+)/g
  return <>{limpo.split(re).map((p, i) => /^https?:\/\//.test(p)
    ? <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="text-brand underline underline-offset-2 break-all">{p}</a>
    : <span key={i}>{p}</span>)}</>
}

/** Instrução do admin filtrada para o papel (blocos [EDITOR] / [DESIGNER] + texto comum). */
export function instrucaoParaPapel(text?: string | null, papel?: string) {
  if (!text) return ''
  const t = text.replace(/\[ID:[^\]]+\]\s*/g, '')
  if (!t.includes('[EDITOR]') && !t.includes('[DESIGNER]')) return t.trim()
  const blocos = (tag: string) => Array.from(t.matchAll(new RegExp(`\\[${tag}\\]([\\s\\S]*?)\\[\\/${tag}\\]`, 'g'))).map(m => m[1].trim())
  let res = ''
  if (papel === 'editor') res += blocos('EDITOR').join('\n\n---\n\n')
  if (papel === 'designer') res += blocos('DESIGNER').join('\n\n---\n\n')
  const comum = t.replace(/\[EDITOR\][\s\S]*?\[\/EDITOR\]/g, '').replace(/\[DESIGNER\][\s\S]*?\[\/DESIGNER\]/g, '').replace(/^(---|\s)+|(-+)\s*$/g, '').trim()
  if (comum) res += (res ? '\n\n---\n\n' : '') + comum
  return res.trim()
}

/** Entradas do campo "feedback" (mais recente primeiro), separando as da equipe ([ID:]) das do cliente. */
export function entradasFeedback(feedback?: string | null) {
  if (!feedback) return [] as { data: string | null; texto: string; daEquipe: boolean }[]
  return feedback.split('\n\n').filter(b => b.trim()).map(b => ({
    data: /\[DATE:(.*?)\]/.exec(b)?.[1] || null,
    texto: textoLimpo(b),
    daEquipe: b.includes('[ID:'),
  })).filter(e => e.texto)
}

export const isImagem = (url: string) => /\.(jpeg|jpg|gif|png|webp|avif|jfif)$/i.test(url || '')
export const isGoogleDriveVideo = (url: string) => !!url && url.includes('drive.google.com') && (url.includes('/file/d/') || url.includes('id=') || url.includes('/view') || url.includes('/preview'))
export const getEmbedUrl = (url: string) => {
  if (url.includes('drive.google.com')) {
    const pasta = url.match(/\/folders\/([a-zA-Z0-9_-]+)/)
    if (pasta) return `https://drive.google.com/embeddedfolderview?id=${pasta[1]}#grid`
    return url.replace('/view', '/preview').replace('open?id=', 'file/d/').replace(/(\/view|\/viewusp=sharing)/, '/preview')
  }
  return url
}
export const getGoogleDriveId = (url: string) =>
  /\/file\/d\/([a-zA-Z0-9_-]+)/.exec(url)?.[1] || (url.includes('drive.google.com') ? /id=([a-zA-Z0-9_-]+)/.exec(url)?.[1] : null) || /\/folders\/([a-zA-Z0-9_-]+)/.exec(url)?.[1] || null

/** Carrega o script de login do Google (usado em "Limpar Cópia de") se ainda não estiver na página. */
export function garantirGoogleIdentity(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject()
  if ((window as any).google?.accounts?.oauth2) return Promise.resolve()
  return new Promise((ok, falha) => {
    const existente = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]')
    const s = existente || document.createElement('script')
    const pronto = () => ((window as any).google?.accounts?.oauth2 ? ok() : setTimeout(pronto, 150))
    s.addEventListener('load', pronto)
    s.addEventListener('error', () => falha(new Error('Falha ao carregar o Google')))
    if (!existente) { s.src = 'https://accounts.google.com/gsi/client'; s.async = true; document.body.appendChild(s) } else pronto()
  })
}

// ---------------------------------------------------------------------------
// Prazos e filtros
// ---------------------------------------------------------------------------

export type FiltroPrazo = 'todas' | 'hoje' | 'atrasadas' | 'semana' | 'futura'
const dataLocal = (s: string) => { const [y, m, d] = s.split('T')[0].split('-').map(Number); return new Date(y, m - 1, d) }
export const fmtData = (s?: string | null) => s ? dataLocal(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''

export function prazoInfo(s?: string | null) {
  if (!s) return { late: false, hoje: false }
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  return { late: isDateLate(s.split('T')[0]), hoje: dataLocal(s).getTime() === hoje.getTime() }
}

export function passaFiltro(s: string | null | undefined, f: FiltroPrazo) {
  if (f === 'todas') return true
  if (!s) return false
  const d = dataLocal(s)
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const dia = hoje.getDay() || 7
  const ini = new Date(hoje); ini.setDate(hoje.getDate() - dia + 1)
  const fim = new Date(ini); fim.setDate(ini.getDate() + 6)
  if (f === 'hoje') return d.getTime() === hoje.getTime()
  if (f === 'atrasadas') return d < hoje
  if (f === 'semana') return d >= ini && d <= fim
  return d > fim
}

// ---------------------------------------------------------------------------
// Visual (mesmas classes do painel admin)
// ---------------------------------------------------------------------------

export const btnInk = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] bg-brand-ink text-white text-[13px] font-medium hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none transition-all whitespace-nowrap'
export const btnLine = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 text-[13px] font-medium disabled:opacity-50 disabled:pointer-events-none transition-colors whitespace-nowrap'
export const inputCls = 'w-full px-3.5 py-2.5 rounded-[10px] border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition-colors'
export const cardCls = 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800'

export type CorChip = 'zinc' | 'blue' | 'amber' | 'red' | 'green'
const CHIP: Record<CorChip, string> = {
  zinc: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
  red: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
  green: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
}
export const Chip = ({ cor, children }: { cor: CorChip; children: ReactNode }) => (
  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-md whitespace-nowrap ${CHIP[cor]}`}>
    <span className="w-1.5 h-1.5 rounded-full bg-current" />{children}
  </span>
)

export function Prazo({ data }: { data?: string | null }) {
  if (!data) return <span className="text-xs text-zinc-400">Sem prazo</span>
  const p = prazoInfo(data)
  if (p.late) return <span className="inline-flex items-center gap-1 text-[13px] font-medium text-red-600 dark:text-red-400"><Flag size={13} /> {fmtData(data)}</span>
  if (p.hoje) return <span className="inline-flex items-center gap-1 text-[13px] font-medium text-amber-700 dark:text-amber-400"><Calendar size={13} /> Hoje</span>
  return <span className="inline-flex items-center gap-1 text-[13px] text-zinc-600 dark:text-zinc-300"><Calendar size={13} className="text-zinc-400" /> {fmtData(data)}</span>
}

// ---------------------------------------------------------------------------
// Tema claro/escuro (por tela, como antes)
// ---------------------------------------------------------------------------

// Modo claro/escuro individual: cada membro tem o seu (chave '<tela>:<id do membro>')
export function useTemaEquipe(chave: string, membroId: string | null) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const chaveMembro = membroId ? `${chave}:${membroId}` : null
  useEffect(() => {
    if (!chaveMembro) return
    let s: string | null = null
    try { s = localStorage.getItem(chaveMembro); localStorage.removeItem(chave) } catch { /* sem armazenamento */ }
    setTheme(s === 'dark' ? 'dark' : 'light')
  }, [chave, chaveMembro])
  useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark') }, [theme])
  const alternar = () => setTheme(t => {
    const n = t === 'dark' ? 'light' : 'dark'
    try { if (chaveMembro) localStorage.setItem(chaveMembro, n) } catch { /* sem armazenamento */ }
    return n
  })
  return { theme, alternar }
}

// Paleta pessoal: cada membro tem a sua, salva no banco (configuracoes 'paleta:<id>').
// Não muda o tema do sistema. O navegador guarda uma cópia por membro só para pintar sem piscar.
const chaveCache = (id: string) => `equipe-paleta:${id}`
const mesmaCor = (a: BrandColors, b: BrandColors) => a.soft.toLowerCase() === b.soft.toLowerCase() && a.brand.toLowerCase() === b.brand.toLowerCase() && a.ink.toLowerCase() === b.ink.toLowerCase()
const pintar = (c: BrandColors | null) => { if (c) aplicarCoresNaTela(c); else limparCoresDaTela() }
const gravarCache = (id: string, c: BrandColors | null) => {
  try { if (c) localStorage.setItem(chaveCache(id), JSON.stringify(c)); else localStorage.removeItem(chaveCache(id)) } catch { /* sem armazenamento */ }
}

function usePaletaPessoal(membroId: string | null) {
  const [paleta, setPaleta] = useState<BrandColors | null>(null)
  useEffect(() => {
    try { localStorage.removeItem('equipe-paleta') } catch { /* sobra da versão que era uma só por navegador */ }
    if (!membroId) return
    let vivo = true
    let cache: BrandColors | null = null
    try { cache = temaValido(JSON.parse(localStorage.getItem(chaveCache(membroId)) || 'null')) } catch { /* sem cache */ }
    setPaleta(cache); pintar(cache)
    lerPaletaMembro(membroId).then(c => {
      if (!vivo) return
      setPaleta(c); pintar(c); gravarCache(membroId, c)
    }).catch(() => null)
    return () => { vivo = false }
  }, [membroId])
  const escolher = (c: BrandColors | null) => {
    if (!membroId) return
    const anterior = paleta
    setPaleta(c); pintar(c); gravarCache(membroId, c)
    salvarPaletaMembro(membroId, c).catch(() => {
      setPaleta(anterior); pintar(anterior); gravarCache(membroId, anterior)
      toast.error('Não foi possível salvar as cores. Tente de novo.')
    })
  }
  return { paleta, escolher }
}

function ModalPaletas({ aberto, onFechar, paleta, onEscolher }: { aberto: boolean; onFechar: () => void; paleta: BrandColors | null; onEscolher: (c: BrandColors | null) => void }) {
  const opcao = (key: string, nome: string, cores: BrandColors | null, on: boolean, desc?: string) => (
    <button key={key} type="button" onClick={() => onEscolher(cores)}
      className={`flex items-center gap-2.5 p-3 rounded-xl text-left transition-colors ${on ? 'border-2 border-brand-ink dark:border-zinc-200' : 'border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}>
      {cores
        ? <span className="flex shrink-0"><span className="w-7 h-7 rounded-full border-2 border-white dark:border-zinc-900 shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" style={{ background: cores.soft }} /><span className="w-7 h-7 rounded-full border-2 border-white dark:border-zinc-900 -ml-2" style={{ background: cores.brand }} /></span>
        : <span className="w-7 h-7 rounded-full shrink-0 bg-brand-soft inline-flex items-center justify-center"><span className="w-3 h-3 rounded-full bg-brand" /></span>}
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium">{nome}</span>
        {desc && <span className="block text-[11px] text-zinc-500">{desc}</span>}
      </span>
      {on && <CheckCircle2 size={16} className="ml-auto shrink-0" />}
    </button>
  )
  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Cores do painel" descricao="Escolha a paleta deste painel. Muda só para esta pessoa, em qualquer aparelho."
      rodape={<button type="button" className={btnInk} onClick={onFechar}>Pronto</button>}>
      <div className="grid grid-cols-2 gap-2.5">
        {opcao('sistema', 'Padrão do sistema', null, !paleta, 'A cor definida pelo admin')}
        {PALETAS_TEMA.map(p => opcao(p.nome, p.nome, p.cores, !!paleta && mesmaCor(p.cores, paleta)))}
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Estrutura da tela: barra lateral + conteúdo
// ---------------------------------------------------------------------------

export type ItemMenu = { id: string; label: string; icon: any; count?: number }

export function TeamShell({ papel, nome, membroId, menu, ativo, onMenu, theme, alternarTema, comoAdmin, onSair, children }: {
  papel: string; nome: string; membroId: string | null; menu: ItemMenu[]; ativo: string; onMenu: (id: string) => void
  theme: 'light' | 'dark'; alternarTema: () => void; comoAdmin: string | null; onSair: () => void; children: ReactNode
}) {
  // Mesmo esqueleto do painel admin: barra no topo no computador; no celular, topo com logo + barra de abas embaixo
  const iniciais = (nome || '?').split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()
  const { paleta, escolher } = usePaletaPessoal(membroId)
  const [paletasAbertas, setPaletasAbertas] = useState(false)
  const iconBtn = `w-9 h-9 inline-flex items-center justify-center rounded-[10px] transition-colors ${theme === 'dark' ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-500'}`
  const logo = <img src={theme === 'dark' ? '/logo-light.png' : '/logo-dark.png'} alt="Everton" className="h-9 w-auto object-contain" />
  const botaoSair = comoAdmin
    ? <a href="/admin/dashboard" aria-label="Voltar ao painel admin" title="Voltar ao painel admin" className={`${iconBtn} hover:text-brand`}><LogOut size={17} /></a>
    : <button type="button" onClick={onSair} aria-label="Sair" title="Sair" className={`${iconBtn} hover:text-red-600`}><LogOut size={17} /></button>
  const botaoTema = (
    <button type="button" onClick={alternarTema} aria-label={theme === 'dark' ? 'Modo claro' : 'Modo escuro'} title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'} className={`${iconBtn} hover:text-brand`}>
      {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  )
  const botaoPaleta = (
    <button type="button" onClick={() => setPaletasAbertas(true)} aria-label="Cores do painel" title="Cores do painel" className={`${iconBtn} hover:text-brand`}>
      <Palette size={17} />
    </button>
  )
  return (
    <div className="flex flex-col h-[100dvh] bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 font-sans overflow-hidden">
      {/* TOPO (computador) */}
      <header className="hidden md:flex items-center gap-2 lg:gap-3 px-4 lg:px-8 h-16 shrink-0 border-b bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 relative z-[60]">
        <span className="shrink-0 mr-2 lg:mr-4">{logo}</span>
        <nav className="flex items-center gap-0.5 min-w-0">
          {menu.map(it => {
            const on = it.id === ativo
            return (
              <button key={it.id} type="button" onClick={() => onMenu(it.id)} title={it.label}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-[10px] text-[13.5px] font-medium whitespace-nowrap transition-colors ${on ? 'bg-brand-soft text-brand dark:bg-brand/20 dark:text-brand-soft' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
                <it.icon size={17} className={on ? '' : 'text-zinc-400'} />
                {it.label}
                {!!it.count && <span className={`text-[11px] px-1.5 py-px rounded-md font-semibold ${on ? 'bg-white text-brand' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}>{it.count}</span>}
              </button>
            )
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <span className="hidden lg:flex items-center gap-2.5 pr-2 mr-1 border-r border-zinc-200 dark:border-zinc-800">
            <span className="w-8 h-8 rounded-full bg-brand-soft text-brand dark:bg-brand/20 dark:text-brand-soft text-[11px] font-semibold inline-flex items-center justify-center shrink-0">{iniciais}</span>
            <span className="leading-tight pr-2">
              <span className="block text-[13px] font-medium max-w-[160px] truncate">{nome || '—'}</span>
              <span className="block text-[11px] text-zinc-500">{papel}</span>
            </span>
          </span>
          {botaoPaleta}
          {botaoTema}
          {botaoSair}
        </div>
      </header>

      {/* TOPO (celular) */}
      <header className="md:hidden h-14 shrink-0 flex items-center gap-3 px-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        {logo}
        <div className="ml-auto flex items-center gap-2">{botaoPaleta}{botaoTema}{botaoSair}</div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="px-4 md:px-10 pt-6 md:pt-8 pb-28 md:pb-24">{children}</div>
      </main>

      {/* BARRA INFERIOR (celular) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-[50] bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-around items-center px-2 pt-2 pb-3">
          {menu.map(it => {
            const on = it.id === ativo
            return (
              <button key={it.id} type="button" onClick={() => onMenu(it.id)} className={`flex flex-col items-center gap-1 min-w-16 text-[11px] font-medium transition-colors ${on ? 'text-brand' : 'text-zinc-500'}`}>
                <span className={`relative px-3.5 py-1 rounded-[10px] ${on ? 'bg-brand-soft dark:bg-brand/20' : ''}`}>
                  <it.icon size={20} />
                  {!!it.count && <span className="absolute -top-1 -right-0.5 min-w-[16px] h-4 px-1 bg-brand text-white text-[10px] rounded-full flex items-center justify-center font-semibold">{it.count}</span>}
                </span>
                {it.label}
              </button>
            )
          })}
        </div>
      </nav>

      <ModalPaletas aberto={paletasAbertas} onFechar={() => setPaletasAbertas(false)} paleta={paleta} onEscolher={escolher} />

      {comoAdmin && (
        <div className="fixed bottom-[84px] md:bottom-4 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-3 pl-4 pr-1.5 py-1.5 rounded-full bg-zinc-900 text-white text-[13px] shadow-xl max-w-[calc(100%-24px)]">
          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
          <span className="truncate">Você está no painel de <b>{comoAdmin}</b>. As ações valem de verdade e ficam registradas como “via admin”.</span>
          <a href="/admin/dashboard" className="shrink-0 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 font-medium">Voltar ao painel</a>
        </div>
      )}
    </div>
  )
}

export function PageHeader({ titulo, meta, icon: Icon }: { titulo: string; meta?: string; icon: any }) {
  return (
    <div className="flex items-center gap-3.5 mb-6">
      <span className="w-12 h-12 rounded-xl inline-flex items-center justify-center shrink-0 bg-brand-soft text-brand dark:bg-brand/20 dark:text-brand-soft"><Icon size={22} /></span>
      <div className="min-w-0">
        <h1 className="text-2xl font-medium tracking-tight truncate">{titulo}</h1>
        {meta && <p className="text-[13px] text-zinc-500 mt-0.5">{meta}</p>}
      </div>
    </div>
  )
}

export function StatCards({ itens }: { itens: { label: string; valor: number; icon: any; destaque?: 'red' | 'amber'; onClick?: () => void; ativo?: boolean }[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {itens.map(it => {
        const cor = it.valor > 0 && it.destaque === 'red' ? 'text-red-600 dark:text-red-400' : it.valor > 0 && it.destaque === 'amber' ? 'text-amber-700 dark:text-amber-400' : ''
        return (
          <button key={it.label} type="button" onClick={it.onClick} disabled={!it.onClick}
            className={`${cardCls} rounded-2xl p-4 text-left transition-colors ${it.onClick ? 'hover:border-zinc-300 dark:hover:border-zinc-700' : 'cursor-default'} ${it.ativo ? '!border-brand ring-[3px] ring-brand/10' : ''}`}>
            <it.icon size={18} className={`mb-2 ${cor || 'text-zinc-400'}`} />
            <div className={`text-2xl font-semibold leading-none ${cor}`}>{it.valor}</div>
            <div className="text-xs text-zinc-500 mt-1.5">{it.label}</div>
          </button>
        )
      })}
    </div>
  )
}

export function Filtros<T extends string>({ valor, onChange, opcoes }: { valor: T; onChange: (v: T) => void; opcoes: { id: T; label: string; icon?: any }[] }) {
  return (
    <div className="flex gap-0.5 p-1 rounded-xl overflow-x-auto bg-zinc-100 dark:bg-zinc-800 w-full md:w-auto">
      {opcoes.map(o => {
        const on = o.id === valor
        return (
          <button key={o.id} type="button" aria-pressed={on} onClick={() => onChange(o.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium shrink-0 transition-colors ${on ? 'bg-white dark:bg-zinc-900 text-brand shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}>
            {o.icon && <o.icon size={14} />}{o.label}
          </button>
        )
      })}
    </div>
  )
}

export function GrupoCliente({ nome, meta, children, extra }: { nome: string; meta: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <section className="mb-6">
      <div className="flex items-center gap-2.5 mb-2.5 px-1">
        <span className="w-7 h-7 rounded-full bg-brand-soft text-brand dark:bg-brand/20 dark:text-brand-soft text-xs font-semibold inline-flex items-center justify-center shrink-0">{(nome || '?').trim()[0]?.toUpperCase()}</span>
        <h2 className="text-[15px] font-semibold truncate">{nome}</h2>
        <span className="text-xs text-zinc-500 shrink-0">{meta}</span>
        {extra && <div className="ml-auto flex items-center gap-2">{extra}</div>}
      </div>
      <div className="space-y-1.5">{children}</div>
    </section>
  )
}

/** Linha da tarefa (clique abre o painel). Colunas no computador: tarefa | status | prazo | ação. */
export function LinhaTarefa({ titulo, sub, status, prazo, acao, onClick, apagada, lead }: {
  titulo: string; sub?: ReactNode; status: ReactNode; prazo?: ReactNode; acao?: ReactNode; onClick: () => void; apagada?: boolean; lead?: ReactNode
}) {
  return (
    <div role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => { if (e.key === 'Enter') onClick() }}
      className={`${cardCls} rounded-xl px-3.5 py-3 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors flex flex-col gap-2.5 md:grid md:grid-cols-[minmax(0,1fr)_170px_96px_150px] md:items-center md:gap-4 ${apagada ? 'opacity-70' : ''}`}>
      <div className="flex items-center gap-3 min-w-0">
        {lead}
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{titulo}</p>
          {sub && <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1.5 flex-wrap">{sub}</div>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">{status}</div>
      <div>{prazo}</div>
      <div className="flex md:justify-end" onClick={(e) => e.stopPropagation()}>{acao}</div>
    </div>
  )
}

export function Vazio({ titulo, texto, icon: Icon }: { titulo: string; texto: string; icon: any }) {
  return (
    <div className={`${cardCls} border-dashed rounded-2xl p-10 text-center`}>
      <Icon size={28} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-600" />
      <p className="text-[15px] font-medium">{titulo}</p>
      <p className="text-sm text-zinc-500 mt-1">{texto}</p>
    </div>
  )
}

/** Painel lateral da tarefa, no padrão do painel admin. */
export function PainelTarefa({ aberto, onFechar, crumb, titulo, status, acoes, children }: {
  aberto: boolean; onFechar: () => void; crumb: string; titulo: string; status?: ReactNode; acoes?: ReactNode; children: ReactNode
}) {
  useEffect(() => {
    if (!aberto) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [aberto, onFechar])
  if (!aberto) return null
  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-zinc-950/30 animate-in fade-in duration-200" onClick={onFechar}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 w-full md:w-[680px] h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="px-5 md:px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-zinc-500 truncate">{crumb}</p>
              <h2 className="text-lg font-semibold leading-snug mt-0.5 break-words">{titulo}</h2>
              {status && <div className="flex items-center gap-2 flex-wrap mt-1.5">{status}</div>}
            </div>
            <button type="button" onClick={onFechar} aria-label="Fechar" className="w-9 h-9 rounded-[10px] border border-zinc-200 dark:border-zinc-700 inline-flex items-center justify-center text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 shrink-0"><X size={17} /></button>
          </div>
          {acoes && <div className="flex flex-wrap gap-2 mt-3.5">{acoes}</div>}
        </div>
        <div className="flex-1 overflow-y-auto px-5 md:px-6 py-5 space-y-6">{children}</div>
      </div>
    </div>
  )
}

export function Secao({ titulo, children, extra }: { titulo: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2.5">
        <h3 className="text-[13px] font-semibold text-zinc-500 uppercase tracking-wider">{titulo}</h3>
        {extra && <div className="ml-auto">{extra}</div>}
      </div>
      {children}
    </section>
  )
}

/** Bloco de texto que recolhe quando é longo. */
export function TextoRecolhivel({ texto, linhas = 6 }: { texto: string; linhas?: number }) {
  const [aberto, setAberto] = useState(false)
  const longo = texto.length > 320 || texto.split('\n').length > linhas
  return (
    <div>
      <div className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${!aberto && longo ? 'line-clamp-6' : ''}`}><TextoComLinks texto={texto} /></div>
      {longo && <button type="button" onClick={() => setAberto(v => !v)} className="mt-1.5 text-xs font-medium text-brand hover:underline">{aberto ? 'Ver menos' : 'Ver tudo'}</button>}
    </div>
  )
}

export function LinkPasta({ label, url, extra }: { label: string; url?: string | null; extra?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
      <span className="text-[13px] font-medium flex-1 min-w-0 truncate">{label}</span>
      {url ? <>
        {extra}
        <a href={url} target="_blank" rel="noopener noreferrer" className={`${btnLine} !py-1.5 !px-3 !text-xs`}><ExternalLink size={13} /> Abrir</a>
      </> : <span className="text-xs text-zinc-400">Ainda não enviada</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Janelas
// ---------------------------------------------------------------------------

export function Modal({ aberto, onFechar, titulo, descricao, children, rodape }: {
  aberto: boolean; onFechar: () => void; titulo: string; descricao?: string; children: ReactNode; rodape: ReactNode
}) {
  if (!aberto) return null
  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-zinc-950/40 sm:p-4 animate-in fade-in duration-200" onClick={onFechar}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92dvh] flex flex-col">
        <div className="px-5 pt-5 pb-1 shrink-0">
          <h3 className="text-[17px] font-medium">{titulo}</h3>
          {descricao && <p className="text-[13px] text-zinc-500 mt-1">{descricao}</p>}
        </div>
        <div className="px-5 py-4 space-y-4 overflow-y-auto">{children}</div>
        <div className="px-5 pt-1 pb-5 flex justify-end gap-2 shrink-0">{rodape}</div>
      </div>
    </div>
  )
}

/** Campo de link com o seletor do Google Drive. Começa sempre vazio (evita entregar link antigo/errado). */
export function CampoLinkDrive({ label, valor, onChange, tipo, placeholder }: { label: string; valor: string; onChange: (v: string) => void; tipo: 'file' | 'folder'; placeholder: string }) {
  return (
    <div className="space-y-2">
      <label className="block text-[13px] font-medium">{label}</label>
      <input className={inputCls} value={valor} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      <GoogleDrivePicker onSelect={onChange} type={tipo} label={tipo === 'folder' ? 'Selecionar pasta no Google Drive' : 'Selecionar arquivo no Google Drive'} />
    </div>
  )
}

export function ModalProblema({ aberto, onFechar, titulo, tipo, onTipo, texto, onTexto, enviando, onEnviar }: {
  aberto: boolean; onFechar: () => void; titulo: string
  tipo: 'faltando_material' | 'verificar_material'; onTipo: (t: 'faltando_material' | 'verificar_material') => void
  texto: string; onTexto: (t: string) => void; enviando: boolean; onEnviar: () => void
}) {
  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Relatar problema" descricao={titulo}
      rodape={<>
        <button type="button" className={btnLine} onClick={onFechar} disabled={enviando}>Cancelar</button>
        <button type="button" className={btnInk} onClick={onEnviar} disabled={enviando || !texto.trim()}>{enviando ? <Loader2 size={15} className="animate-spin" /> : <AlertTriangle size={15} />} Avisar o admin</button>
      </>}>
      <div className="space-y-2">
        <label className="block text-[13px] font-medium">O que aconteceu?</label>
        <div className="grid grid-cols-2 gap-2">
          {([['faltando_material', 'Falta material'], ['verificar_material', 'Material com problema']] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => onTipo(k)} className={`px-3 py-2.5 rounded-[10px] border text-[13px] font-medium transition-colors ${tipo === k ? 'border-brand bg-brand-soft/50 text-brand dark:bg-brand/15' : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'}`}>{l}</button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <label className="block text-[13px] font-medium">Explique para o admin</label>
        <textarea className={`${inputCls} min-h-[120px] resize-y`} value={texto} onChange={e => onTexto(e.target.value)} placeholder="Ex.: A pasta bruta não tem os vídeos da gravação de terça." autoFocus />
      </div>
    </Modal>
  )
}

/** Tela cheia para vídeo, capa ou pasta do Drive (pasta vira carrossel). */
export function VisualizadorMidia({ url, onFechar }: { url: string | null; onFechar: () => void }) {
  const [links, setLinks] = useState<string[]>([])
  const [carregando, setCarregando] = useState(false)
  const [slide, setSlide] = useState(0)
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true })

  useEffect(() => {
    if (!emblaApi) return
    const on = () => setSlide(emblaApi.selectedScrollSnap())
    emblaApi.on('select', on)
    return () => { emblaApi.off('select', on) }
  }, [emblaApi])

  useEffect(() => {
    setSlide(0)
    if (!url) { setLinks([]); return }
    const pasta = /\/folders\/([a-zA-Z0-9_-]+)/.exec(url)?.[1]
    if (!pasta) { setLinks(url.split(/[\n,;]+/).map(l => l.trim()).filter(Boolean)); return }
    setCarregando(true)
    getDriveFolderFiles(pasta).then(f => setLinks(f?.length ? f : [url])).catch(() => setLinks([url])).finally(() => setCarregando(false))
  }, [url])

  if (!url) return null
  const midia = (link: string) => isImagem(link)
    ? <img src={link} alt="Visualização" className="absolute inset-0 w-full h-full object-contain" />
    : isGoogleDriveVideo(link)
      ? <ScaledGoogleDrivePlayer url={link} zoomMode="fit" aspectRatio="9/16" />
      : <iframe title="Visualização" src={getEmbedUrl(link)} className="absolute inset-0 w-full h-full border-0" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />

  return (
    <div className="fixed inset-0 z-[130] bg-black flex flex-col items-center justify-center p-4">
      <div className="flex-1 w-full flex items-center justify-center min-h-0">
        <div className="relative w-full max-w-[420px] aspect-[9/16] max-h-full rounded-2xl overflow-hidden bg-black">
          {carregando ? <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="animate-spin text-white/50" size={30} /></div>
            : links.length > 1 ? (
              <>
                <div className="absolute inset-0 overflow-hidden" ref={emblaRef}>
                  <div className="flex h-full">{links.map((l, i) => <div key={i} className="relative flex-[0_0_100%] min-w-0 h-full">{Math.abs(i - slide) <= 1 ? midia(l) : null}</div>)}</div>
                </div>
                <button type="button" aria-label="Anterior" onClick={() => emblaApi?.scrollPrev()} className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 text-white inline-flex items-center justify-center"><ChevronLeft size={20} /></button>
                <button type="button" aria-label="Próxima" onClick={() => emblaApi?.scrollNext()} className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 text-white inline-flex items-center justify-center"><ChevronRight size={20} /></button>
                <span className="absolute top-2 right-2 text-[11px] font-semibold bg-black/50 text-white px-2 py-0.5 rounded-md">{slide + 1}/{links.length}</span>
              </>
            ) : midia(links[0] || url)}
        </div>
      </div>
      <div className="flex items-center gap-3 pt-4 pb-[env(safe-area-inset-bottom)]">
        <a href={links[slide] || url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-white/15 text-white text-[13px] font-medium hover:bg-white/25"><ExternalLink size={15} /> Abrir original</a>
        <button type="button" onClick={onFechar} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-white text-zinc-900 text-[13px] font-medium"><X size={15} /> Fechar</button>
      </div>
    </div>
  )
}
