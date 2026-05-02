require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const newUserId = '0f573ef7-7ad9-45a0-9c4d-bb082a9cbcb7';

(async () => {
  try {
    const { data, error } = await supabase
      .from('providers_acting_drivers')
      .select('*')
      .eq('user_id', newUserId);
    if (error) {
      console.error('Fetch error:', error);
    } else {
      console.log('Fetch result:', JSON.stringify(data, null, 2));
    }
  } catch (e) {
    console.error('Exception:', e);
  }
})();
