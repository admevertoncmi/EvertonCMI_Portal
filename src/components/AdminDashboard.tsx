"use client"

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { Toaster, toast } from 'sonner'
import { criarMembroEquipe, atualizarMembroEquipe, excluirMembro } from '@/actions/equipe'
import { cadastrarClienteCompleto } from '@/actions/clientes'
import { notificarClickUpChat, getClickUpTaskAndSubtasks, getClickUpTask } from '@/actions/clickup'
import { notificarWhatsApp, buscarGruposWhatsApp } from '@/actions/whatsapp'
import { useAdminData } from '@/hooks/useAdminData'
import { getDriveFolderFiles } from '@/actions/google'
import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import GoogleDrivePicker from '@/components/GoogleDrivePicker'
import {
  LayoutDashboard, Users, Plus, LogOut, Phone, Link, Send,
  Trash2, ExternalLink, RotateCcw, X, MessageSquare,
  TrendingUp, CheckCircle, Clock, RefreshCw, Download,
  ChevronRight, Calendar, Search, Folder, ShieldCheck,
  Upload, Bell, Eye, UploadCloud, CheckCircle2, ClipboardCheck,
  ListTodo, FileText, LayoutList, Archive, Edit3, AlertCircle, Menu, Loader2, Activity, Settings,
  FileVideo, Image as ImageIcon, ChevronDown, PlayCircle, PenTool, Sun, Moon, Flame, AlertTriangle
} from 'lucide-react'

export interface Cliente { id: string; nome: string; telefone: string; token_magico: string; wpp_suporte?: string; ciclos_contratados?: number; logo_url?: string; cor_marca?: string; whatsapp_group_id?: string; }
export interface EquipeMember { id: string; email: string; nome?: string; role: 'admin' | 'editor' | 'planner' | 'designer'; telegram_thread_id?: string; created_at?: string; }
export interface Material { id: string; cliente_id: string; titulo: string; ciclo?: string | number; link_drive?: string; link_capa?: string; link_organizado?: string; link_bruto?: string; data_limite?: string; roteiro?: string; video_entregue?: boolean; design_entregue?: boolean; status: any; created_at: string; feedback?: string | null; feedback_admin?: string | null; editor_id?: string | null; designer_id?: string | null; planner_id?: string | null; clickup_task_id?: string | null; cliente?: Cliente; agendado_para?: string | null; wpp_enviado?: boolean; }
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

const getRawVideoUrl = (url: string) => {
  if (!url) return '';
  const driveMatch1 = /\/file\/d\/([a-zA-Z0-9_-]+)/.exec(url);
  if (driveMatch1?.[1]) return `https://drive.google.com/uc?export=download&id=${driveMatch1[1]}`;
  const driveMatch2 = /id=([a-zA-Z0-9_-]+)/.exec(url);
  if (driveMatch2?.[1] && url.includes('drive.google.com')) return `https://drive.google.com/uc?export=download&id=${driveMatch2[1]}`;
  return url;
}

