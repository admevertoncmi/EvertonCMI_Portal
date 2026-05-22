"use client"

import { useState, useEffect } from 'react';
import { FolderPlus, Loader2 } from 'lucide-react';
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
const APP_ID = CLIENT_ID?.split('-')[0];

export default function GoogleDrivePicker({ onSelect, type = 'all', label = "Selecionar do Drive" }: GoogleDrivePickerProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // 1. CARREGAR OS SCRIPTS NATIVOS DO GOOGLE DE FORMA ROBUSTA E COMBATER RACE CONDITIONS
  useEffect(() => {
    let gapiLoaded = false;
    let gisLoaded = false;

    const checkLoaded = () => {
      if (window.gapi && window.google?.accounts?.oauth2) {
        setIsLoaded(true);
      }
    };

    // Se já estiverem no window, marca como carregado imediatamente
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
    scriptGapi.onerror = () => {
      console.error("Erro ao carregar script GAPI do Google");
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
    scriptGis.onerror = () => {
      console.error("Erro ao carregar script GIS do Google");
    };
    document.body.appendChild(scriptGis);
  }, []);

  const handleOpenPicker = () => {
    if (!CLIENT_ID || !API_KEY) {
      toast.error("Configurações do Google Drive não encontradas no .env");
      return;
    }

    if (!window.google?.accounts?.oauth2 || !window.gapi) {
      toast.error("Os scripts do Google ainda estão carregando. Por favor, aguarde alguns instantes...");
      return;
    }

    if (accessToken) {
      createPicker(accessToken);
    } else {
      try {
        // SOLICITAR TOKEN DE ACESSO
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/drive.readonly',
          callback: (response: any) => {
            if (response.error) {
              console.error("Erro ao solicitar token:", response.error);
              toast.error(`Erro de autenticação: ${response.error_description || response.error}`);
              return;
            }
            if (response.access_token) {
              setAccessToken(response.access_token);
              createPicker(response.access_token);
            }
          },
        });
        client.requestAccessToken();
      } catch (err) {
        console.error("Erro ao iniciar fluxo OAuth:", err);
        toast.error("Não foi possível iniciar o login do Google Drive. Tente recarregar a página.");
      }
    }
  };

  const createPicker = (token: string) => {
    window.gapi.load('picker', () => {
      const pickerBuilder = new window.google.picker.PickerBuilder()
        .setAppId(APP_ID)
        .setOAuthToken(token)
        .setDeveloperKey(API_KEY);

      // Definir tamanho espaçoso idêntico ao do ClickUp
      pickerBuilder.setSize(1050, 600);

      const title = type === 'folder'
        ? 'Selecionar Pasta'
        : type === 'file'
        ? 'Selecionar Arquivo'
        : 'Selecionar do Google Drive';

      pickerBuilder.setTitle(title);

      // ABA 1: Google Drive (DocsView)
      const googleDriveView = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS);
      googleDriveView.setEnableDrives(true);
      if (type === 'folder') {
        googleDriveView.setMimeTypes('application/vnd.google-apps.folder');
        googleDriveView.setSelectFolderEnabled(true);
        googleDriveView.setIncludeFolders(true);
      } else if (type === 'file') {
        googleDriveView.setIncludeFolders(false);
      } else {
        googleDriveView.setIncludeFolders(true);
        googleDriveView.setSelectFolderEnabled(true);
      }
      pickerBuilder.addView(googleDriveView);

      // ABA 2: Shared drives (DocsView com setEnableDrives habilitado explicitamente)
      const sharedDrivesView = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS);
      sharedDrivesView.setEnableDrives(true);
      if (type === 'folder') {
        sharedDrivesView.setMimeTypes('application/vnd.google-apps.folder');
        sharedDrivesView.setSelectFolderEnabled(true);
        sharedDrivesView.setIncludeFolders(true);
      } else if (type === 'file') {
        sharedDrivesView.setIncludeFolders(false);
      } else {
        sharedDrivesView.setIncludeFolders(true);
        sharedDrivesView.setSelectFolderEnabled(true);
      }
      pickerBuilder.addView(sharedDrivesView);

      // ABA 3: Upload (apenas se não for seleção de pasta)
      if (type !== 'folder') {
        const uploadView = new window.google.picker.DocsUploadView();
        pickerBuilder.addView(uploadView);
      }

      // ABA 4: Folders (Visão focada exclusivamente em pastas, idêntica à do print do ClickUp)
      const foldersView = new window.google.picker.DocsView(window.google.picker.ViewId.FOLDERS);
      foldersView.setEnableDrives(true);
      if (type === 'folder') {
        foldersView.setMimeTypes('application/vnd.google-apps.folder');
        foldersView.setSelectFolderEnabled(true);
      }
      pickerBuilder.addView(foldersView);

      // Habilitar suporte a drives compartilhados globalmente
      pickerBuilder.enableFeature(window.google.picker.Feature.SUPPORT_DRIVES);
      pickerBuilder.enableFeature(window.google.picker.Feature.SUPPORT_TEAM_DRIVES);

      pickerBuilder.setCallback((data: any) => {
        if (data.action === 'picked') {
          const doc = data.docs[0];
          onSelect(doc.url);
          toast.success("Link importado com sucesso!");
        }
      });

      const picker = pickerBuilder.build();
      picker.setVisible(true);
    });
  };

  return (
    <button
      type="button"
      onClick={handleOpenPicker}
      className="flex items-center gap-2 px-4 py-2 bg-zinc-150 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-dashed border-zinc-300 dark:border-zinc-600"
    >
      {isLoaded ? <FolderPlus size={14} /> : <Loader2 size={14} className="animate-spin" />}
      {label}
    </button>
  );
}
