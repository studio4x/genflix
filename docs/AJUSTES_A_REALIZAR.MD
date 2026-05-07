# AJUSTES_A_REALIZAR â€” organizado por chats

## CHAT 0 â€” Retomada

[OK] T0 - A ultima execucao foi pausada. Analisei o que foi solicitado e registrei abaixo o que faltou implementar. Nao implementei nenhuma feature neste item.

---

## CHAT 1 â€” Banners

[OK] T1 - Permitir ajustar altura dos banners no editor, separando desktop e mobile.

[OK] T2 - Permitir ajustar tipografia dos textos dos banners: fonte, tamanho, peso, espaÃ§amento e alinhamento.

[OK] T3 - Corrigir divergÃªncia entre editor e frontend dos banners: posiÃ§Ã£o, largura e espaÃ§amento dos elementos devem refletir exatamente o configurado.

[OK] T4 - Alterar posicionamento dos elementos do banner para usar distÃ¢ncia em relaÃ§Ã£o Ã s bordas, em vez de porcentagem.

[OK] T5 - Adicionar setas de navegaÃ§Ã£o nos banners, funcionando em desktop e mobile.

---

## CHAT 2 â€” Editor visual: estrutura e controles bÃ¡sicos

[OK] T6 - Permitir modificar cores e dimensÃµes dos elementos no editor visual.

[OK] T7 - Criar padrÃ£o de botÃµes no editor visual e permitir trocar o estilo dos botÃµes existentes.

[OK] T11 - Remover do editor visual os cards: AssistÃªncia editorial, Atalhos, Schema salvo e ConteÃºdo estruturado JSON.

[OK] T16 - Permitir recolher e expandir todos os elementos da pÃ¡gina do editor visual.

[OK] T16.5 - No card "conteudo e imagem", insira no campo "preset visual" a opÃ§Ã£o de nÃ£o inserir overlay.

---

## CHAT 3 â€” Editor visual: seÃ§Ãµes, Ã­cones e alinhamento

[OK] T8 - Permitir criar, editar e deletar Ã¡reas/seÃ§Ãµes do site, incluindo tÃ­tulo, Ã­cone e cor.

[OK] T12 - Permitir upload de Ã­cones nos cards que jÃ¡ possuem Ã­cones.

[OK] T13 - Criar biblioteca de Ã­cones no admin para uso nos elementos do site.

[OK] T14 - Permitir trocar Ã­cones existentes por Ã­cones da biblioteca.

[OK] T15 - Permitir alinhar texto/conteÃºdo nas seÃ§Ãµes editadas pelo editor visual.

---

## CHAT 4 â€” Editor visual: header e cards

[OK] T9 - Permitir ajustar o header pelo editor visual: tamanho da logo, altura do header, cores do menu, tipografia do menu e cor de fundo por pÃ¡gina ou global.

[OK] T10 - Permitir ajustar cards de grids de conteÃºdos, como a seÃ§Ã£o â€œMuito alÃ©m do vÃ­deoâ€ na home.

---

## CHAT 5 â€” Home e layout pÃºblico

[OK] T17 - Nos cards de curso da home, transformar o nome da categoria em badge com fundo no canto superior esquerdo.

[OK] T18 - Remover a borda do rodapÃ©.

[OK] T19 - Permitir  ediÃ§Ã£o da coluna de mÃ­dias sociais do rodapÃ© no editor visual.

[OK] T20 - No rodapÃ©, exibir Ã­cones sociais na vertical, com Ã­cone no inÃ­cio da linha e texto depois.

---

## CHAT 6 â€” NotificaÃ§Ãµes e operaÃ§Ãµes

[OK] T21 - Na pÃ¡gina de notificaÃ§Ãµes, permitir configurar o e-mail padrÃ£o que receberÃ¡ notificaÃ§Ãµes administrativas da plataforma.

[OK] T22 - Na pÃ¡gina atual de notificaÃ§Ãµes, exibir somente notificaÃ§Ãµes enviadas manualmente.

[OK] T23 - Criar uma nova aba/pÃ¡gina para listar todas as notificaÃ§Ãµes enviadas pela plataforma, incluindo e-mails e notificaÃ§Ãµes internas.

[OK] T24 - Criar aba â€œOperaÃ§Ãµesâ€ para monitorar status da fila de e-mails, crons, jobs e outros processos crÃ­ticos.

