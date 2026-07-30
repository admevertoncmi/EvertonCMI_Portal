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
  
  const deadlineDate = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadlineDate.setHours(0, 0, 0, 0);

  const adjustedDeadline = new Date(deadlineDate);
  
  if (adjustedDeadline.getDay() === 6) {
    adjustedDeadline.setDate(adjustedDeadline.getDate() + 2);
  } else if (adjustedDeadline.getDay() === 0) {
    adjustedDeadline.setDate(adjustedDeadline.getDate() + 1);
  }

  return today > adjustedDeadline;
}


export function linkifyHtml(html?: string): string {
  if (!html) return '';
  // Regex to match URLs not inside href="..." and not inside existing <a> tags
  // Using a simpler robust approach for JS:
  // First, extract all existing <a> tags so we don't mess with them
  const aTagRegex = /<a\b[^>]*>(.*?)<\/a>/gi;
  const placeholders: string[] = [];
  let tempHtml = html.replace(aTagRegex, (match) => {
    placeholders.push(match);
    return `__A_TAG_PLACEHOLDER_${placeholders.length - 1}__`;
  });

  // Now replace plain URLs with <a> tags
  const urlRegex = /((?:https?:\/\/|www\.)[^\s<]+)/gi;
  tempHtml = tempHtml.replace(urlRegex, (url) => {
    const href = url.startsWith('http') ? url : `https://${url}`;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline break-all">${url}</a>`;
  });

  // Restore the original <a> tags
  placeholders.forEach((tag, i) => {
    tempHtml = tempHtml.replace(`__A_TAG_PLACEHOLDER_${i}__`, tag);
  });

  return tempHtml;
}
