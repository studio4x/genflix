# Especificação do módulo `/admin/tutoriais`

Documento de referência para replicar o módulo de tutoriais do painel admin da Genflix em outra plataforma.

Objetivo desta especificação:
- Reproduzir a estrutura completa do módulo, incluindo CRUD, leitura, ordenação, busca, filtro, preview, drawer flutuante e persistência local.
- Manter o comportamento e a hierarquia de telas o mais próximo possível do módulo atual.
- Não copiar o conteúdo textual dos tutoriais em si. O que deve ser replicado é o sistema, a estrutura e as regras de funcionamento.

Não objetivo deste documento:
- Reescrever o módulo com outro fluxo.
- Trocar a experiência por uma tabela simples ou por um CRUD genérico sem preview.
- Remover o widget flutuante do admin.
- Transformar o módulo em algo dependente de backend se a intenção for espelhar o comportamento atual da Genflix.

## 1. Visão geral do módulo

O módulo de tutoriais é um CRUD client-side para organizar guias curtos de apoio ao admin.

Ele combina 3 camadas de experiência:
- Uma página completa em `/admin/tutoriais` para listar, criar, editar, excluir, filtrar, buscar e reordenar tutoriais.
- Um painel flutuante em formato drawer que fica disponível dentro de todo o layout admin.
- Uma área de visualização interna na própria página para ler o tutorial selecionado sem sair da lista.

O comportamento atual é propositalmente híbrido:
- A leitura rápida acontece no widget flutuante.
- A gestão completa acontece na página.
- O mesmo conteúdo é usado nas duas superfícies.

## 2. Integração com o app

### 2.1 Rota

A página principal do módulo é carregada por rota lazy:
- `path: /admin/tutoriais`
- componente: `AdminTutorialsPage`

### 2.2 Layout admin

O módulo não vive isolado. Ele é encaixado no layout do admin:
- `AdminTutorialsProvider` envolve todo o conteúdo do admin.
- `AdminTutorialsFloatingPanel` é renderizado no final do layout, acima de tudo, independente da página admin atual.

Isso significa que o widget flutuante deve aparecer em qualquer tela do admin, não apenas na página de tutoriais.

### 2.3 Navegação lateral

Existe um item de menu no grupo de plataforma:
- label: `Tutoriais`
- destino: `/admin/tutoriais`

## 3. Stack e dependências

O módulo atual usa:
- React hooks.
- `react-router-dom` para navegação.
- `@hello-pangea/dnd` para arrastar e soltar a ordem dos tutoriais.
- `lucide-react` para ícones.
- `RichTextEditor` para edição do conteúdo rico dos passos.
- `sanitizeRichTextHtml` para limpar e normalizar HTML antes de salvar e renderizar.
- `Button` do design system interno.

Se a plataforma destino tiver outra base técnica, a regra é preservar o comportamento, mesmo que a implementação interna mude.

## 4. Modelo de dados

### 4.1 Tipos

O módulo trabalha com estes modelos:

```ts
type AdminTutorialStep = {
  title: string;
  description: string;
};

type AdminTutorial = {
  id: string;
  title: string;
  summary: string;
  estimatedMinutes: number;
  category: string;
  steps: AdminTutorialStep[];
  notes: string[];
};

type AdminTutorialDraft = Omit<AdminTutorial, 'id'> & {
  id?: string;
};
```

### 4.2 Significado dos campos

- `id`: identificador único estável do tutorial.
- `title`: título principal exibido em cards, drawer e preview.
- `summary`: resumo curto do que o tutorial ensina.
- `estimatedMinutes`: tempo estimado de leitura em minutos.
- `category`: categoria livre para agrupamento e filtro.
- `steps`: lista ordenada de passos do tutorial.
- `notes`: lista de observações rápidas exibidas como dicas.

### 4.3 Estrutura dos passos

Cada passo precisa ter:
- `title`
- `description`

O `description` é conteúdo rico em HTML sanitizado. Ele não é texto puro.

## 5. Persistência e bootstrap

### 5.1 Chave de armazenamento

O módulo atual persiste tudo em `localStorage` com a chave:
- `genflix-admin-tutorials`

