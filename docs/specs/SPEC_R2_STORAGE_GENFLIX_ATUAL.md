# SPEC - Storage R2 atual da Genflix

## 1. Objetivo

Este documento descreve a implementacao atual de storage R2 na Genflix para que a mesma estrutura possa ser replicada na plataforma "Mariana Explica".

O foco aqui e o estado atual do codigo, nao uma proposta abstrata. Os pontos abaixo refletem o que hoje existe no repositorio da Genflix:

- upload protegido com R2 como padrao;
- compatibilidade legada com Supabase Storage;
- migracao/backfill de arquivos antigos do Supabase para R2;
- resolucao de URLs assinadas para assets privados;
- proxies publicos para assets que nao devem expor a URL bruta do storage;
- pagina administrativa `/admin/storage-r2` para observabilidade e operacao.

## 2. Resumo executivo

Na Genflix, o R2 foi introduzido como camada principal de storage, mas o sistema ainda preserva compatibilidade com assets antigos em Supabase. O desenho atual tem 5 blocos:

1. Um helper compartilhado de storage decide se a operacao vai para `r2` ou `supabase`.
2. Uma edge function prepara uploads protegidos e retorna ticket de upload assinado.
3. Outra edge function gera URLs assinadas de leitura para assets privados.
4. Um fluxo de backfill copia assets antigos do Supabase para R2 e atualiza referencias no banco.
5. Um painel admin permite ver consumo, custo estimado, listar arquivos e apagar objetos do R2.

O padrao funcional e:

- assets privados: upload via signed PUT no R2 e leitura via signed GET;
- assets publicos canonicos: URL publica da aplicacao aponta para um proxy `/api/public/...`, que redireciona para signed GET no R2;
- legado Supabase: ainda e suportado durante a transicao, inclusive no momento de gerar URLs assinadas;
- migracao: copia binario, atualiza metadados/URLs e marca `storage_provider = 'r2'` onde aplicavel.

## 3. Arquitetura atual

### 3.1 Arquivos principais

- Frontend upload compartilhado: `src/features/storage/r2-upload.ts`
- Helper compartilhado de storage nas Edge Functions: `supabase/functions/_shared/storage-provider.ts`
- Preparacao de upload e delete protegido: `supabase/functions/admin-storage-upload/index.ts`
- Geracao de acesso assinado para leitura: `supabase/functions/generate-asset-access/index.ts`
- Backfill remoto: `supabase/functions/admin-backfill-storage-r2/index.ts`
- Script de migracao local/remota: `scripts/migrate-storage-to-r2.mjs`
- Observabilidade/admin do R2: `supabase/functions/admin-r2-usage/index.ts`
- Pagina admin: `src/pages/admin/admin-r2-storage-page.tsx`
- Cliente frontend do painel admin: `src/features/admin/storage-r2/api.ts`
- Proxy publico de site assets: `supabase/functions/public-site-asset/index.ts`
- Proxy publico de course media: `supabase/functions/public-course-media/index.ts`
- Normalizacao de URLs publicas de site assets: `src/features/site-assets/public-url.ts`
- Normalizacao de URLs publicas de media de curso: `src/features/course-media/public-url.ts`
- Rewrites Vercel para proxies publicos: `vercel.json`

### 3.2 Principios de desenho

- `r2` e o provider padrao.
- `supabase` continua aceito para compatibilidade.
- Upload e delete protegidos passam por Edge Function, nunca direto do frontend.
- Leitura de asset privado passa por signed GET gerado server-side.
- URLs publicas canonicas de assets de site e media de curso apontam para a propria aplicacao, nao para a URL bruta do storage.
- Migracao e feita sem quebrar leitura de assets legados.

## 4. Buckets e dominios de asset

### 4.1 Buckets logicos usados hoje

