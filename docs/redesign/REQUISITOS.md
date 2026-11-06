# Redesign do EvertonCMI Portal — requisitos da cliente

Registro das decisões e pedidos de alteração para o redesign, para consulta quando a implementação no código começar.
Os mockups da fase 1 já implementados foram apagados. Restam só os do portal do cliente, ainda pendente, em `docs/redesign/mockups/`.

## Diretrizes gerais

- **Estilo:** inspirado no Pautta (pautta.app) e no ClickUp. Visual limpo e claro, ícones em quadradinhos coloridos, sem texto todo em maiúsculo nem negrito pesado.
- **Mudança gradual:** manter os mesmos itens de menu, nomes, seções e botões de hoje, porque a equipe já está acostumada.
- **Cores (marca Everton, tiradas de `public/logo.png`):**
  - Pêssego `#F9E2D2`: item ativo do menu, fundo dos ícones de título, contadores e destaques.
  - Cobre `#A25431`: ícones, textos e barras de progresso em cima do pêssego.
  - Oliva `#212013`: botões principais e texto.
  - Neutros quentes (fundo `#FAF8F6`, bordas `#EEE9E4`). Não usar o lilás do Pautta.
  - Cores de status continuam semânticas: laranja = ajuste, verde = aprovado, vermelho = atraso, azul = produção.
  - O portal do cliente usa a `cor_marca` de cada cliente (white-label).
- **Sem textos imperativos** do tipo "Coloque o link bruto e delegue para o decupador" abaixo dos títulos. Usar informação neutra ("5 roteiros · 2 clientes") ou nada.
- **Sem abreviação "p/"** nos textos (ex.: "Enviar lote para o cliente").
- **Sem scroll gigante:** páginas longas viram subpáginas na sidebar.

## Sidebar

- **Visão geral** fica dentro de Planejamento, como primeira subpágina.
- **Planejamento** abre subitens, cada um com página própria: Roteiros em análise, Roteiros aprovados, Em decupagem, Problemas, Material decupado e Criação manual.
- **Relatórios** abre subitens: Resumo, Equipe, Clientes e Tarefas atrasadas.
- **Nova aba "Cores do tema"** com seletor universal de cores (ver abaixo).
- **Sai a área "Tags" da sidebar.** As tags são criadas no próprio lugar onde serão usadas (ver Tarefas).

## Tarefas (vale para TODAS as listas de tarefas/planners)

- **Linhas em colunas, estilo ClickUp:** à direita de cada tarefa ficam as colunas Responsáveis, Status e Data de entrega. Sem a data embaixo do título.
- **Sem botão "Editar" em cada linha.** Clicar na tarefa abre a tela do material, com a edição dentro.
- **Botões de ação só com ícone,** mesmo tamanho, com o texto aparecendo como tooltip ao passar o mouse. Ex.: "Enviar lote para o cliente" e "Enviar para o cliente" ficam do mesmo tamanho.
- **Sem tag automática de rede social** (ex.: "Instagram") embaixo do título.
- **Sistema universal de tags,** igual ao ClickUp: qualquer tarefa ou projeto aceita tags. Ao passar o mouse aparece o ícone de tag, e a tag é aplicada manualmente e salva.
- **Criação de tag no local:** ao clicar no ícone de tag de uma tarefa abre o seletor com o botão "Criar tag" no topo (nome + cor) e, abaixo, todas as tags existentes para marcar ou desmarcar. A tag criada já é aplicada na tarefa. A exclusão de uma tag também fica nesse seletor.
- **Subtarefas:** botão de criar subtarefa em toda tarefa/planner (aparece ao passar o mouse, junto com o de tag), com contador de subtarefas concluídas.
- **Sem botão "Criar tarefa"** no cabeçalho das páginas de Planejamento, porque ele foi substituído pelo "Criar subtarefa" em cada tarefa. No cabeçalho fica só "Importar do ClickUp".
- **Tarefa aberta (clique na tarefa):** mostra o roteiro do vídeo já pronto para editar, com botão Salvar, mais os campos Responsáveis, Status, Entrega, Tags e Subtarefas.

## Telas específicas