### 5.2 Regra de carregamento

Ao inicializar:
- Se estiver em SSR ou fora do browser, usar a lista padrão embutida.
- Se não houver dados salvos, usar a lista padrão embutida.
- Se houver dados salvos, normalizar os dados e mesclar com os tutoriais padrão que estiverem faltando.

### 5.3 Regra de normalização

Ao carregar do storage ou ao salvar um draft:
- remover campos inválidos;
- garantir strings sem espaços nas extremidades;
- garantir que `estimatedMinutes` seja número;
- garantir que exista ao menos 1 passo;
- garantir que exista ao menos 1 nota;
- sanitizar o HTML do passo.

### 5.4 Regra de merge com os defaults

Se um tutorial padrão existir no código e não existir no storage, ele deve ser adicionado automaticamente.

Isso evita que a experiência fique sem os tutoriais-base do módulo quando o storage local estiver incompleto.

### 5.5 Regra de deleção

Ao excluir um tutorial:
- o item sai da lista persistida;
- se o tutorial excluído era o selecionado, o sistema escolhe outro tutorial seguro;
- se a exclusão deixar a lista vazia, o módulo volta para a lista padrão.

## 6. Provider e estado global

O provider do módulo centraliza o estado compartilhado entre página e drawer.

### 6.1 Estado mantido

- `tutorials`: lista atual de tutoriais.
- `activeTutorialId`: id do tutorial ativo no widget.
- `isDrawerOpen`: controla se o drawer está aberto.
- `isDrawerMinimized`: controla se o drawer foi minimizado.

### 6.2 Tutorial ativo

O tutorial ativo é calculado com fallback nesta ordem:
- tutorial com `activeTutorialId`;
- primeiro item da lista;
- primeiro tutorial padrão.

### 6.3 Funções expostas

O contexto expõe estas ações:
- `openTutorial(tutorialId?)`
- `closeDrawer()`
- `minimizeDrawer()`
- `restoreDrawer()`
- `selectTutorial(tutorialId)`
- `addTutorial(tutorialDraft)`
- `updateTutorial(tutorialId, tutorialDraft)`
- `deleteTutorial(tutorialId)`
- `reorderTutorials(tutorialIds)`

### 6.4 Regras de cada ação

`openTutorial`:
- define o tutorial ativo;
- abre o drawer;
- garante que ele não fique minimizado.

`selectTutorial`:
- troca o tutorial ativo;
- abre o drawer;
- remove estado minimizado.

`closeDrawer`:
- fecha o drawer;
- remove minimização.

`minimizeDrawer`:
- fecha a vista expandida do drawer;
- marca o drawer como minimizado.

`restoreDrawer`:
- reabre o drawer;
- remove minimização.

`addTutorial`:
- normaliza o draft;
- cria um id único se o draft não trouxer id;
- adiciona no fim da lista;
- persiste;
- abre o drawer no item criado.

`updateTutorial`:
- normaliza o draft;
- substitui o item correspondente;
- persiste;
- abre o drawer no item atualizado.

`deleteTutorial`:
- remove o item correspondente;
- persiste a nova lista;
- se o item removido era o ativo, escolhe um fallback.

`reorderTutorials`:
- reorganiza a lista exatamente na ordem recebida;
- ignora ids inexistentes;
- persiste a nova ordem.

## 7. Página `/admin/tutoriais`

A página é a experiência principal de administração do conteúdo.

Ela é dividida em 4 blocos:
- hero de topo;
- área de listagem com busca/filtro/ordenação;
- área de preview da página;
- modal de criação/edição.

## 8. Hero superior

### 8.1 Função

O hero explica o propósito do módulo e cria o ponto de entrada para o CRUD.

### 8.2 Conteúdo

O hero deve conter:
- badge de contexto do módulo;
- título forte;
- texto de apoio explicando que a área reúne guias rápidos para o admin;
- botão principal para criar novo tutorial.

### 8.3 Ação principal

Botão:
- texto: `NOVO TUTORIAL`
- ação: abrir modal em modo criação

## 9. Feedback de operação

