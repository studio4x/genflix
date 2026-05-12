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

[OK] T24 - Criar aba “Operações” para monitorar status da fila de e-mails, crons, jobs e outros processos críticos.

[OK] T24.2 - Enviar notificação para o e-mail configurado do admin, quando um novo formulário for preenchido. Essa notificação deverá aparecer na aba de "notificações da plataforma".

[OK] T24.3 - Na aba de Operações, ajuste o card "fila de e-mails" para ele ocupar 100% a largura do container. Os demais cards que hoje estão na coluna ao lado devem ficar divididos em 3 colunas, abaixo do card fila de e-mails"

---

## CHAT 7 — Cookies, rastreamento e eventos

[OK] T25 - Implementar banner de aceitação de cookies.

[OK] T26 - Implementar painel de preferências de cookies.

[OK] T27 - Criar aba no admin/configurações para inserir Google Tag Manager, Meta Pixel e códigos customizados no header, body e footer.

[OK] T28 - Criar validação básica para verificar se GTM e Meta Pixel foram configurados.

[OK] T29 - Garantir disparo correto dos principais eventos da plataforma.

---

## CHAT 8 — Checkout: confirmação e eventos

[OK] T30 - Criar página de confirmação de inscrição após checkout concluído com sucesso.

[OK] T31 - Na página de confirmação, inserir botão para acessar diretamente o curso comprado.

[OK] T32 - Preparar a página de confirmação para disparo de evento purchase no Google Ads e Meta Ads.

---

## CHAT 9 — Checkout: página intermediária e compra

[OK] T33 - Na página do curso, remover campos de nome e e-mail, deixando apenas botão “Comprar agora”.

[OK] T34 - Criar página intermediária de checkout baseada no arquivo `modelo.checkout.html`.

[OK] t34.5 - Na página pública do curso, ao clicar no botão de comprar agora, aparece a mensagem "Entre na sua conta GenFlix para iniciar a compra com segurança.". Não deve funcionar assim. Ao clicar nesse botão, a página de checkout deverá ser aberta. Nessa página do checkout deverá ter a opção de fazer login caso já tenha um cadastro criado, ou então inserir os dados: Nome completo, e-mail, confirmar e-mail, CPF e um campo para aceitar os termos e condições (inserir um link com modal para ele). Deverá ter também um botão de "ir para pagamento" para então o checkout do asaas ser aberto.

[OK] T34.6 - Solicitei o reembolso de um pedido no painel do aluno.. apareceu como "estorno pendente". No asaas, o pedido não teve alteração.. No painel do admin, aparece como estorno pendente, porém, não tenho como concluir o reembolso. Quando um reembolso for solicitado pelo usuário, se estiver dentro de 7 dias, faça o reembolso automaticamente. O botão de reembolso só deve estar disponivel em até 7 dias após a realização do pedido.

[OK] t34.7 - Na seção de endereço dentro da página de checkout, quando eu insiro o cep, os campos do endereço são preenchidos corretamente e a cor do campo ficam todos iguais, como se realmente estivesse com conteúdo inserido. Isso está OK. Porém, no campo de Número, a cor do campo deverá ser branco e deverá ter um placeholder em vermelho escrito "insira o número aqui..". No campo de Complemento, mantenha o placeholder atual e só mude a cor do campo para branco...
---

## CHAT 10 — Pagamento

[OK] T35 - Desativar pagamento via Pix.

[OK] T36 - Manter pagamento somente por cartão de crédito.

[OK] T37 - Configurar parcelamento sem juros em até 3x, com parcela mínima de R$ 50. Acima de 3x, inserir juros.

[OK] T37.5 - Na página do curso, abaixo do valor do curso, insira o texto "em até 12x no cartão". Utilize uma fonte compatível com a fonte do valor para não se sobressair mais que o valor do curso.

---

## CHAT 11 — Editor de conteúdo de curso

[OK] T38 - Alterar editor de texto dos módulos para seguir `docs/lesson-rich-text-blocks-spec.md`.

[OK] T39 - Alterar editor de texto das aulas para seguir `docs/lesson-rich-text-blocks-spec.md`.

[OK] T39.5 - Inserir a opção de inserir colunas nos blocos de conteúdos das aulas.. (add 1 coluna, add 2 colunas, add 3 colunas, etc)

---

## CHAT 12 — Blog

[OK] T40 - Criar módulo de Blog no admin e na área pública. Use como referência de criação o arquivo "SPEC_BLOG.md". Não implemente as funcionalidades de criação/revisão de conteúdo com IA.

---

## CHAT 13 — Contato

[OK] T43 - No formulário de contato, adicionar campo “Reinsira seu e-mail”.

[OK] T44 - Validar se os dois campos de e-mail do formulário de contato são iguais.

