import { test, expect } from '@playwright/test';

/**
 * 🚀 MASSIVE STRESS TEST SUITE (Real Data + Cleanup V7)
 * Goal: 50+ Scenarios x 100 Repetitions
 * Status: Using Standard API (No ID Override) & Cleaning up after.
 */

// Dynamic IDs (Populated in beforeAll)
let CUST_ID_1 = ''; // For '테스트뮬기업A'
let CUST_ID_2 = ''; // For '테스트뮬기업B'
let WORKER_ID = ''; // For 'Mule Worker'

// Constants for Creation
const CUST_DATA_1 = { name: '테스트뮬기업A', type: 'BUSINESS' };
const CUST_DATA_2 = { name: '테스트뮬기업B', type: 'BUSINESS' };
const WORKER_DATA = { username: `mule_${Date.now()}`, name: 'Mule Worker', role: 'employee', password: '123' };
const ADMIN_DATA = { username: 'e2e_tester', name: 'E2E Admin', role: 'admin', password: 'password123' };

const SCENARIOS = [
  // --- Delivery (납품) ---
  { id: 'D-01', mode: 'DELIVERY', gas: '산소', status: '실병', holder: '삼덕공장', expectSuccess: true },
  { id: 'D-02', mode: 'DELIVERY', gas: '산소', status: '공병', holder: '삼덕공장', expectSuccess: false, code: 'STATUS_MISMATCH' },
  { id: 'D-03', mode: 'DELIVERY', gas: '산소', status: '실병', holder: 'CUST_1', expectSuccess: false, code: 'ALREADY_DELIVERED' },
  { id: 'D-05', mode: 'DELIVERY', gas: '산소', status: '실병', holder: 'CUST_2', force: true, expectSuccess: true },
  
  // --- Collection (회수) ---
  { id: 'C-01', mode: 'COLLECTION', gas: '질소', status: '공병', holder: 'CUST_1', expectSuccess: true },
  { id: 'C-02', mode: 'COLLECTION', gas: '질소', status: '공병', holder: '삼덕공장', expectSuccess: false, code: 'LOCATION_ERROR' },
];

const REPETITIONS = 100;

