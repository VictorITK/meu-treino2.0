# Meu Treino — pacote de correções v12

## Arquivos para substituir
- `index.html`
- `js/app.js`
- `css/app.css`
- `sw.js`

## Supabase
1. Execute `supabase/migration-v12.sql` no SQL Editor.
2. Faça deploy de `supabase/functions/ai-chat/index.ts` como `ai-chat`.
3. Faça deploy de `supabase/functions/youtube-search/index.ts` como `youtube-search`.
4. Configure `OPENAI_API_KEY` e, se desejar, `OPENAI_MODEL`.
5. Configure `YOUTUBE_API_KEY`.
6. Em Auth/Passkeys, habilite Passkeys e substitua `SEU-DOMINIO` em `supabase/config.toml` pelo domínio real da aplicação.
7. Mantenha o `js/config.js` que já contém a URL e a publishable key do seu projeto. Não coloque service_role no frontend.

## O que esta versão corrige
- A/B são restaurados se um estado local antigo estiver com as listas vazias.
- Snapshot remoto vazio não sobrescreve um treino local existente.
- Banco oficial com 73 exercícios na migração.
- Smart Workout usa o banco remoto quando disponível e mantém os filtros visuais sincronizados.
- Vídeos são salvos por usuário na tabela `exercise_videos`.
- Peso atual não aparece na tela inicial.
- Cronômetro total do treino é separado do descanso e é gravado na sessão.
- Pós-treino permite gerar card 1080x1350, 4:5, com data DD/MM/YYYY da conclusão.
- Card usa somente exercícios efetivamente concluídos e cardio informado.
- Compartilhamento nativo e salvamento da imagem.
- Passkey/Face ID/biometria no login e cadastro em Configurações.
- Service Worker atualizado para evitar cache antigo.