Depois de salvar um tutorial, a página exibe uma mensagem de feedback em faixa destacada.

Comportamento:
- aparece após salvar com sucesso;
- também pode ser usado para avisos simples do fluxo;
- fica acima da listagem;
- é textual e temporal, não persistente.

## 10. Lista de tutoriais

### 10.1 Função da lista

A lista precisa permitir:
- ver todos os tutoriais cadastrados;
- buscar por texto;
- filtrar por categoria;
- selecionar um item;
- abrir o item no preview da página;
- abrir o item no drawer;
- editar;
- excluir;
- reordenar por drag and drop.

### 10.2 Barra de busca

O campo de busca:
- procura em `title`, `summary` e `category`;
- é case-insensitive;
- usa `trim()` no termo;
- afeta a lista imediatamente.

### 10.3 Filtro por categoria

O filtro:
- é um `select`;
- começa em `all`;
- usa as categorias encontradas na lista atual;
- mostra as categorias em ordem alfabética com locale `pt-BR`.

### 10.4 Limpar filtros

O botão de limpar filtros aparece somente quando:
- existe texto na busca, ou
- a categoria selecionada não é `all`.

Ao clicar:
- limpa a busca;
- volta a categoria para `all`.

### 10.5 Contador

A interface exibe um contador do tipo:
- `X de Y tutoriais`

Onde:
- `X` é a quantidade filtrada;
- `Y` é o total de tutoriais.

### 10.6 Estado quando não há resultado

Se a busca/filtro não retornar itens:
- mostrar mensagem de estado vazio;
- não renderizar cards de lista.

## 11. Ordenação por drag and drop

### 11.1 Quando a ordenação é permitida

O reorder só fica ativo quando:
- a busca está vazia;
- a categoria selecionada é `all`.

Se houver qualquer filtro, a listagem vira apenas leitura.

### 11.2 Ação de arrastar

Cada item ordenável tem:
- alça de arraste com ícone de grip;
- `aria-label` descrevendo o tutorial que pode ser movido.

### 11.3 Regras do `onDragEnd`

Ao soltar:
- se não houver destino, não fazer nada;
- se a posição final for igual à inicial, não fazer nada;
- se houve movimento, recalcular a ordem e persistir.

### 11.4 Comportamento visual

Enquanto arrasta:
- o card ganha destaque visual;
- o background fica mais claro;
- a sombra muda para indicar que o item está em movimento.

## 12. Card de tutorial na lista

Cada card mostra:
- categoria;
- título;
- resumo;
- tempo estimado;
- categoria novamente como tag;
- quantidade de passos;
- botões de ação.

### 12.1 Estado selecionado

O tutorial que está em exibição recebe marcação visual de seleção.

### 12.2 Ações por card

`Na página`:
- muda o tutorial selecionado;
- leva o usuário ao preview na parte inferior da página com `scrollIntoView({ behavior: 'smooth' })`.

`Widget`:
- abre o tutorial correspondente no drawer flutuante.

`Editar`:
- abre o modal já preenchido com os dados do tutorial.

`Excluir`:
- abre `window.confirm`.
- só remove se o usuário confirmar.

### 12.3 Seleção após exclusão

Se o tutorial excluído for o selecionado na página:
- o sistema escolhe o próximo item disponível;
- se não houver outro item, cai para vazio seguro.

## 13. Área de preview da página

O preview é uma segunda superfície de leitura dentro da própria página.

Ele deve reproduzir:
- título do tutorial selecionado;
- resumo;
- botões de ação rápida;
- passos em blocos numerados;
- lista de notas.

### 13.1 Botões do preview

`Abrir no widget`:
- abre o tutorial ativo no drawer.

`Editar tutorial`:
- abre o modal no modo edição.

### 13.2 Renderização dos passos

Cada passo é renderizado como:
- número circular;
- título do passo;
- HTML sanitizado da descrição.

### 13.3 Renderização das notas

As notas aparecem em lista com:
- ícone de seta;
- texto simples por item.

## 14. Modal de criação e edição

O modal é usado tanto para criar quanto para editar.

### 14.1 Abrir modal

