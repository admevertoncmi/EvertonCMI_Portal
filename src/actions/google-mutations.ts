"use server"

/**
 * Procura arquivos dentro de uma pasta cujo nome comece com "Cópia de " ou "Copy of "
 * e os renomeia, removendo o prefixo.
 */
export async function cleanCopyOfPrefix(folderId: string, accessToken: string) {
  if (!accessToken) return { success: false, error: "Access token is required" };
  
  try {
    const allFiles: any[] = [];
    
    // Função recursiva para buscar dentro de subpastas
    const fetchFilesRecursive = async (currentFolderId: string) => {
      const query = `'${currentFolderId}' in parents and trashed = false`;
      const fields = "files(id, name, mimeType)";
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&orderBy=name`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) return;

      const data = await response.json();
      const items = data.files || [];
      
      const subfolderPromises: Promise<void>[] = [];
      
      for (const item of items) {
        if (item.mimeType === 'application/vnd.google-apps.folder') {
          subfolderPromises.push(fetchFilesRecursive(item.id));
        } else {
          allFiles.push(item);
        }
      }
      
      await Promise.all(subfolderPromises);
    };

    await fetchFilesRecursive(folderId);
    
    // Filtrar localmente por arquivos de vídeo que contenham o prefixo
    const regexPrefixo = /(Cópia de |Copy of )+/gi;
    const arquivosParaRenomear = allFiles.filter((f: any) => 
      f.name.match(regexPrefixo)
    );

    if (arquivosParaRenomear.length === 0) {
      return { success: true, message: "Nenhum arquivo com prefixo de cópia encontrado.", count: 0 };
    }

    // 2. Renomear os arquivos disparando PATCH
    const renamePromises = arquivosParaRenomear.map(async (file: any) => {
      // Remove todas as ocorrências de "Cópia de " e "Copy of ", ignorando maiúsculas/minúsculas
      const newName = file.name.replace(regexPrefixo, '');

      const patchUrl = `https://www.googleapis.com/drive/v3/files/${file.id}`;
      return fetch(patchUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: newName })
      });
    });

    await Promise.all(renamePromises);

    return { 
      success: true, 
      count: arquivosParaRenomear.length, 
      message: `${arquivosParaRenomear.length} arquivo(s) renomeado(s) com sucesso.` 
    };

  } catch (error) {
    console.error("Falha ao limpar prefixos:", error);
    return { success: false, error: "Failed to rename files" };
  }
}

/**
 * Cria subtastas dentro de uma pasta mãe no Google Drive.
 * @param parentFolderId A pasta raiz (selecionada no Drive Picker)
 * @param folderNames A lista de títulos (ex: nomes das tarefas)
 * @param accessToken O token de escrita do Google Drive
 * @returns Um mapa: { [nomeDaPasta]: linkBrutoDaPasta }
 */
export async function createBatchFolders(parentFolderId: string, folderNames: string[], accessToken: string) {
  if (!accessToken) return { success: false, error: "Access token is required" };
  
  try {
    // 1. Funções auxiliares para buscar e criar pastas
    const findFolderByName = async (parentId: string, name: string) => {
      const query = `'${parentId}' in parents and name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`;
      const response = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
      if (response.ok) {
        const data = await response.json();
        if (data.files && data.files.length > 0) return data.files[0].id;
      }
      return null;
    };

    const createFolder = async (parentId: string, name: string) => {
      const url = `https://www.googleapis.com/drive/v3/files`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] })
      });
      if (response.ok) {
        const data = await response.json();
        return data.id;
      }
      throw new Error(`Falha ao criar a pasta ${name}`);
    };

    // 2. Verificar ou criar as pastas FOTOS e VIDEOS
    let fotosFolderId = await findFolderByName(parentFolderId, 'FOTOS');
    if (!fotosFolderId) fotosFolderId = await createFolder(parentFolderId, 'FOTOS');

    let videosFolderId = await findFolderByName(parentFolderId, 'VIDEOS');
    if (!videosFolderId) videosFolderId = await createFolder(parentFolderId, 'VIDEOS');

    const results: Record<string, string> = {};

    // 3. Promessas para criação paralela das pastas das tarefas
    const createPromises = folderNames.map(async (name) => {
      const isVideo = name.toLowerCase().includes('reel') || 
                      name.toLowerCase().includes('vídeo') || 
                      name.toLowerCase().includes('video') || 
                      name.toLowerCase().includes('tiktok') || 
                      name.toLowerCase().includes('shorts');

      const targetParentId = isVideo ? videosFolderId : fotosFolderId;

      const url = `https://www.googleapis.com/drive/v3/files`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: name,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [targetParentId]
        })
      });

      if (!response.ok) {
        console.error(`Erro ao criar pasta ${name}:`, await response.text());
        return null;
      }

      const data = await response.json();
      const folderLink = `https://drive.google.com/drive/folders/${data.id}`;
      
      results[name] = folderLink;
    });

    await Promise.all(createPromises);

    return { success: true, links: results };

  } catch (error) {
    console.error("Falha ao criar pastas em lote:", error);
    return { success: false, error: "Failed to create folders" };
  }
}
