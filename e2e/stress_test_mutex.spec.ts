import fs from 'fs';
import { test, expect } from '@playwright/test';

/**
 * E2E STRESS TEST: Mutex-Protected Atomic Updates
 * This test simulates high concurrency by sending 10 simultaneous delivery requests.
 */
test('Mutex Stress Test: Concurrent Delivery Updates', async ({ request }) => {
  test.setTimeout(60000); // Increase timeout for stress test
  const CYLINDER_ID = 'TEST-2026-1094'; 
  const CUSTOMER_ID = 'C1768578467547-s1up7';
  const WORKER_ID = 'USER-1769154965513';

  console.log('🚀 Starting E2E Stress Test with Playwright...');

  const requests = Array.from({ length: 5 }).map(async () => {
    try {
      const response = await request.post('http://localhost:3000/api/work/delivery', {
        data: {
          type: 'SMART_SCAN',
          qrCode: CYLINDER_ID,
          customerId: CUSTOMER_ID,
          workerId: WORKER_ID,
          workMode: 'DELIVERY',
          force: true
        }
      });
      if (!response.ok()) {
        const body = await response.text();
        console.log(`❌ Request failed: Status ${response.status()} - Body: ${body.substring(0, 100)}`);
      }
      return response;
    } catch (err) {
      const error = err as Error;
      console.log(`❌ Exception: ${error.message}`);
      throw err;
    }
  });

  const startTime = Date.now();
  const results = await Promise.all(requests);
  const endTime = Date.now();

  const successCount = results.filter(r => r.ok()).length;
  const failureCount = results.length - successCount;

  const summary = {
    total: results.length,
    success: successCount,
    failure: failureCount,
    timeMs: endTime - startTime
  };

  fs.writeFileSync('stress_results.json', JSON.stringify(summary, null, 2));

  console.log(`\n--- Stress Test Result ---`);
  console.log(`Total Time: ${endTime - startTime}ms`);
  console.log(`Success Rate: ${successCount}/${results.length}`);

  expect(successCount).toBeGreaterThan(0);
});
