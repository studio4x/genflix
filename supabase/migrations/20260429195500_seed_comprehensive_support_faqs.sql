begin;

delete from public.support_faqs;

insert into public.support_faqs (category_key, question, answer, sort_order, is_published)
values
  ('payment', 'Quais formas de pagamento a GenFlix aceita', 'N?o momento, a plataforma trabalha com pagamento por cartao de credito. O fluxo de compra foi desenhado para ser direto, com foco em aprova??o rapida e acesso imediato quando o pagamento e confirmado.', 1, true),
  ('payment', 'Posso parcelar minha compra', 'Sim. O checkout foi configurado para permitir parcelamento sem juros em ate 3x, respeitando a parcela minima prevista pela plataforma.', 2, true),
  ('payment', 'Como sei se meu pagamento foi aprovado', 'Quando o pagamento e aprovado, o acesso ao curso fica disponvel na sua area do aluno. Se houver qualquer divergencia, confira se o cartao foi aceito pela operadora e abra um chamado com o comprovante.', 3, true),
  ('payment', 'O que fazer se o pagamento for recusado', 'Revise os dados do cartao, saldo, limite e autorizacao do emissor. Se a recusa persistir, tente novamente com outro cartao ou entre em contato com o suporte informando a mensagem exibida.', 4, true),
  ('payment', 'A GenFlix trabalha com Pix', 'N?o. A plataforma foi padronizada para manter o pagamento apenas por cartao de credito.', 5, true),
  ('payment', 'Como funciona reembolso ou cancelamento', 'As regras de reembolso seguem a p?gina publica de Politica de Reembolso. Quando houver necessidade, a equipe valida o caso e o contexto da compra antes de orientar o procedimento.', 6, true),
  ('payment', 'Recebi o comprovante, mas n?o vejo o acesso liberado. E agora', 'Acesse a area do aluno e recarregue a p?gina. Se a libera??o n?o acontecer em alguns minutos, envie o comprovante, o e-mail da conta e o nome do curso para conferirmos a matricula.', 7, true),

  ('account', 'Como criar minha conta na GenFlix', 'Voc? pode criar sua conta na p?gina de cadastro e concluir o acesso com e-mail e senha. Depois disso, a plataforma libera a area do aluno e o hist?rico de compras.', 8, true),
  ('account', 'Como recuperar minha senha', 'Use a p?gina de recuperar senha para solicitar um novo link de acesso. Se o e-mail n?o chegar, verifique spam e lixo eletronico antes de pedir suporte.', 9, true),
  ('account', 'Posso mostrar ou ocultar minha senha ao digitar', 'Sim. Os campos de senha da plataforma permitem alternar a visibilidade para facilitar o preenchimento, principalmente quando a senha e mais complexa.', 10, true),
  ('account', 'Como altero meus dados de perfil', 'Na area da conta voc? consegue ajustar nome, idioma, fuso e outros dados basicos de cadastro. Se precisar alterar algo mais sensivel, o suporte pode orientar o procedimento adequado.', 11, true),
  ('account', 'Onde vejo minhas notificacoes', 'As notificacoes aparecem no centro de notificacoes da plataforma e tamb?m podem chegar por e-mail, de acordo com a configura??o da conta e do tipo de evento.', 12, true),
  ('account', 'Como acesso o hist?rico de mensagens e chamados', 'Quando voc? estiver autenticado, a area de suporte mostra o hist?rico dos chamados e das conversas associadas. Isso ajuda a acompanhar respostas sem perder contexto.', 13, true),
  ('account', 'Esqueci o e-mail usado no cadastro. O que faco', 'Se voc? n?o lembrar o e-mail do cadastro, entre em contato com o suporte informando nome completo e qualquer dado de compra que ajude a localizar a conta.', 14, true),

  ('technical', 'A aula n?o carrega ou trava. Como proceder', 'Atualize a p?gina, teste outro navegador e confirme sua conexao. Se o problema continuar, informe o curso, m?dulo e aula para que a equipe consiga reproduzir o erro.', 15, true),
  ('technical', 'N?o consigo abrir anexos ou materiais da aula.', 'Verifique se o material foi liberado para a turma e tente novamente em outro navegador. Se ainda falhar, envie um print com a mensagem exibida para analisarmos.', 16, true),
  ('technical', 'O video est? sem som ou com playback instavel. O que posso fazer', 'Confirme o volume do navegador, teste fones ou alto-falantes e recarregue a p?gina. Em alguns casos, limpar cache e cookies tamb?m ajuda a resolver.', 17, true),
  ('technical', 'Como encontro uma aula dentro do curso', 'A trilha do curso e organizada por m?dulo e aula. Use o menu lateral do player ou a lista da area do curso para navegar diretamente ate o contedo desejado.', 18, true),
  ('technical', 'Consigo assistir em celular ou tablet', 'Sim. A interface publica, o player de aulas e a area do aluno foram pensados para funcionar em desktop e mobile, mantendo a leitura e a navegacao responsivas.', 19, true),
  ('technical', 'N?o estou conseguindo concluir uma avalia??o. O que verificar', 'Revise se a p?gina n?o ficou em segundo plano, se o navegador n?o bloqueou a submissao e se a conexao est? est?vel. Se o erro persistir, abra um chamado com detalhes da tentativa.', 20, true),
  ('technical', 'A busca n?o encontrou resultados. Isso significa que n?o existe o contedo', 'N?o necessariamente. A busca tenta localizar o termo nas perguntas cadastradas. Se nada aparecer, use palavras parecidas ou abra um chamado para pedir orientacao especifica.', 21, true),

  ('general', 'Onde encontro as perguntas frequentes da plataforma', 'A p?gina publica de suporte concentra a FAQ, o SLA de primeira resposta e o caminho para abrir chamado. O link de perguntas frequentes leva diretamente para a secao correspondente dentro do suporte.', 22, true),
  ('general', 'Para que serve a p?gina de suporte', 'Ela reune a base de FAQ, o formulario para abrir chamado e a explicacao do funcionamento do atendimento. E o ponto central para duvidas operacionais da plataforma.', 23, true),
  ('general', 'Como funciona o caminho de suporte humano', 'Quando a FAQ n?o resolve, voc? pode abrir um chamado com contexto, anexos e detalhes do que precisa. A equipe acompanha o ticket, responde por prioridade e atualiza o hist?rico no proprio suporte.', 24, true),
  ('general', 'Quais p?ginas publicas posso editar pelo admin visual', 'A plataforma permite editar p?ginas publicas como home, cursos, sobre, blog, contato, comunidade, recursos, privacidade, termos, reembolso e suporte, respeitando a estrutura do editor visual.', 25, true),
  ('general', 'O que eu consigo ajustar no editor visual da plataforma', 'O editor visual cobre banners, header, cards, textos, seções, links, botoes, rodape e elementos de contedo, sempre respeitando o modelo de cada p?gina.', 26, true),
  ('general', 'Como funcionam os blocos de texto nas p?ginas publicas', 'Os blocos de texto permitem inserir novos trechos editaveis sem mexer no codigo, o que ajuda a manter p?ginas institucionais, informativas ou de apoio sempre atualizadas.', 27, true),
  ('general', 'Onde encontro a p?gina de privacidade e termos de uso', 'Essas p?ginas ficam no rodape e podem ser abertas diretamente pelo menu pblico. A p?gina de privacidade tamb?m pode ser ajustada para manter a mesma estrutura visual das demais p?ginas.', 28, true),
  ('general', 'Como funcionam os cursos da GenFlix', 'A area publica mostra o catalogo de cursos, e a area do aluno concentra o acesso ao contedo, progresso, avalia??es e materiais complementares.', 29, true),
  ('general', 'Como acompanho meu progresso de estudo', 'A area do aluno organiza cursos, aulas e trilhas de forma centralizada. Sempre que houver avanço registrado, a plataforma apresenta o contexto para continuar de onde voc? parou.', 30, true),
  ('general', 'Onde vejo os materiais extras e recursos de estudo', 'A p?gina de recursos e os materiais das aulas reúnem videos, textos, anexos e itens complementares para reforçar o aprendizado sem sair da plataforma.', 31, true),
  ('general', 'O blog da GenFlix substitui a FAQ', 'N?o. O blog e uma frente editorial para artigos e contedos de apoio, enquanto a FAQ existe para responder duvidas recorrentes de forma direta e operacional.', 32, true),
  ('general', 'Como acessar a area de comunidade', 'A comunidade fica disponvel para perfis autenticados e e usada para interacao entre usurios em espacos de troca e acompanhamento da plataforma.', 33, true),
  ('general', 'Existe uma p?gina para indicar ou ensinar na GenFlix', 'Sim. A plataforma possui as p?ginas de indica??o e de parceria para quem quer sugerir a GenFlix ou propor contedo para a equipe avaliar.', 34, true),
  ('general', 'Os botões de contato e suporte levam para onde', 'O botão de contato leva para a p?gina de contato e os botoes de suporte levam para a central de atendimento, onde voc? pode ler a FAQ ou abrir um chamado.', 35, true);

commit;
