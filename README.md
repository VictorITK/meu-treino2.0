# Meu Treino PWA — v8

Esta versão implementa a nova etapa solicitada de forma funcional, preservando o PWA, Treino A/B, histórico, peso, cardio, fotos, cronômetro de 40 s, áudio, vídeos e sincronização existentes.

## O que mudou

- Seleção do Treino Inteligente com chips visuais: o estado visual é ligado diretamente aos `<select>` que alimentam o gerador.
- Banco real de exercícios no Supabase, com **46 exercícios oficiais** iniciais.
- Campos estruturados: `name`, `slug`, `group_name`, `secondary_muscles`, `movement_type`, `equipment`, `difficulty`, `exercise_type`, `instructions`, `image_url`, `video_url`, `active` etc.
- Gerador consulta o Supabase em tempo real quando online.
- Gerador considera grupo, objetivo, nível, tempo, equipamento, exercícios a evitar, variedade/histórico e equilíbrio entre grupos.
- O tempo é estimado antes de adicionar exercícios para evitar sessões que não caibam no período informado.
- Exercícios duplicados são evitados.
- Resultado mostra imagem (ou placeholder), grupo, séries, repetições, RIR, descanso e campos para carga/repetições/concluir série.
- "Usar este treino" carrega o treino no Treino A e também grava `workouts`/`workout_exercises` quando o usuário está autenticado e online.
- Exercícios personalizados criados no app podem ser gravados na tabela `exercises`.
- Login mantém sessão com Supabase Auth.
- Checkbox "Lembrar minha conta" usa armazenamento persistente do Supabase quando marcado e `sessionStorage` quando desmarcado; senha não é salva manualmente.
- Passkeys/Face ID/Touch ID/Windows Hello foram preparados com o suporte WebAuthn/Passkeys experimental atual do Supabase JS.
- RLS continua protegendo os dados por usuário.
- Service Worker atualizado para v8.

## Arquivos principais

- `index.html`
- `css/app.css`
- `js/app.js`
- `js/config.js`
- `sw.js`
- `manifest.json`
- `supabase/schema.sql`
- `supabase/migration-v8.sql`
- `supabase/config.toml`

## Supabase — banco

### Instalação nova

Execute `supabase/schema.sql` no SQL Editor.

### Projeto que já está na v7

Execute `supabase/migration-v8.sql`.

A migration adiciona os campos do banco de exercícios, índices e insere o banco oficial de 46 exercícios de forma idempotente.

## Supabase — configuração do frontend

Em `js/config.js` informe somente:

```js
window.MEU_TREINO_CONFIG = {
  SUPABASE_URL: "https://SEU-PROJETO.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "SUA_PUBLISHABLE_KEY",
  FUNCTIONS_BASE_URL: ""
};
```

Nunca coloque `service_role` ou outra secret key no frontend.

## Passkeys / Face ID / biometria

O suporte de Passkeys do Supabase Auth é experimental e exige `@supabase/supabase-js` 2.105.0 ou superior. O app já usa essa versão e habilita `experimental.passkey`.

No Supabase Dashboard:

1. Authentication → Passkeys.
2. Ative **Enable Passkey authentication**.
3. Defina:
   - Display Name: `Meu Treino`
   - RP ID: domínio do PWA, sem `https://` e sem caminho.
   - RP Origins: origem HTTPS exata do PWA.
4. Mantenha o RP ID estável depois de cadastrar passkeys.

No GitHub Pages, por exemplo, se o app estiver em `https://usuario.github.io/meu-treino/`, o RP ID deve corresponder ao domínio `usuario.github.io` e a origin deve ser `https://usuario.github.io`.

O navegador/sistema operacional realiza a autenticação. O aplicativo não acessa câmera, Face ID, Touch ID ou dados biométricos.

O usuário primeiro cria/entra na conta com e-mail e senha e, já autenticado, ativa a passkey em **Configurações → Conta**. Depois pode usar **Entrar com Face ID / biometria** na tela de login.

Se o navegador/dispositivo não oferecer WebAuthn/Passkeys, o login tradicional continua disponível.

## RLS

As tabelas pessoais usam `auth.uid()` e continuam protegidas. Exercícios oficiais têm leitura pública autenticada por RLS; exercícios personalizados pertencem ao `user_id` do usuário.

As relações `workout_exercises` e `workout_sets` continuam protegidas por suas tabelas-pai.

## Edge Functions

As funções existentes continuam separadas:

```bash
supabase functions deploy ai-chat
supabase functions deploy youtube-search
```

Secrets:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (opcional)
- `YOUTUBE_API_KEY`

As funções continuam com JWT obrigatório.

## Teste de ponta a ponta

1. Execute a migration no Supabase.
2. Confirme que `public.exercises` contém os exercícios oficiais.
3. Configure `js/config.js`.
4. Publique o PWA.
5. Crie uma conta.
6. Marque "Lembrar minha conta".
7. Feche e reabra o PWA.
8. Confirme a sessão.
9. Abra **Treino Inteligente**.
10. Selecione grupos, objetivo, tempo, equipamento e nível.
11. Confirme visualmente os chips selecionados.
12. Clique em **GERAR TREINO**.
13. Confirme a mensagem de busca/geração.
14. Confirme que os exercícios vieram do banco.
15. Confira imagem/placeholder, séries, repetições, RIR, descanso e campos de carga/reps.
16. Clique em **Usar este treino**.
17. Confirme que o treino aparece em **Treino**.
18. Complete uma série e confirme o descanso de 40 s.
19. Confirme apito/vibração.
20. Finalize o treino e confirme o histórico.
21. Abra a imagem de um exercício e confirme fechamento pelo X.
22. Teste logout.
23. Cadastre uma passkey após novo login.
24. Faça logout e teste **Entrar com Face ID / biometria**.
25. Teste o fallback por e-mail/senha.
26. Teste offline: os dados locais continuam disponíveis; o gerador usa o último banco sincronizado/local de fallback.

## Observação importante

O repositório original não contém uma pasta `images/exercises/` no conjunto de arquivos fornecido. Por isso o código não remove nenhum caminho existente e usa `image_url` quando houver; quando não houver imagem, apresenta um placeholder funcional em vez de quebrar o card.

