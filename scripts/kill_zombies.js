const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 1. 환경 변수 로드
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, val] = line.split('=');
    if (key && val) env[key.trim()] = val.trim().replace(/"/g, '');
});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Supabase 환경 변수 로드 실패');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function killZombies() {
    console.log('🧟‍♂️ [Zombie Killer] Supabase 접속 중...');

    // 1. Transactions 삭제
    console.log('🔫 Transactions(거래 기록) 사냥 중...');
    // PROD- 용기와 관련된 모든 트랜잭션 찾기보다, 일단 workerId나 cylinderId 패턴으로 삭제
    // 하지만 Supabase delete는 필터링이 중요.
    
    const patterns = ['PROD-', 'TEST-', 'SIMULATOR'];
    
    for (const p of patterns) {
        // 관련된 트랜잭션 삭제 (workerId 기준)
        const { count: txCount, error: txError } = await supabase
            .from('transactions')
            .delete({ count: 'exact' })
            .ilike('workerId', `%${p}%`);
        
        if (txError) console.error(`❌ Transaction 삭제 에러 (${p}):`, txError.message);
        else if (txCount > 0) console.log(`   ⚰️  Transaction 삭제됨 (${p}): ${txCount}건`);
    }

    // 2. Cylinder 삭제 (가장 중요)
    console.log('🔫 Cylinders(용기) 사냥 중...');
    for (const p of patterns) {
        const { count: cylCount, error: cylError } = await supabase
            .from('cylinders')
            .delete({ count: 'exact' })
            .ilike('serial_number', `${p}%`); // PROD-% 로 시작하는 것

        if (cylError) console.error(`❌ Cylinder 삭제 에러 (${p}):`, cylError.message);
        else console.log(`   ⚰️  Cylinder 삭제됨 (${p}): ${cylCount || 0}건`);
        
        // ID 필터로도 시도
        await supabase.from('cylinders').delete().ilike('id', `${p}%`);
    }

    // 3. Customers 삭제
    console.log('🔫 Customers(거래처) 사냥 중...');
    // TestCust_, PROD_TEST_ 등
    const custPatterns = ['TestCust', 'PROD_TEST', 'ProbeTest'];
    for (const p of custPatterns) {
        const { count: custCount, error: custError } = await supabase
            .from('customers')
            .delete({ count: 'exact' })
            .ilike('name', `%${p}%`);
            
        if (custError) console.error(`❌ Customer 삭제 에러 (${p}):`, custError.message);
        else if (custCount > 0) console.log(`   ⚰️  Customer 삭제됨 (${p}): ${custCount}건`);
    }

    // ==========================================
    // [ADD] 로컬 db.json 직접 타격 (파일 수술)
    // ==========================================
    console.log('\n🏥 [Local File Surgery] db.json 직접 수술 시작...');
    const dbPath = path.join(__dirname, '..', 'db.json');
    
    if (fs.existsSync(dbPath)) {
        try {
            const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
            let deletedCount = 0;
            
            // 1. Cylinders 필터링
            if (dbData.cylinders && Array.isArray(dbData.cylinders)) {
                const initialLen = dbData.cylinders.length;
                dbData.cylinders = dbData.cylinders.filter(c => {
                    const serial = c.serialNumber || c.id || '';
                    // PROD-, VERIFY-, TEST- 등으로 시작하면 삭제
                    const isZombie = serial.startsWith('PROD-') || serial.startsWith('VERIFY-') || serial.startsWith('TEST-');
                    return !isZombie;
                });
                deletedCount += (initialLen - dbData.cylinders.length);
            }
            
            // 2. 파일 저장
            if (deletedCount > 0) {
                fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2), 'utf8');
                console.log(`✅ [Local] db.json에서 좀비 데이터 ${deletedCount}건 적출 및 소각 완료.`);
            } else {
                console.log('✨ [Local] db.json은 이미 깨끗합니다.');
            }
        } catch (err) {
            console.error('❌ [Local] db.json 수정 중 오류:', err);
        }
    } else {
        console.log('⚠️ db.json 파일이 없습니다 (건너뜀)');
    }

    console.log('🏁 [Mission Complete] 모든 좀비 사냥 완료.');
}

killZombies();
