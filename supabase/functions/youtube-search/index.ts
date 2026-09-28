import { withSupabase } from "npm:@supabase/server";

export default {
  fetch: withSupabase({ auth: "user" }, async (req) => {
    try {
      const { query } = await req.json();
      const q = String(query || "").trim();
      if (!q) return Response.json({ error: "Busca vazia." }, { status: 400 });

      const key = Deno.env.get("YOUTUBE_API_KEY");
      if (!key) return Response.json({ error: "YOUTUBE_API_KEY não configurada na Edge Function youtube-search." }, { status: 500 });

      const url = new URL("https://www.googleapis.com/youtube/v3/search");
      url.search = new URLSearchParams({
        part: "snippet", q, type: "video", maxResults: "5", videoEmbeddable: "true", key
      }).toString();

      const response = await fetch(url);
      const data = await response.json();
      if (!response.ok) return Response.json({ error: data?.error?.message || `YouTube respondeu HTTP ${response.status}.` }, { status: response.status });

      const items = (data.items || []).map((x: any) => ({
        videoId: x.id?.videoId,
        title: x.snippet?.title,
        channel: x.snippet?.channelTitle,
        thumbnail: x.snippet?.thumbnails?.medium?.url || x.snippet?.thumbnails?.default?.url,
        url: `https://www.youtube.com/watch?v=${x.id?.videoId}`
      })).filter((x: any) => x.videoId);

      return Response.json({ items });
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
  })
};
