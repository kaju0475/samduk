import { test, expect } from '@playwright/test';

test.describe('Security & Search Verification', () => {

  test('Non-Admin User should have Read-Only Access (No Redirect)', async ({ page }) => {
    // Login as non-admin user
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');
    
    await page.getByLabel('아이디').fill('admin1');
    await page.getByLabel('비밀번호').fill('1234');
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await page.waitForURL('/dashboard', { timeout: 15000 });

    // 2. Visit Restricted Page (Customers) - Should BE ALLOWED
    await page.goto('/master/customers');
    
    // 3. Verify NO Redirect
    await expect(page).toHaveURL(/\/master\/customers/);
    
    // 4. Verify Read-Only: "신규 등록" Button should NOT be visible
    const createBtn = page.getByRole('button', { name: '신규 등록' });
    await expect(createBtn).not.toBeVisible();
    
    
    // 5. ✅ Verify Read-Only Banner is displayed (NEW UX pattern)
    await expect(page.getByText('읽기 전용 모드')).toBeVisible();
    await expect(page.getByText(/조회만 가능합니다/)).toBeVisible();
    
    // 6. ✅ NEW: Try to click customer name (should show Toast instead of modal)
    const customerRow = page.locator('[data-testid="customer-row"]').first();
    const customerName = customerRow.locator('text').filter({ hasText: /\S+/ }).nth(1);
    
    await customerName.click();
    
    // 7. Verify Toast appears
    await expect(page.getByText('접근 제한')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText(/관리자만 상세 정보/)).toBeVisible();
    
    // 8. Verify modal does NOT open
    await expect(page.getByTestId('customer-detail-modal')).not.toBeVisible();
    
    // Test complete - access control working correctly
  });

  test('Admin should access Master Pages', async ({ page }) => {
    // Login as admin
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');
    
    await page.getByLabel('아이디').fill('admin');
    await page.getByLabel('비밀번호').fill('1234');
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await page.waitForURL('/dashboard', { timeout: 15000 });

    await page.goto('/master/customers');
    await expect(page).toHaveURL(/\/master\/customers/);
    
    // Check for specific element to ensure loaded
    await expect(page.getByText('총', { exact: false })).toBeVisible({ timeout: 10000 }); 
  });

  test('Search "Inventory" should go to Customer Inventory Tab', async ({ page }) => {
    // Login as admin
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');
    
    await page.getByLabel('아이디').fill('admin');
    await page.getByLabel('비밀번호').fill('1234');
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await page.waitForURL('/dashboard', { timeout: 15000 });

    await page.goto('/dashboard');
    
    // Open Search - robustly
    // Look for the search button in Sidebar or Header. 
    // In Sidebar.tsx, it's an ActionIcon with alt="AI Search" or similar?
    // Let's use getByRole or getByAltText.
    await page.getByRole('button', { name: /search|ai/i }).first().click(); 
    // Fallback if that fails, try Ctrl+K again but ensure focus.
  
    // Type "재고"
    const input = page.getByPlaceholder('무엇을 찾고 계신가요?');
    await expect(input).toBeVisible();
    await input.fill('재고');
    await page.waitForTimeout(1000); // Debounce

    // Check for "재고 현황" result
    const result = page.getByText('재고 현황');
    await expect(result).toBeVisible();

    // Click it
    await result.click();

    // Expect Navigation to /master/customers?tab=inventory
    await expect(page).toHaveURL(/master\/customers.*tab=inventory/, { timeout: 10000 });
  });

  test('Menu "Ledger" and "Gas" should be searchable', async ({ page }) => {
    // Login as admin
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');
    
    await page.getByLabel('아이디').fill('admin');
    await page.getByLabel('비밀번호').fill('1234');
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await page.waitForURL('/dashboard', { timeout: 15000 });
    await page.goto('/dashboard');
    
    await page.getByRole('button', { name: /search|ai/i }).first().click();
    await page.getByPlaceholder('무엇을 찾고 계신가요?').fill('납품 대장');
    await page.waitForTimeout(1000);
    await expect(page.getByText('납품 대장 출력')).toBeVisible();

    await page.getByPlaceholder('무엇을 찾고 계신가요?').fill('가스 관리');
    await page.waitForTimeout(1000);
    await expect(page.getByText('가스 관리')).toBeVisible();
  });

});
