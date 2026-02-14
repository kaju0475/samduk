const https = require('https');

const options = {
  hostname: 'api.github.com',
  path: '/repos/kaju0475/samduk/actions/artifacts',
  method: 'GET',
  headers: {
    'User-Agent': 'Samduk-System-Test-Script',
    'Accept': 'application/vnd.github.v3+json'
  }
};

console.log(`Sending request to https://${options.hostname}${options.path}...`);

const req = https.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (res.statusCode === 200) {
        console.log('✅ Access Successful!');
        console.log('Total Artifacts:', json.total_count);
        if (json.artifacts && json.artifacts.length > 0) {
            console.log('\nLast 5 Artifacts:');
            json.artifacts.slice(0, 5).forEach(art => {
                console.log(`- [${art.created_at}] ${art.name} (${(art.size_in_bytes / 1024).toFixed(2)} KB)`);
            });
        } else {
            console.log('No artifacts found.');
        }
      } else {
        console.log('❌ Request Failed');
        console.log('Message:', json.message);
        if (res.statusCode === 401 || res.statusCode === 403) {
            console.log('\n⚠️  Auth Required: It seems we need a GITHUB_TOKEN to list artifacts.');
        }
      }
    } catch (e) {
      console.log('Error parsing JSON:', e.message);
      console.log('Raw Data:', data);
    }
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.end();
