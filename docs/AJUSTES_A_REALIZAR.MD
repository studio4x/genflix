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

[OK] T17 - Nos cards de curso da home, transformar o nome da categoria em badge com fundo no canto superior esquerdo.

[OK] T18 - Remover a borda do rodapé.

[OK] T19 - Permitir  edição da coluna de mídias sociais do rodapé no editor visual.

[OK] T20 - No rodapé, exibir ícones sociais na vertical, com ícone no início da linha e texto depois.

---

## CHAT 6 — Notificações e operações

[OK] T21 - Na página de notificações, permitir configurar o e-mail padrão que receberá notificações administrativas da plataforma.

[OK] T22 - Na página atual de notificações, exibir somente notificações enviadas manualmente.

[OK] T23 - Criar uma nova aba/página para listar todas as notificações enviadas pela plataforma, incluindo e-mails e notificações internas.

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

## Chat 17 - Ajustes no Header

[OK] T53 - no editor do header, precisamos pensar em algo para definir qual tipo de definição (da página ou global) tem prevalência... Penso que no editor do header da página, deve ter um toogle para selecionar "configurações desta página e configurações global". Ao seleciona da página, os ajustes serão apenas para a pagina aberta.. se for global, todos os campos de ajustes ficam inativos e a página assume as configurações globais. As definir as configurações do header para aquela página, essas definições devem de fato ficar salvos, sem ser sobrescritas pelas configurações globais. Precisamos também ter a opção de replicar configurações para desktop, tablet e mobile, ou então definir valores diferentes para cada.

[OK] T54 - Ao finalizar o editor, clicando no botão "sair da Edição", a página a ser editada deve ser recarregada limpando o cache.

[OK] T55 - A implementação feita na T54 não está surtindo efeito. ao sair do editor, realmente a tela recarregada, porém, os ajustes feitos não aparecem.. Se eu acessar de outro navegador, ai sim vejo os ajustes feitos.. Se eu acessar o admin e depois voltar para a página, eu também consigo ver os ajustes, mas, se eu recarrego a página após sair do admin, os ajustes somem.. Dev ter algum cache da página que ainda não foi limpo no navegador.

[OK] T56 - Nos campos do editor visual, principalmente do header, onde tem as dimensões em pixels, se eu inserir por exemplo "100", o ajuste não é feito e nenhuma mensagem de erro aparece.. Para funcionar tenho que inserir "100px". Vamos manter por padrão esses campos com pixel, sem precisar inserir o "px", e insira ao lado do campo, o texto "px" bem pequeno apenas para indicar a unidade de medida.

[OK] T57 - No editor do header, remova o card "preview rapido", ele não está servindo para nada.. Faça o card "editor Guiado" ocultar a largura toda do container. Remova também o card "Conteúdo".

[OK] T58 - As edições que faço no header global não estão sendo aplicadas à todas as páginas. Onde tem header inserido deve ser substituído pelo header global, com exceção das páginas que a configuração do header foi selecionada para "Esta página"

[OK] T59 - Implemente no site e no editor visual o pack de fontes do Google, para através do editor das páginas e do editor global, poder selecionar a fonte em cada texto que quer alterar/ajustar.

[OK] T60 - Além de editar os textos das páginas, insira também a possibilidade de inserir novos textos (bloco de textos). Isso deve ser aplicada em todas as páginas públicas, principalmente nas páginas: politica de privacidade, termos de uso, fsuporte, etc.

[OK] T61 - Na Tarefa T57 foi solicitado para remover também o card "conteúdo" do modal do editor. Ele ainda está aparecendo, não foi removido.

[OK] T62 -  Alguns botões do site, ao clicar para editar no editor visual, não estão sendo identificados como botão, mas sim como texto, ex.: Botão de "Acessar painel/entrar" no header, "Ver todos os recursos" na página de cursos, entre outros; Faça os botões abrirem como botões no editor visual.


## Chat 18 - Ajustes Gerais

[OK] T63 - poder mostrar a senha nos campos de senha. Isso é bom para quem usa senhas complexas como eu, é velho e digita mal.

[OK] T64 - Implemente o módulo de FAQ/Ajuda para criar as perguntas e respostas diretamente pelo painel admin. Importe as perguntas frequentes já existentes nesse módulo. Utilize o arquivo "SPEC_FAQ.md" como referência de implementação.

[OK] T65 - O layout da página https://genflix-omega.vercel.app/privacidade está com a estrutura diferente das demais páginas do site, a página está no formato box. AJuste esta página.

[OK] T66 - NA TAREFA [T16] foi implementada a funcionalidade de expandir e recoelher todos, porém, a ideia que eu quero mesmo, é que cada item tenha a opção de clicar para recolher ele mas manter o titulo do item aparecendo, exatamente igual a um acordeão/sanfona.
---





Política de privacidade e Termos de uso têm estrutura de conteúdo pronta, mas o corpo principal ainda está hardcoded no código, não totalmente via CMS/editor.
Não existe

Lista visual de fontes para seleção no editor.
Fluxo totalmente padronizado para inserir todo o texto de páginas legais diretamente pelo editor sem editar código.
Se quiser, eu também posso transformar isso em uma mensagem mais “comercial”, em linguagem de atendimento ao cliente.
