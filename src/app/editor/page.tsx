"use client"
import { isDateLate, isTaskLate } from "@/lib/utils";


import { useRouter } from 'next/navigation'
import { isMaterialAtrasado, linkifyHtml, formatRichText } from '@/lib/utils'
import { createClient } from '@/lib/supabase-browser'
import { Toaster, toast } from 'sonner'
import { getDriveFolderFiles } from '@/actions/google'
import GoogleDrivePicker from '@/components/GoogleDrivePicker'
import { ScaledGoogleDrivePlayer } from '@/components/ScaledGoogleDrivePlayer'
import { notificarClickUpChat } from '@/actions/clickup'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import {
  PenTool, CheckCircle, LogOut, Calendar, ChevronRight,
  AlertCircle, ExternalLink, X, MessageSquare, Search, Eye, Folder, FileVideo, Menu, Image as ImageIcon,
  ListTree, FileText, Loader2, Send, ChevronDown, Edit3, Trash2, Sun, Moon
} from 'lucide-react'

interface Cliente { id: string; nome: string; }
interface Material {
  id: string; cliente_id: string; titulo: string;
  ciclo?: string | number; link_drive?: string; link_capa?: string; link_organizado?: string; link_bruto?: string;
  data_limite?: string; roteiro?: string; video_entregue?: boolean; design_entregue?: boolean;
  status: any; created_at: string; tags?: string[]; feedback?: string | null; feedback_admin?: string | null; editor_id?: string | null; designer_id?: string | null;
  cliente?: { nome: string; };
}

const CollapsibleInstruction = ({ children, theme, isLong, title, icon: Icon, colorClass, borderClass, bgClass, textClass }: any) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`${bgClass} border ${borderClass} p-4 rounded-xl shadow-sm flex flex-col`}>
      <p className={`text-[9px] font-black uppercase tracking-widest ${colorClass} mb-2 flex items-center gap-2`}><Icon size={12} /> {title}</p>
      <div className={`${textClass} font-medium whitespace-pre-wrap text-sm break-words ${!expanded && isLong ? 'line-clamp-4' : ''}`}>
        {children}
      </div>
      {isLong && (
        <button onClick={() => setExpanded(!expanded)} className="mt-2 self-start text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-700 transition-colors">
          {expanded ? 'Ver Menos' : 'Ver Mais'}
        </button>
      )}
    </div>
  );
};

const getCleanText = (text: string | null | undefined) => {
  if (!text) return "";
  return text.replace(/\[ID:[^\]]+\]\s*/g, '');
};

const renderTextWithLinks = (text: string) => {
  if (!text) return null;
  const cleanText = getCleanText(text);
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
    return part;
  });
};

const getEmbedUrl = (url: string) => {
  if (url.includes('drive.google.com')) {
    const folderMatch = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (folderMatch) return `https://drive.google.com/embeddedfolderview?id=${folderMatch[1]}#grid`;
    return url.replace('/view', '/preview').replace('open?id=', 'file/d/').replace(/(\/view|\/viewusp=sharing)/, '/preview');
  }
  return url;
};

const isGoogleDriveVideo = (url: string) => {
  if (!url) return false;
  return url.includes('drive.google.com') && (url.includes('/file/d/') || url.includes('id=') || url.includes('/view') || url.includes('/preview'));
}

const AVAILABLE_TAGS = ['Urgente', 'Alta Prioridade', 'Revisão Necessária', 'Destaque', 'Em Atraso', 'Requer Atenção', 'Aprovado Internamente'];

const getGoogleDriveId = (url: string) => {
  if (!url) return null;
  const driveMatch1 = /\/file\/d\/([a-zA-Z0-9_-]+)/.exec(url);
  if (driveMatch1?.[1]) return driveMatch1[1];
  const driveMatch2 = /id=([a-zA-Z0-9_-]+)/.exec(url);
  if (driveMatch2?.[1] && url.includes('drive.google.com')) return driveMatch2[1];
  return null;
}

const getRawVideoUrl = (url: string) => {
  if (!url) return '';
  const driveId = getGoogleDriveId(url);
  if (driveId) return `/api/video-proxy?id=${driveId}`;
  return url;
}