| Dominio | upload_kind | bucket logico | Persistencia principal |
| --- | --- | --- | --- |
| Materiais de aula | `lesson_material` | `materials` | `lesson_materials.storage_path`, `lesson_materials.storage_provider` |
| PDFs de modulo | `module_pdf` | `module-pdfs` | `course_modules.module_pdf_storage_path`, `course_modules.module_pdf_storage_provider` |
| Assets do editor/site | `site_asset` | `site-assets` | `site_assets.storage_path`, `site_assets.public_url` |
| Avatares | `profile_avatar` | `profile-avatars` | `profiles.avatar_url` |
| Anexos de suporte | `support_attachment` | `uploads` | `support_tickets.attachment_url`, `support_messages.attachment_url` |
| Assets de quizzes visuais | `assessment_asset` | `assessment-assets` | JSON em `assessment_question_interactions.content` |
| Assets de blocos de conteudo | `lesson_content_asset` | `lesson-content-assets` | JSON/HTML em `lessons.text_content` |
| Assets de botoes/rodape de aula | `lesson_footer_asset` | `lesson-footer-assets` | `lesson_footer_actions.storage_path` |
| Midia visual de curso | `course_media` | `thumbnails` | `courses.thumbnail_url`, `cover_image_url`, `logo_url`, `student_hero_image_url` |
| Audio gerado de aula | `lesson_audio` | `lesson-audio` | objetos em R2 por `lessonId/contentHash/...` |

### 4.2 Origem dos buckets no projeto

Os buckets nasceram em migrations do Supabase Storage e depois passaram a ser usados tambem pelo R2:

- `materials`: `20260320200000_sprint2_courses_modules_lessons_materials.sql`
- `thumbnails`: `20260324153000_add_thumbnail_and_workload_minutes.sql`
- `lesson-audio`: `20260325223000_add_lesson_audio_bucket.sql`
- `assessment-assets`: `20260327093000_assessment_gamified_questions.sql`
- `module-pdfs` e `lesson-footer-assets`: `20260402120000_module_pdf_footer_actions_schedule_coloring.sql`
- `lesson-content-assets`: `20260408153000_add_lesson_content_assets_bucket.sql`
- `site-assets`: `20260419143000_site_visual_editor.sql`
- `uploads`: `20260422180000_support_tickets_system.sql`
- `profile-avatars`: `20260423093000_creator_course_rooms_and_profile_avatars.sql`

## 5. Contrato compartilhado de storage

### 5.1 Helper server-side

Arquivo: `supabase/functions/_shared/storage-provider.ts`

Responsabilidades:

- resolver provider (`r2` ou `supabase`);
- sanitizar nome de arquivo;
- montar `objectPath`;
- criar signed PUT;
- criar signed GET;
- deletar objeto;
- centralizar TTL e tamanho maximo.

### 5.2 Defaults relevantes

- provider default: `r2`
- signed GET default: `300s`
- signed PUT default: `600s`
- max upload default do helper: `50 MB`
- max upload efetivo no `admin-storage-upload`: `1 GB`

### 5.3 Convencao de chave de objeto

Para uploads feitos via `admin-storage-upload`, a chave segue:

`<prefix>/<uuid>-<fileNameSanitizado>`

O prefixo normalmente e:

`<bucket-logico>/<entityId>`

Exemplos praticos do comportamento atual:

- material de aula: `materials/<lessonId>/<uuid>-arquivo.pdf`
- asset de site: `site-assets/<pageKey>/<entryKey>/<uuid>-imagem.webp`
- avatar: `profile-avatars/<userId>/<uuid>-foto.png`
- anexo de suporte: `uploads/<userId>/<uuid>-anexo.pdf`
- pdf de modulo: `module-pdfs/<moduleId>/<uuid>-modulo.pdf`
- footer asset: `lesson-footer-assets/courses/<courseId>/<uuid>-arquivo.pdf`
- course media: `thumbnails/thumbnails/<uuid>-thumb.jpg` ou `thumbnails/course-logos/<uuid>-logo.png`

