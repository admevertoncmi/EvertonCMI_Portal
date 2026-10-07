const fs = require('fs');
let code = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');

let newFunc = `  const handleAprovarLoteParaCliente = async (itens: Material[], scheduleDate?: string) => {
    setLoading(true); const ids = itens.map(i => i.id);
    
    if (scheduleDate) {
      const isoDate = new Date(scheduleDate).toISOString();
      const { error } = await supabase.from('materiais').update({
        agendado_para: isoDate,
        wpp_enviado: false
      }).in('id', ids);
      
      if (!error) {
        toast.success(\`\${ids.length} materiais agendados para \${new Date(scheduleDate).toLocaleString()}!\`);
      } else {
        toast.error("Erro ao agendar lote.");
      }
      loadData();
      setLoading(false);
      return;
    }

    const { error } = await supabase.from('materiais').update({ status: 'pendente', feedback_admin: null, editor_id: null, designer_id: null }).in('id', ids);
    if (!error) {
      toast.success(\`\${ids.length} materiais aprovados para o cliente!\`);
      const primeiroItem = itens[0];
      if (primeiroItem?.cliente?.telefone && primeiroItem?.cliente?.token_magico) {
        const linkPortal = \`\${window.location.origin}/portal/\${primeiroItem.cliente.token_magico}?tab=roteiros\`;
        const textoMensagem = \`Olá! Novas edições/designs foram concluídos e estão disponíveis para a sua avaliação. 🎉\\n\\nAcesse o seu portal aqui: \${linkPortal}\`;

        const groupId = primeiroItem.cliente.whatsapp_group_id;
        if (groupId) {
          toast.info("Enviando aviso automático para o grupo...");
          notificarWhatsApp(textoMensagem, groupId);
        } else {
          toast.info("Enviando aviso automático via WhatsApp...");
          notificarWhatsApp(textoMensagem, primeiroItem.cliente.telefone.replace(/\\D/g, ''));
        }
      }
      loadData();
    } else { toast.error("Erro ao aprovar lote."); } setLoading(false);
  }`;

code = code.replace(/const handleAprovarLoteParaCliente = async \(itens: Material\[\]\) => \{[\s\S]*?\}\s*setLoading\(false\);\n  \}/, newFunc);
code = code.replace(/handleAprovarLoteParaCliente\(batchApprovalData\.itens\)/g, 'handleAprovarLoteParaCliente(batchApprovalData.itens, batchScheduleDate)');

fs.writeFileSync('src/components/AdminDashboard.tsx', code);
