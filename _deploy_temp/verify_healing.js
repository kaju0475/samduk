
const { TransactionValidator } = require('./lib/transaction-validator');

const dirtyCylinders = [
    { id: 'TEST-001', serial_number: 'SN-001', status: 'GOOD' }, // Invalid status 'GOOD'
    { serial_number: 'SN-002', location: 'Customer-A' }, // Missing ID
    { id: 'TEST-003', volume: '20L', expiry: '2026-12' } // Legacy fields
];

console.log('--- Testing Cylinder Sanitization ---');
const cleanCyls = TransactionValidator.sanitizeCylinders(dirtyCylinders);
console.log('Cleaned Cylinders:', JSON.stringify(cleanCyls, null, 2));
console.log('Healing Logs (Cyl):', TransactionValidator.healingLogs);

TransactionValidator.healingLogs = []; // Reset

const dirtyCustomers = [
    { name: 'Old Customer', manager: 'Mr. Hong' }, // Missing ID and legacy manager
];

console.log('\n--- Testing Customer Sanitization ---');
const cleanCus = TransactionValidator.sanitizeCustomers(dirtyCustomers);
console.log('Cleaned Customers:', JSON.stringify(cleanCus, null, 2));
console.log('Healing Logs (Cus):', TransactionValidator.healingLogs);