Observacao importante:

- o codigo suporta multiplexar varios buckets logicos dentro de um unico bucket fisico de R2 por meio de `R2_PRIVATE_BUCKET`;
- quando isso acontece, o nome do bucket logico continua aparecendo no prefixo da chave, o que preserva segregacao por pasta;
- isso e um detalhe importante para replicar exatamente a estrutura atual.

## 6. Fluxo de upload protegido

### 6.1 Frontend compartilhado

Arquivo: `src/features/storage/r2-upload.ts`

Fluxo:

1. frontend pega `access_token` do usuario autenticado;
2. chama a edge function `admin-storage-upload` com:
   - `operation: 'prepare_upload'`
   - `upload_kind`
   - `entity_id`
   - `file_name`
   - `mime_type`
   - `file_size_bytes`
   - `provider` opcional
3. edge function devolve um ticket de upload;
4. frontend envia o arquivo:
   - para Supabase, via `uploadToSignedUrl`;
   - para R2, via `XMLHttpRequest` com progresso e retry.

### 6.2 Ticket de upload

Contrato retornado ao frontend:

- `provider`
- `upload_method`
- `upload_path`
- `upload_token`
- `upload_url`
- `upload_headers`
- `storage_bucket`
- `storage_provider`
- `public_url`

Valores atuais:

- R2: `upload_method = 'r2_signed_put'`
- Supabase: `upload_method = 'supabase_signed_upload'`

### 6.3 Regras de autorizacao de upload

Arquivo: `supabase/functions/admin-storage-upload/index.ts`

Todos os uploads exigem sessao valida.

Permissoes atuais:

- `profile_avatar` e `support_attachment`: qualquer usuario autenticado;
- demais `upload_kind`: apenas `admin` ou `criador`.

### 6.4 Upload kinds mapeados hoje

Mapeamento atual do backend:

- `lesson_material` -> `materials`
- `site_asset` -> `site-assets`
- `profile_avatar` -> `profile-avatars`
- `support_attachment` -> `uploads`
- `assessment_asset` -> `assessment-assets`
- `module_pdf` -> `module-pdfs`
- `lesson_content_asset` -> `lesson-content-assets`
- `lesson_footer_asset` -> `lesson-footer-assets`
- `course_media` -> `thumbnails`
- `lesson_audio` -> `lesson-audio`

## 7. Fluxo de leitura de asset privado

### 7.1 Edge function de signed GET

Arquivo: `supabase/functions/generate-asset-access/index.ts`

Responsabilidade:

- receber contexto do asset;
- validar autenticacao/permissao;
- descobrir bucket/path/provider;
- devolver `signed_url` temporaria.

### 7.2 Regras de autorizacao atuais

#### `lesson_material`

- admin/criador: acesso liberado;
- aluno: somente se o curso estiver liberado para ele e a aula estiver desbloqueada.

#### `lesson_content_asset`, `lesson_footer_asset`, `assessment_asset`

- autenticado pode receber URL assinada;
- a validacao aqui e mais permissiva porque esses assets precisam permanecer acessiveis dentro da experiencia educacional autenticada.

#### `module_pdf`

- apenas administradores.

#### `site_asset`, `profile_avatar`, `support_attachment`, `course_media`

- quando acessados por essa function, caem na regra de privilegio administrativo;
- na pratica, assets publicos principais usam proxies proprios em vez desta function.

### 7.3 TTLs efetivamente usados pelo frontend

- material de aula: `10 min`
- pdf de modulo: `10 min`
- footer action file: `10 min`
- lesson content asset: `60 min`
- preview de imagem no admin R2 page: `10 min`
- audio de aula: `60 min`

## 8. URLs publicas canonicas

### 8.1 Site assets

Arquivos:

- `src/features/site-assets/public-url.ts`
- `supabase/functions/public-site-asset/index.ts`
- `vercel.json`

Padrao canonico:

