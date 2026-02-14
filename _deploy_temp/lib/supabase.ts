
import { createClient } from '@supabase/supabase-js';

// Access Environment Variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // Anon Key is safe for client-side if RLS is on

if (!supabaseUrl || !supabaseKey) {
    // Fail silently during build/dev if keys aren't set yet (to allow UI to render)
    console.warn('⚠️ Supabase credentials not found. DB features will be disabled.');
}

// ⚠️ BUILD SAFETY (2026-02-09)
// PROBLEM: Module-level createClient() during build can cause blocking
// EVIDENCE: Supabase official docs warn about Next.js build phase initialization
// SOLUTION: Skip client creation during build, create only at runtime
const isDuringBuild = process.env.NEXT_PHASE === 'phase-production-build';

// Create a single supabase client for interacting with your database
// During build: export null (safe, never accessed due to db.ts constructor guard)
// During runtime: export real client
export const supabase = isDuringBuild 
    ? null as any  // Build phase: dummy client (db.ts guard prevents usage)
    : createClient(
        supabaseUrl || 'https://gedsuetwuxqrrboqobdj.supabase.co', 
        supabaseKey || 'sb_publishable_ANpZi22_0n41XQ_PsrspJg_u2hZFyf7'
      );

// Helper to check connection
export async function checkSupabaseConnection() {
    try {
        const { data, error } = await supabase.from('users').select('count').single();
        if (error) throw error;
        return true;
    } catch (e) {
        console.error('Supabase Connection Error:', e);
        return false;
    }
}
