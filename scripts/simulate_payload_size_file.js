
const fs = require('fs');

function run() {
    const logFile = 'payload_size_test.txt';
    fs.writeFileSync(logFile, ''); // clear file
    
    function log(msg) {
        console.log(msg);
        fs.appendFileSync(logFile, msg + '\n');
    }

    log('🧪 Generating 30,000 dummy cylinder records...');
    
    const cylinders = [];
    for (let i = 0; i < 30000; i++) {
        cylinders.push({
            id: `cyl_${i}`,
            serialNumber: `SDG-${100000 + i}`,
            gasType: 'Oxygen',
            status: 'Delivered',
            currentHolderId: 'cust_123',
            owner: 'SAMDUK',
            chargingExpiryDate: '2027-12-31',
            lastInspectionDate: '2024-01-01',
            capacity: '40L',
            containerType: 'General',
            isDeleted: false,
            workId: null
        });
    }

    const backupData = {
        metadata: { timestamp: new Date().toISOString(), version: '2.1' },
        data: {
            users: [],
            customers: [], 
            cylinders: cylinders,
            transactions: [],
            gasItems: [],
            dailyLedgerNotes: [],
            systemConfig: {},
            companySettings: {}
        }
    };

    const jsonString = JSON.stringify(backupData);
    const sizeBytes = Buffer.byteLength(jsonString);
    const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);

    log(`📊 Payload Size for 30,000 cylinders: ${sizeMB} MB`);
    
    if (sizeMB > 4.5) {
        log('🚨 VIOLATION: Exceeds Vercel Serverless Function Limit (4.5 MB)');
        log('   This confirms why exit code 22 (HTTP Error) occurs.');
    } else {
        log('✅ Size is within limits.');
    }

    // 30k transactions
    const transactions = [];
    for (let i = 0; i < 30000; i++) {
        transactions.push({
            id: `tx_${i}`,
            timestamp: new Date().toISOString(),
            type: 'DELIVERY',
            cylinderId: `cyl_${i}`,
            customerId: `cust_123`,
            workerId: 'SYSTEM',
            isManual: false
        });
    }
    
    backupData.data.transactions = transactions;
    const totalString = JSON.stringify(backupData);
    const totalSizeMB = (Buffer.byteLength(totalString) / 1024 / 1024).toFixed(2);
    
    log(`📊 Total Payload (30k Cyl + 30k Tx): ${totalSizeMB} MB`);
}

run();