`/api/public/site-asset?storage_path=<storage_path>`

Funcionamento:

1. uploads novos do frontend persistem `public_url` normalizada para o proxy da aplicacao;
2. Vercel faz rewrite para a edge function `public-site-asset`;
3. edge function resolve o `storage_path`, identifica provider e devolve `302` para signed GET.

Observacao importante sobre o estado atual:

- o fluxo de upload novo grava `public_url` ja em formato proxy;
- o backfill legado de `site_assets` pode deixar `public_url` direta do R2;
- na leitura, o frontend normaliza ambos os formatos para o proxy canonico da aplicacao.

Vantagem:

- a URL publicada no conteudo do site continua estavel mesmo se o provider mudar.

### 8.2 Course media

Arquivos:

- `src/features/course-media/public-url.ts`
- `supabase/functions/public-course-media/index.ts`
- `vercel.json`

Padrao canonico:

`/api/public/course-media?storage_path=<storage_path>`

Usado em:

- `thumbnail_url`
- `cover_image_url`
- `logo_url`
- `student_hero_image_url`

### 8.3 Avatares e anexos de suporte

Estado atual da Genflix:

- `profiles.avatar_url`, `support_tickets.attachment_url` e `support_messages.attachment_url` sao atualizados para a URL bruta resolvida por `buildR2ObjectUrl(...)`;
- eles nao usam hoje um proxy publico canonico da aplicacao.

Se a replicacao na Mariana Explica quiser ficar 100% igual a Genflix atual, esse comportamento deve ser mantido.

## 9. Estruturas de dados alteradas para suportar R2

### 9.1 Colunas adicionadas explicitamente

Migration: `supabase/migrations/20260515110000_r2_storage_provider_for_private_assets.sql`

Campos:

- `lesson_materials.storage_provider text not null default 'supabase'`
- `course_modules.module_pdf_storage_provider text not null default 'supabase'`

Ambos com `check ( ... in ('supabase', 'r2') )`.

### 9.2 Campos JSON/HTML que tambem carregam provider

O sistema atual tambem passou a carregar `storage_provider` e `signed_url` dentro de payloads:

- `assessment_question_interactions.content.asset`
- blocos serializados dentro de `lessons.text_content`
  - `image`
  - `video`
  - `html`
  - `image-hotspots`

### 9.3 Campos de URL canonica ou migrada

- `site_assets.public_url`
- `profiles.avatar_url`
- `support_tickets.attachment_url`
- `support_messages.attachment_url`
- `courses.thumbnail_url`
- `courses.cover_image_url`
- `courses.logo_url`
- `courses.student_hero_image_url`

## 10. Fluxos por dominio

### 10.1 Materiais de aula

- Upload: `uploadMaterial(...)` em `src/features/admin/content/api.ts`
- Bucket: `materials`
- Metadado salvo: `lesson_materials`
- Delete: remove objeto + deleta row
- Leitura: `generate-asset-access`
- Migracao: copia binario e atualiza `storage_provider`

### 10.2 PDF de modulo

- Upload: `uploadModulePdf(...)`
- Bucket: `module-pdfs`
- Metadado salvo em `course_modules`
- Leitura: signed URL admin-only
- Migracao: copia binario e atualiza `module_pdf_storage_provider`

### 10.3 Lesson content assets

- Upload: `uploadLessonContentAsset(...)`
- Bucket: `lesson-content-assets`
- Metadado persiste dentro do proprio payload serializado da aula
- Leitura: signed URL
- Migracao: reescreve `lessons.text_content`

### 10.4 Assessment assets

- Upload: `src/features/admin/assessments/api.ts`
- Bucket: `assessment-assets`
- Metadado persiste em JSON de `assessment_question_interactions.content`
- Migracao: reescreve `storage_provider` e zera `signed_url`

### 10.5 Footer action assets

