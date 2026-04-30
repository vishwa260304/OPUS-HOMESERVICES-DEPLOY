import { supabase } from './supabase';

// Script to update provider_service_mapping with real company IDs
export const updateMappingWithRealCompanies = async () => {
  try {
    console.log('🔧 Updating mapping with real company IDs...');
    
    // Get all existing company verifications
    const { data: companies, error: companiesError } = await supabase
      .from('providers_company_verification')
      .select('id, company_name')
      .order('created_at');
    
    if (companiesError) {
      console.error('❌ Error fetching companies:', companiesError);
      return;
    }
    
    if (!companies || companies.length === 0) {
      console.log('❌ No companies found in providers_company_verification table');
      return;
    }
    
    console.log(`📋 Found ${companies.length} companies:`, companies.map(c => ({ id: c.id, name: c.company_name })));
    
    // Get all mapping records
    const { data: mappings, error: mappingsError } = await supabase
      .from('provider_service_mapping')
      .select('id, service_name, company_id');
    
    if (mappingsError) {
      console.error('❌ Error fetching mappings:', mappingsError);
      return;
    }
    
    console.log(`📋 Found ${mappings?.length || 0} mapping records`);
    
    // Update each mapping with a real company ID
    if (mappings && mappings.length > 0) {
      for (let i = 0; i < mappings.length; i++) {
        const mapping = mappings[i];
        const companyIndex = i % companies.length; // Cycle through companies
        const companyId = companies[companyIndex].id;
        
        console.log(`🔄 Updating ${mapping.service_name} with company ${companies[companyIndex].company_name}`);
        
        const { data: updateResult, error: updateError } = await supabase
          .from('provider_service_mapping')
          .update({ company_id: companyId })
          .eq('id', mapping.id)
          .select();
        
        if (updateError) {
          console.error(`❌ Error updating ${mapping.service_name}:`, updateError);
        } else {
          console.log(`✅ Updated ${mapping.service_name}:`, updateResult);
        }
      }
    }
    
    console.log('🎉 All mappings updated with real company IDs!');
    
  } catch (error) {
    console.error('❌ Script error:', error);
  }
};

// Call this function to update all mappings
// updateMappingWithRealCompanies();
