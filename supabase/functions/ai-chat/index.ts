import { withSupabase } from "npm:@supabase/server";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    try {
      const body = await req.json();
      const question = String(body?.question || "").trim();
      if (!question) return Response.json({ error: "Pergunta vazia." }, { status: 400 });

      const key = Deno.env.get("OPENAI_API_KEY");
      if (!key) {
        return Response.json({ error: "OPENAI_API_KEY não configurada na Edge Function ai-chat." }, { status: 500 });
      }

      const model = Deno.env.get("OPENAI_MODEL") || "gpt-5.6-luna";
      const prompt = `Você é o assistente do aplicativo Meu Treino. Responda em português do Brasil.

Regras:
- Não diagnostique doenças ou lesões.
- Não prescreva tratamento médico.
- Não substitua médico, fisioterapeuta ou profissional de educação física.
- Não incentive treino diante de dor intensa, trauma, inchaço importante, perda de força ou sintomas preocupantes.
- Não invente exercícios como se estivessem no banco.
- Não invente cargas específicas sem base.
- Respeite os equipamentos e exercícios enviados.

Contexto do aplicativo:
${JSON.stringify({
  question,
  workout: body?.workout,
  exercises: body?.exercises,
  recentSessions: body?.recentSessions,
  settings: body?.settings
})}`;

      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`
        },
        body: JSON.stringify({
          model,
          input: prompt,
          max_output_tokens: 1200
        })
      });

      const data = await response.json();
      if (!response.ok) {
        return Response.json({ error: data?.error?.message || `OpenAI respondeu HTTP ${response.status}.` }, { status: response.status });
      }

      const answer = data?.output_text ||
        data?.output?.flatMap((x: any) => x?.content || [])
          ?.map((x: any) => x?.text || "")
          ?.join("\n") || "";

      if (!answer.trim()) {
        return Response.json({ error: "A OpenAI não retornou texto." }, { status: 502 });
      }

      const { error: saveError } = await ctx.supabase
        .from("ai_conversations")
        .insert({ user_id: ctx.userClaims?.sub, question, answer });

      if (saveError) console.warn("Não foi possível registrar a conversa:", saveError);

      return Response.json({ answer });
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
  })
};