[OK] T24.2 - Enviar notificaÃ§Ã£o para o e-mail configurado do admin, quando um novo formulÃ¡rio for preenchido. Essa notificaÃ§Ã£o deverÃ¡ aparecer na aba de "notificaÃ§Ãµes da plataforma".

[OK] T24.3 - Na aba de OperaÃ§Ãµes, ajuste o card "fila de e-mails" para ele ocupar 100% a largura do container. Os demais cards que hoje estÃ£o na coluna ao lado devem ficar divididos em 3 colunas, abaixo do card fila de e-mails"

---

## CHAT 7 â€” Cookies, rastreamento e eventos

[OK] T25 - Implementar banner de aceitaÃ§Ã£o de cookies.

[OK] T26 - Implementar painel de preferï¿½ncias de cookies.

[OK] T27 - Criar aba no admin/configuraï¿½ï¿½es para inserir Google Tag Manager, Meta Pixel e cï¿½digos customizados no header, body e footer.

[OK] T28 - Criar validaï¿½ï¿½o bï¿½sica para verificar se GTM e Meta Pixel foram configurados.

[ ] T29 - Garantir disparo correto dos principais eventos da plataforma.

---

## CHAT 8 â€” Checkout: confirmaÃ§Ã£o e eventos

[OK] T30 - Criar pÃ¡gina de confirmaÃ§Ã£o de inscriÃ§Ã£o apÃ³s checkout concluÃ­do com sucesso.

[OK] T31 - Na pÃ¡gina de confirmaÃ§Ã£o, inserir botÃ£o para acessar diretamente o curso comprado.

[OK] T32 - Preparar a pÃ¡gina de confirmaÃ§Ã£o para disparo de evento purchase no Google Ads e Meta Ads.

---

## CHAT 9 â€” Checkout: pÃ¡gina intermediÃ¡ria e compra

[OK] T33 - Na pÃ¡gina do curso, remover campos de nome e e-mail, deixando apenas botÃ£o â€œComprar agoraâ€.

[OK] T34 - Criar pÃ¡gina intermediÃ¡ria de checkout baseada no arquivo `modelo.checkout.html`.

[OK] t34.5 - Na pÃ¡gina pÃºblica do curso, ao clicar no botÃ£o de comprar agora, aparece a mensagem "Entre na sua conta GenFlix para iniciar a compra com seguranÃ§a.". NÃ£o deve funcionar assim. Ao clicar nesse botÃ£o, a pÃ¡gina de checkout deverÃ¡ ser aberta. Nessa pÃ¡gina do checkout deverÃ¡ ter a opÃ§Ã£o de fazer login caso jÃ¡ tenha um cadastro criado, ou entÃ£o inserir os dados: Nome completo, e-mail, confirmar e-mail, CPF e um campo para aceitar os termos e condiÃ§Ãµes (inserir um link com modal para ele). DeverÃ¡ ter tambÃ©m um botÃ£o de "ir para pagamento" para entÃ£o o checkout do asaas ser aberto.

[OK] T34.6 - Solicitei o reembolso de um pedido no painel do aluno.. apareceu como "estorno pendente". No asaas, o pedido nÃ£o teve alteraÃ§Ã£o.. No painel do admin, aparece como estorno pendente, porÃ©m, nÃ£o tenho como concluir o reembolso. Quando um reembolso for solicitado pelo usuÃ¡rio, se estiver dentro de 7 dias, faÃ§a o reembolso automaticamente. O botÃ£o de reembolso sÃ³ deve estar disponivel em atÃ© 7 dias apÃ³s a realizaÃ§Ã£o do pedido.

[OK] t34.7 - Na seÃ§Ã£o de endereÃ§o dentro da pÃ¡gina de checkout, quando eu insiro o cep, os campos do endereÃ§o sÃ£o preenchidos corretamente e a cor do campo ficam todos iguais, como se realmente estivesse com conteÃºdo inserido. Isso estÃ¡ OK. PorÃ©m, no campo de NÃºmero, a cor do campo deverÃ¡ ser branco e deverÃ¡ ter um placeholder em vermelho escrito "insira o nÃºmero aqui..". No campo de Complemento, mantenha o placeholder atual e sÃ³ mude a cor do campo para branco...
---

