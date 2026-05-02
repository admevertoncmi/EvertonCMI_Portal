import { createClient } from '@supabase/supabase-js';
import { notificarWhatsApp } from '@/actions/whatsapp';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Proteção Simples
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Não autorizado', { status: 401 });
  }

  // Precisamos usar a Service Role Key para ignorar RLS e conseguir buscar todos os agendamentos
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // 1. Buscar materiais agendados que já passaram do horário e ainda não foram enviados
    const { data: pendentes, error } = await supabase
      .from('materiais')
      .select('*, cliente:clientes(*)')
      .lte('agendado_para', new Date().toISOString())
      .eq('wpp_enviado', false);

    if (error) throw error;
    
    if (!pendentes || pendentes.length === 0) {
      return Response.json({ message: 'Nenhuma mensagem pendente no momento.' });
    }

    const resultados = [];

    for (const material of pendentes) {
      if (material.cliente?.telefone && material.cliente?.token_magico) {
        // Formatar Link do Portal
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        const linkPortal = `${baseUrl}/portal/${material.cliente.token_magico}`;
        
        // Formatar Mensagem
        const textoMensagem = `Olá! O material "${material.titulo}" foi concluído e está pronto para sua avaliação. 🎉\n\nPode acessar o seu portal aqui: ${linkPortal}`;
        
        // Decidir Destino (Grupo ou Privado)
        const chatId = material.cliente.whatsapp_group_id || material.cliente.telefone.replace(/\D/g, '');
        
        // Enviar via Green API
        const envio = await notificarWhatsApp(textoMensagem, chatId);
        
        if (envio?.success) {
          // Marcar como enviado com sucesso e mudar status para aparecer no portal
          await supabase
            .from('materiais')
            .update({ wpp_enviado: true, status: 'pendente' })
            .eq('id', material.id);
          
          resultados.push({ id: material.id, status: 'sucesso' });
        } else {
          resultados.push({ id: material.id, status: 'erro', error: envio?.error });
        }
      }
    }

    return Response.json({ 
      timestamp: new Date().toISOString(),
      processed: pendentes.length, 
      details: resultados 
    });

  } catch (err: any) {
    console.error('❌ Erro no Worker de WhatsApp:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