- Bucket: `lesson-footer-assets`
- Existe uma regra especial importante:
  - se `lesson_footer_actions.storage_path` coincidir com um `lesson_materials.storage_path`, o sistema entende que o arquivo original esta em `materials`;
  - nesse caso, ele nao apaga o objeto ao remover o botao;
  - se nao houver esse vinculo, assume bucket `lesson-footer-assets` e deleta normalmente.

Esse detalhe precisa ser copiado para evitar exclusao indevida de arquivos compartilhados.

### 10.6 Site assets

- Upload: `src/features/site-editor/api.ts`
- Bucket: `site-assets`
- Row salva em `site_assets`
- upload novo persiste `public_url` normalizada para o proxy `/api/public/site-asset`
- leitura do frontend aceita row em proxy ou URL direta do R2 e normaliza para o proxy
- Migracao: copia binario e atualiza `public_url`

### 10.7 Course media

- Upload: `uploadCourseThumbnail(...)`, `uploadCourseLogo(...)`
- Bucket: `thumbnails`
- URL persistida no curso e canonica para `/api/public/course-media`
- Migracao: converte URLs antigas do Supabase e URLs diretas do R2 para o proxy canonico da aplicacao

### 10.8 Avatares e suporte

- Avatar upload: `src/features/account/avatar-api.ts`
- Support attachment upload: `src/features/support/api.ts`
- Persistem URL direta do objeto retornada pelo ticket de upload
- Backfill atualiza esses campos se ainda apontarem para Supabase

### 10.9 Audio de aula

Arquivo principal: `supabase/functions/generate-lesson-audio/index.ts`

Caracteristicas:

- usa bucket `lesson-audio`;
- nao depende do fluxo padrao de migracao, porque nasce direto em R2;
- gera partes por hash de conteudo em `lessonId/contentHash/part-...`;
- faz cache por hash;
- devolve signed GET para reproducao.

## 11. Migracao de Supabase Storage para R2

### 11.1 Artefatos da migracao

- script CLI/local: `scripts/migrate-storage-to-r2.mjs`
- edge function operacional/remota: `supabase/functions/admin-backfill-storage-r2/index.ts`

### 11.2 Secoes de migracao suportadas hoje

As secoes atuais sao exatamente estas:

- `lesson_materials`
- `module_pdfs`
- `site_assets`
- `assessment_assets`
- `lesson_content_assets`
- `lesson_footer_assets`
- `profiles_avatar_url`
- `courses_media_urls`
- `support_ticket_attachments`
- `support_message_attachments`

### 11.3 O que cada secao faz

#### `lesson_materials`

- baixa do Supabase Storage;
- envia para R2;
- atualiza `lesson_materials.storage_provider = 'r2'`.

#### `module_pdfs`

- baixa do Supabase Storage;
- envia para R2;
- atualiza `course_modules.module_pdf_storage_provider = 'r2'`.

#### `site_assets`

- baixa do Supabase Storage;
- envia para R2;
- atualiza `site_assets.public_url` para a URL direta de R2;
- na leitura do app, essa URL continua sendo normalizada para o proxy canonico.

#### `assessment_assets`

- baixa do Supabase Storage;
- envia para R2;
- reescreve JSON de `assessment_question_interactions.content`.

#### `lesson_content_assets`

- baixa do Supabase Storage;
- envia para R2;
- percorre `lessons.text_content`, encontra payloads serializados em `data-hcm-payload="..."` e atualiza:
  - `storage_provider: 'r2'`
  - `signed_url: null`

#### `lesson_footer_assets`

- copia assets reais do bucket de footer;
- pula paths que sao compartilhados com `lesson_materials`.

#### `profiles_avatar_url`, `support_ticket_attachments`, `support_message_attachments`

- detecta URL antiga do Supabase;
- extrai `bucket` e `objectPath`;
- copia para R2;
- atualiza o campo de URL da tabela.

#### `courses_media_urls`

