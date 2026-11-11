"use client"
import { linkifyHtml, formatRichText, getSafePortalUrl } from '@/lib/utils';
import { isDateLate, isTaskLate } from "@/lib/utils";


import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { Toaster, toast } from 'sonner'
import { criarMembroEquipe, atualizarMembroEquipe, excluirMembro } from '@/actions/equipe'
import { cadastrarClienteCompleto } from '@/actions/clientes'
import { notificarClickUpChat, getClickUpTaskAndSubtasks, getClickUpTask } from '@/actions/clickup'
import { notificarWhatsApp, buscarGruposWhatsApp } from '@/actions/whatsapp'
import { useAdminData } from '@/hooks/useAdminData'
import { getDriveFolderFiles } from '@/actions/google'
import { createBatchFolders } from '@/actions/google-mutations'
import { StorageWidget } from '@/components/StorageWidget'
import ConversaMaterial, { enviarAnexos, type EnvioConversa, type MensagemConversa } from '@/components/ConversaMaterial'
import { conversaEquipe, prepararAnexoEquipe, enviarMensagemEquipe, naoLidasEquipe } from '@/actions/conversa'
import { lerTemaEquipe, salvarTema } from '@/actions/tema'
import { useState, useCallback, useEffect, useMemo, useRef, startTransition } from 'react'
import { createPortal } from 'react-dom'
import useEmblaCarousel from 'embla-carousel-react'
import dynamic from 'next/dynamic'
const ReactQuill = dynamic(() => import('@/components/Editor'), { ssr: false })
import { marked } from 'marked'
import GoogleDrivePicker from '@/components/GoogleDrivePicker'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'


import { ScaledGoogleDrivePlayer } from './ScaledGoogleDrivePlayer'
import {
  LayoutDashboard, Users, Plus, LogOut, Phone, Link, Send,
  Trash2, ExternalLink, RotateCcw, X, MessageSquare,
  TrendingUp, CheckCircle, Clock, RefreshCw, Download,
  ChevronRight, Calendar, Search, Folder, ShieldCheck,
  Upload, Bell, Eye, UploadCloud, CheckCircle2, ClipboardCheck,
  ListTodo, FileText, LayoutList, Archive, Edit3, Tag, Check, AlertCircle, Menu, Loader2, Activity, Settings,
  FileVideo, Image as ImageIcon, ChevronDown, PlayCircle, PenTool, Sun, Moon, Flame, AlertTriangle, GripVertical, List
, Save, ChevronLeft, PieChart, Building2, Flag, Palette, SendHorizontal, CheckCheck, UserPlus, Clapperboard, Images, MoreHorizontal, Home, LogIn } from 'lucide-react'

export interface Cliente { id: string; nome: string; telefone: string; token_magico: string; wpp_suporte?: string; ciclos_contratados?: number; logo_url?: string; cor_marca?: string; whatsapp_group_id?: string; }
export interface EquipeMember { id: string; email: string; nome?: string; role: 'admin' | 'editor' | 'planner' | 'designer'; telegram_thread_id?: string; created_at?: string; }
export interface Material { id: string; cliente_id: string; titulo: string; ciclo?: string | number; link_drive?: string; link_capa?: string; link_organizado?: string; link_bruto?: string; data_limite?: string; data_limite_editor?: string; data_limite_designer?: string; roteiro?: string; video_entregue?: boolean; design_entregue?: boolean; status: any; created_at: string; tags?: string[]; feedback?: string | null; feedback_admin?: string | null; editor_id?: string | null; designer_id?: string | null; planner_id?: string | null; clickup_task_id?: string | null; cliente?: Cliente; agendado_para?: string | null; wpp_enviado?: boolean; ordem?: number; }
interface MembroComNome extends EquipeMember { nome?: string; telegram_thread_id?: string; }
interface Props { materials: Material[]; initialClientes?: Cliente[] }

const copyToClipboard = (text: string) => {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      toast.success("Copiado!");
    }).catch(() => {
      toast.error("Erro ao copiar.");
    });
  } else {
    // Fallback para navegadores antigos ou contextos não-seguros
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      toast.success("Copiado!");
    } catch (err) {
      toast.error("Erro ao copiar.");
    }
    document.body.removeChild(textArea);
  }
};

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
  } catch (error) { return null; }
}

const isGoogleDriveVideo = (url: string) => {
  if (!url) return false;
  return url.includes('drive.google.com') && (url.includes('/file/d/') || url.includes('id=') || url.includes('/view') || url.includes('/preview'));
}

const CollapsibleInstruction = ({ children, theme, textSecundario, isLong, onEdit, author }: any) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`${textSecundario} text-[11px] font-bold mt-3 ${theme === 'dark' ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-900'} p-3 rounded-lg flex flex-col group`}>
      <div className="flex justify-between items-center mb-1">
        <span className="opacity-70 font-semibold ">
          📝 Instruções {author && <span className="opacity-60 lowercase font-medium ml-1">por {author}</span>}
        </span>
        {onEdit && (
           <button onClick={onEdit} className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400" title="Editar Instrução">
             <Edit3 size={12} />
           </button>
        )}
      </div>
      <div className={`whitespace-pre-wrap break-words text-[12px] ${!expanded && isLong ? 'line-clamp-4' : ''}`}>
        {children}
      </div>
      {isLong && (
        <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} className="mt-2 self-start text-[11px] font-semibold text-blue-500 hover:text-blue-700 transition-colors">
          {expanded ? 'Ver Menos' : 'Ver Mais'}
        </button>
      )}
    </div>
  );
};



const getGoogleDriveId = (url: string) => {
  if (!url) return null;
  const driveMatch1 = /\/file\/d\/([a-zA-Z0-9_-]+)/.exec(url);
  if (driveMatch1?.[1]) return driveMatch1[1];
  const driveMatch2 = /id=([a-zA-Z0-9_-]+)/.exec(url);
  if (driveMatch2?.[1] && url.includes('drive.google.com')) return driveMatch2[1];
  const driveMatch3 = /\/folders\/([a-zA-Z0-9_-]+)/.exec(url);
  if (driveMatch3?.[1]) return driveMatch3[1];
  return null;
}

const getRawVideoUrl = (url: string) => {
  if (!url) return '';
  const driveId = getGoogleDriveId(url);
  if (driveId) return `/api/video-proxy?id=${driveId}`;
  return url;
}

type PlanSub = 'analise' | 'aprovados' | 'decupagem' | 'problemas' | 'decupado' | 'manual'
const PLAN_SUBS: { id: PlanSub; label: string; dot: string }[] = [
  { id: 'analise', label: 'Roteiros em análise', dot: 'bg-pink-500' },
  { id: 'aprovados', label: 'Roteiros aprovados', dot: 'bg-orange-500' },
  { id: 'decupagem', label: 'Em decupagem', dot: 'bg-blue-500' },
  { id: 'problemas', label: 'Problemas', dot: 'bg-red-500' },
  { id: 'decupado', label: 'Material decupado', dot: 'bg-purple-500' },
  { id: 'manual', label: 'Criação manual', dot: 'bg-zinc-400' },
]

type RelSub = 'resumo' | 'equipe' | 'clientes' | 'atrasos'
const REL_SUBS: { id: RelSub; label: string; icon: any }[] = [
  { id: 'resumo', label: 'Resumo', icon: PieChart },
  { id: 'equipe', label: 'Equipe', icon: Users },
  { id: 'clientes', label: 'Clientes', icon: Building2 },
  { id: 'atrasos', label: 'Tarefas atrasadas', icon: Flag },
]

// URL de prévia (miniatura) de um arquivo: Drive, YouTube ou imagem direta. Pastas do Drive não têm prévia.
const getThumbUrl = (url?: string | null) => {
  if (!url) return null;
  if (/\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(url)) return url;
  const yt = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/.exec(url);
  if (yt?.[1]) return `https://img.youtube.com/vi/${yt[1]}/mqdefault.jpg`;
  if (url.includes('drive.google.com') && !url.includes('/folders/')) {
    const id = /\/file\/d\/([a-zA-Z0-9_-]+)/.exec(url)?.[1] || /[?&]id=([a-zA-Z0-9_-]+)/.exec(url)?.[1];
    if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w320`;
  }
  return null;
}

// Pastas do Drive (carrosséis): a miniatura é o primeiro arquivo da pasta. Cache para não repetir a consulta.
const folderFirstFileCache = new Map<string, Promise<string | null>>();
const getFolderFirstFile = (folderId: string) => {
  if (!folderFirstFileCache.has(folderId)) {
    folderFirstFileCache.set(folderId, getDriveFolderFiles(folderId).then(files => files[0] || null).catch(() => null));
  }
  return folderFirstFileCache.get(folderId)!;
}

// Imagem real da miniatura; se não carregar (arquivo privado etc.) some e fica o bloco colorido
const ThumbImage = ({ url, label, small }: { url?: string | null; label: string; small?: boolean }) => {
  const [failed, setFailed] = useState(false);
  const folderId = url?.includes('drive.google.com') ? /\/folders\/([a-zA-Z0-9_-]+)/.exec(url)?.[1] : undefined;
  const [folderFile, setFolderFile] = useState<string | null>(null);
  useEffect(() => {
    if (!folderId) return;
    let alive = true;
    getFolderFirstFile(folderId).then(f => { if (alive) setFolderFile(f); });
    return () => { alive = false; };
  }, [folderId]);
  const src = getThumbUrl(folderId ? folderFile : url);
  if (!src || failed) return null;
  return (<>
    <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="absolute inset-0 w-full h-full object-cover" />
    <span className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent text-center font-semibold ${small ? "pt-3 pb-0.5 text-[10px]" : "pt-4 pb-1 text-[11px]"}`}>{label}</span>
  </>);
}

// Cores do tema: destaque (fundo suave), contraste (ícones/textos sobre o destaque) e botões principais
type BrandColors = { soft: string; brand: string; ink: string }
const DEFAULT_BRAND: BrandColors = { soft: '#F9E2D2', brand: '#A25431', ink: '#212013' }
const THEME_PRESETS: { nome: string; cores: BrandColors }[] = [
  { nome: 'Everton', cores: DEFAULT_BRAND },
  { nome: 'Areia', cores: { soft: '#EFE6DA', brand: '#7A6A55', ink: '#2B2620' } },
  { nome: 'Sálvia', cores: { soft: '#DDE8DF', brand: '#4C7A5A', ink: '#1E2B22' } },
  { nome: 'Céu', cores: { soft: '#DCE8F5', brand: '#3B6EA8', ink: '#1B2633' } },
  { nome: 'Rosé', cores: { soft: '#F6DDE4', brand: '#A84865', ink: '#2E1B22' } },
  { nome: 'Grafite', cores: { soft: '#E8E8E8', brand: '#3A3A3A', ink: '#1A1A1A' } },
]
const THEME_STORAGE_KEY = 'everton-brand-colors'
const hexToRgbChannels = (hex: string) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}
const applyBrandColors = (c: BrandColors) => {
  const root = document.documentElement.style;
  root.setProperty('--brand-soft', hexToRgbChannels(c.soft));
  root.setProperty('--brand', hexToRgbChannels(c.brand));
  root.setProperty('--brand-ink', hexToRgbChannels(c.ink));
}

// Botão só com ícone; o texto aparece como tooltip ao passar o mouse
const IconAction = ({ icon: Icon, label, onClick, variant = 'line', disabled, loading }: { icon: any; label: string; onClick?: (e: any) => void; variant?: 'ink' | 'soft' | 'line' | 'done'; disabled?: boolean; loading?: boolean }) => {
  const styles = {
    ink: 'bg-brand-ink text-white hover:opacity-90',
    soft: 'bg-brand-soft text-brand hover:brightness-95',
    line: 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800',
    done: 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/50 text-green-600 dark:text-green-400',
  }[variant];
  return (
    <span className="relative group/tip inline-flex shrink-0">
      <button type="button" aria-label={label} onClick={onClick} disabled={disabled || loading} className={`w-9 h-9 rounded-[10px] inline-flex items-center justify-center transition-all disabled:opacity-50 ${styles}`}>
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Icon size={17} />}
      </button>
      <span className="pointer-events-none absolute bottom-[calc(100%+8px)] right-0 z-50 whitespace-nowrap rounded-lg bg-brand-ink px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover/tip:opacity-100">{label}</span>
    </span>
  );
};

