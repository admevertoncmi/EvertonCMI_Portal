"use server"

/**
 * Busca os arquivos dentro de uma pasta do Google Drive.
 * @param folderId O ID da pasta no Drive
 */
export async function getDriveFolderFiles(folderId: string) {
  const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
  if (!API_KEY) {
    console.error("GOOGLE_API_KEY não configurada");
    return [];
  }

  try {
    // Filtramos para pegar apenas arquivos que não foram excluídos
    const query = `'${folderId}' in parents and trashed = false`;
    const fields = "files(id, name, mimeType, webViewLink, thumbnailLink)";
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&key=${API_KEY}&fields=${encodeURIComponent(fields)}&orderBy=name`;

    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      const err = await response.text();
      console.error("Erro na API do Google Drive:", err);
      return [];
    }

    const data = await response.json();
    
    // Retornamos os links formatados para que o nosso visualizador consiga abrir
    // Damos prioridade para imagens e vídeos
    return (data.files || []).map((file: any) => {
      return `https://drive.google.com/file/d/${file.id}/view`;
    });
  } catch (error) {
    console.error("Falha ao buscar arquivos da pasta:", error);
    return [];
  }
}
