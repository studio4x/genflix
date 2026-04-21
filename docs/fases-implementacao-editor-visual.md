# Fases de Implementacao do Editor Visual

## Objetivo
Evoluir o editor visual da GenFlix para um fluxo robusto, seguro e usavel por uma pessoa leiga em programacao, sem alterar o layout publico atual do site.

## Auditoria Inicial
### Ja existe hoje
- Edicao inline de texto.
- Edicao inline de imagem em pontos-chave.
- Edicao de listas com reordenacao e subitens.
- Preview rapido no modal.
- Estilos basicos de texto por campo.
- Upload de imagem no editor.
- Historico de versoes por override.
- Atalhos de teclado e protecao contra fechamento com alteracoes nao salvas.
- Painel administrativo de configuracao do editor.
- Edicao guiada de botoes e links com campos amigaveis.
- Controles de duplicar e ocultar elementos em listas.
- Edicao expandida em paginas institucionais, auth e rodape.
- Estrutura da home com blocos reordenaveis.
- Biblioteca de blocos para montar secoes da home.
- Duplicacao e ocultacao de secoes inteiras sem mexer no layout-base.

### Ainda falta ou esta incompleto
- Rascunho vs publicacao.
- Preview responsivo desktop/tablet/mobile.
- Biblioteca de blocos prontos para outras paginas alem da home.
- Permissoes por perfil e fluxo de aprovacao.
- Comentarios internos.
- SEO por pagina.
- Biblioteca de midia e ajustes de recorte/foco.
- Assistencia por IA para revisar e gerar conteudo.

## Fases

### [x] Fase 1 - Fundacao para Usuario Leigo
Status: concluida

Escopo:
- Organizar este roadmap no repositorio.
- Validar o que ja existia antes de implementar.
- Tornar o painel administrativo mais amigavel, com busca, filtros e menos dependencia de leitura tecnica.
- Criar visao operacional mais clara por pagina e por campo.
- Manter o layout do site publico intacto.

Entregas:
- Documento de fases e status.
- Busca por campos no admin.
- Filtros por tipo e status.
- Modo basico e avancado no admin.
- Preview resumido do conteudo salvo.
- Acesso mais direto para abrir a pagina selecionada.

### [x] Fase 2 - Edicao Guiada de Conteudo
Status: concluida

Escopo:
- Expandir os pontos editaveis no front.
- Reduzir ainda mais o uso de JSON.
- Incluir edicao guiada de links, botoes, cards, FAQ, colunas, formularios e rodape.

Entregas:
- Mais componentes com `EditableText`, `EditableImage`, `EditableList` e `EditableRichText`.
- Formularios guiados para links, botoes e cards.
- Controles para duplicar e ocultar elementos.
- Paginas institucionais com campos editaveis estruturados.
- Páginas de autenticacao com conteudo lateral guiado pelo editor.
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
- Gerenciador de estrutura da home separado da edicao de conteudo.
- Prefixos proprios para blocos duplicados da home, evitando colidir com o conteudo original.

### [ ] Fase 4 - Midia, Responsividade e SEO
Status: pendente

Escopo:
- Dar autonomia operacional para imagens, visual mobile e configuracoes de pagina.

Entregas previstas:
- Preview desktop/tablet/mobile.
- Biblioteca de midia reutilizavel.
- Ajuste de foco/recorte de imagem.
- SEO por pagina: titulo, descricao, slug e imagem social.

### [ ] Fase 5 - Publicacao Segura e Colaboracao
Status: pendente

Escopo:
- Separar edicao de publicacao e criar seguranca operacional.

Entregas previstas:
- Rascunho vs publicado.
- Desfazer/refazer.
- Comentarios internos.
- Fluxo de aprovacao.
- Permissoes por perfil.

### [ ] Fase 6 - Assistencia Inteligente
Status: pendente

Escopo:
- Ajudar usuarios leigos a escrever melhor e cometer menos erros.

Entregas previstas:
- IA para reescrever, resumir e sugerir CTA.
- Alertas de contraste, legibilidade e excesso de texto.
- Sugestoes de consistencia visual e editorial.

## Regra Operacional
- Ao concluir uma fase, marcar como concluida neste arquivo.
- Ao final de cada fase, confirmar se o usuario deseja avancar para a proxima.
- Antes de iniciar qualquer fase nova, revisar o estado atual do editor para evitar retrabalho ou duplicacao de funcionalidade.
