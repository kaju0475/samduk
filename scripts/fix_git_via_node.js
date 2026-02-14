const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const LOG_FILE = path.join(__dirname, '..', 'git_fix_node.log');
const TOKEN = "YOUR_GITHUB_TOKEN";
const REPO = "github.com/kaju0475/samduk.git";
const REMOTE = `https://${TOKEN}@${REPO}`;

// Clear log
fs.writeFileSync(LOG_FILE, `[START] Git Fix via Node at ${new Date().toISOString()}\n`);

function log(msg) {
    console.log(msg);
    fs.appendFileSync(LOG_FILE, msg + '\n');
}

async function findGit() {
    log("[INFO] Hunting for Git...");
    
    // 1. Check PATH
    try {
        await runCommand('git', ['--version'], process.cwd());
        log("[INFO] Found Git in PATH");
        return 'git';
    } catch (e) {
        log("[WARN] Git not in PATH");
    }

    // 2. Check Common Paths
    const candidates = [
        `C:\\Program Files\\Git\\cmd\\git.exe`,
        `C:\\Program Files\\Git\\bin\\git.exe`,
        `C:\\Program Files (x86)\\Git\\cmd\\git.exe`,
        `C:\\Program Files (x86)\\Git\\bin\\git.exe`,
        path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Git', 'cmd', 'git.exe'),
        path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Git', 'bin', 'git.exe'),
        `C:\\Git\\cmd\\git.exe`,
        `C:\\Git\\bin\\git.exe`
    ];

    for (const p of candidates) {
        if (fs.existsSync(p)) {
            log(`[INFO] Found Git at: ${p}`);
            return p;
        }
    }

    throw new Error("Git executable NOT FOUND in any common location.");
}

function runCommand(cmd, args, cwd) {
    return new Promise((resolve, reject) => {
        log(`[EXEC] "${cmd}" ${args.join(' ')}`);
        // Quote cmd if it has spaces and is not just 'git'
        const commandToRun = cmd.includes(' ') ? `"${cmd}"` : cmd;
        
        const proc = spawn(commandToRun, args, { cwd, shell: true });

        proc.stdout.on('data', (data) => log(`[STDOUT] ${data.toString().trim()}`));
        proc.stderr.on('data', (data) => log(`[STDERR] ${data.toString().trim()}`));

        proc.on('close', (code) => {
            log(`[EXIT] Code ${code}`);
            if (code === 0) resolve();
            else reject(new Error(`Command failed with code ${code}`));
        });

        proc.on('error', (err) => {
            log(`[ERROR-SPAWN] ${err.message}`);
            reject(err);
        });
    });
}

async function main() {
    const root = path.join(__dirname, '..');
    
    try {
        const gitCmd = await findGit();

        // Kill Git
        try {
            await runCommand('taskkill', ['/F', '/IM', 'git.exe'], root);
        } catch (e) {}

        // Reset
        if (fs.existsSync(path.join(root, '.git', 'index.lock'))) {
            fs.unlinkSync(path.join(root, '.git', 'index.lock'));
            log("[INFO] Deleted index.lock");
        }

        // Unset helper
        try {
             await runCommand(gitCmd, ['config', '--local', '--unset', 'credential.helper'], root);
        } catch(e) {}

        await runCommand(gitCmd, ['rm', '-r', '--cached', '.'], root);
        await runCommand(gitCmd, ['add', '.'], root);
        await runCommand(gitCmd, ['commit', '-m', "fix: found git and pushed"], root);

        // Push
        log("[INFO] Pushing...");
        await runCommand(gitCmd, ['remote', 'set-url', 'origin', REMOTE], root);
        await runCommand(gitCmd, ['push', '-f', 'origin', 'main'], root);

        log("[SUCCESS] All steps completed.");
    } catch (err) {
        log(`[FATAL] Script failed: ${err.message}`);
        process.exit(1);
    }
}

main();