### Planejamento › Roteiros em análise / Roteiros aprovados
- Aplicar todas as regras de "Tarefas" acima. Roteiros aprovados segue exatamente o mesmo padrão.
- Ações por tarefa em ícone: em análise = Enviar para o cliente. Aprovados = Link bruto e Delegar decupador.
- O agrupamento por cliente ainda está em análise. Opções em `sugestao1.png` (clientes à esquerda), `sugestao2.png` (lista única estilo ClickUp) e `sugestao3.png` (quadro por cliente).

### Materiais para aprovação (Aprovação interna)
- Sem botão "Ver material": o material abre clicando na miniatura. Quando a demanda tem dois arquivos (vídeo + capa), mostrar duas miniaturas, cada uma clicável.
- Responsáveis (Editor/Designer) saem de baixo do título e vão para a direita, onde ficava "Ver material".
- Embaixo do título entram ícones de prontidão dos arquivos (vídeo pronto, capa pronta ou pendente).
- "Aprovar lote para o cliente" só com ícone e tooltip.
- Clicar na tarefa abre o roteiro do vídeo editável, com botão Salvar.

### Relatórios
- A cliente não entendeu os botões "Ciclo 10" e "Imprimir". Eles foram trocados por rótulos explícitos: "Período: Ciclo 10 · Outubro" e "Baixar PDF".

### Cores do tema (nova)
- Seletor universal da cor de destaque, que vale para o sistema inteiro. Tem paletas prontas (Everton pêssego como padrão) e cor personalizada por HEX.
- Escolha de modo Claro, Escuro ou Automático.
- Prévia ao vivo, com "Restaurar padrão" e "Salvar".

### Cadastro do cliente
- A página mostra só a lista de clientes em cards (sem "Cor do portal" no card). O formulário abre em modal pelo botão "Novo cliente" ou "Editar".

### Portal do cliente
- Conversa por material com texto, **áudio e imagens** (pedido da cliente). Ela substitui o campo de texto de ajuste e o histórico concatenado.
- Seletor "Sobre: Vídeo / Capa" no envio, "Versão N" no material e botão do WhatsApp mantido.

### Solicitação de ajustes
- Vira lista de pedidos + a mesma conversa do portal, do lado da equipe. Permite responder o cliente (texto, áudio, imagem) e escrever nota interna, que só a equipe vê.
- Filtros Abertos/Resolvidos e botão "Enviar nova versão".

## Pendências técnicas identificadas (para a fase de código)

- **Português de Portugal:** há textos e datas em pt-PT ("A Editar Cliente", "Guardar", "a aguardar", `toLocaleDateString('pt-PT')`). Padronizar para pt-BR.
- **Ações escondidas no hover:** algumas só aparecem com hover e são invisíveis no celular. Precisam de alternativa para toque.
- **Animações:** remover os `animate-pulse` dos selos de atraso e aprovação.
- **Modo escuro:** precisa de versão escura do novo visual.
- **Chat com áudio e imagem:** exige tabela de mensagens, bucket no Supabase Storage e tela de resposta no admin. Hoje o feedback é um campo de texto concatenado e o ajuste é notificado no chat do ClickUp.
- **Tags universais e subtarefas:** exigem modelagem no banco. Hoje as tags existem só em `materiais.tags` e não há subtarefas.
- **Arquivo grande:** `AdminDashboard.tsx` tem cerca de 4.600 linhas. Dividir por página ao implementar as subpáginas.

## Status da implementação

### Fase 1: visual (branch local `redesign-fase1`, sem commit e sem deploy)
Sem nenhuma alteração no banco de dados.

