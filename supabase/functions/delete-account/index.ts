// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Ensure method is POST or DELETE
    if (req.method !== 'POST' && req.method !== 'DELETE') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get the auth header containing the user's JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing Authorization header')
    }

    // @ts-ignore
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    // @ts-ignore
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    // @ts-ignore
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables')
    }

    // Create a client with the user's JWT to verify their identity
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: userError } = await userClient.auth.getUser()

    if (userError || !user) {
      throw new Error('Unauthorized or invalid token')
    }

    // Create an admin client using the service role key
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    // Delete the user using the admin API
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id)

    if (deleteError) {
      console.error('Error deleting user:', deleteError)
      throw deleteError
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Account successfully deleted' }),
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
