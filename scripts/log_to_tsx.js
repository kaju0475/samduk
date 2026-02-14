const fs = require('fs');
const path = require('path');

try {
    const logPath = path.join(__dirname, '..', 'git_deep_search.log');
    const content = fs.readFileSync(logPath, 'utf8');
    
    // Wrap in TSX comment
    const tsxContent = `/* 
    Updated: ${new Date().toISOString()}
    --------------------------------------------------
    ${content.replace(/\*\//g, '* /')} 
    --------------------------------------------------
    */
    export const log = "debug";
    `;

    const outPath = path.join(__dirname, '..', 'components', 'debug_log.tsx');
    fs.writeFileSync(outPath, tsxContent);
    console.log("Log converted to TSX");
} catch (e) {
    console.error("Failed:", e.message);
}