export function AdminDashboard({ materials: initialMaterials, initialClientes = [] }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [theme, setTheme] = useState<'dark' | 'light'>('light')

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
    const cleanText = getCleanText(text);
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = cleanText.split(urlRegex);
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all">
            {part}
          </a>
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
  const [editingMembro, setEditingMembro] = useState<MembroComNome | null>(null);
  const [activeTab, setActiveTab] = useState<'geral' | 'planejamento' | 'cadastro-clientes' | 'equipe' | 'solicitacao-ajustes' | 'materiais-aprovacao' | 'materiais-aprovados' | 'relatorios'>('planejamento')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [isCreatingUser, setIsCreatingUser] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [expandedClients, setExpandedClients] = useState<string[]>([])
  const [expandedCiclos, setExpandedCiclos] = useState<string[]>([])
  const [expandedFeedbacks, setExpandedFeedbacks] = useState<string[]>([]);
  const toggleFeedback = (id: string) => setExpandedFeedbacks(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const [isDelegateModalOpen, setIsDelegateModalOpen] = useState(false)
  const [delegationType, setDelegationType] = useState<'editor' | 'planner'>('editor')
  const [adminFeedback, setAdminFeedback] = useState('')
  const [delegationDeadline, setDelegationDeadline] = useState('')
  const [selectedPlannerId, setSelectedPlannerId] = useState('')
  const [selectedEditorId, setSelectedEditorId] = useState('')
  const [selectedDesignerId, setSelectedDesignerId] = useState('')
  const [selectedCicloDelegation, setSelectedCicloDelegation] = useState<{ clienteId: string, ciclo: string, itens: Material[], clienteNome: string } | null>(null)
  const [selectedItemsToDelegate, setSelectedItemsToDelegate] = useState<string[]>([])
  const [formM, setFormM] = useState({ cliente_id: '', titulo: '', link_drive: '', ciclo: '1' })
  const [searchTerm, setSearchTerm] = useState('')
  const [activeFilter, setActiveFilter] = useState('todos') // todos, urgentes, ajustes, pendentes
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    setHasMounted(true)
  }, [])

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; text: string; onConfirm: () => void; type: 'danger' | 'warning' }>({
    title: '', text: '', onConfirm: () => {}, type: 'warning'
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
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null)
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false)
  const [newDriveLink, setNewDriveLink] = useState('')
  const [isLinkBrutoModalOpen, setIsLinkBrutoModalOpen] = useState(false)
  const [newLinkBruto, setNewLinkBruto] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewRoteiro, setPreviewRoteiro] = useState<Material | null>(null);
  const [isEditRoteiroModalOpen, setIsEditRoteiroModalOpen] = useState(false);
  const [roteiroToEdit, setRoteiroToEdit] = useState<Material | null>(null);
  const [newRoteiroText, setNewRoteiroText] = useState('');
  const [isResolveIssueModalOpen, setIsResolveIssueModalOpen] = useState(false);
  const [resolveText, setResolveText] = useState('');
  const [resolveLinkBruto, setResolveLinkBruto] = useState('');
  const [isDeleteClientModalOpen, setIsDeleteClientModalOpen] = useState(false)
  const [clientToDelete, setClientToDelete] = useState<Cliente | null>(null)
  const [isArchiveCycleModalOpen, setIsArchiveCycleModalOpen] = useState(false)
  const [cycleToArchive, setCycleToArchive] = useState<{ itens: Material[], cicloLabel: string } | null>(null)
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
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [materialToSchedule, setMaterialToSchedule] = useState<Material | null>(null);

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
    filaProblemasDecupagem,
    filaProducaoPronta,
    filaMateriaisAprovacao,
    notificacoesAjustes,
    filaMateriaisAprovados,
    editores,
    designers,
    planners
  } = useAdminData(initialMaterials, initialClientes);

  const renderDeadline = (date: string | null) => {
    if (!date || !hasMounted) return null;
    const now = new Date();
    const d = new Date(date);
    const diff = d.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (days < 0) return <span className="text-[8px] font-black text-red-500 uppercase flex items-center gap-1 animate-pulse"><Flame size={8} /> Atrasado há {Math.abs(days)}d</span>;
    if (days === 0) return <span className="text-[8px] font-black text-orange-500 uppercase flex items-center gap-1"><Clock size={8} /> Entrega Hoje</span>;
    if (days <= 2) return <span className="text-[8px] font-black text-amber-500 uppercase flex items-center gap-1"><Clock size={8} /> Entrega em {days}d</span>;
    return <span className="text-[8px] font-black text-zinc-400 uppercase flex items-center gap-1"><Calendar size={8} /> {days}d restantes</span>;
  };

  const applyFilters = useCallback((list: Material[]) => {
    return list.filter(m => {
      const matchSearch = !searchTerm || 
        m.titulo.toLowerCase().includes(searchTerm.toLowerCase()) || 
        m.cliente?.nome?.toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchFilter = true;
      if (activeFilter === 'urgentes') {
        matchFilter = !!m.data_limite && new Date(m.data_limite) < new Date();
      } else if (activeFilter === 'ajustes') {
        matchFilter = m.status === 'ajustes';
      } else if (activeFilter === 'pendentes') {
        matchFilter = m.status === 'pendente' || m.status === 'roteiro_pendente' || m.status === 'revisao';
      }
      
      return matchSearch && matchFilter;
    });
  }, [searchTerm, activeFilter]);

  const groupItems = useCallback((list: Material[]) => {
    const groups: Record<string, any> = {}
    applyFilters(list).forEach(m => {
      if (!m.cliente_id) return;
      if (!groups[m.cliente_id]) groups[m.cliente_id] = { cliente: m.cliente || { nome: 'S/N' }, ciclos: {} }
      const cicloLabel = `CICLO ${m.ciclo || 1}`
      if (!groups[m.cliente_id].ciclos[cicloLabel]) groups[m.cliente_id].ciclos[cicloLabel] = { itens: [], aprovados: 0, total: 0 }
      groups[m.cliente_id].ciclos[cicloLabel].itens.push(m)
      groups[m.cliente_id].ciclos[cicloLabel].total++
      if (m.status === 'aprovado' || m.status === 'roteiro_aprovado' || m.status === 'post_aprovado') groups[m.cliente_id].ciclos[cicloLabel].aprovados++
    })
    return groups
  }, [applyFilters])

  const groupedVisaoGeral = useMemo(() => {
    const filtered = materiais.filter(m => showArchived ? m.status === 'concluido' : m.status !== 'concluido')
    return groupItems(filtered)
  }, [materiais, showArchived, groupItems])

  const groupedAnaliseRoteiro = useMemo(() => groupItems(filaAnaliseRoteiro), [filaAnaliseRoteiro, groupItems]);
  const groupedProblemasDecupagem = useMemo(() => groupItems(filaProblemasDecupagem), [filaProblemasDecupagem, groupItems]);
  const groupedRoteiros = useMemo(() => groupItems(filaRoteirosAprovados), [filaRoteirosAprovados, groupItems]);
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

      const isAtrasado = m.data_limite && new Date(m.data_limite) < hoje && !['aprovado', 'post_aprovado', 'concluido'].includes(m.status);

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

    const topAjustesClientes = Object.values(clienteStats).sort((a, b) => b.ajustes - a.ajustes).slice(0, 5);
    const topPerformance = Object.values(performance).sort((a, b) => b.entregas - a.entregas);
    const topAjustesEquipe = Object.values(performance).filter(p => p.role !== 'admin' && p.ajustesHistoricos > 0).sort((a, b) => b.ajustesHistoricos - a.ajustesHistoricos);
    const totalAtrasos = Object.values(performance).reduce((acc, p) => acc + p.atrasos, 0);

    return { 
      performance: topPerformance, 
      topClientes: Object.values(clienteStats).sort((a, b) => b.total - a.total).slice(0, 5),
      topAjustesClientes,
      topAjustesEquipe,
      totalAtrasos
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
      // Ao voltar para o roteiro, limpamos os links para que a tarefa apareça no Planejamento (Roteiros Aprovados)
      if (newStatus === 'roteiro_aprovado' || newStatus === 'aprovado') {
        updatePayload.link_bruto = null;
        updatePayload.link_drive = null;
        updatePayload.link_capa = null;
      }
    } else if (newStatus === 'planejamento' || newStatus === 'em_organizacao') {
      updatePayload.editor_id = null;
      updatePayload.designer_id = null;
    }

    await supabase.from('materiais').update(updatePayload).eq('id', id);

    if (material) {
      if (newStatus === 'faltando_material' || newStatus === 'verificar_material') {
        const p = membros.find(m => m.id === material.planner_id);
        await notificarClickUpChat(`🔔 PROBLEMA NA PRODUÇÃO\n\n${material.cliente?.nome}\n${material.titulo?.toUpperCase()}\n🔔 VERIFICAR PASTA OU ARQUIVOS`, (p as any)?.telegram_thread_id);
      }
      else if (newStatus === 'revisao') {
        await notificarClickUpChat(`🎬 EDIÇÃO PRONTA\n\n${material.cliente?.nome}\n${material.titulo?.toUpperCase()}\n🔔 AGUARDANDO REVISÃO AGÊNCIA`);
      }
      else if (newStatus === 'organizado') {
        await notificarClickUpChat(`📁 PASTA PRONTA (DECUPAGEM)\n\n${material.cliente?.nome}\n${material.titulo?.toUpperCase()}`);
      }
      else if (['aprovado', 'roteiro_aprovado', 'post_aprovado'].includes(newStatus)) {
        const label = newStatus === 'roteiro_aprovado' ? 'ROTEIRO APROVADO' : 'POST APROVADO';
        const icon = newStatus === 'roteiro_aprovado' ? '📝✅' : '✅';
        await notificarClickUpChat(`${icon} ${label}\n\n${material.cliente?.nome}\n${material.titulo?.toUpperCase()}`);
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
      feedback_admin: resolveText,
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
      
      const msgResolvido = `🔔 PROBLEMA RESOLVIDO\n\n${selectedMaterial.cliente?.nome}\n${selectedMaterial.titulo?.toUpperCase()}\n\n📝 INSTRUÇÃO: ${resolveText.toUpperCase()}`;

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

  const handleSaveRoteiro = async () => {
    if (!roteiroToEdit) return; setLoading(true);
    const { error } = await supabase.from('materiais').update({ roteiro: newRoteiroText }).eq('id', roteiroToEdit.id);
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
        const linkPortal = `${window.location.origin}/portal/${material.cliente.token_magico}`;
        const textoMensagem = `Olá! O roteiro do material "${material.titulo}" já está disponível para a sua análise e aprovação. 📝\n\nAcesse o seu portal aqui: ${linkPortal}`;
        
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
        const linkPortal = `${window.location.origin}/portal/${material.cliente.token_magico}`;
        const textoMensagem = `Olá! O roteiro do material "${material.titulo}" foi revisado e ajustado conforme as suas pontuações. 📝✨\n\nPor favor, acesse o portal para reanalisar: ${linkPortal}`;
        
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
      toast.success(`${ids.length} roteiros enviados para aprovação do cliente!`);
      const primeiroItem = itens[0];
      if (primeiroItem?.cliente?.telefone && primeiroItem?.cliente?.token_magico) {
        const linkPortal = `${window.location.origin}/portal/${primeiroItem.cliente.token_magico}`;
        const textoMensagem = `Olá! Novos roteiros foram disponibilizados para a sua análise e aprovação. 📝\n\nAcesse o seu portal aqui: ${linkPortal}`;
        
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

  const handleAprovarLoteParaCliente = async (itens: Material[]) => {
    setLoading(true); const ids = itens.map(i => i.id);
    const { error } = await supabase.from('materiais').update({ status: 'pendente', feedback_admin: null, editor_id: null, designer_id: null }).in('id', ids);
    if (!error) {
      toast.success(`${ids.length} materiais aprovados para o cliente!`);
      const primeiroItem = itens[0];
      if (primeiroItem?.cliente?.telefone && primeiroItem?.cliente?.token_magico) {
        const linkPortal = `${window.location.origin}/portal/${primeiroItem.cliente.token_magico}`;
        const textoMensagem = `Olá! Novas edições/designs foram concluídos e estão disponíveis para a sua avaliação. 🎉\n\nAcesse o seu portal aqui: ${linkPortal}`;
        
        const groupId = primeiroItem.cliente.whatsapp_group_id;
        if (groupId) {
          toast.info("Enviando aviso automático para o grupo...");
          notificarWhatsApp(textoMensagem, groupId);
        } else {
          toast.info("Enviando aviso automático via WhatsApp...");
          notificarWhatsApp(textoMensagem, primeiroItem.cliente.telefone.replace(/\D/g, ''));
        }
      }
      loadData();
    } else { toast.error("Erro ao aprovar lote."); } setLoading(false);
  }

  const handleAvisarCicloWhatsApp = async (cliente?: Cliente, cicloLabel?: string) => {
    if (!cliente?.telefone || !cliente?.token_magico) return toast.error("Faltam dados de contacto deste cliente.");
    const linkPortal = `${window.location.origin}/portal/${cliente.token_magico}`;
    const textoMensagem = `Olá! Temos atualizações nos seus materiais do ${cicloLabel}. 🚀\n\nAcesse seu portal para verificar: ${linkPortal}`;
    
    if (cliente.whatsapp_group_id) {
       toast.info("Avisando cliente via grupo...");
       await notificarWhatsApp(textoMensagem, cliente.whatsapp_group_id);
    } else {
       toast.info("Avisando cliente via WhatsApp...");
       await notificarWhatsApp(textoMensagem, cliente.telefone.replace(/\D/g, ''));
    }
  };

  const handleAvisarPortalWhatsApp = async (cliente: Cliente) => {
    if (!cliente?.telefone || !cliente?.token_magico) return toast.error("Faltam dados de contacto deste cliente.");
    const linkPortal = `${window.location.origin}/portal/${cliente.token_magico}`;
    const textoMensagem = `Olá! O seu portal de acompanhamento já está disponível. 🚀\n\nAcesse aqui para ver os materiais: ${linkPortal}`;
    
    if (cliente.whatsapp_group_id) {
       toast.info("Avisando cliente via grupo...");
       await notificarWhatsApp(textoMensagem, cliente.whatsapp_group_id);
    } else {
       toast.info("Avisando cliente via WhatsApp...");
       await notificarWhatsApp(textoMensagem, cliente.telefone.replace(/\D/g, ''));
    }
  };

  const handleAprovarParaCliente = async (id: string) => {
    setActionLoading(id);
    const material = materiais.find(m => m.id === id);
    await supabase.from('materiais').update({ 
      status: 'pendente', 
      feedback_admin: null, 
      editor_id: null, 
      designer_id: null,
      wpp_enviado: true,
      agendado_para: null 
    }).eq('id', id)
    toast.success("Aprovado! A abrir o WhatsApp do cliente...");
    if (material?.cliente?.telefone && material?.cliente?.token_magico) {
      const linkPortal = `${window.location.origin}/portal/${material.cliente.token_magico}`;
      const textoMensagem = `Olá! O material "${material.titulo}" foi concluído e está pronto para sua avaliação. 🎉\n\nPode acessar o seu portal aqui: ${linkPortal}`;
      
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

  const handleDelegarItems = async () => {
    if (delegationType === 'planner' && !selectedPlannerId) return toast.error("Selecione um Decupador!");
    if (delegationType === 'editor' && !selectedEditorId && !selectedDesignerId) return toast.error("Selecione pelo menos um Editor ou Designer!");
    if (selectedItemsToDelegate.length === 0) return toast.error("Selecione pelo menos 1 material!");
    setLoading(true);

    const updateData: any = delegationType === 'planner'
      ? { planner_id: selectedPlannerId, status: 'planejamento', feedback_admin: adminFeedback, data_limite: delegationDeadline || null }
      : {
        editor_id: selectedEditorId || null,
        designer_id: selectedDesignerId || null,
        status: 'em_edicao',
        video_entregue: !selectedEditorId,
        design_entregue: !selectedDesignerId,
        feedback_admin: adminFeedback,
        data_limite: delegationDeadline || null
      };

    if (delegationType === 'planner' && newLinkBruto) {
      updateData.link_bruto = newLinkBruto;
    }

    const { error } = await supabase.from('materiais').update(updateData).in('id', selectedItemsToDelegate);

    if (error) {
      toast.error("Erro ao delegar: " + error.message);
    } else {
      toast.success(`Delegado com sucesso! (${selectedItemsToDelegate.length} materiais)`);

      const firstItem = materiais.find(m => selectedItemsToDelegate.includes(m.id));
      const clienteNome = firstItem?.cliente?.nome || 'CLIENTE NÃO IDENTIFICADO';

      const tituloOrQuantidade = selectedItemsToDelegate.length > 1 ? `🔢 ${selectedItemsToDelegate.length} MATERIAIS` : (firstItem?.titulo || 'DIVERSOS');

      const instrucaoMsg = adminFeedback ? `\n\n📝 INSTRUÇÃO: ${adminFeedback.toUpperCase()}` : '';

      if (delegationType === 'planner') {
        const mPlanner = membros.find(m => m.id === selectedPlannerId);
        const msgPlanner = `🔔 NOVA TAREFA: DECUPAGEM\n\n${clienteNome}\n${tituloOrQuantidade}${instrucaoMsg}`;
        await notificarClickUpChat(msgPlanner, (mPlanner as any)?.telegram_thread_id);
      } else {
        if (selectedEditorId) {
          const mEditor = membros.find(m => m.id === selectedEditorId);
          const msgEditor = `🎬 NOVA TAREFA: EDIÇÃO\n\n${clienteNome}\n${tituloOrQuantidade}${instrucaoMsg}`;
          await notificarClickUpChat(msgEditor, (mEditor as any)?.telegram_thread_id);
        }
        if (selectedDesignerId) {
          const mDesigner = membros.find(m => m.id === selectedDesignerId);
          const msgDesigner = `🎨 NOVA TAREFA: DESIGN\n\n${clienteNome}\n${tituloOrQuantidade}${instrucaoMsg}`;
          await notificarClickUpChat(msgDesigner, (mDesigner as any)?.telegram_thread_id);
        }
      }

      setIsDelegateModalOpen(false);
      setAdminFeedback('');
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
    toast.success(`${loteItens.length} tarefas criadas e enviadas para Roteiro em Análise!`);
    setLoteForm({ cliente_id: '', ciclo: '1', link_bruto: '' });
    setLoteItens([{ id: Date.now(), titulo: '', roteiro: '' }]); loadData(); setLoading(false);
  }

  const handleImportPlanner = async () => {
    if (!plannerTaskId || !importClienteId) return toast.error("Preencha os campos obrigatórios!");
    setLoading(true)
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
      const novos = subtarefasCompletas.map((sub: any) => ({
        cliente_id: importClienteId,
        titulo: sub.name,
        roteiro: sub.text_content || sub.description || 'Sem roteiro inserido no ClickUp.',
        status: 'analise_roteiro',
        clickup_task_id: sub.id,
        ciclo: parseInt(importCiclo) || 1,
        created_at: new Date().toISOString()
      }))
      const { error } = await supabase.from('materiais').insert(novos);
      if (error) { toast.error("Erro no Banco de Dados: " + error.message); setLoading(false); return; }
      setIsImportModalOpen(false);
      setPlannerTaskId(''); loadData();
      toast.success(`${novos.length} Guias importados com status [Roteiro em Análise] para a aba de Planejamento!`);
    } catch (err) { toast.error("Erro na comunicação com o ClickUp."); } finally { setLoading(false) }
  }

  const handleSendNewVersion = async () => {
    if (!selectedMaterial || !newDriveLink) return
    setLoading(true)
    await supabase.from('materiais').update({ link_drive: newDriveLink, status: 'pendente', feedback: null }).eq('id', selectedMaterial.id)
    await notificarClickUpChat(`🎬 REEDIÇÃO\n\n${selectedMaterial.cliente?.nome}\n${selectedMaterial.titulo}`);
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
          <p className="text-xs font-black uppercase tracking-[0.2em] text-white/40">Carregando pasta...</p>
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
                      <img src={link} className="w-full h-full object-contain select-none" alt={`Slide ${idx + 1}`} />
                    ) : (
                      <iframe title={`Slide ${idx + 1}`} src={emb || link} className="w-full h-full border-0 pointer-events-none" allowFullScreen></iframe>
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
            <span className="text-[10px] font-black text-white bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full uppercase tracking-[0.2em] shadow-sm">{currentSlide + 1} / {links.length}</span>
          </div>
        </div>
      );
    }

    if (url.match(/\.(jpeg|jpg|gif|png|webp|avif|jfif)$/i)) return <img src={url} className="w-full mx-auto aspect-[9/16] md:aspect-video md:max-w-4xl max-h-[85vh] rounded-[24px] object-contain shadow-2xl" alt="Preview" />;
    const finalUrl = getEmbedUrl(url) || url;
    return <iframe src={finalUrl} className="w-full mx-auto aspect-[9/16] md:aspect-video md:max-w-4xl max-h-[85vh] rounded-[24px] border-0 bg-black shadow-2xl" allowFullScreen />;
  };

  const navItem = (id: any, label: string, icon: any, count?: number, badgeColor?: string) => (
    <button
      onClick={() => { setActiveTab(id); setIsMobileMenuOpen(false); }}
      className={`w-full flex items-center justify-between p-3 rounded-xl font-bold transition-all ${activeTab === id ? 'bg-[#A25431] text-white shadow-lg' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}
    >
      <span className="flex items-center gap-3 whitespace-nowrap text-[13px]">{icon} {label}</span>
      {count && count > 0 ? <span className={`text-[10px] px-2 py-0.5 rounded-full font-black shrink-0 ml-2 ${activeTab === id ? 'bg-white text-[#A25431]' : badgeColor}`}>{count}</span> : null}
    </button>
  );

  return (
    <div className={`flex h-screen h-[100dvh] ${tc.bgApp} font-sans ${tc.textMain} overflow-hidden ${theme}`} suppressHydrationWarning>
      <Toaster position="top-right" richColors theme={theme} />

      {/* CABEÇALHO MOBILE MINIMALISTA (GLASSMORPISM) */}
      <div className={`md:hidden fixed top-0 left-0 w-full z-40 px-6 py-4 flex items-center justify-between backdrop-blur-md border-b ${theme === 'dark' ? 'bg-zinc-950/80 border-white/5' : 'bg-white/80 border-zinc-200'} shadow-sm transition-all duration-300`}>
        <div className="flex items-center gap-3">
          <img src={theme === 'dark' ? "/logo-light.png" : "/logo-dark.png"} alt="Everton" className="h-10 w-auto object-contain" />
        </div>
        
        <div className="flex-1 max-w-[140px] mx-4">
          <div className={`relative flex items-center ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-zinc-100 border-zinc-200'} border rounded-xl px-3 py-1.5`}>
            <Search size={14} className="text-zinc-500 shrink-0" />
            <input 
              type="text" 
              placeholder="BUSCAR..." 
              className="bg-transparent border-none outline-none text-[10px] font-black uppercase w-full ml-2 placeholder:text-zinc-500"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Botão de Tema Rápido */}
          <button onClick={toggleTheme} className={`p-2 rounded-full border ${theme === 'dark' ? 'bg-white/5 border-white/10 text-yellow-500' : 'bg-zinc-100 border-zinc-200 text-zinc-600'} active:scale-90 transition-all`}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          
          {/* Sininho de Notificações */}
          <button onClick={() => { setActiveTab('solicitacao-ajustes'); setIsMobileMenuOpen(false); }} className={`relative p-2 rounded-full border ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-zinc-100 border-zinc-200 text-zinc-600'} active:scale-90 transition-all`}>
            <Bell size={18} />
            {notificacoesAjustes.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
            )}
          </button>
        </div>
      </div>

      {/* OVERLAY MOBILE */}
      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />}

      {/* SIDEBAR RESPONSIVA PADRONIZADA */}
      <aside className={`fixed inset-y-0 left-0 w-72 md:w-[280px] bg-[#212013] text-white border-r border-[#212013] flex flex-col shadow-2xl md:shadow-none z-50 transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`}>

        {/* CONTAINER DA LOGO - Ajustado para logo grande sem empurrar o menu */}
        <div className="pt-8 pb-4 px-6 flex flex-col items-center relative border-b border-white/5">
          <img
            src="/logo-light.png"
            alt="Everton"
            className="h-32 md:h-36 w-auto object-contain transition-transform duration-300"
            style={{ marginBottom: '-10px' }}
          />

          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden absolute right-4 top-4 p-2 text-zinc-400 hover:text-white bg-white/10 rounded-full"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-4 mt-2 space-y-1 overflow-y-auto pb-4 custom-scrollbar">
          <p className="px-4 text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] mb-2 mt-4 opacity-70">
            Fluxo de Trabalho
          </p>

          <div className="space-y-1">
            {navItem('planejamento', 'Planejamento', <ListTodo size={20} />, (filaProducaoPronta.length + filaRoteirosAprovados.length + filaAnaliseRoteiro.length + filaProblemasDecupagem.length), 'bg-white/10 text-zinc-300')}
            {navItem('materiais-aprovacao', 'Materiais p/ Aprovação', <ClipboardCheck size={20} />, filaMateriaisAprovacao.length, 'bg-white/10 text-zinc-300')}
            {navItem('solicitacao-ajustes', 'Solicitação de Ajustes', <Bell size={20} />, notificacoesAjustes.length, 'bg-red-500/20 text-red-400')}
            {navItem('materiais-aprovados', 'Materiais Aprovados', <CheckCircle2 size={20} />, filaMateriaisAprovados.length, 'bg-green-500/20 text-green-400')}
          </div>

          <div className="my-6 border-t border-white/5 mx-2"></div>

          <p className="px-4 text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] mb-2 opacity-70">
            Gestão
          </p>

          <div className="space-y-1">
            {navItem('geral', 'Visão Geral', <LayoutDashboard size={20} />)}
            {navItem('cadastro-clientes', 'Cadastro do Cliente', <Users size={20} />)}
            {navItem('equipe', 'Equipe', <ShieldCheck size={20} />)}
            {navItem('relatorios', 'Relatórios', <Activity size={20} />)}
          </div>
        </nav>

        {/* RODAPÉ DA SIDEBAR */}
        <div className="p-4 border-t border-white/5 flex flex-col gap-2 bg-[#1a190f]">
          <button onClick={toggleTheme} className="w-full flex items-center gap-3 p-3 text-yellow-500 font-bold hover:bg-white/5 rounded-xl transition-all text-sm">
            {theme === 'dark' ? <><Sun size={20} /> Modo Claro</> : <><Moon size={20} /> Modo Escuro</>}
          </button>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/'); router.refresh(); }} className="w-full flex items-center gap-3 p-3 text-red-400 font-bold hover:bg-white/5 rounded-xl transition-all text-sm">
            <LogOut size={20} /> Sair
          </button>
        </div>
      </aside>

      {/* BARRA INFERIOR MOBILE */}
      <div className={`md:hidden fixed bottom-0 left-0 w-full ${tc.bgCard} rounded-t-[24px] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-40 border-t ${tc.borderStrong}`}>
        <div className="flex justify-between items-end px-4 pb-4 pt-3 relative">
          <button onClick={() => { setActiveTab('planejamento'); setIsMobileMenuOpen(false); }} className={`flex flex-col items-center gap-1 p-2 w-16 transition-colors ${activeTab === 'planejamento' && !isMobileMenuOpen ? 'text-[#A25431]' : tc.textMuted}`}>
            <ListTodo size={20} />
            <span className="text-[9px] font-bold tracking-wide">Plano</span>
          </button>
          <button onClick={() => { setActiveTab('materiais-aprovacao'); setIsMobileMenuOpen(false); }} className={`flex flex-col items-center gap-1 p-2 w-16 transition-colors ${activeTab === 'materiais-aprovacao' && !isMobileMenuOpen ? 'text-[#A25431]' : tc.textMuted} relative`}>
            <div className="relative">
              <ClipboardCheck size={20} />
              {filaMateriaisAprovacao.length > 0 && <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 bg-blue-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold shadow-sm">{filaMateriaisAprovacao.length}</span>}
            </div>
            <span className="text-[9px] font-bold tracking-wide">Aprovar</span>
          </button>
          <div className="relative w-16 flex justify-center h-full">
            <button onClick={() => { setActiveTab('geral'); setIsMobileMenuOpen(false); }} className={`absolute -top-8 flex flex-col items-center justify-center bg-[#A25431] text-white w-14 h-14 rounded-full shadow-lg shadow-[#A25431]/30 border-4 ${theme === 'dark' ? 'border-zinc-950' : 'border-zinc-50'} transform transition-transform active:scale-95`}>
              <LayoutDashboard size={22} />
            </button>
            <span className={`text-[9px] font-bold tracking-wide mt-auto ${activeTab === 'geral' && !isMobileMenuOpen ? 'text-[#A25431]' : tc.textMuted}`}>Visão</span>
          </div>
          <button onClick={() => { setActiveTab('materiais-aprovados'); setIsMobileMenuOpen(false); }} className={`flex flex-col items-center gap-1 p-2 w-16 transition-colors ${activeTab === 'materiais-aprovados' && !isMobileMenuOpen ? 'text-[#A25431]' : tc.textMuted} relative`}>
            <div className="relative">
              <CheckCircle2 size={20} />
              {filaMateriaisAprovados.length > 0 && <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold shadow-sm">{filaMateriaisAprovados.length}</span>}
            </div>
            <span className="text-[9px] font-bold tracking-wide">Prontos</span>
          </button>
          <button onClick={() => setIsMobileMenuOpen(true)} className={`flex flex-col items-center gap-1 p-2 w-16 transition-colors ${isMobileMenuOpen ? 'text-[#A25431]' : tc.textMuted}`}>
            <Menu size={20} />
            <span className="text-[9px] font-bold tracking-wide">Menu</span>
          </button>
        </div>
      </div>

      <main className={`flex-1 pt-24 pb-24 px-4 md:pt-10 md:pb-10 md:px-10 overflow-y-auto ${tc.bgApp}`}>
        {/* ABA: PLANEJAMENTO */}
        {activeTab === 'planejamento' && (
          <div className="max-w-5xl mx-auto space-y-8 md:space-y-12 text-left animate-in slide-in-from-bottom-4 duration-500">

            <div className={`flex flex-col md:flex-row md:justify-between items-start md:items-center gap-6 ${tc.bgCard} p-6 md:p-8 rounded-[32px] border ${tc.borderStrong} shadow-sm`}>
              <div>
                <h2 className="text-2xl font-black uppercase">Planejamento</h2>
                <p className={`text-sm ${tc.textMuted} font-medium mt-1`}>Importe tarefas, analise roteiros ou delegue pastas organizadas.</p>
              </div>
              <button onClick={() => setIsImportModalOpen(true)} className="w-full md:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-[#A25431] text-white rounded-2xl text-xs font-black uppercase hover:bg-[#8a4729] shadow-lg shadow-[#A25431]/20 transition-all">
                <Download size={18} /> Importar do ClickUp
              </button>
            </div>

            {/* ROTEIROS EM ANÁLISE */}
            <div className="space-y-6">
              <header><h2 className="text-2xl md:text-3xl font-black uppercase flex items-center gap-3"><FileText className="text-pink-500" size={28} /> Roteiros em Análise</h2><p className={`${tc.textMuted} font-medium text-sm md:text-base mt-1`}>Edite os roteiros se necessário e envie para aprovação do cliente.</p></header>
              {Object.keys(groupedAnaliseRoteiro).length === 0 ? (
                <div className={`${tc.bgCard} border border-dashed ${tc.borderStrong} rounded-[24px] p-10 text-center`}><p className={`${tc.textMuted} font-bold`}>Nenhum roteiro aguardando análise.</p></div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(groupedAnaliseRoteiro).map(([clienteId, group]) => (
                    <div key={`analise-${clienteId}`} className={`${tc.bgCard} rounded-[24px] border ${theme === 'dark' ? 'border-pink-900/50' : 'border-pink-100'} shadow-sm overflow-hidden`}>
                      <div className={`p-4 md:p-5 ${theme === 'dark' ? 'bg-pink-900/10 hover:bg-pink-900/20' : 'bg-pink-50/50 hover:bg-pink-50'} cursor-pointer flex items-center justify-between`} onClick={() => toggleClient(`analise-${clienteId}`)}>
                        <div className="flex items-center gap-3"><ChevronRight className={`text-pink-600 transition-transform ${expandedClients.includes(`analise-${clienteId}`) ? 'rotate-90' : ''}`} /><Folder className="text-pink-400 hidden md:block" size={18} /><h3 className="font-black text-base md:text-lg uppercase truncate">{group.cliente.nome}</h3></div>
                      </div>
                      {expandedClients.includes(`analise-${clienteId}`) && (
                        <div className={`p-4 md:p-5 space-y-6 ${tc.bgCard}`}>
                          {Object.entries(group.ciclos).map(([cicloLabel, data]: [string, any]) => (
                            <div key={`analise-ciclo-${cicloLabel}`} className="space-y-3">
                              <div className={`flex flex-col md:flex-row md:items-center justify-between gap-3 border-b ${theme === 'dark' ? 'border-pink-900/50' : 'border-pink-100'} pb-3`}>
                                <div className="flex items-center gap-2"><Calendar size={14} className="text-pink-500" /><h4 className="font-black text-xs text-pink-500 uppercase tracking-widest">{cicloLabel}</h4></div>
                                <button onClick={(e) => { e.stopPropagation(); handleEnviarLoteRoteiroCliente(data.itens); }} disabled={loading} className={`w-full md:w-auto px-4 py-2 ${theme === 'dark' ? 'bg-pink-900/30 text-pink-400 hover:bg-pink-900/50' : 'bg-pink-100 text-pink-700 hover:bg-pink-600 hover:text-white'} rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 disabled:opacity-50 transition-colors`}>
                                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enviar Lote p/ Cliente
                                </button>
                              </div>
                              <div className={`grid gap-3 pl-0 md:pl-2 md:border-l-2 ${theme === 'dark' ? 'border-pink-900/50' : 'border-pink-100'} md:ml-1`}>
                                {data.itens.map((m: Material) => (
                                  <div key={m.id} className={`${tc.bgHighlight} p-4 rounded-2xl shadow-sm border ${tc.borderStrong} flex flex-col md:flex-row items-start md:items-center gap-4 ${theme === 'dark' ? 'hover:border-pink-900/50' : 'hover:border-pink-200'} transition-colors`}>
                                    <div className="flex-1 w-full text-left">
                                      <span className={`${theme === 'dark' ? 'bg-pink-900/30 text-pink-400' : 'bg-pink-100 text-pink-700'} text-[9px] font-black uppercase px-2 py-1 rounded-md mb-2 inline-block`}>Roteiro em Análise</span>
                                      {m.data_limite && new Date(m.data_limite) < new Date() && (
                                        <span className="ml-2 text-[8px] font-black uppercase px-2 py-1 rounded bg-red-600 text-white animate-pulse">🔥 Atrasado</span>
                                      )}
                                      <h5 className="font-bold text-sm">{m.titulo}</h5>
                                    </div>
                                    <div className="grid grid-cols-2 md:flex gap-2 w-full md:w-auto">
                                      <button onClick={() => { setRoteiroToEdit(m); setNewRoteiroText(m.roteiro || ''); setIsEditRoteiroModalOpen(true); }} className={`px-3 py-3 ${tc.bgCard} border ${tc.borderStrong} ${tc.textMuted} rounded-xl font-bold text-xs flex items-center gap-2 justify-center ${tc.bgHover}`}><Edit3 size={14} /> Editar</button>
                                      <button onClick={() => handleEnviarRoteiroCliente(m)} disabled={actionLoading === m.id} className="px-3 py-3 bg-pink-600 hover:bg-pink-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 justify-center disabled:opacity-50 transition-colors">{actionLoading === m.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enviar Cliente</button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ROTEIROS APROVADOS */}
            <div className={`space-y-6 pt-6 border-t ${tc.borderStrong}`}>
              <header><h2 className="text-2xl md:text-3xl font-black uppercase flex items-center gap-3"><FileText className="text-orange-500" size={28} /> Roteiros Aprovados</h2><p className={`${tc.textMuted} font-medium text-sm md:text-base mt-1`}>O cliente aprovou o texto. Coloque o Link Bruto e delegue para o Decupador.</p></header>
              {Object.keys(groupedRoteiros).length === 0 ? (
                <div className={`${tc.bgCard} border border-dashed ${tc.borderStrong} rounded-[24px] p-10 text-center`}><p className={`${tc.textMuted} font-bold`}>Nenhum roteiro aprovado aguardando delegação.</p></div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(groupedRoteiros).map(([clienteId, group]) => (
                    <div key={`rot-${clienteId}`} className={`${tc.bgCard} rounded-[24px] border ${theme === 'dark' ? 'border-orange-900/50' : 'border-orange-100'} shadow-sm overflow-hidden`}>
                      <div className={`p-4 md:p-5 ${theme === 'dark' ? 'bg-orange-900/10 hover:bg-orange-900/20' : 'bg-orange-50/50 hover:bg-orange-50'} cursor-pointer flex items-center justify-between`} onClick={() => toggleClient(`rot-${clienteId}`)}>
                        <div className="flex items-center gap-3"><ChevronRight className={`text-orange-600 transition-transform ${expandedClients.includes(`rot-${clienteId}`) ? 'rotate-90' : ''}`} /><Folder className="text-orange-400 hidden md:block" size={18} /><h3 className="font-black text-base md:text-lg uppercase truncate">{group.cliente.nome}</h3></div>
                      </div>
                      {expandedClients.includes(`rot-${clienteId}`) && (
                        <div className={`p-4 md:p-5 space-y-6 ${tc.bgCard}`}>
                          {Object.entries(group.ciclos).map(([cicloLabel, data]: [string, any]) => (
                            <div key={`rot-ciclo-${cicloLabel}`} className="space-y-3">
                              <div className={`flex flex-col md:flex-row md:items-center justify-between gap-3 border-b ${theme === 'dark' ? 'border-orange-900/50' : 'border-orange-100'} pb-3`}>
                                <div className="flex items-center gap-2"><Calendar size={14} className="text-orange-500" /><h4 className="font-black text-xs text-orange-500 uppercase tracking-widest">{cicloLabel}</h4></div>
                                <button onClick={(e) => { e.stopPropagation(); setDelegationType('planner'); setSelectedCicloDelegation({ clienteId, ciclo: cicloLabel, itens: data.itens, clienteNome: group.cliente.nome }); setSelectedItemsToDelegate(data.itens.map((i: any) => i.id)); setNewLinkBruto(data.itens.find((i: any) => i.link_bruto)?.link_bruto || ''); setIsDelegateModalOpen(true); }} className={`w-full md:w-auto px-4 py-2 ${theme === 'dark' ? 'bg-orange-900/30 text-orange-400 hover:bg-orange-900/50' : 'bg-orange-100 text-orange-700 hover:bg-orange-500 hover:text-white'} rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-colors`}><Send size={14} /> Delegar Todos</button>
                              </div>
                              <div className={`grid gap-3 pl-0 md:pl-2 md:border-l-2 ${theme === 'dark' ? 'border-orange-900/50' : 'border-orange-100'} md:ml-1`}>
                                {data.itens.map((m: Material) => (
                                  <div key={m.id} className={`${tc.bgHighlight} p-4 rounded-2xl shadow-sm border ${tc.borderStrong} flex flex-col md:flex-row items-start md:items-center gap-4 ${theme === 'dark' ? 'hover:border-orange-900/50' : 'hover:border-orange-200'} transition-colors`}>
                                    <div className="flex-1 min-w-0 w-full text-left">
                                      <span className={`${theme === 'dark' ? 'bg-orange-900/30 text-orange-400' : 'bg-orange-100 text-orange-700'} text-[9px] font-black uppercase px-2 py-1 rounded-md mb-2 inline-block`}>Roteiro Aprovado</span>
                                      {m.data_limite && new Date(m.data_limite) < new Date() && (
                                        <span className="ml-2 text-[8px] font-black uppercase px-2 py-1 rounded bg-red-600 text-white animate-pulse">🔥 Atrasado</span>
                                      )}
                                      <h5 className="font-bold text-sm">{m.titulo}</h5>
                                    </div>
                                    <div className="grid grid-cols-2 lg:flex gap-2 w-full md:w-auto md:shrink-0">
                                      <button onClick={() => { setRoteiroToEdit(m); setNewRoteiroText(m.roteiro || ''); setIsEditRoteiroModalOpen(true); }} className={`px-3 py-3 ${tc.bgCard} border ${tc.borderStrong} ${tc.textMuted} rounded-xl font-bold text-xs flex items-center gap-2 justify-center ${tc.bgHover}`}><Edit3 size={14} /> Editar</button>
                                      <button onClick={() => { setSelectedMaterial(m); setNewLinkBruto(m.link_bruto || ''); setIsLinkBrutoModalOpen(true); }} className={`col-span-2 lg:col-span-1 px-4 py-3 border rounded-xl font-bold text-xs flex items-center gap-2 justify-center transition-all ${m.link_bruto ? (theme === 'dark' ? 'bg-indigo-900/30 border-indigo-900/50 text-indigo-400' : 'bg-indigo-50 border-indigo-200 text-indigo-600') : 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700 animate-pulse'}`}><Link size={14} /> {m.link_bruto ? 'Pasta OK' : 'Inserir Pasta'}</button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* PROBLEMAS NA PRODUÇÃO */}
            {Object.keys(groupedProblemasDecupagem).length > 0 && (
              <div className={`space-y-6 pt-6 border-t ${tc.borderStrong}`}>
                <header><h2 className="text-2xl md:text-3xl font-black uppercase flex items-center gap-3 text-red-500"><AlertCircle size={28} /> Problemas</h2><p className={`${tc.textMuted} font-medium text-sm md:text-base mt-1`}>Resolva os problemas do Decupador para a produção continuar.</p></header>
                <div className="space-y-4">
                  {Object.entries(groupedProblemasDecupagem).map(([clienteId, group]) => (
                    <div key={`prob-${clienteId}`} className={`${tc.bgCard} rounded-[24px] border ${theme === 'dark' ? 'border-red-900/50 ring-red-900/20' : 'border-red-200 ring-red-50'} shadow-xl overflow-hidden ring-4`}>
                      <div className={`p-4 md:p-5 ${theme === 'dark' ? 'bg-red-900/20 hover:bg-red-900/30' : 'bg-red-50 hover:bg-red-100'} cursor-pointer flex items-center justify-between transition-colors`} onClick={() => toggleClient(`prob-${clienteId}`)}>
                        <div className="flex items-center gap-3"><ChevronRight className={`text-red-600 transition-transform ${expandedClients.includes(`prob-${clienteId}`) ? 'rotate-90' : ''}`} /><AlertCircle className="text-red-500 hidden md:block" size={18} /><h3 className={`font-black text-base md:text-lg uppercase truncate ${theme === 'dark' ? 'text-red-400' : 'text-red-900'}`}>{group.cliente.nome}</h3></div>
                        <span className="text-[9px] font-black uppercase text-white bg-red-500 px-2 py-1 rounded-full animate-pulse ml-2">Ação</span>
                      </div>
                      {expandedClients.includes(`prob-${clienteId}`) && (
                        <div className={`p-4 md:p-5 space-y-6 ${tc.bgCard}`}>
                          {Object.entries(group.ciclos).map(([cicloLabel, data]: [string, any]) => (
                            <div key={`prob-ciclo-${cicloLabel}`} className="space-y-3">
                              <div className={`flex items-center gap-2 border-b ${theme === 'dark' ? 'border-red-900/50' : 'border-red-100'} pb-2`}><Calendar size={14} className="text-red-500" /><h4 className="font-black text-xs text-red-600 uppercase tracking-widest">{cicloLabel}</h4></div>
                              <div className={`grid gap-3 pl-0 md:pl-2 md:border-l-2 ${theme === 'dark' ? 'border-red-900/50' : 'border-red-200'} md:ml-1`}>
                                {data.itens.map((m: Material) => (
                                  <div key={m.id} className={`${theme === 'dark' ? 'bg-red-950/20 border-red-900/30' : 'bg-red-50/30 border-red-100'} p-4 md:p-5 rounded-2xl shadow-sm border flex flex-col md:flex-row items-start md:items-center gap-4 transition-colors`}>
                                    <div className="flex-1 min-w-0 w-full">
                                      <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md mb-2 inline-block ${m.status === 'faltando_material' ? (theme === 'dark' ? 'bg-red-900/50 text-red-400' : 'bg-red-100 text-red-700') : (theme === 'dark' ? 'bg-yellow-900/50 text-yellow-400' : 'bg-yellow-100 text-yellow-700')}`}>{m.status === 'faltando_material' ? 'Falta Material' : 'Verificar Material'}</span>
                                      {m.data_limite && new Date(m.data_limite) < new Date() && !['aprovado', 'post_aprovado', 'concluido'].includes(m.status) && (
                                        <span className="ml-2 text-[9px] font-black uppercase px-2 py-1 rounded-md bg-red-600 text-white animate-pulse">🔥 Atrasado</span>
                                      )}
                                      <h5 className="font-bold text-sm">{m.titulo}</h5>
                                      {(() => {
                                        const author = getAuthorInfo(m.feedback);
                                        if (!author) return null;
                                        return (
                                          <div className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold ${theme === 'dark' ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-zinc-100 text-zinc-600 border-zinc-200'} border`}>
                                            <Users size={12} className="opacity-60" />
                                            <span>Reportado por: <span className="text-[#A25431]">{author.nome}</span> ({author.role})</span>
                                          </div>
                                        );
                                      })()}
                                      <div className={`mt-3 p-4 ${tc.bgCard} rounded-xl border ${theme === 'dark' ? 'border-red-900/50' : 'border-red-100'}`}><p className="text-[10px] font-black uppercase text-red-400 tracking-widest mb-1">Motivo:</p><p className={`${tc.textMuted} font-medium text-sm whitespace-pre-wrap break-words break-all`}>"{renderTextWithLinks(m.feedback || '')}"</p></div>
                                    </div>
                                    <div className="flex flex-wrap lg:flex-nowrap gap-2 w-full md:w-auto justify-center items-center md:shrink-0">
                                      <button onClick={() => openResolveModal(m)} className="px-4 py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 justify-center flex-1 lg:flex-none transition-colors"><CheckCircle2 size={16} /> Resolver</button>
                                      <button onClick={() => openConfirm('Arquivar Tarefa', 'Deseja arquivar esta tarefa?', async () => { setActionLoading(m.id); await supabase.from('materiais').update({ status: 'concluido' }).eq('id', m.id); loadData(); setActionLoading(null); }, 'warning')} disabled={actionLoading === m.id} className={`px-4 py-4 ${tc.bgCard} border ${theme === 'dark' ? 'border-red-900/50 text-red-400 hover:bg-red-900/20' : 'border-red-200 text-red-600 hover:bg-red-50'} rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 justify-center flex-1 lg:flex-none disabled:opacity-50 transition-colors`}>{actionLoading === m.id ? <Loader2 size={16} className="animate-spin" /> : <Archive size={16} />} Arquivar</button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* MATERIAL DECUPADO (ANTIGAS PASTAS PRONTAS) */}
            <div className={`space-y-6 pt-6 border-t ${tc.borderStrong}`}>
              <header><h2 className="text-2xl md:text-3xl font-black uppercase flex items-center gap-3"><Folder className="text-indigo-600" size={28} /> Material Decupado</h2><p className={`${tc.textMuted} font-medium text-sm md:text-base mt-1`}>O Decupador organizou. Delegue para o Editor e/ou Designer.</p></header>
              {Object.keys(groupedProducao).length === 0 ? (
                <div className={`${tc.bgCard} border border-dashed ${tc.borderStrong} rounded-[24px] p-10 text-center`}><p className={`${tc.textMuted} font-bold`}>Nenhuma pasta organizada pendente.</p></div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(groupedProducao).map(([clienteId, group]) => (
                    <div key={`prod-${clienteId}`} className={`${tc.bgCard} rounded-[24px] border ${theme === 'dark' ? 'border-indigo-900/30' : 'border-indigo-100'} shadow-sm overflow-hidden`}>
                      <div className={`p-4 md:p-5 ${theme === 'dark' ? 'bg-indigo-900/10 hover:bg-indigo-900/20' : 'bg-indigo-50/50 hover:bg-indigo-50'} cursor-pointer flex items-center justify-between transition-colors`} onClick={() => toggleClient(`prod-${clienteId}`)}>
                        <div className="flex items-center gap-3"><ChevronRight className={`text-indigo-500 transition-transform ${expandedClients.includes(`prod-${clienteId}`) ? 'rotate-90' : ''}`} /><Folder className="text-indigo-400 hidden md:block" size={18} /><h3 className="font-black text-base md:text-lg uppercase truncate">{group.cliente.nome}</h3></div>
                      </div>
                      {expandedClients.includes(`prod-${clienteId}`) && (
                        <div className={`p-4 md:p-5 space-y-6 ${tc.bgCard}`}>
                          {Object.entries(group.ciclos).map(([cicloLabel, data]: [string, any]) => (
                            <div key={`prod-ciclo-${cicloLabel}`} className="space-y-3">
                              <div className={`flex flex-col md:flex-row md:items-center justify-between gap-3 border-b ${theme === 'dark' ? 'border-indigo-900/30' : 'border-indigo-100'} pb-3`}>
                                <div className="flex items-center gap-2"><Calendar size={14} className="text-indigo-500" /><h4 className="font-black text-xs text-indigo-500 uppercase tracking-widest">{cicloLabel}</h4></div>
                                <button onClick={(e) => { e.stopPropagation(); setDelegationType('editor'); setSelectedCicloDelegation({ clienteId, ciclo: cicloLabel, itens: data.itens, clienteNome: group.cliente.nome }); setSelectedItemsToDelegate(data.itens.map((i: any) => i.id)); setIsDelegateModalOpen(true); }} className={`w-full md:w-auto px-4 py-2 ${theme === 'dark' ? 'bg-indigo-900/30 text-indigo-400 hover:bg-indigo-900/50' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-600 hover:text-white'} rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-colors`}><Send size={14} /> Delegar Todos</button>
                              </div>
                              <div className={`grid gap-3 pl-0 md:pl-2 md:border-l-2 ${theme === 'dark' ? 'border-indigo-900/30' : 'border-indigo-100'} md:ml-1`}>
                                {data.itens.map((m: Material) => (
                                  <div key={m.id} className={`${tc.bgHighlight} p-4 rounded-2xl shadow-sm border ${tc.borderStrong} flex flex-col md:flex-row items-start md:items-center gap-4 ${theme === 'dark' ? 'hover:border-indigo-900/50' : 'hover:border-indigo-200'} transition-colors`}>
                                    <div className="flex-1 w-full text-left">
                                      <span className={`${theme === 'dark' ? 'bg-indigo-900/30 text-indigo-400' : 'bg-indigo-100 text-indigo-700'} text-[9px] font-black uppercase px-2 py-1 rounded-md mb-2 inline-block`}>Drive Pronto</span>
                                      {m.data_limite && new Date(m.data_limite) < new Date() && (
                                        <span className="ml-2 text-[8px] font-black uppercase px-2 py-1 rounded bg-red-600 text-white animate-pulse">🔥 Atrasado</span>
                                      )}
                                      <h5 className="font-bold text-sm">{m.titulo}</h5>
                                    </div>
                                    <div className="flex flex-wrap lg:flex-nowrap gap-2 w-full md:w-auto justify-end">
                                      <button onClick={() => setPreviewRoteiro(m)} className={`p-3 ${tc.bgCard} border ${tc.borderStrong} ${tc.textMuted} rounded-xl ${tc.bgHover} flex justify-center`} title="Ver Roteiro"><FileText size={18} /></button>
                                      <button onClick={() => setPreviewUrl(m.link_organizado)} className={`px-4 py-3 ${tc.bgCard} border ${tc.borderStrong} ${tc.textMuted} rounded-xl font-bold text-xs flex items-center gap-2 justify-center ${tc.bgHover}`} title="Ver Pasta (Organizada)"><Eye size={14} /> Ver Pasta</button>
                                      
                                      {/* NOVOS BOTÕES SOLICITADOS */}
                                      <button onClick={() => { setSelectedMaterial(m); setNewLinkBruto(m.link_bruto || ''); setIsLinkBrutoModalOpen(true); }} className={`p-3 ${theme === 'dark' ? 'text-indigo-400 bg-indigo-900/30 hover:bg-indigo-600 hover:text-white' : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-600 hover:text-white'} rounded-xl transition-colors`} title="Editar Link da Pasta (Decupagem)"><Link size={18} /></button>
                                      <button onClick={() => openResolveModal(m, 'planner')} className={`p-3 ${theme === 'dark' ? 'text-amber-400 bg-amber-900/30 hover:bg-amber-600 hover:text-white' : 'text-amber-600 bg-amber-50 hover:bg-amber-600 hover:text-white'} rounded-xl transition-colors`} title="Devolver ao Decupador"><RotateCcw size={18} /></button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CRIADOR MANUAL */}
            <div className={`${tc.bgCard} border ${tc.borderStrong} rounded-[32px] p-6 md:p-10 shadow-sm space-y-8`}>
              <header className={`border-b ${tc.borderStrong} pb-6`}><h2 className="text-xl md:text-2xl font-black uppercase flex items-center gap-3"><LayoutList className="text-blue-500" size={24} /> Criação Manual</h2><p className={`${tc.textMuted} text-xs md:text-sm mt-2`}>Crie tarefas manualmente. Elas irão para análise.</p></header>
              <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 p-4 md:p-6 ${theme === 'dark' ? 'bg-zinc-900/50' : 'bg-zinc-50'} rounded-2xl border ${tc.borderStrong}`}>
                <div className="space-y-1"><label className={`text-[10px] font-black ${tc.textMuted} uppercase tracking-widest ml-2`}>Cliente</label><select className={`w-full p-4 ${tc.bgCard} border ${tc.borderStrong} rounded-xl font-bold outline-none text-sm`} value={loteForm.cliente_id} onChange={e => setLoteForm({ ...loteForm, cliente_id: e.target.value })} required><option value="">Selecionar...</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
                <div className="space-y-1"><label className={`text-[10px] font-black ${tc.textMuted} uppercase tracking-widest ml-2`}>Ciclo</label><input type="number" min="1" max="12" className={`w-full p-4 ${tc.bgCard} border ${tc.borderStrong} rounded-xl font-bold outline-none text-sm`} value={loteForm.ciclo} onChange={e => setLoteForm({ ...loteForm, ciclo: e.target.value })} required /></div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center"><h3 className="text-sm font-black uppercase tracking-widest">Roteiros ({loteItens.length})</h3><button type="button" onClick={adicionarItemLote} className={`px-4 py-2 ${theme === 'dark' ? 'bg-blue-900/30 text-blue-400 hover:bg-blue-900/50' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'} rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-colors`}><Plus size={14} /> Adicionar Item</button></div>
                <div className="space-y-4">
                  {loteItens.map((item, index) => (
                    <div key={item.id} className={`p-4 md:p-6 ${tc.bgCard} border ${tc.borderStrong} rounded-2xl shadow-sm flex flex-col md:flex-row items-start md:items-center gap-4 relative group`}>
                      <div className="absolute -left-2 top-4 w-6 h-6 bg-[#A25431] text-white rounded-full flex items-center justify-center text-[10px] font-black shadow-md">{index + 1}</div>
                      <div className="w-full md:w-1/3 space-y-2 mt-4 md:mt-0"><label className={`text-[10px] font-black ${tc.textMuted} uppercase tracking-widest`}>Título</label><input className={`w-full p-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-100'} rounded-xl font-bold outline-none text-sm focus:border-[#A25431] transition-colors`} placeholder="Ex: Reel 01" value={item.titulo} onChange={e => atualizarItemLote(item.id, 'titulo', e.target.value)} /></div>
                      <div className="w-full md:w-2/3 space-y-2">
                        <label className={`text-[10px] font-black ${tc.textMuted} uppercase tracking-widest`}>Roteiro / Instrução</label>
                        <div className="flex flex-col sm:flex-row gap-2"><textarea className={`w-full p-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-100'} rounded-xl font-medium outline-none text-sm resize-none focus:border-[#A25431] transition-colors min-h-[80px]`} placeholder="Escreva o roteiro aqui..." value={item.roteiro} onChange={e => atualizarItemLote(item.id, 'roteiro', e.target.value)} />{loteItens.length > 1 && (<button type="button" onClick={() => removerItemLote(item.id)} className={`p-4 ${theme === 'dark' ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50' : 'bg-red-50 text-red-500 hover:bg-red-500 hover:text-white'} rounded-xl flex justify-center w-full sm:w-auto transition-colors`}><Trash2 size={20} /></button>)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className={`pt-6 border-t ${tc.borderStrong}`}>
                <button onClick={criarLoteProducao} disabled={loading} className="w-full md:w-auto float-right px-10 py-5 bg-[#A25431] hover:bg-[#8a4729] text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg flex items-center justify-center gap-3 disabled:opacity-50 transition-colors">{loading ? <><Loader2 size={18} className="animate-spin" /> A processar...</> : <><Send size={18} /> Salvar e Enviar p/ Análise</>}</button>
                <div className="clear-both"></div>
              </div>
            </div>
          </div>
        )}

        {/* ABA: MATERIAIS P/ APROVAÇÃO */}
        {activeTab === 'materiais-aprovacao' && (
          <div className="max-w-5xl mx-auto space-y-8 text-left animate-in slide-in-from-bottom-4 duration-500">
            <header><h2 className="text-2xl md:text-3xl font-black uppercase flex items-center gap-3"><ClipboardCheck className="text-purple-600" size={28} /> Aprovação Interna</h2><p className={`${tc.textMuted} font-medium text-sm md:text-base mt-1`}>Valide a edição antes do cliente ver no portal. Inclui entregas parciais.</p></header>
            {Object.keys(groupedMateriaisAprovacao).length === 0 ? (
              <div className={`${tc.bgCard} p-10 md:p-20 rounded-[32px] text-center border-2 border-dashed ${tc.borderStrong}`}><CheckCircle2 size={48} className={`mx-auto ${tc.textMuted} opacity-50 mb-4`} /><p className={`${tc.textMuted} font-bold`}>Nenhum arquivo a aguardar aprovação.</p></div>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedMateriaisAprovacao).map(([clienteId, group]) => (
                  <div key={`rev-${clienteId}`} className={`${tc.bgCard} rounded-[24px] border ${theme === 'dark' ? 'border-purple-900/50' : 'border-purple-100'} shadow-sm overflow-hidden`}>
                    <div className={`p-4 md:p-5 ${theme === 'dark' ? 'bg-purple-900/10 hover:bg-purple-900/20' : 'bg-purple-50/50 hover:bg-purple-50'} cursor-pointer flex items-center justify-between transition-colors`} onClick={() => toggleClient(`rev-${clienteId}`)}>
                      <div className="flex items-center gap-3"><ChevronRight className={`text-purple-500 transition-transform ${expandedClients.includes(`rev-${clienteId}`) ? 'rotate-90' : ''}`} /><Folder className="text-purple-400 hidden md:block" size={18} /><h3 className="font-black text-base md:text-lg uppercase truncate">{group.cliente.nome}</h3></div>
                    </div>
                    {expandedClients.includes(`rev-${clienteId}`) && (
                      <div className={`p-4 md:p-5 space-y-6 ${tc.bgCard}`}>
                        {Object.entries(group.ciclos).map(([cicloLabel, data]: [string, any]) => (
                          <div key={`rev-ciclo-${cicloLabel}`} className="space-y-3">

                            {/* 🔥 BOTÃO APROVAR LOTE */}
                            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b ${theme === 'dark' ? 'border-purple-900/50' : 'border-purple-100'} pb-2`}>
                              <div className="flex items-center gap-2">
                                <Calendar size={14} className="text-purple-500" />
                                <h4 className="font-black text-xs text-purple-500 uppercase tracking-widest">{cicloLabel}</h4>
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); handleAprovarLoteParaCliente(data.itens); }} disabled={loading} className={`w-full md:w-auto px-4 py-2 ${theme === 'dark' ? 'bg-purple-900/30 text-purple-400 hover:bg-purple-900/50' : 'bg-purple-100 text-purple-700 hover:bg-purple-600 hover:text-white'} rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 disabled:opacity-50 transition-colors`}>
                                {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Aprovar Lote p/ Cliente
                              </button>
                            </div>

                            <div className={`grid gap-3 pl-0 md:pl-2 md:border-l-2 ${theme === 'dark' ? 'border-purple-900/50' : 'border-purple-100'} md:ml-1`}>
                              {data.itens.map((m: Material) => {
                                const isPartial = m.status === 'em_edicao' || m.status === 'ajustes';

                                // Lógica inteligente de pendências baseada na delegação
                                const temEditor = !!m.editor_id;
                                const temDesigner = !!m.designer_id;

                                return (
                                  <div key={m.id} className={`${tc.bgHighlight} p-4 rounded-2xl shadow-sm border ${tc.borderStrong} flex flex-col md:flex-row items-start md:items-center gap-4`}>
                                    <div className="flex-1 w-full">
                                      <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md mb-2 inline-block ${isPartial ? (theme === 'dark' ? 'bg-orange-900/30 text-orange-400' : 'bg-orange-100 text-orange-700') : (theme === 'dark' ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-700')}`}>
                                        {isPartial ? 'Entrega Parcial' : 'Edição Pronta'}
                                      </span>
                                      {m.data_limite && new Date(m.data_limite) < new Date() && (
                                        <span className="ml-2 text-[8px] font-black uppercase px-2 py-1 rounded bg-red-600 text-white animate-pulse">🔥 Atrasado</span>
                                      )}
                                      <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <h5 className="font-bold text-sm">{m.titulo}</h5>
                                        {m.agendado_para && !m.wpp_enviado && (
                                          <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-1">
                                            <Clock size={10} /> Agendado: {new Date(m.agendado_para).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                        )}
                                      </div>

                                      {/* Indicadores Dinâmicos */}
                                      <div className={`mt-2 text-[10px] font-bold uppercase tracking-widest flex gap-3 ${tc.textMuted}`}>
                                        {/* Só mostra vídeo se houver editor ou se já houver um link de vídeo */}
                                        {(temEditor || m.link_drive) && (
                                          <span className={m.video_entregue ? "text-green-500 flex items-center gap-1" : "flex items-center gap-1"}>
                                            {m.video_entregue ? "✓ Vídeo OK" : "⌛ Falta Vídeo"}
                                          </span>
                                        )}

                                        {/* Só mostra design se houver designer ou se já houver um link de capa */}
                                        {(temDesigner || m.link_capa) && (
                                          <span className={m.design_entregue ? "text-green-500 flex items-center gap-1" : "flex items-center gap-1"}>
                                            {m.design_entregue ? "✓ Design OK" : "⌛ Falta Design"}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                      <div className="grid grid-cols-2 md:flex gap-2 w-full md:w-auto flex-wrap shrink-0">
                                        <button onClick={() => setPreviewRoteiro(m)} className={`p-3 ${tc.bgCard} border ${tc.borderStrong} ${tc.textMuted} rounded-xl ${tc.bgHover} flex justify-center`} title="Ver Roteiro"><FileText size={18} /></button>

                                        {m.link_drive && <button onClick={() => setPreviewUrl(m.link_drive)} className={`px-4 py-3 ${tc.bgCard} border ${tc.borderStrong} ${tc.textMuted} rounded-xl font-bold text-xs flex items-center gap-2 justify-center ${tc.bgHover}`} title="Ver Vídeo"><FileVideo size={14} /> Post</button>}
                                        {m.link_capa && <button onClick={() => setPreviewUrl(m.link_capa)} className={`px-4 py-3 ${tc.bgCard} border ${tc.borderStrong} ${tc.textMuted} rounded-xl font-bold text-xs flex items-center gap-2 justify-center ${tc.bgHover}`} title="Ver Capa"><ImageIcon size={14} /> Capa/Card</button>}

                                        <button onClick={() => handleCheckAndAprovar(m)} disabled={actionLoading === m.id} className="col-span-2 md:col-span-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 justify-center disabled:opacity-50 transition-colors">
                                          {actionLoading === m.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} {m.agendado_para && !m.wpp_enviado ? 'Enviar Agora' : 'Aprovar Cliente'}
                                        </button>

                                        {m.agendado_para && !m.wpp_enviado ? (
                                          <button onClick={() => handleCancelarAgendamento(m.id)} disabled={actionLoading === m.id} className="col-span-2 md:col-span-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 justify-center transition-colors">
                                            <X size={14} /> Cancelar Agend.
                                          </button>
                                        ) : (
                                          <button onClick={() => { setDelegationType('editor'); setSelectedCicloDelegation({ clienteId: m.cliente_id, ciclo: m.ciclo?.toString() || '1', itens: [m], clienteNome: m.cliente?.nome || '' }); setSelectedItemsToDelegate([m.id]); setIsDelegateModalOpen(true); }} className="col-span-2 md:col-span-1 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 justify-center transition-colors">Devolver</button>
                                        )}
                                      </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ABA: SOLICITAÇÃO DE AJUSTES */}
        {activeTab === 'solicitacao-ajustes' && (
          <div className="max-w-4xl mx-auto space-y-8 text-left animate-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl md:text-3xl font-black tracking-tight uppercase flex items-center gap-3"><Bell className="text-red-600" size={28} /> Solicitação de Ajustes</h2>
            {Object.keys(groupedAjustes).length === 0 ? (
              <div className={`${tc.bgCard} border border-dashed ${tc.borderStrong} rounded-[32px] p-10 text-center`}><p className={`${tc.textMuted} font-bold`}>Nenhum pedido de ajuste pendente.</p></div>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedAjustes).map(([clienteId, group]) => (
                  <div key={`notif-${clienteId}`} className={`${tc.bgCard} rounded-[24px] border {theme === 'dark' ? 'border-red-900/50' : 'border-red-100'} shadow-sm overflow-hidden`}>
                    <div className={`p-4 md:p-5 ${theme === 'dark' ? 'bg-red-900/10 hover:bg-red-900/20' : 'bg-red-50/50 hover:bg-red-50'} cursor-pointer flex items-center justify-between transition-colors`} onClick={() => toggleClient(`notif-${clienteId}`)}>
                      <div className="flex items-center gap-3"><ChevronRight className={`text-red-600 transition-transform ${expandedClients.includes(`notif-${clienteId}`) ? 'rotate-90' : ''}`} /><Folder className="text-red-500 hidden md:block" size={18} /><h3 className="font-black text-base md:text-lg uppercase truncate">{group.cliente.nome}</h3></div>
                    </div>
                    {expandedClients.includes(`notif-${clienteId}`) && (
                      <div className={`p-4 md:p-5 space-y-6 ${tc.bgCard}`}>
                        {Object.entries(group.ciclos).map(([cicloLabel, data]: [string, any]) => (
                          <div key={`notif-ciclo-${cicloLabel}`} className="space-y-3">
                            <div className={`flex items-center gap-2 border-b ${theme === 'dark' ? 'border-red-900/50' : 'border-red-100'} pb-2`}><Calendar size={14} className="text-red-600" /><h4 className="font-black text-xs text-red-600 uppercase tracking-widest">{cicloLabel}</h4></div>
                            <div className={`grid gap-3 pl-0 md:pl-2 md:border-l-2 ${theme === 'dark' ? 'border-red-900/50' : 'border-red-100'} md:ml-1`}>
                              {data.itens.map((m) => (
                                <div key={m.id} className={`${theme === 'dark' ? 'bg-zinc-950/50 border-zinc-800' : 'bg-zinc-50/50 border-zinc-100'} p-4 rounded-2xl shadow-sm border flex flex-col md:flex-row items-start md:items-center gap-4 ${(!m.link_drive && !m.link_capa) ? (theme === 'dark' ? 'border-orange-900/50' : 'border-orange-200') : (theme === 'dark' ? 'border-red-900/50' : 'border-red-200')} transition-colors`}>
                                  <div className="flex-1 min-w-0 w-full text-left">
                                    <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md mb-2 inline-block ${(!m.link_drive && !m.link_capa) ? (theme === 'dark' ? 'bg-orange-900/30 text-orange-400' : 'bg-orange-100 text-orange-700') : (theme === 'dark' ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700')}`}>
                                      {(!m.link_drive && !m.link_capa) ? '🔔 Ajuste Planejamento' : '🎬 Ajuste Produção'}
                                    </span>
                                    {m.data_limite && new Date(m.data_limite) < new Date() && (
                                      <span className="ml-2 text-[8px] font-black uppercase px-2 py-1 rounded bg-red-600 text-white animate-pulse">🔥 Atrasado</span>
                                    )}
                                    <h5 className="font-bold text-sm truncate">{m.titulo}</h5>
                                    {(() => {
                                      const author = getAuthorInfo(m.feedback);
                                      if (!author) return null;
                                      return (
                                        <div className={`mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-bold ${theme === 'dark' ? 'bg-zinc-900 text-zinc-400 border-zinc-800' : 'bg-white text-zinc-500 border-zinc-200'} border`}>
                                          <Users size={10} className="opacity-60" />
                                          <span>Reportado por: <span className="text-[#A25431]">{author.nome}</span></span>
                                        </div>
                                      );
                                    })()}
                                    <div className={`mt-3 p-3 border rounded-xl ${tc.bgCard} ${(!m.link_drive && !m.link_capa) ? (theme === 'dark' ? 'border-orange-900/50' : 'border-orange-100') : (theme === 'dark' ? 'border-red-900/50' : 'border-red-100')}`}>
                                      <div className="flex justify-between items-start gap-3">
                                        <p className={`text-xs font-bold whitespace-pre-wrap break-words break-all ${(!m.link_drive && !m.link_capa) ? (theme === 'dark' ? 'text-orange-400' : 'text-orange-700') : (theme === 'dark' ? 'text-red-400' : 'text-red-700')}`}>
                                          <span className="text-[9px] uppercase tracking-widest opacity-60 block mb-1">Ajuste Atual:</span>
                                          {renderTextWithLinks(m.feedback?.split('\n\n')[0] || "Nenhum detalhe informado.")}
                                        </p>
                                        {(m.feedback?.split('\n\n').length || 0) > 1 && (
                                          <button onClick={() => toggleFeedback(m.id)} className={`p-1.5 rounded-md shrink-0 transition-all ${(!m.link_drive && !m.link_capa) ? (theme === 'dark' ? 'bg-orange-900/30 text-orange-400 hover:bg-orange-900/50' : 'bg-orange-50 text-orange-600 hover:bg-orange-200') : (theme === 'dark' ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50' : 'bg-red-50 text-red-600 hover:bg-red-200')}`}><ChevronDown size={14} className={`transition-transform duration-300 ${expandedFeedbacks.includes(m.id) ? 'rotate-180' : ''}`} /></button>
                                        )}
                                      </div>
                                      {expandedFeedbacks.includes(m.id) && (m.feedback?.split('\n\n').length || 0) > 1 && (
                                        <div className={`mt-3 pt-3 border-t space-y-2 animate-in fade-in duration-300 ${(!m.link_drive && !m.link_capa) ? (theme === 'dark' ? 'border-orange-900/20' : 'border-orange-50') : (theme === 'dark' ? 'border-red-900/20' : 'border-red-50')}`}>
                                          <p className={`text-[9px] uppercase tracking-widest font-black ${(!m.link_drive && !m.link_capa) ? (theme === 'dark' ? 'text-orange-500' : 'text-orange-400') : (theme === 'dark' ? 'text-red-500' : 'text-red-400')}`}>Histórico Anterior:</p>
                                          {m.feedback?.split('\n\n').slice(1).map((hist, idx) => (
                                            <div key={idx} className={`p-2.5 rounded-lg text-xs font-medium whitespace-pre-wrap break-words break-all opacity-80 ${(!m.link_drive && !m.link_capa) ? (theme === 'dark' ? 'bg-orange-900/10 text-orange-300' : 'bg-orange-50/50 text-orange-800') : (theme === 'dark' ? 'bg-red-900/10 text-red-300' : 'bg-red-50/50 text-red-800')}`}>{renderTextWithLinks(hist)}</div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    {/* 🔥 BOTÕES DE VISUALIZAÇÃO DA VERSÃO ENVIADA */}
                                    {(m.link_drive || m.link_capa) && (
                                      <div className="flex flex-wrap gap-2 mt-3">
                                        {m.link_drive && (
                                          <button onClick={() => setPreviewUrl(m.link_drive || null)} className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-blue-900/20 text-blue-400 border-blue-900/30' : 'bg-blue-50 text-blue-600 border-blue-100'} hover:opacity-80 transition-all border flex items-center gap-2 text-[9px] font-black uppercase tracking-widest`}>
                                            <FileVideo size={14}/> Ver Vídeo Enviado
                                          </button>
                                        )}
                                        {m.link_capa && (
                                          <button onClick={() => setPreviewUrl(m.link_capa || null)} className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-pink-900/20 text-pink-400 border-pink-900/30' : 'bg-pink-50 text-pink-600 border-pink-100'} hover:opacity-80 transition-all border flex items-center gap-2 text-[9px] font-black uppercase tracking-widest`}>
                                            <ImageIcon size={14}/> Ver Capa Enviada
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full md:w-auto mt-4 md:mt-0 md:shrink-0">
                                    <button onClick={() => setPreviewRoteiro(m)} className={`flex-1 sm:flex-none px-5 py-2 ${tc.bgCard} border ${tc.borderStrong} ${tc.textMuted} rounded-lg font-bold text-[11px] ${tc.bgHover} transition-all flex items-center justify-center gap-2 shadow-sm`}><FileText size={14} /> Roteiro</button>
                                    {(!m.link_drive && !m.link_capa) ? (
                                      <div className="flex flex-col sm:flex-row gap-2 w-full">
                                        <button onClick={() => { setRoteiroToEdit(m); setNewRoteiroText(m.roteiro || ''); setIsEditRoteiroModalOpen(true); }} className={`flex-1 sm:flex-none px-5 py-2 ${tc.bgCard} border ${theme === 'dark' ? 'border-orange-900/50 text-orange-500 hover:bg-orange-900/20' : 'border-orange-200 text-orange-600 hover:bg-orange-50'} rounded-lg font-black text-[11px] tracking-widest uppercase transition-colors shadow-sm flex items-center justify-center gap-2`}><Edit3 size={14} /> Editar Roteiro</button>
                                        <button onClick={() => handleReenviarRoteiroAjustado(m)} disabled={actionLoading === m.id} className="flex-1 sm:flex-none px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-black text-[11px] tracking-widest uppercase transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-50">{actionLoading === m.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Reenviar Cliente</button>
                                      </div>
                                    ) : (
                                      <>
                                        {m.link_drive && <button onClick={() => setPreviewUrl(m.link_drive)} className={`flex-1 sm:flex-none px-5 py-2 ${tc.bgCard} border ${tc.borderStrong} ${tc.textMuted} rounded-lg font-bold text-[11px] ${tc.bgHover} transition-colors flex items-center justify-center gap-2 shadow-sm`}><FileVideo size={14} /> Ver Post</button>}
                                        {m.link_capa && <button onClick={() => setPreviewUrl(m.link_capa)} className={`flex-1 sm:flex-none px-5 py-2 ${tc.bgCard} border ${tc.borderStrong} ${tc.textMuted} rounded-lg font-bold text-[11px] ${tc.bgHover} transition-colors flex items-center justify-center gap-2 shadow-sm`}><ImageIcon size={14} /> Capa/Card</button>}
                                        <button onClick={() => { setDelegationType('editor'); setSelectedCicloDelegation({ clienteId: m.cliente_id, ciclo: m.ciclo?.toString() || '1', itens: [m], clienteNome: m.cliente?.nome || '' }); setSelectedItemsToDelegate([m.id]); setIsDelegateModalOpen(true); }} className="w-full sm:w-auto px-8 py-2 text-white rounded-lg font-black text-[11px] tracking-widest uppercase transition-colors shadow-md flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700">Delegar</button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ABA: MATERIAIS APROVADOS */}
        {activeTab === 'materiais-aprovados' && (
          <div className="max-w-5xl mx-auto space-y-8 text-left animate-in slide-in-from-bottom-4 duration-500">
            <header><h2 className="text-2xl md:text-3xl font-black uppercase flex items-center gap-3"><CheckCircle2 className="text-green-500" size={28} /> Prontos para Postar</h2><p className={`${tc.textMuted} font-medium text-sm md:text-base mt-1`}>Materiais que o cliente já aprovou e estão prontos para publicação.</p></header>
            {Object.keys(groupedMateriaisAprovados).length === 0 ? (
              <div className={`${tc.bgCard} p-10 md:p-20 rounded-[32px] text-center border-2 border-dashed ${tc.borderStrong}`}><CheckCircle2 size={48} className={`mx-auto ${tc.textMuted} opacity-50 mb-4`} /><p className={`${tc.textMuted} font-bold`}>Nenhum material aprovado pendente de publicação.</p></div>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedMateriaisAprovados).map(([clienteId, group]) => (
                  <div key={`ok-${clienteId}`} className={`${tc.bgCard} rounded-[24px] border ${theme === 'dark' ? 'border-green-900/50' : 'border-green-100'} shadow-sm overflow-hidden`}>
                    <div className={`p-4 md:p-5 ${theme === 'dark' ? 'bg-green-900/10 hover:bg-green-900/20' : 'bg-green-50/50 hover:bg-green-50'} cursor-pointer flex items-center justify-between transition-colors`} onClick={() => toggleClient(`ok-${clienteId}`)}>
                      <div className="flex items-center gap-3"><ChevronRight className={`text-green-500 transition-transform ${expandedClients.includes(`ok-${clienteId}`) ? 'rotate-90' : ''}`} /><Folder className="text-green-400 hidden md:block" size={18} /><h3 className="font-black text-base md:text-lg uppercase truncate">{group.cliente.nome}</h3></div>
                    </div>
                    {expandedClients.includes(`ok-${clienteId}`) && (
                      <div className={`p-4 md:p-5 space-y-6 ${tc.bgCard}`}>
                        {Object.entries(group.ciclos).map(([cicloLabel, data]: [string, any]) => (
                          <div key={`ok-ciclo-${cicloLabel}`} className="space-y-3">
                            <div className={`flex items-center gap-2 border-b ${theme === 'dark' ? 'border-green-900/50' : 'border-green-100'} pb-2`}><Calendar size={14} className="text-green-500" /><h4 className="font-black text-xs text-green-500 uppercase tracking-widest">{cicloLabel}</h4></div>
                            <div className={`grid gap-3 pl-0 md:pl-2 md:border-l-2 ${theme === 'dark' ? 'border-green-900/50' : 'border-green-100'} md:ml-1`}>
                              {data.itens.map((m: Material) => (
                                <div key={m.id} className={`${theme === 'dark' ? 'bg-zinc-950/50 border-zinc-800' : 'bg-zinc-50/50 border-zinc-100'} p-4 rounded-2xl shadow-sm border flex flex-col md:flex-row items-start md:items-center gap-4 transition-colors`}>
                                  <div className="flex-1 min-w-0 w-full"><span className={`${theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'} text-[9px] font-black uppercase px-2 py-1 rounded-md mb-2 inline-block`}>Pronto Final</span><h5 className="font-bold text-sm">{m.titulo}</h5></div>
                                  <div className="grid grid-cols-2 md:flex gap-2 w-full md:w-auto flex-wrap shrink-0">
                                    <button onClick={() => setPreviewRoteiro(m)} className={`p-3 ${tc.bgCard} border ${tc.borderStrong} ${tc.textMuted} rounded-xl ${tc.bgHover} flex justify-center`} title="Ver Roteiro"><FileText size={18} /></button>

                                    {m.link_drive && <button onClick={() => setPreviewUrl(m.link_drive)} className={`px-4 py-3 ${tc.bgCard} border ${tc.borderStrong} ${tc.textMuted} rounded-xl font-bold text-xs flex items-center gap-2 justify-center ${tc.bgHover}`} title="Ver Vídeo"><FileVideo size={14} /> Ver Post</button>}
                                    {m.link_capa && <button onClick={() => setPreviewUrl(m.link_capa)} className={`px-4 py-3 ${tc.bgCard} border ${tc.borderStrong} ${tc.textMuted} rounded-xl font-bold text-xs flex items-center gap-2 justify-center ${tc.bgHover}`} title="Ver Capa/Card"><ImageIcon size={14} /> Capa/Card</button>}

                                    <button onClick={() => openConfirm('Arquivar e Finalizar', 'Deseja marcar como postado e arquivar?', async () => { setActionLoading(m.id); await supabase.from('materiais').update({ status: 'concluido' }).eq('id', m.id); loadData(); setActionLoading(null); }, 'warning')} disabled={actionLoading === m.id} className={`col-span-2 md:col-span-1 px-4 py-3 ${theme === 'dark' ? 'bg-white text-black hover:bg-zinc-200' : 'bg-zinc-900 text-white hover:bg-black'} rounded-xl font-bold text-xs flex items-center gap-2 justify-center disabled:opacity-50 transition-colors`}>{actionLoading === m.id ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />} Arquivar</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ABA: VISÃO GERAL */}
        {activeTab === 'geral' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 text-left">
              {[
                { label: 'Pendentes', val: metrics.pendentes, color: 'text-blue-600', icon: Clock },
                { label: 'Ajustes', val: metrics.ajustes, color: 'text-orange-500', icon: MessageSquare },
                { label: 'Aprovados', val: metrics.aprovados, color: 'text-green-500', icon: CheckCircle },
                { label: 'Eficiência', val: `${metrics.eficiencia}%`, color: theme === 'dark' ? 'text-zinc-100' : 'text-zinc-800', icon: TrendingUp },
              ].map((m, i) => (
                <div key={i} className={`${tc.bgCard} p-4 md:p-6 rounded-[24px] border ${tc.borderStrong} shadow-sm transition-colors`}>
                  <p className={`${tc.textMuted} text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1`}>{m.label}</p>
                  <div className="flex items-end justify-between"><h3 className={`text-2xl md:text-3xl font-black ${m.color}`}>{m.val}</h3><m.icon className="opacity-10 hidden sm:block" size={24} /></div>
                </div>
              ))}
            </div>

            {/* CENTRO DE COMANDO: FLUXO NEURAL */}
            <div className={`w-full ${tc.bgCard} p-6 md:p-8 rounded-[32px] border ${tc.borderStrong} shadow-sm transition-colors relative overflow-hidden min-h-[300px] flex flex-col justify-center`}>
              {/* Background Grid Pattern for futuristic vibe */}
              <div className={`absolute inset-0 opacity-[0.03] ${theme === 'dark' ? 'bg-[radial-gradient(#fff_1px,transparent_1px)]' : 'bg-[radial-gradient(#000_1px,transparent_1px)]'} [background-size:20px_20px] pointer-events-none`}></div>

              <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
                <div>
                  <h3 className={`text-xs md:text-sm font-black uppercase tracking-widest ${tc.textMuted} flex items-center gap-2`}>
                    <Activity size={16} className="text-blue-500" /> Fluxo Operacional
                  </h3>
                  <p className={`text-[10px] font-bold uppercase mt-1 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    Monitoramento em tempo real
                  </p>
                </div>
                {gargalo.count > 0 && (
                  <div className={`px-4 py-2 rounded-full border ${theme === 'dark' ? 'bg-red-900/20 border-red-900/50 text-red-400' : 'bg-red-50 border-red-200 text-red-600'} flex items-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-[0_0_15px_rgba(239,68,68,0.2)]`}>
                    <AlertCircle size={14} className="animate-pulse" /> Gargalo Atual: {gargalo.name} ({gargalo.count})
                  </div>
                )}
              </div>

              <div className="relative w-full overflow-x-auto pb-10 pt-4 custom-scrollbar">
                <div className="min-w-[800px] flex items-center justify-between relative px-10">
                  {/* MAIN CONNECTION LINE */}
                  <div className={`absolute top-1/2 left-14 right-14 h-1 -translate-y-1/2 ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-200'} z-0 rounded-full overflow-hidden`}>
                    {/* Glowing pulse on the line */}
                    <div className="w-1/3 h-full bg-gradient-to-r from-transparent via-blue-500/50 to-transparent animate-[pulse_3s_ease-in-out_infinite] translate-x-full opacity-50"></div>
                  </div>

                  {/* NODES */}
                  {pipeline.map((node, i) => {
                    const isGargalo = gargalo.name === node.label && node.count > 0;
                    return (
                      <div key={node.id} className="relative z-10 flex flex-col items-center gap-3">
                        {/* Node Circle */}
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center border-4 transition-all duration-500 relative
                              ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-100'}
                              ${node.count > 0 ? (theme === 'dark' ? 'border-zinc-700' : 'border-zinc-300') : ''}
                              ${isGargalo ? `scale-110 !border-red-500` : ''}
                            `}
                          style={{ boxShadow: isGargalo ? `0 0 20px ${node.glow}` : node.count > 0 ? (theme === 'dark' ? `0 0 10px rgba(255,255,255,0.05)` : `0 0 10px rgba(0,0,0,0.05)`) : 'none' }}>

                          {/* Pulse ring if it has tasks but isn't necessarily the bottleneck */}
                          {isGargalo && <div className="absolute inset-0 rounded-full border-2 border-red-500 animate-ping opacity-30"></div>}

                          <node.icon size={20} className={node.count > 0 ? (isGargalo ? 'text-red-500' : node.color) : tc.textMuted} />

                          {/* Task Badge */}
                          {node.count > 0 && (
                            <div className={`absolute -top-2 -right-2 ${isGargalo ? 'bg-red-500' : node.bg} text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-md`}>
                              {node.count}
                            </div>
                          )}
                        </div>
                        {/* Label */}
                        <div className="text-center absolute -bottom-10 w-32">
                          <p className={`text-[10px] font-black uppercase tracking-widest ${node.count > 0 ? tc.textMain : tc.textMuted}`}>{node.label}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-left">
                <h2 className="text-2xl md:text-3xl font-black tracking-tighter uppercase">{showArchived ? 'ARQUIVO MORTO' : 'FLUXO DE APROVAÇÃO'}</h2>
                <div className="flex w-full md:w-auto gap-3">
                  <button onClick={syncWithClickUp} disabled={syncing} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 md:py-2 ${tc.bgCard} border ${tc.borderStrong} rounded-xl text-[10px] font-black uppercase ${tc.textMuted} ${tc.bgHover} disabled:opacity-50 transition-colors`}><RefreshCw size={14} className={syncing ? "animate-spin" : ""} /> <span className="hidden sm:inline">Sync ClickUp</span></button>
                  <button onClick={() => setShowArchived(!showArchived)} className={`flex-1 md:flex-none px-4 py-3 md:py-2 rounded-xl text-xs font-bold transition-colors ${showArchived ? (theme === 'dark' ? 'bg-white text-black' : 'bg-zinc-900 text-white') : (theme === 'dark' ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-200 text-zinc-500')}`}>{showArchived ? 'Ver Ativos' : 'Ver Arquivados'}</button>
                </div>
              </div>
              {/* FILTROS RÁPIDOS GLOBAIS */}
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar py-2">
                {[
                  { id: 'todos', label: 'TODOS', color: 'bg-zinc-500' },
                  { id: 'urgentes', label: '🔥 ATRASADOS', color: 'bg-red-600' },
                  { id: 'ajustes', label: '💬 AJUSTES', color: 'bg-orange-500' },
                  { id: 'pendentes', label: '⏳ PENDENTES', color: 'bg-blue-500' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setActiveFilter(f.id)}
                    className={`px-4 py-2 rounded-full text-[9px] font-black uppercase transition-all shrink-0 border-2 ${activeFilter === f.id ? `${f.color} text-white border-transparent shadow-lg scale-105` : `${theme === 'dark' ? 'border-zinc-800 text-zinc-500 hover:border-zinc-600' : 'border-zinc-200 text-zinc-400 hover:border-zinc-300'}`}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="relative group"><Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400" size={20} /><input type="text" placeholder="Procurar por cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`w-full p-4 pl-14 ${tc.bgCard} border ${tc.borderStrong} rounded-2xl font-bold shadow-sm outline-none focus:border-blue-400 transition-colors text-sm`} /></div>

              <div className={`${tc.bgCard} border rounded-[24px] overflow-hidden shadow-xl ${tc.borderStrong} transition-colors`}>
                <div className={`divide-y ${theme === 'dark' ? 'divide-zinc-800' : 'divide-zinc-100'} text-left`}>
                  {Object.entries(groupedVisaoGeral).map(([clienteId, group]) => {
                    let countPendentes = 0, countAjustes = 0, countAprovadosRoteiro = 0, countAprovadosVideo = 0, countRevisao = 0, countEmEdicao = 0;
                    Object.values(group.ciclos).forEach((cicloData: any) => {
                      cicloData.itens.forEach((i: Material) => {
                        if (i.status === 'pendente' || i.status === 'roteiro_pendente') countPendentes++;
                        if (i.status === 'ajustes') countAjustes++;
                        if (i.status === 'revisao') countRevisao++;
                        if (i.status === 'em_edicao') countEmEdicao++;
                        if (i.status === 'aprovado' || i.status === 'post_aprovado') { if (i.link_drive || i.link_capa) countAprovadosVideo++; else countAprovadosRoteiro++; }
                        if (i.status === 'roteiro_aprovado') countAprovadosRoteiro++;
                      });
                    });
                    return (
                      <div key={`geral-${clienteId}`} className={`group border-b ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-50'} last:border-0`}>
                        <div className={`w-full flex flex-col p-4 md:p-6 ${theme === 'dark' ? 'hover:bg-zinc-900/80' : 'hover:bg-zinc-50/80'} cursor-pointer transition-colors`} onClick={() => toggleClient(`geral-${clienteId}`)}>
                          <div className="flex items-center">
                            <ChevronRight className={`text-blue-600 transition-transform ${expandedClients.includes(`geral-${clienteId}`) ? 'rotate-90' : ''}`} size={20} />
                            <div className="relative mx-2 md:mx-3"><Folder className={`${tc.textMuted}`} size={20} /></div>
                            <span className="text-lg md:text-xl font-black uppercase truncate">{group.cliente?.nome}</span>
                          </div>
                          <div className="flex gap-2 mt-3 ml-8 md:ml-10 flex-wrap">
                            {countEmEdicao > 0 && <span className={`px-2 py-1 ${theme === 'dark' ? 'bg-blue-900/30 text-blue-400 border-blue-900/50' : 'bg-blue-100 text-blue-700 border-blue-200'} rounded-md text-[9px] font-black uppercase border`}>{countEmEdicao} Em Produção</span>}
                            {countRevisao > 0 && <span className={`px-2 py-1 ${theme === 'dark' ? 'bg-purple-900/30 text-purple-400 border-purple-900/50' : 'bg-purple-100 text-purple-700 border-purple-200'} rounded-md text-[9px] font-black uppercase border animate-pulse`}>{countRevisao} P/ Aprovação</span>}
                            {countAjustes > 0 && <span className={`px-2 py-1 ${theme === 'dark' ? 'bg-red-900/30 text-red-400 border-red-900/50' : 'bg-red-100 text-red-700 border-red-200'} rounded-md text-[9px] font-black uppercase border`}>{countAjustes} Ajustes</span>}
                            {countAprovadosVideo > 0 && <span className={`px-2 py-1 ${theme === 'dark' ? 'bg-green-600 text-white' : 'bg-green-500 text-white'} rounded-md text-[9px] font-black uppercase`}>{countAprovadosVideo} P/ Postar</span>}
                            {countAprovadosRoteiro > 0 && <span className={`px-2 py-1 ${theme === 'dark' ? 'bg-green-900/30 text-green-400 border-green-900/50' : 'bg-green-100 text-green-700 border-green-200'} rounded-md text-[9px] font-black uppercase border`}>{countAprovadosRoteiro} Roteiros Aprov.</span>}
                          </div>
                        </div>
                        {expandedClients.includes(`geral-${clienteId}`) && (
                          <div className={`${tc.bgHighlight} pb-4`}>
                            {Object.entries(group.ciclos).map(([cicloLabel, data]: [string, any]) => {
                              let cicloRevisao = 0, cicloAjustes = 0, cicloAprovadosRoteiro = 0, cicloAprovadosVideo = 0, cicloEdicao = 0;
                              data.itens.forEach((i: Material) => {
                                if (i.status === 'revisao') cicloRevisao++;
                                if (i.status === 'ajustes') cicloAjustes++;
                                if (i.status === 'em_edicao') cicloEdicao++;
                                if (i.status === 'aprovado' || i.status === 'post_aprovado') { if (i.link_drive || i.link_capa) cicloAprovadosVideo++; else cicloAprovadosRoteiro++; }
                                if (i.status === 'roteiro_aprovado') cicloAprovadosRoteiro++;
                              });
                              return (
                                <div key={`geral-ciclo-${cicloLabel}`} className="px-3 md:px-6 pt-2">
                                  <div className={`w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 px-4 ${tc.bgHover} rounded-2xl border border-transparent ${theme === 'dark' ? 'hover:border-zinc-800' : 'hover:border-zinc-100'} mb-1 transition-colors`}>
                                    <div className="flex items-center gap-2 cursor-pointer flex-1 flex-wrap" onClick={() => toggleCiclo(clienteId, cicloLabel)}>
                                      <ChevronRight size={16} className={`${textSecundario} transition-transform ${expandedCiclos.includes(`${clienteId}-${cicloLabel}`) ? 'rotate-90' : ''}`} />
                                      <Calendar size={16} className="text-blue-500 shrink-0" />
                                      <span className={`text-xs font-black uppercase tracking-widest truncate ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-600'}`}>{cicloLabel}</span>
                                      <span className={`text-[9px] font-black uppercase shrink-0 px-1 ${textSecundario}`}>{data.aprovados}/{data.total} OK</span>

                                      <div className="flex gap-1.5 flex-wrap ml-1">
                                        {cicloEdicao > 0 && <span className={`px-1.5 py-0.5 ${theme === 'dark' ? 'bg-blue-900/30 text-blue-400 border-blue-900/50' : 'bg-blue-100 text-blue-700 border-blue-200'} rounded-md text-[8px] font-black uppercase border`}>{cicloEdicao} Produção</span>}
                                        {cicloRevisao > 0 && <span className={`px-1.5 py-0.5 ${theme === 'dark' ? 'bg-purple-900/30 text-purple-400 border-purple-900/50' : 'bg-purple-100 text-purple-700 border-purple-200'} rounded-md text-[8px] font-black uppercase border animate-pulse`}>{cicloRevisao} P/ Aprovação</span>}
                                        {cicloAjustes > 0 && <span className={`px-1.5 py-0.5 ${theme === 'dark' ? 'bg-red-900/30 text-red-400 border-red-900/50' : 'bg-red-100 text-red-700 border-red-200'} rounded-md text-[8px] font-black uppercase border`}>{cicloAjustes} Ajustes</span>}
                                        {cicloAprovadosVideo > 0 && <span className={`px-1.5 py-0.5 ${theme === 'dark' ? 'bg-green-600' : 'bg-green-500'} text-white rounded-md text-[8px] font-black uppercase`}>{cicloAprovadosVideo} P/ Postar</span>}
                                      </div>
                                    </div>

                                    <div className="flex w-full sm:w-auto gap-2">
                                      {!showArchived && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setCycleToArchive({ itens: data.itens, cicloLabel }); setIsArchiveCycleModalOpen(true); }}
                                          className={`flex-1 sm:flex-none px-4 py-2.5 sm:py-1.5 ${theme === 'dark' ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-800 hover:text-white'} rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all shadow-sm`}
                                          title="Arquivar todo o Ciclo"
                                        >
                                          <Archive size={14} className="sm:w-3 sm:h-3" /> Arquivar
                                        </button>
                                      )}
                                      {!showArchived && (
                                        <button onClick={(e) => { e.stopPropagation(); handleAvisarCicloWhatsApp(group.cliente, cicloLabel); }} className={`flex-1 sm:flex-none px-4 py-2.5 sm:py-1.5 ${theme === 'dark' ? 'bg-green-900/30 text-green-400 hover:bg-green-600 hover:text-white' : 'bg-green-50 text-green-600 hover:bg-green-600 hover:text-white'} rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all shadow-sm`}>
                                          <Send size={14} className="sm:w-3 sm:h-3" /> Avisar Cliente
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {expandedCiclos.includes(`${clienteId}-${cicloLabel}`) && (
                                    <div className="pl-4 md:pl-12 pr-2 md:pr-6 py-2 space-y-3">
                                      {data.itens.map((m: Material) => (
                                        <div key={m.id} className={`flex flex-col md:flex-row items-start md:items-center justify-between ${tc.bgCard} border ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200/60'} p-4 md:p-5 rounded-[20px] shadow-sm group/item gap-4 transition-colors`}>
                                          <div className="flex-1 w-full">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className="font-bold text-sm break-words">{m.titulo}</span>
                                              {(m.status === 'aprovado' || m.status === 'concluido') && (<span className={`text-[8px] font-black uppercase text-white ${theme === 'dark' ? 'bg-green-600' : 'bg-green-500'} px-1.5 py-0.5 rounded shadow-sm`}>Arquivado / Finalizado</span>)}
                                              {m.status === 'post_aprovado' && (<span className={`text-[8px] font-black uppercase text-white ${theme === 'dark' ? 'bg-blue-600' : 'bg-blue-500'} px-1.5 py-0.5 rounded shadow-sm`}>Post Aprovado (Cliente)</span>)}
                                              {m.status === 'roteiro_aprovado' && (<span className={`text-[8px] font-black uppercase ${theme === 'dark' ? 'text-emerald-400 bg-emerald-900/30 border-emerald-900/50' : 'text-emerald-700 bg-emerald-100 border-emerald-200'} px-1.5 py-0.5 rounded border`}>Roteiro Aprovado (Cliente)</span>)}
                                              {m.status === 'ajustes' && (<span className={`text-[8px] font-black uppercase ${theme === 'dark' ? 'text-red-400 bg-red-900/30 border-red-900/50' : 'text-red-700 bg-red-100 border-red-200'} px-1.5 py-0.5 rounded border`}>Ajustes Solicitados</span>)}
                                              {m.status === 'em_edicao' && (<span className={`text-[8px] font-black uppercase ${theme === 'dark' ? 'text-blue-400 bg-blue-900/30 border-blue-900/50' : 'text-blue-700 bg-blue-100 border-blue-200'} px-1.5 py-0.5 rounded border`}>Em Edição / Design</span>)}
                                              {m.status === 'analise_roteiro' && (<span className={`text-[8px] font-black uppercase ${theme === 'dark' ? 'text-pink-400 bg-pink-900/30 border-pink-900/50' : 'text-pink-700 bg-pink-100 border-pink-200'} px-1.5 py-0.5 rounded border`}>Roteiro em Análise</span>)}
                                              {m.status === 'revisao' && (<span className={`text-[8px] font-black uppercase ${theme === 'dark' ? 'text-purple-400 bg-purple-900/30 border-purple-900/50' : 'text-purple-700 bg-purple-100 border-purple-200'} px-1.5 py-0.5 rounded border`}>Revisão Agência</span>)}
                                              {m.link_bruto ? (
                                                <span className={`text-[8px] font-black uppercase ${theme === 'dark' ? 'text-indigo-400 bg-indigo-900/30 border-indigo-900/50' : 'text-indigo-700 bg-indigo-100 border-indigo-200'} px-1.5 py-0.5 rounded border flex items-center gap-1`} title={m.link_bruto}><Link size={8} /> Pasta OK</span>
                                              ) : (
                                                <span className={`text-[8px] font-black uppercase ${theme === 'dark' ? 'text-amber-400 bg-amber-900/30 border-amber-900/50' : 'text-amber-700 bg-amber-100 border-amber-200'} px-1.5 py-0.5 rounded border flex items-center gap-1 animate-pulse`}><Link size={8} /> Sem Pasta</span>
                                              )}
                                              {renderDeadline(m.data_limite)}
                                            </div>

                                            <div className="relative inline-block w-full md:w-auto mt-3">
                                              <select value={m.status} onChange={e => handleUpdateStatus(m.id, e.target.value)} disabled={actionLoading === m.id} className={`appearance-none px-3 py-1.5 pr-7 rounded-md text-[9px] font-black uppercase outline-none border transition-all cursor-pointer shadow-sm w-full md:w-auto disabled:opacity-50 ${getStatusColor(m.status)} ${theme === 'dark' ? 'bg-opacity-20 border-opacity-30' : ''}`}>
                                                <option value="analise_roteiro">Roteiro em Análise</option>
                                                <option value="roteiro_pendente">Aguardando Cliente (Roteiro)</option>
                                                <option value="roteiro_aprovado">Roteiro Aprovado (Pelo Cliente)</option>
                                                <option value="planejamento">Aguardando Decupagem</option>
                                                <option value="em_organizacao">Decupagem em Andamento</option>
                                                <option value="faltando_material">Falta Material Bruto</option>
                                                <option value="verificar_material">Verificar Material</option>
                                                <option value="organizado">Pasta Pronta (P/ Editor)</option>
                                                <option value="em_edicao">Em Edição / Design</option>
                                                <option value="pendente">Aguardando Aprovação Cliente</option>
                                                <option value="ajustes">Ajustes Solicitados</option>
                                                <option value="revisao">Revisão Agência</option>
                                                <option value="post_aprovado">Post Aprovado (Pelo Cliente)</option>
                                                <option value="concluido">Arquivado / Finalizado</option>
                                              </select>
                                              {actionLoading === m.id ? <Loader2 size={12} className={`absolute right-2 top-1/2 -translate-y-1/2 animate-spin ${textSecundario}`} /> : <ChevronDown size={12} className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 ${getStatusColor(m.status).split(' ')[1]}`} />}
                                            </div>

                                            {m.feedback && <p className={`${textSecundario} text-[10px] font-bold mt-3 ${theme === 'dark' ? 'bg-zinc-900/50' : 'bg-zinc-50'} p-3 rounded-lg break-words break-all whitespace-pre-wrap`}>💬 {renderTextWithLinks(m.feedback)}</p>}
                                          </div>

                                          <div className={`flex items-center gap-2 flex-wrap md:opacity-0 md:group-hover/item:opacity-100 transition-all pt-2 md:pt-0 border-t md:border-t-0 ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-50'} mt-2 md:mt-0 w-full md:w-auto shrink-0`}>
                                            {m.status === 'concluido' && (<button onClick={() => handleUpdateStatus(m.id, 'pendente')} disabled={actionLoading === m.id} className={`p-2.5 md:p-2 ${theme === 'dark' ? 'text-green-400 bg-green-900/30 hover:bg-green-600 hover:text-white' : 'text-green-600 bg-green-50 hover:bg-green-600 hover:text-white'} rounded-lg disabled:opacity-50 transition-colors`} title="Restaurar">{actionLoading === m.id ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}</button>)}
                                            {m.status === 'revisao' && (<button onClick={() => handleCheckAndAprovar(m)} disabled={actionLoading === m.id} className={`p-2.5 md:p-2 ${theme === 'dark' ? 'text-green-400 bg-green-900/30 hover:bg-green-600 hover:text-white' : 'text-green-600 bg-green-50 hover:bg-green-600 hover:text-white'} rounded-lg disabled:opacity-50 transition-colors`} title="Aprovar">{actionLoading === m.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}</button>)}
                                            {m.status === 'ajustes' && (<button onClick={() => openResolveModal(m, 'planner')} className={`p-2.5 md:p-2 ${theme === 'dark' ? 'text-red-400 bg-red-900/30 hover:bg-red-600 hover:text-white' : 'text-red-600 bg-red-50 hover:bg-red-600 hover:text-white'} rounded-lg transition-colors`} title="Resolver Problema / Devolver"><AlertCircle size={16} /></button>)}
                                            {(m.status === 'organizado' || m.status === 'em_edicao') && (
                                              <button onClick={() => openResolveModal(m, 'planner')} className={`p-2.5 md:p-2 ${theme === 'dark' ? 'text-amber-400 bg-amber-900/30 hover:bg-amber-600 hover:text-white' : 'text-amber-600 bg-amber-50 hover:bg-amber-600 hover:text-white'} rounded-lg transition-colors`} title="Devolver ao Decupador"><RotateCcw size={16} /></button>
                                            )}
                                            {m.status === 'analise_roteiro' && (<button onClick={() => handleEnviarRoteiroCliente(m)} disabled={actionLoading === m.id} className={`p-2.5 md:p-2 ${theme === 'dark' ? 'text-purple-400 bg-purple-900/30 hover:bg-purple-600 hover:text-white' : 'text-purple-600 bg-purple-50 hover:bg-purple-600 hover:text-white'} rounded-lg disabled:opacity-50 transition-colors`} title="Enviar Roteiro para o Cliente">{actionLoading === m.id ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}</button>)}
                                            <button onClick={() => setPreviewRoteiro(m)} className={`p-2.5 md:p-2 ${theme === 'dark' ? 'text-zinc-400 bg-zinc-800 hover:bg-purple-900/30 hover:text-purple-400' : 'text-zinc-500 bg-zinc-50 hover:bg-purple-50 hover:text-purple-600'} rounded-lg transition-colors`} title="Ver Roteiro"><FileText size={16} /></button>

                                            {m.link_drive && <button onClick={() => setPreviewUrl(m.link_drive)} className={`p-2.5 md:p-2 ${theme === 'dark' ? 'text-zinc-400 bg-zinc-800 hover:bg-blue-900/30 hover:text-blue-400' : 'text-zinc-500 bg-zinc-50 hover:bg-blue-50 hover:text-blue-600'} rounded-lg transition-colors`} title="Ver Vídeo/Carrossel"><FileVideo size={16} /></button>}
                                            {m.link_capa && <button onClick={() => setPreviewUrl(m.link_capa)} className={`p-2.5 md:p-2 ${theme === 'dark' ? 'text-zinc-400 bg-zinc-800 hover:bg-pink-900/30 hover:text-pink-400' : 'text-zinc-500 bg-zinc-50 hover:bg-pink-50 hover:text-pink-600'} rounded-lg transition-colors`} title="Ver Capa/Card"><ImageIcon size={16} /></button>}

                                            <button onClick={() => abrirLogsDoMaterial(m.id, m.titulo)} className={`p-2.5 md:p-2 ${theme === 'dark' ? 'text-teal-400 bg-teal-900/30 hover:bg-teal-500 hover:text-white' : 'text-teal-500 bg-teal-50 hover:bg-teal-500 hover:text-white'} rounded-lg transition-colors`} title="Ver Histórico de Visualizações"><Activity size={16} /></button>

                                            <button onClick={() => { setSelectedMaterial(m); setNewLinkBruto(m.link_bruto || ''); setIsLinkBrutoModalOpen(true); }} className={`p-2.5 md:p-2 ${theme === 'dark' ? 'text-indigo-400 bg-indigo-900/30 hover:bg-indigo-600 hover:text-white' : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-600 hover:text-white'} rounded-lg transition-colors`} title="Editar Link da Pasta (Decupagem)"><Link size={16} /></button>
                                            <button onClick={() => { setSelectedMaterial(m); setIsVersionModalOpen(true); }} className={`p-2.5 md:p-2 ${theme === 'dark' ? 'text-blue-400 bg-blue-900/30 hover:bg-blue-600 hover:text-white' : 'text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white'} rounded-lg transition-colors`} title="Atualizar Link (Entrega Final)"><UploadCloud size={16} /></button>
                                            {m.status !== 'concluido' && (<button onClick={() => handleUpdateStatus(m.id, 'concluido')} disabled={actionLoading === m.id} className={`p-2.5 md:p-2 ${theme === 'dark' ? 'text-zinc-500 bg-zinc-800 hover:text-amber-400 hover:bg-amber-900/30' : 'text-zinc-400 bg-zinc-50 hover:text-amber-600 hover:bg-amber-50'} rounded-lg disabled:opacity-50 transition-colors`} title="Arquivar">{actionLoading === m.id ? <Loader2 size={16} className="animate-spin" /> : <Archive size={16} />}</button>)}
                                            <button onClick={() => openConfirm('Excluir Tarefa', 'Esta ação é permanente. Deseja excluir?', () => { setActionLoading(m.id); supabase.from('materiais').delete().eq('id', m.id).then(() => { loadData(); setActionLoading(null); }) }, 'danger')} disabled={actionLoading === m.id} className={`p-2.5 md:p-2 ${theme === 'dark' ? 'text-red-400 bg-red-900/30 hover:text-red-300' : 'text-red-400 bg-red-50 hover:text-red-600'} rounded-lg ml-auto md:ml-0 disabled:opacity-50 transition-colors`}>{actionLoading === m.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}</button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
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

        {/* ABA: CADASTRO DO CLIENTE */}
        {activeTab === 'cadastro-clientes' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 text-left">
            <h2 className="text-2xl md:text-3xl font-black tracking-tight uppercase">{editingCliente ? 'A Editar Cliente' : 'Cadastro do Cliente'}</h2>
            <form onSubmit={async (e) => {
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
                  toast.success("Atualizado!"); setEditingCliente(null);
                } else {
                  await cadastrarClienteCompleto(f);
                  toast.success("Criado com sucesso!");
                }
                loadData();
              } catch { toast.error("Erro"); } finally { setLoading(false); }
            }} className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 md:gap-6 p-6 md:p-8 ${tc.bgCard} border-2 rounded-[24px] md:rounded-[32px] shadow-sm items-end ${editingCliente ? (theme === 'dark' ? 'border-blue-500' : 'border-blue-500') : tc.borderStrong}`}>

              <div className="space-y-1"><label className={`text-[10px] font-black ${tc.textMuted} uppercase ml-2`}>Empresa</label><input name="nome" className={`w-full p-4 ${tc.bgInput} border ${tc.borderStrong} rounded-2xl outline-none font-bold text-sm focus:border-[#A25431] transition-colors`} defaultValue={editingCliente?.nome || ""} key={editingCliente?.id} required /></div>
              <div className="space-y-1"><label className={`text-[10px] font-black ${tc.textMuted} uppercase ml-2`}>WhatsApp Cliente</label><input name="telefone" className={`w-full p-4 ${tc.bgInput} border ${tc.borderStrong} rounded-2xl outline-none font-bold text-sm focus:border-[#A25431] transition-colors`} defaultValue={editingCliente?.telefone || ""} key={editingCliente?.id + 'tel'} required /></div>
              <div className="space-y-1"><label className={`text-[10px] font-black ${theme === 'dark' ? 'text-blue-400' : 'text-blue-500'} uppercase ml-2`}>Wpp Agência (Suporte)</label><input name="wpp_suporte" placeholder="Ex: 5511999999999" className={`w-full p-4 ${theme === 'dark' ? 'bg-blue-900/10 border-blue-900/30 text-blue-100' : 'bg-blue-50 border-blue-100'} rounded-2xl outline-none font-bold text-sm focus:border-blue-400 transition-colors`} defaultValue={editingCliente?.wpp_suporte || ""} key={editingCliente?.id + 'wppsup'} /></div>
               <div className="space-y-1">
                 <label className={`text-[10px] font-black ${theme === 'dark' ? 'text-green-400' : 'text-green-500'} uppercase ml-2 flex justify-between items-center`}>
                   ID do Grupo WhatsApp
                   <button type="button" onClick={async () => {
                     setCarregandoGrupos(true);
                     const res = await buscarGruposWhatsApp();
                     if (res.data) { setListagemGrupos(res.data); setIsGruposModalOpen(true); }
                     else { toast.error(res.error || "Verifique as credenciais da Green API"); }
                     setCarregandoGrupos(false);
                   }} className="text-[8px] underline hover:no-underline">Listar Grupos</button>
                 </label>
                 <input 
                    name="whatsapp_group_id" 
                    placeholder="Ex: 123456789@g.us" 
                    className={`w-full p-4 ${theme === 'dark' ? 'bg-green-900/10 border-green-900/30 text-green-100' : 'bg-green-50 border-green-100'} rounded-2xl outline-none font-bold text-sm focus:border-green-400 transition-colors`} 
                    value={wppGroupId}
                    onChange={e => setWppGroupId(e.target.value)}
                  />
               </div>
              <div className="space-y-1"><label className={`text-[10px] font-black ${tc.textMuted} uppercase ml-2`}>Ciclos</label><input name="ciclos_contratados" type="number" min="1" className={`w-full p-4 ${tc.bgInput} border ${tc.borderStrong} rounded-2xl outline-none font-bold text-sm focus:border-[#A25431] transition-colors`} defaultValue={editingCliente?.ciclos_contratados || 12} key={editingCliente?.id + 'ciclo'} required /></div>

              <div className="space-y-1"><label className={`text-[10px] font-black ${tc.textMuted} uppercase ml-2`}>{editingCliente ? 'Trocar Logo' : 'Logo'}</label>
                <div className="relative group"><input type="file" name="logo" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  <div className={`w-full h-[54px] ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-zinc-500' : 'bg-zinc-50 border-zinc-200 text-zinc-400'} border-2 border-dashed rounded-2xl flex items-center justify-center transition-colors`}><Upload size={16} /></div>
                </div>
              </div>

              <div className="space-y-1">
                <label className={`text-[10px] font-black ${tc.textMuted} uppercase ml-2`}>Cor do Portal</label>
                <div className="flex items-center gap-3">
                  <input
                    name="cor_marca"
                    type="color"
                    className={`h-[54px] w-[54px] rounded-2xl cursor-pointer ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} p-1`}
                    defaultValue={editingCliente?.cor_marca || "#1e3a5f"}
                    key={editingCliente?.id + 'cor'}
                  />
                  <span className={`text-[10px] font-bold ${tc.textMuted} uppercase`}>Escolha a cor</span>
                </div>
              </div>

              <button disabled={loading} className={`w-full lg:w-auto h-[54px] rounded-2xl font-black uppercase text-[10px] transition-colors flex items-center justify-center gap-2 ${editingCliente ? 'bg-[#A25431] hover:bg-[#8a4729] text-white' : (theme === 'dark' ? 'bg-white hover:bg-zinc-200 text-black disabled:opacity-50' : 'bg-[#212013] hover:bg-black text-white disabled:opacity-50')}`}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                {editingCliente ? "Guardar" : "Registrar"}
              </button>
            </form>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {clientes.map((c, idx) => (
                <div key={`card-cliente-${c.id}-${idx}`} className={`p-5 md:p-8 ${tc.bgCard} border ${tc.borderStrong} rounded-[24px] shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4 group transition-colors`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl overflow-hidden ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} flex shrink-0 items-center justify-center border shadow-inner`}>
                      {c.logo_url ? (
                        <img
                          src={c.logo_url}
                          className="w-full h-full object-contain p-1"
                          onError={(e) => { e.currentTarget.src = 'https://placehold.co/150x150/f4f4f5/a1a1aa?text=Sem+Logo'; }}
                          alt="Logo do Cliente"
                        />
                      ) : (
                        <Users className="text-[#A25431]" size={24} />
                      )}
                    </div>
                    <div className="min-w-0"><h3 className="font-black text-lg md:text-xl uppercase truncate">{c.nome}</h3><p className={`${tc.textMuted} font-bold text-xs truncate`}><Phone size={12} className="inline mr-1" /> {c.telefone}</p></div>
                  </div>
                  <div className="flex gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-all justify-end">
                    <button onClick={() => { setEditingCliente(c); setWppGroupId(c.whatsapp_group_id || ''); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`p-3 ${theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-zinc-100 hover:bg-zinc-900 hover:text-white text-zinc-600'} rounded-xl transition-colors`} title="Editar Cliente"><RotateCcw size={18} /></button>
                    <button onClick={() => handleAvisarPortalWhatsApp(c)} className={`p-3 ${theme === 'dark' ? 'bg-green-900/30 hover:bg-green-900/50 text-green-400' : 'bg-green-50 hover:bg-green-600 hover:text-white text-green-600'} rounded-xl transition-colors`} title="Avisar no WhatsApp Automático"><Send size={18} /></button>
                    <button onClick={() => copyToClipboard(`${window.location.origin}/portal/${c.token_magico}`)} className={`p-3 ${theme === 'dark' ? 'bg-blue-900/30 hover:bg-blue-900/50 text-blue-400' : 'bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-600'} rounded-xl transition-colors`} title="Copiar Link do Portal"><Link size={18} /></button>
                    <button onClick={(e) => { e.preventDefault(); setClientToDelete(c); setIsDeleteClientModalOpen(true); }} className={`p-3 ${theme === 'dark' ? 'bg-red-900/30 hover:bg-red-900/50 text-red-400' : 'bg-red-50 hover:bg-red-600 hover:text-white text-red-500'} rounded-xl transition-colors`} title="Excluir Cliente"><Trash2 size={18} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ABA: EQUIPE */}
        {activeTab === 'equipe' && (
          <div className="max-w-5xl mx-auto space-y-8 md:space-y-12 animate-in slide-in-from-bottom-4 py-6 md:py-10">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-10">
              <div className="lg:col-span-1 space-y-6 text-left">
                <div className={`${tc.bgCard} p-6 md:p-8 rounded-[24px] md:rounded-[32px] border ${tc.borderStrong} shadow-sm`}>

                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg md:text-xl font-black uppercase">
                      {editingMembro ? 'Editar Membro' : 'Novo Membro'}
                    </h3>
                    {editingMembro && (
                      <button type="button" onClick={() => { setEditingMembro(null); setFormE({ nome: '', email: '', password: '', role: 'editor', telegram_thread_id: '' }); }} className={`${tc.textMuted} ${tc.bgHover} p-2 rounded-full transition-colors`}><X size={16} /></button>
                    )}
                  </div>

                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    setIsCreatingUser(true);
                    try {
                      if (editingMembro) {
                        await atualizarMembroEquipe(editingMembro.id, f);
                        toast.success("Membro atualizado com sucesso!");
                        setEditingMembro(null);
                      } else {
                        await criarMembroEquipe(f);
                        toast.success("Membro adicionado!");
                      }
                      setFormE({ nome: '', email: '', password: '', role: 'editor', telegram_thread_id: '' });
                      loadData();
                    } catch (error: any) {
                      toast.error(error.message)
                    } finally {
                      setIsCreatingUser(false)
                    }
                  }} className="space-y-4">

                    <input name="nome" placeholder="Nome Completo" className={`w-full p-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} rounded-2xl font-bold outline-none text-sm focus:border-[#A25431] transition-colors`} value={formE.nome} onChange={e => setFormE({ ...formE, nome: e.target.value })} required />
                    <input name="email" placeholder="E-mail" disabled={!!editingMembro} className={`w-full p-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} rounded-2xl font-bold outline-none text-sm focus:border-[#A25431] transition-colors disabled:opacity-50`} value={formE.email} onChange={e => setFormE({ ...formE, email: e.target.value })} required={!editingMembro} />
                    <input name="password" type="password" placeholder={editingMembro ? "Nova senha (opcional)" : "Senha"} className={`w-full p-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} rounded-2xl font-bold outline-none text-sm focus:border-[#A25431] transition-colors`} value={formE.password} onChange={e => setFormE({ ...formE, password: e.target.value })} required={!editingMembro} />

                    <select name="role" className={`w-full p-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} rounded-2xl font-bold outline-none text-sm focus:border-[#A25431] transition-colors`} value={formE.role} onChange={e => setFormE({ ...formE, role: e.target.value as any })}>
                      <option value="editor">Editor</option>
                      <option value="designer">Designer</option>
                      <option value="planner">Decupador</option>
                      <option value="admin">Administrador (Gestor)</option>
                    </select>

                    <input name="telegram_thread_id" placeholder="ID do Chat do ClickUp (View ID)" className={`w-full p-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} rounded-2xl font-bold outline-none text-sm focus:border-[#A25431] transition-colors`} value={formE.telegram_thread_id} onChange={e => setFormE({ ...formE, telegram_thread_id: e.target.value })} />

                    <button disabled={isCreatingUser} className={`w-full py-4 ${theme === 'dark' ? 'bg-white text-black hover:bg-zinc-200' : 'bg-[#212013] text-white hover:bg-black'} rounded-2xl font-black uppercase text-[10px] tracking-widest transition-colors flex items-center justify-center gap-2 disabled:opacity-50`}>
                      {isCreatingUser ? <Loader2 size={16} className="animate-spin" /> : null}
                      {isCreatingUser ? "A processar..." : (editingMembro ? "Salvar Alterações" : "Registrar")}
                    </button>
                  </form>
                </div>
              </div>
              <div className="lg:col-span-2 space-y-6 text-left">
                <div className={`${tc.bgCard} border ${tc.borderStrong} rounded-[24px] md:rounded-[32px] overflow-hidden shadow-sm overflow-x-auto`}>
                  <table className="w-full text-left border-collapse min-w-[500px] select-none">
                    <thead><tr className={`${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-100'} border-b text-[10px] font-black uppercase ${tc.textMuted}`}><th className="p-4 md:p-6">Utilizador</th><th className="p-4 md:p-6">Função</th><th className="p-4 md:p-6 text-right">Ações</th></tr></thead>
                    <tbody className={`divide-y ${theme === 'dark' ? 'divide-zinc-800' : 'divide-zinc-50'}`}>
                      {membros.length === 0 ? <tr><td colSpan={3} className={`p-6 text-center ${tc.textMuted} font-bold text-sm`}>Nenhum membro listado.</td></tr> : membros.map((m) => (
                        <tr key={m.id} className={`${tc.bgHover} transition-colors group`}>
                          <td className="p-4 md:p-6">
                            <div className="flex items-center gap-3">
                              <div className={`hidden sm:flex w-10 h-10 rounded-full ${theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600'} items-center justify-center font-black text-sm uppercase`}>
                                {m.nome ? m.nome.substring(0, 2) : m.email.substring(0, 2)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-sm truncate">{m.nome || 'Sem Nome Registado'}</p>
                                <p className={`text-[10px] ${tc.textMuted} font-medium truncate`}>{m.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 md:p-6">
                            <div className="relative inline-block w-full md:w-auto">
                              <select defaultValue={m.role} onChange={async (e) => { await supabase.from('perfis_equipe').update({ role: e.target.value }).eq('id', m.id); toast.success("Função alterada!"); }} className={`appearance-none ${theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'} text-[9px] md:text-[10px] font-black uppercase px-4 py-2 pr-8 rounded-full outline-none border-none cursor-pointer transition-colors w-full`}>
                                <option value="editor">Editor</option><option value="designer">Designer</option><option value="planner">Decupador</option><option value="admin">Gestor</option>
                              </select>
                              <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                            </div>
                          </td>
                          <td className="p-4 md:p-6 text-right flex justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditingMembro(m);
                                setFormE({ nome: m.nome || '', email: m.email || '', password: '', role: m.role || 'editor', telegram_thread_id: m.telegram_thread_id || '' });
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className={`${tc.textMuted} hover:text-blue-500 p-2 opacity-50 group-hover:opacity-100 transition-opacity`} title="Editar Perfil"
                            ><Edit3 size={18} /></button>
                            <button onClick={() => openConfirm('Remover Membro', 'Deseja realmente remover este membro da equipe?', async () => { await excluirMembro(m.id); loadData(); }, 'danger')} className={`${tc.textMuted} hover:text-red-500 p-2 opacity-50 group-hover:opacity-100 transition-opacity`} title="Remover"><Trash2 size={18} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* ABA: RELATÓRIOS */}
        {activeTab === 'relatorios' && (
          <div className="max-w-6xl mx-auto space-y-12 animate-in slide-in-from-bottom-4 duration-500 print:m-0 print:max-w-none">
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

            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="hidden print:flex print-header w-full">
                <div>
                  <h1 className="text-2xl font-black uppercase">Relatório de Produtividade</h1>
                  <p className="text-sm font-bold text-zinc-500">EvertonCMI Portal • Gerado em {new Date().toLocaleDateString('pt-BR')}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black uppercase">Filtro: Todos os Materiais</p>
                </div>
              </div>
              <div className="print:hidden">
                <h2 className="text-3xl font-black uppercase tracking-tight">Painel de Relatórios</h2>
                <p className={`${tc.textMuted} font-medium mt-1`}>Análise de produtividade da equipe e engajamento dos clientes.</p>
              </div>
            </header>

            {/* CARDS DE RESUMO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className={`${tc.bgCard} p-8 rounded-[32px] border ${tc.borderStrong} shadow-sm`}>
                <div className="w-12 h-12 bg-blue-500 text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/20"><Activity size={24} /></div>
                <p className={`${tc.textMuted} text-[10px] font-black uppercase tracking-widest`}>Total de Materiais</p>
                <h3 className="text-4xl font-black mt-2">{materiais.length}</h3>
                <p className="text-xs text-blue-500 font-bold mt-4 flex items-center gap-1">Histórico completo</p>
              </div>
              <div className={`${tc.bgCard} p-8 rounded-[32px] border ${tc.borderStrong} shadow-sm`}>
                <div className="w-12 h-12 bg-green-500 text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-green-500/20"><CheckCircle2 size={24} /></div>
                <p className={`${tc.textMuted} text-[10px] font-black uppercase tracking-widest`}>Taxa de Aprovação</p>
                <h3 className="text-4xl font-black mt-2">{metrics.eficiencia}%</h3>
                <div className="mt-4 w-full bg-zinc-100 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: `${metrics.eficiencia}%` }}></div>
                </div>
              </div>
              <div className={`${tc.bgCard} p-8 rounded-[32px] border ${tc.borderStrong} shadow-sm`}>
                <div className="w-12 h-12 bg-red-500 text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-red-500/20"><AlertCircle size={24} /></div>
                <p className={`${tc.textMuted} text-[10px] font-black uppercase tracking-widest`}>Total em Atraso</p>
                <h3 className="text-4xl font-black mt-2">{relatorioData.totalAtrasos}</h3>
                <p className="text-xs text-red-500 font-bold mt-4 flex items-center gap-1">Atenção aos prazos</p>
              </div>
              <div className={`${tc.bgCard} p-8 rounded-[32px] border ${tc.borderStrong} shadow-sm`}>
                <div className="w-12 h-12 bg-purple-500 text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-purple-500/20"><Clock size={24} /></div>
                <p className={`${tc.textMuted} text-[10px] font-black uppercase tracking-widest`}>Gargalo Atual</p>
                <h3 className="text-xl font-black mt-3 leading-tight">{gargalo.name || 'Nenhum'}</h3>
                <p className="text-xs text-purple-500 font-bold mt-3">{gargalo.count} itens aguardando</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* DESEMPENHO DA EQUIPE */}
              <div className={`${tc.bgCard} rounded-[32px] border ${tc.borderStrong} overflow-hidden shadow-sm`}>
                <header className={`p-6 md:p-8 border-b ${tc.borderStrong} ${theme === 'dark' ? 'bg-zinc-800/20' : 'bg-zinc-50/50'} flex items-center justify-between`}>
                  <div>
                    <h3 className={`font-black uppercase text-sm ${tc.textMain}`}>Rendimento e Atrasos</h3>
                    <p className={`text-xs ${tc.textMuted} font-medium mt-1`}>Produtividade vs. Cumprimento de Prazos.</p>
                  </div>
                  <Users size={20} className={theme === 'dark' ? 'text-zinc-400' : 'text-[#A25431]'} />
                </header>
                <div className="p-6 md:p-8 space-y-6">
                  {relatorioData.performance.map((m, i) => (
                    <div key={i} className="space-y-3">
                      <div className="flex justify-between items-end">
                        <div className="flex flex-col">
                          <span className="text-xs font-black uppercase">{m.nome}</span>
                          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-tighter">{m.role}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-zinc-400 block">{m.entregas} entregas</span>
                          {m.atrasos > 0 && <span className="text-[9px] font-black text-red-500 uppercase">🔥 {m.atrasos} em atraso</span>}
                        </div>
                      </div>
                      <div className="w-full bg-zinc-100 rounded-full h-3 overflow-hidden flex">
                        <div className="bg-[#A25431] h-3 transition-all duration-1000" style={{ width: `${m.total > 0 ? (m.entregas / m.total) * 100 : 0}%` }}></div>
                        {m.atrasos > 0 && <div className="bg-red-500 h-3" style={{ width: `${(m.atrasos / m.total) * 100}%` }}></div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`${tc.bgCard} rounded-[32px] border ${tc.borderStrong} overflow-hidden shadow-sm`}>
                <header className={`p-6 md:p-8 border-b ${tc.borderStrong} ${theme === 'dark' ? 'bg-zinc-800/20' : 'bg-zinc-50/50'} flex items-center justify-between`}>
                  <div>
                    <h3 className={`font-black uppercase text-sm ${tc.textMain}`}>Ajustes por Equipe</h3>
                    <p className={`text-xs ${tc.textMuted} font-medium mt-1`}>Ranking de quem recebe mais correções.</p>
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
                            <span className={`text-[10px] font-black uppercase ${tc.textMuted}`}>{p.role}</span>
                            <p className="font-bold text-sm uppercase">{p.nome}</p>
                         </div>
                         <span className="text-xs font-black text-pink-500">{p.ajustesHistoricos} ajustes</span>
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

              {/* RANKING DE AJUSTES (CLIENTES) */}
              <div className={`${tc.bgCard} rounded-[32px] border ${tc.borderStrong} overflow-hidden shadow-sm`}>
                <header className={`p-6 md:p-8 border-b ${tc.borderStrong} ${theme === 'dark' ? 'bg-zinc-800/20' : 'bg-zinc-50/50'} flex items-center justify-between`}>
                  <div>
                    <h3 className={`font-black uppercase text-sm ${tc.textMain}`}>Nível de Ajustes p/ Cliente</h3>
                    <p className={`text-xs ${tc.textMuted} font-medium mt-1`}>Clientes que mais solicitam alterações.</p>
                  </div>
                  <MessageSquare size={20} className="text-orange-500" />
                </header>
                <div className="p-6 md:p-8 space-y-4">
                  {relatorioData.topAjustesClientes.map((c, i) => (
                    <div key={i} className={`flex items-center justify-between p-4 rounded-2xl ${tc.bgHighlight} border ${tc.borderStrong}`}>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center font-black">{i + 1}</div>
                        <div>
                          <p className="font-black uppercase text-xs truncate max-w-[150px]">{c.nome}</p>
                          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{c.total} materiais</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-black text-lg ${c.ajustes > 5 ? 'text-red-500' : 'text-orange-500'}`}>{c.ajustes}</p>
                        <p className="text-[9px] text-zinc-400 font-bold uppercase">Ajustes ativos</p>
                      </div>
                    </div>
                  ))}
                  {relatorioData.topAjustesClientes.length === 0 && (
                    <p className="text-center py-10 text-zinc-400 font-bold text-xs">Nenhum ajuste pendente no momento.</p>
                  )}
                </div>
              </div>
            </div>

            {/* TAREFAS CRÍTICAS (EM ATRASO) */}
            <div className={`${tc.bgCard} rounded-[32px] border ${tc.borderStrong} overflow-hidden shadow-sm card-report`}>
              <header className={`p-6 md:p-8 border-b ${tc.borderStrong} ${theme === 'dark' ? 'bg-red-900/10' : 'bg-red-50/50'} flex items-center justify-between`}>
                <div>
                  <h3 className="font-black uppercase text-sm text-red-600">Tarefas Críticas (Em Atraso)</h3>
                  <p className="text-xs text-red-400 font-medium mt-1">Materiais que ultrapassaram a data limite estipulada.</p>
                </div>
                <AlertCircle size={20} className="text-red-500" />
              </header>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className={`border-b ${tc.borderStrong} text-[9px] font-black uppercase tracking-widest ${tc.textMuted}`}>
                      <th className="p-6">Material</th>
                      <th className="p-6">Cliente</th>
                      <th className="p-6">Prazo Original</th>
                      <th className="p-6">Equipe Responsável</th>
                      <th className="p-6">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {materiais.filter(m => m.data_limite && new Date(m.data_limite) < new Date() && !['aprovado', 'post_aprovado', 'concluido'].includes(m.status)).map(m => (
                      <tr key={m.id} className="hover:bg-zinc-50/50 transition-colors group">
                        <td className="p-6">
                          <p className="font-black text-xs uppercase">{m.titulo}</p>
                        </td>
                        <td className="p-6">
                           <span className="text-[10px] font-bold text-zinc-500 uppercase">{m.cliente?.nome}</span>
                        </td>
                        <td className="p-6 text-red-500 font-black text-xs">
                          {new Date(m.data_limite!).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="p-6">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase">
                            {membros.find(mb => mb.id === m.editor_id)?.nome || membros.find(mb => mb.id === m.designer_id)?.nome || 'Não atribuído'}
                          </span>
                        </td>
                        <td className="p-6">
                           <span className="text-[8px] font-black uppercase px-2 py-1 bg-red-100 text-red-600 rounded-md">Em Atraso</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {materiais.filter(m => m.data_limite && new Date(m.data_limite) < new Date() && !['aprovado', 'post_aprovado', 'concluido'].includes(m.status)).length === 0 && (
                  <div className="py-20 text-center space-y-4">
                    <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto border border-green-100 shadow-sm">
                       <CheckCircle2 size={32} />
                    </div>
                    <p className="text-zinc-400 font-black text-[10px] uppercase tracking-[0.2em]">Sem atrasos. Tudo sob controle!</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </main>

      {/* MODAIS RESPONSIVOS */}

      {isDelegateModalOpen && selectedCicloDelegation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className={`${tc.bgCard} w-[95%] max-w-md max-h-[90vh] overflow-y-auto rounded-[32px] p-5 md:p-8 shadow-2xl space-y-5 md:space-y-6 text-left border ${theme === 'dark' ? 'border-zinc-800' : 'border-transparent'}`}>
            <div className="flex justify-between items-center"><h3 className="text-xl md:text-2xl font-black uppercase">Delegar</h3><button onClick={() => setIsDelegateModalOpen(false)} className={`p-2 ${tc.bgHover} rounded-full`}><X size={20} /></button></div>
            <div className={`${theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-50 border-zinc-100'} p-4 rounded-2xl border mb-2`}>
              <p className={`text-[10px] font-black uppercase ${tc.textMuted} mb-2`}>Selecione as subtarefas:</p>
              <div className="max-h-32 md:max-h-40 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {selectedCicloDelegation.itens.map((item: any) => (
                  <label key={item.id} className={`flex items-center gap-3 p-3 ${tc.bgCard} border ${tc.borderStrong} rounded-xl cursor-pointer`}>
                    <input type="checkbox" className="w-4 h-4 accent-[#A25431] shrink-0" checked={selectedItemsToDelegate.includes(item.id)} onChange={(e) => { if (e.target.checked) setSelectedItemsToDelegate([...selectedItemsToDelegate, item.id]); else setSelectedItemsToDelegate(selectedItemsToDelegate.filter(id => id !== item.id)); }} />
                    <span className="text-xs font-bold truncate">{item.titulo}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-4">

              {delegationType === 'planner' && (
                <div className="space-y-1">
                  <label className={`text-[10px] font-black uppercase tracking-widest ${tc.textMuted} ml-1`}>Link Bruto (Opcional)</label>
                  <input
                    type="text"
                    placeholder="https://drive.google.com/..."
                    className={`w-full py-3 px-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-2xl font-bold outline-none text-sm focus:border-[#A25431] transition-colors`}
                    value={newLinkBruto}
                    onChange={e => setNewLinkBruto(e.target.value)}
                  />
                </div>
              )}

              {delegationType === 'planner' ? (
                <div className="space-y-1">
                  <label className={`text-[10px] font-black uppercase tracking-widest ${tc.textMuted} ml-1`}>Selecionar Decupador</label>
                  <select className={`w-full py-3 px-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-2xl font-bold outline-none text-sm transition-colors`} value={selectedPlannerId} onChange={e => setSelectedPlannerId(e.target.value)}>
                    <option value="">Nenhum</option>
                    {planners.map(m => (
                      <option key={m.id} value={m.id}>{m.nome ? `${m.nome} (${m.role === 'admin' ? 'Gestor' : 'Decupador'})` : `${m.email} (${m.role === 'admin' ? 'Gestor' : 'Decupador'})`}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="space-y-1">
                    <label className={`text-[10px] font-black uppercase tracking-widest ${tc.textMuted} ml-1 flex items-center gap-1.5`}><PlayCircle size={12} /> Editor (Vídeos/Reels)</label>
                    <select className={`w-full py-3 px-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-2xl font-bold outline-none text-sm transition-colors`} value={selectedEditorId} onChange={e => setSelectedEditorId(e.target.value)}>
                      <option value="">Nenhum</option>
                      {editores.map(m => (
                        <option key={m.id} value={m.id}>{m.nome ? `${m.nome} (${m.role === 'admin' ? 'Gestor' : 'Editor'})` : `${m.email} (${m.role === 'admin' ? 'Gestor' : 'Editor'})`}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className={`text-[10px] font-black uppercase tracking-widest ${tc.textMuted} ml-1 flex items-center gap-1.5`}><PenTool size={12} /> Designer (Capas/Carrosséis)</label>
                    <select className={`w-full p-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-2xl font-bold outline-none text-sm transition-colors`} value={selectedDesignerId} onChange={e => setSelectedDesignerId(e.target.value)}>
                      <option value="">Nenhum</option>
                      {designers.map(m => (
                        <option key={m.id} value={m.id}>{m.nome ? `${m.nome} (${m.role === 'admin' ? 'Gestor' : 'Designer'})` : `${m.email} (${m.role === 'admin' ? 'Gestor' : 'Designer'})`}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className={`text-[10px] font-black uppercase tracking-widest ${tc.textMuted} ml-1`}>Data Limite de Entrega</label>
                <input
                  type="date"
                  className={`w-full py-3 px-3 md:px-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-2xl font-bold outline-none text-xs md:text-sm transition-colors [color-scheme:dark] min-w-0`}
                  value={delegationDeadline}
                  onChange={e => setDelegationDeadline(e.target.value)}
                />
              </div>

              <textarea className={`w-full py-3 px-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-2xl font-bold outline-none text-sm min-h-[80px] transition-colors resize-none`} placeholder="Instruções..." value={adminFeedback} onChange={e => setAdminFeedback(e.target.value)} />
            </div>
            <button onClick={handleDelegarItems} disabled={loading || selectedItemsToDelegate.length === 0} className="w-full py-4 bg-[#A25431] hover:bg-[#8a4729] text-white rounded-2xl font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 transition-colors">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Delegar Selecionados
            </button>
          </div>
        </div>
      )}

      {isLinkBrutoModalOpen && selectedMaterial && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className={`${tc.bgCard} border ${theme === 'dark' ? 'border-zinc-800' : 'border-transparent'} w-[95%] max-w-md rounded-[32px] p-5 md:p-8 shadow-2xl space-y-5 md:space-y-6 text-left`}>
            <div className="flex justify-between items-center"><h3 className="text-xl md:text-2xl font-black uppercase">Link Bruto</h3><button onClick={() => setIsLinkBrutoModalOpen(false)} className={`p-2 ${tc.bgHover} rounded-full`}><X size={20} /></button></div>
            <div className="space-y-4">
              <p className={`${tc.textMuted} text-sm font-medium`}>Insira o link da pasta com os materiais brutos gravados para esta tarefa.</p>
              <div className="flex flex-col gap-3">
                <input className={`w-full py-3 px-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-2xl font-bold outline-none focus:border-[#A25431] text-sm transition-colors`} placeholder="https://drive.google.com/..." value={newLinkBruto} onChange={e => setNewLinkBruto(e.target.value)} />
                <div className="flex justify-center">
                  <GoogleDrivePicker onSelect={(url) => setNewLinkBruto(url)} type="folder" label="Selecionar Pasta no Google Drive" />
                </div>
              </div>
            </div>
            <button onClick={handleUpdateLinkBruto} disabled={loading || !newLinkBruto} className="w-full py-4 bg-[#A25431] text-white rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-[#8a4729] flex items-center justify-center gap-2 disabled:opacity-50 transition-colors">
              {loading ? <Loader2 size={16} className="animate-spin" /> : null} Salvar Link
            </button>
          </div>
        </div>
      )}

      {isResolveIssueModalOpen && selectedMaterial && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className={`${tc.bgCard} border ${theme === 'dark' ? 'border-zinc-800' : 'border-transparent'} w-[95%] max-w-md max-h-[90vh] overflow-y-auto rounded-[32px] p-5 md:p-8 shadow-2xl space-y-5 md:space-y-6 text-left`}>
            <div className="flex justify-between items-center"><h3 className="text-xl md:text-2xl font-black uppercase text-red-500">Resolver Problema</h3><button onClick={() => setIsResolveIssueModalOpen(false)} className={`p-2 ${tc.bgHover} rounded-full`}><X size={20} /></button></div>
            <div className={`${theme === 'dark' ? 'bg-red-900/20 border-red-900/30' : 'bg-red-50 border-red-100'} p-4 rounded-2xl border mb-2`}>
              <div className="flex justify-between items-center mb-1">
                <p className="text-[10px] font-black uppercase text-red-500">Motivo do Problema:</p>
                {(() => {
                  const author = getAuthorInfo(selectedMaterial.feedback);
                  if (!author) return null;
                  return <span className="text-[9px] font-bold text-red-400 uppercase tracking-tighter">Reportado por: {author.nome}</span>;
                })()}
              </div>
              <p className={`font-bold ${theme === 'dark' ? 'text-red-400' : 'text-red-900'} text-sm whitespace-pre-wrap break-words`}>"{renderTextWithLinks(selectedMaterial.feedback || '')}"</p>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className={`text-[10px] font-black ${tc.textMuted} uppercase tracking-widest ml-2`}>Destino da Resolução</label>
                <div className="flex gap-2">
                  <button onClick={() => setResolveType('planner')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${resolveType === 'planner' ? 'bg-red-600 text-white border-red-600' : `${theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-200'} ${tc.textMuted}`}`}>Decupador</button>
                  <button onClick={() => setResolveType('editor')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${resolveType === 'editor' ? 'bg-blue-600 text-white border-blue-600' : `${theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-200'} ${tc.textMuted}`}`}>Produção (Edição/Design)</button>
                </div>
              </div>

              {resolveType === 'editor' && (
                <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className={`text-[10px] font-black ${tc.textMuted} uppercase tracking-widest ml-2`}>Quem Notificar?</label>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setNotifyTarget('both')} className={`flex-1 py-2 px-3 rounded-lg text-[9px] font-black uppercase border transition-all ${notifyTarget === 'both' ? 'bg-zinc-800 text-white border-zinc-800' : `${theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-200'} ${tc.textMuted}`}`}>Ambos</button>
                    <button onClick={() => setNotifyTarget('editor')} className={`flex-1 py-2 px-3 rounded-lg text-[9px] font-black uppercase border transition-all ${notifyTarget === 'editor' ? 'bg-blue-500 text-white border-blue-500' : `${theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-200'} ${tc.textMuted}`}`}>Apenas Editor</button>
                    <button onClick={() => setNotifyTarget('designer')} className={`flex-1 py-2 px-3 rounded-lg text-[9px] font-black uppercase border transition-all ${notifyTarget === 'designer' ? 'bg-pink-500 text-white border-pink-500' : `${theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-200'} ${tc.textMuted}`}`}>Apenas Designer</button>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className={`text-[10px] font-black ${tc.textMuted} uppercase tracking-widest ml-2`}>Link Bruto (Opcional)</label>
                <div className="flex flex-col gap-2">
                  <input className={`w-full py-3 px-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-2xl font-bold outline-none text-sm transition-colors`} placeholder="Link se tiver mudado..." value={resolveLinkBruto} onChange={e => setResolveLinkBruto(e.target.value)} />
                  <div className="flex justify-center">
                    <GoogleDrivePicker onSelect={(url) => setResolveLinkBruto(url)} type="folder" label="Selecionar no Drive" />
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <label className={`text-[10px] font-black ${tc.textMuted} uppercase tracking-widest ml-2`}>Instrução de Resolução</label>
                <textarea className={`w-full py-3 px-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-2xl font-medium outline-none focus:border-red-500 min-h-[100px] text-sm resize-none transition-colors`} placeholder="Explique o que foi feito ou o que fazer agora..." value={resolveText} onChange={e => setResolveText(e.target.value)} />
              </div>
            </div>
            <button onClick={handleResolveIssue} disabled={loading || !resolveText} className={`w-full py-4 ${resolveType === 'planner' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-2xl font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 transition-colors`}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : null} {resolveType === 'planner' ? 'Confirmar & Devolver' : 'Confirmar & Reenviar'}
            </button>
          </div>
        </div>
      )}

      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className={`${tc.bgCard} border ${theme === 'dark' ? 'border-zinc-800' : 'border-transparent'} w-[95%] max-w-md rounded-[32px] p-5 md:p-10 shadow-2xl space-y-5 md:space-y-6 text-left`}>
            <div className="flex justify-between items-center"><h3 className="text-xl md:text-2xl font-black uppercase">Importar</h3><button onClick={() => setIsImportModalOpen(false)} className={`p-2 ${tc.bgHover} rounded-full`}><X size={20} /></button></div>
            <div className="space-y-4">
              <input className={`w-full py-3 px-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-2xl font-bold outline-none text-sm focus:border-[#A25431] transition-colors`} placeholder="ID da Tarefa" value={plannerTaskId} onChange={e => setPlannerTaskId(e.target.value)} />
              <input type="number" min="1" className={`w-full p-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-2xl font-bold outline-none text-sm focus:border-[#A25431] transition-colors`} placeholder="Ciclo" value={importCiclo} onChange={e => setImportCiclo(e.target.value)} />
              <select className={`w-full p-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-2xl font-bold outline-none text-sm focus:border-[#A25431] transition-colors`} value={importClienteId} onChange={e => setImportClienteId(e.target.value)}><option value="">Selecionar Cliente...</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
            </div>
            <button onClick={handleImportPlanner} disabled={loading || !plannerTaskId} className="w-full py-4 bg-[#A25431] text-white rounded-2xl font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-[#8a4729] transition-colors">
              {loading ? <Loader2 size={16} className="animate-spin" /> : null} Sincronizar
            </button>
          </div>
        </div>
      )}

      {isEditRoteiroModalOpen && roteiroToEdit && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm md:p-4 animate-in fade-in duration-300">
          <div className={`${tc.bgCard} border ${theme === 'dark' ? 'border-zinc-800' : 'border-transparent'} w-full h-full md:w-[95%] md:max-w-5xl md:h-[90vh] rounded-none md:rounded-[32px] shadow-2xl flex flex-col overflow-hidden text-left`}>
            <div className={`p-5 md:p-6 border-b ${tc.borderStrong} flex justify-between items-center ${theme === 'dark' ? 'bg-zinc-900' : 'bg-white'} shrink-0 z-10 shadow-sm`}>
              <div className="truncate pr-4"><h3 className="text-lg md:text-xl font-black uppercase flex items-center gap-3"><FileText size={20} className="text-pink-500" /> Editar Roteiro</h3></div>
              <button onClick={() => setIsEditRoteiroModalOpen(false)} className={`p-2 ${tc.bgHover} ${tc.textMuted} rounded-full shrink-0 transition-colors`}><X size={20} /></button>
            </div>
            <div className={`p-0 md:p-8 overflow-y-auto ${theme === 'dark' ? 'bg-zinc-950' : 'bg-zinc-100'} flex-1 flex justify-center`}>
              <textarea className={`w-full h-full max-w-3xl p-6 md:p-12 ${theme === 'dark' ? 'bg-[#18181b] text-zinc-300 border-zinc-800' : 'bg-white text-zinc-800 border-zinc-200'} md:shadow-lg border-x-0 border-y-0 md:border md:rounded-lg text-[15px] md:text-base leading-relaxed font-medium outline-none focus:ring-0 resize-none transition-colors`} value={newRoteiroText} onChange={e => setNewRoteiroText(e.target.value)} placeholder="Escreva o roteiro aqui..." />
            </div>
            <div className={`p-4 md:p-6 border-t ${tc.borderStrong} ${theme === 'dark' ? 'bg-zinc-900' : 'bg-zinc-50'} flex justify-end gap-3`}>
              <button onClick={() => setIsEditRoteiroModalOpen(false)} className={`px-4 py-3 font-bold ${tc.textMuted} ${tc.bgHover} rounded-xl transition-colors`}>Cancelar</button>
              <button onClick={handleSaveRoteiro} disabled={loading} className="px-6 py-3 bg-pink-600 hover:bg-pink-700 text-white rounded-xl font-black uppercase text-xs flex items-center gap-2 disabled:opacity-50 transition-colors">
                {loading ? <Loader2 size={14} className="animate-spin" /> : null} Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {previewRoteiro && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm md:p-4 animate-in fade-in duration-300">
          <div className={`${tc.bgCard} border ${theme === 'dark' ? 'border-zinc-800' : 'border-transparent'} w-full h-full md:w-[95%] md:max-w-5xl md:h-[90vh] rounded-none md:rounded-[32px] shadow-2xl flex flex-col overflow-hidden text-left`}>
            <div className={`p-5 md:p-6 border-b ${tc.borderStrong} flex justify-between items-center ${theme === 'dark' ? 'bg-zinc-900' : 'bg-white'} shrink-0 z-10 shadow-sm`}>
              <div className="min-w-0 flex-1 pr-4"><h3 className="text-lg md:text-xl font-black uppercase truncate break-words break-all flex items-center gap-2" title={previewRoteiro.titulo}><FileText size={20} className="text-purple-500" /> {previewRoteiro.titulo}</h3></div>
              <button onClick={() => setPreviewRoteiro(null)} className={`p-2 ${tc.bgHover} ${tc.textMuted} rounded-full shrink-0 transition-colors`}><X size={20} /></button>
            </div>
            <div className={`p-0 md:p-8 overflow-y-auto ${theme === 'dark' ? 'bg-zinc-950' : 'bg-zinc-100'} flex-1 flex justify-center`}>
              <div className={`w-full h-full max-w-3xl p-6 md:p-12 ${theme === 'dark' ? 'bg-[#18181b] text-zinc-300 border-zinc-800' : 'bg-white text-zinc-800 border-zinc-200'} md:shadow-lg border-x-0 border-y-0 md:border md:rounded-lg overflow-y-auto`}>
                <div className="prose prose-sm md:prose-base max-w-none whitespace-pre-wrap font-medium break-words break-all leading-relaxed">{renderTextWithLinks(previewRoteiro.roteiro || "Vazio.")}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isVersionModalOpen && selectedMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className={`${tc.bgCard} border ${theme === 'dark' ? 'border-zinc-800' : 'border-transparent'} w-[95%] max-w-md rounded-[32px] p-5 md:p-10 shadow-2xl space-y-5 md:space-y-6`}>
            <div className="flex justify-between items-center"><h3 className="text-xl md:text-2xl font-black uppercase">Nova Versão</h3><button onClick={() => setIsVersionModalOpen(false)} className={`p-2 ${tc.bgHover} rounded-full`}><X size={20} /></button></div>
            <input className={`w-full py-3 px-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-2xl font-bold outline-none text-sm focus:border-blue-500 transition-colors`} placeholder="Novo link..." value={newDriveLink} onChange={e => setNewDriveLink(e.target.value)} />
            <button onClick={handleSendNewVersion} disabled={!newDriveLink || loading} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest flex justify-center items-center gap-2 disabled:opacity-50 transition-colors">
              {loading ? <Loader2 size={16} className="animate-spin" /> : null} Atualizar
            </button>
          </div>
        </div>
      )}

      {isDeleteClientModalOpen && clientToDelete && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className={`${tc.bgCard} border ${theme === 'dark' ? 'border-zinc-800' : 'border-transparent'} w-[95%] max-w-md rounded-[32px] md:rounded-[40px] p-5 md:p-10 shadow-2xl text-left space-y-5 md:space-y-6`}>
            <div className="flex justify-between items-center">
              <h3 className="text-xl md:text-2xl font-black uppercase text-red-500 flex items-center gap-2">
                <AlertCircle size={24} /> Excluir
              </h3>
              <button onClick={() => setIsDeleteClientModalOpen(false)} className={`p-2 ${tc.textMuted} ${tc.bgHover} rounded-full transition-all`}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <p className={`${tc.textMuted} text-sm md:text-base font-medium leading-relaxed`}>
                Tem a certeza que deseja excluir permanentemente o cliente <strong className={`${tc.textMain} uppercase`}>{clientToDelete.nome}</strong>?
              </p>

              <div className={`${theme === 'dark' ? 'bg-red-900/20 border-red-900/30' : 'bg-red-50 border-red-100'} border p-4 rounded-2xl`}>
                <p className={`text-red-500 text-[10px] md:text-xs font-bold flex gap-2`}>
                  <AlertCircle size={16} className="shrink-0" />
                  ATENÇÃO: Esta ação é irreversível. Todos os materiais, guias, links e históricos associados a este cliente serão apagados para sempre.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button onClick={() => setIsDeleteClientModalOpen(false)} disabled={loading} className={`w-full sm:flex-1 py-3.5 ${theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'} ${tc.textMuted} hover:${tc.textMain} rounded-xl md:rounded-2xl font-black uppercase text-[11px] tracking-widest transition-colors`}>Cancelar</button>
              <button onClick={async () => { setLoading(true); const { error } = await supabase.from('clientes').delete().eq('id', clientToDelete.id); if (error) { toast.error("Erro ao excluir: " + error.message); } else { toast.success("Cliente excluído com sucesso!"); loadData(); } setLoading(false); setIsDeleteClientModalOpen(false); setClientToDelete(null); }} disabled={loading} className="w-full sm:flex-1 py-3.5 bg-red-600 text-white rounded-xl md:rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-red-700 shadow-lg shadow-red-500/20 transition-all flex justify-center items-center gap-2">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <><Trash2 size={16} /> Sim, Excluir</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {isArchiveCycleModalOpen && cycleToArchive && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className={`${tc.bgCard} border ${theme === 'dark' ? 'border-zinc-800' : 'border-transparent'} w-[95%] max-w-md rounded-[32px] md:rounded-[40px] p-5 md:p-10 shadow-2xl text-left space-y-5 md:space-y-6`}>
            <div className="flex justify-between items-center">
              <h3 className={`text-xl md:text-2xl font-black uppercase ${tc.textMain} flex items-center gap-2`}>
                <Archive size={24} className={tc.textMuted} /> Arquivar Ciclo
              </h3>
              <button onClick={() => setIsArchiveCycleModalOpen(false)} className={`p-2 ${tc.textMuted} ${tc.bgHover} rounded-full transition-all`}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <p className={`${tc.textMuted} text-sm md:text-base font-medium leading-relaxed`}>
                Tem a certeza que deseja arquivar todas as <strong className={tc.textMain}>{cycleToArchive.itens.length} tarefas</strong> do <strong className={`${tc.textMain} uppercase`}>{cycleToArchive.cicloLabel}</strong>?
              </p>

              <div className={`${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border p-4 rounded-2xl`}>
                <p className={`${tc.textMuted} text-[10px] md:text-xs font-bold flex gap-2`}>
                  <CheckCircle2 size={16} className="shrink-0 opacity-50" />
                  As tarefas serão marcadas como "Concluídas" e desaparecerão das listas de pendências de toda a equipe e do portal do cliente.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button onClick={() => setIsArchiveCycleModalOpen(false)} disabled={loading} className={`w-full sm:flex-1 py-3.5 ${theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'} ${tc.textMuted} hover:${tc.textMain} rounded-xl md:rounded-2xl font-black uppercase text-[11px] tracking-widest transition-colors disabled:opacity-50`}>Cancelar</button>
              <button onClick={async () => { setLoading(true); const ids = cycleToArchive.itens.map(i => i.id); const { error } = await supabase.from('materiais').update({ status: 'concluido' }).in('id', ids); if (error) { toast.error("Erro ao arquivar: " + error.message); } else { toast.success(`${cycleToArchive.cicloLabel} arquivado com sucesso!`); loadData(); } setLoading(false); setIsArchiveCycleModalOpen(false); setCycleToArchive(null); }} disabled={loading} className={`w-full sm:flex-1 py-3.5 ${theme === 'dark' ? 'bg-white text-black hover:bg-zinc-200' : 'bg-[#1A1A1A] hover:bg-black text-white'} rounded-xl md:rounded-2xl font-black uppercase text-[11px] tracking-widest transition-colors flex justify-center items-center gap-2 disabled:opacity-50`}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : <><Archive size={16} /> Sim, Arquivar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {incompleteApprovalData && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className={`${tc.bgCard} border ${theme === 'dark' ? 'border-zinc-800' : 'border-transparent'} w-[95%] max-w-md rounded-[32px] md:rounded-[40px] p-5 md:p-10 shadow-2xl text-left space-y-5 md:space-y-6`}>
            <div className="flex justify-between items-center">
              <h3 className="text-xl md:text-2xl font-black uppercase text-orange-500 flex items-center gap-2">
                <AlertCircle size={24} /> Entrega Parcial
              </h3>
              <button onClick={() => setIncompleteApprovalData(null)} className={`p-2 ${tc.textMuted} ${tc.bgHover} rounded-full transition-all`}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <p className={`${tc.textMuted} text-sm md:text-base font-medium leading-relaxed`}>
                O material <strong className={`${tc.textMain} uppercase`}>{incompleteApprovalData.material.titulo}</strong> ainda não está completo.
              </p>

              <div className={`${theme === 'dark' ? 'bg-orange-900/20 border-orange-900/30' : 'bg-orange-50 border-orange-100'} border p-4 rounded-2xl`}>
                <p className={`text-orange-500 text-[10px] md:text-xs font-bold flex flex-col gap-2`}>
                  <span className="flex items-center gap-2"><AlertCircle size={16} className="shrink-0" /> Faltam entregar:</span>
                  {incompleteApprovalData.missingVideo && <span className="ml-6">- Link do Vídeo / Post</span>}
                  {incompleteApprovalData.missingDesign && <span className="ml-6">- Link da Capa / Design</span>}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button onClick={() => setIncompleteApprovalData(null)} disabled={actionLoading === incompleteApprovalData.material.id} className={`w-full sm:flex-1 py-3.5 ${theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'} ${tc.textMuted} hover:${tc.textMain} rounded-xl md:rounded-2xl font-black uppercase text-[11px] tracking-widest transition-colors`}>Aguardar Equipe</button>
              <button onClick={() => { handleAprovarParaCliente(incompleteApprovalData.material.id); setIncompleteApprovalData(null); }} disabled={actionLoading === incompleteApprovalData.material.id} className="w-full sm:flex-1 py-3.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl md:rounded-2xl font-black uppercase text-[11px] tracking-widest transition-colors flex justify-center items-center gap-2">
                {actionLoading === incompleteApprovalData.material.id ? <Loader2 size={16} className="animate-spin" /> : <><Send size={16} /> Enviar Mesmo Assim</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {logsModalAberto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className={`${tc.bgCard} border ${theme === 'dark' ? 'border-zinc-800' : 'border-transparent'} rounded-[24px] p-6 w-full max-w-md shadow-2xl text-left`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className={`font-bold text-lg uppercase ${tc.textMain}`}>Histórico de Visualizações</h3>
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
                      <span className={`text-[10px] font-black tracking-widest uppercase ${tc.textMuted} mt-1`}>{dataFormatada}</span>
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
            <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-6 py-3 bg-white/20 backdrop-blur-md text-white rounded-2xl hover:bg-white/30 transition-all border border-white/10 shadow-xl font-black uppercase text-[10px] tracking-widest">
              <ExternalLink size={18} /> Abrir Original
            </a>
            <button onClick={() => setPreviewUrl(null)} className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-2xl hover:bg-red-600 transition-all shadow-xl font-black uppercase text-[10px] tracking-widest">
              <X size={20} /> Fechar
            </button>
          </div>
          <div className="w-full h-[80vh] md:h-full max-w-5xl mx-auto flex items-center justify-center overflow-hidden p-2 md:p-10 mb-20 md:mb-0">
            {renderPreviewContent(previewUrl)}
          </div>
        </div>
      )}

      {isScheduleModalOpen && materialToSchedule && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 animate-in fade-in duration-300">
          <div className={`${tc.bgCard} border ${tc.borderStrong} w-full max-w-md rounded-[32px] md:rounded-[40px] p-6 md:p-10 shadow-2xl space-y-5 md:space-y-6 overflow-hidden flex flex-col max-h-[90vh]`}>
            <div className="flex justify-between items-center shrink-0">
              <h3 className={`text-xl md:text-2xl font-black uppercase ${tc.textMain} flex items-center gap-2`}>
                <Clock size={24} className="text-blue-500" /> Agendar Envio
              </h3>
              <button onClick={() => setIsScheduleModalOpen(false)} className={`p-2 ${tc.textMuted} ${tc.bgHover} rounded-full transition-all`}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 w-full overflow-hidden">
              <p className={`${tc.textMuted} text-sm font-medium leading-relaxed break-words px-1`}>
                Escolha quando o cliente deve receber a notificação de <strong className={`${tc.textMain} break-words`}>{materialToSchedule.titulo}</strong>:
              </p>
              
              <div className="relative group w-full" onClick={(e) => {
                const input = e.currentTarget.querySelector('input');
                if (input && 'showPicker' in input) {
                  try { (input as any).showPicker(); } catch (e) {}
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

              <p className="text-[10px] text-zinc-500 font-medium italic">
                💡 Clique no ícone de calendário para abrir o seletor visual ou digite manualmente.
              </p>
              
              <div className={`${theme === 'dark' ? 'bg-blue-900/10 border-blue-900/20' : 'bg-blue-50 border-blue-100'} border p-4 rounded-2xl`}>
                <p className="text-blue-600 text-[10px] md:text-xs font-bold flex gap-2 leading-relaxed">
                  <Activity size={16} className="shrink-0" />
                  O material continuará visível para você na lista de aprovação até o envio ser concluído.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2 md:pt-4">
              <button onClick={() => setIsScheduleModalOpen(false)} className={`w-full sm:flex-1 py-3.5 ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-100'} ${tc.textMuted} rounded-xl md:rounded-2xl font-black uppercase text-[11px] tracking-widest transition-colors`}>Voltar</button>
              <button 
                onClick={handleAgendarParaCliente} 
                disabled={!scheduledDate || actionLoading === materialToSchedule.id} 
                className="w-full sm:flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl md:rounded-2xl font-black uppercase text-[11px] tracking-widest transition-colors flex justify-center items-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-50"
              >
                {actionLoading === materialToSchedule.id ? <Loader2 size={16} className="animate-spin" /> : <><CheckCircle2 size={16} /> Confirmar</>}
              </button>
            </div>
          </div>
        </div>
      )}
      {isApproveConfirmModalOpen && materialToApproveFinal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className={`${tc.bgCard} border ${theme === 'dark' ? 'border-zinc-800' : 'border-transparent'} w-[95%] max-w-md rounded-[32px] md:rounded-[40px] p-5 md:p-10 shadow-2xl text-left space-y-5 md:space-y-6`}>
            <div className="flex justify-between items-center">
              <h3 className="text-xl md:text-2xl font-black uppercase text-green-500 flex items-center gap-2">
                <CheckCircle2 size={24} /> Aprovar p/ Cliente
              </h3>
              <button onClick={() => setIsApproveConfirmModalOpen(false)} className={`p-2 ${tc.textMuted} ${tc.bgHover} rounded-full transition-all`}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <p className={`${tc.textMuted} text-sm md:text-base font-medium leading-relaxed`}>
                Tem certeza que deseja enviar o material <strong className={`${tc.textMain} uppercase`}>{materialToApproveFinal.titulo}</strong> para o portal do cliente?
              </p>

              <div className={`${theme === 'dark' ? 'bg-green-900/20 border-green-900/30' : 'bg-green-50 border-green-100'} border p-4 rounded-2xl`}>
                <p className={`text-green-600 text-[10px] md:text-xs font-bold flex gap-2`}>
                  <Send size={16} className="shrink-0" />
                  Isso irá notificar o cliente via WhatsApp e disponibilizar o material para aprovação final.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2 md:pt-4">
              <button onClick={() => { setMaterialToSchedule(materialToApproveFinal); setIsScheduleModalOpen(true); setIsApproveConfirmModalOpen(false); }} className={`w-full sm:flex-1 py-3.5 ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-100'} ${tc.textMuted} rounded-xl md:rounded-2xl font-black uppercase text-[11px] tracking-widest transition-colors flex items-center justify-center gap-2 border border-transparent hover:border-zinc-500`}>
                <Clock size={16} /> Agendar
              </button>
              <button onClick={() => { handleAprovarParaCliente(materialToApproveFinal.id); setIsApproveConfirmModalOpen(false); }} disabled={actionLoading === materialToApproveFinal.id} className="w-full sm:flex-2 py-3.5 bg-green-600 hover:bg-green-700 text-white rounded-xl md:rounded-2xl font-black uppercase text-[11px] tracking-widest transition-colors flex justify-center items-center gap-2 shadow-lg shadow-green-500/20">
                {actionLoading === materialToApproveFinal.id ? <Loader2 size={16} className="animate-spin" /> : <><Send size={16} /> Enviar Agora</>}
              </button>
            </div>
            <button onClick={() => setIsApproveConfirmModalOpen(false)} className={`w-full py-2 text-[10px] font-bold uppercase ${tc.textMuted} hover:text-zinc-500 transition-colors`}>Cancelar</button>
          </div>
        </div>
      )}
      {isGruposModalOpen && (
        <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className={`${tc.bgCard} border ${tc.borderStrong} w-full max-w-lg rounded-[32px] md:rounded-[40px] p-5 md:p-8 shadow-2xl space-y-5 md:space-y-6 animate-in zoom-in-95`}>
            <div className="flex justify-between items-center">
               <div>
                 <h3 className={`text-xl font-black uppercase ${tc.textMain}`}>Grupos do WhatsApp</h3>
                 <p className={`text-xs ${tc.textMuted} font-medium mt-1`}>Pesquise e selecione o grupo para vincular ao cliente.</p>
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
                const filtrados = listagemGrupos.filter(g => 
                  g.name?.toLowerCase().includes(buscaGrupo.toLowerCase()) || 
                  g.id.toLowerCase().includes(buscaGrupo.toLowerCase())
                );
                
                if (filtrados.length === 0) {
                  return <div className="py-10 text-center opacity-30 font-bold">Nenhum grupo encontrado.</div>;
                }

                return filtrados.map((g, i) => (
                  <button 
                    key={i} 
                    type="button"
                    onClick={() => { 
                      setWppGroupId(g.id); 
                      setIsGruposModalOpen(false);
                      setBuscaGrupo('');
                      toast.success(`Grupo selecionado: ${g.name}`);
                    }}
                    className={`w-full flex items-center justify-between p-4 ${tc.bgHover} border ${tc.borderStrong} rounded-2xl transition-all group`}
                  >
                    <div className="text-left">
                      <p className="font-bold text-sm uppercase group-hover:text-green-500 transition-colors truncate max-w-[200px] md:max-w-none">{g.name || 'Grupo sem nome'}</p>
                      <p className={`text-[10px] font-mono ${tc.textMuted} truncate max-w-[200px] md:max-w-none`}>{g.id}</p>
                    </div>
                    <div className={`p-2 ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-100'} rounded-lg group-hover:bg-green-500 group-hover:text-white transition-colors`}>
                      <CheckCircle2 size={14} />
                    </div>
                  </button>
                ));
              })()}
            </div>

            <button onClick={() => setIsGruposModalOpen(false)} className="w-full py-4 font-black uppercase text-[10px] tracking-widest bg-zinc-100 dark:bg-zinc-800 rounded-2xl">Fechar</button>
          </div>
        </div>
      )}
      {/* MODAL DE CONFIRMAÇÃO PERSONALIZADO */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className={`${tc.bgCard} w-full max-w-sm rounded-[32px] p-8 shadow-2xl border ${theme === 'dark' ? 'border-zinc-800' : 'border-transparent'} text-center space-y-6`}>
            <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${confirmConfig.type === 'danger' ? 'bg-red-500/20 text-red-500' : 'bg-amber-500/20 text-amber-500'}`}>
              {confirmConfig.type === 'danger' ? <Trash2 size={32} /> : <AlertTriangle size={32} />}
            </div>
            <div>
              <h3 className="text-xl font-black uppercase">{confirmConfig.title}</h3>
              <p className={`mt-2 text-sm ${tc.textMuted} font-medium`}>{confirmConfig.text}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setIsConfirmModalOpen(false)} className={`py-4 rounded-2xl font-black uppercase text-[10px] ${theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'}`}>Cancelar</button>
              <button 
                onClick={() => { confirmConfig.onConfirm(); setIsConfirmModalOpen(false); }} 
                className={`py-4 rounded-2xl font-black uppercase text-[10px] text-white ${confirmConfig.type === 'danger' ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20' : 'bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-600/20'}`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