- detecta 3 formatos:
  - URL antiga do Supabase
  - URL direta do R2
  - URL ja proxied da aplicacao
- migra se preciso;
- sempre reescreve para a URL canonica `/api/public/course-media?...`.

### 11.4 Comportamento do script local

Arquivo: `scripts/migrate-storage-to-r2.mjs`

Regras atuais:

- se existir credencial local de escrita no R2, o script migra direto;
- se nao existir, chama a edge function `admin-backfill-storage-r2`;
- `site_assets` roda em lotes de 40 no modo remoto;
- ha cache em memoria para nao copiar o mesmo objeto duas vezes;
- antes de copiar, o script tenta detectar se o objeto ja existe no R2;
- suporta `--dry-run`;
- suporta filtro por `--section`.

### 11.5 Autorizacao da edge function de backfill

A edge function aceita:

- `SUPABASE_SERVICE_ROLE_KEY`; ou
- `ADMIN_BACKFILL_TOKEN`

Isso e um fluxo operacional, nao um endpoint para uso comum do frontend.

## 12. Painel admin `/admin/storage-r2`

### 12.1 Localizacao

- rota: `/admin/storage-r2`
- page: `src/pages/admin/admin-r2-storage-page.tsx`
- menu admin: `src/app/layouts/admin-layout.tsx`

### 12.2 Backend usado pelo painel

Edge function:

- `supabase/functions/admin-r2-usage/index.ts`

Acoes suportadas:

- `overview`
- `list_objects`
- `delete_object`

### 12.3 Autorizacao do painel

- usuario autenticado;
- role `admin` obrigatoria.

### 12.4 Modo de coleta de uso

O backend tenta primeiro:

- Cloudflare API com `R2_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` ou `CLOUDFLARE_ACCESS_TOKEN`

Se falhar ou nao estiver configurado:

- faz fallback para S3 API do R2 usando `ListBuckets` e `ListObjectsV2`.

### 12.5 O que a tela mostra hoje

Aba `Visao geral`:

- quantidade de buckets;
- armazenamento total;
- total de objetos;
- total de uploads acumulados;
- estimativa mensal de custo baseada em tabela fixa do Cloudflare R2;
- detalhamento por bucket;
- destaque do bucket com maior consumo.

Aba `Arquivos`:

- selecao de bucket;
- filtro por prefixo;
- filtros por tipo (`image`, `video`, `audio`, `document`, `archive`, `other`);
- paginacao local;
- carregamento incremental via `continuation_token`;
- preview assinada para imagens;
- exclusao de objetos.

### 12.6 Limitacoes atuais do painel

- custo de `Class B` e retrieval nao e calculado integralmente quando o endpoint nao fornece esses dados;
- a estimativa de custo e apenas operacional, nao contabil;
- o listamento usa S3 API e nao depende da Cloudflare API de billing.

## 13. Variaveis de ambiente relevantes

### 13.1 Minimo para operacao basica

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `APP_PUBLIC_URL`

### 13.2 R2

- `R2_S3_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_REGION`
- `R2_PRIVATE_BUCKET`
- `R2_BUCKETS`
- `STORAGE_PROVIDER_DEFAULT`
- `R2_SIGNED_GET_EXPIRES_SECONDS`
- `R2_SIGNED_PUT_EXPIRES_SECONDS`
- `R2_MAX_FILE_SIZE_BYTES`

### 13.3 Observabilidade / billing

- `R2_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN` ou `CLOUDFLARE_ACCESS_TOKEN`

### 13.4 Backfill operacional

- `ADMIN_BACKFILL_TOKEN`
- `BACKFILL_ADMIN_TOKEN`

### 13.5 Audio de aula

- `OPENAI_API_KEY`
- `GEMINI_API_KEY`

## 14. Regras especiais e armadilhas da implementacao atual

### 14.1 Compatibilidade dupla `supabase` + `r2`

