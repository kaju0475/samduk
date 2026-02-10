const { createClient } = require('@supabase/supabase-js');

// Hardcoded for Diagnosis
// Hardcoded for Diagnosis
const supabaseUrl = 'https://gedsuetwuxqrrboqobdj.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlZHN1ZXR3dXhxcnJib3FvYmRqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODY0NTkwOCwiZXhwIjoyMDg0MjIxOTA4fQ.wRzsiBbVV5BMWm4PKNSL8rjnqEPlFMGTuenFwWt1meE';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function listUsers() {
  console.log('--- STARTING USER INSPECTION ---');
  try {
      const { data, error } = await supabase
        .from('users')
        .select('*');

      if (error) {
        console.error('CRITICAL ERROR fetching users:', error);
      } else {
        console.log(`Total Users Found: ${data.length}`);
        
        // Check specifically for the problematic ID
        const targetId = '1769573754880';
        let match = null;
        
        data.forEach(u => {
            console.log(`User: ID=[${u.id}] Name=[${u.name}] Username=[${u.username}]`);
            if (u.id == targetId || u.username == targetId) match = u;
        });

        if (match) {
            console.log(`\n!!! MATCH FOUND !!! ->`, match);
        } else {
            console.log(`\n!!! NO MATCH FOUND for ${targetId} !!!`);
        }
      }
  } catch (e) {
      console.error('EXCEPTION:', e);
  }
  console.log('--- FINISHED ---');
}

listUsers();
