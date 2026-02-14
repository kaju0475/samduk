const fs = require('fs');
const { performance } = require('perf_hooks');

// Node.js v18+ 에서는 fetch가 내장이지만, 없을 경우를 대비하거나 확실하게 하기 위해
// 여기서는 일반적인 http 모듈이나 fetch를 사용.
// 하지만 사용자의 Node 버전을 모르므로 fetch가 안전함 (최신 Next.js 프로젝트이므로).

const BASE_URL = 'http://localhost:3000';
const CONCURRENCY = 10;
const TOTAL_REQUESTS = 50;
const OUTPUT_FILE = 'chaos_results.log';

// 로그 파일 초기화
fs.writeFileSync(OUTPUT_FILE, `🔥 Chaos Test Started at ${new Date().toISOString()}\n`);

function log(msg) {
    console.log(msg);
    fs.appendFileSync(OUTPUT_FILE, msg + '\n');
}

const scenarios = [
    { name: 'Health Check', url: '/api/system/check', method: 'GET' }, // 존재하지 않을 수 있음 -> 404 예상
    { name: 'Root Page', url: '/', method: 'GET' }, // 확실히 존재 (200)
    { name: 'Invalid Endpoint', url: '/api/chaos_random_404', method: 'GET' }, // 404
    { name: 'Login Fail', url: '/api/auth/login', method: 'POST', body: JSON.stringify({ username: 'hacker', password: '123' }) }
];

async function runScenario(id) {
    const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
    
    // 🎲 변수 1: 랜덤 네트워크 지연
    const delay = Math.floor(Math.random() * 1500);
    await new Promise(r => setTimeout(r, delay));

    const start = performance.now();
    try {
        const response = await fetch(`${BASE_URL}${scenario.url}`, {
            method: scenario.method,
            headers: { 'Content-Type': 'application/json' },
            body: scenario.body
        });
        
        const duration = performance.now() - start;
        const result = { 
            id, 
            scenario: scenario.name, 
            status: response.status, 
            duration: duration.toFixed(0) + 'ms',
            ok: response.ok
        };

        log(`[REQ ${id}] ${scenario.name}: ${result.status} (${result.duration})`);
        return result;

    } catch (e) {
        log(`[REQ ${id}] ${scenario.name}: NETWORK ERROR (${e.message})`);
        return { id, status: 'ERR', error: e.message };
    }
}

async function start() {
    const promises = [];
    for (let i = 0; i < TOTAL_REQUESTS; i++) {
        promises.push(runScenario(i));
        if (promises.length >= CONCURRENCY) {
            await Promise.all(promises);
            promises.length = 0;
        }
    }
    if (promises.length > 0) await Promise.all(promises);
    log('🏁 Chaos Test Completed');
}

start().catch(e => log(`FATAL ERROR: ${e}`));