[OK] T44.2 - Criar uma página com um formulário para os produtores de cursos poderem publicar o curso dele. O formulário deve ser apenas para enviar os dados iniciais. Vamos adicionar no rodapé, na coluna "fale conosco", o menu "Ensine na Genflix".

---

## CHAT 14 — Newsletter

[OK] T45 - Na página de contato, inserir seção de newsletter acima do rodapé.

[OK] T46 - Na newsletter, permitir selecionar áreas de estudo de interesse.

[OK] T47 - Na newsletter, incluir opção “Todas as áreas”.

[OK] T48 - No admin/formulários, adicionar filtro para separar inscritos por área de interesse.

---

## CHAT 15 — Página “Ensine na GenFlix”

[OK] T49 - Criar página acessada pelo botão “Ensine na GenFlix” no rodapé.

[OK] T50 - AJustar o formulário  da página "ensine na genflix" com a inclusão dos campos: repetir e-mail (com validação de e-mails iguais) e assunto do curso (antes do campo "resumo da proposta).

[OK] T51 - Validar se os dois campos de e-mail são iguais.

[OK] T51.2 - o FUNDO DA PÁGINA https://genflix-omega.vercel.app/indique-a-genflix DEVERÁ SER BRANCO.

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

---

## Chat 18 - Ajustes Gerais

[OK] T63 - poder mostrar a senha nos campos de senha. Isso é bom para quem usa senhas complexas como eu, é velho e digita mal.

[OK] T64 - Implemente o módulo de FAQ/Ajuda para criar as perguntas e respostas diretamente pelo painel admin. Importe as perguntas frequentes já existentes nesse módulo. Utilize o arquivo "SPEC_FAQ.md" como referência de implementação.

[OK] T65 - O layout da página https://genflix-omega.vercel.app/privacidade está com a estrutura diferente das demais páginas do site, a página está no formato box. AJuste esta página.

[OK] T66 - NA TAREFA [T16] foi implementada a funcionalidade de expandir e recoelher todos, porém, a ideia que eu quero mesmo, é que cada item tenha a opção de clicar para recolher ele mas manter o titulo do item aparecendo, exatamente igual a um acordeão/sanfona.
---

## Chat 19 - Ajustes Gerais

[ ] T67 - Implementar a Comunidade

[OK] T68 - Centralizar horizontalmente os cards da seção da home "Cursos por área de conhecimento"

[OK] T69 - Na pagina "admin/site-editor", no card de Biblioteca de icones, insira a opção de subir icones SVG manualmente (um a um) e também subir vários icones de uma vez, adotando como nome do Icone, o nome do arquivo. Mova esa seção de biblioteca de icones para uma aba dentro da página "admin/site-editor"


[OK] T70 - No card do curso que esta no grid, insirir um fundo na categoria do curso. Ref.: <div class="absolute left-4 top-4 rounded-[2px] bg-[#EBF3F5]/92 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#15323B]">Saúde</div> Deixar as bordas arredondadas.

[OK] T71 - No editor visual, para o tipo "content" e estrutura "blocos de conteúdo", deve ter a possibilidade a ajustar fonte, tamanhos e todos os outros elementos disponiveis para o tipo "text".

[OK] T71.2 - no editor visual, os campos de conteúdo de texto (todos os tipos), devem ter editor rico igual aos campos de textos do construtor de curso, na página de edição das aulas...

[OK] T72 - Inserir no editor, a possibilidade de adicionar/alterar colunas no conteúdo das páginas...

[OK] T73 - Inserir a posisibilidade de adicionar imagens no editor dos textos dentro do editor visual.

[OK] T74 - Inserir a possibilidade de excluir um conteúdo da página via editor visual.

## Chat 20 - Ajustes Gerais
[OK] T75 - Na página de cursos, os botões do filtro deverão corresponder às categorias reais dos cursos adicionados.

[OK] T76 - Ajustar alinhamento dos elementos do banner "veja em detakhes...". Inserir possibilidade de excluir o campo de e-mail.

[OK] T77 - Elimitar a sombra do contorno do rodapé.

[ ] T78 - Alterar o layout do blog para ser igual ao da zapflix.

[OK] T79 - A Abertura de ticket, só deverá ser permitida para usuário logado. Remover da página de suporte, a primeira seção de sla publico e o botão de abrir ticket. Inserir uma faq para inserir o acesso ao suporte via ticket.

[ ] T80 - Implementar chatbot igual da homecarematch.

[OK] T81 - no admin, na pagina de criar faq, mova o botão de salvar para o painel de detalhes.

[OK] T82 - no admin, na página de faz, insira a opção de adicionar nova categoria dentro da aba de categorias.

[OK] T83 - Inserir a possibilidade de inserir uma seção de bonus na página do curso. Essa inserção será pela página "pagina publica do curso" dentro do construtor de curso.  Na pagina publica do curso, esse bonus deverá aparecer abaixo do botão comprar. Ex.: quadro "Prévia de conteúdo"

[OK] T84 - ALTERAR A COR DO FUNDO DA SEÇÃO "CUYRSOS POR AREA DE CONHECIMENTO" NA HOME. INSERIR AZUL CLARO.

[OK] t85 - Na página recursos, o editor visual deverá ter a opção de trocar/inserir icones no quadros existentes. Além disso, precisamos implementar um botão para abrir um video de instrução. Precisa também adicionar na página admin uma página para inserir os videos de cada recurso.. Os recursos que não tiverem videos adicionados, não aparecerá o botão de ver video.

[ ] T86 - Ajustar a narração das aulas

## Chat 21 - Ajustes Gerais

[OK] T87 - Na visualização da aula pelo visualizador de cursos, o video inserido deverá ocupar apenas 70% da largura do container, assim o video não fica com tamanho excessivo e não fica cortado na tela.

[OK] T88 - Inserir na página "/admin/site-editor", uma aba para definir globalmente as tipografias do site.. A ideia é criar um padrão de tamanho, fonte, espessura de texto entre outras definições para os titulos (h1, h2, h3, etc), corpo de texto, tópicos, links, etc.

[OK] T89 - Tirar definitamente a sombra retangular do rodapé. Na coluna Mídias sociais, retirar o texto "nos siga em". Remover o formato de botão das redes sociais (remover a borda e o espaçamento ao redor do nome da midia social).

[OK] t90 - Na seção da home "conheça os muitos recursos didáticos que só a genflix tem.", a url do botão a ser adotada deve ser a que for configurado no editor visual.

[OK] t91 - No rodapé, inserir na quarta coluna (a ultima da direito), um botão "Ensine na Genflix" e direcionar para a página "https://genflix-omega.vercel.app/ensine-na-genflix".

[OK] t92 - Permitir editar o fundo das seções/blocos pelo editor visual. Permitir alterar imagens pelo editor visual também. Permitir editar os paddings e margens da página como um todo..


## Chat 22 - Ajustes Gerais

[OK] T93 - A página "ensine na genflix" deverá ter o mesmo layout da página contato, usar o mesmo formulário de contato também. Porém no admin, deverá ter uma identificação para diferenciar os forms enviados em cada página.

[ ] t94 - No formulário da "assine nossa newsletter", remover as ´´areas: "psicanalise/psicologia" e "interesse geral". Habilite o editor visual para os textos dessa seção, inclusive o formulário.

[ ] t95 - Precisamos implementar na página "https://genflix-omega.vercel.app/indique-a-genflix" uma forma da pessoa compartilhar a plataforma copiando um link de compartilhamento, compartilhar também pelo whatsapp e um formulário para inserir os dados de alguém que ela queira que conheça a plataforma, e ao clicar em enviar, dever´´a ser enviado um e-mail para a pessoa dizendo que fulano de tal inseriu o contato dela na plataforma genflix para que ela conhecesse.

[ ] t96 - No editor de texto, na funcionalidade de colunas, inserir a possibilidade de ajustar a largura de cada coluna.

[ ] t97 - A seção de newsletter deverá estar desvinculada da seção da home que tem o botão que leva a página de recursos.

[ ] t98 - ao clicar para editar nos cards de recursos na página de recursos, permitir editar as bordas dos cards. se alterar um, altera todos. permitir alterar também a curvatura das bordas. Todos os elementos devem ser carregados recolhidos. No editor da descrição, inserir a possibilidade de definir a cor e tamanho dos textos, de modo geral para todos os cards, sem precisar ajustar o html de cada um.

[ ] t99 - Nos recursos, inserir no painel admin, na página de videos dos recursos, inserir a possibilidade de inserir um botão de leia mais e então inserir um conteúdo nesse leia mais. quando ativado essa opção, abrir um campo para inserir o campo de leia mais. na página publica, o botão de leia mais deverá abrir um modal com esse conteudo.

[ ] t100 - Nos recursos, ao editar os icones pelo editor visual, quando selecione uma cor de icone, o icone some.. e se eu deixar a cor padrão, que é azul, o icone fica na cor preta...

[ ] t101 - Na página do admin, devemos inserir dentro da página "admin/cursos", uma aba para configurar as categorias dos cursos. AS categorias deverá ser um crud. Para eu poder criar, editar e remover categorias e também poder selecionar em cada curso a qual categoria ele pertence. Na página pública de cursos, as categorias que devem aparecer lá são as categorias que foram criadas.

---

## CHAT 21 — Checklist final

[ ] T52 - Criar um documento de checklist com tudo o que já foi implementado, descrevendo em detalhes. Esse documento será usado para validar o que foi implementado, testar todas as funcionalidades disponíveis e identificar se ainda falta algo para implementar.