## CHAT 10 â€” Pagamento

[OK] T35 - Desativar pagamento via Pix.

[OK] T36 - Manter pagamento somente por cartÃ£o de crÃ©dito.

[OK] T37 - Configurar parcelamento sem juros em atÃ© 3x, com parcela mÃ­nima de R$ 50. Acima de 3x, inserir juros.

[OK] T37.5 - Na pÃ¡gina do curso, abaixo do valor do curso, insira o texto "em atÃ© 12x no cartÃ£o". Utilize uma fonte compatÃ­vel com a fonte do valor para nÃ£o se sobressair mais que o valor do curso.

---

## CHAT 11 â€” Editor de conteÃºdo de curso

[ ] T38 - Alterar editor de texto dos mÃ³dulos para seguir `docs/lesson-rich-text-blocks-spec.md`.

[ ] T39 - Alterar editor de texto das aulas para seguir `docs/lesson-rich-text-blocks-spec.md`.

[ ] T39.5 - Inserir a opÃ§Ã£o de inserir colunas nos blocos de conteÃºdos das aulas.. (add 1 coluna, add 2 colunas, add 3 colunas, etc)

---

## CHAT 12 â€” Blog

[OK] T40 - Criar mÃ³dulo de Blog no admin e na Ã¡rea pÃºblica. Use como referÃªncia de criaÃ§Ã£o o arquivo "SPEC_BLOG.md". NÃ£o implemente as funcionalidades de criaÃ§Ã£o/revisÃ£o de conteÃºdo com IA.

---

## CHAT 13 â€” Contato

[OK] T43 - No formulÃ¡rio de contato, adicionar campo â€œReinsira seu e-mailâ€.

[OK] T44 - Validar se os dois campos de e-mail do formulÃ¡rio de contato sÃ£o iguais.

[OK] T44.2 - Criar uma pÃ¡gina com um formulÃ¡rio para os produtores de cursos poderem publicar o curso dele. O formulÃ¡rio deve ser apenas para enviar os dados iniciais. Vamos adicionar no rodapÃ©, na coluna "fale conosco", o menu "Ensine na Genflix".

---

## CHAT 14 â€” Newsletter

[OK] T45 - Na pÃ¡gina de contato, inserir seÃ§Ã£o de newsletter acima do rodapÃ©.

[OK] T46 - Na newsletter, permitir selecionar Ã¡reas de estudo de interesse.

[ ] T47 - Na newsletter, incluir opÃ§Ã£o â€œTodas as Ã¡reasâ€.

[ ] T48 - No admin/formulÃ¡rios, adicionar filtro para separar inscritos por Ã¡rea de interesse.

---

## CHAT 15 â€” PÃ¡gina â€œEnsine na GenFlixâ€

[OK] T49 - Criar pÃ¡gina acessada pelo botÃ£o â€œEnsine na GenFlixâ€ no rodapÃ©.