O modal abre em duas situações:
- clique em `NOVO TUTORIAL`;
- clique em `Editar`.

### 14.2 Fechar modal

O modal fecha por:
- clique no fundo escurecido;
- clique no botão de fechar;
- clique em `Cancelar`;
- conclusão bem-sucedida do salvamento.

### 14.3 Estado inicial do formulário

Criação:
- título vazio;
- resumo vazio;
- categoria `Geral`;
- tempo `3`;
- notas vazias;
- 1 passo inicial vazio.

Edição:
- o formulário é preenchido a partir do tutorial atual;
- se o tutorial não tiver passos, a UI garante um passo inicial.

### 14.4 Campos do formulário

Campos principais:
- `Título`
- `Resumo`
- `Categoria`
- `Tempo`
- `Passos`
- `Dicas rápidas`

### 14.5 Regras de validação

Antes de salvar:
- `title` é obrigatório;
- `summary` é obrigatório.

Se faltar um dos dois:
- o formulário não salva;
- exibe feedback pedindo preenchimento.

### 14.6 Regras dos passos

Cada passo no formulário tem:
- título do passo;
- descrição rica.

Comportamento:
- é possível adicionar passos;
- é possível remover passos;
- não pode ficar sem nenhum passo visível, porque o sistema recria um passo vazio de segurança.

### 14.7 Editor rico

A descrição do passo usa editor rico com estas características:
- `simpleMode`;
- sem toggle de HTML bruto;
- suporta links, listas e formatação simples;
- produz HTML que depois será sanitizado.

### 14.8 Dicas rápidas

O campo de dicas rápidas:
- recebe texto multilinha;
- cada linha vira uma nota;
- linhas vazias são descartadas.

### 14.9 Salvamento

Ao salvar:
- normalizar título e resumo com `trim()`;
- converter `estimatedMinutes` para número;
- usar `Geral` se a categoria ficar vazia;
- sanitizar cada descrição de passo;
- manter pelo menos um passo;
- transformar as dicas em array de strings.

Depois do salvamento:
- atualizar a lista;
- selecionar o item salvo;
- abrir o tutorial salvo no widget;
- fechar o modal;
- limpar o formulário.

## 15. Drawer flutuante do admin

O widget flutuante é uma parte central da experiência.

Ele funciona como um leitor rápido de tutoriais e precisa existir em qualquer tela do admin.

### 15.1 Estados possíveis

O drawer tem 3 estados:
- fechado;
- aberto;
- minimizado.

### 15.2 Estado fechado

Quando fechado:
- aparece um botão flutuante no canto inferior direito;
- o botão mostra `Ajuda rápida` e o título do tutorial ativo;
- clicar abre o drawer com o tutorial ativo.

### 15.3 Estado aberto

Quando aberto:
- aparece uma camada de overlay escura atrás;
- clicar no overlay fecha o drawer;
- o painel fica preso ao canto superior direito;
- altura ocupa quase a tela inteira;
- contém cabeçalho, seleção de tutorial, conteúdo e rodapé.

### 15.4 Cabeçalho do drawer

O cabeçalho mostra:
- badge `Tutorial admin`;
- título do tutorial ativo;
- resumo do tutorial ativo;
- botões de minimizar e fechar.

### 15.5 Seleção de tutorial

O drawer tem um `select` com todos os tutoriais.

Ao trocar o select:
- o tutorial ativo muda;
- o drawer permanece aberto;
- o estado minimizado é removido.

### 15.6 Conteúdo do tutorial

O conteúdo no drawer exibe:
- título e resumo do tutorial;
- passos numerados;
- descrição rica sanitizada;
- bloco de dicas rápidas.

### 15.7 Rodapé do drawer

O rodapé contém:
- link para abrir a página completa em `/admin/tutoriais`;
- botão para minimizar o painel.

### 15.8 Estado minimizado

Quando minimizado:
- o drawer desaparece;
- aparece uma pílula flutuante no canto inferior direito;
- a pílula mostra o título do tutorial ativo;
- clicar nela restaura o painel aberto.

## 16. Sanitização de HTML

O módulo não deve renderizar HTML cru sem limpeza.

