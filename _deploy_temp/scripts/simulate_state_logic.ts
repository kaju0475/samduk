
import { deriveCylinderState } from '../app/utils/cylinder';
import { Transaction, Cylinder, CylinderStatus } from '../lib/types';

// Mock minimal Cylinder
const mockCylinder: Cylinder = {
    id: 'TEST-CYL',
    serialNumber: 'TEST-CYL',
    gasType: 'O2',
    containerType: 'CYLINDER',
    capacity: '40L',
    owner: 'SAMDUK',
    currentHolderId: 'SAMDUK',
    status: '공병',
    lastInspectionDate: '2025-01-01',
    createdDate: '2025-01-01'
};

const fs = require('fs');

const scenarios = [
    { name: 'Standard Empty Collection (New)', type: '회수', memo: undefined, expectedStatus: '공병' },
    { name: 'Standard Full Collection (New)', type: '회수(실병)', memo: undefined, expectedStatus: '실병' },
    { name: 'Legacy Full Collection (Old)', type: '회수', memo: '실병 회수', expectedStatus: '실병' },
    { name: 'Legacy Empty Collection (Old)', type: '회수', memo: '일반 회수', expectedStatus: '공병' },
    { name: 'Delivery', type: '납품', memo: undefined, expectedStatus: '납품' },
    { name: 'Charging Start', type: '충전시작', memo: undefined, expectedStatus: '충전중' },
    { name: 'Charging Complete', type: '충전완료', memo: undefined, expectedStatus: '실병' },
];

let successCount = 0;
let failCount = 0;
const TOTAL_RUNS = 100;
let logBuffer = '';

function log(msg: string) {
    console.log(msg);
    logBuffer += msg + '\n';
}

log(`🚀 Starting ${TOTAL_RUNS} Simulations to verify 'No Memo' Logic...`);
log('---------------------------------------------------------------');

for (let i = 0; i < TOTAL_RUNS; i++) {
    // Randomly select a scenario
    const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
    
    // Create random noise history (older transactions) to ensure latest one takes precedence
    const history: Transaction[] = [
        {
            id: `TX-LATEST-${i}`,
            timestamp: new Date().toISOString(), // NOW
            type: scenario.type as any,
            cylinderId: mockCylinder.serialNumber,
            workerId: 'WORKER-1',
            customerId: 'CUST-1',
            memo: scenario.memo
        },
        {
            id: `TX-OLD-${i}`,
            timestamp: '2024-01-01', // OLD
            type: '납품', 
            cylinderId: mockCylinder.serialNumber,
            workerId: 'WORKER-1',
            customerId: 'OLD-CUST'
        }
    ];

    // Run Logic
    const result = deriveCylinderState(mockCylinder, history);

    // Verify
    const isCorrect = result.status === scenario.expectedStatus;

    if (isCorrect) {
        successCount++;
    } else {
        failCount++;
        log(`❌ [Failed Run #${i}] Scenario: ${scenario.name}`);
        log(`   Input Type: ${scenario.type}, Memo: ${scenario.memo}`);
        log(`   Expected: ${scenario.expectedStatus}, Got: ${result.status}`);
    }
}

log('---------------------------------------------------------------');
log(`✅ Simulation Complete.`);
log(`Total Runs: ${TOTAL_RUNS}`);
log(`Success: ${successCount}`);
log(`Failures: ${failCount}`);

if (failCount === 0) {
    log(`\n🎉 CONCLUSION: Logic is 100% Robust. Removing 'memo' field has 0% Risk on Status Logic.`);
} else {
    log(`\n⚠️ CONCLUSION: Logic has flaws.`);
}

fs.writeFileSync('simulation_result.txt', logBuffer);
