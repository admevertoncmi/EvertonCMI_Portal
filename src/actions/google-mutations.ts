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
    const results: Record<string, string> = {};

    // Promessas para criação paralela das pastas
    const createPromises = folderNames.map(async (name) => {
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
          parents: [parentFolderId]
        })
      });

      if (!response.ok) {
        console.error(`Erro ao criar pasta ${name}:`, await response.text());
        return null; // Pode retornar erro específico ou apenas falhar silenciosamente para esta
      }

      const data = await response.json();
      // data.id será retornado, a URL visível padrão é:
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
