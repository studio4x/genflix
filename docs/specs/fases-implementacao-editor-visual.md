# Fases de Implementacao do Editor Visual

## Objetivo
Evoluir o editor visual da GenFlix para um fluxo robusto, seguro e usavel por uma pessoa leiga em programacao, sem alterar o layout pblico atual do site.

## Auditoria Inicial
### Ja existe hoje
- Edicao inline de texto.
- Edicao inline de imagem em pontos-chave.
- Edicao de listas com reordenacao e subitens.
- Preview rapido no modal.
- Estilos basicos de texto por campo.
- Upload de imagem no editor.
- Hist?rico de vers?oes por override.
- Atalhos de teclado e protecao contra fechamento com alteracoes n?o salvas.
- Painel administrativo de configura??o do editor.
- Edicao guiada de botoes e links com campos amigaveis.
- Controles de duplicar e ocultar elementos em listas.
- Edicao expandida em p?ginas institucionais, auth e rodape.
- Estrutura da home com blocos reordenaveis.
- Biblioteca de blocos para montar secoes da home.
- Duplicacao e ocultacao de secoes inteiras sem mexer no layout-base.
- Preview responsivo desktop, tablet e mobile dentro do editor.
- Biblioteca de midia reutilizavel com ativos ja enviados.
- Ajuste de foco e modo de corte para imagens editaveis.
- SEO editavel por rota publica com t?tulo, descri??o, slug e imagem social.
- Rascunho local por entrada antes da publica??o.
- Desfazer e refazer dentro da sessao de edicao.
- Comentarios internos por campo no workspace local.
- Fluxo local de revis?o, aprova??o e publica??o no editor.
- Camada inicial de permiss?es por perfil para o fluxo operacional.

### Ainda falta ou est? incompleto
- Biblioteca de blocos prontos para outras p?ginas alem da home.
- Fluxo colaborativo compartilhado entre usurios por backend, e n?o apenas por navegador.
- Assistencia por IA para revisar e gerar contedo.

## Fases

### [x] Fase 1 - Fundacao para Usurio Leigo
Status: concluida

Escopo:
- Organizar este roadmap no repositorio.
- Validar o que ja existia antes de implementar.
- Tornar o painel administrativo mais amigavel, com busca, filtros e menos dependencia de leitura tecnica.
- Criar visao operacional mais clara por p?gina e por campo.
- Manter o layout do site pblico intacto.

Entregas:
- Documento de fases e status.
- Busca por campos no admin.
- Filtros por tipo e status.
- Modo basico e avancado no admin.
- Preview resumido do contedo salvo.
- Acesso mais direto para abrir a p?gina selecionada.

### [x] Fase 2 - Edicao Guiada de Contedo
Status: concluida

Escopo:
- Expandir os pontos editaveis no front.
- Reduzir ainda mais o uso de JSON.
- Incluir edicao guiada de links, botoes, cards, FAQ, colunas, formularios e rodape.

Entregas:
- Mais componentes com `EditableText`, `EditableImage`, `EditableList` e `EditableRichText`.
- Formularios guiados para links, botoes e cards.
- Controles para duplicar e ocultar elementos.
- P?ginas institucionais com campos editaveis estruturados.
- Páginas de autentica??o com contedo lateral guiado pelo editor.
- Rodape com links guiados, suporte a ocultar item e CTA editavel sem depender de JSON cru.

### [x] Fase 3 - Blocos e Estrutura
Status: concluida

Escopo:
- Permitir montar e reorganizar secoes inteiras sem quebrar o layout base.

Entregas:
- Biblioteca de blocos prontos.
- Reordenacao de blocos.
- Duplicacao de blocos.
- Mostrar/ocultar secoes.
- Gerenciador de estrutura da home separado da edicao de contedo.
- Prefixos proprios para blocos duplicados da home, evitando colidir com o contedo original.

### [x] Fase 4 - Midia, Responsividade e SEO
Status: concluida

Escopo:
- Dar autonomia operacional para imagens, visual mobile e configura??es de p?gina.

Entregas:
- Preview desktop/tablet/mobile.
- Biblioteca de midia reutilizavel.
- Ajuste de foco/recorte de imagem.
- SEO por p?gina: t?tulo, descri??o, slug e imagem social.
- Aplicacao automtica de metadados SEO nas rotas publicas.

### [x] Fase 5 - Publicacao Segura e Colaboracao
Status: concluida

Escopo:
- Separar edicao de publica??o e criar seguran?a operacional.

Entregas:
- Rascunho vs publicado.
- Desfazer/refazer.
- Comentarios internos.
- Fluxo de aprova??o.
- Permissoes por perfil.
- Resumo operacional de governanca na tela admin do editor.

### [ ] Fase 6 - Assistencia Inteligente
Status: pendente

Escopo:
- Ajudar usurios leigos a escrever melhor e cometer menos erros.

Entregas previstas:
- IA para reescrever, resumir e sugerir CTA.
- Alertas de contraste, legibilidade e excesso de texto.
- Sugestoes de consistencia visual e editorial.

## Regra Operacional
- Ao concluir uma fase, marcar como concluida neste arquivo.
- Ao final de cada fase, confirmar se o usurio deseja avancar para a proxima.
- Antes de iniciar qualquer fase nova, revisar o est?do atual do editor para evitar retrabalho ou duplicacao de funcionalidade.
