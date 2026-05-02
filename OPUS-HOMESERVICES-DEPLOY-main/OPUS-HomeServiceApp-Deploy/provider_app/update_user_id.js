require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const oldUserId = 'ad63b55e-bdfd-4fd5-9fce-075119797794';
const newUserId = '0f573ef7-7ad9-45a0-9c4d-bb082a9cbcb7';

(async () => {
  try {
    const { data, error } = await supabase
      .from('providers_acting_drivers')
      .update({ user_id: newUserId })
      .eq('user_id', oldUserId);
    if (error) {
      console.error('Update error:', error);
    } else {
      console.log('Update result:', data);
    }
  } catch (e) {
    console.error('Exception:', e);
  }
})();
