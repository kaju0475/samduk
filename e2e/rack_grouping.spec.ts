import { test, expect } from '@playwright/test';

test.describe('Rack Grouping System Wide', () => {

    test.beforeEach(async ({ page }) => {
        // 1. Login
        await page.goto('/auth/login');
        await page.getByPlaceholder('admin 또는 스캐너 입력').fill('admin');
        await page.getByPlaceholder('****').fill('1234');
        await page.getByText('로그인', { exact: true }).click();
        
        // Wait for dashboard
        await expect(page).toHaveURL(/\/dashboard/);
    });

    test('Customer History Grouping (RACK0001)', async ({ page }) => {
        // 1. Navigate to Customer Management
        await page.goto('/master/customers');
        
        // Wait for customers API/List to load specific item
        // Robustness: Wait for at least one row or the specific text
        await expect(page.getByText('태성nct').first()).toBeVisible({ timeout: 10000 });
        
        // 2. Open Detail Modal
        await page.getByText('태성nct').first().click();

        // 3. Switch to History Tab & Wait for Data
        // Setup api waiter before clicking
        const responsePromise = page.waitForResponse(resp => resp.url().includes('/api/work/delivery') && resp.status() === 200);
        await page.getByRole('tab', { name: '거래 이력' }).click();
        await responsePromise; // Wait for the API to actually return data

        // 4. Verify RACK0001 Parent Row exits
        // Note: The date range might filter it out if it's old. 
        // Assuming test data is within 1 year or current date range defaults to recent.
        // If needed, we could adjust date filter, but let's try default first.
        const rackRow = page.getByText('RACK0001').first();
        await expect(rackRow).toBeVisible({ timeout: 10000 });

        // 5. Verify Child is NOT visible (collapsed state)
        // Child serial from verification: 2307131301
        const childSerial = '2307131301';
        await expect(page.getByText(childSerial)).not.toBeVisible();

        // 6. Expand Rack
        // The expand button is likely an ActionIcon in the same row or a cell.
        // We can click the Rack ID itself or look for the chevron.
        // In our implementation, the chevron is an ActionIcon.
        // Let's Find the row containing RACK0001, then find the button inside it.
        // Or simply click the button near it.
        // Since we added `onClick` to ActionIcon, let's try to find it.
        // It has correct aria-label? Probably not.
        // It's the first button in the row or cell 0.
        // Let's try to click the row's first cell or button.
        
        // Locating the button in the same row as 'RACK0001'
        const row = page.getByRole('row', { name: /RACK0001/ }).first();
        const expandBtn = row.getByRole('button').first(); 
        // Note: ActionIcon renders as button.
        await expandBtn.click();

        // 7. Verify Child is visible
        await expect(page.getByText(childSerial)).toBeVisible();
    });

    test('Safety Reports Traceability Grouping', async ({ page }) => {
        // 1. Navigate to System Settings
        await page.goto('/system');

        // 2. Open Safety Reports Modal
        await page.getByText('안전 관리 리포트').click();
        await expect(page.getByText('안전 관리 리포트 (소명 자료)')).toBeVisible();

        // 3. Switch to '용기 이력 추적' (Traceability) tab
        // Wait for any initial data load? Not strictly needed until search, but safer.
        await page.getByRole('tab', { name: '용기 이력 추적' }).click();

        // 4. Search for Rack Cylinder 'RACK0001'
        // Setup waiter for report API
        const searchResponse = page.waitForResponse(resp => resp.url().includes('/api/system/reports/traceability') && resp.status() === 200);
        const searchInput = page.getByPlaceholder('SDG-1234');
        await searchInput.fill('RACK0001');
        await searchInput.press('Enter');
        await searchResponse; // Wait for search results

        // 5. Verify Result
        const rackRow = page.getByText('RACK0001').first();
        await expect(rackRow).toBeVisible({ timeout: 10000 });

        // 6. Verify Child (collapsed)
         // Child serial from verification: 2307131301
        const childSerial = '2307131301';
        await expect(page.getByText(childSerial)).not.toBeVisible();

        // 7. Expand
        const row = page.getByRole('row', { name: /RACK0001/ }).first();
        const expandBtn = row.getByRole('button').first();
        await expandBtn.click({ force: true });

        // 8. Verify Child Visible
        await expect(page.getByText(childSerial)).toBeVisible();
    });

    test('Cylinder History Modal (De-duplication)', async ({ page }) => {
        // 1. Go to System -> Safety Reports
        await page.goto('/system');
        await page.getByText('안전 관리 리포트').click();
        
        // 2. Traceability Tab
        await page.getByRole('tab', { name: '용기 이력 추적' }).click();

        // 3. Search and Open Modal
        // We need to click the cylinder ID to open the history modal
        const searchResponse = page.waitForResponse(resp => resp.url().includes('/api/system/reports/traceability') && resp.status() === 200);
        const searchInput = page.getByPlaceholder('SDG-1234');
        await searchInput.fill('SDG-H200001');
        await searchInput.press('Enter');
        await searchResponse;
        
        // Setup waiter for Cylinder History API
        const historyResponse = page.waitForResponse(resp => resp.url().includes('/api/history/cylinder') && resp.status() === 200);
        // Click the row/serial to open detailed history
        await page.getByText('SDG-H200001').first().click({ force: true });
        await historyResponse; // Wait for modal data load

        // 4. Verify History Modal Content
        await expect(page.getByText('용기 이력 추적 SDG-H200001')).toBeVisible();

        // 5. Check for Merged/Enhanced Message
        // Should see "납품 완료: 태성NCT (RACK0001)"
        await expect(page.getByText('납품 완료: 태성NCT (RACK0001)')).toBeVisible({ timeout: 10000 });

        // 6. Check that "Included in RACK" is NOT visible (deduplicated)
        await expect(page.getByText('Included in RACK (RACK0001)')).not.toBeVisible();
    });

});
