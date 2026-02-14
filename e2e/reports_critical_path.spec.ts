
import { test, expect } from '@playwright/test';

test.describe('Critical Path: Safety Reports', () => {

  test.beforeEach(async ({ page }) => {
    // 1. Real Login Flow (like other E2E tests)
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');
    
    await page.getByLabel('아이디').fill('admin');
    await page.getByLabel('비밀번호').fill('1234');
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    
    // Wait for redirect to dashboard
    await page.waitForURL('/dashboard', { timeout: 15000 });
    await expect(page).toHaveURL(/\/dashboard/);

    // 2. Navigate to System page
    await page.goto('/system', { waitUntil: 'networkidle' });
    
    // Wait for page to fully load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000); // Give React time to render
  });

  test('Should open Safety Reports modal and filter data', async ({ page }) => {
    test.setTimeout(60000); // 60 seconds for this test
    
    // Debug: Check if button exists
    const buttonExists = await page.getByText('안전 리포트').count();
    console.log(`Found ${buttonExists} instances of '안전 리포트'`);
    
    if (buttonExists === 0) {
      // Take screenshot for debugging
      await page.screenshot({ path: 'test-results/debug-no-button.png', fullPage: true });
      console.log('Page content:', await page.content());
    }
    
    // 1. Open Modal
    await page.getByText('안전 리포트').click({ timeout: 15000 });
    
    // Check Title
    await expect(page.getByText('안전 관리 리포트', { exact: true })).toBeVisible();

    // 2. Select Tab (Long Term)
    await page.getByText('장기미반납').click();

    // 3. Mock API Response for consistent testing
    await page.route('*/**/api/system/reports/long-term*', async route => {
        const json = [
            { 
                customerName: 'Test Customer A', 
                serialNumber: 'PROACTIVE-EXP-01', 
                gasType: 'Oxygen', 
                deliveryDate: '2020-01-01', 
                daysHeld: 2000 
            }
        ];
        await route.fulfill({ json });
    });

    // 4. Click Search/Filter (within modal)
    await page.getByRole('dialog').getByRole('button', { name: '조회' }).click();

    // 5. Verify Results (within modal)
    const modal = page.getByRole('dialog');
    await expect(modal.getByText('Test Customer A')).toBeVisible();
    await expect(modal.getByText('PROACTIVE-EXP-01')).toBeVisible();
    
    // 6. Verify Excel Export Button exists (within modal)
    await expect(modal.getByText('엑셀')).toBeVisible();
  });

  test('Traceability Tab should load and display history', async ({ page }) => {
    test.setTimeout(60000); // 60 seconds for this test
    
    await page.getByText('안전 리포트').click({ timeout: 15000 });
    await page.getByText('이력추적').click();

    await page.route('*/**/api/system/reports/traceability*', async route => {
        const json = [
            { cylinderId: 'PROACTIVE-EXP-01', location: 'Samduk Factory', date: '2023-01-01', type: '충전', worker: 'Worker1' }
        ];
        await route.fulfill({ json });
    });

    // Fill Serial Search (within modal)
    const modal = page.getByRole('dialog');
    await modal.getByLabel('용기번호').fill('PROACTIVE-EXP-01');
    await modal.getByRole('button', { name: '조회' }).click();

    // Verify Results (within modal)
    await expect(modal.getByText('PROACTIVE-EXP-01')).toBeVisible();
    await expect(modal.getByText('Samduk Factory')).toBeVisible();
  });

});
