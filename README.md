# Meu Treino PWA — v7

Esta versão evolui o PWA existente de forma incremental.

## Arquivos principais
- `index.html`
- `css/app.css`
- `js/app.js`
- `js/config.js`
- `sw.js`
- `manifest.json`
- `supabase/schema.sql`
- `supabase/config.toml`
- `supabase/functions/ai-chat/index.ts`
- `supabase/functions/youtube-search/index.ts`

## O que foi incorporado
- Conta por usuário com Supabase Auth.
- Recuperação de senha.
- Dados locais em IndexedDB.
- Sincronização de snapshot por usuário.
- Migração dos dados locais após login.
- RLS no banco.
- Histórico, peso/IMC, cardio, fotos e treinos.
- Lixeira e restauração.
- Audit log local + tabela de auditoria preparada.
- Banco de exercícios oficiais/personalizados.
- RIR nas séries.
- Vídeos YouTube por Edge Function, sem inventar URLs.
- Pergunte à IA por Edge Function.
- Treino Inteligente local baseado no banco/histórico.
- Estrutura SQL para entidades normalizadas.
- PWA/offline.
- Descanso inicial de 40 s, configurável pelo usuário entre 5 e 600 s.
- Apito e vibração ao terminar o descanso.
- Backup JSON.

## Configuração Supabase
1. Crie um projeto Supabase.
2. Execute `supabase/schema.sql` no SQL Editor.
3. Copie `js/config.example.js` para `js/config.js`.
4. Preencha URL e Publishable Key.
5. Configure Auth > URL Configuration para a URL do GitHub Pages.
6. Configure confirmação de e-mail conforme sua preferência.

## Edge Functions
Instale/configure a CLI do Supabase e faça deploy:
- `supabase functions deploy ai-chat`
- `supabase functions deploy youtube-search`

Configure os secrets no ambiente do Supabase:
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (opcional)
- `YOUTUBE_API_KEY`

Nunca coloque essas chaves no frontend.

## Limitações reais
- A sincronização do cliente desta versão usa `user_snapshots` como camada de recuperação rápida; as tabelas normalizadas estão preparadas para a próxima etapa de sincronização granular.
- Fotos continuam sendo mantidas localmente nesta primeira migração; o schema já possui Storage metadata para a futura subida ao Supabase Storage.
- A integração de caminhada/corrida com plataformas de saúde ainda é uma estrutura futura, não uma integração Bluetooth universal.
- Áudio em iOS depende das regras do navegador e pode ser suspenso quando o processo da PWA é colocado em segundo plano.
- A IA e busca do YouTube só funcionam depois das Edge Functions e respectivos secrets serem configurados.

## Testes
Teste cadastro, login, recuperação, offline, sincronização, migração, treino, cronômetro, 40 s inicial, mudança do descanso, peso/IMC, lixeira, exercícios, vídeos, IA e PWA antes de publicar em produção.