[OK] T50 - AJustar o formulÃ¡rio  da pÃ¡gina "ensine na genflix" com a inclusÃ£o dos campos: repetir e-mail (com validaÃ§Ã£o de e-mails iguais) e assunto do curso (antes do campo "resumo da proposta).

[OK] T51 - Validar se os dois campos de e-mail sÃ£o iguais.

[OK] T51.2 - o FUNDO DA PÁGINA https://genflix-omega.vercel.app/indique-a-genflix DEVERÁ SER BRANCO.

---

## CHAT 16 â€” Checklist final

[ ] T52 - Criar um documento de checklist com tudo o que jÃ¡ foi implementado, descrevendo em detalhes. Esse documento serÃ¡ usado para validar o que foi implementado, testar todas as funcionalidades disponÃ­veis e identificar se ainda falta algo para implementar.

---

## Chat 17 - Ajustes no Header

[OK] T53 - no editor do header, precisamos pensar em algo para definir qual tipo de definiÃ§Ã£o (da pÃ¡gina ou global) tem prevalÃªncia... Penso que no editor do header da pÃ¡gina, deve ter um toogle para selecionar "configuraÃ§Ãµes desta pÃ¡gina e configuraÃ§Ãµes global". Ao seleciona da pÃ¡gina, os ajustes serÃ£o apenas para a pagina aberta.. se for global, todos os campos de ajustes ficam inativos e a pÃ¡gina assume as configuraÃ§Ãµes globais. As definir as configuraÃ§Ãµes do header para aquela pÃ¡gina, essas definiÃ§Ãµes devem de fato ficar salvos, sem ser sobrescritas pelas configuraÃ§Ãµes globais. Precisamos tambÃ©m ter a opÃ§Ã£o de replicar configuraÃ§Ãµes para desktop, tablet e mobile, ou entÃ£o definir valores diferentes para cada.

[OK] T54 - Ao finalizar o editor, clicando no botÃ£o "sair da EdiÃ§Ã£o", a pÃ¡gina a ser editada deve ser recarregada limpando o cache.

[OK] T55 - A implementaÃ§Ã£o feita na T54 nÃ£o estÃ¡ surtindo efeito. ao sair do editor, realmente a tela recarregada, porÃ©m, os ajustes feitos nÃ£o aparecem.. Se eu acessar de outro navegador, ai sim vejo os ajustes feitos.. Se eu acessar o admin e depois voltar para a pÃ¡gina, eu tambÃ©m consigo ver os ajustes, mas, se eu recarrego a pÃ¡gina apÃ³s sair do admin, os ajustes somem.. Dev ter algum cache da pÃ¡gina que ainda nÃ£o foi limpo no navegador.

[OK] T56 - Nos campos do editor visual, principalmente do header, onde tem as dimensÃµes em pixels, se eu inserir por exemplo "100", o ajuste nÃ£o Ã© feito e nenhuma mensagem de erro aparece.. Para funcionar tenho que inserir "100px". Vamos manter por padrÃ£o esses campos com pixel, sem precisar inserir o "px", e insira ao lado do campo, o texto "px" bem pequeno apenas para indicar a unidade de medida.

[OK] T57 - No editor do header, remova o card "preview rapido", ele nÃ£o estÃ¡ servindo para nada.. FaÃ§a o card "editor Guiado" ocultar a largura toda do container. Remova tambÃ©m o card "ConteÃºdo".

[OK] T58 - As ediÃ§Ãµes que faÃ§o no header global nÃ£o estÃ£o sendo aplicadas Ã  todas as pÃ¡ginas. Onde tem header inserido deve ser substituÃ­do pelo header global, com exceÃ§Ã£o das pÃ¡ginas que a configuraÃ§Ã£o do header foi selecionada para "Esta pÃ¡gina"

[OK] T59 - Implemente no site e no editor visual o pack de fontes do Google, para atravÃ©s do editor das pÃ¡ginas e do editor global, poder selecionar a fonte em cada texto que quer alterar/ajustar.

[OK] T60 - AlÃ©m de editar os textos das pÃ¡ginas, insira tambÃ©m a possibilidade de inserir novos textos (bloco de textos). Isso deve ser aplicada em todas as pÃ¡ginas pÃºblicas, principalmente nas pÃ¡ginas: politica de privacidade, termos de uso, fsuporte, etc.

[OK] T61 - Na Tarefa T57 foi solicitado para remover tambÃ©m o card "conteÃºdo" do modal do editor. Ele ainda estÃ¡ aparecendo, nÃ£o foi removido.

[OK] T62 -  Alguns botÃµes do site, ao clicar para editar no editor visual, nÃ£o estÃ£o sendo identificados como botÃ£o, mas sim como texto, ex.: BotÃ£o de "Acessar painel/entrar" no header, "Ver todos os recursos" na pÃ¡gina de cursos, entre outros; FaÃ§a os botÃµes abrirem como botÃµes no editor visual.

---

## Chat 18 - Ajustes Gerais

[OK] T63 - poder mostrar a senha nos campos de senha. Isso Ã© bom para quem usa senhas complexas como eu, Ã© velho e digita mal.

[OK] T64 - Implemente o mÃ³dulo de FAQ/Ajuda para criar as perguntas e respostas diretamente pelo painel admin. Importe as perguntas frequentes jÃ¡ existentes nesse mÃ³dulo. Utilize o arquivo "SPEC_FAQ.md" como referÃªncia de implementaÃ§Ã£o.

[OK] T65 - O layout da pÃ¡gina https://genflix-omega.vercel.app/privacidade estÃ¡ com a estrutura diferente das demais pÃ¡ginas do site, a pÃ¡gina estÃ¡ no formato box. AJuste esta pÃ¡gina.

[OK] T66 - NA TAREFA [T16] foi implementada a funcionalidade de expandir e recoelher todos, porÃ©m, a ideia que eu quero mesmo, Ã© que cada item tenha a opÃ§Ã£o de clicar para recolher ele mas manter o titulo do item aparecendo, exatamente igual a um acordeÃ£o/sanfona.
---

## Chat 19 - Ajustes Gerais

[ ] T67 - Implementar a Comunidade

[OK] T68 - Centralizar horizontalmente os cards da seÃ§Ã£o da home "Cursos por Ã¡rea de conhecimento"

[ ] t69 - Na pagina "admin/site-editor", no card de Biblioteca de icones, insira a opÃ§Ã£o de subir icones SVG manualmente (um a um) e tambÃ©m subir vÃ¡rios icones de uma vez, adotando como nome do Icone, o nome do arquivo. Mova esa seÃ§Ã£o de biblioteca de icones para uma aba dentro da pÃ¡gina "admin/site-editor"


[ ] t70 - No card do curso que esta no grid, insirir um fundo na categoria do curso. Ref.: <div class="absolute left-4 top-4 rounded-[2px] bg-[#EBF3F5]/92 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#15323B]">SaÃºde</div> Deixar as bordas arredondadas.

[ ] T71 - No editor visual, para o tipo "content" e estrutura "blocos de conteÃºdo", deve ter a possibilidade a ajustar fonte, tamanhos e todos os outros elementos disponiveis para o tipo "text".

[ ] T72 - Inserir no editor, a possibilidade de adicionar/alterar colunas no conteÃºdo das pÃ¡ginas...

[ ] T73 - Inserir a posisibilidade de adicionar imagens no editor dos textos dentro do editor visual.

[ ] T74 - Inserir a possibilidade de excluir um conteÃºdo da pÃ¡gina via editor visual.

[ ] T75 - Na pÃ¡gina de cursos, os botÃµes do filtro deverÃ£o corresponder Ã s categorias reais dos cursos adicionados.

[ ] T76 - Ajustar alinhamento dos elementos do banner "veja em detakhes...". Inserir possibilidade de excluir o campo de e-mail.

[ ] T77 - Elimitar a sombra do contorno do rodapÃ©.

[ ] T78 - Alterar o layout do blog para ser igual ao da zapflix.

[ ] T79 - A Abertura de ticket, sÃ³ deverÃ¡ ser permitida para usuÃ¡rio logado. Remover da pÃ¡gina de suporte, a primeira seÃ§Ã£o de sla publico e o botÃ£o de abrir ticket. Inserir uma faq para inserir o acesso ao suporte via ticket.

[ ] T80 - Implementar chatbot igual da homecarematch.

[ ] T81 - no admin, na pagina de criar faq, amova o botÃ£o de salvar para o painel de detalhes.

[ ] T82 - no admin, na pÃ¡gina de faz, insira a opÃ§Ã£o de adicionar nova categoria dentro da aba de categorias.

[ ] T83 - Inserir a possibilidade de inserir uma seÃ§Ã£o de bonus na pÃ¡gina do curso. Essa inserÃ§Ã£o serÃ¡ pela pÃ¡gina "pagina publica do curso" dentro do construtor de curso.  Na pagina publica do curso, esse bonus deverÃ¡ aparecer abaixo do botÃ£o comprar. Ex.: quadro "PrÃ©via de conteÃºdo"

[OK] T84 - ALTERAR A COR DO FUNDO DA SEÃ‡ÃƒO "CUYRSOS POR AREA DE CONHECIMENTO" NA HOME. INSERIR AZUL CLARO.

[ ] t85 - Na pÃ¡gina recursos, o editor visual deverÃ¡ ter a opÃ§Ã£o de trocar/inserir icones no quadros existentes. AlÃ©m disso, precisamos implementar um botÃ£o para abrir um video de instruÃ§Ã£o. Precisa tambÃ©m adicionar na pÃ¡gina admin uma pÃ¡gina para inserir os videos de cada recurso.. Os recursos que nÃ£o tiverem videos adicionados, nÃ£o aparecerÃ¡ o botÃ£o de ver video.

