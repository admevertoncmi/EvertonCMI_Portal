"use client"

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { Toaster, toast } from 'sonner'
import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { notificarClickUpChat } from '@/actions/clickup'
import { getDriveFolderFiles } from '@/actions/google'
import useEmblaCarousel from 'embla-carousel-react'
import {
  FolderDown, CheckSquare, LogOut, Users, FileText, X,
  ChevronDown, ChevronRight, AlertCircle, Clock, CheckCircle2, Eye, ExternalLink, Menu, Calendar,
  Sun, Moon, Loader2
} from 'lucide-react'
import GoogleDrivePicker from './GoogleDrivePicker'

interface Cliente { id: string; nome: string; }
interface Material {
  id: string; cliente_id: string; titulo: string;
  link_drive?: string; link_bruto?: string; link_organizado?: string;
  data_limite?: string;
  status: any;
  created_at: string; roteiro?: string | null; planner_id?: string | null;
  feedback?: string | null; feedback_admin?: string | null; ciclo?: number;
  cliente?: { nome: string; };
}

const getEmbedUrl = (url: string) => {
  if (url.includes('drive.google.com')) {
    const folderMatch = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (folderMatch) return `https://drive.google.com/embeddedfolderview?id=${folderMatch[1]}#grid`;
    return url.replace('/view', '/preview').replace('open?id=', 'file/d/').replace(/(\/view|\/viewusp=sharing)/, '/preview');
  }
  return url;
};

const getCleanText = (text: string | null | undefined) => {
  if (!text) return "";
  return text.replace(/\[ID:[^\]]+\]\s*/g, '');
};

