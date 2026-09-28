import { withSupabase } from "npm:@supabase/server";

const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};

function safePrompt(body:any){
  return `Você é o assistente do aplicativo Meu Treino. Responda em português do Brasil.
Regras: não diagnostique doenças/lesões, não prescreva tratamento, não substitua médico, fisioterapeuta ou profissional de educação física; não incentive treino diante de dor intensa, trauma, inchaço importante, perda de força ou sintomas preocupantes; não invente exercícios como se estivessem no banco; não invente cargas específicas sem base; respeite equipamentos e exercícios enviados.
Contexto controlado:
${JSON.stringify({question:body.question,workout:body.workout,exercises:body.exercises,recentSessions:body.recentSessions,settings:body.settings})}`;
}

export default {
  fetch: withSupabase({auth:"user"}, async (req, ctx) => {
    if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
    try{
      const body=await req.json();
      const key=Deno.env.get("OPENAI_API_KEY");
      if(!key) return new Response(JSON.stringify({error:"OPENAI_API_KEY não configurada"}),{status:500,headers:{...cors,"Content-Type":"application/json"}});
      const model=Deno.env.get("OPENAI_MODEL")||"gpt-5";
      const response=await fetch("https://api.openai.com/v1/responses",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${key}`},
        body:JSON.stringify({model,input:safePrompt(body)})
      });
      const data=await response.json();
      if(!response.ok) return new Response(JSON.stringify({error:data?.error?.message||"Erro na IA"}),{status:response.status,headers:{...cors,"Content-Type":"application/json"}});
      const answer=data.output_text||data.output?.flatMap((x:any)=>x.content||[]).map((x:any)=>x.text||"").join("\n")||"";
      await ctx.supabase.from("ai_conversations").insert({user_id:ctx.userClaims?.sub,question:body.question,answer});
      return new Response(JSON.stringify({answer}),{headers:{...cors,"Content-Type":"application/json"}});
    }catch(e){
      return new Response(JSON.stringify({error:String(e)}),{status:500,headers:{...cors,"Content-Type":"application/json"}});
    }
  })
};