export function AdminDashboard({ materials: initialMaterials, initialClientes = [] }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [theme, setTheme] = useState<'dark' | 'light'>('light')
  const [useIframeFallback, setUseIframeFallback] = useState<Record<string, boolean>>({})
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isSidebarCollapsedRaw, setIsSidebarCollapsedRaw] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const isSidebarCollapsed = isSidebarCollapsedRaw && !isMobile;

  useEffect(() => {
    const storedSidebar = localStorage.getItem('adminSidebarCollapsed');
    if (storedSidebar === 'true') {
      setIsSidebarCollapsedRaw(true);
    }
  }, []);

  const toggleSidebar = () => {
    const newVal = !isSidebarCollapsedRaw;
    setIsSidebarCollapsedRaw(newVal);
    localStorage.setItem('adminSidebarCollapsed', newVal.toString());
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null))
  }, [])

  useEffect(() => {
    const storedTheme = localStorage.getItem('adminTheme') as 'dark' | 'light' | null;
    if (storedTheme) {
      setTheme(storedTheme);
    }
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('adminTheme', newTheme);
  };

  // Cores do tema: salvas no banco (tabela configuracoes) e aplicadas pelo layout raiz em todas as páginas, login incluído
  const [brandColors, setBrandColors] = useState<BrandColors>(DEFAULT_BRAND);
  const [temaSalvo, setTemaSalvo] = useState<BrandColors>(DEFAULT_BRAND);
  const [salvandoTema, setSalvandoTema] = useState(false);
  useEffect(() => {
    lerTemaEquipe().then(c => { setBrandColors(c); setTemaSalvo(c); }).catch(() => null);
    try { localStorage.removeItem(THEME_STORAGE_KEY); } catch { /* sobra da versão antiga, que salvava no navegador */ }
  }, []);
  const previewBrandColors = (c: BrandColors) => { setBrandColors(c); applyBrandColors(c); };
  const saveBrandColors = async () => {
    setSalvandoTema(true);
    try {
      const c = await salvarTema(brandColors);
      setTemaSalvo(c);
      toast.success('Cores do tema salvas para todo o sistema.');
    } catch (e: any) {
      toast.error(e?.message === 'Não autorizado' ? 'Só administradores podem mudar as cores do tema.' : 'Não foi possível salvar as cores. Tente de novo.');
    } finally {
      setSalvandoTema(false);
    }
  };

  const getCleanText = (text: string | null | undefined) => {
    if (!text) return "";
    return text.replace(/\[ID:[^\]]+\]\s*/g, '');
  };

  const getAuthorInfo = (text: string | null | undefined) => {
    if (!text) return null;
    const match = text.match(/\[ID:([^\]]+)\]/);
    if (!match) return null;
    const authorId = match[1];
    const member = membros.find(m => m.id === authorId);
    if (!member) return null;
    return {
      nome: member.nome,
      role: member.role === 'designer' ? 'Designer' : member.role === 'planner' ? 'Decupador' : 'Editor'
    };
  };

  const renderTextWithLinks = (text: string) => {
    if (!text) return null;
    let cleanText = getCleanText(text);
    
    // Format pseudo tags for Admin view
    cleanText = cleanText.replace(/\[EDITOR\]/g, '🎬 **[PARA O EDITOR]**');
    cleanText = cleanText.replace(/\[\/EDITOR\]/g, '');
    cleanText = cleanText.replace(/\[DESIGNER\]/g, '🎨 **[PARA O DESIGNER]**');
    cleanText = cleanText.replace(/\[\/DESIGNER\]/g, '');

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = cleanText.split(urlRegex);
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-normal">
            {part}
          </a>
        );
      }
      
      // Basic markdown bold support for the headers we just added
      const boldParts = part.split(/(\*\*.*?\*\*)/g);
      if (boldParts.length > 1) {
        return (
          <span key={i}>
            {boldParts.map((bp, j) => {
              if (bp.startsWith('**') && bp.endsWith('**')) {
                return <strong key={j}>{bp.replace(/\*\*/g, '')}</strong>;
              }
              return bp;
            })}
          </span>
        );
      }
      
      return part;
    });
  };

  const tc = {
    bgApp: theme === 'dark' ? 'bg-zinc-950' : 'bg-zinc-50',
    bgCard: theme === 'dark' ? 'bg-zinc-900' : 'bg-white',
    border: theme === 'dark' ? 'border-zinc-800' : 'border-zinc-100',
    borderStrong: theme === 'dark' ? 'border-zinc-700' : 'border-zinc-200',
    textMain: theme === 'dark' ? 'text-zinc-100' : 'text-zinc-800',
    textMuted: theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500',
    bgInput: theme === 'dark' ? 'bg-zinc-950' : 'bg-zinc-50',
    bgHover: theme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-zinc-50',
    bgHighlight: theme === 'dark' ? 'bg-zinc-800/50' : 'bg-zinc-50/50',
  };

  const bgPrincipal = tc.bgApp;
  const bgSecundario = tc.bgCard;
  const borderSecundario = tc.borderStrong;
  const textPrincipal = tc.textMain;
  const textSecundario = tc.textMuted;
  const hoverSecundario = tc.bgHover;

  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [isClienteModalOpen, setIsClienteModalOpen] = useState(false);
  const [clienteBusca, setClienteBusca] = useState('');
  const [editingMembro, setEditingMembro] = useState<MembroComNome | null>(null);
  const [isMembroModalOpen, setIsMembroModalOpen] = useState(false);
  const [membroBusca, setMembroBusca] = useState('');
  const [activeTab, setActiveTabState] = useState<'geral' | 'planejamento' | 'cadastro-clientes' | 'equipe' | 'solicitacao-ajustes' | 'materiais-aprovacao' | 'materiais-aprovados' | 'relatorios' | 'cores-tema'>('geral')
  // Subpáginas de Planejamento e Relatórios (cada etapa/bloco abre na sua própria página)
  const [planSub, setPlanSubState] = useState<PlanSub>('analise')
  const [relSub, setRelSubState] = useState<RelSub>('resumo')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      const sub = params.get('sub');
      if (tab) setActiveTabState(tab as any);
      if (sub && tab === 'planejamento' && PLAN_SUBS.some(s => s.id === sub)) setPlanSubState(sub as PlanSub);
      if (sub && tab === 'relatorios' && REL_SUBS.some(s => s.id === sub)) setRelSubState(sub as RelSub);
    }
  }, []);

  const setActiveTab = (tab: any, sub?: string) => {
    startTransition(() => {
      setActiveTabState(tab);
      if (sub && tab === 'planejamento') setPlanSubState(sub as PlanSub);
      if (sub && tab === 'relatorios') setRelSubState(sub as RelSub);
    });
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('tab', tab);
      if (sub) params.set('sub', sub); else params.delete('sub');
      window.history.replaceState(null, '', `?${params.toString()}`);
    }
  };
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [isCreatingUser, setIsCreatingUser] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [expandedClients, setExpandedClients] = useState<string[]>([])
  // Grupos de cliente começam fechados; aqui ficam os que o usuário abriu
  const [openGroups, setOpenGroups] = useState<string[]>([])
  // Busca geral do topo (tarefas e clientes de todas as etapas) e menus suspensos
  const [globalSearch, setGlobalSearch] = useState('')
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState<string | null>(null)
  const [topMenuOpen, setTopMenuOpen] = useState<'planejamento' | 'config' | null>(null)
  const [expandedCiclos, setExpandedCiclos] = useState<string[]>([])
  const [expandedFeedbacks, setExpandedFeedbacks] = useState<string[]>([]);
  const toggleFeedback = (id: string) => setExpandedFeedbacks(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const [isDelegateModalOpen, setIsDelegateModalOpen] = useState(false)
  const [delegationType, setDelegationType] = useState<'editor' | 'planner'>('editor')
  const [adminFeedbackPlanner, setAdminFeedbackPlanner] = useState('')
  const [adminFeedbackEditor, setAdminFeedbackEditor] = useState('')
  const [adminFeedbackDesigner, setAdminFeedbackDesigner] = useState('')
  const [delegationDeadline, setDelegationDeadline] = useState('') // Para Planner
  const [delegationDeadlineEditor, setDelegationDeadlineEditor] = useState('')
  const [delegationDeadlineDesigner, setDelegationDeadlineDesigner] = useState('')
  const [selectedPlannerId, setSelectedPlannerId] = useState('')
  const [selectedEditorId, setSelectedEditorId] = useState('')
  const [selectedDesignerId, setSelectedDesignerId] = useState('')
  const [selectedCicloDelegation, setSelectedCicloDelegation] = useState<{ clienteId: string, ciclo: string, itens: Material[], clienteNome: string } | null>(null)
  const [selectedItemsToDelegate, setSelectedItemsToDelegate] = useState<string[]>([])
  const [formM, setFormM] = useState({ cliente_id: '', titulo: '', link_drive: '', ciclo: '1' })
  const [searchTerm, setSearchTerm] = useState('')
  const [activeFilter, setActiveFilter] = useState('todos') // todos, urgentes, ajustes, pendentes
  // Filtro por etapa no Início (vem do clique nos números do topo/fluxo quando a etapa não tem página própria)
  const [filtroEtapa, setFiltroEtapa] = useState<{ label: string; test: (m: Material) => boolean; clienteId?: string } | null>(null)
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    setHasMounted(true)
  }, [])

  const [tagDropdownOpen, setTagDropdownOpen] = useState<string | null>(null);
  // Posição do botão que abriu o seletor: o menu é desenhado por cima da tela (portal), então não é cortado pela lista
  const [tagAnchor, setTagAnchor] = useState<DOMRect | null>(null);
  const tagMenuRef = useRef<HTMLDivElement>(null);

  // Fecha o seletor ao rolar a página (fora do menu), redimensionar ou apertar Esc
  useEffect(() => {
    if (!tagDropdownOpen) return;
    const fechar = (e: Event) => {
      if (e.type === 'scroll' && tagMenuRef.current?.contains(e.target as Node)) return;
      setTagDropdownOpen(null);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setTagDropdownOpen(null); };
    window.addEventListener('scroll', fechar, true);
    window.addEventListener('resize', fechar);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('scroll', fechar, true);
      window.removeEventListener('resize', fechar);
      window.removeEventListener('keydown', esc);
    };
  }, [tagDropdownOpen]);

  // Marca/desmarca na hora (sem recarregar tudo) e desfaz se o banco recusar
  const toggleMaterialTag = async (material: Material, tag: string) => {
    const currentTags = materiais.find(x => x.id === material.id)?.tags ?? material.tags ?? [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag];
    setMateriais(prev => prev.map(x => x.id === material.id ? { ...x, tags: newTags } : x));
    const { error } = await supabase.from('materiais').update({ tags: newTags }).eq('id', material.id);
    if (error) {
      toast.error('Erro ao salvar tag');
      setMateriais(prev => prev.map(x => x.id === material.id ? { ...x, tags: currentTags } : x));
    }
  };

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; text: string; onConfirm: () => void; type: 'danger' | 'warning' }>({
    title: '', text: '', onConfirm: () => { }, type: 'warning'
  })

  const openConfirm = (title: string, text: string, onConfirm: () => void, type: 'danger' | 'warning' = 'warning') => {
    setConfirmConfig({ title, text, onConfirm, type })
    setIsConfirmModalOpen(true)
  }

  const [formE, setFormE] = useState({ nome: '', email: '', password: '', role: 'editor' as any, telegram_thread_id: '' })
  const [loteForm, setLoteForm] = useState({ cliente_id: '', ciclo: '1', link_bruto: '' })
  const [loteItens, setLoteItens] = useState([{ id: 1, titulo: '', roteiro: '' }])
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [plannerTaskId, setPlannerTaskId] = useState('')
  const [importClienteId, setImportClienteId] = useState('')
  const [importCiclo, setImportCiclo] = useState('1')
  const [createDriveFolders, setCreateDriveFolders] = useState(false)
  const [parentFolderUrl, setParentFolderUrl] = useState('')
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null)
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [batchApprovalData, setBatchApprovalData] = useState<{itens: Material[], cicloLabel: string} | null>(null);
  const [batchScheduleDate, setBatchScheduleDate] = useState<string>('');
  const [newDriveLink, setNewDriveLink] = useState('')
  const [isLinkBrutoModalOpen, setIsLinkBrutoModalOpen] = useState(false)
  const [newLinkBruto, setNewLinkBruto] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [zoomMode, setZoomMode] = useState<'fit' | 'fill'>('fit');
  const [aspectRatio, setAspectRatio] = useState<'9/16' | 'video' | 'square'>('9/16');

  useEffect(() => {
    if (previewUrl) {
      setZoomMode('fit');
      if (isGoogleDriveVideo(previewUrl)) {
        setAspectRatio('9/16');
      } else {
        setAspectRatio('9/16'); // Alterado de 'square' para '9/16' para capas/cards verticais!
      }
    }
  }, [previewUrl]);

  const [previewRoteiro, setPreviewRoteiro] = useState<Material | null>(null);
  const [isEditRoteiroModalOpen, setIsEditRoteiroModalOpen] = useState(false);
  const [roteiroToEdit, setRoteiroToEdit] = useState<Material | null>(null);
  const [newRoteiroText, setNewRoteiroText] = useState('');
  const [isEditTituloModalOpen, setIsEditTituloModalOpen] = useState(false);
  const [novoTituloText, setNovoTituloText] = useState('');
  const [materialBeingEdited, setMaterialBeingEdited] = useState<Material | null>(null);
  const [isResolveIssueModalOpen, setIsResolveIssueModalOpen] = useState(false);
  const [resolveText, setResolveText] = useState('');
  const [resolveLinkBruto, setResolveLinkBruto] = useState('');
  const [isDeleteClientModalOpen, setIsDeleteClientModalOpen] = useState(false)
  const [clientToDelete, setClientToDelete] = useState<Cliente | null>(null)
  const [isArchiveCycleModalOpen, setIsArchiveCycleModalOpen] = useState(false)
  const [cycleToArchive, setCycleToArchive] = useState<{ itens: Material[], cicloLabel: string } | null>(null)
  const [delegacaoModalAberto, setDelegacaoModalAberto] = useState(false);
  const [delegacaoLogsAtuais, setDelegacaoLogsAtuais] = useState<any[]>([]);
  const [nomeMaterialDelegacao, setNomeMaterialDelegacao] = useState('');
  const [materialLogContext, setMaterialLogContext] = useState<Material | null>(null);

  const registrarLogAdmin = async (materialId: string, evento: string) => {
    await supabase.from('logs_acesso').insert([{ material_id: materialId, evento }]);
  };

  const abrirHistoricoDelegacao = async (materialId: string, titulo: string) => {
    setNomeMaterialDelegacao(titulo);
    const m = materiais.find(m => m.id === materialId);

    const { data, error } = await supabase.from('logs_acesso')
      .select('*')
      .eq('material_id', materialId)
      .order('created_at', { ascending: false });
      
    if (!error && data) {
      let filtered = data.filter(log => !log.evento.startsWith('👀 Cliente visualizou'));
      
      if (m) {
        // Preenche delegações antigas que ocorreram antes da implementação dos logs
        const hasPlannerLog = filtered.some(f => f.evento.includes('Delegado para Decupador'));
        const hasEditorLog = filtered.some(f => f.evento.includes('Delegado para Editor'));
        const hasDesignerLog = filtered.some(f => f.evento.includes('Delegado para Designer'));

        if (m.planner_id && !hasPlannerLog) {
          const pName = membros.find(mem => mem.id === m.planner_id)?.nome || 'Decupador';
          filtered.push({ evento: `🔄 Delegado para Decupador: ${pName}`, created_at: m.created_at, material_id: m.id } as any);
        }
        if (m.editor_id && !hasEditorLog) {
          const eName = membros.find(mem => mem.id === m.editor_id)?.nome || 'Editor';
          filtered.push({ evento: `🔄 Delegado para Editor: ${eName}`, created_at: m.created_at, material_id: m.id } as any);
        }
        if (m.designer_id && !hasDesignerLog) {
          const dName = membros.find(mem => mem.id === m.designer_id)?.nome || 'Designer';
          filtered.push({ evento: `🔄 Delegado para Designer: ${dName}`, created_at: m.created_at, material_id: m.id } as any);
        }

        filtered.push({ evento: '✅ Tarefa Criada no Sistema', created_at: m.created_at, material_id: m.id } as any);
        
        // Remove duplicates and sort by date descending
        const uniqueEvents = new Set();
        filtered = filtered.filter(f => {
           if (uniqueEvents.has(f.evento)) return false;
           uniqueEvents.add(f.evento);
           return true;
        });
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
      
      setDelegacaoLogsAtuais(filtered);
      setDelegacaoModalAberto(true);
    }
  };

  const [logsModalAberto, setLogsModalAberto] = useState(false);
  const [logsAtuais, setLogsAtuais] = useState<any[]>([]);
  const [nomeMaterialLog, setNomeMaterialLog] = useState('');
  const [incompleteApprovalData, setIncompleteApprovalData] = useState<{ material: Material, missingVideo: boolean | null | undefined, missingDesign: boolean | null | undefined } | null>(null);
  const [isApproveConfirmModalOpen, setIsApproveConfirmModalOpen] = useState(false);
  const [materialToApproveFinal, setMaterialToApproveFinal] = useState<Material | null>(null);

  const [currentSlide, setCurrentSlide] = useState(0);
  const [expandedCapaLinks, setExpandedCapaLinks] = useState<string[]>([]);
  const [isExpandingFolder, setIsExpandingFolder] = useState(false);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, skipSnaps: false });

  // Sincronizar slide atual com o Embla
  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setCurrentSlide(emblaApi.selectedScrollSnap());
    emblaApi.on('select', onSelect);
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi]);

  // LÓGICA DE EXPANSÃO DE PASTA: Transforma link de pasta em lista de arquivos
  useEffect(() => {
    const expandFolder = async () => {
      if (!previewUrl) {
        setExpandedCapaLinks([]);
        return;
      }

      const folderMatch = /\/folders\/([a-zA-Z0-9_-]+)/.exec(previewUrl);

      if (folderMatch?.[1]) {
        setIsExpandingFolder(true);
        try {
          const files = await getDriveFolderFiles(folderMatch[1]);
          if (files && files.length > 0) {
            setExpandedCapaLinks(files);
          } else {
            setExpandedCapaLinks([previewUrl]);
          }
        } catch (error) {
          setExpandedCapaLinks([previewUrl]);
        } finally {
          setIsExpandingFolder(false);
        }
      } else {
        const links = previewUrl.split(/[\n,;]+/).map((l: string) => l.trim()).filter(Boolean);
        setExpandedCapaLinks(links);
      }
      setCurrentSlide(0);
    };

    expandFolder();
  }, [previewUrl]);

  const [isGruposModalOpen, setIsGruposModalOpen] = useState(false);
  const [listagemGrupos, setListagemGrupos] = useState<any[]>([]);
  const [carregandoGrupos, setCarregandoGrupos] = useState(false);
  const [buscaGrupo, setBuscaGrupo] = useState('');
  const [wppGroupId, setWppGroupId] = useState('');
  const [isEditInstructionModalOpen, setIsEditInstructionModalOpen] = useState(false);
  const [materialToEditInstruction, setMaterialToEditInstruction] = useState<Material | null>(null);
  const [instructionEditorText, setInstructionEditorText] = useState('');
  const [instructionDesignerText, setInstructionDesignerText] = useState('');
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [materialToSchedule, setMaterialToSchedule] = useState<Material | null>(null);

  const [systemTags, setSystemTags] = useState<{id: string, label: string, color: string}[]>([]);
  const [timelineMaterial, setTimelineMaterial] = useState<Material | null>(null);
  const [newTagLabel, setNewTagLabel] = useState('');
  const [newTagColor, setNewTagColor] = useState('red');

  const TAG_COLORS = {
    red: { bg: 'bg-red-500/20', text: 'text-red-700 dark:text-red-400', border: 'border-red-500/30' },
    blue: { bg: 'bg-blue-500/20', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-500/30' },
    green: { bg: 'bg-green-500/20', text: 'text-green-700 dark:text-green-400', border: 'border-green-500/30' },
    yellow: { bg: 'bg-yellow-500/20', text: 'text-yellow-700 dark:text-yellow-400', border: 'border-yellow-500/30' },
    purple: { bg: 'bg-purple-500/20', text: 'text-purple-700 dark:text-purple-400', border: 'border-purple-500/30' },
    pink: { bg: 'bg-pink-500/20', text: 'text-pink-700 dark:text-pink-400', border: 'border-pink-500/30' },
    orange: { bg: 'bg-orange-500/20', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-500/30' },
    gray: { bg: 'bg-gray-500/20', text: 'text-gray-700 dark:text-gray-400', border: 'border-gray-500/30' }
  };
  const TAG_PALETTE = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#71717a'];
  const tagHex = (tagLabel: string) => {
     const colorValue = systemTags.find(t => t.label === tagLabel)?.color || '#eab308';
     const hexMap: Record<string, string> = {
       red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308',
       purple: '#a855f7', pink: '#ec4899', orange: '#f97316', gray: '#6b7280'
     };
     return hexMap[colorValue] || colorValue;
  };
  // Fundo bem suave e texto escurecido (ou clareado no tema escuro) para ficar legível em qualquer cor
  const chipStyle = (hex: string) => ({
    backgroundColor: hex + (theme === 'dark' ? '2E' : '1F'),
    color: `color-mix(in srgb, ${hex} ${theme === 'dark' ? '70%, #fff' : '60%, #000'})`,
  });
  const getTagStyle = (tagLabel: string) => chipStyle(tagHex(tagLabel));
  const AVAILABLE_TAGS = systemTags.map(t => t.label);

  useEffect(() => {
    const fetchTags = async () => {
      const { data } = await supabase.from('tags').select('*').order('created_at', { ascending: true });
      if (data) setSystemTags(data);
    };
    fetchTags();
  }, []);


  const {
    clientes, setClientes,
    materiais, setMateriais,
    membros, setMembros,
    isDataLoading,
    loadData,
    metrics,
    pipeline,
    gargalo,
    filaAnaliseRoteiro,
    filaRoteirosAprovados,
    filaEmDecupagem,
    filaProblemasDecupagem,
    filaProducaoPronta,
    filaMateriaisAprovacao,
    notificacoesAjustes,
    filaMateriaisAprovados,
    editores,
    designers,
    planners
  } = useAdminData(initialMaterials, initialClientes);

  // ---------- Conversa do portal (cliente <-> equipe) ----------
  const [conversaAdmin, setConversaAdmin] = useState<MensagemConversa[]>([]);
  const [carregandoConversaAdmin, setCarregandoConversaAdmin] = useState(false);
  const [avisarWppConversa, setAvisarWppConversa] = useState(true);
  const [msgsNaoLidas, setMsgsNaoLidas] = useState<Record<string, number>>({});
  // Conversa aberta: pelo botão "Conversa com o cliente" (timelineMaterial) ou no painel da tarefa
  const conversaAbertaId = timelineMaterial?.id || (isEditRoteiroModalOpen ? roteiroToEdit?.id || null : null);

  const carregarConversaAdmin = useCallback(async (id: string, silencioso = false) => {
    if (!silencioso) setCarregandoConversaAdmin(true);
    try {
      setConversaAdmin(await conversaEquipe(id));
      setMsgsNaoLidas(prev => prev[id] ? { ...prev, [id]: 0 } : prev);
    } catch {
      if (!silencioso) setConversaAdmin([]);
    } finally {
      if (!silencioso) setCarregandoConversaAdmin(false);
    }
  }, []);
  useEffect(() => {
    if (!conversaAbertaId) { setConversaAdmin([]); return; }
    carregarConversaAdmin(conversaAbertaId);
    const t = setInterval(() => carregarConversaAdmin(conversaAbertaId, true), 20000);
    return () => clearInterval(t);
  }, [conversaAbertaId, carregarConversaAdmin]);

  // Mensagens de clientes ainda não lidas pela equipe (ponto "Nova mensagem" nas tarefas)
  useEffect(() => {
    const atualizar = () => naoLidasEquipe().then(setMsgsNaoLidas).catch(() => null);
    atualizar();
    const t = setInterval(atualizar, 60000);
    return () => clearInterval(t);
  }, []);

  const enviarConversaAdmin = async (m: Material, envio: EnvioConversa) => {
    try {
      const anexos = await enviarAnexos((tipo, ext) => prepararAnexoEquipe(m.id, tipo, ext), envio.fotos, envio.audio);
      await enviarMensagemEquipe(m.id, { texto: envio.texto, fotos: anexos.fotos, audio: anexos.audio });
      await carregarConversaAdmin(m.id, true);
      toast.success('Resposta enviada ao cliente.');
      // Avisa o cliente no WhatsApp que há resposta no portal
      if (avisarWppConversa && m.cliente?.token_magico && (m.cliente?.whatsapp_group_id || m.cliente?.telefone)) {
        const link = getSafePortalUrl(window.location.origin, m.cliente.token_magico, (m.link_drive || m.link_capa) ? 'videos' : 'roteiros');
        const chatId = m.cliente.whatsapp_group_id || m.cliente.telefone.replace(/\D/g, '');
        notificarWhatsApp(`Olá! A equipe respondeu sobre "${m.titulo}" no seu portal. 💬\n\nVeja aqui:\n${link}`, chatId);
      }
      return true;
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível enviar a resposta.');
      return false;
    }
  };

  const renderDeadline = (date: string | null) => {
    if (!date || !hasMounted) return null;
    const now = new Date();
    const d = new Date(date);
    const diff = d.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    if (days < 0) return <span className="text-[10px] font-semibold text-red-500 flex items-center gap-1 "><Flame size={8} /> Atrasado há {Math.abs(days)}d</span>;
    if (days === 0) return <span className="text-[10px] font-semibold text-orange-500 flex items-center gap-1"><Clock size={8} /> Entrega Hoje</span>;
    if (days <= 2) return <span className="text-[10px] font-semibold text-amber-500 flex items-center gap-1"><Clock size={8} /> Entrega em {days}d</span>;
    return <span className="text-[10px] font-semibold text-zinc-400 flex items-center gap-1"><Calendar size={8} /> {days}d restantes</span>;
  };

  // Filtros por prazo do Início (Todos, Para hoje, Atrasadas, Futuras). "Concluídas" usa showArchived.
  const applyFilters = useCallback((list: Material[], usarFiltroPrazo = false) => {
    const hoje = new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD no fuso local
    return list.filter(m => {
      const matchSearch = !searchTerm ||
        m.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.cliente?.nome?.toLowerCase().includes(searchTerm.toLowerCase());

      let matchFilter = true;
      if (usarFiltroPrazo) {
        const prazo = m.data_limite ? m.data_limite.slice(0, 10) : null;
        if (activeFilter === 'hoje') matchFilter = prazo === hoje;
        else if (activeFilter === 'atrasadas') matchFilter = !!m.data_limite && isDateLate(m.data_limite);
        else if (activeFilter === 'futuras') matchFilter = !!prazo && prazo > hoje;
      }

      return matchSearch && matchFilter;
    });
  }, [searchTerm, activeFilter]);

  const groupItems = useCallback((list: Material[], usarFiltroPrazo = false) => {
    const groups: Record<string, any> = {}
    applyFilters(list, usarFiltroPrazo).forEach(m => {
      if (!m.cliente_id) return;
      if (!groups[m.cliente_id]) groups[m.cliente_id] = { cliente: m.cliente || { nome: 'S/N' }, ciclos: {} }
      const cicloLabel = `CICLO ${m.ciclo || 1}`
      if (!groups[m.cliente_id].ciclos[cicloLabel]) groups[m.cliente_id].ciclos[cicloLabel] = { itens: [], aprovados: 0, total: 0 }
      groups[m.cliente_id].ciclos[cicloLabel].itens.push(m)
      groups[m.cliente_id].ciclos[cicloLabel].total++
      if (m.status === 'aprovado' || m.status === 'roteiro_aprovado' || m.status === 'post_aprovado') groups[m.cliente_id].ciclos[cicloLabel].aprovados++
    })

    Object.keys(groups).forEach(clientId => {
      Object.keys(groups[clientId].ciclos).forEach(ciclo => {
        groups[clientId].ciclos[ciclo].itens.sort((a: any, b: any) => {
          const orderA = a.ordem ?? 999999;
          const orderB = b.ordem ?? 999999;
          if (orderA === orderB) {
            return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
          }
          return orderA - orderB;
        });
      });
    });

    return groups

  }, [applyFilters])

  const groupedVisaoGeral = useMemo(() => {
    const filtered = materiais
      .filter(m => showArchived ? m.status === 'concluido' : m.status !== 'concluido')
      .filter(m => showArchived || !filtroEtapa || ((!filtroEtapa.clienteId || m.cliente_id === filtroEtapa.clienteId) && filtroEtapa.test(m)))
    return groupItems(filtered, !showArchived)
  }, [materiais, showArchived, groupItems, filtroEtapa])

  const groupedAnaliseRoteiro = useMemo(() => groupItems(filaAnaliseRoteiro), [filaAnaliseRoteiro, groupItems]);
  const groupedProblemasDecupagem = useMemo(() => groupItems(filaProblemasDecupagem), [filaProblemasDecupagem, groupItems]);
  const groupedRoteiros = useMemo(() => groupItems(filaRoteirosAprovados), [filaRoteirosAprovados, groupItems]);
  const groupedEmDecupagem = useMemo(() => groupItems(filaEmDecupagem), [filaEmDecupagem, groupItems]);
  const groupedProducao = useMemo(() => groupItems(filaProducaoPronta), [filaProducaoPronta, groupItems]);
  const groupedMateriaisAprovacao = useMemo(() => groupItems(filaMateriaisAprovacao), [filaMateriaisAprovacao, groupItems]);
  const groupedAjustes = useMemo(() => groupItems(notificacoesAjustes), [notificacoesAjustes, groupItems]);
  const groupedMateriaisAprovados = useMemo(() => groupItems(filaMateriaisAprovados), [filaMateriaisAprovados, groupItems]);

  const relatorioData = useMemo(() => {
    // 2. Performance por Membro (Ajustes e Atrasos)
    const performance: Record<string, { nome: string, role: string, total: number, entregas: number, ajustes: number, ajustesHistoricos: number, atrasos: number }> = {};
    membros.forEach(m => performance[m.id] = { nome: m.nome || m.email, role: m.role, total: 0, entregas: 0, ajustes: 0, ajustesHistoricos: 0, atrasos: 0 });

    // 3. Métricas por Cliente (Ajustes)
    const clienteStats: Record<string, { nome: string, total: number, aprovados: number, ajustes: number }> = {};

    const hoje = new Date();

    materiais.forEach(m => {
      // Stats de Cliente
      if (m.cliente_id) {
        if (!clienteStats[m.cliente_id]) clienteStats[m.cliente_id] = { nome: m.cliente?.nome || 'S/N', total: 0, aprovados: 0, ajustes: 0 };
        clienteStats[m.cliente_id].total++;
        if (['aprovado', 'post_aprovado'].includes(m.status)) clienteStats[m.cliente_id].aprovados++;
        if (m.status === 'ajustes') clienteStats[m.cliente_id].ajustes++;
      }

      const isAtrasado = m.data_limite && isDateLate(m.data_limite) && !['aprovado', 'post_aprovado', 'concluido'].includes(m.status);

      if (m.editor_id && performance[m.editor_id]) {
        performance[m.editor_id].total++;
        if (m.video_entregue) performance[m.editor_id].entregas++;
        if (m.status === 'ajustes') performance[m.editor_id].ajustes++;
        if (isAtrasado) performance[m.editor_id].atrasos++;
        // Histórico de ajustes baseados no feedback acumulado
        const count = m.feedback ? m.feedback.split('\n\n').length : 0;
        performance[m.editor_id].ajustesHistoricos += count;
      }
      if (m.designer_id && performance[m.designer_id]) {
        performance[m.designer_id].total++;
        if (m.design_entregue) performance[m.designer_id].entregas++;
        if (m.status === 'ajustes') performance[m.designer_id].ajustes++;
        if (isAtrasado) performance[m.designer_id].atrasos++;
        // Histórico de ajustes baseados no feedback acumulado
        const count = m.feedback ? m.feedback.split('\n\n').length : 0;
        performance[m.designer_id].ajustesHistoricos += count;
      }
      if (m.planner_id && performance[m.planner_id]) {
        performance[m.planner_id].total++;
        if (!['planejamento', 'em_organizacao'].includes(m.status)) performance[m.planner_id].entregas++;
        if (isAtrasado) performance[m.planner_id].atrasos++;
      }
    });

    // Calcula Workload (Membros Atuais)
    const workloadMap: Record<string, { nome: string, role: string, tarefas: { id: string, cliente: string, ciclo: number, titulo: string, status: string }[] }> = {};
    membros.forEach(m => workloadMap[m.id] = { nome: m.nome || m.email, role: m.role, tarefas: [] });

    materiais.forEach(m => {
      if (['aprovado', 'post_aprovado', 'concluido', 'analise_roteiro', 'roteiro_pendente', 'roteiro_aprovado'].includes(m.status)) return;
      const tInfo = { id: m.id, cliente: m.cliente?.nome || 'S/N', ciclo: Number(m.ciclo) || 1, titulo: m.titulo, status: m.status };
      if (m.editor_id && workloadMap[m.editor_id]) workloadMap[m.editor_id].tarefas.push(tInfo);
      if (m.designer_id && workloadMap[m.designer_id] && m.designer_id !== m.editor_id) workloadMap[m.designer_id].tarefas.push(tInfo);
      if (m.planner_id && workloadMap[m.planner_id] && m.planner_id !== m.editor_id && m.planner_id !== m.designer_id) workloadMap[m.planner_id].tarefas.push(tInfo);
    });
    const activeWorkload = Object.values(workloadMap).filter(w => w.tarefas.length > 0).sort((a, b) => b.tarefas.length - a.tarefas.length);

    const topAjustesClientes = Object.values(clienteStats).sort((a, b) => b.ajustes - a.ajustes).slice(0, 5);
    const topPerformance = Object.values(performance).sort((a, b) => b.entregas - a.entregas);
    const topAjustesEquipe = Object.values(performance).filter(p => p.role !== 'admin' && p.ajustesHistoricos > 0).sort((a, b) => b.ajustesHistoricos - a.ajustesHistoricos);
    const totalAtrasos = Object.values(performance).reduce((acc, p) => acc + p.atrasos, 0);

    return {
      performance: topPerformance,
      topClientes: Object.values(clienteStats).sort((a, b) => b.total - a.total).slice(0, 5),
      topAjustesClientes,
      topAjustesEquipe,
      totalAtrasos,
      workload: activeWorkload
    };
  }, [materiais, membros, groupItems]);

  const abrirLogsDoMaterial = async (materialId: string, titulo: string) => {
    setNomeMaterialLog(titulo);
    const { data, error } = await supabase.from('logs_acesso').select('*').eq('material_id', materialId).order('created_at', { ascending: false });
    if (!error && data) { setLogsAtuais(data); setLogsModalAberto(true); }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setActionLoading(id);
    const material = materiais.find(m => m.id === id);

    let updatePayload: any = { status: newStatus };

    // Limpeza de responsáveis ao retroceder fluxos para evitar registros "travados"
    if (['analise_roteiro', 'roteiro_pendente', 'roteiro_aprovado', 'aprovado'].includes(newStatus)) {
      updatePayload.planner_id = null;
      updatePayload.editor_id = null;
      updatePayload.designer_id = null;
      // Ao voltar para o roteiro, mantemos o link bruto pois as pastas físicas já foram criadas
      if (newStatus === 'roteiro_aprovado' || newStatus === 'aprovado') {
        updatePayload.link_drive = null;
        updatePayload.link_capa = null;
      }
    } else if (newStatus === 'planejamento' || newStatus === 'em_organizacao') {
      updatePayload.editor_id = null;
      updatePayload.designer_id = null;
    }

    await supabase.from('materiais').update(updatePayload).eq('id', id);

    const statusNames: Record<string, string> = {
      'analise_roteiro': 'Roteiro em Análise',
      'roteiro_pendente': 'Aguardando Cliente (Roteiro)',
      'roteiro_aprovado': 'Roteiro Aprovado',
      'planejamento': 'Aguardando Decupagem',
      'em_organizacao': 'Decupagem em Andamento',
      'faltando_material': 'Falta Material Bruto',
      'verificar_material': 'Verificar Material',
      'organizado': 'Pasta Pronta',
      'em_edicao': 'Em Edição / Design',
      'pendente': 'Aguardando Aprovação Cliente',
      'ajustes': 'Ajustes Solicitados',
      'revisao': 'Revisão Agência',
      'post_aprovado': 'Post Aprovado',
      'concluido': 'Arquivado / Finalizado'
    };
    registrarLogAdmin(id, `🔄 Status alterado para: ${statusNames[newStatus] || newStatus}`);

    if (material) {
      if (newStatus === 'faltando_material' || newStatus === 'verificar_material') {
        const p = membros.find(m => m.id === material.planner_id);
        await notificarClickUpChat(`🔔 PROBLEMA NA PRODUÇÃO\n\n**${material.cliente?.nome}**\n${material.titulo}\n🔔 VERIFICAR PASTA OU ARQUIVOS`, (p as any)?.telegram_thread_id);
      }
      else if (newStatus === 'revisao') {
        await notificarClickUpChat(`🎬 EDIÇÃO PRONTA\n\n**${material.cliente?.nome}**\n${material.titulo}\n🔔 AGUARDANDO REVISÃO AGÊNCIA`);
      }
      else if (newStatus === 'organizado') {
        await notificarClickUpChat(`📁 PASTA PRONTA (DECUPAGEM)\n\n**${material.cliente?.nome}**\n${material.titulo}`);
      }
      else if (['aprovado', 'roteiro_aprovado', 'post_aprovado'].includes(newStatus)) {
        const label = newStatus === 'roteiro_aprovado' ? 'ROTEIRO APROVADO' : 'POST APROVADO';
        const icon = newStatus === 'roteiro_aprovado' ? '📝✅' : '✅';
        await notificarClickUpChat(`${icon} ${label}\n\n**${material.cliente?.nome}**\n${material.titulo}`);
      }
    }

    loadData();
    setActionLoading(null);
  }

  const [resolveType, setResolveType] = useState<'planner' | 'editor'>('planner');
  const [notifyTarget, setNotifyTarget] = useState<'both' | 'editor' | 'designer'>('both');

  const openResolveModal = (m: Material, defaultType?: 'planner' | 'editor') => {
    setSelectedMaterial(m);
    setResolveLinkBruto(m.link_bruto || '');
    setResolveText('');

    // Automação: tenta extrair o ID do autor do feedback para saber para quem devolver
    const match = m.feedback?.match(/\[ID:([^\]]+)\]/);
    if (match && match[1]) {
      const authorId = match[1];
      if (authorId === m.planner_id) {
        setResolveType('planner');
      } else if (authorId === m.editor_id) {
        setResolveType('editor');
        setNotifyTarget('editor');
      } else if (authorId === m.designer_id) {
        setResolveType('editor');
        setNotifyTarget('designer');
      } else {
        // Se não for nenhum dos IDs específicos, usa o default ou tenta inferir pelo role
        const autor = membros.find(x => x.id === authorId);
        if (autor?.role === 'planner') setResolveType('planner');
        else if (autor?.role === 'editor' || autor?.role === 'designer') {
          setResolveType('editor');
          setNotifyTarget(autor.role as any);
        }
      }
    } else if (defaultType) {
      setResolveType(defaultType);
    } else {
      // Fallback baseado no status atual
      if (m.status === 'faltando_material' || m.status === 'verificar_material') setResolveType('planner');
    }

    setIsResolveIssueModalOpen(true);
  };

  const handleResolveIssue = async () => {
    if (!selectedMaterial || !resolveText) return toast.error("Escreva a instrução/resolução!");
    setLoading(true);

    const newStatus = resolveType === 'planner' ? 'planejamento' : 'em_edicao';

    const updatePayload: any = {
      status: newStatus,
      feedback_admin: currentUserId && resolveText ? `${resolveText}\n\n[ID:${currentUserId}]` : resolveText,
      link_bruto: resolveLinkBruto,
      feedback: null
    };

    if (resolveType === 'planner') {
      updatePayload.link_organizado = null;
    }

    if (resolveType === 'editor') {
      if (notifyTarget === 'editor' || notifyTarget === 'both') updatePayload.video_entregue = false;
      if (notifyTarget === 'designer' || notifyTarget === 'both') updatePayload.design_entregue = false;
    }

    const { error } = await supabase.from('materiais').update(updatePayload).eq('id', selectedMaterial.id);

    if (!error) {
      toast.success(resolveType === 'planner' ? "Devolvido ao Decupador!" : "Reenviado à Produção!");

      const msgResolvido = `🔔 PROBLEMA RESOLVIDO\n\n**${selectedMaterial.cliente?.nome}**\n${selectedMaterial.titulo}\n\n📝 INSTRUÇÃO: ${resolveText}`;

      if (resolveType === 'planner') {
        const p = membros.find(x => x.id === selectedMaterial.planner_id);
        await notificarClickUpChat(msgResolvido, (p as any)?.telegram_thread_id);
      } else {
        // Notifica apenas quem foi selecionado
        if ((notifyTarget === 'editor' || notifyTarget === 'both') && selectedMaterial.editor_id) {
          const e = membros.find(x => x.id === selectedMaterial.editor_id);
          await notificarClickUpChat(msgResolvido, (e as any)?.telegram_thread_id);
        }
        if ((notifyTarget === 'designer' || notifyTarget === 'both') && selectedMaterial.designer_id && selectedMaterial.designer_id !== selectedMaterial.editor_id) {
          const d = membros.find(x => x.id === selectedMaterial.designer_id);
          await notificarClickUpChat(msgResolvido, (d as any)?.telegram_thread_id);
        }
      }

      setIsResolveIssueModalOpen(false);
      setResolveText('');
      loadData();
    }
    else { toast.error("Erro ao processar resolução."); } setLoading(false);
  }

  const handleEditTitulo = (m: Material) => {
    setMaterialBeingEdited(m);
    setNovoTituloText(m.titulo);
    setIsEditTituloModalOpen(true);
  };

  const handleSaveTitulo = async () => {
    if (!materialBeingEdited || novoTituloText.trim() === '' || novoTituloText === materialBeingEdited.titulo) {
      setIsEditTituloModalOpen(false);
      return;
    }
    setLoading(true);
    setMateriais(prev => prev.map(item => item.id === materialBeingEdited.id ? { ...item, titulo: novoTituloText } : item));
    try {
      const { error } = await supabase.from('materiais').update({ titulo: novoTituloText }).eq('id', materialBeingEdited.id);
      if (error) throw error;
      toast.success("Título atualizado!");
    } catch (err: any) {
      toast.error("Erro ao atualizar título.");
      loadData();
    }
    setLoading(false);
    setIsEditTituloModalOpen(false);
    setMaterialBeingEdited(null);
  };

  const handleSaveRoteiro = async () => {
    if (!roteiroToEdit) return; setLoading(true);
    let textToSave = newRoteiroText;
    textToSave = textToSave.replace(/<li data-list="checked">/gi, '<li class="task-list-item"><input type="checkbox" checked disabled> ');
    textToSave = textToSave.replace(/<li data-list="unchecked">/gi, '<li class="task-list-item"><input type="checkbox" disabled> ');
    const { error } = await supabase.from('materiais').update({ roteiro: textToSave, titulo: novoTituloText }).eq('id', roteiroToEdit.id);
    if (!error) { toast.success("Roteiro atualizado!"); setIsEditRoteiroModalOpen(false); loadData(); } else { toast.error("Erro."); } setLoading(false);
  }

  const handleUpdateLinkBruto = async () => {
    if (!selectedMaterial) return; setLoading(true);
    const { error } = await supabase.from('materiais').update({ link_bruto: newLinkBruto }).eq('id', selectedMaterial.id);
    if (!error) { toast.success("Link atualizado!"); setIsLinkBrutoModalOpen(false); loadData(); } else { toast.error("Erro."); } setLoading(false);
  }

  const handleEnviarRoteiroCliente = async (material: Material) => {
    setActionLoading(material.id);
    const { error } = await supabase.from('materiais').update({ status: 'roteiro_pendente' }).eq('id', material.id);
    if (!error) {
      toast.success("Enviado para aprovação do cliente!");
      if (material?.cliente?.telefone && material?.cliente?.token_magico) {
        const linkPortal = getSafePortalUrl(window.location.origin, material.cliente.token_magico, 'roteiros');
        const textoMensagem = `Olá! O roteiro do material "${material.titulo}" já está disponível para a sua análise e aprovação. 📝\n\nAcesse o seu portal aqui:\n${linkPortal}`;

        const groupId = material.cliente.whatsapp_group_id;
        if (groupId) {
          toast.info("Avisando cliente via grupo...");
          await notificarWhatsApp(textoMensagem, groupId);
        } else {
          toast.info("Avisando cliente via WhatsApp...");
          await notificarWhatsApp(textoMensagem, material.cliente.telefone.replace(/\D/g, ''));
        }
      }
      loadData();
    } else { toast.error("Erro."); }
    setActionLoading(null);
  }

  const handleReenviarRoteiroAjustado = async (material: Material) => {
    setActionLoading(material.id);
    const { error } = await supabase.from('materiais').update({ status: 'roteiro_pendente' }).eq('id', material.id);
    if (!error) {
      toast.success("Roteiro devolvido para o cliente!");
      if (material?.cliente?.telefone && material?.cliente?.token_magico) {
        const linkPortal = getSafePortalUrl(window.location.origin, material.cliente.token_magico, 'roteiros');
        const textoMensagem = `Olá! O roteiro do material "${material.titulo}" foi revisado e ajustado conforme as suas pontuações. 📝✨\n\nPor favor, acesse o portal para reanalisar:\n${linkPortal}`;

        const groupId = material.cliente.whatsapp_group_id;
        if (groupId) {
          toast.info("Avisando cliente via grupo...");
          await notificarWhatsApp(textoMensagem, groupId);
        } else {
          toast.info("Avisando cliente via WhatsApp...");
          await notificarWhatsApp(textoMensagem, material.cliente.telefone.replace(/\D/g, ''));
        }
      }
      loadData();
    } else { toast.error("Erro ao reenviar."); }
    setActionLoading(null);
  }

  const handleEnviarLoteRoteiroCliente = async (itens: Material[]) => {
    setLoading(true); const ids = itens.map(i => i.id);
    const { error } = await supabase.from('materiais').update({ status: 'roteiro_pendente' }).in('id', ids);
    if (!error) {
      toast.success(`${qtd(ids.length, 'roteiro', 'roteiros')} enviados para aprovação do cliente!`);
      const primeiroItem = itens[0];
      if (primeiroItem?.cliente?.telefone && primeiroItem?.cliente?.token_magico) {
        const linkPortal = getSafePortalUrl(window.location.origin, primeiroItem.cliente.token_magico, 'roteiros');
        const textoMensagem = `Olá! Novos roteiros foram disponibilizados para a sua análise e aprovação. 📝\n\nAcesse o seu portal aqui:\n${linkPortal}`;

        const groupId = primeiroItem.cliente.whatsapp_group_id;
        if (groupId) {
          toast.info("Avisando cliente via grupo...");
          await notificarWhatsApp(textoMensagem, groupId);
        } else {
          toast.info("Avisando cliente via WhatsApp...");
          await notificarWhatsApp(textoMensagem, primeiroItem.cliente.telefone.replace(/\D/g, ''));
        }
      }
      loadData();
    } else { toast.error("Erro ao enviar lote."); } setLoading(false);
  }

  const handleAprovarLoteParaCliente = async (itens: Material[], dateString?: string) => {
    setLoading(true); const ids = itens.map(i => i.id);
    const { error } = await supabase.from('materiais').update({ 
      status: 'pendente', 
      editor_id: null, 
      designer_id: null,
      agendado_para: dateString ? dateString : null,
      wpp_enviado: dateString ? false : true
    }).in('id', ids);
    if (!error) {
      if (dateString) {
        toast.success(`${qtd(ids.length, 'material', 'materiais')} agendados para aprovação!`);
      } else {
        toast.success(`${qtd(ids.length, 'material', 'materiais')} aprovados para o cliente!`);
        const primeiroItem = itens[0];
        if (primeiroItem?.cliente?.telefone && primeiroItem?.cliente?.token_magico) {
          const linkPortal = getSafePortalUrl(window.location.origin, primeiroItem.cliente.token_magico, 'roteiros');
          const textoMensagem = `Olá! Novas edições/designs foram concluídos e estão disponíveis para a sua avaliação. 🎉\n\nAcesse o seu portal aqui:\n${linkPortal}`;
  
          const groupId = primeiroItem.cliente.whatsapp_group_id;
          if (groupId) {
            toast.info("Enviando aviso automático para o grupo...");
            notificarWhatsApp(textoMensagem, groupId);
          } else {
            toast.info("Enviando aviso automático via WhatsApp...");
            notificarWhatsApp(textoMensagem, primeiroItem.cliente.telefone.replace(/\D/g, ''));
          }
        }
      }
      loadData();
    } else { toast.error("Erro ao aprovar lote."); } setLoading(false);
  }

  const handleAvisarCicloWhatsApp = async (cliente?: Cliente, cicloLabel?: string) => {
    if (!cliente?.telefone || !cliente?.token_magico) return toast.error("Faltam dados de contacto deste cliente.");
    const linkPortal = getSafePortalUrl(window.location.origin, cliente.token_magico, 'videos');
    const textoMensagem = `Olá! Temos atualizações nos seus materiais do ${cicloLabel}. 🚀\n\nAcesse seu portal para verificar:\n${linkPortal}`;

    toast.info("Avisando cliente no WhatsApp...");
    const chatId = cliente.whatsapp_group_id ? cliente.whatsapp_group_id : cliente.telefone.replace(/\D/g, '');
    const res = await notificarWhatsApp(textoMensagem, chatId);

    if (res?.success) {
      toast.success("Mensagem entregue ao WhatsApp do cliente!");
    } else {
      toast.error(`Falha no envio Z-API: ${res?.error || 'Erro desconhecido'}`);
    }
  };

  const handleAvisarPortalWhatsApp = async (cliente: Cliente) => {
    if (!cliente?.telefone || !cliente?.token_magico) return toast.error("Faltam dados de contacto deste cliente.");
    const linkPortal = getSafePortalUrl(window.location.origin, cliente.token_magico, 'videos');
    const textoMensagem = `Olá! O seu portal de acompanhamento já está disponível. 🚀\n\nAcesse aqui para ver os materiais:\n${linkPortal}`;

    toast.info("Avisando cliente no WhatsApp...");
    const chatId = cliente.whatsapp_group_id ? cliente.whatsapp_group_id : cliente.telefone.replace(/\D/g, '');
    const res = await notificarWhatsApp(textoMensagem, chatId);

    if (res?.success) {
      toast.success("Mensagem entregue ao WhatsApp do cliente!");
    } else {
      toast.error(`Falha no envio Z-API: ${res?.error || 'Erro desconhecido'}`);
    }
  };

  const handleAprovarParaCliente = async (id: string) => {
    setActionLoading(id);
    const material = materiais.find(m => m.id === id);
    await supabase.from('materiais').update({
      status: 'pendente',
      editor_id: null,
      designer_id: null,
      wpp_enviado: true,
      agendado_para: null
    }).eq('id', id)
    toast.success("Aprovado! A abrir o WhatsApp do cliente...");
    if (material?.cliente?.telefone && material?.cliente?.token_magico) {
      const linkPortal = getSafePortalUrl(window.location.origin, material.cliente.token_magico, 'videos');
      const textoMensagem = `Olá! O material "${material.titulo}" foi concluído e está pronto para sua avaliação. 🎉\n\nPode acessar o seu portal aqui:\n${linkPortal}`;

      const groupId = material.cliente.whatsapp_group_id;
      if (groupId) {
        toast.info("Enviando aviso automático para o grupo...");
        notificarWhatsApp(textoMensagem, groupId);
      } else {
        toast.info("Enviando aviso automático via WhatsApp...");
        notificarWhatsApp(textoMensagem, material.cliente.telefone.replace(/\D/g, ''));
      }
    } else { toast.info("Faltam dados do cliente para o WhatsApp."); }
    loadData(); setActionLoading(null);
  }

  const handleAgendarParaCliente = async () => {
    if (!materialToSchedule || !scheduledDate) return toast.error("Selecione uma data e hora!");

    setActionLoading(materialToSchedule.id);
    const id = materialToSchedule.id;

    // Converte para ISO para evitar problemas de fuso horário
    const isoDate = new Date(scheduledDate).toISOString();

    const { error } = await supabase.from('materiais').update({
      // Não mudamos o status aqui para ele continuar na fila de Aprovação Interna
      agendado_para: isoDate,
      wpp_enviado: false
    }).eq('id', id);

    if (error) {
      toast.error("Erro ao agendar: " + error.message);
    } else {
      toast.success(`Mensagem agendada para ${new Date(scheduledDate).toLocaleString()}!`);
      setIsScheduleModalOpen(false);
      setMaterialToSchedule(null);
      setScheduledDate('');
    }

    loadData();
    setActionLoading(null);
  }

  const handleCancelarAgendamento = async (id: string) => {
    setActionLoading(id);
    const { error } = await supabase.from('materiais').update({
      agendado_para: null,
      wpp_enviado: false
    }).eq('id', id);

    if (error) toast.error("Erro ao cancelar: " + error.message);
    else toast.success("Agendamento cancelado!");

    loadData();
    setActionLoading(null);
  }
  const handleCheckAndAprovar = (m: Material) => {
    const missingVideo = m.editor_id && !m.video_entregue;
    const missingDesign = m.designer_id && !m.design_entregue;
    const totalmenteVazio = !m.editor_id && !m.designer_id && !m.link_drive && !m.link_capa;

    if (missingVideo || missingDesign || totalmenteVazio) {
      setIncompleteApprovalData({
        material: m,
        missingVideo: missingVideo || totalmenteVazio,
        missingDesign: missingDesign
      });
    } else {
      setMaterialToApproveFinal(m);
      setIsApproveConfirmModalOpen(true);
    }
  };

  const handleDashboardDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination } = result;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    // Ignore delegation modal droppable
    if (source.droppableId === 'delegation-list') return;

    const parts = source.droppableId.split('___');
    const type = parts[0];
    const clienteId = parts[1];
    const cicloLabel = parts[2];

    let itemsGroup: Material[] = [];
    if (type === 'analise' && groupedAnaliseRoteiro[clienteId]?.ciclos[cicloLabel]) {
      itemsGroup = Array.from(groupedAnaliseRoteiro[clienteId].ciclos[cicloLabel].itens);
    } else if (type === 'aprovado' && groupedRoteiros[clienteId]?.ciclos[cicloLabel]) {
      itemsGroup = Array.from(groupedRoteiros[clienteId].ciclos[cicloLabel].itens);
    } else if (type === 'visaogeral' && groupedVisaoGeral[clienteId]?.ciclos[cicloLabel]) {
      itemsGroup = Array.from(groupedVisaoGeral[clienteId].ciclos[cicloLabel].itens);
    } else {
      return;
    }

    const [reorderedItem] = itemsGroup.splice(source.index, 1);
    itemsGroup.splice(destination.index, 0, reorderedItem);

    const newOrderMap = new Map<string, number>();
    itemsGroup.forEach((item, index) => {
      newOrderMap.set(item.id, index + 1); // Or maintain absolute ordering if needed. For now, 1 to N is fine for display
    });

    // Optimistic UI update
    setMateriais(prev => {
      const newMateriais = [...prev];
      for (let i = 0; i < newMateriais.length; i++) {
        if (newOrderMap.has(newMateriais[i].id)) {
          newMateriais[i] = { ...newMateriais[i], ordem: newOrderMap.get(newMateriais[i].id)! };
        }
      }
      return newMateriais;
    });

    // Update DB
    const orderUpdates = itemsGroup.map((item, idx) =>
      supabase.from('materiais').update({ ordem: idx + 1 }).eq('id', item.id)
    );
    await Promise.all(orderUpdates);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || !selectedCicloDelegation) return;
    const items = Array.from(selectedCicloDelegation.itens);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setSelectedCicloDelegation({ ...selectedCicloDelegation, itens: items });
  };

  
  const handleCancelarDelegacaoAjuste = async (m: Material) => {
    if (!confirm("Tem certeza que deseja cancelar a delegação e voltar para a fila de ajustes?")) return;
    const newTags = (m.tags || []).filter(t => t !== '_ajuste_delegado');
    const { error } = await supabase.from('materiais').update({ tags: newTags }).eq('id', m.id);
    if (!error) { toast.success("Delegação cancelada!"); loadData(); registrarLogAdmin(m.id, "❌ Delegação de ajuste cancelada"); }
  };
  const handleCancelarDelegacaoDecupagem = async (m: Material) => {
    if (!confirm("Tem certeza que deseja cancelar a delegação e voltar para a fila de planejamento?")) return;
    const { error } = await supabase.from('materiais').update({ planner_id: null, status: 'roteiro_aprovado' }).eq('id', m.id);
    if (!error) { toast.success("Delegação cancelada!"); loadData(); registrarLogAdmin(m.id, "❌ Delegação de decupagem cancelada"); }
  };

  const handleDelegarItems = async () => {
    if (delegationType === 'planner' && !selectedPlannerId) return toast.error("Selecione um Decupador!");
    if (delegationType === 'editor' && !selectedEditorId && !selectedDesignerId) return toast.error("Selecione pelo menos um Editor ou Designer!");
    if (selectedItemsToDelegate.length === 0) return toast.error("Selecione pelo menos 1 material!");
    setLoading(true);

    const isAjusteDelegation = materiais.find(m => selectedItemsToDelegate.includes(m.id))?.status === 'ajustes';
    let updateData: any = {};
    
    if (delegationType === 'planner') {
      updateData = {
        planner_id: selectedPlannerId,
        status: 'planejamento',
        data_limite: delegationDeadline || null
      };
    } else {
      updateData = {
        status: isAjusteDelegation ? 'ajustes' : 'em_edicao'
      };
      
      if (selectedEditorId) {
        updateData.editor_id = selectedEditorId;
        updateData.video_entregue = false;
        if (delegationDeadlineEditor) updateData.data_limite_editor = delegationDeadlineEditor;
      }
      
      if (selectedDesignerId) {
        updateData.designer_id = selectedDesignerId;
        updateData.design_entregue = false;
        if (delegationDeadlineDesigner) updateData.data_limite_designer = delegationDeadlineDesigner;
      }
    }

    if (delegationType === 'planner' && newLinkBruto) {
      updateData.link_bruto = newLinkBruto;
    }

    const updates = selectedItemsToDelegate.map(mId => {
      const mat = materiais.find(m => m.id === mId);
      if (!mat) return null;

      let individualUpdate: any = { ...updateData };
      
      let newFeedbackParts: string[] = [];
      if (delegationType === 'planner' && adminFeedbackPlanner.trim() !== '') {
        newFeedbackParts.push(currentUserId ? `${adminFeedbackPlanner}\n\n[ID:${currentUserId}]` : adminFeedbackPlanner);
      } else if (delegationType === 'editor') {
        if (selectedEditorId && adminFeedbackEditor.trim() !== '') {
          newFeedbackParts.push(`[EDITOR]\n${adminFeedbackEditor}\n[/EDITOR]${currentUserId ? `\n\n[ID:${currentUserId}]` : ''}`);
        }
        if (selectedDesignerId && adminFeedbackDesigner.trim() !== '') {
          newFeedbackParts.push(`[DESIGNER]\n${adminFeedbackDesigner}\n[/DESIGNER]${currentUserId ? `\n\n[ID:${currentUserId}]` : ''}`);
        }
      }

      if (newFeedbackParts.length > 0) {
        const combinedNewFeedback = newFeedbackParts.join('\n\n');
        individualUpdate.feedback_admin = mat.feedback_admin ? `${mat.feedback_admin}\n\n---\n\n${combinedNewFeedback}` : combinedNewFeedback;
      }

      if (isAjusteDelegation) {
        const tags = mat.tags || [];
        if (!tags.includes('_ajuste_delegado')) tags.push('_ajuste_delegado');
        individualUpdate.tags = tags;
      }

      return supabase.from('materiais').update(individualUpdate).eq('id', mId);
    }).filter(Boolean);

    let error = null;
    try {
      const results = await Promise.all(updates);
      const failed = results.find(r => r?.error);
      if (failed) error = failed.error;
    } catch (e: any) {
      error = e;
    }

    if (!error && selectedCicloDelegation) {
      const orderUpdates = selectedCicloDelegation.itens.map((item: any, idx: number) =>
        supabase.from('materiais').update({ ordem: idx + 1 }).eq('id', item.id)
      );
      await Promise.all(orderUpdates);
    }

    if (error) {
      toast.error("Erro ao delegar: " + error.message);
    } else {
      toast.success(`Delegado com sucesso! (${qtd(selectedItemsToDelegate.length, 'material', 'materiais')})`);
      
      // LOG
      selectedItemsToDelegate.forEach(mId => {
        if (delegationType === 'planner') {
          const pName = membros.find(m => m.id === selectedPlannerId)?.nome || 'Decupador';
          registrarLogAdmin(mId, `🔄 Delegado para Decupador: ${pName}`);
        } else {
          if (selectedEditorId) {
            const eName = membros.find(m => m.id === selectedEditorId)?.nome || 'Editor';
            registrarLogAdmin(mId, `🔄 Delegado para Editor: ${eName}`);
          }
          if (selectedDesignerId) {
            const dName = membros.find(m => m.id === selectedDesignerId)?.nome || 'Designer';
            registrarLogAdmin(mId, `🔄 Delegado para Designer: ${dName}`);
          }
        }
      });

      const firstItem = materiais.find(m => selectedItemsToDelegate.includes(m.id));
      const clienteNome = firstItem?.cliente?.nome || 'CLIENTE NÃO IDENTIFICADO';
      const tituloOrQuantidade = selectedItemsToDelegate.length > 1 ? `🔢 ${selectedItemsToDelegate.length} MATERIAIS` : (firstItem?.titulo || 'DIVERSOS');

      if (delegationType === 'planner') {
        const instrucaoMsgPlanner = adminFeedbackPlanner ? `\n\n*📝 INSTRUÇÃO:*\n${adminFeedbackPlanner}` : '';
        const mPlanner = membros.find(m => m.id === selectedPlannerId);
        const msgPlanner = `🔔 NOVA TAREFA: DECUPAGEM\n\n*${clienteNome}*\n${tituloOrQuantidade}${instrucaoMsgPlanner}`;
        await notificarClickUpChat(msgPlanner, (mPlanner as any)?.telegram_thread_id);
      } else {
        if (selectedEditorId) {
          const instrucaoMsgEditor = adminFeedbackEditor ? `\n\n*📝 INSTRUÇÃO:*\n${adminFeedbackEditor}` : '';
          const mEditor = membros.find(m => m.id === selectedEditorId);
          const msgEditor = `🎬 NOVA TAREFA: EDIÇÃO\n\n*${clienteNome}*\n${tituloOrQuantidade}${instrucaoMsgEditor}`;
          await notificarClickUpChat(msgEditor, (mEditor as any)?.telegram_thread_id);
        }
        if (selectedDesignerId) {
          const instrucaoMsgDesigner = adminFeedbackDesigner ? `\n\n*📝 INSTRUÇÃO:*\n${adminFeedbackDesigner}` : '';
          const mDesigner = membros.find(m => m.id === selectedDesignerId);
          const msgDesigner = `🎨 NOVA TAREFA: DESIGN\n\n*${clienteNome}*\n${tituloOrQuantidade}${instrucaoMsgDesigner}`;
          await notificarClickUpChat(msgDesigner, (mDesigner as any)?.telegram_thread_id);
        }
      }

      setIsDelegateModalOpen(false);
      setAdminFeedbackPlanner('');
      setAdminFeedbackEditor('');
      setAdminFeedbackDesigner('');
      setDelegationDeadline('');
      setSelectedPlannerId('');
      setSelectedEditorId('');
      setSelectedDesignerId('');
      setSelectedCicloDelegation(null);
      setSelectedItemsToDelegate([]);
      setNewLinkBruto('');
      loadData();
    }
    setLoading(false);
  }

  const adicionarItemLote = () => setLoteItens([...loteItens, { id: Date.now(), titulo: '', roteiro: '' }]);
  const removerItemLote = (id: number) => setLoteItens(loteItens.filter(i => i.id !== id));
  const atualizarItemLote = (id: number, campo: string, valor: string) => setLoteItens(loteItens.map(i => i.id === id ? { ...i, [campo]: valor } : i));

  const criarLoteProducao = async () => {
    if (!loteForm.cliente_id) return toast.error("Selecione o Cliente no cabeçalho do lote.");
    const itensInvalidos = loteItens.filter(i => !i.titulo || !i.roteiro);
    if (itensInvalidos.length > 0) return toast.error("Preencha o título e o roteiro de todas as subtarefas.");
    setLoading(true);
    const insercoes = loteItens.map(item => ({ cliente_id: loteForm.cliente_id, ciclo: parseInt(loteForm.ciclo) || 1, link_bruto: loteForm.link_bruto || null, titulo: item.titulo, roteiro: item.roteiro, status: 'analise_roteiro' }));
    const { error } = await supabase.from('materiais').insert(insercoes);
    if (error) { toast.error("Erro ao enviar lote: " + error.message); setLoading(false); return; }
    toast.success(`${qtd(loteItens.length, 'tarefa', 'tarefas')} criadas e enviadas para Roteiro em Análise!`);
    setLoteForm({ cliente_id: '', ciclo: '1', link_bruto: '' });
    setLoteItens([{ id: Date.now(), titulo: '', roteiro: '' }]); loadData(); setLoading(false);
  }

  const executeImport = async (accessToken?: string) => {
    try {
      const { data: subtarefasCompletas, error: clickupError } = await getClickUpTaskAndSubtasks(plannerTaskId);

      if (clickupError) {
        toast.error(clickupError);
        setLoading(false);
        return;
      }

      if (!subtarefasCompletas || subtarefasCompletas.length === 0) {
        toast.error("Tarefa não retornou subtarefas ou deu erro.");
        setLoading(false);
        return;
      }
      const parseClickUpRoteiro = (sub: any) => {
        let md = sub.markdown_description || sub.description || sub.text_content || 'Sem roteiro inserido no ClickUp.';
        md = md.split('\n').map((l: string) => l.trimEnd()).join('\n');
        md = md.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n&nbsp;\n\n');
        md = md.replace(/\n(?!\n)/g, '\n\n');
        return marked.parse(md, { breaks: true, gfm: true }) as string;
      };

      const novos = subtarefasCompletas.map((sub: any) => ({
        cliente_id: importClienteId,
        titulo: sub.name,
        roteiro: parseClickUpRoteiro(sub),
        status: 'analise_roteiro',
        clickup_task_id: sub.id,
        ciclo: parseInt(importCiclo) || 1,
        created_at: new Date().toISOString(),
        link_bruto: '' // default empty
      }))

      if (createDriveFolders && accessToken && parentFolderUrl) {
        const driveId = getGoogleDriveId(parentFolderUrl);
        if (driveId) {
          toast.loading("Criando pastas no Google Drive...");
          const res = await createBatchFolders(driveId, novos.map((n: any) => n.titulo), accessToken);
          toast.dismiss();
          if (res.success && res.links) {
            novos.forEach((n: any) => {
              if (res.links[n.titulo]) {
                n.link_bruto = `${parentFolderUrl} ${res.links[n.titulo]}`;
              } else {
                n.link_bruto = parentFolderUrl;
              }
            });
            toast.success("Pastas criadas no Drive com sucesso!");
          } else {
            toast.error(res.error || "Falha ao criar pastas no Drive, importando sem links...");
          }
        }
      }

      const { error } = await supabase.from('materiais').insert(novos);
      if (error) { toast.error("Erro no Banco de Dados: " + error.message); setLoading(false); return; }
      setIsImportModalOpen(false);
      setPlannerTaskId(''); loadData();
      setCreateDriveFolders(false); setParentFolderUrl('');
      toast.success(`${novos.length} Guias importados com status [Roteiro em Análise] para a aba de Planejamento!`);
    } catch (err) { toast.error("Erro na comunicação com o ClickUp."); } finally { setLoading(false) }
  }

  const handleImportPlanner = async () => {
    if (!plannerTaskId || !importClienteId) return toast.error("Preencha os campos obrigatórios!");
    if (createDriveFolders && !parentFolderUrl) return toast.error("Selecione a Pasta Mãe no Drive!");
    
    setLoading(true)

    if (createDriveFolders) {
      if (!window.google?.accounts?.oauth2) {
        toast.error("Aguarde um momento. Os scripts do Google ainda estão carregando.");
        setLoading(false);
        return;
      }

      const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/drive',
        callback: (response: any) => {
          if (response.error) {
            toast.error(`Erro na autorização do Google: ${response.error_description || response.error}`);
            setLoading(false);
            return;
          }
          if (response.access_token) {
            executeImport(response.access_token);
          }
        }
      });
      client.requestAccessToken();
    } else {
      executeImport();
    }
  }

  const handleSendNewVersion = async () => {
    if (!selectedMaterial || !newDriveLink) return
    setLoading(true)
    await supabase.from('materiais').update({ link_drive: newDriveLink, status: 'pendente', feedback: null }).eq('id', selectedMaterial.id)
    await notificarClickUpChat(`🎬 REEDIÇÃO\n\n**${selectedMaterial.cliente?.nome}**\n${selectedMaterial.titulo}`);
    setIsVersionModalOpen(false); setNewDriveLink(''); loadData(); setLoading(false); toast.success("Versão atualizada!");
  }

  const syncWithClickUp = async () => {
    setSyncing(true)
    try {
      const materiaisParaSync = materiais.filter(m => m.clickup_task_id)
      for (const m of materiaisParaSync) {
        const { data: task } = await getClickUpTask(m.clickup_task_id || '');
        if (task) { await supabase.from('materiais').update({ titulo: task.name }).eq('id', m.id); }
      }
      loadData()
    } catch (err) { console.error(err) } finally { setSyncing(false) }
  }

  const handleSaveInstruction = async () => {
    if (!materialToEditInstruction) return;
    setLoading(true);
    let combined = '';
    if (instructionEditorText.trim()) combined += `[EDITOR]\n${instructionEditorText.trim()}\n[/EDITOR]\n\n`;
    if (instructionDesignerText.trim()) combined += `[DESIGNER]\n${instructionDesignerText.trim()}\n[/DESIGNER]\n\n`;
    const instructionToSave = currentUserId && combined.trim() ? `${combined.trim()}\n\n[ID:${currentUserId}]` : combined.trim() || null;
    const { error } = await supabase.from('materiais').update({ feedback_admin: instructionToSave }).eq('id', materialToEditInstruction.id);
    if (!error) {
      toast.success("Instrução atualizada!");
      loadData();
      setIsEditInstructionModalOpen(false);
    } else {
      toast.error("Erro ao atualizar instrução.");
    }
    setLoading(false);
  };

  const toggleClient = (id: string) => setExpandedClients(prev => prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id])
  const toggleCiclo = (cid: string, ciclo: string) => { const k = `${cid}-${ciclo}`; setExpandedCiclos(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]) }

  const getStatusColor = (s: string) => {
    if (s === 'aprovado' || s === 'post_aprovado') return 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
    if (s === 'roteiro_aprovado') return 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
    if (s === 'revisao') return 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
    if (s === 'ajustes') return 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
    if (s === 'analise_roteiro') return 'bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100'
    if (s === 'verificar_material') return 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100'
    if (s === 'concluido') return 'bg-zinc-100 text-zinc-600 border-zinc-300 hover:bg-zinc-200'
    if (s === 'em_edicao') return 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
    if (s === 'planejamento' || s === 'organizado' || s === 'em_organizacao' || s === 'faltando_material') return 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
    return 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
  }

  const renderPreviewContent = (url: string) => {
    if (!url) return null;

    if (isExpandingFolder) {
      return (
        <div className="flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-white opacity-40" size={40} />
          <p className="text-[12px] font-semibold text-white/40">Carregando pasta...</p>
        </div>
      );
    }

    const links = expandedCapaLinks;
    if (links.length > 1) {
      return (
        <div className="w-full h-full relative group">
          <div className="w-full h-full overflow-hidden" ref={emblaRef}>
            <div className="flex w-full h-full">
              {links.map((link: string, idx: number) => {
                const isImg = link.match(/\.(jpeg|jpg|gif|png|webp|avif|jfif)$/i);
                const emb = getEmbedUrl(link);
                return (
                  <div
                    key={idx}
                    className="flex-[0_0_100%] min-w-0 h-full relative flex items-center justify-center bg-black"
                  >
                    {isImg ? (
                      (Math.abs(idx - currentSlide) <= 2 || (idx === 0 && currentSlide >= links.length - 2) || (idx === links.length - 1 && currentSlide <= 1)) ? (
                        <img src={link} loading="lazy" className="w-full h-full object-contain select-none" alt={`Slide ${idx + 1}`} />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 gap-3"><div className="w-8 h-8 border-4 border-zinc-700 border-t-zinc-400 rounded-full animate-spin"></div><span className="text-[11px] font-semibold ">Aguardando...</span></div>
                      )
                    ) : (
                                              (Math.abs(idx - currentSlide) <= 1 || (idx === 0 && currentSlide === links.length - 1) || (idx === links.length - 1 && currentSlide === 0)) ? (
                                                <iframe title={`Slide ${idx + 1}`} src={emb || link} className="w-full h-full border-0" allowFullScreen></iframe>
                                              ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 gap-3"><div className="w-8 h-8 border-4 border-zinc-700 border-t-zinc-400 rounded-full animate-spin"></div><span className="text-[11px] font-semibold ">Carregando...</span></div>
                                              )
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Navegação de Slides */}
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 justify-between items-center z-20 pointer-events-none flex">
            <button
              onClick={(e) => { e.stopPropagation(); emblaApi?.scrollPrev(); }}
              className="p-3 bg-white/10 backdrop-blur-md text-white rounded-full hover:bg-white/20 border border-white/10 pointer-events-auto transition-all active:scale-90 shadow-xl"
            >
              <ChevronDown className="rotate-90" size={24} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); emblaApi?.scrollNext(); }}
              className="p-3 bg-white/10 backdrop-blur-md text-white rounded-full hover:bg-white/20 border border-white/10 pointer-events-auto transition-all active:scale-90 shadow-xl"
            >
              <ChevronDown className="-rotate-90" size={24} />
            </button>
          </div>

          {/* Contador */}
          <div className="absolute bottom-6 inset-x-0 flex flex-col items-center gap-3 z-20 pointer-events-none">
            <div className="flex gap-2 p-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10 pointer-events-auto">
              {links.map((_: any, idx: number) => (
                <button
                  key={idx}
                  onClick={() => emblaApi?.scrollTo(idx)}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${idx === currentSlide ? 'bg-white scale-125 shadow-[0_0_10px_rgba(255,255,255,0.5)]' : 'bg-white/20 hover:bg-white/40'}`}
                />
              ))}
            </div>
            <span className="text-[11px] font-semibold text-white bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm">{currentSlide + 1} / {links.length}</span>
          </div>
        </div>
      );
    }

    if (url.match(/\.(jpeg|jpg|gif|png|webp|avif|jfif)$/i)) return <img src={url} className="w-full mx-auto aspect-[9/16] md:aspect-video md:max-w-6xl max-h-[85vh] rounded-2xl object-contain shadow-2xl" alt="Preview" />;
    const finalUrl = getEmbedUrl(url) || url;
    const isDrive = isGoogleDriveVideo(url);
    return (
      <div
        className={`w-full mx-auto bg-black rounded-2xl overflow-hidden relative bg-black shadow-2xl border border-white/10 flex items-center justify-center transition-all duration-300 ${aspectRatio === '9/16' ? 'aspect-[9/16] max-w-[420px]' :
            aspectRatio === 'video' ? 'aspect-video max-w-6xl' :
              'aspect-square max-w-2xl'
          }`}
        style={{ containerType: 'inline-size' }}
      >
        {/* Tela responsiva do vídeo */}

        {isDrive ? (
          <ScaledGoogleDrivePlayer
            url={url}
            zoomMode={zoomMode}
            aspectRatio={aspectRatio}
          />
        ) : (
          <iframe
            src={finalUrl}
            className="absolute inset-0 w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}
      </div>
    );
  };


  // ===================== Helpers de layout do redesign =====================
  // São funções de renderização (chamadas como função), não componentes, para não remontar
  // a árvore a cada render e não quebrar o arrastar-e-soltar.

  const STATUS_INFO: Record<string, { label: string; cls: string }> = {
    analise_roteiro: { label: 'Em análise', cls: 'bg-pink-50 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400' },
    roteiro_pendente: { label: 'Aguardando cliente', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' },
    roteiro_aprovado: { label: 'Roteiro aprovado', cls: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400' },
    planejamento: { label: 'Aguardando decupagem', cls: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300' },
    em_organizacao: { label: 'Decupando', cls: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' },
    faltando_material: { label: 'Falta material', cls: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' },
    verificar_material: { label: 'Verificar material', cls: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' },
    organizado: { label: 'Material decupado', cls: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400' },
    em_edicao: { label: 'Em produção', cls: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' },
    pendente: { label: 'Aguardando cliente', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' },
    ajustes: { label: 'Ajustes', cls: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' },
    revisao: { label: 'Edição pronta', cls: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400' },
    aprovado: { label: 'Aprovado', cls: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' },
    post_aprovado: { label: 'Aprovado', cls: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' },
    concluido: { label: 'Concluído', cls: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300' },
  };
  const statusChip = (label: string, cls: string) => (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md whitespace-nowrap ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />{label}
    </span>
  );
  const statusOf = (m: Material) => STATUS_INFO[m.status] || { label: String(m.status), cls: STATUS_INFO.concluido.cls };

  const AVATAR_COLORS = ['#E8559A', '#3B82F6', '#F59E0B', '#14B8A6', '#9B6CF0', '#A25431'];
  const avatarColor = (s: string) => AVATAR_COLORS[s.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
  const initials = (nome?: string) => (nome || '?').split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  // Avatares dos responsáveis. A ordem dos ids segue AVATAR_ROLES (planner, editor, designer);
  // quem acumula papéis aparece uma vez só, com todos os papéis no tooltip.
  const AVATAR_ROLES = ['Planner', 'Editor', 'Designer'];
  const avatars = (ids: (string | null | undefined)[], center = false) => {
    const roles = new Map<string, string[]>();
    ids.forEach((id, i) => { if (id) roles.set(id, [...(roles.get(id) || []), AVATAR_ROLES[i] || '']); });
    const people = Array.from(roles.keys()).map(id => membros.find(mb => mb.id === id)).filter(Boolean) as MembroComNome[];
    if (people.length === 0) return <div className={`flex ${center ? 'md:justify-center' : ''}`}><span className="text-xs text-zinc-400">—</span></div>;
    return (
      <div className={`flex ${center ? 'md:justify-center' : ''}`}>
        {people.map((p, i) => (
          <span key={p.id} title={`${(roles.get(p.id) || []).filter(Boolean).join(' / ')}: ${p.nome || p.email}`} style={{ background: avatarColor(p.id) }} className={`w-6 h-6 shrink-0 rounded-full text-[10px] font-semibold text-white inline-flex items-center justify-center ring-2 ${theme === 'dark' ? 'ring-zinc-900' : 'ring-white'} ${i > 0 ? '-ml-1.5' : ''}`}>{initials(p.nome || p.email)}</span>
        ))}
      </div>
    );
  };

  // Contadores do fluxo por cliente/ciclo (substituem as pílulas coloridas ao lado do nome)
  const PIPELINE = [
    { key: 'edicao', label: 'Produção', full: 'em produção', dot: 'bg-blue-500' },
    { key: 'revisao', label: 'Aprovação', full: 'para aprovação', dot: 'bg-purple-500' },
    { key: 'ajustes', label: 'Ajustes', full: 'com ajuste', dot: 'bg-red-500' },
    { key: 'video', label: 'Postar', full: 'para postar', dot: 'bg-green-500' },
    { key: 'roteiro', label: 'Roteiros', full: 'roteiros aprovados', dot: 'bg-orange-500' },
  ] as const;
  type PipelineCounts = Record<(typeof PIPELINE)[number]['key'], number>;
  const countPipeline = (itens: Material[]): PipelineCounts => {
    const c: PipelineCounts = { edicao: 0, revisao: 0, ajustes: 0, video: 0, roteiro: 0 };
    itens.forEach(i => {
      if (i.status === 'em_edicao') c.edicao++;
      if (i.status === 'revisao') c.revisao++;
      if (i.status === 'ajustes') c.ajustes++;
      if (i.status === 'aprovado' || i.status === 'post_aprovado') { if (i.link_drive || i.link_capa) c.video++; else c.roteiro++; }
      if (i.status === 'roteiro_aprovado') c.roteiro++;
    });
    return c;
  };
  // ATALHOS DO INÍCIO: todo número clicável leva aos itens que ele conta.
  // Se a etapa tem página própria com exatamente esses itens, abre a página já com os clientes expandidos;
  // senão, filtra a própria lista do Início e expande os clientes/ciclos para os itens aparecerem.
  const PAGINAS_ETAPA = {
    ajustes: { tab: 'solicitacao-ajustes', prefixo: 'notif-', grupos: groupedAjustes },
    aprovacao: { tab: 'materiais-aprovacao', prefixo: 'rev-', grupos: groupedMateriaisAprovacao },
    prontos: { tab: 'materiais-aprovados', prefixo: 'ok-', grupos: groupedMateriaisAprovados },
  } as const;
  const irParaPaginaEtapa = (etapa: keyof typeof PAGINAS_ETAPA, clienteId?: string) => {
    const d = PAGINAS_ETAPA[etapa];
    const ids = clienteId ? [clienteId] : Object.keys(d.grupos);
    setOpenGroups(prev => Array.from(new Set([...prev, ...ids.map(id => d.prefixo + id)])));
    setActiveTab(d.tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const ETAPA_TESTE = {
    roteiros: { label: 'Roteiros (análise e com o cliente)', test: (m: Material) => m.status === 'analise_roteiro' || m.status === 'roteiro_pendente' },
    decupagem: { label: 'Decupagem', test: (m: Material) => ['planejamento', 'em_organizacao', 'faltando_material', 'verificar_material'].includes(m.status) },
    producao: { label: 'Produção', test: (m: Material) => m.status === 'organizado' || m.status === 'em_edicao' },
    emEdicao: { label: 'Em produção', test: (m: Material) => m.status === 'em_edicao' },
    portal: { label: 'No portal do cliente', test: (m: Material) => m.status === 'pendente' },
    pendentes: { label: 'Pendentes com o cliente', test: (m: Material) => m.status === 'pendente' || m.status === 'roteiro_pendente' },
    aprovados: { label: 'Aprovados', test: (m: Material) => ['aprovado', 'roteiro_aprovado', 'post_aprovado'].includes(m.status) },
    roteirosAprovados: { label: 'Roteiros aprovados', test: (m: Material) => m.status === 'roteiro_aprovado' || ((m.status === 'aprovado' || m.status === 'post_aprovado') && !(m.link_drive || m.link_capa)) },
  } as const;
  const filtrarInicio = (etapa: keyof typeof ETAPA_TESTE, clienteId?: string) => {
    const f = { ...ETAPA_TESTE[etapa], clienteId };
    const itens = materiais.filter(m => m.status !== 'concluido' && (!clienteId || m.cliente_id === clienteId) && f.test(m));
    setShowArchived(false);
    setActiveFilter('todos');
    setFiltroEtapa(f);
    setExpandedClients(prev => Array.from(new Set([...prev, ...itens.map(m => `geral-${m.cliente_id}`)])));
    setExpandedCiclos(prev => Array.from(new Set([...prev, ...itens.map(m => `${m.cliente_id}-CICLO ${m.ciclo || 1}`)])));
    if (activeTab !== 'geral') setActiveTab('geral');
    setTimeout(() => document.getElementById('lista-inicio')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };
  // Destino de cada coluna de contagem por cliente
  const abrirContagem = (key: (typeof PIPELINE)[number]['key'], clienteId: string) => {
    if (key === 'ajustes') irParaPaginaEtapa('ajustes', clienteId);
    else if (key === 'revisao') irParaPaginaEtapa('aprovacao', clienteId);
    else if (key === 'video') irParaPaginaEtapa('prontos', clienteId);
    else if (key === 'edicao') filtrarInicio('emEdicao', clienteId);
    else filtrarInicio('roteirosAprovados', clienteId);
  };

  const PIPELINE_GRID = 'md:grid md:grid-cols-[repeat(5,80px)] md:items-center md:shrink-0';
  // Desktop: colunas fixas, alinhadas com o cabeçalho. Zero vira um traço apagado, então nada muda de lugar.
  // Com clienteId, cada número vira botão que leva aos itens daquele cliente.
  const pipelineCols = (c: PipelineCounts, clienteId?: string) => (
    <div className={`hidden ${PIPELINE_GRID}`}>
      {PIPELINE.map(p => {
        const n = c[p.key];
        if (n === 0) return <span key={p.key} className="text-center text-[13px] text-zinc-300 dark:text-zinc-600">–</span>;
        const alerta = p.key === 'ajustes';
        const conteudo = (
          <span className={`inline-flex items-center gap-1.5 text-[13px] font-semibold tabular-nums px-2 py-0.5 rounded-md transition-colors ${alerta ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : tc.textMain} ${clienteId ? (alerta ? 'hover:bg-red-100 dark:hover:bg-red-900/40' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800') : ''}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />{n}
          </span>
        );
        return clienteId ? (
          <button key={p.key} type="button" className="flex justify-center" title={`Ver ${n} ${p.full}`} onClick={(e) => { e.stopPropagation(); abrirContagem(p.key, clienteId); }}>{conteudo}</button>
        ) : (
          <span key={p.key} className="flex justify-center" title={`${n} ${p.full}`}>{conteudo}</span>
        );
      })}
    </div>
  );
  const pipelineHead = () => (
    <div className={`hidden md:flex items-center gap-4 px-5 py-2.5 text-[11px] font-semibold tracking-wider uppercase text-zinc-400 border-b ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-100'}`}>
      <span className="flex-1">Cliente</span>
      <div className={PIPELINE_GRID}>
        {PIPELINE.map(p => <span key={p.key} className="text-center">{p.label}</span>)}
      </div>
    </div>
  );
  // Versão em linha (celular e linha do ciclo): ponto + número + nome curto, em tom neutro. Só o que tem valor.
  const pipelineInline = (c: PipelineCounts, className = '', clienteId?: string) => {
    const itens = PIPELINE.filter(p => c[p.key] > 0);
    if (itens.length === 0) return null;
    return (
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${className}`}>
        {itens.map(p => {
          const cls = `inline-flex items-center gap-1.5 ${p.key === 'ajustes' ? 'text-red-600 dark:text-red-400 font-medium' : 'text-zinc-500 dark:text-zinc-400'}`;
          const conteudo = <>
            <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
            <span className={`font-semibold tabular-nums ${p.key === 'ajustes' ? '' : tc.textMain}`}>{c[p.key]}</span> {p.label.toLowerCase()}
          </>;
          return clienteId
            ? <button key={p.key} type="button" title={`Ver ${c[p.key]} ${p.full}`} onClick={(e) => { e.stopPropagation(); abrirContagem(p.key, clienteId); }} className={`${cls} hover:underline underline-offset-2`}>{conteudo}</button>
            : <span key={p.key} title={`${c[p.key]} ${p.full}`} className={cls}>{conteudo}</span>;
        })}
      </div>
    );
  };
  const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
  const entregaCell = (m: Material, ignoreLate = false) => {
    if (!m.data_limite) return <span className="text-xs text-zinc-400">—</span>;
    const late = !ignoreLate && isDateLate(m.data_limite) && !['aprovado', 'post_aprovado', 'concluido'].includes(m.status);
    return late
      ? <span className="inline-flex items-center gap-1 text-[13px] font-medium text-red-600 dark:text-red-400"><Flag size={13} /> {fmtDate(m.data_limite)}</span>
      : <span className="text-[13px]">{fmtDate(m.data_limite)}</span>;
  };

  // Abre a tarefa no painel lateral com o roteiro pronto para editar
  const openRoteiro = (m: Material) => {
    setRoteiroToEdit(m);
    let txt = m.roteiro || '';
    if (!txt.includes('<p>') && !txt.includes('<br>')) txt = txt.replace(/\n/g, '<br/>');
    txt = txt.replace(/<li[^>]*>\s*<input[^>]*checked=""?[^>]*>\s*/gi, '<li data-list="checked">');
    txt = txt.replace(/<li[^>]*>\s*<input[^>]*type="checkbox"[^>]*>\s*/gi, '<li data-list="unchecked">');
    setNovoTituloText(m.titulo);
    setNewRoteiroText(txt);
    setIsEditRoteiroModalOpen(true);
  };

  const pageHeader = ({ title, icon: Icon, iconCls = 'bg-brand-soft text-brand', meta, crumb, actions }: { title: string; icon: any; iconCls?: string; meta?: string; crumb?: string; actions?: React.ReactNode }) => (
    <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
      <div className="flex items-center gap-3.5 min-w-0">
        <span className={`w-12 h-12 rounded-xl inline-flex items-center justify-center shrink-0 ${iconCls}`}><Icon size={22} /></span>
        <div className="min-w-0">
          {crumb && <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-0.5">{crumb} <ChevronRight size={12} /> <span className={tc.textMain}>{title}</span></div>}
          <h1 className="text-2xl font-medium tracking-tight truncate">{title}</h1>
          {meta && <p className="text-[13px] text-zinc-500 mt-0.5">{meta}</p>}
        </div>
      </div>
      {actions && <div className="md:ml-auto flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
  const btnInk = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] bg-brand-ink text-white text-[13px] font-medium hover:opacity-90 disabled:opacity-50 transition-all';
  const btnLine = `inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] border ${theme === 'dark' ? 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800' : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'} text-[13px] font-medium disabled:opacity-50 transition-colors`;
  const emptyState = (text: string) => (
    <div className={`${tc.bgCard} border border-dashed ${tc.borderStrong} rounded-2xl p-10 text-center`}><p className="text-sm text-zinc-500">{text}</p></div>
  );

  const clientInitial = (nome?: string) => (
    <span className="w-7 h-7 rounded-full bg-brand-soft text-brand text-xs font-semibold inline-flex items-center justify-center shrink-0">{(nome || '?').trim()[0]?.toUpperCase()}</span>
  );
  // Card de um cliente com as tarefas dele (fechado por padrão; clique no cabeçalho abre)
  const clientGroup = (key: string, nome: string, count: string, body: React.ReactNode, accent?: string) => {
    const collapsed = !openGroups.includes(key);
    return (
      <div key={key} className={`${tc.bgCard} rounded-2xl border ${tc.borderStrong} overflow-visible`}>
        <button type="button" onClick={() => setOpenGroups(prev => collapsed ? [...prev, key] : prev.filter(k => k !== key))} className={`w-full flex items-center gap-3 px-5 py-4 text-left ${collapsed ? '' : `border-b ${tc.borderStrong}`}`}>
          {accent && <span className={`w-[3px] h-5 rounded-full ${accent}`} />}
          {clientInitial(nome)}
          <h3 className="font-semibold text-[15px] truncate">{nome}</h3>
          <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 shrink-0">{count}</span>
          <ChevronDown size={18} className={`ml-auto text-zinc-400 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
        </button>
        {!collapsed && <div className="px-4 md:px-5 pb-5">{body}</div>}
      </div>
    );
  };
  const countItens = (group: any) => Object.values(group.ciclos).reduce((a: number, c: any) => a + c.itens.length, 0) as number;
  const qtd = (n: number, sing: string, plur: string) => `${n} ${n === 1 ? sing : plur}`;
  const fmtCiclo = (l: string) => l.charAt(0).toUpperCase() + l.slice(1).toLowerCase();
  const cicloBar = (label: string, action?: React.ReactNode) => (
    <div className="flex items-center gap-2 mt-4 mb-1.5">
      <span className="flex items-center gap-2 text-[13px] font-medium text-zinc-500"><Calendar size={14} /> {fmtCiclo(label)}</span>
      {action && <span className="ml-auto">{action}</span>}
    </div>
  );

  // Colunas com largura fixa (inclusive a de ações) para ficarem alinhadas em todas as linhas e no cabeçalho
  const TASK_GRID = 'md:grid md:grid-cols-[minmax(0,1fr)_120px_180px_104px_124px] md:items-center md:gap-4';
  // px-[15px]: compensa a borda de 1px das linhas, para o cabeçalho cair exatamente sobre as colunas
  const taskHead = () => (
    <div className={`hidden ${TASK_GRID} px-[15px] py-2 text-[11px] font-semibold tracking-wider uppercase text-zinc-400`}>
      <span>Tarefa</span><span className="text-center">Responsáveis</span><span>Status</span><span>Entrega</span><span />
    </div>
  );

  // Menu de 3 pontinhos com as ações secundárias de uma tarefa
  type MoreItem = { icon: any; label: string; onClick: () => void; danger?: boolean; disabled?: boolean } | false | null | undefined;
  const moreMenu = (id: string, items: MoreItem[]) => {
    const list = items.filter(Boolean) as Exclude<MoreItem, false | null | undefined>[];
    if (list.length === 0) return null;
    const open = moreMenuOpen === id;
    return (
      <span className={`relative inline-flex shrink-0 ${open ? 'z-50' : ''}`} onClick={(e) => e.stopPropagation()}>
        <button type="button" aria-label="Mais ações" title="Mais ações" onClick={() => setMoreMenuOpen(open ? null : id)} className={`w-9 h-9 rounded-[10px] inline-flex items-center justify-center transition-colors border ${tc.borderStrong} ${tc.bgCard} text-zinc-500 ${theme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-zinc-50'} ${open ? 'text-brand' : ''}`}>
          <MoreHorizontal size={17} />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMoreMenuOpen(null)} />
            <div className={`absolute right-0 top-full mt-1.5 min-w-[220px] ${tc.bgCard} border ${tc.borderStrong} rounded-xl shadow-xl z-50 p-1.5 text-left`}>
              {list.map((it, i) => (
                <button key={i} type="button" disabled={it.disabled} onClick={() => { setMoreMenuOpen(null); it.onClick(); }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] whitespace-nowrap disabled:opacity-50 transition-colors ${it.danger ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20' : `${tc.textMain} ${theme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}`}`}>
                  <it.icon size={15} className={it.danger ? '' : 'text-zinc-400'} /> {it.label}
                </button>
              ))}
            </div>
          </>
        )}
      </span>
    );
  };

  // Miniatura vertical (formato 9:16 dos conteúdos) de vídeo ou capa; clique abre a prévia
  // ready: true = entregue (✓ verde no canto), false = pendente (relógio), undefined = sem selo
  const mediaThumb = (url: string | undefined | null, label: string, Icon: any, gradient: string, ready?: boolean) => (
    <span className="relative shrink-0">
      <button type="button" disabled={!url} onClick={(e) => { e.stopPropagation(); if (url) setPreviewUrl(url); }} title={`${url ? `Abrir ${label.toLowerCase()}` : `${label} ainda não enviado`}${ready === undefined ? '' : ready ? ' · pronto' : ' · pendente'}`} className={`relative overflow-hidden w-11 h-[76px] rounded-lg text-white flex flex-col items-center justify-center gap-0.5 transition ${url ? `${gradient} hover:brightness-95` : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'}`}>
        <Icon size={15} /><span className="text-[9px] font-semibold">{label}</span>
        {url && <ThumbImage key={url} url={url} label={label} small />}
      </button>
      {ready !== undefined && (
        <span className={`absolute -top-1.5 -right-1.5 w-[18px] h-[18px] rounded-full inline-flex items-center justify-center ring-2 ${theme === 'dark' ? 'ring-zinc-900' : 'ring-white'} ${ready ? 'bg-green-500 text-white' : 'bg-zinc-300 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300'}`}>
          {ready ? <CheckCircle2 size={11} strokeWidth={3} /> : <Clock size={10} strokeWidth={3} />}
        </span>
      )}
    </span>
  );
  const mediaThumbs = (m: Material, showReady = false) => {
    const temVideo = !!m.editor_id || !!m.link_drive;
    const temDesign = !!m.designer_id || !!m.link_capa;
    return (
      <div className="flex items-center gap-2 shrink-0">
        {(temVideo || !temDesign) && mediaThumb(m.link_drive, 'Vídeo', PlayCircle, 'bg-gradient-to-br from-[#F0C9AE] to-brand', showReady && temVideo ? !!m.video_entregue : undefined)}
        {temDesign && mediaThumb(m.link_capa, 'Capa', ImageIcon, 'bg-gradient-to-br from-pink-200 to-pink-500', showReady ? !!m.design_entregue : undefined)}
      </div>
    );
  };
  // Tags universais: o ícone aparece ao passar o mouse e as tags aplicadas ficam ao lado do título
  // Tags são criadas e aplicadas no próprio lugar: o seletor tem "Criar tag" no topo e a lista abaixo
  const criarTagNoLocal = async (m: Material) => {
    const label = newTagLabel.trim().toUpperCase();
    if (!label) return;
    if (systemTags.some(t => t.label === label)) {
      if (!(m.tags || []).includes(label)) await toggleMaterialTag(m, label);
      setNewTagLabel('');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.from('tags').insert([{ label, color: newTagColor.startsWith('#') ? newTagColor : '#eab308' }]).select();
    if (!error && data) {
      setSystemTags(prev => [...prev, data[0]]);
      await toggleMaterialTag(m, label);
      setNewTagLabel('');
      toast.success('Tag criada!');
    } else {
      toast.error('Erro ao criar tag: ' + (error?.message || 'erro desconhecido'));
    }
    setLoading(false);
  };
  const excluirTag = (tag: { id: string; label: string }) => { setTagDropdownOpen(null); openConfirm('Excluir tag', `Excluir a tag "${tag.label}" de todo o sistema?`, async () => {
    await supabase.from('tags').delete().eq('id', tag.id);
    setSystemTags(prev => prev.filter(t => t.id !== tag.id));
    toast.success('Tag removida!');
  }, 'warning'); };
  // Seletor de tags: busca + lista com bolinha de cor e check; digitar um nome novo oferece "Criar".
  // O menu é desenhado num portal com posição fixa, então nunca é cortado pela lista e abre para cima quando falta espaço embaixo.
  const TAG_MENU_W = 272;
  const TAG_MENU_H = 360;
  const abrirTags = (e: React.MouseEvent, m: Material) => {
    e.stopPropagation();
    if (tagDropdownOpen === m.id) { setTagDropdownOpen(null); return; }
    setTagAnchor((e.currentTarget as HTMLElement).getBoundingClientRect());
    setNewTagLabel('');
    setNewTagColor(TAG_PALETTE[systemTags.length % TAG_PALETTE.length]);
    setTagDropdownOpen(m.id);
  };
  const tagMenu = (m: Material) => {
    if (!tagAnchor || typeof document === 'undefined') return null;
    const vh = window.innerHeight, vw = window.innerWidth;
    const espacoAbaixo = vh - tagAnchor.bottom, espacoAcima = tagAnchor.top;
    const paraCima = espacoAbaixo < TAG_MENU_H + 12 && espacoAcima > espacoAbaixo;
    const left = Math.max(8, Math.min(tagAnchor.left, vw - TAG_MENU_W - 8));
    const pos: React.CSSProperties = paraCima
      ? { bottom: vh - tagAnchor.top + 6, left, maxHeight: Math.min(TAG_MENU_H, espacoAcima - 16) }
      : { top: tagAnchor.bottom + 6, left, maxHeight: Math.min(TAG_MENU_H, espacoAbaixo - 16) };
    const aplicadas = m.tags || [];
    const q = newTagLabel.trim().toUpperCase();
    const lista = q ? systemTags.filter(t => t.label.includes(q)) : systemTags;
    const existe = systemTags.find(t => t.label === q);
    const corNova = newTagColor.startsWith('#') ? newTagColor : TAG_PALETTE[0];
    const parar = (e: React.SyntheticEvent) => e.stopPropagation();
    return createPortal(
      <>
        <div className="fixed inset-0 z-[10000]" onClick={(e) => { e.stopPropagation(); setTagDropdownOpen(null); }} onMouseDown={parar} />
        <div
          ref={tagMenuRef}
          onClick={parar}
          onMouseDown={parar}
          style={{ position: 'fixed', width: TAG_MENU_W, ...pos }}
          className={`z-[10001] flex flex-col ${tc.bgCard} ${tc.textMain} border ${tc.borderStrong} rounded-xl shadow-2xl overflow-hidden text-left animate-in fade-in zoom-in-95 duration-100`}
        >
          <div className={`p-2 border-b ${tc.border} shrink-0`}>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                autoFocus
                type="text"
                value={newTagLabel}
                onChange={e => setNewTagLabel(e.target.value)}
                onKeyDown={e => {
                  if (e.key !== 'Enter' || !q) return;
                  if (existe) { toggleMaterialTag(m, existe.label); setNewTagLabel(''); }
                  else criarTagNoLocal(m);
                }}
                placeholder="Buscar ou criar tag"
                className={`w-full h-8 pl-8 pr-2.5 ${tc.bgInput} border ${tc.borderStrong} rounded-lg text-[13px] outline-none focus:border-brand`}
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-1">
            {systemTags.length === 0 && !q && <p className="text-xs text-zinc-400 px-2.5 py-2">Nenhuma tag ainda. Digite um nome para criar a primeira.</p>}
            {lista.map(tag => {
              const marcada = aplicadas.includes(tag.label);
              return (
                <div key={tag.id} className={`group/tag flex items-center rounded-lg ${tc.bgHover} transition-colors`}>
                  <button type="button" onClick={() => toggleMaterialTag(m, tag.label)} className="flex-1 min-w-0 flex items-center gap-2.5 h-8 px-2 text-left">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tagHex(tag.label) }} />
                    <span className={`flex-1 truncate text-[13px] ${marcada ? 'font-semibold' : ''}`}>{tag.label}</span>
                    {marcada && <Check size={15} className="text-brand shrink-0" />}
                  </button>
                  <button type="button" onClick={() => excluirTag(tag)} title="Excluir tag do sistema" className="md:opacity-0 md:group-hover/tag:opacity-100 w-7 h-7 mr-0.5 inline-flex items-center justify-center rounded-md text-zinc-400 hover:text-red-500 transition-opacity shrink-0"><Trash2 size={13} /></button>
                </div>
              );
            })}
          </div>

          {q && !existe && (
            <div className={`p-2 border-t ${tc.border} shrink-0 space-y-2`}>
              <div className="flex items-center justify-between px-1.5">
                {TAG_PALETTE.map(c => (
                  <button key={c} type="button" onClick={() => setNewTagColor(c)} title="Escolher cor" aria-label="Escolher cor"
                    className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ring-offset-2 ${theme === 'dark' ? 'ring-offset-zinc-900' : 'ring-offset-white'} ${corNova === c ? 'ring-2 ring-zinc-400' : ''}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
              <button type="button" disabled={loading} onClick={() => criarTagNoLocal(m)} className="w-full flex items-center gap-2 h-8 px-2 rounded-lg text-[13px] text-zinc-500 hover:bg-brand-soft disabled:opacity-50 transition-colors">
                <Plus size={14} className="text-brand shrink-0" /> Criar
                <span className="inline-flex items-center h-5 px-2 rounded-full text-[11px] font-semibold truncate" style={chipStyle(corNova)}>{q}</span>
              </button>
            </div>
          )}
        </div>
      </>,
      document.body
    );
  };
  const tagControl = (m: Material) => (
    <span className={`inline-flex ${tagDropdownOpen === m.id ? 'opacity-100' : 'md:opacity-0 md:group-hover/row:opacity-100'} transition-opacity`}>
      <button type="button" onClick={(e) => abrirTags(e, m)} title="Tags" className={`w-7 h-7 inline-flex items-center justify-center rounded-md border ${tc.borderStrong} ${tc.bgCard} ${tagDropdownOpen === m.id ? 'text-brand border-brand' : 'text-zinc-500'} hover:text-brand`}>
        <Tag size={13} />
      </button>
      {tagDropdownOpen === m.id && tagMenu(m)}
    </span>
  );
  // Tags pequenas, numa linha própria embaixo do título
  const tagChips = (m: Material) => (m.tags || []).filter(t => !t.startsWith('_')).map(t => (
    <span key={t} className="inline-flex items-center gap-1.5 h-5 px-2 rounded-full text-[11px] font-semibold whitespace-nowrap" style={getTagStyle(t)}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tagHex(t) }} />{t}
    </span>
  ));
  const tagLine = (m: Material) => (m.tags || []).some(t => !t.startsWith('_'))
    ? <div className="flex flex-wrap gap-1 mt-1">{tagChips(m)}</div>
    : null;

  // Linha de tarefa em colunas (Tarefa | Responsáveis | Status | Entrega | ações). Clique abre a tarefa.
  const taskRow = ({ m, status, actions, below, drag, ignoreLate, lead }: { m: Material; status?: React.ReactNode; actions?: React.ReactNode; below?: React.ReactNode; drag?: { provided: any; snapshot: any }; ignoreLate?: boolean; lead?: React.ReactNode }) => (
    <div
      key={m.id}
      ref={drag?.provided.innerRef}
      {...(drag ? drag.provided.draggableProps : {})}
      {...(drag ? drag.provided.dragHandleProps : {})}
      onClick={() => openRoteiro(m)}
      className={`group/row cursor-pointer rounded-xl border ${tc.borderStrong} ${tc.bgCard} px-3.5 py-3 mb-1.5 ${theme === 'dark' ? 'hover:bg-zinc-800/60' : 'hover:bg-zinc-50'} transition-colors ${drag?.snapshot.isDragging ? 'ring-2 ring-brand shadow-xl' : ''}`}
    >
      <div className={`flex flex-col gap-2.5 ${TASK_GRID}`}>
        <div className="flex items-center gap-3 min-w-0">
          {lead}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-medium text-sm truncate">{m.titulo}</span>
              {(msgsNaoLidas[m.id] || 0) > 0 && <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-brand" title="O cliente mandou mensagem no portal"><span className="w-1.5 h-1.5 rounded-full bg-brand" />Nova mensagem</span>}
              <button type="button" onClick={(e) => { e.stopPropagation(); handleEditTitulo(m); }} title="Editar título" className={`shrink-0 md:opacity-0 md:group-hover/row:opacity-100 transition-opacity w-7 h-7 inline-flex items-center justify-center rounded-md border ${tc.borderStrong} ${tc.bgCard} text-zinc-500 hover:text-brand`}><Edit3 size={13} /></button>
              {tagControl(m)}
            </div>
            {tagLine(m)}
          </div>
        </div>
        <div className="flex items-center gap-2 md:block"><span className="md:hidden text-xs text-zinc-400 w-24 shrink-0">Responsáveis</span>{avatars([m.planner_id, m.editor_id, m.designer_id], true)}</div>
        <div className="flex items-center gap-2 md:block"><span className="md:hidden text-xs text-zinc-400 w-24">Status</span>{status ?? statusChip(statusOf(m).label, statusOf(m).cls)}</div>
        <div className="flex items-center gap-2 md:block"><span className="md:hidden text-xs text-zinc-400 w-24">Entrega</span>{entregaCell(m, ignoreLate)}</div>
        <div className="flex items-center gap-1.5 md:justify-end" onClick={(e) => e.stopPropagation()}>{actions}</div>
      </div>
      {below && <div className="mt-3" onClick={(e) => e.stopPropagation()}>{below}</div>}
    </div>
  );
  const openUrl = (url: string) => window.open(url.startsWith('http') ? url : `https://${url}`, '_blank', 'noopener,noreferrer');

  const navItem = (id: any, label: string, Icon: any, count?: number, badgeColor?: string) => {
    const active = activeTab === id;
    return (
      <button
        onClick={() => { setActiveTab(id); setIsMobileMenuOpen(false); }}
        className={`relative w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} py-2 px-3 rounded-[10px] text-[13.5px] font-medium transition-colors ${active ? 'bg-brand-soft text-brand dark:bg-brand/20 dark:text-brand-soft' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
        title={isSidebarCollapsed ? label : undefined}
      >
        <span className={`flex items-center gap-3 whitespace-nowrap ${isSidebarCollapsed ? 'justify-center' : ''}`}>
          <Icon size={18} className={`shrink-0 ${active ? 'text-brand dark:text-brand-soft' : 'text-zinc-400'}`} />
          {!isSidebarCollapsed && label}
        </span>
        {!isSidebarCollapsed && count && count > 0 ? <span className={`text-[11px] px-1.5 py-px rounded-md font-semibold shrink-0 ml-2 ${active ? 'bg-white text-brand' : badgeColor}`}>{count}</span> : null}
        {isSidebarCollapsed && count && count > 0 ? <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500"></div> : null}
      </button>
    );
  };

  // Item da sidebar que abre subitens (Planejamento e Relatórios)
  const navGroup = (id: 'planejamento' | 'relatorios', label: string, Icon: any, items: { id: string; label: string; dot?: string; icon?: any; count?: number; danger?: boolean; tab?: string }[], currentSub: string, totalCount?: number) => {
    // um subitem pode apontar para outra aba (ex.: Visão geral dentro de Planejamento)
    const open = activeTab === id || items.some(it => it.tab === activeTab);
    if (isSidebarCollapsed) return navItem(id, label, Icon, totalCount, 'bg-brand-soft text-brand');
    return (
      <div>
        <button
          onClick={() => { setActiveTab(id, currentSub); setIsMobileMenuOpen(false); }}
          className={`w-full flex items-center gap-3 py-2 px-3 rounded-[10px] text-[13.5px] transition-colors ${open ? 'font-semibold text-zinc-900 dark:text-zinc-100' : 'font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
        >
          <Icon size={18} className="shrink-0 text-zinc-400" />
          <span className="whitespace-nowrap">{label}</span>
          {!open && totalCount ? <span className="ml-auto text-[11px] px-1.5 py-px rounded-md font-semibold bg-brand-soft text-brand">{totalCount}</span> : null}
          <ChevronRight size={15} className={`text-zinc-400 transition-transform ${totalCount && !open ? 'ml-1' : 'ml-auto'} ${open ? 'rotate-90' : ''}`} />
        </button>
        {open && (
          <div className="ml-[19px] pl-2.5 border-l border-zinc-200 dark:border-zinc-800 mt-0.5 mb-1.5 space-y-px">
            {items.map(it => {
              const on = it.tab ? activeTab === it.tab : (activeTab === id && currentSub === it.id);
              const SubIcon = it.icon;
              return (
                <button key={it.id} onClick={() => { if (it.tab) setActiveTab(it.tab); else setActiveTab(id, it.id); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-2.5 py-1.5 px-2.5 rounded-lg text-[13px] whitespace-nowrap transition-colors ${on ? 'bg-brand-soft text-brand font-medium dark:bg-brand/20 dark:text-brand-soft' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
                  {SubIcon ? <SubIcon size={15} className={on ? 'text-brand dark:text-brand-soft' : 'text-zinc-400'} /> : <span className={`w-[7px] h-[7px] rounded-full shrink-0 ${it.dot}`} />}
                  {it.label}
                  {it.count ? <span className={`ml-auto text-[11px] px-1.5 py-px rounded-md font-semibold ${on ? 'bg-white text-brand' : it.danger ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}>{it.count}</span> : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const planCounts: Record<PlanSub, number> = {
    analise: filaAnaliseRoteiro.length,
    aprovados: filaRoteirosAprovados.length,
    decupagem: filaEmDecupagem.length,
    problemas: filaProblemasDecupagem.length,
    decupado: filaProducaoPronta.length,
    manual: 0,
  };
  const totalPlanejamento = Object.values(planCounts).reduce((a, b) => a + b, 0);

  const irParaInicio = () => { setShowArchived(false); setFiltroEtapa(null); setActiveTab('geral'); setIsMobileMenuOpen(false); setTopMenuOpen(null); };

  // ===== Busca geral: tarefas (todas as etapas) e clientes =====
  const buscaNorm = globalSearch.trim().toLowerCase();
  const buscaTarefas = buscaNorm.length < 2 ? [] : materiais
    .filter(m => m.titulo?.toLowerCase().includes(buscaNorm) || m.cliente?.nome?.toLowerCase().includes(buscaNorm) || (m.tags || []).some(t => t.toLowerCase().includes(buscaNorm)))
    .sort((a, b) => Number(a.status === 'concluido') - Number(b.status === 'concluido'))
    .slice(0, 8);
  const buscaClientes = buscaNorm.length < 2 ? [] : clientes.filter(c => c.nome.toLowerCase().includes(buscaNorm)).slice(0, 4);
  const abrirClienteNoInicio = (c: Cliente) => {
    irParaInicio();
    setExpandedClients(prev => prev.includes(`geral-${c.id}`) ? prev : [...prev, `geral-${c.id}`]);
  };
  const globalSearchBox = (extraCls = '') => (
    <div className={`relative ${extraCls}`}>
      <div className={`flex items-center gap-2 ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-100'} rounded-[10px] px-3 py-2`}>
        <Search size={15} className="text-zinc-400 shrink-0" />
        <input
          type="text"
          placeholder="Buscar tarefa, cliente ou tag..."
          value={globalSearch}
          onFocus={() => setIsGlobalSearchOpen(true)}
          onChange={e => { setGlobalSearch(e.target.value); setIsGlobalSearchOpen(true); }}
          onKeyDown={e => { if (e.key === 'Escape') { setIsGlobalSearchOpen(false); (e.target as HTMLInputElement).blur(); } }}
          className="bg-transparent outline-none text-[13px] w-full placeholder:text-zinc-400"
        />
        {globalSearch && <button type="button" aria-label="Limpar busca" onClick={() => { setGlobalSearch(''); setIsGlobalSearchOpen(false); }} className="text-zinc-400 hover:text-zinc-600"><X size={14} /></button>}
      </div>
      {isGlobalSearchOpen && buscaNorm.length >= 2 && (
        <>
          <div className="fixed inset-0 z-[150]" onClick={() => setIsGlobalSearchOpen(false)} />
          <div className={`fixed left-4 right-4 top-20 md:absolute md:left-auto md:right-0 md:top-full md:w-[420px] mt-2 ${tc.bgCard} border ${tc.borderStrong} rounded-xl shadow-xl z-[160] p-1.5 max-h-[70vh] overflow-y-auto text-left`}>
            {buscaTarefas.length === 0 && buscaClientes.length === 0 && <p className="text-[13px] text-zinc-500 px-3 py-3">Nada encontrado para “{globalSearch.trim()}”.</p>}
            {buscaClientes.length > 0 && <p className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-wider uppercase text-zinc-400">Clientes</p>}
            {buscaClientes.map(c => (
              <button key={c.id} type="button" onClick={() => { abrirClienteNoInicio(c); setIsGlobalSearchOpen(false); }} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left ${theme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}`}>
                {clientInitial(c.nome)}<span className="text-[13px] font-medium truncate">{c.nome}</span>
              </button>
            ))}
            {buscaTarefas.length > 0 && <p className="px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-wider uppercase text-zinc-400">Tarefas</p>}
            {buscaTarefas.map(m => (
              <button key={m.id} type="button" onClick={() => { openRoteiro(m); setIsGlobalSearchOpen(false); }} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left ${theme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}`}>
                <FileText size={15} className="text-zinc-400 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium truncate">{m.titulo}</span>
                  <span className="block text-xs text-zinc-500 truncate">{m.cliente?.nome || 'Sem cliente'} · Ciclo {m.ciclo || 1}</span>
                </span>
                {statusChip(statusOf(m).label, statusOf(m).cls)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );

  // ===== Menu do topo (desktop) =====
  const topLink = (id: any, label: string, Icon: any, count?: number, short?: string) => {
    const on = activeTab === id;
    return (
      <button type="button" onClick={() => { setActiveTab(id); setTopMenuOpen(null); }} title={label}
        className={`relative inline-flex items-center gap-2 px-3 py-2 rounded-[10px] text-[13.5px] font-medium whitespace-nowrap transition-colors ${on ? 'bg-brand-soft text-brand dark:bg-brand/20 dark:text-brand-soft' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
        <Icon size={17} className={on ? '' : 'text-zinc-400'} />
        <span className="hidden xl:inline">{short || label}</span>
        {count ? <span className={`text-[11px] px-1.5 py-px rounded-md font-semibold ${on ? 'bg-white text-brand' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}>{count}</span> : null}
      </button>
    );
  };
  const dropdownItem = (label: string, onClick: () => void, opts: { icon?: any; dot?: string; count?: number; on?: boolean; danger?: boolean } = {}) => (
    <button key={label} type="button" onClick={() => { onClick(); setTopMenuOpen(null); }}
      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] whitespace-nowrap transition-colors ${opts.on ? 'bg-brand-soft text-brand font-medium dark:bg-brand/20 dark:text-brand-soft' : opts.danger ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20' : `${tc.textMain} ${theme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}`}`}>
      {opts.icon ? <opts.icon size={15} className={opts.on || opts.danger ? '' : 'text-zinc-400'} /> : opts.dot ? <span className={`w-[7px] h-[7px] rounded-full shrink-0 ${opts.dot}`} /> : null}
      {label}
      {opts.count ? <span className="ml-auto pl-3 text-[11px] px-1.5 py-px rounded-md font-semibold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{opts.count}</span> : null}
    </button>
  );
  const topDropdown = (key: 'planejamento' | 'config', trigger: React.ReactNode, body: React.ReactNode, align: 'left' | 'right' = 'left') => (
    <div className="relative">
      <span onClick={() => setTopMenuOpen(topMenuOpen === key ? null : key)}>{trigger}</span>
      {topMenuOpen === key && (
        <>
          <div className="fixed inset-0 z-[150]" onClick={() => setTopMenuOpen(null)} />
          <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-2 min-w-[240px] ${tc.bgCard} border ${tc.borderStrong} rounded-xl shadow-xl z-[160] p-1.5`}>{body}</div>
        </>
      )}
    </div>
  );
  // Abas das subpáginas (Planejamento e Relatórios), mostradas no topo da página
  const subTabs = (items: { id: string; label: string; dot?: string; icon?: any; count?: number }[], current: string, go: (id: string) => void) => (
    <div className="flex gap-1 overflow-x-auto no-scrollbar mb-5 -mt-1">
      {items.map(it => {
        const on = it.id === current;
        return (
          <button key={it.id} type="button" onClick={() => go(it.id)} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] whitespace-nowrap shrink-0 transition-colors ${on ? 'bg-brand-soft text-brand font-medium dark:bg-brand/20 dark:text-brand-soft' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
            {it.icon ? <it.icon size={14} /> : it.dot ? <span className={`w-[7px] h-[7px] rounded-full ${it.dot}`} /> : null}
            {it.label}
            {it.count ? <span className={`text-[11px] px-1.5 rounded-md font-semibold ${on ? 'bg-white text-brand' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}>{it.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
  const configAtivo = ['cadastro-clientes', 'equipe', 'relatorios', 'cores-tema'].includes(activeTab);

  // ===== Configurações: uma página com abas (Clientes, Equipe, Relatórios, Cores do tema) =====
  const CONFIG_TABS: { id: typeof activeTab; label: string; icon: any }[] = [
    { id: 'cadastro-clientes', label: 'Clientes', icon: Building2 },
    { id: 'equipe', label: 'Equipe', icon: Users },
    { id: 'relatorios', label: 'Relatórios', icon: Activity },
    { id: 'cores-tema', label: 'Cores do tema', icon: Palette },
  ];
  // Mesmo formato de chamada do pageHeader: o título vira a aba ativa e meta/ações ficam na linha das abas
  const configHeader = ({ meta, actions }: { title?: string; icon?: any; iconCls?: string; meta?: string; crumb?: string; actions?: React.ReactNode }) => (
    <div className="mb-6">
      <div className="flex items-center gap-3.5 mb-5">
        <span className="w-12 h-12 rounded-xl inline-flex items-center justify-center shrink-0 bg-brand-soft text-brand"><Settings size={22} /></span>
        <div className="min-w-0">
          <h1 className="text-2xl font-medium tracking-tight">Configurações</h1>
          <p className="text-[13px] text-zinc-500 mt-0.5">Clientes, equipe, relatórios e aparência do sistema</p>
        </div>
      </div>
      <div className={`flex gap-1 overflow-x-auto no-scrollbar border-b ${tc.borderStrong}`}>
        {CONFIG_TABS.map(t => {
          const on = activeTab === t.id;
          return (
            <button key={t.id} type="button" onClick={() => setActiveTab(t.id, t.id === 'relatorios' ? relSub : undefined)}
              className={`inline-flex items-center gap-2 px-3.5 py-2.5 -mb-px border-b-2 text-[13.5px] whitespace-nowrap shrink-0 transition-colors ${on ? 'border-brand text-brand font-medium' : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}>
              <t.icon size={16} /> {t.label}
            </button>
          );
        })}
      </div>
      {(meta || actions) && (
        <div className="flex flex-col md:flex-row md:items-center gap-3 mt-5">
          {meta && <p className="text-[13px] text-zinc-500">{meta}</p>}
          {actions && <div className="md:ml-auto flex flex-wrap items-center gap-2.5">{actions}</div>}
        </div>
      )}
    </div>
  );

  return (
    <div className={`flex h-[100dvh] ${tc.bgApp} font-sans ${tc.textMain} overflow-hidden ${theme}`} suppressHydrationWarning>
      <Toaster position="top-right" richColors theme={theme} />

      {/* CABEÇALHO MOBILE */}
      <div className={`md:hidden fixed top-0 left-0 w-full z-[100] px-4 py-3 safe-pt-header-admin flex items-center justify-between gap-3 border-b ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
        <button type="button" onClick={irParaInicio} aria-label="Ir para o início" className="shrink-0">
          <img src={theme === 'dark' ? "/logo-light.png" : "/logo-dark.png"} alt="Everton" className="h-9 w-auto object-contain" />
        </button>
        {globalSearchBox('flex-1 min-w-0 max-w-[200px]')}
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} aria-label="Alternar tema" className={`w-9 h-9 inline-flex items-center justify-center rounded-[10px] ${theme === 'dark' ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-500'}`}>
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button onClick={() => { setActiveTab('solicitacao-ajustes'); setIsMobileMenuOpen(false); }} aria-label="Solicitações de ajuste" className={`relative w-9 h-9 inline-flex items-center justify-center rounded-[10px] ${theme === 'dark' ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-500'}`}>
            <Bell size={17} />
            {notificacoesAjustes.length > 0 && <span className="absolute top-1.5 right-2 w-2 h-2 bg-red-500 rounded-full"></span>}
          </button>
        </div>
      </div>

      {/* OVERLAY MOBILE */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-zinc-950/40 z-[9998] md:hidden animate-in fade-in duration-200" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* SIDEBAR */}
      {/* No computador o menu fica no topo; esta gaveta lateral é usada só no celular */}
      <aside className={`md:hidden fixed inset-y-0 left-0 w-72 ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'} border-r flex flex-col z-[9999] transform transition-all duration-300 ease-out ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
        <button
          onClick={toggleSidebar}
          aria-label={isSidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
          className={`hidden md:flex absolute -right-3 top-9 w-6 h-6 items-center justify-center rounded-full border shadow-sm z-[10000] ${theme === 'dark' ? 'bg-zinc-900 border-zinc-700 text-zinc-400' : 'bg-white border-zinc-200 text-zinc-500'} hover:text-brand`}
        >
          {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div className={`pt-6 safe-pt-aside pb-4 ${isSidebarCollapsed ? 'px-3 flex justify-center' : 'px-5'} relative`}>
          <button type="button" onClick={irParaInicio} aria-label="Ir para o início">
            <img
              src={isSidebarCollapsed ? "/icon-192x192.png" : (theme === 'dark' ? "/logo-light.png" : "/logo-dark.png")}
              alt="Everton"
              className={`${isSidebarCollapsed ? 'h-9 rounded-lg' : 'h-12'} w-auto object-contain object-left`}
            />
          </button>
          <button onClick={() => setIsMobileMenuOpen(false)} aria-label="Fechar menu" className="md:hidden absolute right-4 top-6 w-8 h-8 inline-flex items-center justify-center text-zinc-500 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
            <X size={16} />
          </button>
        </div>

        <nav className={`flex-1 ${isSidebarCollapsed ? 'px-2' : 'px-4'} space-y-0.5 overflow-y-auto pb-4 custom-scrollbar`}>
          {!isSidebarCollapsed && <p className="px-2.5 text-[11px] font-semibold text-zinc-400 tracking-wider uppercase mb-2 mt-1">Fluxo de trabalho</p>}
          {navItem('geral', 'Início', Home)}
          {navGroup('planejamento', 'Planejamento', ListTodo, PLAN_SUBS.map(s => ({ ...s, count: planCounts[s.id], danger: s.id === 'problemas' })), planSub, totalPlanejamento)}
          {navItem('materiais-aprovacao', 'Aprovação interna', ClipboardCheck, filaMateriaisAprovacao.length, 'bg-brand-soft text-brand')}
          {navItem('solicitacao-ajustes', 'Solicitação de ajustes', Bell, notificacoesAjustes.length, 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400')}
          {navItem('materiais-aprovados', 'Prontos para postar', CheckCircle2, filaMateriaisAprovados.length, 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400')}

          {!isSidebarCollapsed ? <p className="px-2.5 text-[11px] font-semibold text-zinc-400 tracking-wider uppercase mb-2 pt-5">Configurações</p> : <div className="my-3 border-t border-zinc-200 dark:border-zinc-800 mx-2" />}
          {navItem('cadastro-clientes', 'Cadastro do cliente', Users)}
          {navItem('equipe', 'Equipe', ShieldCheck)}
          {navGroup('relatorios', 'Relatórios', Activity, REL_SUBS.map(s => ({ ...s, count: s.id === 'atrasos' ? relatorioData.totalAtrasos : 0, danger: true })), relSub)}
          {navItem('cores-tema', 'Cores do tema', Palette)}
        </nav>

        {/* RODAPÉ DA SIDEBAR */}
        <div className={`p-3 border-t ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200'} flex flex-col gap-0.5 ${isSidebarCollapsed ? 'items-center' : ''}`}>
          <button onClick={toggleTheme} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : ''} gap-3 py-2 px-3 rounded-[10px] text-[13.5px] font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors`} title={isSidebarCollapsed ? (theme === 'dark' ? "Modo claro" : "Modo escuro") : undefined}>
            {theme === 'dark' ? <><Sun size={18} className="text-zinc-400" /> {!isSidebarCollapsed && "Modo claro"}</> : <><Moon size={18} className="text-zinc-400" /> {!isSidebarCollapsed && "Modo escuro"}</>}
          </button>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/'); router.refresh(); }} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : ''} gap-3 py-2 px-3 rounded-[10px] text-[13.5px] font-medium text-zinc-600 dark:text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-colors`} title={isSidebarCollapsed ? "Sair" : undefined}>
            <LogOut size={18} className="text-zinc-400" /> {!isSidebarCollapsed && "Sair"}
          </button>
        </div>
      </aside>

      {/* BARRA INFERIOR MOBILE */}
      <div className={`md:hidden fixed bottom-0 left-0 w-full ${tc.bgCard} z-[100] border-t ${tc.borderStrong} pb-[env(safe-area-inset-bottom)]`}>
        <div className="flex justify-around items-center px-2 pt-2 pb-3">
          {([
            ['geral', 'Início', Home, 0],
            ['planejamento', 'Plano', ListTodo, 0],
            ['materiais-aprovacao', 'Aprovar', ClipboardCheck, filaMateriaisAprovacao.length],
            ['materiais-aprovados', 'Prontos', CheckCircle2, filaMateriaisAprovados.length],
          ] as const).map(([id, label, Icon, count]) => {
            const on = activeTab === id && !isMobileMenuOpen;
            return (
              <button key={id} onClick={() => { setActiveTab(id); setIsMobileMenuOpen(false); }} className={`flex flex-col items-center gap-1 w-16 text-[11px] font-medium transition-colors ${on ? 'text-brand' : tc.textMuted}`}>
                <span className={`relative px-3.5 py-1 rounded-[10px] ${on ? 'bg-brand-soft' : ''}`}>
                  <Icon size={20} />
                  {count > 0 && <span className="absolute -top-1 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-semibold">{count}</span>}
                </span>
                {label}
              </button>
            );
          })}
          <button onClick={() => setIsMobileMenuOpen(true)} className={`flex flex-col items-center gap-1 w-16 text-[11px] font-medium transition-colors ${isMobileMenuOpen ? 'text-brand' : tc.textMuted}`}>
            <span className={`px-3.5 py-1 rounded-[10px] ${isMobileMenuOpen ? 'bg-brand-soft' : ''}`}><Menu size={20} /></span>
            Menu
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 h-[100dvh]">
      {/* MENU DO TOPO (computador): logo leva ao início, fluxo de trabalho, busca geral e configurações */}
      <header className={`hidden md:flex items-center gap-2 lg:gap-3 px-4 lg:px-8 h-16 shrink-0 border-b ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'} relative z-[120]`}>
        <button type="button" onClick={irParaInicio} aria-label="Ir para o início" title="Início" className="shrink-0 mr-2 lg:mr-4">
          <img src={theme === 'dark' ? "/logo-light.png" : "/logo-dark.png"} alt="Everton" className="h-9 w-auto object-contain" />
        </button>
        <nav className="flex items-center gap-0.5 min-w-0">
          {topLink('geral', 'Início', Home)}
          {topDropdown('planejamento',
            <button type="button" title="Planejamento" className={`inline-flex items-center gap-2 px-3 py-2 rounded-[10px] text-[13.5px] font-medium whitespace-nowrap transition-colors ${activeTab === 'planejamento' ? 'bg-brand-soft text-brand dark:bg-brand/20 dark:text-brand-soft' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
              <ListTodo size={17} className={activeTab === 'planejamento' ? '' : 'text-zinc-400'} />
              <span className="hidden xl:inline">Planejamento</span>
              {totalPlanejamento ? <span className={`text-[11px] px-1.5 py-px rounded-md font-semibold ${activeTab === 'planejamento' ? 'bg-white text-brand' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}>{totalPlanejamento}</span> : null}
              <ChevronDown size={14} className={`transition-transform ${topMenuOpen === 'planejamento' ? 'rotate-180' : ''}`} />
            </button>,
            PLAN_SUBS.map(s => dropdownItem(s.label, () => setActiveTab('planejamento', s.id), { dot: s.dot, count: planCounts[s.id], on: activeTab === 'planejamento' && planSub === s.id }))
          )}
          {topLink('materiais-aprovacao', 'Aprovação interna', ClipboardCheck, filaMateriaisAprovacao.length, 'Aprovação')}
          {topLink('solicitacao-ajustes', 'Solicitação de ajustes', Bell, notificacoesAjustes.length, 'Ajustes')}
          {topLink('materiais-aprovados', 'Prontos para postar', CheckCircle2, filaMateriaisAprovados.length, 'Prontos')}
        </nav>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {globalSearchBox('w-36 lg:w-56 xl:w-60 2xl:w-72')}
          {/* Configurações abre a página com abas (Clientes, Equipe, Relatórios, Cores do tema) */}
          <button type="button" onClick={() => { setActiveTab('cadastro-clientes'); setTopMenuOpen(null); }} aria-label="Configurações" title="Configurações" className={`w-9 h-9 inline-flex items-center justify-center rounded-[10px] transition-colors ${configAtivo ? 'bg-brand-soft text-brand dark:bg-brand/20 dark:text-brand-soft' : `${theme === 'dark' ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-500'} hover:text-brand`}`}>
            <Settings size={17} />
          </button>
          <button type="button" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Modo claro' : 'Modo escuro'} title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'} className={`w-9 h-9 inline-flex items-center justify-center rounded-[10px] transition-colors ${theme === 'dark' ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-500'} hover:text-brand`}>
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button type="button" onClick={async () => { await supabase.auth.signOut(); router.push('/'); router.refresh(); }} aria-label="Sair" title="Sair" className={`w-9 h-9 inline-flex items-center justify-center rounded-[10px] transition-colors ${theme === 'dark' ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-500'} hover:text-red-600`}>
            <LogOut size={17} />
          </button>
        </div>
      </header>

      <DragDropContext onDragEnd={handleDashboardDragEnd}>
        <main className={`flex-1 pt-24 safe-pt-main-admin pb-24 px-4 md:pt-8 md:pb-10 md:px-10 overflow-y-auto ${tc.bgApp}`}>
          {/* ABA: PLANEJAMENTO (cada etapa é uma subpágina escolhida na sidebar) */}
          {activeTab === 'planejamento' && (() => {
            const sub = PLAN_SUBS.find(s => s.id === planSub)!;
            const planIcons: Record<PlanSub, { icon: any; cls: string; meta: string }> = {
              analise: { icon: FileText, cls: 'bg-pink-50 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400', meta: `${qtd(filaAnaliseRoteiro.length, 'roteiro', 'roteiros')} · ${qtd(Object.keys(groupedAnaliseRoteiro).length, 'cliente', 'clientes')}` },
              aprovados: { icon: CheckCircle2, cls: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400', meta: `${qtd(filaRoteirosAprovados.length, 'roteiro', 'roteiros')} · ${qtd(Object.keys(groupedRoteiros).length, 'cliente', 'clientes')}` },
              decupagem: { icon: Folder, cls: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400', meta: `${qtd(filaEmDecupagem.length, 'tarefa', 'tarefas')} · ${qtd(Object.keys(groupedEmDecupagem).length, 'cliente', 'clientes')}` },
              problemas: { icon: AlertCircle, cls: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400', meta: `${qtd(filaProblemasDecupagem.length, 'tarefa', 'tarefas')} · ${qtd(Object.keys(groupedProblemasDecupagem).length, 'cliente', 'clientes')}` },
              decupado: { icon: Folder, cls: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400', meta: `${qtd(filaProducaoPronta.length, 'tarefa', 'tarefas')} · ${qtd(Object.keys(groupedProducao).length, 'cliente', 'clientes')}` },
              manual: { icon: LayoutList, cls: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300', meta: `${loteItens.length} ${loteItens.length === 1 ? 'item' : 'itens'}` },
            };
            const head = planIcons[planSub];
            const timelineItems = (m: Material): MoreItem[] => [
              { icon: MessageSquare, label: 'Conversa com o cliente', onClick: () => setTimelineMaterial(m) },
              { icon: List, label: 'Histórico da tarefa', onClick: () => abrirHistoricoDelegacao(m.id, m.titulo) },
            ];
            const pastaBtn = (m: Material) => m.link_organizado
              ? <IconAction icon={ExternalLink} label="Abrir pasta decupada" onClick={() => openUrl(m.link_organizado!)} />
              : m.link_bruto
                ? <IconAction icon={ExternalLink} label="Abrir pasta bruta" onClick={() => openUrl(m.link_bruto!)} />
                : <IconAction icon={ExternalLink} label="Sem pasta" disabled />;

            return (
              <div className="max-w-7xl mx-auto text-left animate-in fade-in duration-300">
                {pageHeader({
                  title: sub.label, icon: head.icon, iconCls: head.cls, meta: head.meta, crumb: 'Planejamento',
                  actions: <>
                    <IconAction icon={RefreshCw} label="Sincronizar com o ClickUp" loading={syncing} onClick={syncWithClickUp} />
                    <button onClick={() => setIsImportModalOpen(true)} className={btnInk}><Download size={16} /> Importar do ClickUp</button>
                  </>,
                })}
                {subTabs(PLAN_SUBS.map(s => ({ ...s, count: planCounts[s.id] })), planSub, (id) => setActiveTab('planejamento', id))}

                {/* ROTEIROS EM ANÁLISE */}
                {planSub === 'analise' && (Object.keys(groupedAnaliseRoteiro).length === 0 ? emptyState('Nenhum roteiro aguardando análise.') : (
                  <div className="space-y-4">
                    {Object.entries(groupedAnaliseRoteiro).map(([clienteId, group]) => clientGroup(`analise-${clienteId}`, group.cliente.nome, qtd(countItens(group), 'roteiro', 'roteiros'), (
                      Object.entries(group.ciclos).map(([cicloLabel, data]: [string, any]) => (
                        <div key={`analise-ciclo-${cicloLabel}`}>
                          {cicloBar(cicloLabel, <IconAction icon={SendHorizontal} variant="soft" label="Enviar lote para o cliente" loading={loading} onClick={() => handleEnviarLoteRoteiroCliente(data.itens)} />)}
                          {taskHead()}
                          <Droppable droppableId={`analise___${clienteId}___${cicloLabel}`}>
                            {(provided) => (
                              <div ref={provided.innerRef} {...provided.droppableProps}>
                                {data.itens.map((m: Material, idx: number) => (
                                  <Draggable key={m.id} draggableId={m.id} index={idx}>
                                    {(dp, snapshot) => taskRow({
                                      m, drag: { provided: dp, snapshot },
                                      actions: <IconAction icon={Send} variant="ink" label="Enviar para o cliente" loading={actionLoading === m.id} onClick={() => handleEnviarRoteiroCliente(m)} />,
                                    })}
                                  </Draggable>
                                ))}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        </div>
                      ))
                    ), 'bg-pink-500'))}
                  </div>
                ))}

                {/* ROTEIROS APROVADOS */}
                {planSub === 'aprovados' && (Object.keys(groupedRoteiros).length === 0 ? emptyState('Nenhum roteiro aprovado aguardando delegação.') : (
                  <div className="space-y-4">
                    {Object.entries(groupedRoteiros).map(([clienteId, group]) => clientGroup(`rot-${clienteId}`, group.cliente.nome, qtd(countItens(group), 'roteiro', 'roteiros'), (
                      Object.entries(group.ciclos).map(([cicloLabel, data]: [string, any]) => {
                        const delegar = (ids: string[]) => { setDelegationType('planner'); setSelectedCicloDelegation({ clienteId, ciclo: cicloLabel, itens: data.itens, clienteNome: group.cliente.nome }); setSelectedItemsToDelegate(ids); setNewLinkBruto(data.itens.find((i: any) => i.link_bruto)?.link_bruto || ''); setDelegationDeadline(''); setDelegationDeadlineEditor(''); setDelegationDeadlineDesigner(''); setIsDelegateModalOpen(true); };
                        return (
                          <div key={`rot-ciclo-${cicloLabel}`}>
                            {cicloBar(cicloLabel, <IconAction icon={Users} variant="soft" label="Delegar todos para o decupador" onClick={() => delegar(data.itens.map((i: any) => i.id))} />)}
                            {taskHead()}
                            <Droppable droppableId={`aprovado___${clienteId}___${cicloLabel}`}>
                              {(provided) => (
                                <div ref={provided.innerRef} {...provided.droppableProps}>
                                  {data.itens.map((m: Material, idx: number) => (
                                    <Draggable key={m.id} draggableId={m.id} index={idx}>
                                      {(dp, snapshot) => taskRow({
                                        m, drag: { provided: dp, snapshot },
                                        status: m.link_bruto ? statusChip('Pronto para decupar', STATUS_INFO.aprovado.cls) : statusChip('Aguardando link bruto', STATUS_INFO.planejamento.cls),
                                        actions: <>
                                          <IconAction icon={Link} variant={m.link_bruto ? 'done' : 'line'} label={m.link_bruto ? 'Link bruto adicionado' : 'Adicionar link bruto'} onClick={() => { setSelectedMaterial(m); setNewLinkBruto(m.link_bruto || ''); setIsLinkBrutoModalOpen(true); }} />
                                          <IconAction icon={UserPlus} variant="ink" label="Delegar para o decupador" onClick={() => delegar([m.id])} />
                                        </>,
                                      })}
                                    </Draggable>
                                  ))}
                                  {provided.placeholder}
                                </div>
                              )}
                            </Droppable>
                          </div>
                        );
                      })
                    ), 'bg-orange-500'))}
                  </div>
                ))}

                {/* EM DECUPAGEM */}
                {planSub === 'decupagem' && (Object.keys(groupedEmDecupagem).length === 0 ? emptyState('Nenhuma tarefa com o decupador no momento.') : (
                  <div className="space-y-4">
                    {Object.entries(groupedEmDecupagem).map(([clienteId, group]) => clientGroup(`emdec-${clienteId}`, group.cliente.nome, qtd(countItens(group), 'tarefa', 'tarefas'), (
                      Object.entries(group.ciclos).map(([cicloLabel, data]: [string, any]) => (
                        <div key={`emdec-ciclo-${cicloLabel}`}>
                          {cicloBar(cicloLabel)}
                          {taskHead()}
                          {data.itens.map((m: Material) => taskRow({
                            m,
                            status: !m.link_bruto ? statusChip('Falta link bruto', STATUS_INFO.faltando_material.cls) : statusChip(m.planner_id ? `Com ${membros.find(mb => mb.id === m.planner_id)?.nome?.split(' ')[0] || 'o decupador'}` : 'Com o decupador', STATUS_INFO.em_organizacao.cls),
                            actions: <>
                              {m.link_bruto
                                ? pastaBtn(m)
                                : <IconAction icon={Link} variant="ink" label="Adicionar link bruto" onClick={() => { setSelectedMaterial(m); setNewLinkBruto(''); setIsLinkBrutoModalOpen(true); }} />}
                              {moreMenu(`dec-${m.id}`, [
                                ...timelineItems(m),
                                !!m.link_bruto && { icon: Link, label: 'Editar link bruto', onClick: () => { setSelectedMaterial(m); setNewLinkBruto(m.link_bruto || ''); setIsLinkBrutoModalOpen(true); } },
                                { icon: RotateCcw, label: 'Devolver para aprovados', onClick: () => openResolveModal(m, 'planner') },
                                !!m.planner_id && { icon: X, label: 'Cancelar delegação', onClick: () => handleCancelarDelegacaoDecupagem(m), danger: true },
                              ])}
                            </>,
                          }))}
                        </div>
                      ))
                    ), 'bg-blue-500'))}
                  </div>
                ))}

                {/* PROBLEMAS */}
                {planSub === 'problemas' && (Object.keys(groupedProblemasDecupagem).length === 0 ? emptyState('Nenhum problema reportado pelo decupador.') : (
                  <div className="space-y-4">
                    {Object.entries(groupedProblemasDecupagem).map(([clienteId, group]) => clientGroup(`prob-${clienteId}`, group.cliente.nome, qtd(countItens(group), 'tarefa', 'tarefas'), (
                      Object.entries(group.ciclos).map(([cicloLabel, data]: [string, any]) => (
                        <div key={`prob-ciclo-${cicloLabel}`}>
                          {cicloBar(cicloLabel)}
                          {taskHead()}
                          {data.itens.map((m: Material) => {
                            const author = getAuthorInfo(m.feedback);
                            const feedbacks = m.feedback ? m.feedback.split('\n\n').map((f: string) => f.replace(/\[ID:.*?\]/g, '').trim()).filter(Boolean) : [];
                            return taskRow({
                              m,
                              actions: <>
                                <IconAction icon={CheckCircle2} variant="ink" label="Resolver problema" onClick={() => openResolveModal(m)} />
                                {moreMenu(`prob-${m.id}`, [
                                  ...timelineItems(m),
                                  { icon: Archive, label: 'Arquivar tarefa', disabled: actionLoading === m.id, onClick: () => openConfirm('Arquivar tarefa', 'Deseja arquivar esta tarefa?', async () => { setActionLoading(m.id); await supabase.from('materiais').update({ status: 'concluido' }).eq('id', m.id); loadData(); setActionLoading(null); }, 'warning') },
                                ])}
                              </>,
                              below: (
                                <div className={`p-3 rounded-lg text-[13px] ${theme === 'dark' ? 'bg-red-900/20 text-red-300' : 'bg-red-50 text-red-700'}`}>
                                  {author && <div className="text-xs text-zinc-500 mb-1">Reportado por <span className="font-medium text-brand">{author.nome}</span> ({author.role})</div>}
                                  {feedbacks.length > 0 ? feedbacks.map((fb: string, idx: number) => (
                                    <div key={idx} className={`whitespace-pre-wrap ${idx > 0 ? 'opacity-70 pt-2 mt-2 border-t border-red-200 dark:border-red-900/50' : ''}`}>{renderTextWithLinks(fb)}</div>
                                  )) : 'Motivo não informado.'}
                                </div>
                              ),
                            });
                          })}
                        </div>
                      ))
                    ), 'bg-red-500'))}
                  </div>
                ))}

                {/* MATERIAL DECUPADO */}
                {planSub === 'decupado' && (Object.keys(groupedProducao).length === 0 ? emptyState('Nenhuma pasta organizada pendente.') : (
                  <div className="space-y-4">
                    {Object.entries(groupedProducao).map(([clienteId, group]) => clientGroup(`prod-${clienteId}`, group.cliente.nome, qtd(countItens(group), 'tarefa', 'tarefas'), (
                      Object.entries(group.ciclos).map(([cicloLabel, data]: [string, any]) => (
                        <div key={`prod-ciclo-${cicloLabel}`}>
                          {cicloBar(cicloLabel, <IconAction icon={Users} variant="soft" label="Delegar todos para editor e designer" onClick={() => { setDelegationType('editor'); setSelectedCicloDelegation({ clienteId, ciclo: cicloLabel, itens: data.itens, clienteNome: group.cliente.nome }); setSelectedItemsToDelegate(data.itens.map((i: any) => i.id)); setDelegationDeadline(''); setDelegationDeadlineEditor(''); setDelegationDeadlineDesigner(''); setIsDelegateModalOpen(true); }} />)}
                          {taskHead()}
                          {data.itens.map((m: Material) => taskRow({
                            m,
                            status: statusChip('Drive pronto', STATUS_INFO.organizado.cls),
                            actions: <>
                              {pastaBtn(m)}
                              {moreMenu(`prod-${m.id}`, [
                                ...timelineItems(m),
                                { icon: Link, label: 'Editar link da pasta', onClick: () => { setSelectedMaterial(m); setNewLinkBruto(m.link_bruto || ''); setIsLinkBrutoModalOpen(true); } },
                                { icon: RotateCcw, label: 'Devolver ao decupador', onClick: () => openResolveModal(m, 'planner') },
                              ])}
                            </>,
                          }))}
                        </div>
                      ))
                    ), 'bg-purple-500'))}
                  </div>
                ))}

                {/* CRIAÇÃO MANUAL */}
                {planSub === 'manual' && (
                  <div className={`${tc.bgCard} border ${tc.borderStrong} rounded-2xl p-5 md:p-6 space-y-6`}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5"><label className="text-[13px] font-medium text-zinc-600 dark:text-zinc-300">Cliente</label><select className={`w-full px-3 py-2.5 ${tc.bgCard} border ${tc.borderStrong} rounded-[10px] outline-none text-sm focus:border-brand`} value={loteForm.cliente_id} onChange={e => setLoteForm({ ...loteForm, cliente_id: e.target.value })} required><option value="">Selecionar...</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
                      <div className="space-y-1.5"><label className="text-[13px] font-medium text-zinc-600 dark:text-zinc-300">Ciclo</label><input type="number" min="1" max="12" className={`w-full px-3 py-2.5 ${tc.bgCard} border ${tc.borderStrong} rounded-[10px] outline-none text-sm focus:border-brand`} value={loteForm.ciclo} onChange={e => setLoteForm({ ...loteForm, ciclo: e.target.value })} required /></div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center"><h3 className="text-sm font-semibold">Roteiros ({loteItens.length})</h3><button type="button" onClick={adicionarItemLote} className={btnLine}><Plus size={15} /> Adicionar item</button></div>
                      {loteItens.map((item, index) => (
                        <div key={item.id} className={`p-4 border ${tc.borderStrong} rounded-xl flex flex-col md:flex-row gap-4`}>
                          <span className="w-6 h-6 rounded-full bg-brand-soft text-brand text-xs font-semibold inline-flex items-center justify-center shrink-0">{index + 1}</span>
                          <div className="w-full md:w-1/3 space-y-1.5"><label className="text-[13px] font-medium text-zinc-600 dark:text-zinc-300">Título</label><input className={`w-full px-3 py-2.5 ${tc.bgInput} border ${tc.borderStrong} rounded-[10px] outline-none text-sm focus:border-brand`} placeholder="Ex.: Reels 01" value={item.titulo} onChange={e => atualizarItemLote(item.id, 'titulo', e.target.value)} /></div>
                          <div className="flex-1 space-y-1.5">
                            <label className="text-[13px] font-medium text-zinc-600 dark:text-zinc-300">Roteiro / instrução</label>
                            <div className="flex gap-2"><textarea className={`w-full px-3 py-2.5 ${tc.bgInput} border ${tc.borderStrong} rounded-[10px] outline-none text-sm resize-none focus:border-brand min-h-[80px]`} placeholder="Escreva o roteiro aqui..." value={item.roteiro} onChange={e => atualizarItemLote(item.id, 'roteiro', e.target.value)} />{loteItens.length > 1 && <IconAction icon={Trash2} label="Remover item" onClick={() => removerItemLote(item.id)} />}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end pt-2">
                      <button onClick={criarLoteProducao} disabled={loading} className={btnInk}>{loading ? <><Loader2 size={16} className="animate-spin" /> Processando...</> : <><Send size={16} /> Salvar e enviar para análise</>}</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ABA: MATERIAIS PARA APROVAÇÃO (Aprovação interna) */}
          {activeTab === 'materiais-aprovacao' && (
            <div className="max-w-7xl mx-auto text-left animate-in fade-in duration-300">
              {pageHeader({ title: 'Aprovação interna', icon: ClipboardCheck, meta: `${qtd(filaMateriaisAprovacao.length, 'material', 'materiais')} · ${qtd(Object.keys(groupedMateriaisAprovacao).length, 'cliente', 'clientes')}` })}
              {Object.keys(groupedMateriaisAprovacao).length === 0 ? emptyState('Nenhum material aguardando aprovação.') : (
                <div className="space-y-4">
                  {Object.entries(groupedMateriaisAprovacao).map(([clienteId, group]) => clientGroup(`rev-${clienteId}`, group.cliente.nome, qtd(countItens(group), 'material', 'materiais'), (
                    Object.entries(group.ciclos).map(([cicloLabel, data]: [string, any]) => (
                      <div key={`rev-ciclo-${cicloLabel}`}>
                        {cicloBar(cicloLabel, <IconAction icon={CheckCheck} variant="soft" label="Aprovar lote para o cliente" loading={loading} onClick={() => { setBatchApprovalData({ itens: data.itens, cicloLabel }); setBatchScheduleDate(''); }} />)}
                        {taskHead()}
                        {data.itens.map((m: Material) => {
                          const isPartial = m.status === 'em_edicao' || m.status === 'ajustes';
                          const agendado = !!m.agendado_para && !m.wpp_enviado;
                          const pedirAjuste = () => { setDelegationType('editor'); setSelectedCicloDelegation({ clienteId: m.cliente_id, ciclo: m.ciclo?.toString() || '1', itens: [m], clienteNome: m.cliente?.nome || '' }); setSelectedItemsToDelegate([m.id]); setSelectedEditorId(m.editor_id || ''); setSelectedDesignerId(m.designer_id || ''); setDelegationDeadline(m.data_limite || ''); setDelegationDeadlineEditor(m.data_limite_editor || m.data_limite || ''); setDelegationDeadlineDesigner(m.data_limite_designer || m.data_limite || ''); setIsDelegateModalOpen(true); };
                          return taskRow({
                            m,
                            lead: mediaThumbs(m, true),
                            status: agendado
                              ? <span title={`Agendado para ${new Date(m.agendado_para!).toLocaleString('pt-BR')}`}>{statusChip(`Agendado ${new Date(m.agendado_para!).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`, 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400')}</span>
                              : statusChip(isPartial ? 'Entrega parcial' : 'Edição pronta', isPartial ? STATUS_INFO.roteiro_aprovado.cls : STATUS_INFO.revisao.cls),
                            actions: <>
                              {!agendado && <IconAction icon={RotateCcw} label="Pedir ajuste" onClick={pedirAjuste} />}
                              <IconAction icon={agendado ? Send : CheckCircle2} variant="ink" label={agendado ? 'Enviar agora' : 'Aprovar'} loading={actionLoading === m.id} onClick={() => handleCheckAndAprovar(m)} />
                              {moreMenu(`rev-${m.id}`, [
                                { icon: MessageSquare, label: 'Conversa com o cliente', onClick: () => setTimelineMaterial(m) },
                                { icon: List, label: 'Histórico da tarefa', onClick: () => abrirHistoricoDelegacao(m.id, m.titulo) },
                                agendado && { icon: RotateCcw, label: 'Pedir ajuste', onClick: pedirAjuste },
                                agendado && { icon: X, label: 'Cancelar agendamento', disabled: actionLoading === m.id, onClick: () => handleCancelarAgendamento(m.id), danger: true },
                              ])}
                            </>,
                          });
                        })}
                      </div>
                    ))
                  ), 'bg-purple-500'))}
                </div>
              )}
            </div>
          )}

          {/* ABA: SOLICITAÇÃO DE AJUSTES */}
          {activeTab === 'solicitacao-ajustes' && (
            <div className="max-w-7xl mx-auto text-left animate-in fade-in duration-300">
              {pageHeader({ title: 'Solicitação de ajustes', icon: Bell, iconCls: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400', meta: `${qtd(notificacoesAjustes.length, 'pedido', 'pedidos')} · ${qtd(Object.keys(groupedAjustes).length, 'cliente', 'clientes')}` })}
              {Object.keys(groupedAjustes).length === 0 ? emptyState('Nenhum pedido de ajuste pendente.') : (
                <div className="space-y-4">
                  {Object.entries(groupedAjustes).map(([clienteId, group]) => clientGroup(`notif-${clienteId}`, group.cliente.nome, qtd(countItens(group), 'pedido', 'pedidos'), (
                    Object.entries(group.ciclos).map(([cicloLabel, data]: [string, any]) => (
                      <div key={`notif-ciclo-${cicloLabel}`}>
                        {cicloBar(cicloLabel)}
                        {taskHead()}
                        {data.itens.map((m: Material) => {
                          const planejamentoAjuste = !m.link_drive && !m.link_capa;
                          const author = getAuthorInfo(m.feedback);
                          const feedbacks = m.feedback ? m.feedback.split('\n\n').map(f => f.replace(/\[ID:.*?\]/g, '').trim()).filter(Boolean) : [];
                          const delegado = (m.tags || []).includes('_ajuste_delegado');
                          return taskRow({
                            m,
                            status: statusChip(planejamentoAjuste ? 'Ajuste de planejamento' : 'Ajuste de produção', planejamentoAjuste ? STATUS_INFO.roteiro_aprovado.cls : STATUS_INFO.ajustes.cls),
                            actions: <>
                              {moreMenu(`aj-${m.id}`, [
                                { icon: MessageSquare, label: 'Conversa com o cliente', onClick: () => setTimelineMaterial(m) },
                                { icon: List, label: 'Histórico da tarefa', onClick: () => abrirHistoricoDelegacao(m.id, m.titulo) },
                                !!m.link_drive && { icon: FileVideo, label: 'Ver vídeo enviado', onClick: () => setPreviewUrl(m.link_drive || null) },
                                !!m.link_capa && { icon: ImageIcon, label: 'Ver capa enviada', onClick: () => setPreviewUrl(m.link_capa || null) },
                              ])}
                              {planejamentoAjuste ? (
                                <IconAction icon={Send} variant="ink" label="Reenviar roteiro para o cliente" loading={actionLoading === m.id} onClick={() => handleReenviarRoteiroAjustado(m)} />
                              ) : delegado ? (
                                <IconAction icon={X} label={`Cancelar delegação (${membros.find(mb => mb.id === (m.editor_id || m.designer_id))?.nome || 'equipe'})`} onClick={() => handleCancelarDelegacaoAjuste(m)} />
                              ) : (
                                <IconAction icon={UserPlus} variant="ink" label="Delegar ajuste" onClick={() => { setDelegationType('editor'); setSelectedCicloDelegation({ clienteId: m.cliente_id, ciclo: m.ciclo?.toString() || '1', itens: [m], clienteNome: m.cliente?.nome || '' }); setSelectedItemsToDelegate([m.id]); setSelectedEditorId(m.editor_id || ''); setSelectedDesignerId(m.designer_id || ''); setDelegationDeadline(m.data_limite || ''); setDelegationDeadlineEditor(m.data_limite_editor || m.data_limite || ''); setDelegationDeadlineDesigner(m.data_limite_designer || m.data_limite || ''); setIsDelegateModalOpen(true); }} />
                              )}
                            </>,
                            below: (
                              <div className="space-y-2">
                                {delegado && <span className="inline-flex text-xs font-medium px-2 py-0.5 rounded-md bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400">Delegado para {membros.find(mb => mb.id === (m.editor_id || m.designer_id))?.nome || 'equipe'}</span>}
                                {/* Último pedido do cliente; o histórico inteiro (com fotos e áudios) fica na conversa */}
                                {(() => {
                                  const ultimo = feedbacks[0];
                                  const data = ultimo ? /\[DATE:(.*?)\]/.exec(ultimo)?.[1] : null;
                                  const texto = ultimo ? ultimo.replace(/\[DATE:.*?\]/g, '').trim() : '';
                                  return (
                                    <div className="flex items-end gap-3 flex-wrap">
                                      {texto ? (
                                        <div className="max-w-[85%] min-w-0">
                                          <div className="text-xs text-zinc-500 mb-1">{author ? `${author.nome} · ${author.role}` : (m.cliente?.nome || 'Cliente')}{data ? ` · ${data}` : ''}</div>
                                          <div className={`px-3 py-2 rounded-2xl rounded-bl-sm text-[13px] whitespace-pre-wrap break-words ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-100'}`}>{renderTextWithLinks(texto)}</div>
                                        </div>
                                      ) : <p className="text-xs text-zinc-400">O pedido está na conversa (pode ser foto ou áudio).</p>}
                                      <button type="button" onClick={() => setTimelineMaterial(m)} className={`${btnLine} !py-1.5 !px-3 !text-xs`}>
                                        <MessageSquare size={14} /> {feedbacks.length > 1 ? `Abrir conversa (${feedbacks.length} pedidos)` : 'Abrir conversa'}
                                        {(msgsNaoLidas[m.id] || 0) > 0 && <span className="w-1.5 h-1.5 rounded-full bg-brand" />}
                                      </button>
                                    </div>
                                  );
                                })()}
                              </div>
                            ),
                          });
                        })}
                      </div>
                    ))
                  ), 'bg-red-500'))}
                </div>
              )}
            </div>
          )}

          {/* ABA: MATERIAIS APROVADOS */}
          {activeTab === 'materiais-aprovados' && (
            <div className="max-w-7xl mx-auto text-left animate-in fade-in duration-300">
              {pageHeader({ title: 'Prontos para postar', icon: CheckCircle2, iconCls: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400', meta: `${qtd(filaMateriaisAprovados.length, 'material', 'materiais')} · ${qtd(Object.keys(groupedMateriaisAprovados).length, 'cliente', 'clientes')}` })}
              {Object.keys(groupedMateriaisAprovados).length === 0 ? emptyState('Nenhum material aprovado pendente de publicação.') : (
                <div className="space-y-4">
                  {Object.entries(groupedMateriaisAprovados).map(([clienteId, group]) => clientGroup(`ok-${clienteId}`, group.cliente.nome, qtd(countItens(group), 'material', 'materiais'), (
                    Object.entries(group.ciclos).map(([cicloLabel, data]: [string, any]) => (
                      <div key={`ok-ciclo-${cicloLabel}`}>
                        {cicloBar(cicloLabel)}
                        {taskHead()}
                        {data.itens.map((m: Material) => taskRow({
                          m, ignoreLate: true,
                          lead: mediaThumbs(m),
                          status: statusChip('Pronto para postar', STATUS_INFO.aprovado.cls),
                          actions: <>
                            <IconAction icon={Archive} variant="ink" label="Marcar como postado e arquivar" loading={actionLoading === m.id} onClick={() => openConfirm('Arquivar e finalizar', 'Deseja marcar como postado e arquivar?', async () => { setActionLoading(m.id); await supabase.from('materiais').update({ status: 'concluido' }).eq('id', m.id); loadData(); setActionLoading(null); }, 'warning')} />
                            {moreMenu(`ok-${m.id}`, [
                              { icon: MessageSquare, label: 'Conversa com o cliente', onClick: () => setTimelineMaterial(m) },
                              { icon: List, label: 'Histórico da tarefa', onClick: () => abrirHistoricoDelegacao(m.id, m.titulo) },
                            ])}
                          </>,
                        }))}
                      </div>
                    ))
                  ), 'bg-green-500'))}
                </div>
              )}
            </div>
          )}

          {/* ABA: VISÃO GERAL */}
          {activeTab === 'geral' && (
            <div className="max-w-7xl mx-auto space-y-5 text-left animate-in fade-in duration-300">
              {pageHeader({
                title: showArchived ? 'Arquivo' : 'Início', icon: showArchived ? Archive : Home,
                meta: `${qtd(Object.keys(groupedVisaoGeral).length, 'cliente', 'clientes')} ${showArchived ? 'com materiais arquivados' : 'ativos'}`,
              })}

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                {[
                  { label: 'Pendentes', val: metrics.pendentes, icon: Clock, cls: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400', go: () => filtrarInicio('pendentes'), dica: 'Ver o que está pendente com o cliente' },
                  { label: 'Ajustes', val: metrics.ajustes, icon: MessageSquare, cls: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400', go: () => irParaPaginaEtapa('ajustes'), dica: 'Ver os pedidos de ajuste' },
                  { label: 'Aprovados', val: metrics.aprovados, icon: CheckCircle, cls: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400', go: () => filtrarInicio('aprovados'), dica: 'Ver os itens aprovados' },
                  { label: 'Eficiência', val: `${metrics.eficiencia}%`, icon: TrendingUp, cls: 'bg-brand-soft text-brand', go: () => setActiveTab('relatorios'), dica: 'Abrir relatórios' },
                ].map((m, i) => (
                  <button key={i} type="button" onClick={m.go} title={m.dica} className={`group/card ${tc.bgCard} px-3.5 py-2.5 rounded-xl border ${tc.borderStrong} flex items-center gap-2.5 text-left transition-colors hover:border-brand/50 ${theme === 'dark' ? 'hover:bg-zinc-800/60' : 'hover:bg-zinc-50'}`}>
                    <span className={`w-7 h-7 rounded-lg inline-flex items-center justify-center shrink-0 ${m.cls}`}><m.icon size={15} /></span>
                    <span className="text-[13px] text-zinc-500">{m.label}</span>
                    <span className="ml-auto text-lg font-semibold leading-none">{m.val}</span>
                    <ChevronRight size={15} className="-mr-1 text-zinc-300 group-hover/card:text-brand transition-colors shrink-0" />
                  </button>
                ))}
              </div>

              {/* FLUXO OPERACIONAL: etapas em sequência; clique leva para a página da etapa */}
              {/* Etapas em uma faixa fina, sem caixa de gargalo */}
              <div className={`${tc.bgCard} px-2 py-1.5 rounded-xl border ${tc.borderStrong} flex gap-1 overflow-x-auto no-scrollbar`}>
                {pipeline.map((node) => {
                  const target: Record<string, () => void> = {
                    roteiro: () => filtrarInicio('roteiros'),
                    decupagem: () => filtrarInicio('decupagem'),
                    producao: () => filtrarInicio('producao'),
                    revisao: () => irParaPaginaEtapa('aprovacao'),
                    cliente: () => filtrarInicio('portal'),
                    ajustes: () => irParaPaginaEtapa('ajustes'),
                    aprovado: () => filtrarInicio('aprovados'),
                  };
                  const go = target[node.id];
                  return (
                    <button key={node.id} type="button" disabled={!go} onClick={() => go?.()} title={go ? `Ver ${node.label.toLowerCase()}` : undefined} className={`flex-1 min-w-[120px] flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors ${go ? (theme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100') : 'cursor-default'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${node.bg}`} />
                      <span className="text-[13px] whitespace-nowrap">{node.label}</span>
                      <span className={`ml-auto text-[13px] font-semibold ${node.color}`}>{node.count}</span>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-4">
                {showArchived && <StorageWidget materiais={materiais} theme={theme} />}

                {/* FILTROS RÁPIDOS + BUSCA */}
                <div id="lista-inicio" className="flex flex-col md:flex-row md:items-center gap-3 scroll-mt-24">
                  <h2 className="text-lg font-semibold">{showArchived ? 'Concluídas' : 'Fluxo de aprovação'}</h2>
                  {!showArchived && filtroEtapa && (
                    <span className="inline-flex items-center gap-1.5 self-start md:self-auto h-7 pl-2.5 pr-1 rounded-full text-[12.5px] font-medium bg-brand-soft text-brand dark:bg-brand/20 dark:text-brand-soft">
                      {filtroEtapa.label}{filtroEtapa.clienteId ? ` · ${clientes.find(c => c.id === filtroEtapa.clienteId)?.nome || 'cliente'}` : ''}
                      <button type="button" onClick={() => setFiltroEtapa(null)} title="Mostrar tudo de novo" aria-label="Limpar filtro" className="w-5 h-5 inline-flex items-center justify-center rounded-full hover:bg-brand/15"><X size={13} /></button>
                    </span>
                  )}
                  {/* Filtros por prazo, como no Pautta. "Concluídas" mostra os materiais arquivados/finalizados. */}
                  <div className={`flex gap-0.5 p-1 rounded-xl overflow-x-auto no-scrollbar md:ml-auto ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
                    {[
                      { id: 'todos', label: 'Todos', icon: List },
                      { id: 'hoje', label: 'Para hoje', icon: Calendar },
                      { id: 'atrasadas', label: 'Atrasadas', icon: Flame },
                      { id: 'futuras', label: 'Futuras', icon: Clock },
                      { id: 'concluidas', label: 'Concluídas', icon: CheckCircle2 },
                    ].map(f => {
                      const on = f.id === 'concluidas' ? showArchived : (!showArchived && activeFilter === f.id);
                      return (
                        <button key={f.id} type="button" aria-pressed={on}
                          title={f.id === 'concluidas' ? 'Materiais arquivados / finalizados' : undefined}
                          onClick={() => { if (f.id === 'concluidas') { setShowArchived(true); setActiveFilter('todos'); } else { setShowArchived(false); setActiveFilter(f.id); if (f.id === 'todos') setFiltroEtapa(null); } }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium shrink-0 transition-colors ${on ? `${tc.bgCard} text-brand shadow-sm` : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}>
                          <f.icon size={14} />{f.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className={`${tc.bgCard} border rounded-2xl overflow-hidden ${tc.borderStrong} transition-colors`}>
                  {Object.keys(groupedVisaoGeral).length > 0 && pipelineHead()}
                  <div className={`divide-y ${theme === 'dark' ? 'divide-zinc-800' : 'divide-zinc-100'} text-left`}>
                    {Object.entries(groupedVisaoGeral).map(([clienteId, group]) => {
                      const contagem = countPipeline(Object.values(group.ciclos).flatMap((c: any) => c.itens as Material[]));
                      return (
                        <div key={`geral-${clienteId}`} className={`group border-b ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-50'} last:border-0`}>
                          <div className={`w-full flex flex-col md:flex-row md:items-center gap-1.5 md:gap-4 px-5 py-3.5 ${theme === 'dark' ? 'hover:bg-zinc-800/60' : 'hover:bg-zinc-50'} cursor-pointer transition-colors`} onClick={() => toggleClient(`geral-${clienteId}`)}>
                            <div className="flex items-center flex-1 min-w-0">
                              <ChevronRight className={`shrink-0 text-zinc-400 transition-transform ${expandedClients.includes(`geral-${clienteId}`) ? 'rotate-90' : ''}`} size={18} />
                              <span className="mx-2.5 shrink-0">{clientInitial(group.cliente?.nome)}</span>
                              <span className="text-[15px] font-semibold truncate">{group.cliente?.nome}</span>
                            </div>
                            {pipelineCols(contagem, clienteId)}
                            {pipelineInline(contagem, 'md:hidden ml-[66px]', clienteId)}
                          </div>
                          {expandedClients.includes(`geral-${clienteId}`) && (
                            <div className={`${tc.bgHighlight} pb-4`}>
                              {Object.entries(group.ciclos).map(([cicloLabel, data]: [string, any]) => {
                                const contagemCiclo = countPipeline(data.itens);
                                return (
                                  <div key={`geral-ciclo-${cicloLabel}`} className="px-3 md:px-6 pt-2">
                                    <div className={`w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 px-4 ${tc.bgHover} rounded-2xl border border-transparent ${theme === 'dark' ? 'hover:border-zinc-800' : 'hover:border-zinc-100'} mb-1 transition-colors`}>
                                      <div className="flex items-center gap-2 cursor-pointer flex-1 flex-wrap" onClick={() => toggleCiclo(clienteId, cicloLabel)}>
                                        <ChevronRight size={16} className={`${textSecundario} transition-transform ${expandedCiclos.includes(`${clienteId}-${cicloLabel}`) ? 'rotate-90' : ''}`} />
                                        <Calendar size={16} className="text-blue-500 shrink-0" />
                                        <span className={`text-[12px] font-semibold   truncate ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-600'}`}>{fmtCiclo(cicloLabel)}</span>
                                        <span className={`text-[11px] font-semibold  shrink-0 px-1 ${textSecundario}`}>{data.aprovados}/{data.total} ok</span>

                                        {pipelineInline(contagemCiclo, 'ml-2')}
                                      </div>

                                      {!showArchived && (
                                        <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                                          {/* Envia uma mensagem no WhatsApp do cliente avisando que há novidades no portal; pede confirmação antes */}
                                          <IconAction icon={Send} label="Avisar o cliente no WhatsApp que há novidades no portal" onClick={() => openConfirm('Avisar cliente no WhatsApp', `Vamos enviar uma mensagem para ${group.cliente?.nome || 'o cliente'} avisando que há atualizações no ${fmtCiclo(cicloLabel)}, com o link do portal. Enviar agora?`, () => handleAvisarCicloWhatsApp(group.cliente, cicloLabel), 'warning')} />
                                          <IconAction icon={Archive} label="Arquivar o ciclo inteiro" onClick={() => { setCycleToArchive({ itens: data.itens, cicloLabel }); setIsArchiveCycleModalOpen(true); }} />
                                        </div>
                                      )}
                                    </div>

                                    {expandedCiclos.includes(`${clienteId}-${cicloLabel}`) && (
                                      <Droppable droppableId={`visaogeral___${clienteId}___${cicloLabel}`}>
                                        {(provided) => (
                                          <div ref={provided.innerRef} {...provided.droppableProps} className="pl-2 md:pl-10 pr-1 md:pr-2 py-2">
                                            {taskHead()}
                                            {data.itens.map((m: Material, idx: number) => (
                                              <Draggable key={m.id} draggableId={m.id} index={idx}>
                                                {(dp, snapshot) => {
                                                  const editarInstrucao = () => {
                                                    setMaterialToEditInstruction(m);
                                                    const text = m.feedback_admin ? m.feedback_admin.replace(/\[ID:[^\]]+\]/g, '').trim() : '';
                                                    const editorText = Array.from(text.matchAll(/\[EDITOR\]([\s\S]*?)\[\/EDITOR\]/g)).map(x => x[1].trim()).join("\n\n---\n\n");
                                                    const designerText = Array.from(text.matchAll(/\[DESIGNER\]([\s\S]*?)\[\/DESIGNER\]/g)).map(x => x[1].trim()).join("\n\n---\n\n");
                                                    let legacyText = text.replace(/\[EDITOR\][\s\S]*?\[\/EDITOR\]/g, '').replace(/\[DESIGNER\][\s\S]*?\[\/DESIGNER\]/g, '').trim();
                                                    legacyText = legacyText.replace(/^(---|\s)+|(-+)\s*$/g, '').trim();
                                                    setInstructionEditorText(legacyText ? (editorText ? legacyText + "\n\n---\n\n" + editorText : legacyText) : editorText);
                                                    setInstructionDesignerText(designerText);
                                                    setIsEditInstructionModalOpen(true);
                                                  };
                                                  // Ação principal visível conforme a etapa; o resto fica no menu de 3 pontinhos
                                                  const primary = m.status === 'concluido'
                                                    ? <IconAction icon={RotateCcw} variant="soft" label="Restaurar" loading={actionLoading === m.id} onClick={() => handleUpdateStatus(m.id, 'pendente')} />
                                                    : m.status === 'revisao'
                                                      ? <IconAction icon={CheckCircle2} variant="ink" label="Aprovar" loading={actionLoading === m.id} onClick={() => handleCheckAndAprovar(m)} />
                                                      : m.status === 'ajustes'
                                                        ? <IconAction icon={AlertCircle} variant="ink" label="Resolver ajuste / devolver" onClick={() => openResolveModal(m, 'planner')} />
                                                        : m.status === 'analise_roteiro'
                                                          ? <IconAction icon={Send} variant="ink" label="Enviar roteiro para o cliente" loading={actionLoading === m.id} onClick={() => handleEnviarRoteiroCliente(m)} />
                                                          : null;
                                                  return taskRow({
                                                    m, drag: { provided: dp, snapshot },
                                                    actions: <>
                                                      {primary}
                                                      {moreMenu(`geral-${m.id}`, [
                                                        { icon: MessageSquare, label: 'Conversa com o cliente', onClick: () => setTimelineMaterial(m) },
                                                        { icon: List, label: 'Histórico da tarefa', onClick: () => abrirHistoricoDelegacao(m.id, m.titulo) },
                                                        !!m.link_drive && { icon: FileVideo, label: 'Ver vídeo', onClick: () => setPreviewUrl(m.link_drive || null) },
                                                        !!m.link_capa && { icon: ImageIcon, label: 'Ver capa', onClick: () => setPreviewUrl(m.link_capa || null) },
                                                        { icon: Activity, label: 'Visualizações do cliente', onClick: () => abrirLogsDoMaterial(m.id, m.titulo) },
                                                        { icon: Link, label: m.link_bruto ? 'Editar link da pasta' : 'Adicionar link da pasta', onClick: () => { setSelectedMaterial(m); setNewLinkBruto(m.link_bruto || ''); setIsLinkBrutoModalOpen(true); } },
                                                        !m.feedback_admin && { icon: Edit3, label: 'Adicionar instrução', onClick: editarInstrucao },
                                                        (m.status === 'organizado' || m.status === 'em_edicao') && { icon: RotateCcw, label: 'Devolver ao decupador', onClick: () => openResolveModal(m, 'planner') },
                                                        m.status !== 'concluido' && { icon: Archive, label: 'Arquivar', disabled: actionLoading === m.id, onClick: () => handleUpdateStatus(m.id, 'concluido') },
                                                        { icon: Trash2, label: 'Excluir tarefa', danger: true, disabled: actionLoading === m.id, onClick: () => openConfirm('Excluir tarefa', 'Esta ação é permanente. Deseja excluir?', () => { setActionLoading(m.id); supabase.from('materiais').delete().eq('id', m.id).then(() => { loadData(); setActionLoading(null); }) }, 'danger') },
                                                      ])}
                                                    </>,
                                                    below: m.feedback_admin ? (
                                                      <CollapsibleInstruction
                                                        theme={theme}
                                                        textSecundario={textSecundario}
                                                        isLong={m.feedback_admin.length > 200 || (m.feedback_admin.match(/\n/g) || []).length > 3}
                                                        author={getAuthorInfo(m.feedback_admin)?.nome}
                                                        onEdit={(e: any) => { e.stopPropagation(); editarInstrucao(); }}
                                                      >
                                                        {renderTextWithLinks(m.feedback_admin)}
                                                      </CollapsibleInstruction>
                                                    ) : undefined,
                                                  });
                                                }}
                                              </Draggable>
                                            ))}
                                            {provided.placeholder}
                                          </div>
                                        )}
                                      </Droppable>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ABA: CADASTRO DO CLIENTE (lista de clientes; o formulário abre em modal) */}
          {activeTab === 'cadastro-clientes' && (() => {
            const inputCls = `w-full px-3 py-2.5 ${tc.bgCard} border ${tc.borderStrong} rounded-[10px] outline-none text-sm focus:border-brand transition-colors`;
            const labelCls = 'block text-[13px] font-medium text-zinc-600 dark:text-zinc-300 mb-1.5';
            const lista = clientes.filter(c => c.nome.toLowerCase().includes(clienteBusca.toLowerCase()));
            const fechar = () => { setIsClienteModalOpen(false); setEditingCliente(null); };
            return (
              <div className="max-w-7xl mx-auto text-left animate-in fade-in duration-300">
                {configHeader({
                  title: 'Cadastro do cliente', icon: Users, meta: `${qtd(clientes.length, 'cliente', 'clientes')}`,
                  actions: <>
                    <div className={`flex items-center gap-2 ${tc.bgCard} border ${tc.borderStrong} rounded-[10px] px-3 py-2 w-full md:w-60`}>
                      <Search size={15} className="text-zinc-400 shrink-0" />
                      <input type="text" placeholder="Buscar cliente..." value={clienteBusca} onChange={e => setClienteBusca(e.target.value)} className="bg-transparent outline-none text-[13px] w-full placeholder:text-zinc-400" />
                    </div>
                    <button onClick={() => { setEditingCliente(null); setWppGroupId(''); setIsClienteModalOpen(true); }} className={btnInk}><Plus size={16} /> Novo cliente</button>
                  </>,
                })}

                {lista.length === 0 ? emptyState(clientes.length === 0 ? 'Nenhum cliente cadastrado.' : 'Nenhum cliente encontrado.') : (
                  <div className={`${tc.bgCard} border ${tc.borderStrong} rounded-2xl overflow-visible`}>
                    <div className={`hidden md:grid md:grid-cols-[minmax(0,1fr)_180px_130px_180px] md:gap-4 px-4 py-2.5 border-b ${tc.borderStrong} text-[11px] font-semibold tracking-wider uppercase text-zinc-400`}>
                      <span>Cliente</span><span>WhatsApp</span><span>Ciclos</span><span />
                    </div>
                    {lista.map((c, idx) => {
                      const abrir = () => { setEditingCliente(c); setWppGroupId(c.whatsapp_group_id || ''); setIsClienteModalOpen(true); };
                      return (
                        <div key={`lista-cliente-${c.id}-${idx}`} onClick={abrir} className={`cursor-pointer flex items-center gap-3 md:grid md:grid-cols-[minmax(0,1fr)_180px_130px_180px] md:gap-4 px-4 py-3 border-b last:border-0 ${tc.border} ${theme === 'dark' ? 'hover:bg-zinc-800/60' : 'hover:bg-zinc-50'} transition-colors`}>
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-9 h-9 rounded-lg overflow-hidden flex shrink-0 items-center justify-center text-white text-sm font-semibold" style={{ background: c.logo_url ? undefined : (c.cor_marca || '#A25431') }}>
                              {c.logo_url
                                ? <img src={c.logo_url} className={`w-full h-full object-contain p-0.5 border ${tc.borderStrong} rounded-lg`} onError={(e) => { e.currentTarget.src = 'https://placehold.co/150x150/f4f4f5/a1a1aa?text=Sem+Logo'; }} alt={`Logo ${c.nome}`} />
                                : (c.nome.trim()[0] || '?').toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{c.nome}</p>
                              <p className="md:hidden text-xs text-zinc-500 truncate">{c.telefone}</p>
                            </div>
                          </div>
                          <span className="hidden md:block text-[13px] text-zinc-500 truncate">{c.telefone}</span>
                          <span className="hidden md:block text-[13px] text-zinc-500">{c.ciclos_contratados || 12} contratados</span>
                          <div className="flex items-center gap-1.5 justify-end shrink-0" onClick={(e) => e.stopPropagation()}>
                            {/* Entrar no portal do cliente como admin: abre em nova aba com a faixa "modo admin" */}
                            <button type="button" title={`Abrir o portal de ${c.nome} e agir no lugar do cliente`} onClick={() => window.open(`${getSafePortalUrl(window.location.origin, c.token_magico)}?admin=1`, '_blank', 'noopener')}
                              className="h-9 px-3 rounded-[10px] inline-flex items-center gap-1.5 text-[13px] font-medium bg-brand-soft text-brand hover:brightness-95 dark:bg-brand/20 dark:text-brand-soft transition">
                              <LogIn size={15} /> Entrar
                            </button>
                            <IconAction icon={Link} label="Copiar link do portal" onClick={() => copyToClipboard(getSafePortalUrl(window.location.origin, c.token_magico))} />
                            {moreMenu(`cli-${c.id}`, [
                              { icon: Edit3, label: 'Editar dados', onClick: abrir },
                              { icon: Send, label: 'Enviar link do portal no WhatsApp', onClick: () => openConfirm('Enviar link do portal', `Vamos enviar o link do portal no WhatsApp de ${c.nome}. Enviar agora?`, () => handleAvisarPortalWhatsApp(c), 'warning') },
                              { icon: Trash2, label: 'Excluir cliente', danger: true, onClick: () => { setClientToDelete(c); setIsDeleteClientModalOpen(true); } },
                            ])}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {isClienteModalOpen && (
                  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-zinc-950/40 p-4 animate-in fade-in duration-200" onClick={fechar}>
                    <form
                      onClick={(e) => e.stopPropagation()}
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        setLoading(true);
                        try {
                          const nome = f.get('nome') as string;
                          const telefone = f.get('telefone') as string;
                          const wpp_suporte = f.get('wpp_suporte') as string;
                          const ciclos = parseInt(f.get('ciclos_contratados') as string) || 12;
                          const cor_marca = f.get('cor_marca') as string || '#1e3a5f';
                          const whatsapp_group_id = f.get('whatsapp_group_id') as string;

                          if (editingCliente) {
                            let logoUrl = editingCliente.logo_url;
                            const logoFile = f.get('logo') as File;
                            if (logoFile && logoFile.size > 0) { const fname = `${Math.random()}.${logoFile.name.split('.').pop()}`; await supabase.storage.from('logos').upload(fname, logoFile); logoUrl = supabase.storage.from('logos').getPublicUrl(fname).data.publicUrl; }

                            await supabase.from('clientes').update({ nome, telefone, wpp_suporte, ciclos_contratados: ciclos, logo_url: logoUrl, cor_marca, whatsapp_group_id }).eq('id', editingCliente.id);
                            toast.success("Cliente atualizado!");
                          } else {
                            await cadastrarClienteCompleto(f);
                            toast.success("Cliente cadastrado!");
                          }
                          fechar();
                          loadData();
                        } catch { toast.error("Erro ao salvar o cliente."); } finally { setLoading(false); }
                      }}
                      className={`${tc.bgCard} w-full max-w-[600px] max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl text-left`}
                    >
                      <div className={`flex items-center gap-3 px-6 py-4 border-b ${tc.borderStrong}`}>
                        <span className="w-9 h-9 rounded-xl bg-brand-soft text-brand inline-flex items-center justify-center"><UserPlus size={18} /></span>
                        <h2 className="text-[17px] font-semibold">{editingCliente ? 'Editar cliente' : 'Novo cliente'}</h2>
                        <span className="ml-auto"><IconAction icon={X} label="Fechar" onClick={fechar} /></span>
                      </div>
                      <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2"><label className={labelCls}>Empresa</label><input name="nome" className={inputCls} defaultValue={editingCliente?.nome || ""} key={editingCliente?.id} placeholder="Nome da empresa" required /></div>
                        <div><label className={labelCls}>WhatsApp do cliente</label><input name="telefone" className={inputCls} defaultValue={editingCliente?.telefone || ""} key={editingCliente?.id + 'tel'} required /></div>
                        <div><label className={labelCls}>WhatsApp da agência (suporte)</label><input name="wpp_suporte" placeholder="Ex.: 5511999999999" className={inputCls} defaultValue={editingCliente?.wpp_suporte || ""} key={editingCliente?.id + 'wppsup'} /></div>
                        <div className="sm:col-span-2">
                          <label className={`${labelCls} flex items-center`}>
                            ID do grupo WhatsApp
                            <button type="button" onClick={async () => {
                              setCarregandoGrupos(true);
                              const res = await buscarGruposWhatsApp();
                              if (res.data) { setListagemGrupos(res.data); setIsGruposModalOpen(true); }
                              else { toast.error(res.error || "Verifique as credenciais da Green API"); }
                              setCarregandoGrupos(false);
                            }} className="ml-auto inline-flex items-center gap-1 text-brand font-medium">{carregandoGrupos ? <Loader2 size={13} className="animate-spin" /> : <List size={13} />} Listar grupos</button>
                          </label>
                          <input name="whatsapp_group_id" placeholder="Ex.: 123456789@g.us" className={inputCls} value={wppGroupId || ''} onChange={e => setWppGroupId(e.target.value)} />
                        </div>
                        <div><label className={labelCls}>Ciclos contratados</label><input name="ciclos_contratados" type="number" min="1" className={inputCls} defaultValue={editingCliente?.ciclos_contratados || 12} key={editingCliente?.id + 'ciclo'} required /></div>
                        <div>
                          <label className={labelCls}>Cor do portal</label>
                          <div className={`flex items-center gap-3 border ${tc.borderStrong} rounded-[10px] px-2 py-1.5`}>
                            <input name="cor_marca" type="color" className="h-8 w-8 rounded-md cursor-pointer bg-transparent" defaultValue={editingCliente?.cor_marca || "#1e3a5f"} key={editingCliente?.id + 'cor'} />
                            <span className="text-[13px] text-zinc-500">Cor usada no portal do cliente</span>
                          </div>
                        </div>
                        <div className="sm:col-span-2">
                          <label className={labelCls}>{editingCliente ? 'Trocar logo' : 'Logo'}</label>
                          <div className={`relative border-[1.5px] border-dashed ${tc.borderStrong} rounded-xl p-4 flex items-center gap-3.5 ${theme === 'dark' ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
                            <input type="file" name="logo" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                            <span className="w-10 h-10 rounded-xl bg-brand-soft text-brand inline-flex items-center justify-center"><Upload size={18} /></span>
                            <div><div className="text-[13.5px] font-medium">Arraste a imagem ou <span className="text-brand">escolha um arquivo</span></div><div className="text-xs text-zinc-500">PNG ou JPG</div></div>
                          </div>
                        </div>
                      </div>
                      <div className={`flex justify-end gap-2.5 px-6 py-4 border-t ${tc.borderStrong}`}>
                        <button type="button" onClick={fechar} className={btnLine}>Cancelar</button>
                        <button type="submit" disabled={loading} className={btnInk}>{loading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} {editingCliente ? 'Salvar alterações' : 'Cadastrar cliente'}</button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ABA: EQUIPE */}
          {activeTab === 'equipe' && (() => {
            const ROLE_LABEL: Record<string, string> = { editor: 'Editor', designer: 'Designer', planner: 'Decupador', admin: 'Gestor' };
            const inputCls = `w-full px-3 py-2.5 ${tc.bgCard} border ${tc.borderStrong} rounded-[10px] outline-none text-sm focus:border-brand transition-colors disabled:opacity-60`;
            const labelCls = 'block text-[13px] font-medium text-zinc-600 dark:text-zinc-300 mb-1.5';
            const vazio = { nome: '', email: '', password: '', role: 'editor' as any, telegram_thread_id: '' };
            const lista = membros.filter(m => `${m.nome || ''} ${m.email}`.toLowerCase().includes(membroBusca.toLowerCase()));
            const abrirNovo = () => { setEditingMembro(null); setFormE(vazio); setIsMembroModalOpen(true); };
            const abrirEdicao = (m: MembroComNome) => { setEditingMembro(m); setFormE({ nome: m.nome || '', email: m.email || '', password: '', role: m.role || 'editor', telegram_thread_id: m.telegram_thread_id || '' }); setIsMembroModalOpen(true); };
            const fechar = () => { setIsMembroModalOpen(false); setEditingMembro(null); setFormE(vazio); };
            const secao = (titulo: string, desc: string, body: React.ReactNode) => (
              <div className={`px-6 py-5 border-b ${tc.borderStrong} last:border-0`}>
                <h3 className="text-[15px] font-semibold">{titulo}</h3>
                <p className="text-xs text-zinc-500 mt-0.5 mb-4">{desc}</p>
                {body}
              </div>
            );
            return (
              <div className="max-w-7xl mx-auto text-left animate-in fade-in duration-300">
                {configHeader({
                  meta: qtd(membros.length, 'membro', 'membros'),
                  actions: <>
                    <div className={`flex items-center gap-2 ${tc.bgCard} border ${tc.borderStrong} rounded-[10px] px-3 py-2 w-full md:w-60`}>
                      <Search size={15} className="text-zinc-400 shrink-0" />
                      <input type="text" placeholder="Buscar membro..." value={membroBusca} onChange={e => setMembroBusca(e.target.value)} className="bg-transparent outline-none text-[13px] w-full placeholder:text-zinc-400" />
                    </div>
                    <button onClick={abrirNovo} className={btnInk}><UserPlus size={16} /> Adicionar membro</button>
                  </>,
                })}

                {lista.length === 0 ? emptyState(membros.length === 0 ? 'Nenhum membro cadastrado.' : 'Nenhum membro encontrado.') : (
                  <div className="space-y-2">
                    {lista.map(m => (
                      <div key={m.id} onClick={() => abrirEdicao(m)} className={`group cursor-pointer flex items-center gap-3 px-4 py-3 ${tc.bgCard} border ${tc.borderStrong} rounded-xl ${theme === 'dark' ? 'hover:bg-zinc-800/60' : 'hover:bg-zinc-50'} transition-colors`}>
                        <span style={{ background: avatarColor(m.id) }} className="w-9 h-9 rounded-full text-xs font-semibold text-white inline-flex items-center justify-center shrink-0">{initials(m.nome || m.email)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{m.nome || 'Sem nome'}</p>
                          <p className="text-xs text-zinc-500 truncate">{ROLE_LABEL[m.role] || m.role} · {m.email}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {/* Entrar no painel do membro (vê o que ele vê); admin não tem painel próprio além deste */}
                          {m.role !== 'admin' && (
                            <button type="button" title={`Abrir o painel de ${m.nome || m.email}`}
                              onClick={() => window.open(`${m.role === 'planner' ? '/planner' : '/editor'}?como=${m.id}`, '_blank', 'noopener')}
                              className="h-9 px-3 rounded-[10px] inline-flex items-center gap-1.5 text-[13px] font-medium bg-brand-soft text-brand hover:brightness-95 dark:bg-brand/20 dark:text-brand-soft transition">
                              <LogIn size={15} /> Entrar
                            </button>
                          )}
                          <IconAction icon={Edit3} label="Editar membro" onClick={() => abrirEdicao(m)} />
                          <IconAction icon={Trash2} label="Remover membro" onClick={() => openConfirm('Remover membro', `Deseja remover ${m.nome || m.email} da equipe?`, async () => { await excluirMembro(m.id); loadData(); }, 'danger')} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {isMembroModalOpen && (
                  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-zinc-950/40 p-4 animate-in fade-in duration-200" onClick={fechar}>
                    <form
                      onClick={(e) => e.stopPropagation()}
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        setIsCreatingUser(true);
                        try {
                          if (editingMembro) {
                            await atualizarMembroEquipe(editingMembro.id, f);
                            toast.success("Membro atualizado!");
                          } else {
                            await criarMembroEquipe(f);
                            toast.success("Membro adicionado!");
                          }
                          fechar();
                          loadData();
                        } catch (error: any) {
                          toast.error(error.message)
                        } finally {
                          setIsCreatingUser(false)
                        }
                      }}
                      className={`${tc.bgCard} w-full max-w-[600px] max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl text-left`}
                    >
                      <div className={`flex items-center gap-3 px-6 py-4 border-b ${tc.borderStrong}`}>
                        <span className="w-9 h-9 rounded-xl bg-brand-soft text-brand inline-flex items-center justify-center"><UserPlus size={18} /></span>
                        <div className="min-w-0">
                          <h2 className="text-[17px] font-semibold">{editingMembro ? 'Editar membro' : 'Novo membro'}</h2>
                          <p className="text-xs text-zinc-500">Dados, acesso e integração do membro da equipe</p>
                        </div>
                        <span className="ml-auto"><IconAction icon={X} label="Fechar" onClick={fechar} /></span>
                      </div>

                      {secao('Dados pessoais', 'Nome e e-mail de acesso', (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div><label className={labelCls}>Nome *</label><input name="nome" placeholder="Nome completo" className={inputCls} value={formE.nome} onChange={e => setFormE({ ...formE, nome: e.target.value })} required /></div>
                          <div><label className={labelCls}>E-mail *</label><input name="email" type="email" placeholder="nome@exemplo.com" disabled={!!editingMembro} className={inputCls} value={formE.email} onChange={e => setFormE({ ...formE, email: e.target.value })} required={!editingMembro} /></div>
                        </div>
                      ))}

                      {secao('Acesso', 'Função no fluxo e senha de entrada', (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className={labelCls}>Função</label>
                            <select name="role" className={inputCls} value={formE.role} onChange={e => setFormE({ ...formE, role: e.target.value as any })}>
                              <option value="editor">Editor</option>
                              <option value="designer">Designer</option>
                              <option value="planner">Decupador</option>
                              <option value="admin">Gestor (administrador)</option>
                            </select>
                          </div>
                          <div><label className={labelCls}>{editingMembro ? 'Nova senha (opcional)' : 'Senha *'}</label><input name="password" type="password" placeholder={editingMembro ? 'Deixe em branco para manter' : 'Senha de acesso'} className={inputCls} value={formE.password} onChange={e => setFormE({ ...formE, password: e.target.value })} required={!editingMembro} /></div>
                        </div>
                      ))}

                      {secao('Integração', 'Onde o membro recebe os avisos de tarefa', (
                        <div><label className={labelCls}>ID do chat do ClickUp (View ID)</label><input name="telegram_thread_id" placeholder="Ex.: 8cjxyz-1234" className={inputCls} value={formE.telegram_thread_id} onChange={e => setFormE({ ...formE, telegram_thread_id: e.target.value })} /></div>
                      ))}

                      <div className={`flex justify-end gap-2.5 px-6 py-4 border-t ${tc.borderStrong}`}>
                        <button type="button" onClick={fechar} className={btnLine}>Cancelar</button>
                        <button type="submit" disabled={isCreatingUser} className={btnInk}>{isCreatingUser ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} {editingMembro ? 'Salvar alterações' : 'Adicionar membro'}</button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            );
          })()}
          {/* ABA: CORES DO TEMA (seletor universal de cores) */}
          {activeTab === 'cores-tema' && (() => {
            const same = (a: BrandColors, b: BrandColors) => a.soft.toLowerCase() === b.soft.toLowerCase() && a.brand.toLowerCase() === b.brand.toLowerCase() && a.ink.toLowerCase() === b.ink.toLowerCase();
            const picker = (key: keyof BrandColors, label: string, desc: string) => (
              <div>
                <div className="text-[13px] font-medium">{label}</div>
                <div className="text-xs text-zinc-500 mt-0.5 mb-2">{desc}</div>
                <label className={`flex items-center gap-2.5 border ${tc.borderStrong} rounded-[10px] px-2.5 py-1.5 cursor-pointer`}>
                  <input type="color" value={brandColors[key]} onChange={e => previewBrandColors({ ...brandColors, [key]: e.target.value })} className="w-7 h-7 rounded-md cursor-pointer bg-transparent" />
                  <span className="text-[13px] font-mono uppercase">{brandColors[key]}</span>
                </label>
              </div>
            );
            return (
              <div className="max-w-7xl mx-auto text-left animate-in fade-in duration-300">
                {configHeader({
                  title: 'Cores do tema', icon: Palette, meta: 'Valem para todo o sistema: painel, portal dos clientes e tela de login',
                  actions: <>
                    <button onClick={() => previewBrandColors(DEFAULT_BRAND)} className={btnLine}><RotateCcw size={15} /> Restaurar padrão</button>
                    <button onClick={saveBrandColors} disabled={salvandoTema || same(brandColors, temaSalvo)} className={btnInk}>{salvandoTema ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} {same(brandColors, temaSalvo) ? 'Salvo' : 'Salvar'}</button>
                  </>,
                })}
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_460px] gap-4 items-start">
                  <div className="space-y-4">
                    <div className={`${tc.bgCard} border ${tc.borderStrong} rounded-2xl p-5`}>
                      <h3 className="text-[15px] font-semibold mb-3.5">Paletas prontas</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {THEME_PRESETS.map(p => {
                          const on = same(p.cores, brandColors);
                          return (
                            <button key={p.nome} onClick={() => previewBrandColors(p.cores)} className={`flex items-center gap-2.5 p-3 rounded-xl text-left transition-colors ${on ? 'border-2 border-brand-ink dark:border-zinc-200' : `border ${tc.borderStrong} hover:bg-zinc-50 dark:hover:bg-zinc-800`}`}>
                              <span className="flex"><span className="w-7 h-7 rounded-full border-2 border-white dark:border-zinc-900 shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" style={{ background: p.cores.soft }} /><span className="w-7 h-7 rounded-full border-2 border-white dark:border-zinc-900 -ml-2" style={{ background: p.cores.brand }} /></span>
                              <span className="text-[13.5px] font-medium">{p.nome}</span>
                              {on && <CheckCircle2 size={16} className="ml-auto" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className={`${tc.bgCard} border ${tc.borderStrong} rounded-2xl p-5`}>
                      <h3 className="text-[15px] font-semibold mb-3.5">Cor personalizada</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {picker('soft', 'Cor de destaque', 'Menu ativo, ícones de título, contadores')}
                        {picker('brand', 'Cor de contraste', 'Ícones e textos sobre o destaque')}
                        {picker('ink', 'Botões principais', 'Salvar, Aprovar, Enviar...')}
                      </div>
                    </div>
                    <div className={`${tc.bgCard} border ${tc.borderStrong} rounded-2xl p-5`}>
                      <h3 className="text-[15px] font-semibold mb-3.5">Modo</h3>
                      <div className={`inline-flex p-1 rounded-[10px] ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
                        {(['light', 'dark'] as const).map(mode => (
                          <button key={mode} onClick={() => { if (theme !== mode) toggleTheme(); }} className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${theme === mode ? `${tc.bgCard} shadow-sm` : 'text-zinc-500'}`}>
                            {mode === 'light' ? <><Sun size={15} /> Claro</> : <><Moon size={15} /> Escuro</>}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className={`${tc.bgCard} border ${tc.borderStrong} rounded-2xl p-5`}>
                    <h3 className="text-[15px] font-semibold mb-3.5">Prévia</h3>
                    <div className={`border ${tc.borderStrong} rounded-xl overflow-hidden flex h-[300px] ${tc.bgApp}`}>
                      <div className={`w-40 ${tc.bgCard} border-r ${tc.borderStrong} p-3 space-y-0.5`}>
                        {[[LayoutDashboard, 'Visão geral', true], [ListTodo, 'Planejamento'], [ClipboardCheck, 'Aprovação'], [Bell, 'Ajustes']].map(([Ic, l, a]: any) => (
                          <div key={l} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs ${a ? 'bg-brand-soft text-brand font-medium' : 'text-zinc-500'}`}><Ic size={14} className={a ? 'text-brand' : 'text-zinc-400'} />{l}</div>
                        ))}
                      </div>
                      <div className="flex-1 p-4 space-y-3">
                        <div className="flex items-center gap-2.5"><span className="w-8 h-8 rounded-lg bg-brand-soft text-brand inline-flex items-center justify-center"><LayoutDashboard size={16} /></span><span className="text-[15px] font-medium">Visão geral</span></div>
                        <div className={`${tc.bgCard} border ${tc.borderStrong} rounded-lg p-3`}><div className="flex justify-between text-xs mb-1.5"><span>Ciclo 10</span><span className="text-zinc-500">5/8</span></div><div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800"><div className="h-full w-[62%] rounded-full bg-brand" /></div></div>
                        <div className="flex gap-1.5"><span className="px-2 py-1 rounded-md text-xs font-medium bg-brand-soft text-brand">Todos</span><span className="px-2 py-1 rounded-md text-xs bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">Atrasados</span></div>
                        <div className="flex items-center gap-2"><span className={`${btnInk} !px-3 !py-1.5 !text-xs`}><CheckCircle2 size={13} /> Aprovar</span><span className="w-8 h-8 rounded-lg bg-brand-soft text-brand inline-flex items-center justify-center"><SendHorizontal size={14} /></span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ABA: RELATÓRIOS */}
          {activeTab === 'relatorios' && (
            <div className="max-w-7xl mx-auto space-y-5 text-left animate-in slide-in-from-bottom-4 duration-500 print:m-0 print:max-w-none">
              <style>{`
              @media print {
                @page { size: landscape; margin: 10mm; }
                .no-print, button, nav, aside { display: none !important; }
                body { background: white !important; color: black !important; padding: 0 !important; }
                .grid { display: grid !important; gap: 20px !important; }
                .grid-cols-1 { grid-template-columns: 1fr 1fr !important; }
                .card-report { border: 1px solid #eee !important; margin-bottom: 20px; break-inside: avoid; }
                .card-report header { background: #f5f5f5 !important; }
                .print-header { display: flex !important; justify-content: space-between; align-items: center; border-bottom: 2px solid #333; margin-bottom: 30px; }
                h1, h2, h3, p, span { color: black !important; }
              }
            `}</style>

              <header>
                <div className="hidden print:flex print-header w-full">
                  <div>
                    <h1 className="text-2xl font-semibold ">Relatório de Produtividade</h1>
                    <p className="text-sm font-bold text-zinc-500">EvertonCMI Portal • Gerado em {new Date().toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold ">Filtro: Todos os Materiais</p>
                  </div>
                </div>
                <div className="print:hidden">
                  {configHeader({ title: REL_SUBS.find(s => s.id === relSub)!.label, icon: REL_SUBS.find(s => s.id === relSub)!.icon, crumb: 'Relatórios', meta: `Gerado em ${new Date().toLocaleDateString('pt-BR')} · Todos os materiais`, actions: <button onClick={() => window.print()} className={btnLine} title="Abre a impressão do navegador; escolha Salvar como PDF"><Download size={15} /> Baixar PDF</button> })}
                  {subTabs(REL_SUBS.map(s => ({ ...s, count: s.id === 'atrasos' ? relatorioData.totalAtrasos : 0 })), relSub, (id) => setActiveTab('relatorios', id))}

                </div>
              </header>

              {/* CARDS DE RESUMO */}
              {relSub === 'resumo' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className={`${tc.bgCard} p-5 rounded-2xl border ${tc.borderStrong} shadow-sm`}>
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 rounded-xl flex items-center justify-center mb-4"><Activity size={20} /></div>
                  <p className={`${tc.textMuted} text-[11px] font-semibold  `}>Total de Materiais</p>
                  <h3 className="text-3xl font-semibold mt-1">{materiais.length}</h3>
                  <p className="text-[12px] text-blue-500 font-bold mt-4 flex items-center gap-1">Histórico completo</p>
                </div>
                <div className={`${tc.bgCard} p-5 rounded-2xl border ${tc.borderStrong} shadow-sm`}>
                  <div className="w-10 h-10 bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400 rounded-xl flex items-center justify-center mb-4"><CheckCircle2 size={20} /></div>
                  <p className={`${tc.textMuted} text-[11px] font-semibold  `}>Taxa de Aprovação</p>
                  <h3 className="text-3xl font-semibold mt-1">{metrics.eficiencia}%</h3>
                  <div className="mt-4 w-full bg-zinc-100 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: `${metrics.eficiencia}%` }}></div>
                  </div>
                </div>
                <div className={`${tc.bgCard} p-5 rounded-2xl border ${tc.borderStrong} shadow-sm`}>
                  <div className="w-10 h-10 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded-xl flex items-center justify-center mb-4"><AlertCircle size={20} /></div>
                  <p className={`${tc.textMuted} text-[11px] font-semibold  `}>Total em Atraso</p>
                  <h3 className="text-3xl font-semibold mt-1">{relatorioData.totalAtrasos}</h3>
                  <p className="text-[12px] text-red-500 font-bold mt-4 flex items-center gap-1">Atenção aos prazos</p>
                </div>
                <div className={`${tc.bgCard} p-5 rounded-2xl border ${tc.borderStrong} shadow-sm`}>
                  <div className="w-10 h-10 bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400 rounded-xl flex items-center justify-center mb-4"><Clock size={20} /></div>
                  <p className={`${tc.textMuted} text-[11px] font-semibold  `}>Gargalo Atual</p>
                  <h3 className="text-xl font-semibold mt-3 leading-tight">{gargalo.name || 'Nenhum'}</h3>
                  <p className="text-[12px] text-purple-500 font-bold mt-3">{gargalo.count} itens aguardando</p>
                </div>
              </div>
              )}

              {(relSub === 'equipe' || relSub === 'clientes') && (
              <div className={relSub === 'equipe' ? 'grid grid-cols-1 lg:grid-cols-2 gap-5' : ''}>
                {/* DESEMPENHO DA EQUIPE */}
                {relSub === 'equipe' && (<>
                <div className={`${tc.bgCard} rounded-2xl border ${tc.borderStrong} overflow-hidden shadow-sm`}>
                  <header className={`px-5 py-4 border-b ${tc.borderStrong} ${theme === 'dark' ? 'bg-zinc-800/20' : 'bg-zinc-50/50'} flex items-center justify-between`}>
                    <div>
                      <h3 className={`font-semibold  text-sm ${tc.textMain}`}>Rendimento e Atrasos</h3>
                      <p className={`text-[12px] ${tc.textMuted} font-medium mt-1`}>Produtividade vs. Cumprimento de Prazos.</p>
                    </div>
                    <Users size={20} className={theme === 'dark' ? 'text-zinc-400' : 'text-brand'} />
                  </header>
                  <div className="p-6 md:p-8 space-y-6">
                    {relatorioData.performance.map((m, i) => (
                      <div key={i} className="space-y-3">
                        <div className="flex justify-between items-end">
                          <div className="flex flex-col">
                            <span className="text-[12px] font-semibold ">{m.nome}</span>
                            <span className="text-[11px] font-bold text-zinc-400 ">{m.role}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[12px] font-bold text-zinc-400 block">{m.entregas} entregas</span>
                            {m.atrasos > 0 && <span className="text-[11px] font-semibold text-red-500 ">🔥 {m.atrasos} em atraso</span>}
                          </div>
                        </div>
                        <div className="w-full bg-zinc-100 rounded-full h-3 overflow-hidden flex">
                          <div className="bg-brand h-3 transition-all duration-1000" style={{ width: `${m.total > 0 ? (m.entregas / m.total) * 100 : 0}%` }}></div>
                          {m.atrasos > 0 && <div className="bg-red-500 h-3" style={{ width: `${(m.atrasos / m.total) * 100}%` }}></div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`${tc.bgCard} rounded-2xl border ${tc.borderStrong} overflow-hidden shadow-sm`}>
                  <header className={`px-5 py-4 border-b ${tc.borderStrong} ${theme === 'dark' ? 'bg-zinc-800/20' : 'bg-zinc-50/50'} flex items-center justify-between`}>
                    <div>
                      <h3 className={`font-semibold  text-sm ${tc.textMain}`}>Ajustes por Equipe</h3>
                      <p className={`text-[12px] ${tc.textMuted} font-medium mt-1`}>Ranking de quem recebe mais correções.</p>
                    </div>
                    <PenTool size={20} className="text-pink-500" />
                  </header>
                  <div className="p-6 md:p-8 space-y-6">
                    {relatorioData.topAjustesEquipe.length === 0 ? (
                      <div className="py-10 text-center opacity-30 font-bold">Nenhum ajuste registrado.</div>
                    ) : relatorioData.topAjustesEquipe.map((p, i) => (
                      <div key={p.nome} className="space-y-2">
                        <div className="flex justify-between items-end">
                          <div>
                            <span className={`text-[11px] font-semibold  ${tc.textMuted}`}>{p.role}</span>
                            <p className="font-bold text-sm ">{p.nome}</p>
                          </div>
                          <span className="text-[12px] font-semibold text-pink-500">{p.ajustesHistoricos} ajustes</span>
                        </div>
                        <div className="w-full bg-zinc-100 dark:bg-zinc-950 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-pink-500 h-1.5 rounded-full"
                            style={{ width: `${Math.min((p.ajustesHistoricos / (relatorioData.topAjustesEquipe[0]?.ajustesHistoricos || 1)) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                </>)}
                {/* RANKING DE AJUSTES (CLIENTES) */}
                {relSub === 'clientes' && (
                <div className={`${tc.bgCard} rounded-2xl border ${tc.borderStrong} overflow-hidden shadow-sm`}>
                  <header className={`px-5 py-4 border-b ${tc.borderStrong} ${theme === 'dark' ? 'bg-zinc-800/20' : 'bg-zinc-50/50'} flex items-center justify-between`}>
                    <div>
                      <h3 className={`font-semibold  text-sm ${tc.textMain}`}>Nível de ajustes por cliente</h3>
                      <p className={`text-[12px] ${tc.textMuted} font-medium mt-1`}>Clientes que mais solicitam alterações.</p>
                    </div>
                    <MessageSquare size={20} className="text-orange-500" />
                  </header>
                  <div className="p-6 md:p-8 space-y-4">
                    {relatorioData.topAjustesClientes.map((c, i) => (
                      <div key={i} className={`flex items-center justify-between p-4 rounded-2xl ${tc.bgHighlight} border ${tc.borderStrong}`}>
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center font-semibold">{i + 1}</div>
                          <div>
                            <p className="font-semibold text-[12px] truncate max-w-[150px]">{c.nome}</p>
                            <p className="text-[11px] text-zinc-400 font-bold ">{c.total} materiais</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold text-lg ${c.ajustes > 5 ? 'text-red-500' : 'text-orange-500'}`}>{c.ajustes}</p>
                          <p className="text-[11px] text-zinc-400 font-bold ">Ajustes ativos</p>
                        </div>
                      </div>
                    ))}
                    {relatorioData.topAjustesClientes.length === 0 && (
                      <p className="text-center py-10 text-zinc-400 font-bold text-[12px]">Nenhum ajuste pendente no momento.</p>
                    )}
                  </div>
                </div>
                )}
              </div>
              )}

              {/* TAREFAS CRÍTICAS (EM ATRASO) */}
              {relSub === 'atrasos' && (
              <div className={`${tc.bgCard} rounded-2xl border ${tc.borderStrong} overflow-hidden shadow-sm card-report`}>
                <header className={`px-5 py-4 border-b ${tc.borderStrong} ${theme === 'dark' ? 'bg-red-900/10' : 'bg-red-50/50'} flex items-center justify-between`}>
                  <div>
                    <h3 className="font-semibold text-sm text-red-600">Tarefas Críticas (Em Atraso)</h3>
                    <p className="text-[12px] text-red-400 font-medium mt-1">Materiais que ultrapassaram a data limite estipulada.</p>
                  </div>
                  <AlertCircle size={20} className="text-red-500" />
                </header>
                <div className="overflow-x-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className={`border-b ${tc.borderStrong} text-[11px] font-semibold   ${tc.textMuted}`}>
                        <th className="p-6">Material</th>
                        <th className="p-6">Cliente</th>
                        <th className="p-6">Prazo Original</th>
                        <th className="p-6">Equipe Responsável</th>
                        <th className="p-6">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {materiais.filter(m => m.data_limite && isDateLate(m.data_limite) && !['aprovado', 'post_aprovado', 'concluido'].includes(m.status)).map(m => (
                        <tr key={m.id} className="hover:bg-zinc-50/50 transition-colors group">
                          <td className="p-6">
                            <p className="font-semibold text-[12px] ">{m.titulo}</p>
                          </td>
                          <td className="p-6">
                            <span className="text-[11px] font-bold text-zinc-500 ">{m.cliente?.nome}</span>
                          </td>
                          <td className="p-6 text-red-500 font-semibold text-[12px]">
                            {new Date(m.data_limite!).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="p-6">
                            <span className="text-[11px] font-bold text-zinc-400 ">
                              {membros.find(mb => mb.id === m.editor_id)?.nome || membros.find(mb => mb.id === m.designer_id)?.nome || 'Não atribuído'}
                            </span>
                          </td>
                          <td className="p-6">
                            <span className={`text-[10px] font-semibold  px-2 py-1 rounded-md whitespace-nowrap ${getStatusColor(m.status)}`}>
                              {{
                                'analise_roteiro': 'Roteiro em Análise', 'roteiro_pendente': 'Aguardando Cliente', 'roteiro_aprovado': 'Roteiro Aprovado', 'planejamento': 'Aguardando Decupagem', 'em_organizacao': 'Decupagem em Andamento', 'faltando_material': 'Falta Material', 'verificar_material': 'Verificar Material', 'organizado': 'Aguardando Edição', 'em_edicao': 'Em Edição', 'aprovado': 'Aguardando Cliente', 'ajustes': 'Ajustes', 'revisao': 'Revisão Agência', 'post_aprovado': 'Post Aprovado', 'concluido': 'Finalizado'
                              }[m.status] || m.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {materiais.filter(m => m.data_limite && isDateLate(m.data_limite) && !['aprovado', 'post_aprovado', 'concluido'].includes(m.status)).length === 0 && (
                    <div className="py-20 text-center space-y-4">
                      <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto border border-green-100 shadow-sm">
                        <CheckCircle2 size={32} />
                      </div>
                      <p className="text-zinc-400 font-semibold text-[11px] ">Sem atrasos. Tudo sob controle!</p>
                    </div>
                  )}
                </div>
              </div>
              )}

              {/* CARGA DE TRABALHO DA EQUIPE */}
              {relSub === 'equipe' && (
              <div className={`${tc.bgCard} rounded-2xl border ${tc.borderStrong} overflow-hidden shadow-sm card-report`}>
                <header className={`px-5 py-4 border-b ${tc.borderStrong} ${theme === 'dark' ? 'bg-blue-900/10' : 'bg-blue-50/50'} flex items-center justify-between`}>
                  <div>
                    <h3 className="font-semibold text-sm text-blue-600">Carga de Trabalho Atual da Equipe</h3>
                    <p className="text-[12px] text-blue-400 font-medium mt-1">Materiais em produção destinados a cada membro da equipe.</p>
                  </div>
                  <ClipboardCheck size={20} className="text-blue-500" />
                </header>
                <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {relatorioData.workload.map((w, i) => (
                    <div key={i} className={`p-5 rounded-2xl border ${tc.borderStrong} ${theme === 'dark' ? 'bg-zinc-900/50' : 'bg-zinc-50'}`}>
                      <div className="flex items-center justify-between mb-4 border-b border-zinc-200 dark:border-zinc-800 pb-3">
                        <div>
                          <p className="font-semibold text-sm ">{w.nome}</p>
                          <p className="text-[11px] font-bold text-zinc-400 ">{w.role}</p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-[12px]">
                          {w.tarefas.length}
                        </div>
                      </div>
                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {w.tarefas.map(t => (
                          <div key={t.id} className={`p-3 rounded-xl border ${theme === 'dark' ? 'border-zinc-800 bg-zinc-950' : 'border-zinc-200 bg-white'}`}>
                            <p className="text-[11px] font-bold text-zinc-500 ">{t.cliente} - CICLO {t.ciclo}</p>
                            <p className="text-[12px] font-semibold mt-1 mb-2 line-clamp-2">{t.titulo}</p>
                            <span className={`inline-block text-[10px] font-semibold  px-2 py-1 rounded-md ${getStatusColor(t.status)}`}>
                              {{
                                'analise_roteiro': 'Roteiro em Análise', 'roteiro_pendente': 'Aguardando Cliente', 'roteiro_aprovado': 'Roteiro Aprovado', 'planejamento': 'Aguardando Decupagem', 'em_organizacao': 'Decupagem em Andamento', 'faltando_material': 'Falta Material', 'verificar_material': 'Verificar Material', 'organizado': 'Aguardando Edição', 'em_edicao': 'Em Edição', 'aprovado': 'Aguardando Cliente', 'ajustes': 'Ajustes', 'revisao': 'Revisão Agência', 'post_aprovado': 'Post Aprovado', 'concluido': 'Finalizado'
                              }[t.status] || t.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {relatorioData.workload.length === 0 && (
                    <div className="col-span-full py-10 text-center text-zinc-400 font-bold text-[12px] ">
                      Nenhum material em produção no momento.
                    </div>
                  )}
                </div>
              </div>
              )}

            </div>
          )}
        </main>
      </DragDropContext>
      </div>

      {/* MODAIS RESPONSIVOS */}

      {isDelegateModalOpen && selectedCicloDelegation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className={`${tc.bgCard} w-[95%] max-w-md max-h-[90vh] overflow-y-auto rounded-2xl p-5 md:p-8 shadow-2xl space-y-5 md:space-y-6 text-left border ${theme === 'dark' ? 'border-zinc-800' : 'border-transparent'}`}>
            <div className="flex justify-between items-center"><h3 className="text-xl md:text-2xl font-semibold ">Delegar</h3><button onClick={() => setIsDelegateModalOpen(false)} className={`p-2 ${tc.bgHover} rounded-full`}><X size={20} /></button></div>
            <div className={`${theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-50 border-zinc-100'} p-4 rounded-2xl border mb-2`}>
              <p className={`text-[11px] font-semibold  ${tc.textMuted} mb-2 flex items-center justify-between`}>
                <span>Selecione e arraste para reordenar:</span>
              </p>
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="delegation-list">
                  {(provided) => (
                    <div
                      className="max-h-32 md:max-h-40 overflow-y-auto space-y-2 pr-2 custom-scrollbar"
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                    >
                      {selectedCicloDelegation.itens.map((item: any, index: number) => (
                        <Draggable key={item.id} draggableId={item.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`flex items-center gap-2 p-2 ${tc.bgCard} border ${snapshot.isDragging ? 'border-purple-500 shadow-lg scale-[1.02]' : tc.borderStrong} rounded-xl transition-all`}
                            >
                              <div {...provided.dragHandleProps} className="p-1 cursor-grab active:cursor-grabbing text-zinc-400 hover:text-zinc-600">
                                <GripVertical size={16} />
                              </div>
                              <label className="flex items-center gap-3 flex-1 cursor-pointer min-w-0">
                                <input type="checkbox" className="w-4 h-4 accent-brand shrink-0" checked={selectedItemsToDelegate.includes(item.id)} onChange={(e) => { if (e.target.checked) setSelectedItemsToDelegate([...selectedItemsToDelegate, item.id]); else setSelectedItemsToDelegate(selectedItemsToDelegate.filter(id => id !== item.id)); }} />
                                <span className="text-[12px] font-bold truncate select-none">{item.titulo}</span>
                              </label>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </div>
            <div className="space-y-3">

              {delegationType === 'planner' && (
                <div className="space-y-1">
                  <label className={`text-[11px] font-semibold   ${tc.textMuted} ml-1`}>Link Bruto (Opcional)</label>
                  <input
                    type="text"
                    placeholder="https://drive.google.com/..."
                    className={`w-full py-3 px-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-2xl font-bold outline-none text-sm focus:border-brand transition-colors`}
                    value={newLinkBruto}
                    onChange={e => setNewLinkBruto(e.target.value)}
                  />
                </div>
              )}

              {delegationType === 'planner' ? (
                <div className="space-y-1">
                  <label className={`text-[11px] font-semibold   ${tc.textMuted} ml-1`}>Selecionar Decupador</label>
                  <select className={`w-full py-3 px-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-2xl font-bold outline-none text-sm transition-colors`} value={selectedPlannerId} onChange={e => setSelectedPlannerId(e.target.value)}>
                    <option value="">Nenhum</option>
                    {planners.map(m => (
                      <option key={m.id} value={m.id}>{m.nome ? `${m.nome} (${m.role === 'admin' ? 'Gestor' : 'Decupador'})` : `${m.email} (${m.role === 'admin' ? 'Gestor' : 'Decupador'})`}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="space-y-1">
                    <label className={`text-[11px] font-semibold   ${tc.textMuted} ml-1 flex items-center gap-1.5`}><PlayCircle size={12} /> Editor (Vídeos/Reels)</label>
                    <select className={`w-full py-3 px-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-2xl font-bold outline-none text-sm transition-colors`} value={selectedEditorId} onChange={e => setSelectedEditorId(e.target.value)}>
                      <option value="">Nenhum</option>
                      {editores.map(m => (
                        <option key={m.id} value={m.id}>{m.nome ? `${m.nome} (${m.role === 'admin' ? 'Gestor' : 'Editor'})` : `${m.email} (${m.role === 'admin' ? 'Gestor' : 'Editor'})`}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className={`text-[11px] font-semibold   ${tc.textMuted} ml-1 flex items-center gap-1.5`}><PenTool size={12} /> Designer (Capas/Carrosséis)</label>
                    <select className={`w-full py-3 px-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-2xl font-bold outline-none text-sm transition-colors`} value={selectedDesignerId} onChange={e => setSelectedDesignerId(e.target.value)}>
                      <option value="">Nenhum</option>
                      {designers.map(m => (
                        <option key={m.id} value={m.id}>{m.nome ? `${m.nome} (${m.role === 'admin' ? 'Gestor' : 'Designer'})` : `${m.email} (${m.role === 'admin' ? 'Gestor' : 'Designer'})`}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {delegationType === 'planner' ? (
                <div className="space-y-1">
                  <label className={`text-[11px] font-semibold   ${tc.textMuted} ml-1`}>Data Limite de Entrega (Decupador)</label>
                  <div className="relative group w-full" onClick={(e) => {
                    const input = e.currentTarget.querySelector('input');
                    if (input && 'showPicker' in input) {
                      try { (input as any).showPicker(); } catch (e) { }
                    }
                  }}>
                    <input
                      type="date"
                      className={`w-full py-3 px-3 md:px-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-2xl font-bold outline-none text-[12px] md:text-sm transition-colors [color-scheme:dark] min-w-0 cursor-pointer`}
                      value={delegationDeadline}
                      onChange={e => setDelegationDeadline(e.target.value)}
                    />
                    <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" size={18} />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
                  {selectedEditorId && (
                    <div className="space-y-1">
                      <label className={`text-[11px] font-semibold   ${tc.textMuted} ml-1`}>Prazo do Editor</label>
                      <div className="relative group w-full" onClick={(e) => {
                        const input = e.currentTarget.querySelector('input');
                        if (input && 'showPicker' in input) {
                          try { (input as any).showPicker(); } catch (e) { }
                        }
                      }}>
                        <input
                          type="date"
                          className={`w-full py-3 px-3 md:px-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-2xl font-bold outline-none text-[12px] md:text-sm transition-colors [color-scheme:dark] min-w-0 cursor-pointer`}
                          value={delegationDeadlineEditor}
                          onChange={e => setDelegationDeadlineEditor(e.target.value)}
                        />
                        <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" size={18} />
                      </div>
                    </div>
                  )}
                  {selectedDesignerId && (
                    <div className="space-y-1">
                      <label className={`text-[11px] font-semibold   ${tc.textMuted} ml-1`}>Prazo do Designer</label>
                      <div className="relative group w-full" onClick={(e) => {
                        const input = e.currentTarget.querySelector('input');
                        if (input && 'showPicker' in input) {
                          try { (input as any).showPicker(); } catch (e) { }
                        }
                      }}>
                        <input
                          type="date"
                          className={`w-full py-3 px-3 md:px-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-2xl font-bold outline-none text-[12px] md:text-sm transition-colors [color-scheme:dark] min-w-0 cursor-pointer`}
                          value={delegationDeadlineDesigner}
                          onChange={e => setDelegationDeadlineDesigner(e.target.value)}
                        />
                        <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" size={18} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {delegationType === 'planner' ? (
                <textarea className={`w-full py-3 px-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-2xl font-bold outline-none text-sm min-h-[80px] transition-colors resize-none`} placeholder="Instruções para o Decupador..." value={adminFeedbackPlanner} onChange={e => setAdminFeedbackPlanner(e.target.value)} />
              ) : (
                <div className="flex flex-col gap-3 w-full">
                  {selectedEditorId && (
                    <textarea className={`w-full py-3 px-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-2xl font-bold outline-none text-sm min-h-[80px] transition-colors resize-none`} placeholder="Instruções para o Editor..." value={adminFeedbackEditor} onChange={e => setAdminFeedbackEditor(e.target.value)} />
                  )}
                  {selectedDesignerId && (
                    <textarea className={`w-full py-3 px-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-2xl font-bold outline-none text-sm min-h-[80px] transition-colors resize-none`} placeholder="Instruções para o Designer..." value={adminFeedbackDesigner} onChange={e => setAdminFeedbackDesigner(e.target.value)} />
                  )}
                </div>
              )}
            </div>
            <button onClick={handleDelegarItems} disabled={loading || selectedItemsToDelegate.length === 0} className="w-full py-4 bg-brand hover:brightness-90 text-white rounded-2xl font-semibold text-[12px]  flex items-center justify-center gap-2 disabled:opacity-50 transition-colors">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Delegar Selecionados
            </button>
          </div>
        </div>
      )}

      {isLinkBrutoModalOpen && selectedMaterial && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className={`${tc.bgCard} border ${theme === 'dark' ? 'border-zinc-800' : 'border-transparent'} w-[95%] max-w-md rounded-2xl p-5 md:p-8 shadow-2xl space-y-5 md:space-y-6 text-left`}>
            <div className="flex justify-between items-center"><h3 className="text-xl md:text-2xl font-semibold ">Link Bruto</h3><button onClick={() => setIsLinkBrutoModalOpen(false)} className={`p-2 ${tc.bgHover} rounded-full`}><X size={20} /></button></div>
            <div className="space-y-4">
              <p className={`${tc.textMuted} text-sm font-medium`}>Insira o link da pasta com os materiais brutos gravados para esta tarefa.</p>
              <div className="flex flex-col gap-3">
                <input className={`w-full py-3 px-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-2xl font-bold outline-none focus:border-brand text-sm transition-colors`} placeholder="https://drive.google.com/..." value={newLinkBruto} onChange={e => setNewLinkBruto(e.target.value)} />
                <div className="flex justify-center">
                  <GoogleDrivePicker onSelect={(url) => setNewLinkBruto(url)} type="folder" label="Selecionar Pasta no Google Drive" />
                </div>
              </div>
            </div>
            <button onClick={handleUpdateLinkBruto} disabled={loading || !newLinkBruto} className="w-full py-4 bg-brand text-white rounded-2xl font-semibold text-[12px]  hover:brightness-90 flex items-center justify-center gap-2 disabled:opacity-50 transition-colors">
              {loading ? <Loader2 size={16} className="animate-spin" /> : null} Salvar Link
            </button>
          </div>
        </div>
      )}

      {isResolveIssueModalOpen && selectedMaterial && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className={`${tc.bgCard} border ${theme === 'dark' ? 'border-zinc-800' : 'border-transparent'} w-[95%] max-w-md max-h-[90vh] overflow-y-auto rounded-2xl p-5 md:p-8 shadow-2xl space-y-5 md:space-y-6 text-left`}>
            <div className="flex justify-between items-center"><h3 className="text-xl md:text-2xl font-semibold text-red-500">Resolver Problema</h3><button onClick={() => setIsResolveIssueModalOpen(false)} className={`p-2 ${tc.bgHover} rounded-full`}><X size={20} /></button></div>
            <div className={`${theme === 'dark' ? 'bg-red-900/20 border-red-900/30' : 'bg-red-50 border-red-100'} p-4 rounded-2xl border mb-2`}>
              <div className="flex justify-between items-center mb-1">
                <p className="text-[11px] font-semibold text-red-500">Motivo do Problema:</p>
                {(() => {
                  const author = getAuthorInfo(selectedMaterial.feedback);
                  if (!author) return null;
                  return <span className="text-[11px] font-bold text-red-400 ">Reportado por: {author.nome}</span>;
                })()}
              </div>
              {(() => {
                const feedbacks = selectedMaterial.feedback ? selectedMaterial.feedback.split('\n\n').map((f: string) => f.replace(/\[ID:.*?\]/g, '').trim()).filter(Boolean) : [];
                return feedbacks.length > 0 ? (
                  <div className={`text-[12px] font-medium text-red-500 whitespace-pre-wrap flex flex-col gap-2 mt-2`}>
                    {feedbacks.map((fb: string, idx: number) => (
                      <div key={idx} className={idx > 0 ? 'opacity-70 pt-2 border-t border-red-200 dark:border-red-900' : ''}>
                        {renderTextWithLinks(fb)}
                      </div>
                    ))}
                  </div>
                ) : <span className="text-[12px] font-medium text-red-500">Motivo não informado.</span>;
              })()}
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className={`text-[11px] font-semibold ${tc.textMuted}   ml-2`}>Destino da Resolução</label>
                <div className="flex gap-2">
                  <button onClick={() => setResolveType('planner')} className={`flex-1 py-3 rounded-xl text-[11px] font-semibold   border transition-all ${resolveType === 'planner' ? 'bg-red-600 text-white border-red-600' : `${theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-200'} ${tc.textMuted}`}`}>Decupador</button>
                  <button onClick={() => setResolveType('editor')} className={`flex-1 py-3 rounded-xl text-[11px] font-semibold   border transition-all ${resolveType === 'editor' ? 'bg-blue-600 text-white border-blue-600' : `${theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-200'} ${tc.textMuted}`}`}>Produção (Edição/Design)</button>
                </div>
              </div>

              {resolveType === 'editor' && (
                <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className={`text-[11px] font-semibold ${tc.textMuted}   ml-2`}>Quem Notificar?</label>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setNotifyTarget('both')} className={`flex-1 py-2 px-3 rounded-lg text-[11px] font-semibold  border transition-all ${notifyTarget === 'both' ? 'bg-zinc-800 text-white border-zinc-800' : `${theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-200'} ${tc.textMuted}`}`}>Ambos</button>
                    <button onClick={() => setNotifyTarget('editor')} className={`flex-1 py-2 px-3 rounded-lg text-[11px] font-semibold  border transition-all ${notifyTarget === 'editor' ? 'bg-blue-500 text-white border-blue-500' : `${theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-200'} ${tc.textMuted}`}`}>Apenas Editor</button>
                    <button onClick={() => setNotifyTarget('designer')} className={`flex-1 py-2 px-3 rounded-lg text-[11px] font-semibold  border transition-all ${notifyTarget === 'designer' ? 'bg-pink-500 text-white border-pink-500' : `${theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-200'} ${tc.textMuted}`}`}>Apenas Designer</button>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className={`text-[11px] font-semibold ${tc.textMuted}   ml-2`}>Link Bruto (Opcional)</label>
                <div className="flex flex-col gap-2">
                  <input className={`w-full py-3 px-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-2xl font-bold outline-none text-sm transition-colors`} placeholder="Link se tiver mudado..." value={resolveLinkBruto} onChange={e => setResolveLinkBruto(e.target.value)} />
                  <div className="flex justify-center">
                    <GoogleDrivePicker onSelect={(url) => setResolveLinkBruto(url)} type="folder" label="Selecionar no Drive" />
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <label className={`text-[11px] font-semibold ${tc.textMuted}   ml-2`}>Instrução de Resolução</label>
                <textarea className={`w-full py-3 px-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-2xl font-medium outline-none focus:border-red-500 min-h-[100px] text-sm resize-none transition-colors`} placeholder="Explique o que foi feito ou o que fazer agora..." value={resolveText} onChange={e => setResolveText(e.target.value)} />
              </div>
            </div>
            <button onClick={handleResolveIssue} disabled={loading || !resolveText} className={`w-full py-4 ${resolveType === 'planner' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-2xl font-semibold  text-[12px]  flex items-center justify-center gap-2 disabled:opacity-50 transition-colors`}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : null} {resolveType === 'planner' ? 'Confirmar & Devolver' : 'Confirmar & Reenviar'}
            </button>
          </div>
        </div>
      )}

      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className={`${tc.bgCard} border ${theme === 'dark' ? 'border-zinc-800' : 'border-transparent'} w-[95%] max-w-md rounded-2xl p-5 md:p-10 shadow-2xl space-y-5 md:space-y-6 text-left`}>
            <div className="flex justify-between items-center"><h3 className="text-xl md:text-2xl font-semibold ">Importar</h3><button onClick={() => setIsImportModalOpen(false)} className={`p-2 ${tc.bgHover} rounded-full`}><X size={20} /></button></div>
            <div className="space-y-4">
              <input className={`w-full py-3 px-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-2xl font-bold outline-none text-sm focus:border-brand transition-colors`} placeholder="ID da Tarefa" value={plannerTaskId} onChange={e => setPlannerTaskId(e.target.value)} />
              <input type="number" min="1" className={`w-full p-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-2xl font-bold outline-none text-sm focus:border-brand transition-colors`} placeholder="Ciclo" value={importCiclo} onChange={e => setImportCiclo(e.target.value)} />
              <select className={`w-full p-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-2xl font-bold outline-none text-sm focus:border-brand transition-colors`} value={importClienteId} onChange={e => setImportClienteId(e.target.value)}><option value="">Selecionar Cliente...</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
              
              <div className="flex items-center gap-3 pt-2">
                <input type="checkbox" id="create-folders" className={`w-4 h-4 rounded accent-brand cursor-pointer`} checked={createDriveFolders} onChange={e => setCreateDriveFolders(e.target.checked)} />
                <label htmlFor="create-folders" className="text-sm font-bold cursor-pointer">Criar pastas automaticamente no Drive</label>
              </div>

              {createDriveFolders && (
                <div className="flex gap-2">
                  <input className={`flex-1 p-3 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-2xl font-bold outline-none text-[12px] focus:border-brand transition-colors`} placeholder="Link da Pasta Mãe..." value={parentFolderUrl} readOnly />
                  <GoogleDrivePicker onSelect={(url) => setParentFolderUrl(url)} type="folder" label="Selecionar Pasta" />
                </div>
              )}
            </div>
            <button onClick={handleImportPlanner} disabled={loading || !plannerTaskId} className="w-full py-4 bg-brand text-white rounded-2xl font-semibold text-[12px]  flex items-center justify-center gap-2 disabled:opacity-50 hover:brightness-90 transition-colors">
              {loading ? <Loader2 size={16} className="animate-spin" /> : null} Sincronizar
            </button>
          </div>
        </div>
      )}

      {/* MODAL EDITAR INSTRUÇÃO */}
      {isEditInstructionModalOpen && materialToEditInstruction && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className={`${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'} border w-full max-w-2xl rounded-3xl p-6 shadow-2xl flex flex-col`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-2">
                <Edit3 size={20} />
                Editar Instrução
              </h3>
              <button onClick={() => setIsEditInstructionModalOpen(false)} className={`p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full`}><X size={18} /></button>
            </div>
            <p className="text-[12px] font-bold text-zinc-500 mb-4">{materialToEditInstruction.titulo}</p>
            <div className="flex flex-col gap-4 mb-4">
              <div className="flex-1">
                <p className="text-[11px] font-semibold text-blue-500 mb-1 flex items-center gap-1.5"><PlayCircle size={12}/> Instrução para Editor</p>
                <textarea
                  className={`w-full h-40 p-4 rounded-xl border ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-zinc-200' : 'bg-zinc-50 border-zinc-200 text-zinc-800'} focus:border-blue-500 outline-none resize-none font-medium text-sm whitespace-pre-wrap custom-scrollbar`}
                  value={instructionEditorText}
                  onChange={e => setInstructionEditorText(e.target.value)}
                  placeholder="Instruções específicas para o editor..."
                />
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-semibold text-pink-500 mb-1 flex items-center gap-1.5"><PenTool size={12}/> Instrução para Designer</p>
                <textarea
                  className={`w-full h-40 p-4 rounded-xl border ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-zinc-200' : 'bg-zinc-50 border-zinc-200 text-zinc-800'} focus:border-pink-500 outline-none resize-none font-medium text-sm whitespace-pre-wrap custom-scrollbar`}
                  value={instructionDesignerText}
                  onChange={e => setInstructionDesignerText(e.target.value)}
                  placeholder="Instruções específicas para o designer..."
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setIsEditInstructionModalOpen(false)} className="flex-1 py-3 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl font-bold text-[12px] transition-colors">Cancelar</button>
              <button onClick={handleSaveInstruction} disabled={loading} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-[12px] flex justify-center items-center gap-2 disabled:opacity-50 transition-colors">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar Instrução
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAREFA ABERTA: painel lateral com campos estilo ClickUp e o roteiro editável */}
      {isEditRoteiroModalOpen && roteiroToEdit && (() => {
        const m = materiais.find(x => x.id === roteiroToEdit.id) || roteiroToEdit;
        const st = statusOf(m);
        const field = (Icon: any, label: string, value: React.ReactNode) => (
          <div className="flex items-center gap-3 py-2">
            <span className="flex items-center gap-2 w-32 shrink-0 text-[13px] text-zinc-500"><Icon size={16} /> {label}</span>
            <div className="flex items-center gap-2 flex-wrap min-w-0">{value}</div>
          </div>
        );
        const thumb = (url: string, label: string, Icon: any, gradient: string) => (
          <button type="button" onClick={() => setPreviewUrl(url)} title={`Abrir ${label.toLowerCase()}`} className={`relative overflow-hidden w-[84px] h-[84px] rounded-xl text-white flex flex-col items-center justify-center gap-1 shrink-0 hover:brightness-95 transition ${gradient}`}>
            <Icon size={20} /><span className="text-[11px] font-semibold">{label}</span>
            <ThumbImage key={url} url={url} label={label} />
          </button>
        );
        return (
          <div className="fixed inset-0 z-[9999] flex justify-end bg-zinc-950/30 animate-in fade-in duration-200" onClick={() => setIsEditRoteiroModalOpen(false)}>
            <div onClick={(e) => e.stopPropagation()} className={`${tc.bgCard} w-full md:w-[760px] h-full shadow-2xl flex flex-col text-left animate-in slide-in-from-right duration-300`}>
              <div className={`px-5 md:px-6 py-4 border-b ${tc.borderStrong} flex items-start gap-3 shrink-0`}>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-zinc-500 truncate">{m.cliente?.nome}{m.ciclo ? ` · Ciclo ${m.ciclo}` : ''}</div>
                  <textarea ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }} rows={1} value={novoTituloText} onChange={(e) => { setNovoTituloText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }} className={`text-lg font-semibold mt-0.5 w-full bg-transparent border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 focus:border-brand outline-none rounded-md px-1.5 py-0.5 -ml-1.5 resize-none overflow-hidden ${tc.textMain}`} placeholder="Título da tarefa" />
                </div>
                <IconAction icon={X} label="Fechar" onClick={() => setIsEditRoteiroModalOpen(false)} />
              </div>

              <div className="flex-1 overflow-y-auto px-5 md:px-6 py-4">
                {(m.link_drive || m.link_capa) && (
                  <div className="flex items-center gap-3 mb-3">
                    {m.link_drive && thumb(m.link_drive, 'Vídeo', PlayCircle, 'bg-gradient-to-br from-[#F0C9AE] to-brand')}
                    {m.link_capa && thumb(m.link_capa, 'Capa', ImageIcon, 'bg-gradient-to-br from-pink-200 to-pink-500')}
                    <p className="text-xs text-zinc-500">Clique na miniatura<br />para abrir o arquivo</p>
                  </div>
                )}
                <div className={`border-b ${tc.borderStrong} pb-2 mb-4`}>
                  {field(Activity, 'Status', statusChip(st.label, st.cls))}
                  {field(Users, 'Responsáveis', avatars([m.planner_id, m.editor_id, m.designer_id]))}
                  {field(Calendar, 'Entrega', entregaCell(m))}
                  {field(Tag, 'Tags', <>{tagChips(m)}<span className="[&>span]:opacity-100">{tagControl(m)}</span></>)}
                </div>
                <div className="flex items-center gap-2 mb-2.5"><span className="text-[15px] font-semibold">Roteiro</span></div>
                <div onClick={(e) => { const target = (e.target as HTMLElement).closest('a'); if (target) { e.preventDefault(); const href = target.getAttribute('href'); if (href) window.open(href, '_blank', 'noopener,noreferrer'); } }} className={`${theme === 'dark' ? 'bg-zinc-950 text-zinc-300 [&_.ql-toolbar]:border-zinc-800 [&_.ql-container]:border-zinc-800 [&_.ql-stroke]:stroke-zinc-300 [&_.ql-fill]:fill-zinc-300 [&_.ql-picker]:text-zinc-300 [&_.ql-picker-options]:bg-zinc-900' : 'bg-white text-zinc-800 [&_.ql-toolbar]:border-zinc-200 [&_.ql-container]:border-zinc-200'} rounded-xl overflow-hidden [&_.ql-toolbar]:rounded-t-xl [&_.ql-container]:rounded-b-xl [&_.ql-editor_a]:cursor-pointer [&_.ql-editor_a]:text-blue-500 [&_.ql-editor_a]:underline`}>
                  <ReactQuill theme="snow" value={newRoteiroText} onChange={setNewRoteiroText} placeholder="Escreva o roteiro aqui com formatação..." className="[&_.ql-editor]:min-h-[320px] [&_.ql-editor]:text-[15px]" />
                </div>

                {/* Conversa com o cliente pelo portal (texto, fotos e áudio) */}
                <div className="flex items-center gap-2 mt-6 mb-2.5">
                  <span className="text-[15px] font-semibold">Conversa com o cliente</span>
                  <span className="text-xs text-zinc-500">pelo portal</span>
                  <label className="ml-auto inline-flex items-center gap-1.5 text-xs text-zinc-500 cursor-pointer select-none" title="Manda uma mensagem no WhatsApp do cliente avisando que há resposta no portal">
                    <input type="checkbox" checked={avisarWppConversa} onChange={(e) => setAvisarWppConversa(e.target.checked)} className="accent-brand" />
                    Avisar no WhatsApp
                  </label>
                </div>
                <div className={`border ${tc.borderStrong} rounded-xl overflow-hidden`}>
                  <ConversaMaterial
                    className="h-[440px]"
                    mensagens={conversaAdmin}
                    carregando={carregandoConversaAdmin}
                    perspectiva="equipe"
                    dark={theme === 'dark'}
                    onEnviar={(envio) => enviarConversaAdmin(m, envio)}
                    placeholder="Responder ao cliente…"
                    vazio="Nenhuma mensagem do cliente sobre este conteúdo ainda."
                  />
                </div>
              </div>

              <div className={`px-5 md:px-6 py-4 border-t ${tc.borderStrong} flex justify-end gap-2.5 shrink-0`}>
                <button onClick={() => setIsEditRoteiroModalOpen(false)} className={btnLine}>Cancelar</button>
                <button onClick={handleSaveRoteiro} disabled={loading} className={btnInk}>{loading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvar</button>
              </div>
            </div>
          </div>
        );
      })()}

      {previewRoteiro && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm md:p-4 animate-in fade-in duration-300">
          <div className={`${tc.bgCard} border ${theme === 'dark' ? 'border-zinc-800' : 'border-transparent'} w-full h-full md:w-[95%] md:max-w-7xl md:h-[90vh] rounded-none md:rounded-2xl shadow-2xl flex flex-col overflow-hidden text-left`}>
            <div className={`p-5 md:p-6 border-b ${tc.borderStrong} flex justify-between items-center ${theme === 'dark' ? 'bg-zinc-900' : 'bg-white'} shrink-0 z-10 shadow-sm`}>
              <div className="min-w-0 flex-1 pr-4"><h3 className="text-lg md:text-xl font-semibold truncate flex items-center gap-2" title={previewRoteiro.titulo}><FileText size={20} className="text-purple-500" /> {previewRoteiro.titulo}</h3></div>
              <button onClick={() => setPreviewRoteiro(null)} className={`p-2 ${tc.bgHover} ${tc.textMuted} rounded-full shrink-0 transition-colors`}><X size={20} /></button>
            </div>
            <div className={`p-0 md:p-8 overflow-hidden ${theme === 'dark' ? 'bg-zinc-950' : 'bg-zinc-100'} flex-1 flex justify-center`}>
              <div className={`w-full h-full p-6 md:p-12 ${theme === 'dark' ? 'bg-[#18181b] text-zinc-300 border-zinc-800' : 'bg-white text-zinc-800 border-zinc-200'} md:shadow-lg border-x-0 border-y-0 md:border md:rounded-lg overflow-y-auto`}>
                <div onClick={(e) => { const target = (e.target as HTMLElement).closest('a'); if (target) { e.preventDefault(); const href = target.getAttribute('href'); if (href) window.open(href, '_blank', 'noopener,noreferrer'); } }} className={`ql-editor roteiro-preview-content !p-0 max-w-none text-sm md:text-base font-medium whitespace-pre-wrap leading-relaxed [&_a]:cursor-pointer [&_a]:text-blue-500 [&_a]:hover:underline break-words ${theme === "dark" ? "text-zinc-200" : "text-zinc-800"}`} dangerouslySetInnerHTML={{ __html: formatRichText(previewRoteiro.roteiro) }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {isVersionModalOpen && selectedMaterial && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className={`${tc.bgCard} border ${theme === 'dark' ? 'border-zinc-800' : 'border-transparent'} w-[95%] max-w-md rounded-2xl p-5 md:p-10 shadow-2xl space-y-5 md:space-y-6`}>
            <div className="flex justify-between items-center"><h3 className="text-xl md:text-2xl font-semibold ">Nova Versão</h3><button onClick={() => setIsVersionModalOpen(false)} className={`p-2 ${tc.bgHover} rounded-full`}><X size={20} /></button></div>
            <input className={`w-full py-3 px-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-2xl font-bold outline-none text-sm focus:border-blue-500 transition-colors`} placeholder="Novo link..." value={newDriveLink} onChange={e => setNewDriveLink(e.target.value)} />
            <button onClick={handleSendNewVersion} disabled={!newDriveLink || loading} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-semibold text-[12px]  flex justify-center items-center gap-2 disabled:opacity-50 transition-colors">
              {loading ? <Loader2 size={16} className="animate-spin" /> : null} Atualizar
            </button>
          </div>
        </div>
      )}

      {isDeleteClientModalOpen && clientToDelete && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className={`${tc.bgCard} border ${theme === 'dark' ? 'border-zinc-800' : 'border-transparent'} w-[95%] max-w-md rounded-2xl md:rounded-2xl p-5 md:p-10 shadow-2xl text-left space-y-5 md:space-y-6`}>
            <div className="flex justify-between items-center">
              <h3 className="text-xl md:text-2xl font-semibold text-red-500 flex items-center gap-2">
                <AlertCircle size={24} /> Excluir
              </h3>
              <button onClick={() => setIsDeleteClientModalOpen(false)} className={`p-2 ${tc.textMuted} ${tc.bgHover} rounded-full transition-all`}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <p className={`${tc.textMuted} text-sm md:text-base font-medium leading-relaxed`}>
                Tem a certeza que deseja excluir permanentemente o cliente <strong className={`${tc.textMain} `}>{clientToDelete.nome}</strong>?
              </p>

              <div className={`${theme === 'dark' ? 'bg-red-900/20 border-red-900/30' : 'bg-red-50 border-red-100'} border p-4 rounded-2xl`}>
                <p className={`text-red-500 text-[11px] md:text-[12px] font-bold flex gap-2`}>
                  <AlertCircle size={16} className="shrink-0" />
                  ATENÇÃO: Esta ação é irreversível. Todos os materiais, guias, links e históricos associados a este cliente serão apagados para sempre.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button onClick={() => setIsDeleteClientModalOpen(false)} disabled={loading} className={`w-full sm:flex-1 py-3.5 ${theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'} ${tc.textMuted} hover:${tc.textMain} rounded-xl md:rounded-2xl font-semibold  text-[12px]  transition-colors`}>Cancelar</button>
              <button onClick={async () => { setLoading(true); const { error } = await supabase.from('clientes').delete().eq('id', clientToDelete.id); if (error) { toast.error("Erro ao excluir: " + error.message); } else { toast.success("Cliente excluído com sucesso!"); loadData(); } setLoading(false); setIsDeleteClientModalOpen(false); setClientToDelete(null); }} disabled={loading} className="w-full sm:flex-1 py-3.5 bg-red-600 text-white rounded-xl md:rounded-2xl font-semibold text-[12px]  hover:bg-red-700 shadow-lg shadow-red-500/20 transition-all flex justify-center items-center gap-2">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <><Trash2 size={16} /> Sim, Excluir</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {isArchiveCycleModalOpen && cycleToArchive && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className={`${tc.bgCard} border ${theme === 'dark' ? 'border-zinc-800' : 'border-transparent'} w-[95%] max-w-md rounded-2xl md:rounded-2xl p-5 md:p-10 shadow-2xl text-left space-y-5 md:space-y-6`}>
            <div className="flex justify-between items-center">
              <h3 className={`text-xl md:text-2xl font-semibold  ${tc.textMain} flex items-center gap-2`}>
                <Archive size={24} className={tc.textMuted} /> Arquivar Ciclo
              </h3>
              <button onClick={() => setIsArchiveCycleModalOpen(false)} className={`p-2 ${tc.textMuted} ${tc.bgHover} rounded-full transition-all`}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <p className={`${tc.textMuted} text-sm md:text-base font-medium leading-relaxed`}>
                Tem a certeza que deseja arquivar todas as <strong className={tc.textMain}>{cycleToArchive.itens.length} tarefas</strong> do <strong className={`${tc.textMain} `}>{cycleToArchive.cicloLabel}</strong>?
              </p>

              <div className={`${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border p-4 rounded-2xl`}>
                <p className={`${tc.textMuted} text-[11px] md:text-[12px] font-bold flex gap-2`}>
                  <CheckCircle2 size={16} className="shrink-0 opacity-50" />
                  As tarefas serão marcadas como "Concluídas" e desaparecerão das listas de pendências de toda a equipe e do portal do cliente.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button onClick={() => setIsArchiveCycleModalOpen(false)} disabled={loading} className={`w-full sm:flex-1 py-3.5 ${theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'} ${tc.textMuted} hover:${tc.textMain} rounded-xl md:rounded-2xl font-semibold  text-[12px]  transition-colors disabled:opacity-50`}>Cancelar</button>
              <button onClick={async () => { setLoading(true); const ids = cycleToArchive.itens.map(i => i.id); const { error } = await supabase.from('materiais').update({ status: 'concluido' }).in('id', ids); if (error) { toast.error("Erro ao arquivar: " + error.message); } else { toast.success(`${cycleToArchive.cicloLabel} arquivado com sucesso!`); loadData(); } setLoading(false); setIsArchiveCycleModalOpen(false); setCycleToArchive(null); }} disabled={loading} className={`w-full sm:flex-1 py-3.5 ${theme === 'dark' ? 'bg-white text-black hover:bg-zinc-200' : 'bg-[#1A1A1A] hover:bg-black text-white'} rounded-xl md:rounded-2xl font-semibold  text-[12px]  transition-colors flex justify-center items-center gap-2 disabled:opacity-50`}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : <><Archive size={16} /> Sim, Arquivar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {incompleteApprovalData && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className={`${tc.bgCard} border ${theme === 'dark' ? 'border-zinc-800' : 'border-transparent'} w-[95%] max-w-md rounded-2xl md:rounded-2xl p-5 md:p-10 shadow-2xl text-left space-y-5 md:space-y-6`}>
            <div className="flex justify-between items-center">
              <h3 className="text-xl md:text-2xl font-semibold text-orange-500 flex items-center gap-2">
                <AlertCircle size={24} /> Entrega Parcial
              </h3>
              <button onClick={() => setIncompleteApprovalData(null)} className={`p-2 ${tc.textMuted} ${tc.bgHover} rounded-full transition-all`}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <p className={`${tc.textMuted} text-sm md:text-base font-medium leading-relaxed`}>
                O material <strong className={`${tc.textMain} `}>{incompleteApprovalData.material.titulo}</strong> ainda não está completo.
              </p>

              <div className={`${theme === 'dark' ? 'bg-orange-900/20 border-orange-900/30' : 'bg-orange-50 border-orange-100'} border p-4 rounded-2xl`}>
                <p className={`text-orange-500 text-[11px] md:text-[12px] font-bold flex flex-col gap-2`}>
                  <span className="flex items-center gap-2"><AlertCircle size={16} className="shrink-0" /> Faltam entregar:</span>
                  {incompleteApprovalData.missingVideo && <span className="ml-6">- Link do Vídeo / Post</span>}
                  {incompleteApprovalData.missingDesign && <span className="ml-6">- Link da Capa / Design</span>}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button onClick={() => setIncompleteApprovalData(null)} disabled={actionLoading === incompleteApprovalData.material.id} className={`w-full sm:flex-1 py-3.5 ${theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'} ${tc.textMuted} hover:${tc.textMain} rounded-xl md:rounded-2xl font-semibold  text-[12px]  transition-colors`}>Aguardar Equipe</button>
              <button onClick={() => { handleAprovarParaCliente(incompleteApprovalData.material.id); setIncompleteApprovalData(null); }} disabled={actionLoading === incompleteApprovalData.material.id} className="w-full sm:flex-1 py-3.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl md:rounded-2xl font-semibold text-[12px]  transition-colors flex justify-center items-center gap-2">
                {actionLoading === incompleteApprovalData.material.id ? <Loader2 size={16} className="animate-spin" /> : <><Send size={16} /> Enviar Mesmo Assim</>}
              </button>
            </div>
          </div>
        </div>
      )}

      
      {/* MODAL DE HISTÓRICO DE DELEGAÇÕES (COMPLETO) */}
      {delegacaoModalAberto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className={`${tc.bgCard} border ${theme === 'dark' ? 'border-zinc-800' : 'border-transparent'} rounded-2xl p-6 w-full max-w-md shadow-2xl text-left flex flex-col max-h-[90vh]`}>
            <div className="flex justify-between items-center mb-4 shrink-0">
              <h3 className={`font-bold text-lg  ${tc.textMain}`}>Histórico da Tarefa</h3>
              <button onClick={() => setDelegacaoModalAberto(false)} className={`${tc.textMuted} ${tc.bgHover} p-2 rounded-full transition-colors`}>
                <X size={18} />
              </button>
            </div>
            
            <p className={`text-sm ${tc.textMuted} mb-4 truncate font-medium border-b ${tc.borderStrong} pb-2 shrink-0`}>{nomeMaterialDelegacao}</p>
            
            <div className="overflow-y-auto space-y-4 pr-2 flex-1">
              <div className="space-y-3">
                <div className="text-[11px] font-semibold text-zinc-500 mb-2">Linha do Tempo</div>
                {delegacaoLogsAtuais.length === 0 ? (
                  <p className={`text-center text-sm ${tc.textMuted} py-4 font-bold`}>Nenhum registro encontrado.</p>
                ) : (
                  delegacaoLogsAtuais.map((log, index) => {
                    const dataFormatada = new Date(log.created_at).toLocaleString('pt-BR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    });
                    return (
                      <div key={index} className={`flex flex-col p-3 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-100'} border rounded-xl relative`}>
                        <span className={`text-sm font-bold ${tc.textMain}`}>{log.evento}</span>
                        <span className={`text-[11px] font-semibold   ${tc.textMuted} mt-1`}>{dataFormatada}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {logsModalAberto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className={`${tc.bgCard} border ${theme === 'dark' ? 'border-zinc-800' : 'border-transparent'} rounded-2xl p-6 w-full max-w-md shadow-2xl text-left`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className={`font-bold text-lg  ${tc.textMain}`}>Histórico de Visualizações</h3>
              <button onClick={() => setLogsModalAberto(false)} className={`${tc.textMuted} ${tc.bgHover} p-2 rounded-full transition-colors`}>
                <X size={18} />
              </button>
            </div>
            <p className={`text-sm ${tc.textMuted} mb-4 truncate font-medium border-b ${tc.borderStrong} pb-2`}>{nomeMaterialLog}</p>
            <div className="max-h-[300px] overflow-y-auto space-y-3 pr-2">
              {logsAtuais.length === 0 ? (
                <p className={`text-center text-sm ${tc.textMuted} py-4 font-bold`}>O cliente ainda não abriu este material.</p>
              ) : (
                logsAtuais.map((log, index) => {
                  const dataFormatada = new Date(log.created_at).toLocaleString('pt-BR', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  });
                  return (
                    <div key={index} className={`flex flex-col p-3 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-100'} border rounded-xl`}>
                      <span className={`text-sm font-bold ${tc.textMain}`}>{log.evento}</span>
                      <span className={`text-[11px] font-semibold   ${tc.textMuted} mt-1`}>{dataFormatada}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {previewUrl && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black p-4 animate-in fade-in duration-300">
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 z-[10000] w-full px-4 justify-center">
            <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-6 py-3 bg-white/20 backdrop-blur-md text-white rounded-2xl hover:bg-white/30 transition-all border border-white/10 shadow-xl font-semibold text-[11px] ">
              <ExternalLink size={18} /> Abrir Original
            </a>
            <button onClick={() => setPreviewUrl(null)} className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-2xl hover:bg-red-600 transition-all shadow-xl font-semibold text-[11px] ">
              <X size={20} /> Fechar
            </button>
          </div>
          <div className="w-full h-[80vh] md:h-full max-w-7xl mx-auto flex items-center justify-center overflow-hidden p-2 md:p-10 mb-20 md:mb-0">
            {renderPreviewContent(previewUrl)}
          </div>
        </div>
      )}

      {isScheduleModalOpen && materialToSchedule && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 animate-in fade-in duration-300">
          <div className={`${tc.bgCard} border ${tc.borderStrong} w-full max-w-md rounded-2xl md:rounded-2xl p-6 md:p-10 shadow-2xl space-y-5 md:space-y-6 overflow-hidden flex flex-col max-h-[90vh]`}>
            <div className="flex justify-between items-center shrink-0">
              <h3 className={`text-xl md:text-2xl font-semibold  ${tc.textMain} flex items-center gap-2`}>
                <Clock size={24} className="text-blue-500" /> Agendar Envio
              </h3>
              <button onClick={() => setIsScheduleModalOpen(false)} className={`p-2 ${tc.textMuted} ${tc.bgHover} rounded-full transition-all`}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 w-full overflow-hidden">
              <p className={`${tc.textMuted} text-sm font-medium leading-relaxed px-1`}>
                Escolha quando o cliente deve receber a notificação de <strong className={`${tc.textMain} break-normal`}>{materialToSchedule.titulo}</strong>:
              </p>

              <div className="relative group w-full" onClick={(e) => {
                const input = e.currentTarget.querySelector('input');
                if (input && 'showPicker' in input) {
                  try { (input as any).showPicker(); } catch (e) { }
                }
              }}>
                <input
                  type="datetime-local"
                  className={`w-full py-3.5 px-4 pr-12 ${tc.bgInput} border ${tc.borderStrong} rounded-2xl outline-none font-bold text-sm focus:border-blue-500 transition-all shadow-inner cursor-pointer [color-scheme:dark] appearance-none box-border`}
                  style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
                  value={scheduledDate}
                  onChange={e => setScheduledDate(e.target.value)}
                />
                <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" size={18} />
              </div>

              <p className="text-[11px] text-zinc-500 font-medium italic">
                💡 Clique no ícone de calendário para abrir o seletor visual ou digite manualmente.
              </p>

              <div className={`${theme === 'dark' ? 'bg-blue-900/10 border-blue-900/20' : 'bg-blue-50 border-blue-100'} border p-4 rounded-2xl`}>
                <p className="text-blue-600 text-[11px] md:text-[12px] font-bold flex gap-2 leading-relaxed">
                  <Activity size={16} className="shrink-0" />
                  O material continuará visível para você na lista de aprovação até o envio ser concluído.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2 md:pt-4">
              <button onClick={() => setIsScheduleModalOpen(false)} className={`w-full sm:flex-1 py-3.5 ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-100'} ${tc.textMuted} rounded-xl md:rounded-2xl font-semibold  text-[12px]  transition-colors`}>Voltar</button>
              <button
                onClick={handleAgendarParaCliente}
                disabled={!scheduledDate || actionLoading === materialToSchedule.id}
                className="w-full sm:flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl md:rounded-2xl font-semibold text-[12px]  transition-colors flex justify-center items-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-50"
              >
                {actionLoading === materialToSchedule.id ? <Loader2 size={16} className="animate-spin" /> : <><CheckCircle2 size={16} /> Confirmar</>}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {batchApprovalData && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 animate-in fade-in duration-300">
          <div className={`${tc.bgCard} border ${tc.borderStrong} w-full max-w-md rounded-2xl md:rounded-2xl p-6 md:p-10 shadow-2xl space-y-5 md:space-y-6 overflow-hidden flex flex-col max-h-[90vh]`}>
            <div className="flex justify-between items-center shrink-0">
              <h3 className={`text-xl md:text-2xl font-semibold  ${tc.textMain} flex items-center gap-2`}>
                <Clock size={24} className="text-purple-500" /> Aprovar Lote
              </h3>
              <button onClick={() => setBatchApprovalData(null)} className={`p-2 ${tc.textMuted} ${tc.bgHover} rounded-full transition-all`}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 w-full overflow-hidden">
              <p className={`${tc.textMuted} text-sm font-medium leading-relaxed px-1`}>
                Agendar aprovação do lote <strong className={`${tc.textMain} break-normal`}>{batchApprovalData.cicloLabel}</strong>:
              </p>

              <div className="relative group w-full" onClick={(e) => {
                const input = e.currentTarget.querySelector('input');
                if (input && 'showPicker' in input) {
                  try { (input as any).showPicker(); } catch (e) { }
                }
              }}>
                <input
                  type="datetime-local"
                  className={`w-full py-3.5 px-4 pr-12 ${tc.bgInput} border ${tc.borderStrong} rounded-2xl outline-none font-bold text-sm focus:border-purple-500 transition-all shadow-inner cursor-pointer [color-scheme:dark] appearance-none box-border`}
                  style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
                  value={batchScheduleDate}
                  onChange={e => setBatchScheduleDate(e.target.value)}
                />
                <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-purple-500 transition-colors pointer-events-none" size={18} />
              </div>

              <div className={`${theme === 'dark' ? 'bg-purple-900/10 border-purple-900/20' : 'bg-purple-50 border-purple-100'} border p-4 rounded-2xl`}>
                <p className="text-purple-600 text-[11px] md:text-[12px] font-bold flex gap-2 leading-relaxed">
                  <Activity size={16} className="shrink-0" />
                  Deixe a data em branco para aprovar imediatamente.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2 md:pt-4">
              <button
                onClick={() => setBatchApprovalData(null)}
                className={`w-full sm:flex-1 py-3.5 ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-100'} ${tc.textMuted} rounded-xl md:rounded-2xl font-semibold  text-[12px]  transition-colors`}
              >
                Voltar
              </button>
              <button
                onClick={() => {
                  handleAprovarLoteParaCliente(batchApprovalData.itens, batchScheduleDate);
                  setBatchApprovalData(null);
                }}
                disabled={loading}
                className="w-full sm:flex-1 py-3.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl md:rounded-2xl font-semibold text-[12px]  transition-colors flex justify-center items-center gap-2 shadow-lg shadow-purple-500/20 disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <><CheckCircle2 size={16} /> Confirmar</>}
              </button>
            </div>
          </div>
        </div>
      )}
{isApproveConfirmModalOpen && materialToApproveFinal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className={`${tc.bgCard} border ${theme === 'dark' ? 'border-zinc-800' : 'border-transparent'} w-[95%] max-w-md rounded-2xl md:rounded-2xl p-5 md:p-10 shadow-2xl text-left space-y-5 md:space-y-6`}>
            <div className="flex justify-between items-center">
              <h3 className="text-xl md:text-2xl font-semibold text-green-500 flex items-center gap-2">
                <CheckCircle2 size={24} /> Aprovar para o cliente
              </h3>
              <button onClick={() => setIsApproveConfirmModalOpen(false)} className={`p-2 ${tc.textMuted} ${tc.bgHover} rounded-full transition-all`}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <p className={`${tc.textMuted} text-sm md:text-base font-medium leading-relaxed`}>
                Tem certeza que deseja enviar o material <strong className={`${tc.textMain} `}>{materialToApproveFinal.titulo}</strong> para o portal do cliente?
              </p>

              <div className={`${theme === 'dark' ? 'bg-green-900/20 border-green-900/30' : 'bg-green-50 border-green-100'} border p-4 rounded-2xl`}>
                <p className={`text-green-600 text-[11px] md:text-[12px] font-bold flex gap-2`}>
                  <Send size={16} className="shrink-0" />
                  Isso irá notificar o cliente via WhatsApp e disponibilizar o material para aprovação final.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2 md:pt-4">
              <button onClick={() => { setMaterialToSchedule(materialToApproveFinal); setIsScheduleModalOpen(true); setIsApproveConfirmModalOpen(false); }} className={`w-full sm:flex-1 py-3.5 ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-100'} ${tc.textMuted} rounded-xl md:rounded-2xl font-semibold  text-[12px]  transition-colors flex items-center justify-center gap-2 border border-transparent hover:border-zinc-500`}>
                <Clock size={16} /> Agendar
              </button>
              <button onClick={() => { handleAprovarParaCliente(materialToApproveFinal.id); setIsApproveConfirmModalOpen(false); }} disabled={actionLoading === materialToApproveFinal.id} className="w-full sm:flex-2 py-3.5 bg-green-600 hover:bg-green-700 text-white rounded-xl md:rounded-2xl font-semibold text-[12px]  transition-colors flex justify-center items-center gap-2 shadow-lg shadow-green-500/20">
                {actionLoading === materialToApproveFinal.id ? <Loader2 size={16} className="animate-spin" /> : <><Send size={16} /> Enviar Agora</>}
              </button>
            </div>
            <button onClick={() => setIsApproveConfirmModalOpen(false)} className={`w-full py-2 text-[11px] font-bold  ${tc.textMuted} hover:text-zinc-500 transition-colors`}>Cancelar</button>
          </div>
        </div>
      )}
      {isGruposModalOpen && (
        <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className={`${tc.bgCard} border ${tc.borderStrong} w-full max-w-lg rounded-2xl md:rounded-2xl p-5 md:p-8 shadow-2xl space-y-5 md:space-y-6 animate-in zoom-in-95`}>
            <div className="flex justify-between items-center">
              <div>
                <h3 className={`text-xl font-semibold  ${tc.textMain}`}>Grupos do WhatsApp</h3>
                <p className={`text-[12px] ${tc.textMuted} font-medium mt-1`}>Pesquise e selecione o grupo para vincular ao cliente.</p>
              </div>
              <button onClick={() => setIsGruposModalOpen(false)} className={`p-2 ${tc.textMuted} ${tc.bgHover} rounded-full`}><X size={20} /></button>
            </div>

            <div className="relative">
              <Search className={`absolute left-4 top-1/2 -translate-y-1/2 ${tc.textMuted}`} size={18} />
              <input
                type="text"
                placeholder="Pesquisar grupo por nome..."
                className={`w-full pl-12 pr-4 py-4 ${tc.bgInput} border ${tc.borderStrong} rounded-2xl outline-none font-bold text-sm focus:border-green-500 transition-colors`}
                value={buscaGrupo}
                onChange={e => setBuscaGrupo(e.target.value)}
              />
            </div>

            <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {(() => {
                const filtrados = listagemGrupos.filter(g => {
                  const searchId = g.id || g.phone || g.groupId || '';
                  return g.name?.toLowerCase().includes(buscaGrupo.toLowerCase()) ||
                    searchId.toLowerCase().includes(buscaGrupo.toLowerCase());
                });

                if (filtrados.length === 0) {
                  return <div className="py-10 text-center opacity-30 font-bold">Nenhum grupo encontrado.
</div>}

                return filtrados.map((g, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      const extractedId = g.id || g.phone || g.groupId || '';
                      setWppGroupId(extractedId);
                      setIsGruposModalOpen(false);
                      setBuscaGrupo('');
                      toast.success(`Grupo selecionado: ${g.name}`);
                    }}
                    className={`w-full flex items-center justify-between p-4 ${tc.bgHover} border ${tc.borderStrong} rounded-2xl transition-all group`}
                  >
                    <div className="text-left">
                      <p className="font-bold text-sm group-hover:text-green-500 transition-colors truncate max-w-[200px] md:max-w-none">{g.name || 'Grupo sem nome'}</p>
                      <p className={`text-[11px] font-mono ${tc.textMuted} truncate max-w-[200px] md:max-w-none`}>{g.id || g.phone || g.groupId || 'ID não encontrado'}</p>
                    </div>
                    <div className={`p-2 ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-100'} rounded-lg group-hover:bg-green-500 group-hover:text-white transition-colors`}>
                      <CheckCircle2 size={14} />
                    </div>
                  </button>
                ));
              })()}
            </div>

            <button onClick={() => setIsGruposModalOpen(false)} className="w-full py-4 font-semibold text-[11px]  bg-zinc-100 dark:bg-zinc-800 rounded-2xl">Fechar</button>
          </div>
        </div>
      )}
      {/* MODAL DE CONFIRMAÇÃO PERSONALIZADO */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className={`${tc.bgCard} w-full max-w-sm rounded-2xl p-8 shadow-2xl border ${theme === 'dark' ? 'border-zinc-800' : 'border-transparent'} text-center space-y-6`}>
            <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${confirmConfig.type === 'danger' ? 'bg-red-500/20 text-red-500' : 'bg-amber-500/20 text-amber-500'}`}>
              {confirmConfig.type === 'danger' ? <Trash2 size={32} /> : <AlertTriangle size={32} />}
            </div>
            <div>
              <h3 className="text-xl font-semibold ">{confirmConfig.title}</h3>
              <p className={`mt-2 text-sm ${tc.textMuted} font-medium`}>{confirmConfig.text}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setIsConfirmModalOpen(false)} className={`py-4 rounded-2xl font-semibold  text-[11px] ${theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'}`}>Cancelar</button>
              <button
                onClick={() => { confirmConfig.onConfirm(); setIsConfirmModalOpen(false); }}
                className={`py-4 rounded-2xl font-semibold  text-[11px] text-white ${confirmConfig.type === 'danger' ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20' : 'bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-600/20'}`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
      {isEditTituloModalOpen && materialBeingEdited && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className={`${tc.bgCard} border ${theme === 'dark' ? 'border-zinc-800' : 'border-transparent'} w-[95%] max-w-md rounded-2xl p-5 md:p-8 shadow-2xl space-y-5 md:space-y-6 text-left`}>
            <div className="flex justify-between items-center">
              <h3 className="text-xl md:text-2xl font-semibold flex items-center gap-2"><Edit3 size={24} className="text-brand" /> Editar Título</h3>
              <button onClick={() => setIsEditTituloModalOpen(false)} className={`p-2 ${tc.bgHover} rounded-full`}><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <p className={`${tc.textMuted} text-sm font-medium`}>Altere o nome desta tarefa.</p>
              <input 
                className={`w-full py-3 px-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-2xl font-bold outline-none focus:border-brand text-sm transition-colors`} 
                value={novoTituloText} 
                onChange={e => setNovoTituloText(e.target.value)} 
                autoFocus
              />
            </div>
            <button onClick={handleSaveTitulo} disabled={loading || !novoTituloText.trim()} className="w-full py-4 bg-brand text-white rounded-2xl font-semibold text-[12px]  hover:brightness-90 flex items-center justify-center gap-2 disabled:opacity-50 transition-colors">
              {loading ? <Loader2 size={16} className="animate-spin" /> : null} Salvar Alterações
            </button>
          </div>
        </div>
      )}
    

    

      {/* CONVERSA COM O CLIENTE (pedidos de ajuste + mensagens, tudo junto). Painel lateral, no padrão do painel da tarefa. */}
      {timelineMaterial && (() => {
        const tm = materiais.find(x => x.id === timelineMaterial.id) || timelineMaterial;
        return (
          <div className="fixed inset-0 z-[9999] flex justify-end bg-zinc-950/30 animate-in fade-in duration-200" onClick={() => setTimelineMaterial(null)}>
            <div onClick={(e) => e.stopPropagation()} className={`${tc.bgCard} w-full md:w-[520px] h-full shadow-2xl flex flex-col text-left animate-in slide-in-from-right duration-300`}>
              <div className={`px-5 py-4 border-b ${tc.borderStrong} flex items-start gap-3 shrink-0`}>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-zinc-500 truncate">{tm.cliente?.nome}{tm.ciclo ? ` · Ciclo ${tm.ciclo}` : ''}</div>
                  <h3 className={`text-lg font-semibold mt-0.5 leading-snug ${tc.textMain}`}>{tm.titulo}</h3>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {statusChip(statusOf(tm).label, statusOf(tm).cls)}
                    <button type="button" onClick={() => { setTimelineMaterial(null); openRoteiro(tm); }} className="text-xs font-medium text-brand hover:underline">Abrir tarefa</button>
                  </div>
                </div>
                <IconAction icon={X} label="Fechar" onClick={() => setTimelineMaterial(null)} />
              </div>
              {tm.feedback_admin && (
                <details className={`px-5 py-2.5 border-b ${tc.borderStrong} text-[13px] shrink-0`}>
                  <summary className="cursor-pointer text-zinc-500 select-none">Instrução interna para a equipe (o cliente não vê)</summary>
                  <p className={`mt-2 whitespace-pre-wrap ${tc.textMain}`}>{renderTextWithLinks(tm.feedback_admin.replace(/\[ID:[^\]]+\]/g, '').replace(/\[\/?(EDITOR|DESIGNER)\]/g, '').trim())}</p>
                </details>
              )}
              <div className={`px-5 py-2.5 border-b ${tc.borderStrong} flex items-center gap-2 shrink-0`}>
                <span className="text-[13px] font-semibold">Conversa com o cliente</span>
                <label className="ml-auto inline-flex items-center gap-1.5 text-xs text-zinc-500 cursor-pointer select-none" title="Manda uma mensagem no WhatsApp do cliente avisando que há resposta no portal">
                  <input type="checkbox" checked={avisarWppConversa} onChange={(e) => setAvisarWppConversa(e.target.checked)} className="accent-brand" />
                  Avisar no WhatsApp
                </label>
              </div>
              <ConversaMaterial
                className="flex-1 min-h-0"
                mensagens={conversaAdmin}
                carregando={carregandoConversaAdmin}
                perspectiva="equipe"
                dark={theme === 'dark'}
                onEnviar={(envio) => enviarConversaAdmin(tm, envio)}
                placeholder="Responder ao cliente…"
                vazio="Nenhum pedido ou mensagem do cliente sobre este conteúdo ainda."
              />
            </div>
          </div>
        );
      })()}


      {batchApprovalData && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 animate-in fade-in duration-300">
          <div className={`${tc.bgCard} border ${tc.borderStrong} w-full max-w-md rounded-2xl md:rounded-2xl p-6 md:p-10 shadow-2xl space-y-5 md:space-y-6 overflow-hidden flex flex-col max-h-[90vh]`}>
            <div className="flex justify-between items-center shrink-0">
              <h3 className={`text-xl md:text-2xl font-semibold  ${tc.textMain} flex items-center gap-2`}>
                <Clock size={24} className="text-purple-500" /> Aprovar Lote
              </h3>
              <button onClick={() => setBatchApprovalData(null)} className={`p-2 ${tc.textMuted} ${tc.bgHover} rounded-full transition-all`}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 w-full overflow-hidden">
              <p className={`${tc.textMuted} text-sm font-medium leading-relaxed px-1`}>
                Agendar aprovação do lote <strong className={`${tc.textMain} break-normal`}>{batchApprovalData.cicloLabel}</strong>:
              </p>

              <div className="relative group w-full" onClick={(e) => {
                const input = e.currentTarget.querySelector('input');
                if (input && 'showPicker' in input) {
                  try { (input as any).showPicker(); } catch (e) { }
                }
              }}>
                <input
                  type="datetime-local"
                  className={`w-full py-3.5 px-4 pr-12 ${tc.bgInput} border ${tc.borderStrong} rounded-2xl outline-none font-bold text-sm focus:border-purple-500 transition-all shadow-inner cursor-pointer [color-scheme:dark] appearance-none box-border`}
                  style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
                  value={batchScheduleDate}
                  onChange={e => setBatchScheduleDate(e.target.value)}
                />
                <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-purple-500 transition-colors pointer-events-none" size={18} />
              </div>

              <div className={`${theme === 'dark' ? 'bg-purple-900/10 border-purple-900/20' : 'bg-purple-50 border-purple-100'} border p-4 rounded-2xl`}>
                <p className="text-purple-600 text-[11px] md:text-[12px] font-bold flex gap-2 leading-relaxed">
                  <Activity size={16} className="shrink-0" />
                  Deixe a data em branco para aprovar imediatamente.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2 md:pt-4">
              <button
                onClick={() => setBatchApprovalData(null)}
                className={`w-full sm:flex-1 py-3.5 ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-100'} ${tc.textMuted} rounded-xl md:rounded-2xl font-semibold  text-[12px]  transition-colors`}
              >
                Voltar
              </button>
              <button
                onClick={() => {
                  handleAprovarLoteParaCliente(batchApprovalData.itens, batchScheduleDate);
                  setBatchApprovalData(null);
                }}
                disabled={loading}
                className="w-full sm:flex-1 py-3.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl md:rounded-2xl font-semibold text-[12px]  transition-colors flex justify-center items-center gap-2 shadow-lg shadow-purple-500/20 disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <><CheckCircle2 size={16} /> Confirmar</>}
              </button>
            </div>
          </div>
        </div>
      )}

</div>
  )
}
