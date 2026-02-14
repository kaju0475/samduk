
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { encryptToken } from '../app/lib/crypto';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('❌ Missing Environment Variables!');
    process.exit(1);
}

const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false }
});

async function main() {
    console.log('🔍 Starting QR Login Verification...');

    // 1. Fetch a real user to test with
    const { data: user, error } = await adminClient
        .from('users')
        .select('id, username, name')
        .limit(1)
        .single();

    if (error || !user) {
        console.error('❌ Failed to fetch test user:', error);
        process.exit(1);
    }

    console.log(`✅ Found Test User: ${user.name} (${user.username})`);

    // 2. Encrypt the User ID (Simulating Mobile App)
    // The mobile app sends "ENC-" + EncryptedString
    // But encryption logic might vary. Let's assume we are testing ID-based login.
    // The `encryptToken` function in `app/lib/crypto.ts` is used by the system.
    // We will use it to generate a valid token.
    
    // Note: The API expects `ENC-<ciphertext>`.
    // And `decryptToken` expects that format.
    
    const targetPayload = user.username; // Or user.id, depending on what we want to test. API supports both.
    console.log(`🔒 Encrypting payload: "${targetPayload}"`);

    const encrypted = encryptToken(targetPayload);
    const apiToken = `ENC-${encrypted}`;

    console.log(`📨 Sending Token to API: ${apiToken.substring(0, 20)}...`);

    // 3. Send Request to Local API
    try {
        const response = await fetch('http://localhost:3000/api/auth/qr-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: apiToken })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            console.log('🎉 Login Success!');
            console.log('   User:', result.user.name);
            
            // Check formatted details
            if (result.user.username === user.username) {
                console.log('   ✅ Username Match');
            } else {
                console.error('   ❌ Username Mismatch');
            }

            // Check Cookie
            const cookies = response.headers.get('set-cookie');
            if (cookies && cookies.includes('user=')) {
                console.log('   ✅ Session Cookie Set');
            } else {
                console.warn('   ⚠️ No Cookie Found in response headers (might be normal if fetch handles it differently, but usually safe to check)');
            }

        } else {
            console.error('❌ Login Failed:', result);
        }

    } catch (e: any) {
        console.error('❌ Network/API Error:', e.message);
        console.log('   (Ensure server is running at http://localhost:3000)');
    }
}

main();
