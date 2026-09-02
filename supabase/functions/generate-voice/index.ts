import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-engine-key",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Polling request
    if (body.id) {
      return new Response(JSON.stringify({ status: "completed", url: "", id: body.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clone request
    if (body.clone) {
      return new Response(JSON.stringify({ voice_id: "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate voice request
    return new Response(JSON.stringify({ error: "No provider configured" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