- [x] Paleta Everton em tokens: classes `brand-soft`, `brand` e `brand-ink` (variáveis `--brand-*` em `globals.css`), mais a escala `zinc` redefinida com cinzas quentes em `tailwind.config.ts`. O cobre fixo `#A25431` virou classe `brand`.
- [x] Fonte Inter.
- [x] Visual mais leve em todos os componentes: sem maiúsculo forçado, sem `font-black`, cantos menores e sem `animate-pulse`.
- [x] Sidebar clara: Visão geral primeiro, Planejamento e Relatórios com subpáginas (URL `?tab=...&sub=...`) e a aba Cores do tema.
- [x] Planejamento: uma página por etapa, tarefas em colunas (Responsáveis, Status, Entrega), botões só com ícone e tooltip, e "Criar tarefa" removido do cabeçalho.
- [x] Clique na tarefa abre um painel lateral com status, responsáveis, entrega, tags, miniaturas (vídeo/capa), o roteiro editável e Salvar. Ele substituiu o modal "Editar roteiro".
- [x] Tags: o ícone aparece no hover (no celular fica sempre visível). Usa o sistema de tags que já existe (`tags` + `materiais.tags`).
- [x] Aprovação interna: miniaturas clicáveis, indicadores de prontidão, responsáveis à direita e "Aprovar lote" só com ícone.
- [x] Solicitação de ajustes e Materiais aprovados no novo layout. O histórico de pedidos aparece em balões, só para leitura.
- [x] Visão geral: cards de métrica, etapas do fluxo clicáveis (levam à página da etapa) e filtros.
- [x] Cadastro do cliente: lista em cards e formulário em modal.
- [x] Relatórios divididos em Resumo, Equipe, Clientes e Tarefas atrasadas, com "Baixar PDF" (usa o layout de impressão que já existia).
- [x] Cores do tema: paletas prontas, cor personalizada e modo claro/escuro. **Por enquanto ficam salvas só no navegador** (localStorage).
- [x] Textos em pt-BR e sem "p/".
- [ ] Portal do cliente e painel do decupador: receberam só a passada global de estilo (sem maiúsculo, cores quentes). O layout novo completo do portal depende da conversa da fase 2.

### Ajustes do feedback em vídeo da cliente (03/11)
- [x] Menu no topo (computador) no lugar da sidebar; a gaveta lateral fica só no celular.
- [x] Botão de Configurações (engrenagem) com Cadastro do cliente, Cadastro da equipe, Relatórios, Cores do tema, modo escuro e sair.
- [x] Logo leva ao Início. "Visão geral" virou "Início" e é a página inicial.
- [x] Busca geral no topo: tarefas (todas as etapas, inclusive arquivadas), clientes e tags.
- [x] Início: cards de métrica mais finos, etapas numa faixa fina, sem a caixa de gargalo. As tarefas expandidas usam o layout novo (clique abre a tarefa, ações extras no menu de 3 pontinhos). "Avisar cliente" agora explica o que faz e pede confirmação.
- [x] Grupos de cliente começam fechados em todas as etapas.
- [x] Colunas com largura fixa (antes a coluna de ações variava e entortava as linhas). Tags menores, numa linha embaixo do título.
- [x] Ações secundárias no menu de 3 pontinhos em todas as listas.
- [x] Aprovação interna e Prontos para postar: miniaturas verticais (9:16). A prontidão de vídeo e capa virou um selo (✓ ou relógio) no canto da miniatura.
- [x] Cadastro do cliente em lista; o clique na linha abre os dados.
- [ ] Criação manual abrindo como roteiro (a cliente pediu para depois).

### Inspirado no Pautta (só visual)
- [x] Configurações virou uma página com abas: Clientes, Equipe, Relatórios e Cores do tema. A engrenagem do topo abre essa página; modo escuro e Sair viraram botões ao lado dela.
- [x] Equipe: lista simples (avatar, nome, função · e-mail, editar e remover). Novo/editar membro abre um modal com as seções Dados pessoais, Acesso e Integração. A função agora é trocada nesse modal (antes era um select direto na tabela).
- [x] Início: filtros por prazo Todos · Para hoje · Atrasadas · Futuras · Concluídas. "Concluídas" mostra os arquivados e substitui o antigo botão "Ver arquivados". Os filtros agora valem só no Início (antes o filtro escolhido vazava para as outras páginas).

### Fase 2: precisa de banco (usar um projeto Supabase de desenvolvimento, não a produção)
- [ ] Subtarefas (tabela nova).
- [ ] Conversa por material com texto, áudio e imagem, mais nota interna (tabela de mensagens + bucket no Storage + resposta pelo admin).
- [ ] Cores do tema salvas para a equipe toda (tabela de configurações).
- [ ] Filtro de período ("Período do relatório") nos Relatórios.

### Atenção: segurança do banco
Ao testar o redesign localmente, uma página aberta **sem login** conseguiu ler `clientes` e `materiais`. Isso indica que as políticas RLS do Supabase permitem leitura anônima nessas tabelas. Vale revisar as políticas antes ou junto com a fase 2.
