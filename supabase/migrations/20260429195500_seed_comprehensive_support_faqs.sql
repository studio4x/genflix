begin;

delete from public.support_faqs;

insert into public.support_faqs (category_key, question, answer, sort_order, is_published)
values
  ('payment', 'Quais formas de pagamento a GenFlix aceita?', 'No momento, a plataforma trabalha com pagamento por cartao de credito. O fluxo de compra foi desenhado para ser direto, com foco em aprovacao rapida e acesso imediato quando o pagamento e confirmado.', 1, true),
  ('payment', 'Posso parcelar minha compra?', 'Sim. O checkout foi configurado para permitir parcelamento sem juros em ate 3x, respeitando a parcela minima prevista pela plataforma.', 2, true),
  ('payment', 'Como sei se meu pagamento foi aprovado?', 'Quando o pagamento e aprovado, o acesso ao curso fica disponivel na sua area do aluno. Se houver qualquer divergencia, confira se o cartao foi aceito pela operadora e abra um chamado com o comprovante.', 3, true),
  ('payment', 'O que fazer se o pagamento for recusado?', 'Revise os dados do cartao, saldo, limite e autorizacao do emissor. Se a recusa persistir, tente novamente com outro cartao ou entre em contato com o suporte informando a mensagem exibida.', 4, true),
  ('payment', 'A GenFlix trabalha com Pix?', 'Nao. A plataforma foi padronizada para manter o pagamento apenas por cartao de credito.', 5, true),
  ('payment', 'Como funciona reembolso ou cancelamento?', 'As regras de reembolso seguem a pagina publica de Politica de Reembolso. Quando houver necessidade, a equipe valida o caso e o contexto da compra antes de orientar o procedimento.', 6, true),
  ('payment', 'Recebi o comprovante, mas nao vejo o acesso liberado. E agora?', 'Acesse a area do aluno e recarregue a pagina. Se a liberacao nao acontecer em alguns minutos, envie o comprovante, o e-mail da conta e o nome do curso para conferirmos a matricula.', 7, true),

  ('account', 'Como criar minha conta na GenFlix?', 'Voce pode criar sua conta na pagina de cadastro e concluir o acesso com e-mail e senha. Depois disso, a plataforma libera a area do aluno e o historico de compras.', 8, true),
  ('account', 'Como recuperar minha senha?', 'Use a pagina de recuperar senha para solicitar um novo link de acesso. Se o e-mail nao chegar, verifique spam e lixo eletronico antes de pedir suporte.', 9, true),
  ('account', 'Posso mostrar ou ocultar minha senha ao digitar?', 'Sim. Os campos de senha da plataforma permitem alternar a visibilidade para facilitar o preenchimento, principalmente quando a senha e mais complexa.', 10, true),
  ('account', 'Como altero meus dados de perfil?', 'Na area da conta voce consegue ajustar nome, idioma, fuso e outros dados basicos de cadastro. Se precisar alterar algo mais sensivel, o suporte pode orientar o procedimento adequado.', 11, true),
  ('account', 'Onde vejo minhas notificacoes?', 'As notificacoes aparecem no centro de notificacoes da plataforma e tambem podem chegar por e-mail, de acordo com a configuracao da conta e do tipo de evento.', 12, true),
  ('account', 'Como acesso o historico de mensagens e chamados?', 'Quando voce estiver autenticado, a area de suporte mostra o historico dos chamados e das conversas associadas. Isso ajuda a acompanhar respostas sem perder contexto.', 13, true),
  ('account', 'Esqueci o e-mail usado no cadastro. O que faco?', 'Se voce nao lembrar o e-mail do cadastro, entre em contato com o suporte informando nome completo e qualquer dado de compra que ajude a localizar a conta.', 14, true),

  ('technical', 'A aula nao carrega ou trava. Como proceder?', 'Atualize a pagina, teste outro navegador e confirme sua conexao. Se o problema continuar, informe o curso, modulo e aula para que a equipe consiga reproduzir o erro.', 15, true),
  ('technical', 'Nao consigo abrir anexos ou materiais da aula.', 'Verifique se o material foi liberado para a turma e tente novamente em outro navegador. Se ainda falhar, envie um print com a mensagem exibida para analisarmos.', 16, true),
  ('technical', 'O video esta sem som ou com playback instavel. O que posso fazer?', 'Confirme o volume do navegador, teste fones ou alto-falantes e recarregue a pagina. Em alguns casos, limpar cache e cookies tambem ajuda a resolver.', 17, true),
  ('technical', 'Como encontro uma aula dentro do curso?', 'A trilha do curso e organizada por modulo e aula. Use o menu lateral do player ou a lista da area do curso para navegar diretamente ate o conteudo desejado.', 18, true),
  ('technical', 'Consigo assistir em celular ou tablet?', 'Sim. A interface publica, o player de aulas e a area do aluno foram pensados para funcionar em desktop e mobile, mantendo a leitura e a navegacao responsivas.', 19, true),
  ('technical', 'Nao estou conseguindo concluir uma avaliacao. O que verificar?', 'Revise se a pagina nao ficou em segundo plano, se o navegador nao bloqueou a submissao e se a conexao esta estavel. Se o erro persistir, abra um chamado com detalhes da tentativa.', 20, true),
  ('technical', 'A busca nao encontrou resultados. Isso significa que nao existe o conteudo?', 'Nao necessariamente. A busca tenta localizar o termo nas perguntas cadastradas. Se nada aparecer, use palavras parecidas ou abra um chamado para pedir orientacao especifica.', 21, true),

  ('general', 'Onde encontro as perguntas frequentes da plataforma?', 'A pagina publica de suporte concentra a FAQ, o SLA de primeira resposta e o caminho para abrir chamado. O link de perguntas frequentes leva diretamente para a secao correspondente dentro do suporte.', 22, true),
  ('general', 'Para que serve a pagina de suporte?', 'Ela reune a base de FAQ, o formulario para abrir chamado e a explicacao do funcionamento do atendimento. E o ponto central para duvidas operacionais da plataforma.', 23, true),
  ('general', 'Como funciona o caminho de suporte humano?', 'Quando a FAQ nao resolve, voce pode abrir um chamado com contexto, anexos e detalhes do que precisa. A equipe acompanha o ticket, responde por prioridade e atualiza o historico no proprio suporte.', 24, true),
  ('general', 'Quais paginas publicas posso editar pelo admin visual?', 'A plataforma permite editar paginas publicas como home, cursos, sobre, blog, contato, comunidade, recursos, privacidade, termos, reembolso e suporte, respeitando a estrutura do editor visual.', 25, true),
  ('general', 'O que eu consigo ajustar no editor visual da plataforma?', 'O editor visual cobre banners, header, cards, textos, seções, links, botoes, rodape e elementos de conteudo, sempre respeitando o modelo de cada pagina.', 26, true),
  ('general', 'Como funcionam os blocos de texto nas paginas publicas?', 'Os blocos de texto permitem inserir novos trechos editaveis sem mexer no codigo, o que ajuda a manter paginas institucionais, informativas ou de apoio sempre atualizadas.', 27, true),
  ('general', 'Onde encontro a pagina de privacidade e termos de uso?', 'Essas paginas ficam no rodape e podem ser abertas diretamente pelo menu publico. A pagina de privacidade tambem pode ser ajustada para manter a mesma estrutura visual das demais paginas.', 28, true),
  ('general', 'Como funcionam os cursos da GenFlix?', 'A area publica mostra o catalogo de cursos, e a area do aluno concentra o acesso ao conteudo, progresso, avaliacoes e materiais complementares.', 29, true),
  ('general', 'Como acompanho meu progresso de estudo?', 'A area do aluno organiza cursos, aulas e trilhas de forma centralizada. Sempre que houver avanço registrado, a plataforma apresenta o contexto para continuar de onde voce parou.', 30, true),
  ('general', 'Onde vejo os materiais extras e recursos de estudo?', 'A pagina de recursos e os materiais das aulas reúnem videos, textos, anexos e itens complementares para reforçar o aprendizado sem sair da plataforma.', 31, true),
  ('general', 'O blog da GenFlix substitui a FAQ?', 'Nao. O blog e uma frente editorial para artigos e conteudos de apoio, enquanto a FAQ existe para responder duvidas recorrentes de forma direta e operacional.', 32, true),
  ('general', 'Como acessar a area de comunidade?', 'A comunidade fica disponivel para perfis autenticados e e usada para interacao entre usuarios em espacos de troca e acompanhamento da plataforma.', 33, true),
  ('general', 'Existe uma pagina para indicar ou ensinar na GenFlix?', 'Sim. A plataforma possui as paginas de indicacao e de parceria para quem quer sugerir a GenFlix ou propor conteudo para a equipe avaliar.', 34, true),
  ('general', 'Os botões de contato e suporte levam para onde?', 'O botão de contato leva para a pagina de contato e os botoes de suporte levam para a central de atendimento, onde voce pode ler a FAQ ou abrir um chamado.', 35, true);

commit;