export default function EditorDashboard() {
  const router = useRouter()
  
  const registrarLog = async (materialId: string, evento: string) => {
    await supabase.from('logs_acesso').insert([{ material_id: materialId, evento }]);
  };
  const supabase = createClient()

  // --- TEMA ---
  const [theme, setTheme] = useState<'dark' | 'light'>('light')
  useEffect(() => { const storedTheme = localStorage.getItem('editorTheme') as 'dark' | 'light' | null; if (storedTheme) setTheme(storedTheme); }, []);
  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);
  const toggleTheme = () => { const newTheme = theme === 'dark' ? 'light' : 'dark'; setTheme(newTheme); localStorage.setItem('editorTheme', newTheme); };

  const tc = {
    bgApp: theme === 'dark' ? 'bg-zinc-950' : 'bg-zinc-50', bgCard: theme === 'dark' ? 'bg-zinc-900' : 'bg-white',
    borderStrong: theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200', textMain: theme === 'dark' ? 'text-zinc-100' : 'text-zinc-900',
    textMuted: theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500', bgInput: theme === 'dark' ? 'bg-zinc-950' : 'bg-zinc-50',
    bgHover: theme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-zinc-50', bgHighlight: theme === 'dark' ? 'bg-zinc-800/50' : 'bg-zinc-50/50',
  };

  const bgPrincipal = tc.bgApp; const bgSecundario = tc.bgCard; const borderSecundario = tc.borderStrong;
  const textPrincipal = tc.textMain; const textSecundario = tc.textMuted; const hoverSecundario = tc.bgHover;

  // --- ESTADOS ---
  const [activeTab, setActiveTab] = useState<'ajustes' | 'revisao'>('ajustes');
  const [dateFilter, setDateFilter] = useState<'todas' | 'hoje' | 'semana' | 'futura'>('todas');
  const [materiais, setMateriais] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [userProfile, setUserProfile] = useState<{ nome: string, role: string } | null>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [expandedFeedbacks, setExpandedFeedbacks] = useState<string[]>([]);
  const toggleFeedback = (id: string) => setExpandedFeedbacks(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const [expandedClients, setExpandedClients] = useState<string[]>([])
  const [expandedCiclos, setExpandedCiclos] = useState<string[]>([])
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null)
  const [newDriveLink, setNewDriveLink] = useState('')
  const [newCapaLink, setNewCapaLink] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [zoomMode, setZoomMode] = useState<'fit' | 'fill'>('fit');
  const [aspectRatio, setAspectRatio] = useState<'9/16' | 'video' | 'square'>('9/16');

  // Efeito para definir padrões inteligentes de zoom/aspecto baseado no previewUrl
  useEffect(() => {
    if (previewUrl) {
      if (isGoogleDriveVideo(previewUrl)) {
        setZoomMode('fit');
        setAspectRatio('9/16');
      } else {
        setZoomMode('fit');
        setAspectRatio('9/16'); // Alterado de 'square' para '9/16' para capas/cards verticais!
      }
    }
  }, [previewUrl]);

  const [previewRoteiro, setPreviewRoteiro] = useState<Material | null>(null);
  const [useIframeFallback, setUseIframeFallback] = useState<Record<string, boolean>>({});

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

  // 🔥 ESTADOS PARA RELATAR PROBLEMA
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [issueType, setIssueType] = useState<'faltando_material' | 'verificar_material'>('verificar_material');
  const [issueText, setIssueText] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return; }
    setUserId(user.id)
    const { data: profile } = await supabase.from('perfis_equipe').select('*').eq('id', user.id).single();
    if (profile) setUserProfile(profile as any);
    const { data: m, error } = await supabase.from('materiais').select(`*, cliente:clientes(nome)`).or(`editor_id.eq.${user.id},designer_id.eq.${user.id}`).order('ordem', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false })
    if (m) setMateriais(m as Material[])
    setLoading(false)
  }, [supabase, router])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel('editor-realtime-sync')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'materiais', filter: `editor_id=eq.${userId}` }, (payload) => {
         setMateriais(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new, cliente: m.cliente } : m));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'materiais', filter: `designer_id=eq.${userId}` }, (payload) => {
         setMateriais(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new, cliente: m.cliente } : m));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'materiais' }, () => loadData())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'materiais' }, (payload) => {
         setMateriais(prev => prev.filter(m => m.id !== payload.old.id));
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, loadData, userId])

  const minhaFilaProducao = useMemo(() => materiais.filter(m => {

    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    const dayOfWeek = hoje.getDay() || 7;
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - dayOfWeek + 1);
    const fimSemana = new Date(inicioSemana);
    fimSemana.setDate(inicioSemana.getDate() + 6);

    if (dateFilter !== 'todas') {
        if (!m.data_limite) return false;
        
        // Parse the YYYY-MM-DD safely into local time midnight
        const [year, month, day] = m.data_limite.split('-');
        const d = new Date(Number(year), Number(month) - 1, Number(day));
        d.setHours(0,0,0,0);
        
        if (dateFilter === 'hoje') {
            if (d.getTime() !== hoje.getTime()) return false;
        } else if (dateFilter === 'semana') {
            if (d < inicioSemana || d > fimSemana) return false;
        } else if (dateFilter === 'futura') {
            if (d <= fimSemana) return false;
        }
    }
    // 🔥 AGORA INCLUI OS STATUS DE PROBLEMA PARA ELES NÃO SUMIREM DA TELA
    if (m.status !== 'ajustes' && m.status !== 'em_edicao' && m.status !== 'faltando_material' && m.status !== 'verificar_material') return false;
    const souEditor = m.editor_id === userId;
    const souDesigner = m.designer_id === userId;
    if (souEditor && !m.video_entregue) return true;
    if (souDesigner && !m.design_entregue) return true;
    return false;
  }), [materiais, userId, dateFilter]);

  const ajustesAgrupadosPorCliente = useMemo(() => {
    const grupos: Record<string, { clienteNome: string, tarefasMae: Record<string, { itens: Material[], videosOk: number, capasOk: number }> }> = {};
    minhaFilaProducao.forEach(m => {
      const cid = m.cliente_id;
      const cicloLabel = `CICLO ${m.ciclo || 1}`;
      if (!grupos[cid]) grupos[cid] = { clienteNome: m.cliente?.nome || 'Sem Cliente', tarefasMae: {} };
      if (!grupos[cid].tarefasMae[cicloLabel]) grupos[cid].tarefasMae[cicloLabel] = { itens: [], videosOk: 0, capasOk: 0 };
      grupos[cid].tarefasMae[cicloLabel].itens.push(m);
      if (m.link_drive && m.link_drive.trim() !== '') grupos[cid].tarefasMae[cicloLabel].videosOk++;
      if (m.link_capa && m.link_capa.trim() !== '') grupos[cid].tarefasMae[cicloLabel].capasOk++;
    });
    return grupos;
  }, [minhaFilaProducao]);

  const minhaFilaRevisao = useMemo(() => materiais.filter(m => {
    const souEditor = m.editor_id === userId;
    const souDesigner = m.designer_id === userId;
    if (m.status === 'revisao') return true;
    if (m.status === 'ajustes' || m.status === 'em_edicao') {
      if (souEditor && !souDesigner && m.video_entregue) return true;
      if (souDesigner && !souEditor && m.design_entregue) return true;
      if (souEditor && souDesigner && m.video_entregue && m.design_entregue) return true;
    }
    return false;
  }), [materiais, userId]);

  const toggleClient = (id: string) => { setExpandedClients(prev => prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]) }
  const toggleCiclo = (id: string) => { setExpandedCiclos(prev => prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]) }

  const handleSendNewVersion = async () => {
    if (!selectedMaterial) return
    setIsSubmitting(true)
    const souEditor = selectedMaterial.editor_id === userId;
    const souDesigner = selectedMaterial.designer_id === userId;
    const isVideoFilled = newDriveLink && newDriveLink.trim() !== '';
    const isDesignFilled = newCapaLink && newCapaLink.trim() !== '';
    const willVideoBeDone = souEditor ? isVideoFilled : selectedMaterial.video_entregue;
    const willDesignBeDone = souDesigner ? isDesignFilled : selectedMaterial.design_entregue;
    const needsVideo = !!selectedMaterial.editor_id;
    const needsDesign = !!selectedMaterial.designer_id;
    const isGlobalComplete = (!needsVideo || willVideoBeDone) && (!needsDesign || willDesignBeDone);
    const statusFinal = isGlobalComplete ? 'revisao' : selectedMaterial.status;

    const { error } = await supabase.from('materiais').update({
      link_drive: newDriveLink || selectedMaterial.link_drive,
      link_capa: newCapaLink || selectedMaterial.link_capa,
      video_entregue: willVideoBeDone,
      design_entregue: willDesignBeDone,
      status: statusFinal
    }).eq('id', selectedMaterial.id)

    if (error) { toast.error("Erro ao enviar: " + error.message) }
    else {
      if (isGlobalComplete && statusFinal === 'revisao') {
        toast.success("✅ Tudo entregue! Material enviado para a revisão da Agência.")
        const roleTag = userProfile?.role === 'designer' ? 'DESIGNER' : 'EDITOR';
        const msgAdmin = `🔔 REVISÃO PENDENTE (ADMIN)\n\n👤: ${roleTag}\n${userProfile?.nome || 'Equipe'}\n\n📍 **${selectedMaterial.cliente?.nome}**\n🎬 ${selectedMaterial.titulo}`;
        await notificarClickUpChat(msgAdmin);
      } else { toast.success("✅ A sua parte foi entregue! O Admin já pode ir verificando.");
        const roleTag = userProfile?.role === 'designer' ? 'DESIGNER' : 'EDITOR';
        registrarLog(selectedMaterial.id, `✅ ${roleTag} (${userProfile?.nome || 'Equipe'}) entregou a parte dele(a)`); }
      setIsVersionModalOpen(false)
      loadData()
    }
    setIsSubmitting(false)
  }

  const handleReportIssue = async () => {
    if (!selectedMaterial || !issueText) return toast.error("Por favor, descreva o problema!");
    setIsSubmitting(true);
    const feedbackComAutor = `[ID:${userId}] ${issueText}`;
    const { error } = await supabase.from('materiais').update({ status: issueType, feedback: feedbackComAutor }).eq('id', selectedMaterial.id);
    if (!error) {
      registrarLog(selectedMaterial.id, `❌ Devolvido por ${userProfile?.role === 'designer' ? 'Designer' : 'Editor'} (${userProfile?.nome || 'Equipe'}): ${issueText}`);
    }
    if (!error) {
      toast.success("Problema reportado ao Admin!");
      const roleTag = userProfile?.role === 'designer' ? 'DESIGNER' : 'EDITOR';
      const msgErro = `🔔 PROBLEMA NA PRODUÇÃO\n\n👤: ${roleTag}\n${userProfile?.nome || 'Equipe'}\n\n📍 **${selectedMaterial.cliente?.nome}**\n🎬 ${selectedMaterial.titulo}\n\n🔔 MOTIVO: ${issueText.toUpperCase()}`;
      await notificarClickUpChat(msgErro);
      setIsIssueModalOpen(false);
      loadData();
    } else {
      toast.error("Erro ao reportar problema.");
    }
    setIsSubmitting(false);
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

    if (url.match(/\.(jpeg|jpg|gif|png|webp|avif|jfif)$/i)) {
      return <img src={url} className="w-full mx-auto aspect-[9/16] md:aspect-video md:max-w-6xl max-h-[85vh] rounded-[24px] object-contain shadow-2xl" alt="Preview" />;
    }

    const finalUrl = getEmbedUrl(url) || url;
    const isDrive = isGoogleDriveVideo(url);
    return (
      <div 
        className={`w-full mx-auto bg-black rounded-[24px] overflow-hidden relative bg-black shadow-2xl border border-white/10 flex items-center justify-center transition-all duration-300 ${
          aspectRatio === '9/16' ? 'aspect-[9/16] max-w-[420px]' : 
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
  const roleLabel = userProfile?.role === 'designer' ? 'Designer' : userProfile?.role === 'planner' ? 'Decupador' : 'Editor';
  const firstName = userProfile?.nome?.split(' ')[0] || '';

  return (
    <div className={`flex h-screen h-[100dvh] ${bgPrincipal} font-sans ${textPrincipal} overflow-hidden ${theme}`}>
      <Toaster position="top-right" richColors theme={theme} />

      {/* HEADER MOBILE CLÁSSICO MARROM COM DARK MODE */}
      <div className={`md:hidden flex items-center justify-between p-5 pt-8 safe-pt-header-classic ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-[#212013] border-[#A25431]'} text-white rounded-b-[24px] fixed top-0 w-full z-[100] shadow-lg border-b`}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center font-black text-xl border border-white/20 shadow-inner">
            {userProfile?.role === 'designer' ? 'DD' : 'ED'}
          </div>
          <div>
            <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Olá, {firstName}!</p>
            <h1 className="text-sm font-black uppercase tracking-wide">Painel {roleLabel}</h1>
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

      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-zinc-950/60 backdrop-blur-md z-[9998] md:hidden animate-in fade-in duration-300" 
          onClick={() => setIsMobileMenuOpen(false)} 
        />
      )}

      {/* SIDEBAR COM BOTÃO DARK/LIGHT NA BASE */}
      <aside className={`fixed inset-y-0 left-0 w-72 md:w-64 bg-[#1a190f]/95 backdrop-blur-xl md:backdrop-blur-none md:bg-[#212013] text-white border-r border-white/10 md:border-[#212013] flex flex-col z-[9999] shadow-[15px_0_50px_rgba(0,0,0,0.5)] md:shadow-none rounded-r-[32px] md:rounded-r-none transform transition-all duration-300 ease-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`}>
        <div className="pt-8 safe-pt-aside pb-4 px-6 flex flex-col items-center relative border-b border-white/5">
          <img src="/logo-light.png" alt="Everton" className="h-32 md:h-36 w-auto object-contain transition-transform duration-300" style={{ marginBottom: '-10px' }} />
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden absolute right-4 top-4 p-2 text-zinc-400 hover:text-white bg-white/10 rounded-full"><X size={18} /></button>
        </div>
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto mt-4 custom-scrollbar">
          <button onClick={() => { setActiveTab('ajustes'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 p-3 rounded-xl font-bold transition-all ${activeTab === 'ajustes' ? 'bg-[#A25431] text-white shadow-lg' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>
            <PenTool size={20} /> Minhas Tarefas
          </button>
          <button onClick={() => { setActiveTab('revisao'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 p-3 rounded-xl font-bold transition-all ${activeTab === 'revisao' ? 'bg-[#A25431] text-white shadow-lg' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>
            <Search size={20} /> Meus Entregues
          </button>
        </nav>

        <div className="p-4 border-t border-white/5 flex flex-col gap-2 bg-[#1a190f]">
          <button onClick={toggleTheme} className="w-full flex items-center gap-3 p-3 text-yellow-500 font-bold hover:bg-white/5 rounded-xl transition-all text-sm">
            {theme === 'dark' ? <><Sun size={20} /> Modo Claro</> : <><Moon size={20} /> Modo Escuro</>}
          </button>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} className="w-full flex items-center gap-3 p-3 text-red-400 font-bold hover:bg-white/5 rounded-xl transition-all text-sm"><LogOut size={20} /> Sair</button>
        </div>
      </aside>

      <main className={`flex-1 pt-28 safe-pt-main-classic md:pt-10 pb-10 px-4 md:px-10 overflow-y-auto ${bgPrincipal}`}>

        {/* ABA DE EDIÇÃO / DESIGN */}
        {activeTab === 'ajustes' && (
          <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 text-left">
            <header>
              <h2 className={`text-2xl md:text-3xl font-black tracking-tighter uppercase ${textPrincipal}`}>Tarefas Pendentes</h2>
              <p className={`${textSecundario} font-medium text-sm md:text-base mt-1`}>Sua fila de produção de Vídeos e Designs.</p>

            <div className="flex flex-wrap items-center gap-2 mt-4 mb-2">
                <span className={`text-xs font-black uppercase ${textSecundario} mr-2`}>Filtrar:</span>
                {['todas', 'hoje', 'semana', 'futura'].map(f => (
                    <button 
                        key={f}
                        onClick={() => setDateFilter(f as any)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${dateFilter === f ? 'bg-[#A25431] text-white shadow-md' : `${bgSecundario} ${textSecundario} border ${borderSecundario} hover:bg-[#A25431]/10`}`}
                    >
                        {f === 'todas' ? 'Todas' : f === 'semana' ? 'Esta Semana' : f === 'futura' ? 'Próximas Demandas' : f}
                    </button>
                ))}
            </div>
    
</header>

            {loading ? (
              <div className={`${textSecundario} animate-pulse font-bold flex items-center gap-2`}>
                <Loader2 size={20} className="animate-spin" /> A buscar tarefas...
              </div>
            ) : minhaFilaProducao.length === 0 ? (
              <div className={`p-10 md:p-20 text-center border border-dashed ${borderSecundario} rounded-[32px] ${bgSecundario}`}>
                <CheckCircle size={48} className={`mx-auto ${textSecundario} opacity-50 mb-4`} />
                <h3 className={`text-xl font-black uppercase tracking-tight ${textSecundario}`}>Mesa Limpa, {firstName}!</h3>
                <p className={`${textSecundario} mt-2 text-sm font-medium`}>Tudo entregue da sua parte.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(ajustesAgrupadosPorCliente).map(([clienteId, grupo]) => {
                  const isExpanded = expandedClients.includes(clienteId);
                  const totalTarefasCliente = Object.values(grupo.tarefasMae).reduce((acc, curr) => acc + curr.itens.length, 0);

                  return (
                    <div key={clienteId} className={`${bgSecundario} border transition-all duration-300 overflow-hidden ${isExpanded ? `border-[#A25431]/50 shadow-xl` : `${borderSecundario} hover:border-[#A25431]/30 cursor-pointer`} rounded-[24px] md:rounded-[32px]`}>

                      <div onClick={() => !isExpanded && toggleClient(clienteId)} className={`p-5 md:p-6 ${theme === 'dark' ? 'bg-zinc-900/50' : 'bg-zinc-50/50'} flex flex-col md:flex-row md:items-center justify-between gap-4 border-b ${borderSecundario}`}>
                        <div className="flex items-center gap-4 flex-1">
                          <button onClick={(e) => { e.stopPropagation(); toggleClient(clienteId); }} className={`${textSecundario} hover:${textPrincipal} transition-colors`}>
                            <ChevronRight size={24} className={`transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
                          </button>
                          <div className="p-3 bg-[#A25431]/10 text-[#A25431] border border-[#A25431]/20 rounded-xl shrink-0"><Folder size={20} /></div>
                          <h3 className={`text-xl md:text-2xl font-black tracking-tight ${textPrincipal} uppercase truncate`}>{grupo.clienteNome}</h3>
                        </div>
                        <span className={`w-full md:w-auto text-center ${theme === 'dark' ? 'bg-zinc-800 text-zinc-300' : 'bg-white text-zinc-600'} text-xs px-4 py-2 rounded-xl font-black uppercase tracking-widest border ${borderSecundario}`}>
                          {totalTarefasCliente} Subtarefa(s)
                        </span>
                      </div>

                      {isExpanded && (
                        <div className={`p-4 md:p-6 grid gap-4 md:gap-6 ${bgSecundario} min-w-0`}>
                          {Object.entries(grupo.tarefasMae).map(([cicloLabel, mae]) => {
                            const maeId = `${clienteId}-${cicloLabel}`;
                            const isCicloExpanded = expandedCiclos.includes(maeId);

                            return (
                              <div key={maeId} className={`${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-2xl md:rounded-[24px] overflow-hidden shadow-sm min-w-0`}>

                                <div onClick={() => toggleCiclo(maeId)} className={`p-4 md:p-5 ${theme === 'dark' ? 'bg-zinc-900/50 hover:bg-zinc-900' : 'bg-white hover:bg-zinc-50'} transition-colors cursor-pointer flex flex-col xl:flex-row xl:items-center justify-between gap-4`}>
                                  <div className="flex items-center gap-3">
                                    <ChevronRight size={18} className={`${textSecundario} transition-transform ${isCicloExpanded ? 'rotate-90' : ''}`} />
                                    <ListTree size={18} className="text-[#A25431] hidden md:block" />
                                    <h4 className={`font-black text-sm ${textPrincipal} uppercase tracking-widest`}>{cicloLabel}</h4>
                                  </div>
                                </div>

                                {isCicloExpanded && (
                                  <div className={`p-4 md:p-5 grid gap-4 border-t ${borderSecundario} ${bgPrincipal} min-w-0`}>
                                    {mae.itens.map(m => {
                                      // 🔥 VARIÁVEL PARA SABER SE A TAREFA ESTÁ COM PROBLEMA REPORTADO
                                      const isReported = m.status === 'faltando_material' || m.status === 'verificar_material';

                                      return (
                                        <div key={m.id} className={`${bgSecundario} border ${borderSecundario} rounded-2xl p-5 flex flex-col xl:flex-row justify-between gap-6 items-start md:items-center shadow-sm min-w-0 transition-colors`}>
                                          <div className="space-y-4 flex-1 min-w-0">
                                            <div>
                                              <div className="flex items-center gap-2 flex-wrap mb-3">
                                                {m.status === 'em_edicao' && <span className={`text-blue-500 font-black text-[9px] uppercase tracking-widest ${theme === 'dark' ? 'bg-blue-900/30 border-blue-900/50' : 'bg-blue-100 border-blue-200'} px-3 py-1 rounded-full border`}>Produção Inicial</span>}
                                                {m.status === 'ajustes' && <span className={`text-orange-500 font-black text-[9px] uppercase tracking-widest ${theme === 'dark' ? 'bg-orange-900/30 border-orange-900/50' : 'bg-orange-100 border-blue-200'} px-3 py-1 rounded-full border`}>Ajuste Solicitado</span>}
                                                {isReported && <span className={`text-red-500 font-black text-[9px] uppercase tracking-widest ${theme === 'dark' ? 'bg-red-900/30 border-red-900/50' : 'bg-red-100 border-red-200'} px-3 py-1 rounded-full border flex items-center gap-1`}><AlertCircle size={10} /> Em Análise (Admin)</span>}

                                                {m.data_limite && (
                                                  <span className={`text-zinc-500 font-black text-[9px] uppercase tracking-widest ${theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-100 border-zinc-200'} px-3 py-1 rounded-full border flex items-center gap-1.5`}>
                                                    <Calendar size={12} /> Prazo: {new Date(m.data_limite + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                  </span>
                                                )}
                                              </div>
                                              <h5 className={`text-base md:text-lg font-black tracking-tight ${textPrincipal} uppercase ${isReported ? 'opacity-50' : ''}`}>{m.titulo}</h5>
                                            </div>

                                            <div className="flex flex-wrap gap-2 md:gap-3 w-full">
                                              {m.link_bruto && (
                                                <a href={m.link_bruto} target="_blank" rel="noopener noreferrer" className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 ${theme === 'dark' ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border-zinc-700' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 border-zinc-300'} rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all shadow-sm`}>
                                                  <Folder size={14} /> Pasta Bruta
                                                </a>
                                              )}
                                              {m.link_organizado && (
                                                <a href={m.link_organizado} target="_blank" rel="noopener noreferrer" className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 ${theme === 'dark' ? 'bg-indigo-900/30 text-indigo-400 hover:bg-indigo-900/50 border-indigo-900/50' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-indigo-200'} rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all shadow-sm`}>
                                                  <Folder size={14} /> Pasta Decupada
                                                </a>
                                              )}

                                              {m.roteiro && (
                                                <button onClick={() => setPreviewRoteiro(m)} className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 ${theme === 'dark' ? 'bg-purple-900/30 text-purple-400 hover:bg-purple-900/50 border-purple-900/50' : 'bg-purple-50 text-purple-600 hover:bg-purple-100 border-purple-200'} rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all shadow-sm`}>
                                                  <FileText size={14} /> Ler Roteiro
                                                </button>
                                              )}

                                              <button onClick={() => { setSelectedMaterial(m); setIssueType('verificar_material'); setIssueText(''); setIsIssueModalOpen(true); }} disabled={isReported} className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 ${theme === 'dark' ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50 border-red-900/50' : 'bg-red-50 text-red-600 hover:bg-red-100 border-red-200'} rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed`}>
                                                <AlertCircle size={14} /> {isReported ? 'Problema Reportado' : 'Relatar Problema'}
                                              </button>

                                              {/* 🔥 VER VERSÃO ANTERIOR (O QUE O CLIENTE VIU) */}
                                              {(m.link_drive || m.link_capa) && m.status === 'ajustes' && (
                                                <div className={`w-full flex flex-wrap gap-2 pt-3 mt-1 border-t ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-100'}`}>
                                                  <span className={`w-full text-[9px] font-bold uppercase ${textSecundario} mb-1 flex items-center gap-2`}><Eye size={12} /> Versão que o Cliente viu:</span>
                                                  {m.link_drive && (
                                                    <button onClick={() => setPreviewUrl(m.link_drive || null)} className={`flex items-center gap-2 px-3 py-2 ${theme === 'dark' ? 'bg-blue-900/20 text-blue-400 border-blue-900/40' : 'bg-blue-50 text-blue-600 border-blue-100'} rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all`}>
                                                      <FileVideo size={12} /> Ver Vídeo
                                                    </button>
                                                  )}
                                                  {m.link_capa && (
                                                    <button onClick={() => setPreviewUrl(m.link_capa || null)} className={`flex items-center gap-2 px-3 py-2 ${theme === 'dark' ? 'bg-pink-900/20 text-pink-400 border-pink-900/40' : 'bg-pink-50 text-pink-600 border-pink-100'} rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all`}>
                                                      <ImageIcon size={12} /> Ver Capa
                                                    </button>
                                                  )}
                                                </div>
                                              )}
                                            </div>

                                            <div className="flex flex-col gap-4 mt-4">
                                              {m.feedback_admin && (
                                                <CollapsibleInstruction
                                                  theme={theme}
                                                  isLong={m.feedback_admin.length > 200}
                                                  title="Instrução Admin:"
                                                  icon={MessageSquare}
                                                  colorClass={theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}
                                                  borderClass={theme === 'dark' ? 'border-blue-900/50' : 'border-blue-100'}
                                                  bgClass={theme === 'dark' ? 'bg-blue-950/40' : 'bg-blue-50'}
                                                  textClass={theme === 'dark' ? 'text-blue-100' : 'text-blue-900'}
                                                >
                                                  {renderTextWithLinks(m.feedback_admin)}
                                                </CollapsibleInstruction>
                                              )}

                                              {m.feedback && (
                                                <CollapsibleInstruction
                                                  theme={theme}
                                                  isLong={m.feedback.length > 200}
                                                  title={m.status === 'ajustes' ? 'Cliente Pediu Ajuste:' : 'Detalhe do Problema:'}
                                                  icon={AlertCircle}
                                                  colorClass={theme === 'dark' ? 'text-red-400' : 'text-red-600'}
                                                  borderClass={theme === 'dark' ? 'border-red-900/50' : 'border-red-100'}
                                                  bgClass={theme === 'dark' ? 'bg-red-950/40' : 'bg-red-50'}
                                                  textClass={theme === 'dark' ? 'text-red-100' : 'text-red-900'}
                                                >
                                                  {renderTextWithLinks(m.feedback)}
                                                </CollapsibleInstruction>
                                              )}
                                            </div>
                                          </div>

                                          <div className="flex flex-col gap-3 w-full xl:w-[220px] shrink-0">
                                            <div className={`flex items-center justify-between ${bgPrincipal} border ${borderSecundario} p-3 rounded-xl mb-1 shadow-sm`}>
                                              {m.editor_id && <FileVideo size={16} className={m.video_entregue ? "text-green-500" : textSecundario} />}
                                              {m.designer_id && <ImageIcon size={16} className={m.design_entregue ? "text-green-500" : textSecundario} />}
                                            </div>

                                            {/* 🔥 BOTÃO DE ENTREGAR BLOQUEADO SE HOUVER PROBLEMA */}
                                            <button onClick={() => {
                                              if (!isReported) {
                                                setSelectedMaterial(m);
                                                setNewDriveLink(m.link_drive || '');
                                                setNewCapaLink(m.link_capa || '');
                                                setIsVersionModalOpen(true);
                                              }
                                            }}
                                              disabled={isReported}
                                              className={`w-full flex flex-col items-center justify-center gap-1 py-5 ${isReported ? 'bg-zinc-500 cursor-not-allowed' : 'bg-[#A25431] hover:bg-[#8a4729] active:scale-95'} text-white rounded-xl md:rounded-2xl transition-all shadow-lg`}>
                                              <span className="font-black uppercase tracking-widest text-[11px] flex items-center gap-2">
                                                {isReported ? <><Loader2 size={16} className="animate-spin" /> Aguardando Admin</> : <><PenTool size={16} /> Entregar Minha Parte</>}
                                              </span>
                                            </button>
                                          </div>
                                        </div>
                                      )
                                    })}
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
            )}
          </div>
        )}

        {/* ABA DE REVISÃO (MEUS ENTREGUES) */}
        {activeTab === 'revisao' && (
          <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 text-left">
            <header>
              <h2 className={`text-2xl md:text-3xl font-black tracking-tighter uppercase ${textPrincipal} flex items-center gap-3`}>
                <Search className="text-purple-500" size={28} /> Meus Entregues
              </h2>
              <p className={`${textSecundario} font-medium text-sm md:text-base mt-1`}>Materiais que você já entregou. Aguardando o resto da equipe ou a validação.</p>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {minhaFilaRevisao.map(m => (
                <div key={m.id} className={`${bgSecundario} border ${theme === 'dark' ? 'border-purple-900/50' : 'border-purple-200'} rounded-[20px] md:rounded-[24px] p-5 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm`}>
                  <div className="min-w-0">
                    <h3 className={`font-black text-base md:text-lg ${textPrincipal} tracking-tight uppercase truncate`}>{m.titulo}</h3>
                    <p className={`${textSecundario} font-bold text-xs mt-1 truncate`}>{m.cliente?.nome}</p>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                    {m.link_drive && <button onClick={() => setPreviewUrl(m.link_drive || null)} className={`p-3 ${bgPrincipal} ${textSecundario} ${hoverSecundario} rounded-xl transition-colors shrink-0`} title="Ver Vídeo"><FileVideo size={16} /></button>}
                    {m.link_capa && <button onClick={() => setPreviewUrl(m.link_capa || null)} className={`p-3 ${bgPrincipal} ${textSecundario} ${hoverSecundario} rounded-xl transition-colors shrink-0`} title="Ver Capa"><ImageIcon size={16} /></button>}
                    <div className={`w-full sm:w-auto text-center ${theme === 'dark' ? 'bg-purple-900/30 text-purple-400 border-purple-900/50' : 'bg-purple-100 text-purple-700 border-purple-200'} font-black text-[10px] uppercase px-4 py-3 sm:py-2 rounded-xl border`}>Entregue</div>
                  </div>
                </div>
              ))}
              {minhaFilaRevisao.length === 0 && !loading && (
                <div className={`${theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border-2 border-dashed rounded-[24px] p-10 text-center col-span-1 md:col-span-2`}>
                  <p className={`${textSecundario} font-bold text-sm`}>Nenhuma entrega no momento.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* MODAL DE ENTREGA DO MATERIAL */}
      {isVersionModalOpen && selectedMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className={`${bgSecundario} border ${borderSecundario} w-[95%] max-w-lg max-h-[90vh] overflow-y-auto rounded-[32px] p-5 md:p-8 shadow-2xl space-y-5 md:space-y-6 text-left`}>
            <div className="flex justify-between items-center">
              <div className="min-w-0 pr-4">
                <h3 className={`text-xl md:text-2xl font-black uppercase ${textPrincipal} tracking-tighter`}>Entregar Material</h3>
                <p className={`${textSecundario} font-medium text-[10px] uppercase tracking-widest mt-1 truncate`}>{selectedMaterial.titulo}</p>
              </div>
              <button onClick={() => setIsVersionModalOpen(false)} className={`p-2 ${textSecundario} ${hoverSecundario} rounded-full transition-all shrink-0`}><X size={18} /></button>
            </div>

            <div className={`${theme === 'dark' ? 'bg-orange-900/20 border-orange-900/50' : 'bg-orange-50 border-orange-200'} p-4 rounded-xl border`}>
              <p className={`${theme === 'dark' ? 'text-orange-400' : 'text-orange-700'} text-[11px] md:text-xs font-medium flex gap-2`}>
                <AlertCircle size={16} className="shrink-0" />
                {selectedMaterial.editor_id && selectedMaterial.designer_id && selectedMaterial.editor_id !== selectedMaterial.designer_id
                  ? "Preencha a sua parte e envie. A tarefa só sairá da mesa da equipe quando ambos entregarem."
                  : "Coloque o seu link abaixo para enviar a tarefa para aprovação."}
              </p>
            </div>

            <div className="space-y-4">
              {(selectedMaterial.editor_id === userId && !selectedMaterial.video_entregue) && (
                <div className="space-y-2">
                  <label className={`text-[10px] font-black ${textSecundario} uppercase tracking-widest ml-2`}>Link do Vídeo Final (Drive)</label>
                  <div className="flex flex-col gap-3">
                    <input className={`w-full py-3 px-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-2xl font-bold outline-none focus:border-[#A25431] transition-colors text-sm`} placeholder="Link do vídeo no Drive..." value={newDriveLink} onChange={e => setNewDriveLink(e.target.value)} />
                    <div className="flex justify-center">
                      <GoogleDrivePicker onSelect={(url) => setNewDriveLink(url)} type="file" label="Selecionar Vídeo no Drive" />
                    </div>
                  </div>
                </div>
              )}

              {(selectedMaterial.designer_id === userId && !selectedMaterial.design_entregue) && (
                <div className="space-y-2">
                  <label className={`text-[10px] font-black ${textSecundario} uppercase tracking-widest ml-2`}>Link da Capa (Google Drive)</label>
                  <div className="flex flex-col gap-3">
                    <input className={`w-full py-3 px-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-2xl font-bold outline-none focus:border-[#A25431] transition-colors text-sm`} placeholder="Link do design no Drive..." value={newCapaLink} onChange={e => setNewCapaLink(e.target.value)} />
                    <div className="flex justify-center">
                      <GoogleDrivePicker onSelect={(url) => setNewCapaLink(url)} type="file" label="Selecionar Capa no Drive" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button onClick={handleSendNewVersion} disabled={isSubmitting || (!newDriveLink && !newCapaLink)} className={`w-full py-3.5 ${theme === 'dark' ? 'bg-white hover:bg-zinc-200 text-black' : 'bg-[#1A1A1A] hover:bg-black text-white'} rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2`}>
              {isSubmitting ? <Loader2 size={16} className="animate-spin inline-block" /> : null}
              {isSubmitting ? "A salvar..." : "Entregar Minha Parte"}
            </button>
          </div>
        </div>
      )}

      {/* MODAL PARA RELATAR PROBLEMA */}
      {isIssueModalOpen && selectedMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className={`${bgSecundario} border ${borderSecundario} w-[95%] max-w-md rounded-[32px] p-5 md:p-10 shadow-2xl space-y-5 md:space-y-6 text-left`}>
            <div className="flex justify-between items-center">
              <h3 className={`text-xl md:text-2xl font-black uppercase text-red-500 tracking-tighter flex items-center gap-2`}><AlertCircle size={24} /> Problema</h3>
              <button onClick={() => setIsIssueModalOpen(false)} className={`p-2 ${textSecundario} hover:${textPrincipal} transition-all`}><X size={20} /></button>
            </div>

            <p className={`${textSecundario} text-xs md:text-sm font-medium`}>Explique ao Admin o que está errado com o material bruto recebido.</p>

            <div className="space-y-4">
              <select className={`w-full py-3 px-4 ${bgPrincipal} border ${borderSecundario} ${textPrincipal} rounded-2xl font-bold outline-none focus:border-red-500 transition-colors text-sm shadow-sm`} value={issueType} onChange={e => setIssueType(e.target.value as any)}>
                <option value="verificar_material">Erro no Material / Dúvida</option>
                <option value="faltando_material">Falta Material na Pasta</option>
              </select>

              <textarea
                className={`w-full py-3 px-4 ${bgPrincipal} border ${borderSecundario} ${textPrincipal} rounded-2xl font-medium outline-none focus:border-red-500 transition-colors min-h-[120px] text-sm resize-none shadow-sm`}
                placeholder="Ex: O link da pasta está quebrado, ou falta uma foto para o carrossel..."
                value={issueText}
                onChange={e => setIssueText(e.target.value)}
              />
            </div>

            <button onClick={handleReportIssue} disabled={!issueText || isSubmitting} className="w-full py-3.5 bg-red-600 text-white rounded-xl md:rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-lg hover:bg-red-500 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
              {isSubmitting ? "A enviar..." : "Devolver para o Admin"}
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE ROTEIRO BLINDADO */}
      {previewRoteiro && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className={`${bgSecundario} border ${borderSecundario} w-[95%] max-w-3xl max-h-[85vh] rounded-[32px] shadow-2xl flex flex-col overflow-hidden text-left min-w-0`}>
            <div className={`p-5 md:p-8 border-b ${borderSecundario} flex justify-between items-center ${bgPrincipal} shrink-0`}>
              <div className="min-w-0 pr-4">
                <h3 className={`text-xl md:text-2xl font-black uppercase ${textPrincipal} break-words`}>{previewRoteiro.titulo}</h3>
                <p className="text-[10px] font-bold text-purple-500 uppercase tracking-widest mt-1 flex items-center gap-1.5"><FileText size={12} /> Roteiro Base</p>
              </div>
              <button onClick={() => setPreviewRoteiro(null)} className={`p-2 ${bgSecundario} hover:${bgPrincipal} ${textSecundario} hover:${textPrincipal} rounded-full shrink-0 transition-colors`}><X size={20} /></button>
            </div>
            <div className="p-5 md:p-8 overflow-y-auto">
              <div className={`ql-editor !p-0 max-w-none text-sm md:text-base font-medium whitespace-pre-wrap leading-relaxed [&_a]:cursor-pointer [&_a]:text-blue-500 [&_a]:hover:underline break-words ${theme === 'dark' ? 'text-zinc-200' : 'text-zinc-800'}`} dangerouslySetInnerHTML={{ __html: formatRichText(previewRoteiro.roteiro, "Roteiro não preenchido.") }} />
            </div>
          </div>
        </div>
      )}

      {/* PLAYER TELA CHEIA */}
      {previewUrl && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 z-[10000] w-full px-4 justify-center">
            <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-6 py-3 bg-white/20 backdrop-blur-md text-white rounded-2xl hover:bg-white/30 transition-all border border-white/10 shadow-xl font-black uppercase text-[10px] tracking-widest">
              <ExternalLink size={18} /> Abrir Original
            </a>
            <button onClick={() => setPreviewUrl(null)} className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-2xl hover:bg-red-600 transition-all shadow-xl font-black uppercase text-[10px] tracking-widest">
              <X size={20} /> Fechar
            </button>
          </div>
          <div className="w-full h-[80vh] md:h-full max-w-7xl mx-auto flex items-center justify-center overflow-hidden p-2 md:p-10 mb-20 md:mb-0">
            {renderPreviewContent(previewUrl)}
          </div>
        </div>
      )}
    </div>
  )
}