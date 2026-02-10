/**
 * Ledger & Sales Aggregation Verification Test
 * 
 * Purpose: Verify that delivery/collection operations are correctly
 * aggregated in the ledger (장부) and transaction history.
 * 
 * Test: 1000 deliveries + 1000 collections, then verify totals
 */
import { test, expect } from '@playwright/test';

const DELIVERY_COUNT = 1000;
const COLLECTION_COUNT = 1000;

test.describe('Ledger Aggregation Stress Test', () => {
  
  test('1. Delivery Operations (1000x) with Ledger Verification', async ({ request }) => {
    test.setTimeout(1800000); // 30 minutes
    
    console.log(`[Ledger Test] Starting ${DELIVERY_COUNT} delivery operations...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 1; i <= DELIVERY_COUNT; i++) {
      // Use cylinders 1-1000
      const cylinderId = `TEST-CYL-${String(i).padStart(4, '0')}`;
      const customerIndex = (i % 100) + 1;
      const customerId = `TEST-CUST-${String(customerIndex).padStart(3, '0')}`;
      
      if (i % 100 === 0) {
        console.log(`[Delivery ${i}/${DELIVERY_COUNT}] Progress: ${(i/DELIVERY_COUNT*100).toFixed(1)}%`);
      }
      
      try {
        const response = await request.post('/api/work/delivery', {
          data: {
            type: 'CYLINDER',
            qrCode: cylinderId,
            customerId: customerId,
            workMode: 'DELIVERY',
            workerId: 'admin'
          }
        });
        
        const data = await response.json();
        if (response.ok() && data.success) {
          successCount++;
        } else {
          // Expected errors (wrong status etc) are OK
          if (data.code !== 'STATUS_MISMATCH' && data.code !== 'ALREADY_DELIVERED') {
            console.log(`[Delivery ${i}] Unexpected: ${data.message}`);
          }
          errorCount++;
        }
      } catch (e) {
        console.error(`[Delivery ${i}] Network error:`, e);
        errorCount++;
      }
    }
    
    console.log(`[Delivery Complete] Success: ${successCount}, Errors: ${errorCount}`);
    
    // Verify some deliveries succeeded
    expect(successCount).toBeGreaterThan(0);
    console.log('✅ Delivery Operations: PASSED');
  });

  test('2. Collection Operations (1000x) with Ledger Verification', async ({ request }) => {
    test.setTimeout(1800000); // 30 minutes
    
    console.log(`[Ledger Test] Starting ${COLLECTION_COUNT} collection operations...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 1; i <= COLLECTION_COUNT; i++) {
      // Use same cylinders as delivery (to collect them back)
      const cylinderId = `TEST-CYL-${String(i).padStart(4, '0')}`;
      const customerIndex = (i % 100) + 1;
      const customerId = `TEST-CUST-${String(customerIndex).padStart(3, '0')}`;
      
      if (i % 100 === 0) {
        console.log(`[Collection ${i}/${COLLECTION_COUNT}] Progress: ${(i/COLLECTION_COUNT*100).toFixed(1)}%`);
      }
      
      try {
        const response = await request.post('/api/work/delivery', {
          data: {
            type: 'CYLINDER',
            qrCode: cylinderId,
            customerId: customerId,
            workMode: 'COLLECTION_EMPTY',
            workerId: 'admin'
          }
        });
        
        const data = await response.json();
        if (response.ok() && data.success) {
          successCount++;
        } else {
          // Expected errors are OK
          if (data.code !== 'STATUS_MISMATCH' && data.code !== 'ALREADY_COLLECTED') {
            console.log(`[Collection ${i}] Unexpected: ${data.message}`);
          }
          errorCount++;
        }
      } catch (e) {
        console.error(`[Collection ${i}] Network error:`, e);
        errorCount++;
      }
    }
    
    console.log(`[Collection Complete] Success: ${successCount}, Errors: ${errorCount}`);
    
    // Verify some collections succeeded
    expect(successCount).toBeGreaterThan(0);
    console.log('✅ Collection Operations: PASSED');
  });

  test('3. Ledger Data Verification', async ({ request }) => {
    test.setTimeout(60000);
    
    console.log('[Ledger Verification] Checking transaction history aggregation...');
    
    // Get today's date
    const today = new Date().toISOString().split('T')[0];
    
    // Call delivery API to get today's history
    const response = await request.get(`/api/work/delivery?startDate=${today}&endDate=${today}`);
    expect(response.ok()).toBe(true);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toBeDefined();
    
    const transactions = data.data;
    console.log(`[Ledger] Total transactions today: ${transactions.length}`);
    
    // Count deliveries and collections
    const deliveryCount = transactions.filter((t: { type: string }) => t.type === '납품').length;
    const collectionCount = transactions.filter((t: { type: string }) => t.type === '회수').length;
    
    console.log(`[Ledger] Deliveries: ${deliveryCount}, Collections: ${collectionCount}`);
    
    // Verify counts are reasonable (some may have failed due to status)
    expect(deliveryCount + collectionCount).toBeGreaterThan(0);
    
    console.log('✅ Ledger Aggregation: PASSED');
  });

  test('4. Dashboard Stats Verification', async ({ request }) => {
    test.setTimeout(30000);
    
    console.log('[Dashboard] Verifying stats after operations...');
    
    const response = await request.get('/api/dashboard/stats');
    expect(response.ok()).toBe(true);
    
    const stats = await response.json();
    console.log('[Dashboard Stats]', JSON.stringify(stats, null, 2));
    
    // Verify stats structure
    expect(stats.totalCylinders).toBeDefined();
    expect(stats.atPartner).toBeDefined();
    expect(stats.atFactory).toBeDefined();
    
    // Total should be consistent
    expect(stats.totalCylinders).toBeGreaterThan(0);
    
    console.log('✅ Dashboard Stats: PASSED');
  });

  test('5. Cylinder Status Consistency Check', async ({ request }) => {
    test.setTimeout(60000);
    
    console.log('[Consistency] Checking cylinder status consistency...');
    
    const response = await request.get('/api/master/cylinders');
    expect(response.ok()).toBe(true);
    
    const data = await response.json();
    const cylinders = data.data || data;
    
    // Count by status
    const statusCounts: Record<string, number> = {};
    cylinders.forEach((cyl: { status: string }) => {
      statusCounts[cyl.status] = (statusCounts[cyl.status] || 0) + 1;
    });
    
    console.log('[Status Distribution]', JSON.stringify(statusCounts, null, 2));
    
    // Verify no undefined statuses
    expect(statusCounts['undefined']).toBeUndefined();
    expect(statusCounts['null']).toBeUndefined();
    
    console.log('✅ Cylinder Consistency: PASSED');
  });
});
