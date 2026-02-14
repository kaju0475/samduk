const fs = require('fs');
const path = require('path');

const dirsToDelete = [
    'app/api/admin/tracker-test',
    'app/api/admin/tracker-test-v2',
    'app/api/admin/cleanup',
    'app/api/admin/cleanup-test-data'
];

console.log('🧹 Starting API cleanup...');

dirsToDelete.forEach(dir => {
    const fullPath = path.join(__dirname, '..', dir);
    try {
        if (fs.existsSync(fullPath)) {
            fs.rmSync(fullPath, { recursive: true, force: true });
            console.log(`✅ Deleted: ${dir}`);
        } else {
            console.log(`⚠️ Not Found: ${dir}`);
        }
    } catch (e) {
        console.error(`❌ Failed to delete ${dir}:`, e.message);
    }
});

console.log('🎉 API Cleanup script finished.');
