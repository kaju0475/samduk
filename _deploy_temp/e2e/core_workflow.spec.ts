import { test, expect } from '@playwright/test';

test.describe('Work Process & Modal Logic', () => {

  test.beforeEach(async ({ page }) => {
    // 1. Login Flow (Real API)
    await page.goto('/auth/login');
    await page.getByPlaceholder('admin 또는 스캐너 입력').fill('admin');
    await page.getByPlaceholder('****').fill('1234');
    await page.getByText('로그인', { exact: true }).click();
    
    // Wait for redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // 2. Setup Mocks for Work APIs (to isolate frontend logic)
    // Default Mock: Success
    await page.route('*/**/api/work/charging', async route => {
      const json = { success: true, message: 'Scan Success', data: { gasType: 'O2', containerType: 'CYLINDER' } };
      await route.fulfill({ json });
    });
    
    await page.route('*/**/api/work/delivery', async route => {
        const json = { success: true, message: 'Scan Success', data: { formattedTotal: 10 } };
        await route.fulfill({ json });
    });
  });

  test('Charging: Double Scan should keep Modal Open', async ({ page }) => {
    // Navigate to Charging Page
    await page.goto('/work/charging');
    
    // Verify we are on charging page
    await expect(page).toHaveURL(/\/work\/charging/);

    // Select "Start" Mode
    // Box element is used, not button role
    await page.getByText('충전 시작', { exact: true }).click();

    // First Scan (Success)
    // Wait for input to be attached
    const input = page.getByPlaceholder('작업할 용기 QR 스캔').first();
    await expect(input).toBeVisible();
    await input.click(); // Ensure focus
    await input.fill('TEST-CHG-001');
    await input.press('Enter');

    // Verify Modal Opens
    const modal = page.locator('.mantine-Modal-content');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('작업 현황', { exact: false })).toBeVisible();

    // Mock Duplicate Response for Second Scan
    await page.route('*/**/api/work/charging', async route => {
        const json = { 
            success: false, 
            code: 'ALREADY_CHARGING', 
            message: '이미 처리된 용기입니다' 
        };
        await route.fulfill({ status: 400, json });
    });

    // Second Scan (Duplicate)
    await input.fill('TEST-CHG-001');
    await input.press('Enter');

    // Verify Warning Toast appears
    await expect(page.getByText('작업 확인')).toBeVisible();

    // CRITICAL CHECK: Modal must stay open
    await expect(modal).toBeVisible();
  });

  test('Dashboard: Should Filter Out Rack Child Logs', async ({ page }) => {
    // Navigate to Dashboard
    await page.goto('/dashboard');
    
    // Mock Dashboard Logs with RACK child items
    await page.route('*/**/api/dashboard/logs?filter=ALL', async route => {
        const json = [
            { code: 'RACK001', desc: '납품 완료: 태성NCT', time: '14:00', rawType: 'DELIVERY' }, // Should Show
            { code: 'CYL001', desc: 'Included in RACK (RACK001)', time: '14:00', rawType: 'DELIVERY' }, // Should Hide (Old English)
            { code: 'CYL002', desc: '랙(RACK001)에 포함', time: '14:00', rawType: 'DELIVERY' } // Should Hide (New Korean)
        ];
        await route.fulfill({ json });
    });

    // Reload logs (click refresh)
    await page.getByRole('button', { name: '새로고침' }).click();
    await page.waitForResponse(resp => resp.url().includes('/api/dashboard/logs'));

    // Verify 'RACK001' is visible
    await expect(page.getByText('RACK001')).toBeVisible();

    // Verify 'CYL001' and 'CYL002' are HIDDEN
    await expect(page.getByText('CYL001')).not.toBeVisible();
    await expect(page.getByText('CYL002')).not.toBeVisible();
  });
});
