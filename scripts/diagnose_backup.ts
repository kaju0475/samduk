
import fetch from 'node-fetch';

async function diagnose() {
    const url = 'https://samduk.vercel.app/api/system/backup/now';
    const secret = 'auto-45d250ff-8b75-4e5f-b802-b309f02b593f';

    console.log(`Testing URL: ${url}`);
    
    try {
        const start = Date.now();
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${secret}`
            }
        });
        const duration = Date.now() - start;

        console.log(`Status: ${response.status} ${response.statusText}`);
        console.log(`Duration: ${duration}ms`);
        
        const text = await response.text();
        console.log(`Body Preview: ${text.substring(0, 500)}...`);
        
    } catch (error) {
        console.error('Fetch Error:', error);
    }
}

diagnose();