test.describe('Massive System Verification', () => {
  
  test.beforeAll(async ({ request }) => {
    console.log(`[Setup] Creating Real Data...`);
    
    // 1. Create Customer 1
    const r1 = await request.post('/api/master/customers', { data: CUST_DATA_1 });
    if (r1.ok()) {
        const b1 = await r1.json();
        CUST_ID_1 = b1.data.id;
        console.log(` - Created C1: ${CUST_ID_1}`);
    } else {
        // Fallback if exists
        const list = await request.get('/api/master/customers');
        const custs = (await list.json()).data;
        const found = custs.find((c: any) => c.name === CUST_DATA_1.name);
        if (found) {
            CUST_ID_1 = found.id;
            console.log(` - Found Existing C1: ${CUST_ID_1}`);
        } else {
            console.error('Setup C1 Failed:', await r1.text());
            expect(r1.ok()).toBeTruthy();
        }
    }

    // 2. Create Customer 2
    const r2 = await request.post('/api/master/customers', { data: CUST_DATA_2 });
    if (r2.ok()) {
        const b2 = await r2.json();
        CUST_ID_2 = b2.data.id;
        console.log(` - Created C2: ${CUST_ID_2}`);
    } else {
        const list = await request.get('/api/master/customers');
        const custs = (await list.json()).data;
        const found = custs.find((c: any) => c.name === CUST_DATA_2.name);
        if (found) {
            CUST_ID_2 = found.id;
            console.log(` - Found Existing C2: ${CUST_ID_2}`);
        } else {
            console.error('Setup C2 Failed:', await r2.text());
            expect(r2.ok()).toBeTruthy();
        }
    }

    // 3. Create Worker
    const r3 = await request.post('/api/master/users', { data: WORKER_DATA });
    if (r3.ok()) {
        const b3 = await r3.json();
        WORKER_ID = b3.data.id || b3.data.username;
    } else {
        console.log(' - Worker setup conflict/error, checking existing...');
    }
    
    // Always fetch ID to be sure
    if (!WORKER_ID) {
        const list = await request.get('/api/master/users');
        const users = (await list.json()).data || [];
        const found = users.find((u: any) => u.username === WORKER_DATA.username);
        if (found) WORKER_ID = found.id;
    }
    expect(WORKER_ID).toBeTruthy();
    console.log(` - Worker ID: ${WORKER_ID}`);

    // Admin
    await request.post('/api/master/users', { data: ADMIN_DATA }).catch(() => {});
  });

  test.afterAll(async ({ request }) => {
      console.log(`[Cleanup] Deleting Data...`);
      // Delete Customers (Force to clear cylinders)
      if (CUST_ID_1) await request.delete(`/api/master/customers?id=${CUST_ID_1}&force=true`);
      if (CUST_ID_2) await request.delete(`/api/master/customers?id=${CUST_ID_2}&force=true`);
      
      // Delete Worker? (If API supports)
      // await request.delete(`/api/master/users?id=${WORKER_ID}`);
  });

  for (const scenario of SCENARIOS) {
    test(`[Logic] ${scenario.id} (${scenario.mode}) - 100x Loop`, async ({ request }) => {
      
      const targetCusId = (scenario.holder === 'CUST_2') ? CUST_ID_2 : CUST_ID_1;
      
      for (let i = 0; i < REPETITIONS; i++) {
        const serial = `STRESS-${scenario.id}-${i}`;
        
        // 1. Create Cylinder
        await request.post('/api/master/cylinders', {
            data: { serialNumber: serial, gasType: scenario.gas, capacity: '40L', owner: '삼덕공장', chargingExpiryDate: '2030-12-31' }
        }).catch(() => {}); 

        // 2. Pre-condition
        if (scenario.holder !== '삼덕공장') {
            const preHolderId = (scenario.holder === 'CUST_2') ? CUST_ID_2 : CUST_ID_1;
            await request.post('/api/work/delivery', {
                 data: { workMode: 'DELIVERY', qrCode: serial, customerId: preHolderId, workerId: WORKER_ID, force: true }
            });
        }
        
        if (scenario.status === '실병' && scenario.holder === '삼덕공장') {
             await request.post('/api/work/charging', {
                 data: { action: 'COMPLETE', qrCode: serial, workerId: WORKER_ID }
             });
        }

        // 3. Action
        const response = await request.post(`/api/work/${scenario.mode === 'DELIVERY' || scenario.mode === 'COLLECTION' ? 'delivery' : 'charging'}`, {
          data: {
            workMode: scenario.mode, 
            action: scenario.mode === 'DELIVERY' ? undefined : (scenario.mode === 'COLLECTION' ? undefined : 'START'),
            qrCode: serial,
            customerId: targetCusId,
            workerId: WORKER_ID,
            force: scenario.force
          }
        });

        // 4. Verify
        const resBody = await response.json();
        
        if (scenario.expectSuccess && response.status() !== 200) {
            console.log(`Failed Iter ${i}:`, resBody);
        }

        if (scenario.expectSuccess) {
           expect(response.status(), `Iter ${i} - ${resBody.message}`).toBe(200);
           expect(resBody.success).toBe(true);
        } else {
           expect(resBody.success).toBe(false);
           if (scenario.code) expect(resBody.code).toBe(scenario.code);
        }
      }
    });
  }

  // UI Test
  test('[UI] Mobile Login & Layout Check', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 }); 
    await page.goto('/login');
    
    const idInput = page.locator('input[name="id"], input[name="username"], input[type="text"]').first();
    await idInput.waitFor({ state: 'visible', timeout: 30000 });
    await idInput.fill(ADMIN_DATA.username);
    
    await page.locator('input[name="password"], input[type="password"]').first().fill(ADMIN_DATA.password);
    await page.getByRole('button', { name: /로그인/ }).click();
    
    await expect(page.locator('nav')).toBeVisible({ timeout: 20000 });
    
    await page.goto('/work/delivery');
    await expect(page.getByText('납품/회수')).toBeVisible();
  });

});
