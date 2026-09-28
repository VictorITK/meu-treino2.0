import { withSupabase } from "npm:@supabase/server";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
export default {fetch:withSupabase({auth:"user"},async(req,ctx)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 try{
  const {query}=await req.json(); const key=Deno.env.get("YOUTUBE_API_KEY");
  if(!key)return new Response(JSON.stringify({error:"YOUTUBE_API_KEY não configurada"}),{status:500,headers:{...cors,"Content-Type":"application/json"}});
  const url=new URL("https://www.googleapis.com/youtube/v3/search");
  url.search=new URLSearchParams({part:"snippet",q:query,type:"video",maxResults:"3",videoEmbeddable:"true",key}).toString();
  const r=await fetch(url);const d=await r.json();if(!r.ok)throw Error(d?.error?.message||"Erro no YouTube");
  const items=(d.items||[]).map((x:any)=>({videoId:x.id.videoId,title:x.snippet.title,channel:x.snippet.channelTitle,thumbnail:x.snippet.thumbnails?.medium?.url||x.snippet.thumbnails?.default?.url,url:`https://www.youtube.com/watch?v=${x.id.videoId}`}));
  return new Response(JSON.stringify({items}),{headers:{...cors,"Content-Type":"application/json"}});
 }catch(e){return new Response(JSON.stringify({error:String(e)}),{status:500,headers:{...cors,"Content-Type":"application/json"}})}
})};