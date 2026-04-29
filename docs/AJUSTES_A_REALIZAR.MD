# AJUSTES_A_REALIZAR — organizado por chats

## CHAT 0 — Retomada

[OK] T0 - A ultima execucao foi pausada. Analisei o que foi solicitado e registrei abaixo o que faltou implementar. Nao implementei nenhuma feature neste item.

---

## CHAT 1 — Banners

[OK] T1 - Permitir ajustar altura dos banners no editor, separando desktop e mobile.

[OK] T2 - Permitir ajustar tipografia dos textos dos banners: fonte, tamanho, peso, espaçamento e alinhamento.

[OK] T3 - Corrigir divergência entre editor e frontend dos banners: posição, largura e espaçamento dos elementos devem refletir exatamente o configurado.

[OK] T4 - Alterar posicionamento dos elementos do banner para usar distância em relação às bordas, em vez de porcentagem.

[OK] T5 - Adicionar setas de navegação nos banners, funcionando em desktop e mobile.

---

## CHAT 2 — Editor visual: estrutura e controles básicos

[OK] T6 - Permitir modificar cores e dimensões dos elementos no editor visual.

[OK] T7 - Criar padrão de botões no editor visual e permitir trocar o estilo dos botões existentes.

[OK] T11 - Remover do editor visual os cards: Assistência editorial, Atalhos, Schema salvo e Conteúdo estruturado JSON.

[OK] T16 - Permitir recolher e expandir todos os elementos da página do editor visual.

[OK] T16.5 - No card "conteudo e imagem", insira no campo "preset visual" a opção de não inserir overlay.

---

## CHAT 3 — Editor visual: seções, ícones e alinhamento

[OK] T8 - Permitir criar, editar e deletar áreas/seções do site, incluindo título, ícone e cor.

[OK] T12 - Permitir upload de ícones nos cards que já possuem ícones.

[OK] T13 - Criar biblioteca de ícones no admin para uso nos elementos do site.

[OK] T14 - Permitir trocar ícones existentes por ícones da biblioteca.

[OK] T15 - Permitir alinhar texto/conteúdo nas seções editadas pelo editor visual.

---

## CHAT 4 — Editor visual: header e cards

[OK] T9 - Permitir ajustar o header pelo editor visual: tamanho da logo, altura do header, cores do menu, tipografia do menu e cor de fundo por página ou global.

[OK] T10 - Permitir ajustar cards de grids de conteúdos, como a seção “Muito além do vídeo” na home.

---

## CHAT 5 — Home e layout público

[ ] T17 - Nos cards de curso da home, transformar o nome da categoria em badge com fundo no canto superior esquerdo.

[ ] T18 - Remover a borda do rodapé.

[ ] T19 - Corrigir edição da coluna de mídias sociais do rodapé no editor visual.

[ ] T20 - No rodapé, exibir ícones sociais na vertical, com ícone no início da linha e texto depois.

---

## CHAT 6 — Notificações e operações

[ ] T21 - Na página de notificações, permitir configurar o e-mail padrão que receberá notificações administrativas da plataforma.

[ ] T22 - Na página atual de notificações, exibir somente notificações enviadas manualmente.

[ ] T23 - Criar uma nova aba/página para listar todas as notificações enviadas pela plataforma, incluindo e-mails e notificações internas.

[ ] T24 - Criar aba “Operações” para monitorar status da fila de e-mails, crons, jobs e outros processos críticos.

---

## CHAT 7 — Cookies, rastreamento e eventos

[ ] T25 - Implementar banner de aceitação de cookies.

[ ] T26 - Implementar painel de preferências de cookies.

[ ] T27 - Criar aba no admin/configurações para inserir Google Tag Manager, Meta Pixel e códigos customizados no header, body e footer.

[ ] T28 - Criar validação básica para verificar se GTM e Meta Pixel foram configurados.

[ ] T29 - Garantir disparo correto dos principais eventos da plataforma.

---

## CHAT 8 — Checkout: confirmação e eventos

[ ] T30 - Criar página de confirmação de inscrição após checkout concluído com sucesso.

[ ] T31 - Na página de confirmação, inserir botão para acessar diretamente o curso comprado.

[ ] T32 - Preparar a página de confirmação para disparo de evento purchase no Google Ads e Meta Ads.

---

## CHAT 9 — Checkout: página intermediária e compra

[ ] T33 - Na página do curso, remover campos de nome e e-mail, deixando apenas botão “Comprar agora”.

[ ] T34 - Criar página intermediária de checkout baseada no arquivo `modelo.checkout.html`.

---

## CHAT 10 — Pagamento

[ ] T35 - Desativar pagamento via Pix.

[ ] T36 - Manter pagamento somente por cartão de crédito.

[ ] T37 - Configurar parcelamento sem juros em até 3x, com parcela mínima de R$ 50.

---

## CHAT 11 — Editor de conteúdo de curso

[ ] T38 - Alterar editor de texto dos módulos para seguir `docs/lesson-rich-text-blocks-spec.md`.

[ ] T39 - Alterar editor de texto das aulas para seguir `docs/lesson-rich-text-blocks-spec.md`.

---

## CHAT 12 — Blog

[ ] T40 - Criar módulo de Blog no admin e na área pública.

[ ] T41 - Usar como referência a spec de blog da HomeCare Match.

[ ] T42 - Remover qualquer funcionalidade de IA do módulo de Blog.

---

## CHAT 13 — Contato

[ ] T43 - No formulário de contato, adicionar campo “Reinsira seu e-mail”.

[ ] T44 - Validar se os dois campos de e-mail do formulário de contato são iguais.

---

## CHAT 14 — Newsletter

[ ] T45 - Na página de contato, inserir seção de newsletter acima do rodapé.

[ ] T46 - Na newsletter, permitir selecionar áreas de estudo de interesse.

[ ] T47 - Na newsletter, incluir opção “Todas as áreas”.

[ ] T48 - No admin/formulários, adicionar filtro para separar inscritos por área de interesse.

---

## CHAT 15 — Página “Ensine na GenFlix”

[ ] T49 - Criar página acessada pelo botão “Ensine na GenFlix” no rodapé.

[ ] T50 - Criar formulário com os campos: nome completo, e-mail, repetir e-mail e assunto do curso.

[ ] T51 - Validar se os dois campos de e-mail são iguais.

---

## CHAT 16 — Checklist final

[ ] T52 - Criar um documento de checklist com tudo o que já foi implementado, descrevendo em detalhes. Esse documento será usado para validar o que foi implementado, testar todas as funcionalidades disponíveis e identificar se ainda falta algo para implementar.

---



