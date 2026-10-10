import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req) => {
  const url = Deno.env.get("OMNIROUTE_URL");
  const key = Deno.env.get("OMNIROUTE_API_KEY");

  const response = await fetch(`${url}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`
    },
    body: JSON.stringify({
      model: Deno.env.get("OMNIROUTE_MODEL") || "dd-combo",
      messages: [
        { role: "user", content: "Hello from Supabase Edgetime!" }
      ]
    })
  });

  const data = await response.json();

  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" }
  });
});