"use client"

import { useState, useEffect } from 'react';
import { 
  Folder, 
  FileText, 
  Loader2, 
  ChevronRight, 
  Search, 
  X, 
  CornerDownRight, 
  ArrowLeft,
  Check,
  FolderPlus,
  ExternalLink,
  HardDrive,
  Grid,
  List,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';

interface GoogleDrivePickerProps {
  onSelect: (url: string) => void;
  type?: 'folder' | 'file' | 'all';
  label?: string;
}

// DECLARAÇÕES PARA O TYPESCRIPT NÃO RECLAMAR DAS LIBS DO GOOGLE
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

export default function GoogleDrivePicker({ onSelect, type = 'all', label = "Selecionar do Drive" }: GoogleDrivePickerProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Estados do Navegador do Drive
  const [items, setItems] = useState<any[]>([]);
  const [sharedDrives, setSharedDrives] = useState<any[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
  const [breadcrumbs, setBreadcrumbs] = useState<any[]>([
    { id: 'root', name: 'Meu Drive' }
  ]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'mydrive' | 'shared'>('mydrive');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // 1. CARREGAR OS SCRIPTS NATIVOS DO GOOGLE DE FORMA ROBUSTA
  useEffect(() => {
    let gapiLoaded = false;
    let gisLoaded = false;

    const checkLoaded = () => {
      if (window.gapi && window.google?.accounts?.oauth2) {
        setIsLoaded(true);
      }
    };

    if (window.gapi && window.google?.accounts?.oauth2) {
      setIsLoaded(true);
      return;
    }

    const scriptGapi = document.createElement('script');
    scriptGapi.src = 'https://apis.google.com/js/api.js';
    scriptGapi.async = true;
    scriptGapi.defer = true;
    scriptGapi.onload = () => {
      gapiLoaded = true;
      checkLoaded();
    };
    document.body.appendChild(scriptGapi);

    const scriptGis = document.createElement('script');
    scriptGis.src = 'https://accounts.google.com/gsi/client';
    scriptGis.async = true;
    scriptGis.defer = true;
    scriptGis.onload = () => {
      gisLoaded = true;
      checkLoaded();
    };
    document.body.appendChild(scriptGis);
  }, []);

  // 2. BUSCAR ITENS DA PASTA ATUAL OU LISTA DE DRIVES
  useEffect(() => {
    if (isPickerOpen && accessToken) {
      if (currentFolderId === 'shared_root') {
        fetchSharedDrives(accessToken);
      } else {
        fetchFolderItems(currentFolderId, accessToken);
      }
    }
  }, [currentFolderId, isPickerOpen, accessToken, activeTab]);

  // 3. PESQUISA DE ITENS DE FORMA DEBOUNCED
  useEffect(() => {
    if (!searchTerm || !accessToken) {
      setSearchResults([]);
      return;
    }

    const delayDebounce = setTimeout(() => {
      searchDriveItems(searchTerm, accessToken);
    }, 450);

    return () => clearTimeout(delayDebounce);
  }, [searchTerm, accessToken]);

  const handleOpenPicker = () => {
    if (!CLIENT_ID || !API_KEY) {
      toast.error("Configurações do Google Drive não encontradas no .env");
      return;
    }

    if (!window.google?.accounts?.oauth2) {
      toast.error("Biblioteca do Google ainda carregando. Aguarde um segundo...");
      return;
    }

    if (accessToken) {
      setIsPickerOpen(true);
    } else {
      try {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/drive.readonly',
          callback: (response: any) => {
            if (response.error) {
              console.error("OAuth Error:", response.error);
              toast.error(`Falha ao conectar: ${response.error_description || response.error}`);
              return;
            }
            if (response.access_token) {
              setAccessToken(response.access_token);
              setIsPickerOpen(true);
              fetchFolderItems('root', response.access_token);
            }
          },
        });
        client.requestAccessToken();
      } catch (error) {
        console.error("Falha ao abrir pop-up:", error);
        toast.error("Habilite janelas pop-up para autorizar o acesso ao Google Drive.");
      }
    }
  };

  // BUSCAR ARQUIVOS E PASTAS DE UMA PASTA
  const fetchFolderItems = async (folderId: string, token: string) => {
    setLoading(true);
    try {
      let query = `'${folderId}' in parents and trashed = false`;
      if (type === 'folder') {
        query += ` and mimeType = 'application/vnd.google-apps.folder'`;
      } else if (type === 'file') {
        query += ` and mimeType != 'application/vnd.google-apps.folder'`;
      }

      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,webViewLink,thumbnailLink)&pageSize=100&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives`;
      
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        // Ordena pastas primeiro
        const sorted = (data.files || []).sort((a: any, b: any) => {
          const aIsFolder = a.mimeType === 'application/vnd.google-apps.folder';
          const bIsFolder = b.mimeType === 'application/vnd.google-apps.folder';
          if (aIsFolder && !bIsFolder) return -1;
          if (!aIsFolder && bIsFolder) return 1;
          return 0;
        });
        setItems(sorted);
      } else {
        console.error("Erro ao buscar arquivos:", await response.text());
        toast.error("Erro ao obter arquivos do Google Drive");
      }
    } catch (error) {
      console.error("Erro na requisição:", error);
    } finally {
      setLoading(false);
    }
  };

  // BUSCAR DRIVES COMPARTILHADOS (SHARED DRIVES)
  const fetchSharedDrives = async (token: string) => {
    setLoading(true);
    try {
      const url = `https://www.googleapis.com/drive/v3/drives?pageSize=100`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setSharedDrives(data.drives || []);
      } else {
        console.error("Erro ao carregar Shared Drives:", await response.text());
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // REALIZAR BUSCA GLOBAL OU INTERNA
  const searchDriveItems = async (term: string, token: string) => {
    setSearching(true);
    try {
      const escapedSearch = term.replace(/'/g, "\\'");
      let query = `name contains '${escapedSearch}' and trashed = false`;
      
      if (type === 'folder') {
        query += ` and mimeType = 'application/vnd.google-apps.folder'`;
      } else if (type === 'file') {
        query += ` and mimeType != 'application/vnd.google-apps.folder'`;
      }

      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,webViewLink,thumbnailLink)&pageSize=40&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives`;
      
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.files || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSearching(false);
    }
  };

  const handleTabChange = (tab: 'mydrive' | 'shared') => {
    setActiveTab(tab);
    setSearchTerm('');
    if (tab === 'mydrive') {
      setCurrentFolderId('root');
      setBreadcrumbs([{ id: 'root', name: 'Meu Drive' }]);
    } else {
      setCurrentFolderId('shared_root');
      setBreadcrumbs([{ id: 'shared_root', name: 'Drives Compartilhados' }]);
    }
  };

  const handleFolderClick = (id: string, name: string) => {
    setSearchTerm('');
    setBreadcrumbs([...breadcrumbs, { id, name }]);
    setCurrentFolderId(id);
  };

  const handleBreadcrumbClick = (index: number) => {
    setSearchTerm('');
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newBreadcrumbs);
    setCurrentFolderId(newBreadcrumbs[newBreadcrumbs.length - 1].id);
  };

  const handleSelectItem = (item: any) => {
    onSelect(item.webViewLink);
    setIsPickerOpen(false);
    toast.success("Item selecionado com sucesso!");
  };

  const handleSelectCurrentFolder = () => {
    // URL padrão do Drive para pastas
    const folderUrl = currentFolderId === 'root' 
      ? 'https://drive.google.com/drive/my-drive' 
      : `https://drive.google.com/drive/folders/${currentFolderId}`;
    
    onSelect(folderUrl);
    setIsPickerOpen(false);
    toast.success("Pasta importada com sucesso!");
  };

  const currentFolderName = breadcrumbs[breadcrumbs.length - 1]?.name || 'Meu Drive';

  return (
    <>
      <button
        type="button"
        onClick={handleOpenPicker}
        className="flex items-center gap-2 px-4 py-2 bg-zinc-150 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-dashed border-zinc-300 dark:border-zinc-600"
      >
        {isLoaded ? <FolderPlus size={14} /> : <Loader2 size={14} className="animate-spin" />}
        {label}
      </button>

      {/* MODAL DE NAVEGAÇÃO PREMIUM ESTILO CLICKUP */}
      {isPickerOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-4xl rounded-[20px] shadow-2xl flex flex-col max-h-[85vh] text-left text-zinc-900 dark:text-zinc-100 overflow-hidden">
            
            {/* CABEÇALHO */}
            <div className="p-5 border-b border-zinc-150 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-950/40">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Folder className="text-[#A25431]" size={18} />
                  {type === 'folder' ? 'Selecionar uma pasta' : type === 'file' ? 'Selecionar um arquivo' : 'Selecionar do Google Drive'}
                </h3>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-wider mt-0.5">
                  Navegador Oficial • Everton CMI
                </p>
              </div>
              <button 
                onClick={() => setIsPickerOpen(false)} 
                className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* TABBAR DE ATALHOS / NAVEGAÇÃO ESTILO CLICKUP */}
            <div className="flex justify-between items-center border-b border-zinc-150 dark:border-zinc-800 px-5 py-2 bg-white dark:bg-zinc-900">
              <div className="flex gap-4">
                <button
                  onClick={() => handleTabChange('mydrive')}
                  className={`py-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 px-1 ${
                    activeTab === 'mydrive' 
                      ? 'border-[#A25431] text-[#A25431]' 
                      : 'border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                  }`}
                >
                  Meu Drive
                </button>
                <button
                  onClick={() => handleTabChange('shared')}
                  className={`py-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 px-1 ${
                    activeTab === 'shared' 
                      ? 'border-[#A25431] text-[#A25431]' 
                      : 'border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                  }`}
                >
                  Drives Compartilhados
                </button>
              </div>

              {/* BARRA DE PESQUISA */}
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" size={13} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Pesquisar..."
                  className="w-full pl-8 pr-7 py-1.5 bg-zinc-55 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-semibold text-zinc-900 dark:text-white outline-none focus:border-[#A25431] transition-all"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* BREADCRUMBS (CAMINHO DE PASTAS) */}
            {!searchTerm && (
              <div className="flex items-center gap-1 px-5 py-3 bg-zinc-50 dark:bg-zinc-950/20 border-b border-zinc-150 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400 overflow-x-auto whitespace-nowrap">
                {breadcrumbs.map((crumb, idx) => (
                  <div key={crumb.id} className="flex items-center gap-1 flex-shrink-0">
                    {idx > 0 && <ChevronRight size={12} className="text-zinc-400" />}
                    <button
                      onClick={() => handleBreadcrumbClick(idx)}
                      className={`hover:text-[#A25431] dark:hover:text-white font-bold transition-all ${
                        idx === breadcrumbs.length - 1 ? 'text-zinc-800 dark:text-white font-black' : ''
                      }`}
                    >
                      {crumb.name}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* ÁREA DE CONTEÚDO (GRID DE PASTAS E ARQUIVOS) */}
            <div className="flex-1 overflow-y-auto p-5 bg-zinc-50 dark:bg-zinc-950/30 min-h-[350px]">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full py-24 text-zinc-400 dark:text-zinc-500">
                  <Loader2 className="animate-spin text-[#A25431] mb-2" size={28} />
                  <p className="text-xs font-bold uppercase tracking-wider">Carregando itens do Google Drive...</p>
                </div>
              ) : searchTerm ? (
                /* RESULTADOS DA PESQUISA */
                searching ? (
                  <div className="flex flex-col items-center justify-center h-full py-24">
                    <Loader2 className="animate-spin text-[#A25431] mb-2" size={24} />
                    <p className="text-xs font-bold text-zinc-500">Buscando no Drive...</p>
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {searchResults.map((item) => (
                      <div
                        key={item.id}
                        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 hover:border-zinc-350 dark:hover:border-zinc-700 p-3 rounded-xl flex items-center justify-between group transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center flex-shrink-0 text-zinc-500 group-hover:bg-[#A25431]/10 group-hover:text-[#A25431] transition-colors">
                            {item.mimeType === 'application/vnd.google-apps.folder' ? <Folder size={16} /> : <FileText size={16} />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-zinc-850 dark:text-zinc-200 truncate pr-1">
                              {item.name}
                            </p>
                            <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-wide mt-0.5">
                              {item.mimeType === 'application/vnd.google-apps.folder' ? 'Pasta' : 'Arquivo'}
                            </p>
                          </div>
                        </div>
                        {item.mimeType === 'application/vnd.google-apps.folder' ? (
                          <button
                            onClick={() => handleFolderClick(item.id, item.name)}
                            className="text-[9px] bg-zinc-100 dark:bg-zinc-800 hover:bg-[#A25431] hover:text-white px-2.5 py-1.5 rounded-lg font-black uppercase tracking-wider flex items-center gap-1 transition-all"
                          >
                            Abrir
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSelectItem(item)}
                            className="text-[9px] bg-[#A25431]/10 text-[#A25431] hover:bg-[#A25431] hover:text-white px-2.5 py-1.5 rounded-lg font-black uppercase tracking-wider transition-all"
                          >
                            Selecionar
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
                    <Folder className="mb-2 opacity-50" size={32} />
                    <p className="text-xs font-bold">Nenhum resultado correspondente no Drive</p>
                  </div>
                )
              ) : currentFolderId === 'shared_root' ? (
                /* LISTAGEM DE DRIVES COMPARTILHADOS */
                sharedDrives.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 animate-in fade-in duration-200">
                    {sharedDrives.map((drive) => (
                      <button
                        key={drive.id}
                        onClick={() => handleFolderClick(drive.id, drive.name)}
                        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 hover:border-[#A25431] dark:hover:border-zinc-700 p-4 rounded-xl flex items-center gap-3 text-left transition-all shadow-sm hover:shadow-md group"
                      >
                        <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center flex-shrink-0 text-zinc-500 group-hover:bg-[#A25431]/10 group-hover:text-[#A25431] transition-colors">
                          <HardDrive size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-zinc-850 dark:text-zinc-200 group-hover:text-[#A25431] dark:group-hover:text-white truncate">
                            {drive.name}
                          </p>
                          <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider mt-0.5">
                            Drive Compartilhado
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
                    <HardDrive className="mb-2 opacity-50" size={32} />
                    <p className="text-xs font-bold">Nenhum Drive Compartilhado localizado</p>
                  </div>
                )
              ) : (
                /* NAVEGAÇÃO INTERNA DE PASTAS E ARQUIVOS */
                items.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 animate-in fade-in duration-200">
                    {items.map((item) => {
                      const isFolder = item.mimeType === 'application/vnd.google-apps.folder';
                      return (
                        <div
                          key={item.id}
                          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded-xl p-3.5 flex items-center justify-between group shadow-sm hover:shadow-md transition-all hover:border-zinc-350 dark:hover:border-zinc-700"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* MINIATURA OU ÍCONE */}
                            <div className="w-10 h-10 rounded-xl overflow-hidden bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center flex-shrink-0 text-zinc-400 group-hover:text-[#A25431] transition-colors border border-zinc-100 dark:border-zinc-850">
                              {isFolder ? (
                                <Folder size={18} className="fill-current text-zinc-400 group-hover:text-[#A25431] transition-colors" />
                              ) : item.thumbnailLink ? (
                                <img 
                                  src={item.thumbnailLink} 
                                  alt={item.name} 
                                  className="w-full h-full object-cover" 
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <FileText size={18} />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-zinc-850 dark:text-zinc-200 group-hover:text-[#A25431] dark:group-hover:text-white truncate pr-1 transition-colors">
                                {item.name}
                              </p>
                              <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider mt-0.5">
                                {isFolder ? 'Pasta' : 'Arquivo'}
                              </p>
                            </div>
                          </div>

                          {/* AÇÕES DE CADA ITEM */}
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {isFolder ? (
                              <>
                                {type === 'folder' && (
                                  <button
                                    onClick={() => handleSelectItem(item)}
                                    title="Selecionar esta pasta"
                                    className="p-2 bg-[#A25431]/10 hover:bg-[#A25431] text-[#A25431] hover:text-white rounded-lg transition-all"
                                  >
                                    <Check size={13} />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleFolderClick(item.id, item.name)}
                                  className="text-[9px] bg-zinc-100 dark:bg-zinc-850 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg transition-all"
                                >
                                  Abrir
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleSelectItem(item)}
                                className="text-[9px] bg-[#A25431]/10 text-[#A25431] hover:bg-[#A25431] hover:text-white px-2.5 py-1.5 rounded-lg font-black uppercase tracking-wider transition-all"
                              >
                                Selecionar
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-zinc-450 dark:text-zinc-650">
                    <Folder className="mb-2 opacity-30" size={36} />
                    <p className="text-xs font-bold">Esta pasta está vazia</p>
                  </div>
                )
              )}
            </div>

            {/* RODAPÉ DO SELETOR ESTILO CLICKUP */}
            <div className="p-4 border-t border-zinc-150 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <div className="text-zinc-500 dark:text-zinc-400 text-xs font-semibold">
                {type === 'folder' && currentFolderId !== 'shared_root' ? (
                  <div className="flex items-center gap-1.5">
                    <CornerDownRight size={14} className="text-[#A25431]" />
                    <span>Pasta atual: </span>
                    <strong className="text-zinc-800 dark:text-white">{currentFolderName}</strong>
                  </div>
                ) : (
                  <span>Navegue e selecione o item desejado</span>
                )}
              </div>
              
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsPickerOpen(false)}
                  className="px-4 py-2 text-zinc-500 dark:text-zinc-450 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Cancelar
                </button>
                {type === 'folder' && currentFolderId !== 'shared_root' && (
                  <button
                    type="button"
                    onClick={handleSelectCurrentFolder}
                    className="px-5 py-2.5 bg-[#A25431] hover:bg-[#8e4524] text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md flex items-center gap-1.5"
                  >
                    <Check size={12} />
                    Selecionar Pasta Atual
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
