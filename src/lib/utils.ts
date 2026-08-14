import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isTaskLate(criadoEm: string, prazoEmDias: number | undefined): boolean {
  if (!criadoEm || prazoEmDias === undefined) return false;
  
  const createdDate = new Date(criadoEm);
  const deadlineDate = new Date(createdDate);
  deadlineDate.setDate(createdDate.getDate() + prazoEmDias);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadlineDate.setHours(0, 0, 0, 0);

  const adjustedDeadline = new Date(deadlineDate);
  
  // Pula fim de semana (se D+1 for sábado ou domingo, joga para segunda)
  if (adjustedDeadline.getDay() === 6) { // sábado
    adjustedDeadline.setDate(adjustedDeadline.getDate() + 2);
  } else if (adjustedDeadline.getDay() === 0) { // domingo
    adjustedDeadline.setDate(adjustedDeadline.getDate() + 1);
  }

  return today > adjustedDeadline;
}

export function isMaterialAtrasado(dateStr?: string | null, status?: string): boolean {
  if (!dateStr) return false;
  
  // Se já estiver concluído/pronto/aprovado, não mostra mais a tag de "atrasado" na tela
  const statusConcluidos = ['aprovado', 'post_aprovado', 'concluido', 'pronto'];
  if (status && statusConcluidos.includes(status.toLowerCase())) return false;

  // Cria a data localmente para evitar problemas de fuso horário (-3h puxando o dia pra trás)
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  const deadlineDate = new Date(year, month - 1, day);
  deadlineDate.setHours(23, 59, 59, 999); // O prazo é até o fim do dia!

  // Se o prazo cair na Sexta (5), Sábado (6) ou Domingo (0), 
  // nós empurramos o limite para Domingo 23:59:59.
  // Assim, a tag "atrasado" só vai aparecer na Segunda-feira (dia útil seguinte).
  if (deadlineDate.getDay() === 5) { // Sexta
    deadlineDate.setDate(deadlineDate.getDate() + 2);
  } else if (deadlineDate.getDay() === 6) { // Sábado
    deadlineDate.setDate(deadlineDate.getDate() + 1);
  }

  const today = new Date();
  
  // Só está atrasado se a data/hora ATUAL for MAIOR que o limite ajustado.
  return today > deadlineDate;
}

export function isDateLate(dateStr: string): boolean {
  if (!dateStr) return false;
  
  // Create date considering local timezone to prevent UTC shift (e.g. 24/07 becoming 23/07 21:00)
  const [year, month, day] = dateStr.split('-').map(Number);
  const deadlineDate = new Date(year, month - 1, day);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadlineDate.setHours(0, 0, 0, 0);

  const adjustedDeadline = new Date(deadlineDate);
  
  // If the deadline is on a Friday (5), it should not be considered late on Saturday or Sunday.
  // It should only be late on Monday.
  // Therefore, we push the effective deadline to Sunday, so that only Monday > Sunday is true.
  if (adjustedDeadline.getDay() === 5) {
    adjustedDeadline.setDate(adjustedDeadline.getDate() + 2); // Shift deadline to Sunday
  } 
  else if (adjustedDeadline.getDay() === 6) {
    adjustedDeadline.setDate(adjustedDeadline.getDate() + 1); // Shift Saturday deadline to Sunday
  }

  return today > adjustedDeadline;
}


export function linkifyHtml(html?: string): string {
  if (!html) return '';
  // Convert non-breaking spaces to regular spaces FIRST so the urlRegex doesn't swallow them
  let tempHtml = html.replace(/&nbsp;/g, ' ').replace(/\u00A0/g, ' ');

  const placeholders: string[] = [];
  
  // 1. Protect existing <a> elements entirely so we don't nest links
  tempHtml = tempHtml.replace(/<a\b[^>]*>(.*?)<\/a>/gi, (match) => {
      placeholders.push(match);
      return `__HTML_TAG_PLACEHOLDER_${placeholders.length - 1}__`;
  });

  // 2. Protect all other HTML tags
  const htmlTagRegex = /(<[^>]+>)/g;
  tempHtml = tempHtml.replace(htmlTagRegex, (match) => {
    placeholders.push(match);
    return `__HTML_TAG_PLACEHOLDER_${placeholders.length - 1}__`;
  });

  // 3. Now replace plain URLs with <a> tags
  const urlRegex = /((?:https?:\/\/|www\.)(?:(?!__HTML_TAG_PLACEHOLDER_)[^\s<])+)/gi;
  tempHtml = tempHtml.replace(urlRegex, (url) => {
    // Strip trailing punctuation if it got caught
    let cleanUrl = url;
    let trailing = '';
    if (/[.,;:!?]$/.test(cleanUrl)) {
        trailing = cleanUrl.slice(-1);
        cleanUrl = cleanUrl.slice(0, -1);
    }
    const href = cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline break-all">${cleanUrl}</a>${trailing}`;
  });

  // 4. Restore the original HTML tags
  placeholders.forEach((tag, i) => {
    tempHtml = tempHtml.split(`__HTML_TAG_PLACEHOLDER_${i}__`).join(tag);
  });

  return tempHtml;
}

export function formatRichText(html?: string | null, defaultText = "Vazio."): string {
  if (!html) return defaultText;
  
  let formatted = html;
  
  // If it's plain text (no HTML tags), replace \n with <br/> so line breaks show up.
  if (!formatted.includes('<p>') && !formatted.includes('<br>')) {
    formatted = formatted.replace(/\n/g, '<br/>');
  } else {
    // If it IS HTML (from Quill), we want to strip literal \n characters to prevent 
    // double-spacing when using white-space: pre-wrap, as \n between tags creates extra lines.
    formatted = formatted.replace(/\n/g, '');
    
    // Quill sometimes saves completely empty paragraphs as <p></p>. 
    // When contenteditable is false, <p></p> collapses to 0 height. We must insert a <br> to preserve the blank line.
    formatted = formatted.replace(/<(p|h[1-6])><\/\1>/gi, '<$1><br></$1>');
  }
  
  // Clean up non-breaking spaces before linkifying
  formatted = formatted.replace(/\u00A0/g, ' ').replace(/&nbsp;/g, ' ');
  
  // Finally, run our existing linkify logic
  return linkifyHtml(formatted);
}

