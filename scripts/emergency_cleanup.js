const fs = require('fs');
const path = require('path');
const https = require('https');

// 1. 환경 변수 로드 (dotenv 없이 수동 파싱)
function loadEnv() {
    const envPath = path.join(__dirname, '..', '.env.local');
    if (!fs.existsSync(envPath)) {
        console.error("❌ .env.local 파일을 찾을 수 없습니다.");
        process.exit(1);
    }
    const content = fs.readFileSync(envPath, 'utf8');
    const env = {};
    content.split('\n').forEach(line => {
        const [key, val] = line.split('=');
        if (key && val) env[key.trim()] = val.trim().replace(/"/g, ''); // 따옴표 제거
    });
    return env;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Supabase 설정이 없습니다.");
    process.exit(1);
}

// 2. Supabase 요청 헬퍼 (fetch 대신 https 사용 - 의존성 최소화)
function supabaseRequest(endpoint, method, body = null) {
    return new Promise((resolve, reject) => {
        // [FIX] Supabase PostgREST API 경로는 /rest/v1 이 포함되어야 합니다.
        const url = new URL(`${SUPABASE_URL}/rest/v1${endpoint}`);
        const options = {
            method: method,
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        };

        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data || '{}'));
                    } catch (e) {
                        resolve({});
                    }
                } else {
                    reject(`Status: ${res.statusCode}, Body: ${data}`);
                }
            });
        });

        req.on('error', (e) => reject(e));
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

// 3. 패턴 정의
const TARGET_PATTERNS = {
    transactions: ['SIMULATOR_BOT', 'SIMULATOR', 'SIM-STRESS', 'VERIFY-', 'SD-TEST'],
    cylinders: ['TEST-SIM', 'SIMULATOR', 'SIM-STRESS', 'VERIFY-', 'SD-TEST', 'PROD-'],
    customers: ['TestCust_', 'PROD_TEST_', 'ProbeTest', 'TestCustomer']
};

async function main() {
    console.log("🚨 [비상 모드] 데이터 정리 시작...");

    // --- A. Local DB (db.json) 정리 ---
    const dbPath = path.join(__dirname, '..', 'db.json');
    if (fs.existsSync(dbPath)) {
        console.log("📂 Local DB(db.json) 정리 중...");
        let db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        let originalCounts = {
            tx: db.transactions?.length || 0,
            cyl: db.cylinders?.length || 0,
            cust: db.customers?.length || 0
        };

        // Filter
        if (db.transactions) {
            db.transactions = db.transactions.filter(t => !TARGET_PATTERNS.transactions.some(p => t.workerId && t.workerId.includes(p)));
        }
        if (db.cylinders) {
            db.cylinders = db.cylinders.filter(c => !TARGET_PATTERNS.cylinders.some(p => (c.serialNumber && c.serialNumber.startsWith(p)) || (c.id && c.id.startsWith(p))));
        }
        if (db.customers) {
            db.customers = db.customers.filter(c => !TARGET_PATTERNS.customers.some(p => c.name && c.name.includes(p)));
        }

        const deletedCounts = {
            tx: originalCounts.tx - (db.transactions?.length || 0),
            cyl: originalCounts.cyl - (db.cylinders?.length || 0),
            cust: originalCounts.cust - (db.customers?.length || 0)
        };

        if (deletedCounts.tx > 0 || deletedCounts.cyl > 0 || deletedCounts.cust > 0) {
            // 백업 생성
            fs.copyFileSync(dbPath, dbPath + '.bak_' + Date.now());
            fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
            console.log(`✅ Local DB 정리 완료: TX -${deletedCounts.tx}, CYL -${deletedCounts.cyl}, CUST -${deletedCounts.cust}`);
        } else {
            console.log("✅ Local DB는 이미 깨끗합니다.");
        }
    } else {
        console.log("⚠️ db.json이 없습니다. 넘어갑니다.");
    }

    // --- B. Supabase 정리 ---
    console.log("☁️ Supabase 정리 중...");
    
    try {
        // Transactions
        for (const pattern of TARGET_PATTERNS.transactions) {
            // ilike 필터링이 REST API로는 까다로우므로, 단순화를 위해 직접 필터링하거나 
            // 여기서는 가장 확실한 'id' 기반이나 'workerId' eq 검색이 어렵다면
            // Supabase client 라이브러리 없이 Raw HTTP로 복잡한 쿼리는 어려움.
            // 하지만 사용자 요청이 급하므로, 가장 문제되는 'PROD-' 용기 위주로 처리.
            // * 중요: REST API로 'ilike' 쓰려면 operator 필요.
            // 간단하게: 로컬에서 지운 것과 동일한 로직을 적용하기 위해
            // 전체를 가져오기엔 너무 많으므로, 검색 쿼리를 잘 만들어야 함.
            // 여기서는 'PostgREST' 문법 사용: workerId=ilike.*PATTERN*
            
            await supabaseRequest(`/transactions?workerId=ilike.*${pattern}*`, 'DELETE');
        }
        
        // Cylinders
        for (const pattern of TARGET_PATTERNS.cylinders) {
            await supabaseRequest(`/cylinders?serial_number=ilike.${pattern}*`, 'DELETE');
            await supabaseRequest(`/cylinders?id=ilike.${pattern}*`, 'DELETE');
        }

        // Customers
        for (const pattern of TARGET_PATTERNS.customers) {
            await supabaseRequest(`/customers?name=ilike.*${pattern}*`, 'DELETE');
        }

        console.log("✅ Supabase 정리 요청 완료 (패턴 매칭 데이터 삭제됨)");
    } catch (e) {
        console.error("❌ Supabase 정리 실패:", e);
    }

    console.log("🎉 모든 작업 완료.");
}

main();
