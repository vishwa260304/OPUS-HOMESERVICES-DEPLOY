// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { messages, systemPrompt } = await req.json()
    const apiKey = Deno.env.get('GEMINI_API_KEY')

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set in Supabase Secrets')
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    // Gemini expects 'user' and 'model' roles. 
    // We also need to prepend the system prompt if provided.
    let geminiMessages = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: m.parts
    }))

    // Prepend system prompt to the first user message or as a separate instruction if supported
    // For simplicity with gemini-pro/flash, we can prepend it to the context
    if (systemPrompt && geminiMessages.length > 0) {
      geminiMessages[0].parts[0].text = `System Instructions: ${systemPrompt}\n\nUser Question: ${geminiMessages[0].parts[0].text}`;
    }

    // Start chat with history (all but the last message)
    const chat = model.startChat({
      history: geminiMessages.slice(0, -1),
    })

    // Send the last message
    const lastMessage = geminiMessages[geminiMessages.length - 1].parts[0].text
    const result = await chat.sendMessage(lastMessage)
    const response = await result.response
    const text = response.text()

    return new Response(
      JSON.stringify({ reply: text }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Edge Function Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