### 16.1 Onde a sanitização é aplicada

- na normalização dos dados carregados;
- na normalização dos drafts;
- na renderização do preview;
- na renderização do drawer.

### 16.2 Regra funcional

O HTML do passo precisa passar por `sanitizeRichTextHtml`.

O comportamento atual remove ou normaliza:
- scripts;
- estilos;
- handlers inline;
- atributos não permitidos;
- links inseguros.

### 16.3 Implicação para a plataforma destino

Se a nova plataforma tiver outro editor de rich text, ele precisa respeitar o mesmo contrato:
- salvar HTML limpo;
- renderizar HTML seguro;
- manter suporte a links e formatação básica.

## 17. Regras de UX e linguagem

Para espelhar a Genflix, a página deve seguir este tom:
- linguagem em português;
- comandos diretos;
- foco em operação;
- feedback claro de sucesso e erro;
- layout editorial, não corporativo genérico.

### 17.1 Labels relevantes

Alguns rótulos importantes do módulo atual:
- `Tutoriais do admin`
- `Conteúdos rápidos para executar tarefas sem perder tempo.`
- `NOVO TUTORIAL`
- `Tutoriais cadastrados`
- `Buscar tutorial`
- `Filtrar por categoria`
- `Limpar filtros`
- `Visualização na página`
- `Abrir no widget`
- `Editar tutorial`
- `Salvar tutorial`
- `Salvar alterações`

### 17.2 Comportamento textual

O feedback de sucesso deve ser do tipo:
- `Tutorial "<nome>" salvo com sucesso.`

O aviso de validação deve orientar o usuário a preencher título e resumo.

## 18. Estrutura visual

Para manter a fidelidade, a página usa:
- cartões grandes com cantos bem arredondados;
- fundo claro com variações de azul e verde-água;
- hero com gradiente escuro para azul;
- botões com raio alto;
- bastante respiro entre blocos;
- seções com bordas suaves;
- preview e drawer com blocos separados e consistentes.

Não é uma tela de tabela administrativa tradicional.
O comportamento visual é mais próximo de um painel editorial.

## 19. Casos de borda que precisam ser mantidos

- Se o storage vier vazio, usar defaults.
- Se os dados do storage estiverem quebrados, voltar para defaults.
- Se a lista filtrada ficar vazia, o estado vazio deve aparecer.
- Se o tutorial ativo sair da lista, escolher um fallback seguro.
- Se o usuário tentar salvar sem título ou resumo, bloquear o envio.
- Se todos os passos forem removidos no formulário, manter um passo vazio de segurança.
- Se a ordem for alterada, persistir a nova sequência imediatamente.

## 20. Critério de equivalência para a nova plataforma

A implementação na plataforma destino deve ser considerada equivalente quando:
- existir a rota de administração para tutoriais;
- existir a página com busca, filtro, reorder, criação, edição, exclusão e preview;
- existir o drawer flutuante global no admin;
- o conteúdo persistir por tutorial em formato estruturado;
- o rich text dos passos continuar sanitizado;
- a experiência de criação/edição usar o mesmo fluxo mental do painel atual.

## 21. Sugestão de implementação

Se a outra plataforma não tiver o mesmo stack, a ordem correta de reprodução é:
1. Criar o modelo de dados.
2. Implementar persistência equivalente ao `localStorage` atual ou backend compatível.
3. Criar o provider global com drawer e estado ativo.
4. Montar a página `/admin/tutoriais`.
5. Adicionar busca, filtro e reorder.
6. Implementar o modal de CRUD.
7. Adicionar preview da página.
8. Renderizar o drawer flutuante no layout.
9. Aplicar sanitização de HTML.
10. Validar que o comportamento de abertura, minimização e fallback está idêntico.

## 22. Observação final

Este módulo é intencionalmente simples no backend e rico na experiência de navegação.

Se a plataforma destino quiser manter a mesma usabilidade, o ponto mais importante não é só copiar os campos, mas preservar:
- o fluxo de leitura;
- a persistência local/isolada;
- a presença do widget flutuante;
- a possibilidade de reorganização manual;
- a reprodução do preview no próprio admin.

