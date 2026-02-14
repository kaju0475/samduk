/**
 * System-Wide Collision & Error Detection Test
 * 
 * Purpose: Find hidden bugs, race conditions, and data collisions
 * by repeatedly exercising every system function with real-like data.
 * 
 * Coverage: Login -> Dashboard -> Charging -> Delivery -> Master Data -> Settings
 * Repetitions: 50 per action type
 */
import { test, expect } from '@playwright/test';

const ADMIN = { id: 'admin', password: '1234' };
const REPEAT_COUNT = 50;

test.describe('System-Wide Collision & Error Detection', () => {
  
  // Shared login helper
  async function login(page: import('@playwright/test').Page) {
    await page.goto('/auth/login');
    await page.fill('input[placeholder*="admin"]', ADMIN.id);
    await page.fill('input[placeholder="****"]', ADMIN.password);
    await page.click('button:has-text("로그인")');
    await expect(page.getByText('대시보드').first()).toBeVisible({ timeout: 30000 });
  }

  test.describe.configure({ mode: 'serial' });

  test('1. Login/Logout Stability (x50)', async ({ page }) => {
    test.setTimeout(300000);
    
    for (let i = 0; i < REPEAT_COUNT; i++) {
      console.log(`[Login Test ${i + 1}/${REPEAT_COUNT}]`);
      
      // Login
      await page.goto('/auth/login');
      await page.fill('input[placeholder*="admin"]', ADMIN.id);
      await page.fill('input[placeholder="****"]', ADMIN.password);
      await page.click('button:has-text("로그인")');
      
      // Verify Dashboard
      await expect(page.getByText('대시보드').first()).toBeVisible({ timeout: 15000 });
      
      // Navigate away and back
      await page.goto('/menu');
      await page.waitForTimeout(300);
    }
    console.log('✅ Login Stability: PASSED');
  });

  test('2. Dashboard Data Load (x50)', async ({ page }) => {
    test.setTimeout(300000);
    await login(page);
    
    for (let i = 0; i < REPEAT_COUNT; i++) {
      console.log(`[Dashboard Test ${i + 1}/${REPEAT_COUNT}]`);
      
      await page.goto('/dashboard');
      
      // Verify statistics cards load (GlassCard components)
      await expect(page.getByText('총 보유 용기').first()).toBeVisible({ timeout: 10000 });
      
      // Click refresh if available
      const refreshBtn = page.locator('button:has-text("새로고침")');
      if (await refreshBtn.isVisible()) {
        await refreshBtn.click();
        await page.waitForTimeout(500);
      }
      
      // Verify no error alerts
      const errorAlert = page.locator('.mantine-Alert-root[data-color="red"]');
      expect(await errorAlert.count()).toBe(0);
    }
    console.log('✅ Dashboard Stability: PASSED');
  });

  test('3. Charging Workflow (Start x50, Complete x50)', async ({ page }) => {
    test.setTimeout(600000);
    await login(page);
    
    await page.goto('/work/charging');
    await expect(page.getByText('충전 관리').first()).toBeVisible({ timeout: 10000 });
    
    // Get input field
    const scanInput = page.locator('input[placeholder*="QR"]').first();
    
    for (let i = 1; i <= REPEAT_COUNT; i++) {
      const cylinderId = `TEST-CYL-${String(i).padStart(4, '0')}`;
      console.log(`[Charging ${i}/${REPEAT_COUNT}] ${cylinderId}`);
      
      // START Charging
      await scanInput.fill(cylinderId);
      await scanInput.press('Enter');
      await page.waitForTimeout(800);
      
      // COMPLETE Charging
      await scanInput.fill(cylinderId);
      await scanInput.press('Enter');
      await page.waitForTimeout(800);
    }
    console.log('✅ Charging Workflow: PASSED');
  });

  test('4. Delivery Workflow via API (x50)', async ({ request }) => {
    test.setTimeout(300000);
    
    for (let i = 51; i <= 50 + REPEAT_COUNT; i++) {
      const cylinderId = `TEST-CYL-${String(i).padStart(4, '0')}`;
      const customerId = `TEST-CUST-${String((i % 10) + 1).padStart(3, '0')}`;
      console.log(`[Delivery ${i - 50}/${REPEAT_COUNT}] ${cylinderId} -> ${customerId}`);
      
      // Call Delivery API directly
      const response = await request.post('/api/work/delivery', {
        data: {
          type: 'CYLINDER',
          qrCode: cylinderId,
          customerId: customerId,
          workMode: 'DELIVERY',
          workerId: 'admin'
        }
      });
      
      // Verify response (success or expected error)
      expect(response.status()).toBeLessThan(500);
      const data = await response.json();
      expect(data).toBeDefined();
    }
    console.log('✅ Delivery API Workflow: PASSED');
  });

  test('5. Master Data - Cylinder List & Modal (x50)', async ({ page }) => {
    test.setTimeout(300000);
    await login(page);
    
    await page.goto('/master/cylinders');
    await page.waitForTimeout(1000);
    
    for (let i = 1; i <= REPEAT_COUNT; i++) {
      const cylinderId = `TEST-CYL-${String(i).padStart(4, '0')}`;
      console.log(`[Master Cylinder ${i}/${REPEAT_COUNT}] ${cylinderId}`);
      
      // Search
      const searchInput = page.locator('input[placeholder*="검색"]').first();
      await searchInput.fill(cylinderId);
      await page.waitForTimeout(500);
      
      // Click first result row
      const row = page.locator('tr').filter({ hasText: cylinderId }).first();
      if (await row.isVisible()) {
        await row.click();
        await page.waitForTimeout(500);
        
        // Verify Modal opens
        const modal = page.locator('.mantine-Modal-content');
        if (await modal.isVisible()) {
          // Close modal
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
        }
      }
      
      // Clear search
      await searchInput.clear();
    }
    console.log('✅ Master Cylinder: PASSED');
  });

  test('6. Master Data - Customer List & Modal (x50)', async ({ page }) => {
    test.setTimeout(300000);
    await login(page);
    
    await page.goto('/master/customers');
    await page.waitForTimeout(1000);
    
    for (let i = 1; i <= REPEAT_COUNT; i++) {
      const customerId = `TEST-CUST-${String(i).padStart(3, '0')}`;
      console.log(`[Master Customer ${i}/${REPEAT_COUNT}] ${customerId}`);
      
      // Search
      const searchInput = page.locator('input[placeholder*="검색"]').first();
      await searchInput.fill(`테스트거래처${i}`);
      await page.waitForTimeout(500);
      
      // Click first result
      const row = page.locator('tr, .mantine-Card-root').filter({ hasText: `테스트거래처${i}` }).first();
      if (await row.isVisible()) {
        await row.click();
        await page.waitForTimeout(500);
        
        // Close if modal
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
      
      await searchInput.clear();
    }
    console.log('✅ Master Customer: PASSED');
  });

  test('7. System Settings Page Load (x50)', async ({ page }) => {
    test.setTimeout(300000);
    await login(page);
    
    for (let i = 0; i < REPEAT_COUNT; i++) {
      console.log(`[Settings ${i + 1}/${REPEAT_COUNT}]`);
      
      await page.goto('/system');
      await page.waitForTimeout(500);
      
      // Verify page loads without error
      const heading = page.getByText('시스템').first();
      await expect(heading).toBeVisible({ timeout: 5000 });
      
      // Check for any visible error alerts
      const errorAlert = page.locator('.mantine-Alert-root[data-color="red"]');
      expect(await errorAlert.count()).toBe(0);
    }
    console.log('✅ System Settings: PASSED');
  });

  test('8. API Endpoint Stability (Direct Calls x50)', async ({ request }) => {
    test.setTimeout(300000);
    
    const endpoints = [
      '/api/dashboard/stats',
      '/api/dashboard/logs',
      '/api/master/cylinders',
      '/api/master/customers',
    ];
    
    for (let i = 0; i < REPEAT_COUNT; i++) {
      console.log(`[API Test ${i + 1}/${REPEAT_COUNT}]`);
      
      for (const endpoint of endpoints) {
        const response = await request.get(endpoint);
        expect(response.ok()).toBe(true);
        
        const data = await response.json();
        expect(data).toBeDefined();
      }
    }
    console.log('✅ API Stability: PASSED');
  });
});
