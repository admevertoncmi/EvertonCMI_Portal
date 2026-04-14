import React from 'react'

export function StatusBadge({ status, small = false }: { status: string; small?: boolean }) {
  // Tratando maiúsculas e minúsculas para evitar bugs se o banco retornar diferente
  const normalizedStatus = status?.toLowerCase() || ''
  
  const styles: Record<string, string> = {
    "pendente": "bg-warning text-warning-foreground border-warning",
    "pendentes": "bg-warning text-warning-foreground border-warning",
    "aprovado": "bg-success text-success border-success",
    "roteiro_aprovado": "bg-success text-success border-success",
    "post_aprovado": "bg-success text-success border-success",
    "ajustes": "bg-destructive text-destructive border-destructive",
  }
  
  const dotStyles: Record<string, string> = {
    "pendente": "bg-warning",
    "pendentes": "bg-warning",
    "aprovado": "bg-success",
    "roteiro_aprovado": "bg-success",
    "post_aprovado": "bg-success",
    "ajustes": "bg-destructive",
  }

  const currentStyle = styles[normalizedStatus] || 'bg-secondary text-foreground border-border'
  const currentDotStyle = dotStyles[normalizedStatus] || 'bg-muted-foreground'

  return (
    <span className={`inline-flex items-center font-semibold border rounded-full text-xs ${small ? 'px-2 py-0.5' : 'px-3 py-1'} ${currentStyle}`}>
      <span className={`w-2 h-2 rounded-full mr-2 ${currentDotStyle}`} />
      {status}
    </span>
  )
}