Mesmo apos a migracao, o codigo continua desenhado para ler e apagar tanto em `supabase` quanto em `r2`. Isso reduz risco de rollout e deve ser mantido na Mariana Explica ate o backfill terminar.

### 14.2 Prefixo com nome do bucket logico

O prefixo atual inclui o nome do bucket logico dentro do proprio `objectPath`. Esse detalhe nao e acidental. Varios normalizadores e scripts assumem esse formato.

### 14.3 Footer assets podem compartilhar arquivo com `lesson_materials`

Nao apagar indiscriminadamente `lesson_footer_actions.storage_path`. Hoje existe uma resolucao especial para evitar apagar arquivo compartilhado.

### 14.4 URLs canonicas de site assets e course media passam pela aplicacao

Para `course media`, o comportamento atual e persistir a URL proxy da aplicacao.

Para `site assets`, o comportamento atual e misto:

- upload novo persiste proxy;
- backfill legado pode deixar URL direta do R2 no banco;
- consumo no frontend normaliza para o proxy.

Se a Mariana quiser reproduzir a Genflix de forma fiel, deve manter essa compatibilidade de leitura.

### 14.5 Avatares e anexos hoje nao usam proxy canonico

Esse e o comportamento atual da Genflix. Se a Mariana quiser simplificar ou endurecer seguranca, esse e um ponto de decisao arquitetural, mas nao faz parte da copia fiel.

## 15. Checklist de replicacao para "Mariana Explica"

### 15.1 Backend / Supabase

- copiar o helper compartilhado de storage;
- criar as edge functions:
  - `admin-storage-upload`
  - `generate-asset-access`
  - `admin-backfill-storage-r2`
  - `admin-r2-usage`
  - `public-site-asset`
  - `public-course-media`
- portar migrations de buckets e campos `storage_provider`;
- adaptar nomes de tabelas somente se o schema da Mariana divergir.

### 15.2 Frontend

- copiar `src/features/storage/r2-upload.ts`;
- copiar os helpers de URL publica:
  - `src/features/site-assets/public-url.ts`
  - `src/features/course-media/public-url.ts`
- copiar/replicar a pagina `/admin/storage-r2`;
- plugar os fluxos de upload dos dominios equivalentes da Mariana.

### 15.3 Deploy / edge routing

- criar rewrites equivalentes em `vercel.json` para:
  - `/api/public/site-asset`
  - `/api/public/course-media`
- garantir `APP_PUBLIC_URL` coerente com o dominio de producao da Mariana.

### 15.4 Migracao de legado

- primeiro portar a compatibilidade `supabase` + `r2`;
- depois subir assets novos ja em `r2`;
- em seguida executar backfill por secao;
- por fim validar:
  - assets privados;
  - assets publicos proxied;
  - avatares;
  - anexos de suporte;
  - listagem do painel admin;
  - exclusao de objeto;
  - custo/uso por bucket.

## 16. Ordem recomendada de implementacao na Mariana

1. Replicar helper compartilhado de storage.
2. Replicar `admin-storage-upload`.
3. Replicar `generate-asset-access`.
4. Replicar normalizadores/proxies publicos.
5. Adicionar `storage_provider` nas tabelas equivalentes.
6. Migrar os fluxos de upload do frontend para o ticket compartilhado.
7. Criar o painel `/admin/storage-r2`.
8. Rodar o backfill por secao.
9. Normalizar URLs antigas.
10. Validar que todos os uploads novos estao nascendo em R2.

## 17. Conclusao

A implementacao atual da Genflix nao e apenas "usar R2 no lugar do Supabase Storage". Ela e uma combinacao de:

- dual provider temporario;
- ticket de upload centralizado;
- signed GET para privado;
- proxy canonico para publico controlado;
- backfill por dominio de asset;
- painel admin de observabilidade e operacao.

Para replicar fielmente na "Mariana Explica", o ideal e portar o conjunto inteiro, nao so o bucket do R2.
