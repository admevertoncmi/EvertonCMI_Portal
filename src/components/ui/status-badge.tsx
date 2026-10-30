import { cn } from "@/lib/utils"

interface StatusBadgeProps {
  status: string
  small?: boolean
}

function StatusBadge({ status, small = false }: StatusBadgeProps) {
  const styles: Record<string, string> = {
    "Pendente": "bg-warning/10 text-warning-foreground border-warning/20",
    "Aprovado": "bg-success/10 text-success border-success/20",
    "Roteiro Aprovado": "bg-success/10 text-success border-success/20",
    "Post Aprovado": "bg-success/10 text-success border-success/20",
    "Ajustes": "bg-destructive/10 text-destructive border-destructive/20",
  };
  const dotStyles: Record<string, string> = {
    "Pendente": "bg-warning",
    "Aprovado": "bg-success",
    "Roteiro Aprovado": "bg-success",
    "Post Aprovado": "bg-success",
    "Ajustes": "bg-destructive",
  };

  return (
    <span className={cn(
      `inline-flex items-center font-semibold border rounded-full ${small ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'}`, 
      styles[status] || ''
    )}>
      <span className={cn(`w-1.5 h-1.5 rounded-full mr-1.5`, dotStyles[status] || '')} />
      {status}
    </span>
  );
}

export { StatusBadge }
