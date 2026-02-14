const fs = require('fs');
const path = require('path');

const TOKEN = "YOUR_GITHUB_TOKEN";
const OWNER = "kaju0475";
const REPO = "samduk";

async function updateFile(filePath, commitMessage) {
    const localPath = path.join(__dirname, '..', filePath);
    if (!fs.existsSync(localPath)) {
        console.error(`Local file not found: ${filePath}`);
        return;
    }

    const content = fs.readFileSync(localPath, 'base64');
    const apiUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`;

    // 1. Get current SHA
    console.log(`Getting SHA for ${filePath}...`);
    const getRes = await fetch(apiUrl, {
        headers: { 'Authorization': `token ${TOKEN}` }
    });
    
    let sha;
    if (getRes.status === 200) {
        const data = await getRes.json();
        sha = data.sha;
    }

    // 2. Put content
    console.log(`Updating ${filePath}...`);
    const putRes = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: commitMessage,
            content: content,
            sha: sha
        })
    });

    if (putRes.status === 200 || putRes.status === 201) {
        console.log(`Successfully updated ${filePath}`);
    } else {
        const error = await putRes.text();
        console.error(`Failed to update ${filePath}: ${error}`);
    }
}

async function main() {
    console.log("[START] GitHub API Sync (Bypassing Git)");
    await updateFile('app/api/system/backup/now/route.ts', 'fix: secure backup with streaming and secret');
    await updateFile('.github/workflows/system-backup-hourly.yml', 'fix: production url and secrets');
    console.log("[END] All files synchronized.");
}

main().catch(console.error);
