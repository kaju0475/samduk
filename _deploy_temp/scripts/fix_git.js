const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectDir = path.resolve(__dirname, '..');
const gitDir = path.join(projectDir, '.git');
const remoteUrl = 'https://github.com/kaju0475/samduk.git';

console.log(`Starting Git Recovery in: ${projectDir}`);

try {
    // 1. Force Remove .git directory
    if (fs.existsSync(gitDir)) {
        console.log('Found existing .git directory. Removing...');
        try {
            fs.rmSync(gitDir, { recursive: true, force: true });
            console.log('.git directory removed.');
        } catch (e) {
            console.error('Failed to remove .git directory via Node.js:', e.message);
            // Try system command if node fails (windows specific)
             try {
                execSync('rmdir /s /q .git', { cwd: projectDir, stdio: 'inherit' });
                 console.log('.git directory removed via system command.');
            } catch (e2) {
                 console.error('Failed to remove .git via system command:', e2.message);
            }
        }
    } else {
        console.log('.git directory not found. Proceeding...');
    }

    // 2. Git Init
    console.log('Executing: git init');
    execSync('git init', { cwd: projectDir, stdio: 'inherit' });

    // 3. Remote Add
    console.log(`Executing: git remote add origin ${remoteUrl}`);
    execSync(`git remote add origin ${remoteUrl}`, { cwd: projectDir, stdio: 'inherit' });

    // 4. Config (Optional but good for safety)
    execSync('git config core.ignorecase false', { cwd: projectDir, stdio: 'inherit' });

    // 5. Add
    console.log('Executing: git add .');
    execSync('git add .', { cwd: projectDir, stdio: 'inherit' });

    // 6. Commit
    console.log('Executing: git commit');
    execSync('git commit -m "hotfix: restore standard date picker and fix deployment"', { cwd: projectDir, stdio: 'inherit' });

    // 7. Push
    console.log('Executing: git push --force');
    execSync('git push -u origin master --force', { cwd: projectDir, stdio: 'inherit' });

    console.log('✅ Git Recovery and Deployment Success!');

} catch (error) {
    console.error('❌ Git Recovery Failed:', error.message);
    if (error.stdout) console.log('Stdout:', error.stdout.toString());
    if (error.stderr) console.error('Stderr:', error.stderr.toString());
    process.exit(1);
}