const renderTextWithLinks = (text: string | null | undefined) => {
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

export default function DecupadorDashboard() {
  const router = useRouter()
  const supabase = createClient()

  const [theme, setTheme] = useState<'dark' | 'light'>('light')

  useEffect(() => {
    const storedTheme = localStorage.getItem('plannerTheme') as 'dark' | 'light' | null;
    if (storedTheme) {
      setTheme(storedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('plannerTheme', newTheme);
  };

  const tc = {
    bgApp: theme === 'dark' ? 'bg-zinc-950' : 'bg-zinc-50',
    bgCard: theme === 'dark' ? 'bg-zinc-900' : 'bg-white',
    borderStrong: theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200',
    textMain: theme === 'dark' ? 'text-zinc-100' : 'text-zinc-900',
    textMuted: theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500',
    bgInput: theme === 'dark' ? 'bg-zinc-950' : 'bg-zinc-50',
    bgHover: theme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100',
  };

  const bgPrincipal = tc.bgApp;
  const bgSecundario = tc.bgCard;
  const borderSecundario = tc.borderStrong;
  const textPrincipal = tc.textMain;
  const textSecundario = tc.textMuted;
  const hoverSecundario = tc.bgHover;

  const [activeTab, setActiveTab] = useState<'pendentes' | 'entregues'>('pendentes')
  const [materiais, setMateriais] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [userProfile, setUserProfile] = useState<{ nome: string, role: string } | null>(null)

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [expandedTasks, setExpandedTasks] = useState<string[]>([])
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null)
  const [newDriveLink, setNewDriveLink] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Carousel e Expandir Pasta
  const [currentSlide, setCurrentSlide] = useState(0);
  const [expandedCapaLinks, setExpandedCapaLinks] = useState<string[]>([]);
  const [isExpandingFolder, setIsExpandingFolder] = useState(false);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, skipSnaps: false });

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setCurrentSlide(emblaApi.selectedScrollSnap());
    emblaApi.on('select', onSelect);
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi]);

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
          if (files && files.length > 0) setExpandedCapaLinks(files);
          else setExpandedCapaLinks([previewUrl]);
        } catch (error) { setExpandedCapaLinks([previewUrl]); }
        finally { setIsExpandingFolder(false); }
      } else {
        const links = previewUrl.split(/[\n,;]+/).map((l: string) => l.trim()).filter(Boolean);
        setExpandedCapaLinks(links);
      }
      setCurrentSlide(0);
    };
    expandFolder();
  }, [previewUrl]);

  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [issueType, setIssueType] = useState<'faltando_material' | 'verificar_material'>('faltando_material');
  const [issueText, setIssueText] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return; }
    setUserId(user.id)
    const { data: profile } = await supabase.from('perfis_equipe').select('*').eq('id', user.id).single();
    if (profile) setUserProfile(profile as any);

    const { data: m } = await supabase
      .from('materiais')
      .select(`*, cliente:clientes(nome)`)
      .eq('planner_id', user.id)
      .order('created_at', { ascending: false })

    if (m) setMateriais(m as Material[])
    setLoading(false)
  }, [supabase, router])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel('decupador-realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'materiais', filter: `planner_id=eq.${userId}` }, () => {
        loadData();
        toast.info("A sua fila de decupagem foi atualizada.");
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, loadData, userId])

  const filaPendentes = useMemo(() => materiais.filter(m => ['planejamento', 'em_organizacao', 'faltando_material', 'verificar_material'].includes(m.status)), [materiais])
  const filaEntregues = useMemo(() => materiais.filter(m => m.status === 'organizado'), [materiais])

  const tarefasAgrupadasPorCliente = useMemo(() => {
    const grupos: Record<string, { clienteNome: string, ciclos: Record<string, { itens: Material[], linkBrutoGlobal: string }> }> = {};
    filaPendentes.forEach(m => {
      const cid = m.cliente_id;
      const cicloLabel = `CICLO ${m.ciclo || 1}`;
      const linkBruto = m.link_bruto || m.link_drive || '';

      if (!grupos[cid]) grupos[cid] = { clienteNome: m.cliente?.nome || 'S/N', ciclos: {} };
      if (!grupos[cid].ciclos[cicloLabel]) grupos[cid].ciclos[cicloLabel] = { itens: [], linkBrutoGlobal: linkBruto };
      if (!grupos[cid].ciclos[cicloLabel].linkBrutoGlobal && linkBruto) grupos[cid].ciclos[cicloLabel].linkBrutoGlobal = linkBruto;

      grupos[cid].ciclos[cicloLabel].itens.push(m);
    });
    return grupos;
  }, [filaPendentes]);

  const toggleTask = (id: string) => {
    setExpandedTasks(prev => prev.includes(id) ? prev.filter(taskId => taskId !== id) : [...prev, id])
  }

  const handleStatusSelect = async (m: Material, newStatus: string) => {
    if (newStatus === 'faltando_material' || newStatus === 'verificar_material') {
      setSelectedMaterial(m); setIssueType(newStatus as any); setIssueText(''); setIsIssueModalOpen(true);
    } else {
      setMateriais(prev => prev.map(item => item.id === m.id ? { ...item, status: newStatus as any } : item));
      const { error } = await supabase.from('materiais').update({ status: newStatus }).eq('id', m.id);
      if (error) { toast.error("Erro ao atualizar."); loadData(); } else { toast.success("Status atualizado!"); }
    }
  }

  const handleReportIssue = async () => {
    if (!selectedMaterial || !issueText) return toast.error("Por favor, descreva o problema!");
    setIsSubmitting(true);
    const feedbackComAutor = `[ID:${userId}] ${issueText}`;
    const { error } = await supabase.from('materiais').update({ status: issueType, feedback: feedbackComAutor }).eq('id', selectedMaterial.id);

    if (error) { toast.error("Erro: " + error.message); }
    else {
      toast.success("Problema reportado ao Admin!");
      const msgErro = `🔔 PROBLEMA NA DECUPAGEM\n\n👤: DECUPADOR\n${userProfile?.nome || 'Equipe'}\n\n📍 ${selectedMaterial.cliente?.nome}\n🎬 ${selectedMaterial.titulo.toUpperCase()}\n\n🔔 MOTIVO: ${issueText.toUpperCase()}`;
      await notificarClickUpChat(msgErro);
      setIsIssueModalOpen(false);
      loadData();
    }
    setIsSubmitting(false);
  }

  const handleDeliverOrganization = async () => {
    if (!selectedMaterial || !newDriveLink) return toast.error("Insira o link da pasta!");
    setIsSubmitting(true)
    const { error } = await supabase.from('materiais').update({ link_organizado: newDriveLink, status: 'organizado' }).eq('id', selectedMaterial.id)
    if (error) { toast.error("Erro: " + error.message) }
    else {
      toast.success("Pasta entregue!");
      const msgSucesso = `📁 PASTA PRONTA (DECUPAGEM)\n\n👤: DECUPADOR\n${userProfile?.nome || 'Equipe'}\n\n📍 ${selectedMaterial.cliente?.nome}\n🎬 ${selectedMaterial.titulo.toUpperCase()}`;
      await notificarClickUpChat(msgSucesso);
      setIsSubmitModalOpen(false);
      setNewDriveLink('');
      loadData();
    }
    setIsSubmitting(false)
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

  return (
    <div className={`flex h-screen h-[100dvh] ${bgPrincipal} font-sans ${textPrincipal} overflow-hidden ${theme}`}>
      <Toaster position="top-right" richColors theme={theme} />

      {/* HEADER MOBILE CLÁSSICO MARROM COM DARK MODE */}
      <div className={`md:hidden flex items-center justify-between p-5 pt-8 ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-[#212013] border-[#A25431]'} text-white rounded-b-[24px] fixed top-0 w-full z-40 shadow-lg border-b`}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center font-black text-xl border border-white/20 shadow-inner">PL</div>
          <div>
            <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Mão na massa!</p>
            <h1 className="text-sm font-black uppercase tracking-wide">PAINEL DECUPADOR</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="p-2.5 bg-white/10 rounded-full border border-white/20 active:scale-95 transition-transform">
            {theme === 'dark' ? <Sun size={20} className="text-yellow-500" /> : <Moon size={20} className="text-white" />}
          </button>
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2.5 bg-white/10 rounded-full border border-white/20 active:scale-95 transition-transform">
            <Menu size={22} />
          </button>
        </div>
      </div>
      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />}

      {/* SIDEBAR COM LOGO MAIOR */}
      <aside className={`fixed inset-y-0 left-0 w-72 md:w-64 ${bgSecundario} border-r ${borderSecundario} flex flex-col z-50 transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`}>
        <div className="p-6 md:p-8 flex justify-between items-center">
          <div>
            <p className={`${textSecundario} font-black text-[10px] uppercase tracking-widest mb-2`}>Painel de Produção</p>
            <img src={theme === 'dark' ? "/logo-light.png" : "/logo-dark.png"} alt="Logo" className="h-20 md:h-24 object-contain" />
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className={`md:hidden p-2 rounded-full ${hoverSecundario} ${textSecundario}`}><X size={18} /></button>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <button onClick={() => { setActiveTab('pendentes'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 p-3 rounded-xl font-bold transition-all ${activeTab === 'pendentes' ? 'bg-[#A25431] text-white shadow-md' : `${textSecundario} ${hoverSecundario}`}`}>
            <FolderDown size={20} /> Fila de Decupagem
            {filaPendentes.length > 0 && <span className={`ml-auto px-2 py-0.5 rounded-md text-[10px] font-black ${activeTab === 'pendentes' ? 'bg-white text-[#A25431]' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'}`}>{filaPendentes.length}</span>}
          </button>
          <button onClick={() => { setActiveTab('entregues'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 p-3 rounded-xl font-bold transition-all ${activeTab === 'entregues' ? 'bg-[#A25431] text-white shadow-md' : `${textSecundario} ${hoverSecundario}`}`}>
            <CheckSquare size={20} /> Pastas Prontas
          </button>
        </nav>
        <div className={`p-4 border-t ${borderSecundario} flex flex-col gap-2`}>
          <button onClick={toggleTheme} className={`w-full flex items-center gap-3 p-3 text-yellow-500 font-bold ${hoverSecundario} rounded-xl transition-all`}>
            {theme === 'dark' ? <><Sun size={20} /> Modo Claro</> : <><Moon size={20} /> Modo Escuro</>}
          </button>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} className={`w-full flex items-center gap-3 p-3 text-red-500 font-bold ${hoverSecundario} rounded-xl transition-all`}><LogOut size={20} /> Sair</button>
        </div>
      </aside>

      <main className={`flex-1 pt-28 md:pt-10 pb-10 px-4 md:p-10 overflow-y-auto ${bgPrincipal}`}>

        {activeTab === 'pendentes' && (
          <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 text-left">
            <header>
              <h2 className={`text-2xl md:text-3xl font-black tracking-tighter uppercase ${textPrincipal}`}>Fila de Trabalho</h2>
              <p className={`${textSecundario} font-medium text-sm md:text-base mt-1`}>Acesse os brutos, decupe o material e devolva a pasta pronta.</p>
            </header>

            {loading ? (
              <div className={`${textSecundario} animate-pulse font-bold`}>A buscar tarefas...</div>
            ) : filaPendentes.length === 0 ? (
              <div className={`p-10 md:p-20 text-center border border-dashed ${borderSecundario} rounded-[32px] ${bgSecundario}`}>
                <CheckSquare size={48} className={`mx-auto ${textSecundario} opacity-50 mb-4`} />
                <h3 className={`text-xl font-black uppercase tracking-tight ${textSecundario}`}>Mesa Limpa!</h3>
              </div>
            ) : (
              <div className="space-y-8">
                {Object.entries(tarefasAgrupadasPorCliente).map(([clienteId, grupo]) => (
                  <div key={clienteId} className={`${bgSecundario} border ${borderSecundario} rounded-[24px] md:rounded-[32px] overflow-hidden shadow-sm`}>

                    <div className={`p-5 md:p-6 ${theme === 'dark' ? 'bg-zinc-900/50' : 'bg-zinc-50/50'} border-b ${borderSecundario} flex items-center gap-4`}>
                      <div className={`p-3 ${theme === 'dark' ? 'bg-zinc-800 text-zinc-300' : 'bg-white text-zinc-600'} rounded-xl border ${borderSecundario} shrink-0`}><Users size={24} /></div>
                      <h3 className={`text-xl md:text-2xl font-black tracking-tight ${textPrincipal} uppercase truncate`}>{grupo.clienteNome}</h3>
                    </div>

                    <div className="p-4 md:p-6 space-y-6 md:space-y-8">
                      {Object.entries(grupo.ciclos).map(([cicloLabel, cicloData]) => (
                        <div key={cicloLabel} className="space-y-4">
                          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b ${borderSecundario} pb-2`}>
                            <div className={`flex items-center gap-2 ${textSecundario}`}>
                              <Calendar size={14} />
                              <h4 className="font-black text-xs uppercase tracking-widest">{cicloLabel}</h4>
                            </div>
                            {cicloData.linkBrutoGlobal && (
                              <a href={cicloData.linkBrutoGlobal} target="_blank" rel="noopener noreferrer" className={`w-full sm:w-auto px-4 py-3 sm:py-2 ${theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'} rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border ${borderSecundario}`}>
                                <FolderDown size={14} /> Pasta Bruta Geral
                              </a>
                            )}
                          </div>

                          <div className="grid gap-3 min-w-0">
                            {cicloData.itens.map(m => {
                              const isExpanded = expandedTasks.includes(m.id);
                              const linkBrutoAtual = m.link_bruto || m.link_drive || cicloData.linkBrutoGlobal;

                              return (
                                <div key={m.id} className={`${theme === 'dark' ? 'bg-zinc-950 border-zinc-800/80' : 'bg-zinc-50 border-zinc-200'} border ${isExpanded ? (theme === 'dark' ? '!border-zinc-600' : '!border-zinc-400') : ''} rounded-[20px] transition-all min-w-0`}>

                                  {/* 🔥 CORREÇÃO: items-start md:items-center para os botões não esticarem */}
                                  <div className="flex flex-col p-4 md:p-5 cursor-pointer group gap-4" onClick={() => toggleTask(m.id)}>

                                    <div className="flex items-start gap-3 flex-1 min-w-0 w-full">
                                      <div className="pt-0.5">
                                        {isExpanded ? <ChevronDown size={20} className={`${textSecundario} shrink-0`} /> : <ChevronRight size={20} className={`${textSecundario} transition-colors shrink-0`} />}
                                      </div>

                                      {/* TAG DE PRAZO SE HOUVER */}
                                      {m.data_limite && (
                                        <span className="text-red-500 font-black text-[8px] uppercase tracking-widest bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded border border-red-200 dark:border-red-900/50 flex items-center gap-1 shrink-0">
                                          <Calendar size={10} /> {new Date(m.data_limite + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                        </span>
                                      )}

                                      <span className={`font-bold ${textPrincipal} uppercase text-xs sm:text-sm break-words block`}>{m.titulo}</span>
                                    </div>

                                    {/* SELECT BLINDADO */}
                                    <select
                                      value={m.status}
                                      onChange={(e) => { e.stopPropagation(); handleStatusSelect(m, e.target.value); }}
                                      onClick={e => e.stopPropagation()}
                                      className={`w-full sm:w-auto px-3 py-2 sm:py-1.5 rounded-lg text-[9px] font-black uppercase outline-none border cursor-pointer transition-colors shrink-0
                                          ${m.status === 'planejamento' ? (theme === 'dark' ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-zinc-200 text-zinc-700 border-zinc-300') : ''}
                                          ${m.status === 'em_organizacao' ? (theme === 'dark' ? 'bg-blue-900/30 text-blue-400 border-blue-700/50' : 'bg-blue-100 text-blue-700 border-blue-200') : ''}
                                          ${m.status === 'verificar_material' ? (theme === 'dark' ? 'bg-yellow-900/30 text-yellow-400 border-yellow-700/50' : 'bg-yellow-100 text-yellow-700 border-yellow-200') : ''}
                                          ${m.status === 'faltando_material' ? (theme === 'dark' ? 'bg-red-900/30 text-red-400 border-red-700/50' : 'bg-red-100 text-red-700 border-red-200') : ''}
                                        `}
                                    >
                                      <option value="planejamento">Aguardando Decupagem</option>
                                      <option value="em_organizacao">Decupagem em Andamento</option>
                                      <option value="verificar_material">Verificar Material</option>
                                      <option value="faltando_material">Falta Material Bruto</option>
                                    </select>
                                  </div>

                                  {isExpanded && (
                                    <div className={`p-4 md:p-6 border-t ${borderSecundario} ${theme === 'dark' ? 'bg-zinc-900/40' : 'bg-white'} rounded-b-[20px] animate-in slide-in-from-top-2 duration-200 min-w-0`}>
                                      <div className="flex flex-col sm:flex-row gap-3 mb-6">
                                        {linkBrutoAtual && (
                                          <>
                                            <button onClick={() => setPreviewUrl(linkBrutoAtual)} className={`w-full sm:w-auto px-6 py-3 md:py-3 ${theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800'} rounded-xl text-[10px] font-black uppercase flex justify-center items-center gap-2 transition-all border ${borderSecundario}`}>
                                              <Eye size={16} /> Ver na Tela
                                            </button>
                                            <a href={linkBrutoAtual} target="_blank" rel="noopener noreferrer" className={`w-full sm:w-auto px-6 py-3 md:py-3 ${theme === 'dark' ? 'bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400' : 'bg-white hover:bg-zinc-50 text-zinc-600'} rounded-xl text-[10px] font-black uppercase flex justify-center items-center gap-2 transition-all border ${borderSecundario} border-dashed`}>
                                              <ExternalLink size={16} /> Abrir Pasta (Navegador)
                                            </a>
                                          </>
                                        )}
                                      </div>

                                      {/* 🔥 CORREÇÃO: break-words e overflow-hidden para evitar o bug da palavra infinita */}
                                      <div className={`w-full ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-200'} p-4 md:p-5 rounded-2xl border mb-6 overflow-hidden min-w-0`}>
                                        <p className={`text-[10px] font-black uppercase tracking-widest ${textSecundario} mb-3 flex items-center gap-2`}><FileText size={14} /> Instrução / Roteiro:</p>
                                        <p className={`${textPrincipal} font-medium whitespace-pre-wrap break-words break-all text-xs md:text-sm leading-relaxed`}>
                                          {m.feedback_admin && <span className="text-blue-500 font-bold block mb-2">[ADMIN]: {renderTextWithLinks(m.feedback_admin)}</span>}
                                          {m.roteiro ? renderTextWithLinks(m.roteiro) : 'Nenhum roteiro fornecido.'}
                                        </p>
                                      </div>

                                      <div className="w-full flex justify-end">
                                        <button onClick={() => { setSelectedMaterial(m); setNewDriveLink(linkBrutoAtual || ''); setIsSubmitModalOpen(true); }} className={`w-full md:w-auto flex items-center justify-center gap-2 py-4 px-8 ${theme === 'dark' ? 'bg-white text-zinc-950 hover:bg-zinc-200' : 'bg-[#1A1A1A] text-white hover:bg-black'} rounded-xl font-black uppercase tracking-widest text-[10px] md:text-[11px] transition-all shadow-md`}>
                                          <CheckCircle2 size={16} /> Finalizar Decupagem
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'entregues' && (
          <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 text-left">
            <header><h2 className={`text-2xl md:text-3xl font-black tracking-tighter uppercase ${textPrincipal} flex items-center gap-3`}><CheckSquare className={textSecundario} size={28} /> Entregues</h2><p className={`${textSecundario} font-medium text-sm md:text-base mt-1`}>Materiais decupados. Aguarde o Admin delegar ao editor.</p></header>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {filaEntregues.map(m => (
                <div key={m.id} className={`${bgSecundario} border ${borderSecundario} rounded-[20px] p-5 md:p-6 flex items-center justify-between shadow-sm`}>
                  <div className="pr-4 min-w-0"><h3 className={`font-black text-base md:text-lg ${textPrincipal} tracking-tight uppercase break-words`}>{m.titulo}</h3><p className={`${textSecundario} font-bold text-xs mt-1 truncate`}>{m.cliente?.nome}</p></div>
                  <div className={`${theme === 'dark' ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-zinc-100 text-zinc-600 border-zinc-200'} font-black text-[9px] uppercase px-3 py-2 rounded-xl border shrink-0`}>Entregue</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* MODAL PARA RELATAR PROBLEMA */}
      {isIssueModalOpen && selectedMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className={`${bgSecundario} border ${borderSecundario} w-[95%] max-w-md rounded-[32px] p-6 md:p-10 shadow-2xl space-y-6 text-left`}>
            <div className="flex justify-between items-center"><h3 className="text-xl md:text-2xl font-black uppercase text-red-500 tracking-tighter flex items-center gap-2"><AlertCircle size={24} /> Problema</h3><button onClick={() => setIsIssueModalOpen(false)} className={`p-2 ${textSecundario} hover:${textPrincipal} transition-all`}><X size={20} /></button></div>
            <p className={`${textSecundario} text-xs md:text-sm`}>Explique ao Admin o que está errado com este material.</p>
            <textarea className={`w-full p-4 ${tc.bgInput} border ${borderSecundario} ${textPrincipal} rounded-2xl font-medium outline-none focus:border-red-500 transition-colors min-h-[120px] text-sm resize-none`} placeholder="Ex: O link está fora do ar ou faltam cenas..." value={issueText} onChange={e => setIssueText(e.target.value)} />
            <button onClick={handleReportIssue} disabled={!issueText || isSubmitting} className="w-full py-4 md:py-5 bg-red-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg hover:bg-red-500 active:scale-95 transition-all">
              {isSubmitting ? "Enviando..." : "Devolver para o Admin"}
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE ENTREGA */}
      {isSubmitModalOpen && selectedMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className={`${bgSecundario} border ${borderSecundario} w-[95%] max-w-md rounded-[32px] p-6 md:p-10 shadow-2xl space-y-6 text-left`}>
            <div className="flex justify-between items-center"><h3 className={`text-xl md:text-2xl font-black uppercase ${textPrincipal} tracking-tighter`}>Entregar Pasta</h3><button onClick={() => setIsSubmitModalOpen(false)} className={`p-2 ${textSecundario} hover:${textPrincipal} transition-all`}><X size={20} /></button></div>
            <div className={`${tc.bgInput} p-4 rounded-2xl border ${borderSecundario} mb-2`}><p className={`text-[10px] font-black uppercase ${textSecundario} mb-1`}>Tarefa:</p><p className={`font-bold ${textPrincipal} text-sm truncate`}>{selectedMaterial.titulo}</p></div>

            <div className="space-y-3">
              <label className={`text-[10px] font-black ${textSecundario} uppercase tracking-widest ml-2`}>Link da Pasta Organizada</label>
              <div className="flex flex-col gap-3">
                <input className={`w-full p-4 md:p-5 ${tc.bgInput} border ${borderSecundario} ${textPrincipal} rounded-2xl font-bold outline-none focus:border-zinc-500 transition-colors text-sm`} placeholder="Link da pasta final no Drive..." value={newDriveLink} onChange={e => setNewDriveLink(e.target.value)} />
                <div className="flex justify-center">
                  <GoogleDrivePicker onSelect={(url) => setNewDriveLink(url)} type="folder" label="Selecionar Pasta no Google Drive" />
                </div>
              </div>
            </div>
            <button onClick={handleDeliverOrganization} disabled={!newDriveLink || isSubmitting} className={`w-full py-4 md:py-5 ${theme === 'dark' ? 'bg-white text-zinc-950 hover:bg-zinc-200' : 'bg-[#1A1A1A] text-white hover:bg-black'} rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-all mt-2 disabled:opacity-50`}>
              {isSubmitting ? "A enviar..." : "Concluir e Avisar Admin"}
            </button>
          </div>
        </div>
      )}

      {/* PLAYER TELA CHEIA (RESPONSIVO VERTICAL/HORIZONTAL) */}
      {previewUrl && (
        <div className="fixed inset-0 z-[9999] flex flex-col md:flex-row items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="absolute top-4 right-4 flex items-center gap-2 z-[10000]">
            <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="p-3 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors">
              <ExternalLink size={18} />
            </a>
            <button onClick={() => setPreviewUrl(null)} className="p-3 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors">
              <X size={20} />
            </button>
          </div>
          <div className="w-full h-[85vh] max-w-[400px] md:max-w-5xl mx-auto flex items-center justify-center overflow-hidden">
            {renderPreviewContent(previewUrl)}
          </div>
        </div>
      )}
    </div>
  )
}