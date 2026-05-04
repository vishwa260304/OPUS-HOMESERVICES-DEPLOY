import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req) => {
  try {
    const { message } = await req.json();

    const apiKey = Deno.env.get("GEMINI_API_KEY");

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: message }],
            },
          ],
        }),
      }
    );

    const data = await res.json();

    // 🔥 Debug log (important)
    console.log("Gemini raw response:", JSON.stringify(data));

    let reply = "No response";

    if (data?.candidates?.length > 0) {
      const parts = data.candidates[0]?.content?.parts;
      if (parts && parts.length > 0) {
        reply = parts.map((p: any) => p.text).join(" ");
      }
    }

    return new Response(JSON.stringify({ reply }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Something went wrong" }),
      { status: 500 }
    );
  }
});