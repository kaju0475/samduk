
import { test, expect } from '@playwright/test';

test.describe('System Reset Verification', () => {

  test.beforeEach(async ({ page }) => {
    // Login as Admin
    await page.goto('http://localhost:3000/auth/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', '1234'); // Default password based on db.json
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('http://localhost:3000/dashboard');
  });

  test('Verify Empty Lists after Reset', async ({ page }) => {
    // 1. Check Customers
    await page.goto('http://localhost:3000/master/customers');
    // Wait for table or "No records" message
    // Assuming Mantine Table, look for row count or specific empty state
    // For now, checks that no specific customer rows exist (e.g. "태성NCT").
    await expect(page.getByText('태성NCT')).not.toBeVisible();
    
    // 2. Check Cylinders
    await page.goto('http://localhost:3000/master/cylinders');
    await expect(page.getByText('SDG-1001')).not.toBeVisible();

    // 3. Check Dashboard Counts
    await page.goto('http://localhost:3000/dashboard');
    // Assuming Stat cards show "0"
    // This might be tricky if "0" is generic text. We look for specific ids if possible.
    // For now, trusting the table checks.
  });

  test('Verify New Data Entry (Smoke Test)', async ({ page }) => {
    // 1. Create a Customer
    await page.goto('http://localhost:3000/master/customers');
    await page.getByRole('button', { name: '신규 등록' }).click();
    
    await page.fill('input[placeholder="거래처명"]', '테스트거래처');
    await page.click('input[value="BUSINESS"]'); // Select Business Type if radio
    // Fill required fields based on Schema
    // Usually only Name is strict required, but let's see.
    
    await page.getByRole('button', { name: '저장' }).click();
    
    // Validate Appearance
    await expect(page.getByText('테스트거래처')).toBeVisible();

    // 2. Register a Cylinder
    await page.goto('http://localhost:3000/master/cylinders');
    await page.getByRole('button', { name: '신규 등록' }).click();
    
    await page.fill('input[placeholder="용기번호 (자동생성 가능)"]', 'NEW-001');
    // Select Gas Type (First option)
    await page.click('input[value="O2-40L"]'); // Assuming Radio or select
    
    await page.getByRole('button', { name: '등록' }).click();

    // Validate Appearance
    await expect(page.getByText('NEW-001')).toBeVisible();
  });

});
