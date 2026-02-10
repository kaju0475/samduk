import { test, expect } from '@playwright/test';

test.describe('Unified AI Search Tests', () => {

  test('should open search modal and find cylinder', async ({ page, isMobile }) => {
    // 1. Go to Home
    await page.goto('/');

    // 2. Open Search Modal
    // Mobile: Click Button, Desktop: Click Button (or Ctrl+K)
    // We already have a button in Sidebar/MobileMenu.
    // Let's use the UI button for reliability.
    // In Desktop Sidebar, there's an action icon. In Mobile Menu, there's an action icon.
    // Locator might be tricky without aria-label, but we can try alt text or icon selector.
    // The previous code added `alt="AI Search"` to the Image.
    
    if (isMobile) {
        // Navigate to menu page first if mobile logic redirects (Header redirects to /menu)
        // Actually Header has router.push('/menu').
        await page.goto('/menu');
        await expect(page.getByAltText('AI Search')).toBeVisible();
        await page.getByAltText('AI Search').click();
    } else {
        await expect(page.getByAltText('AI Search')).toBeVisible();
        await page.getByAltText('AI Search').click();
    }

    // 3. Verify Modal Open
    const searchInput = page.getByPlaceholder('무엇을 찾고 계신가요?');
    await expect(searchInput).toBeVisible();

    // 4. NLP Test: Type "태성 이력" (Intent: History, Entity: 태성)
    const responsePromise = page.waitForResponse(resp => resp.url().includes('/api/search') && resp.status() === 200);
    await searchInput.fill('태성 이력');
    
    // Wait for API
    await responsePromise;
    
    // Verify results presence
    const resultItem = page.getByText('태성NCT');
    await expect(resultItem).toBeVisible({ timeout: 5000 });

    // 5. Interaction Test: Click the result
    await resultItem.click();
    
    // Verify Navigation
    // The link for '태성NCT' should go to /master/customers?search=태성NCT
    await expect(page).toHaveURL(/\/master\/customers/, { timeout: 15000 });

    // [New] Verify Auto-Open Detail Modal
    // The customer detail modal should appear automatically
    await expect(page.getByRole('dialog').getByText('태성NCT')).toBeVisible({ timeout: 10000 });
  });

  test('should open cylinder history modal directly when clicking cylinder result', async ({ page }) => {
    // 1. Open Search
    const searchButton = page.locator('button[aria-label="AI Search"], button:has(.tabler-icon-search)'); 
    // Note: Adjust selector based on actual AI button. 
    // Or just use keyboard shortcut
    await page.keyboard.press('Control+K');
    await expect(page.getByPlaceholder('무엇을 찾고 계신가요?')).toBeVisible();

    // 2. Search for existing cylinder
    const searchInput = page.getByPlaceholder('무엇을 찾고 계신가요?');
    const responsePromise = page.waitForResponse(resp => resp.url().includes('/api/search') && resp.status() === 200);
    await searchInput.fill('SDG-5315057');
    await responsePromise;

    // 3. Click Result
    const resultItem = page.getByText('SDG-5315057');
    await expect(resultItem).toBeVisible({ timeout: 5000 });
    await resultItem.click();

    // 4. Verify URL and Modal Open
    await expect(page).toHaveURL(/\/master\/cylinders.*search=SDG-5315057/, { timeout: 15000 });
    
    // Check if History Modal is open (Dialog role)
    // The modal usually has the serial number in title
    await expect(page.getByRole('dialog').getByText('SDG-5315057')).toBeVisible({ timeout: 10000 });
  });

  test('should handle complex natural language queries (Robotness Test)', async ({ page }) => {
    // 1. Open Search
    await page.keyboard.press('Control+K');
    const searchInput = page.getByPlaceholder('무엇을 찾고 계신가요?');
    
    // 2. Test Case A: "SDG-5315057 용기 이력" (ID + StopWord + Intent)
    // The system should strip '용기'(Stop) and '이력'(Intent), leaving 'SDG-5315057'.
    // Result should be the cylinder.
    const responsePromiseA = page.waitForResponse(resp => resp.url().includes('/api/search') && resp.status() === 200);
    await searchInput.fill('SDG-5315057 용기 이력');
    await responsePromiseA;
    
    await expect(page.getByText('SDG-5315057')).toBeVisible({ timeout: 5000 });

    // 3. Test Case B: "태성NCT 가스 재고" (Name + StopWord + Intent)
    // Should find '태성NCT' and boost 'INVENTORY' intent.
    await searchInput.fill('');
    const responsePromiseB = page.waitForResponse(resp => resp.url().includes('/api/search') && resp.status() === 200);
    await searchInput.fill('태성NCT 가스 재고');
    await responsePromiseB;

    // Expect Customer Result with Inventory Context
    await expect(page.getByText('태성NCT (보유 재고 확인)')).toBeVisible({ timeout: 5000 });
  });

  test('should find static menu items', async ({ page, isMobile }) => {
    await page.goto(isMobile ? '/menu' : '/');
    await page.getByAltText('AI Search').click();

    const searchInput = page.getByPlaceholder('무엇을 찾고 계신가요?');
    
    // Type "settings" or "설정"
    await searchInput.fill('설정');
    await page.waitForTimeout(1000);

    // Should find "시스템 설정"
    await expect(page.getByText('시스템 설정')).toBeVisible();
  });

});
