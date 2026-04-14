// --- CLIENTES ---
export interface DBCliente {
  id: string
  nome: string
  telefone: string
  token_magico: string
  created_at: string
  ciclos_contratados?: number // <-- ADICIONADO PARA CORRIGIR O ERRO
  wpp_suporte?: string | null;
  cor_marca?: string;
}

export interface Cliente extends DBCliente {
  logo_url?: string
}

// --- MATERIAIS ---
export interface Material {
  id: string
  cliente_id: string
  titulo: string
  link_capa?: string | null;      // 👈 Adicione isso
  data_limite?: string | null;    // 👈 Adicione isso
  link_drive?: string // Link do vídeo FINAL (Editor -> Cliente)
  link_bruto?: string // Link bruto (Admin -> Planner)
  link_organizado?: string // Link das pastas (Planner -> Editor)
  video_entregue?: boolean; // 🔥 Adicionado
  design_entregue?: boolean; // 🔥 Adicionado
  // <-- STATUS ATUALIZADO COM OS NOVOS FLUXOS -->
  status: 'pendente' | 'aprovado' | 'ajustes' | 'revisao' | 'concluido' | 'roteiro_pendente' | 'planejamento' | 'organizado' | 'em_organizacao' | 'faltando_material' | 'verificar_material' | 'analise_roteiro' | 'em_edicao' | 'roteiro_aprovado' | 'post_aprovado'; // 🔥 'roteiro_aprovado' e 'post_aprovado' adicionados
  created_at: string
  feedback?: string | null
  feedback_admin?: string | null
  roteiro?: string | null 
  editor_id?: string | null 
  designer_id?: string | null; // 🔥 Adicionado
  planner_id?: string | null 
  clickup_task_id?: string | null
  ciclo?: number // <-- ADICIONADO PARA CORRIGIR O ERRO
  cliente?: Cliente
  logs_acesso?: LogAcesso[]
}

export interface EquipeMember {
  id: string;
  email: string;
  nome?: string;
  role: 'admin' | 'editor' | 'planner' | 'designer'; // 🔥 Designer adicionado aqui
  telegram_thread_id?: string;
  created_at?: string;
}

// --- AUXILIARES ---
export interface LogAcesso {
  created_at: string
  evento: string
}

export interface MaterialUI {
  id: string
  client: string
  name: string
  status: string
  date: string
}