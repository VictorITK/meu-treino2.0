# Meu Treino PWA — v3

Versão evoluída do PWA existente, mantendo GitHub Pages e funcionamento offline.

## Principais mudanças
- Descanso padrão de 40 s com início automático e apito de 3 bipes via Web Audio API.
- Histórico completo de sessões.
- Memória da última carga e sugestão de progressão sem alteração automática.
- Imagens locais dos exercícios.
- Registro de peso e gráficos.
- Cardio associado ao treino.
- Fotos locais e comparação.
- Dashboard, calendário e evolução.
- Backup/restauração JSON.
- Tema claro/escuro/automático.
- Migração da estrutura antiga `localStorage.meuTreinoPWA`.
- Service Worker v3 com cache atualizado e limpeza de caches antigos.
- Workflow do GitHub Pages preservado/compatível.

## Observação sobre iPhone
O Web Audio precisa de uma interação do usuário para ser desbloqueado pelo Safari. O app inicializa o áudio ao iniciar o treino ou ao concluir uma série. O iOS pode suspender JavaScript e áudio quando a PWA fica realmente em segundo plano; por isso o app não promete áudio garantido durante suspensão completa do processo pelo sistema.

## Instalação
Substitua os arquivos do repositório pelos desta pasta e faça push para a branch configurada pelo workflow.


## Programa configurado no aplicativo

### Treino A — Membros superiores
1. Supino na máquina — 3×8–12 — RIR 2 — 120 s
2. Puxada frontal — 3×8–12 — RIR 2 — 120 s
3. Remada sentada — 3×8–12 — RIR 2 — 120 s
4. Desenvolvimento de ombros na máquina — 3×8–12 — RIR 2 — 120 s
5. Voador peitoral — 3×10–15 — RIR 1–2 — 90 s
6. Rosca direta com halteres — 2×10–15 — RIR 1–2 — 75 s
7. Rosca martelo com halteres — 2×10–15 — RIR 1–2 — 75 s
8. Tríceps na polia com corda — 2×10–15 — RIR 1–2 — 75 s

### Treino B — Membros inferiores
1. Leg Press — 4×8–12 — RIR 2 — 150 s
2. Cadeira flexora — 3×10–15 — RIR 2 — 105 s
3. Cadeira extensora — 3×10–15 — RIR 2 — 105 s
4. Hip thrust / máquina de glúteos — 3×8–12 — RIR 2 — 120 s
5. Cadeira abdutora — 2×12–15 — RIR 1–2 — 75 s
6. Panturrilha na máquina ou no leg press — 3×10–15 — RIR 1–2 — 75 s
7. Abdominal na máquina OU Pallof Press — 2×10–15 — RIR 2 — 75 s

O cronômetro global inicia em 40 segundos por padrão, conforme a especificação do aplicativo. O intervalo específico do exercício é aplicado automaticamente ao concluir uma série.
