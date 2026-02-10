import { test, expect } from '@playwright/test';

test.describe('Full System Lifecycle & Safety E2E', () => {

  test.beforeAll(async ({ request }) => {
    // 1. Clean & Seed Data
    const cleanup = await request.post('/api/admin/e2e-setup', { data: { action: 'cleanup' } });
    expect(cleanup.ok()).toBeTruthy();

    const seed = await request.post('/api/admin/e2e-setup', { data: { action: 'seed' } });
    expect(seed.ok()).toBeTruthy();
  });

  test.afterAll(async ({ request }) => {
     // Optional: Cleanup after test
     await request.post('/api/admin/e2e-setup', { data: { action: 'cleanup' } });
  });

  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/auth/login');
    await page.getByPlaceholder('admin 또는 스캐너 입력').fill('admin');
    await page.getByPlaceholder('****').fill('1234');
    await page.getByText('로그인', { exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('Complete Lifecycle: Charging -> Delivery -> Collection -> Inspection', async ({ page }) => {
    
    // ============================================
    // Phase 1: Charging Safety Check (Expired)
    // ============================================
    await page.goto('/work/charging');
    // Click "Charging Start" mode (if not default)
    await page.getByText('충전 시작', { exact: true }).click();

    // Scan Expired Cylinder
    const chargeInput = page.getByPlaceholder('작업할 용기 QR 스캔');
    await chargeInput.fill('E2E-TEST-CYL-OLD');
    await chargeInput.press('Enter');

    // Expect Blocking Modal
    await expect(page.getByText('차단: 충전 불가')).toBeVisible({ timeout: 5000 });
    // Close Modal
    await page.getByRole('button', { name: '확인' }).first().click(); // Or whatever close button

    // ============================================
    // Phase 2: Normal Charging Flow
    // ============================================
    // Scan Normal Cylinder
    await chargeInput.fill('E2E-TEST-CYL-01');
    await chargeInput.press('Enter');

    // Expect Toast/Notification Success (Visual Feedback)
    // Depending on UI implementation, we might see it in list
    await expect(page.getByText('E2E-TEST-CYL-01').first()).toBeVisible();

    // Switch to Complete
    await page.getByText('충전 완료', { exact: true }).click();
    await chargeInput.fill('E2E-TEST-CYL-01');
    await chargeInput.press('Enter');
    await expect(page.getByText('E2E-TEST-CYL-01').first()).toBeVisible();

    // ============================================
    // Phase 3: Delivery
    // ============================================
    await page.goto('/work/delivery');
    
    // Select Customer
    await page.getByText('거래처 선택').click();
    await page.getByPlaceholder('거래처 검색').fill('E2E테스트거래처');
    await page.getByText('E2E테스트거래처').first().click();

    // Start Delivery
    await page.getByRole('button', { name: '납품 시작' }).click();

    // Scan
    const deliveryInput = page.getByPlaceholder('용기 QR 스캔'); // Placeholder might differ, check UI
    // Or use the new "Manual Input" button if implemented? 
    // Let's us the QR input if visible, or fallback to manual button if needed.
    // Assuming QR input is available or "Direct Input" button.
    
    // Wait for "Delivery Mode" UI
    await expect(page.getByText('납품 (0)')).toBeVisible();
    
    // Manual Input Button Click (since we added it) or just use the scanner logic hook mock?
    // The previous test simulated scanner. Here we use UI input.
    // If <TextInput> is visible:
    // Actually, on Delivery Page, there is a QR Scanner Modal or a direct input? 
    // Looking at code: It has a "Keyboard" icon button now? No, that was Charging.
    // Delivery Page has `TextInput` with `data-autofocus`.
    
    await deliveryInput.fill('E2E-TEST-CYL-01');
    await deliveryInput.press('Enter');

    // Expect item in list
    await expect(page.getByText('E2E-TEST-CYL-01')).toBeVisible();

    // Check Safety Interceptor logic (if any specific modal appears? Usually silent success)

    // Confirm Delivery
    await page.getByRole('button', { name: '납품 완료 (1)' }).click();
    await expect(page.getByText('완료')).toBeVisible();
    
    // Close success modal if any (Automatic redirect? or stay?)
    // Usually it goes back or resets.

    // ============================================
    // Phase 4: Collection
    // ============================================
    // Assuming we are back at main delivery/collection screen or need to reset
    // Refresh page to be safe
    await page.reload();

    // Select Customer again (persistance?)
    await page.getByText('거래처 선택').click();
    await page.getByPlaceholder('거래처 검색').fill('E2E테스트거래처');
    await page.getByText('E2E테스트거래처').first().click();

    // Switch to Coilection (Empty)
    await page.getByText('공병 회수').click(); // Tab or Button
    
    await page.getByRole('button', { name: '회수 시작' }).click();

    const collectionInput = page.getByPlaceholder('용기 QR 스캔');
    await collectionInput.fill('E2E-TEST-CYL-01');
    await collectionInput.press('Enter');

    await expect(page.getByText('E2E-TEST-CYL-01')).toBeVisible();
    await page.getByRole('button', { name: '회수 완료 (1)' }).click();
    await expect(page.getByText('완료')).toBeVisible();

    // ============================================
    // Phase 5: Inspection
    // ============================================
    await page.goto('/work/inspection');

    // Outbound
    await page.getByText('검사 출고').click();
    const inspectInput = page.getByPlaceholder('용기 일련번호 직접 입력');
    await inspectInput.fill('E2E-TEST-CYL-01');
    await page.getByRole('button', { name: '입력' }).click();

    // Expect in list
    await expect(page.getByText('E2E-TEST-CYL-01')).toBeVisible();

    // Inbound
    await page.getByText('검사 입고').click(); // Switch Tab
    const inboundInput = page.getByPlaceholder('용기 일련번호 직접 입력').nth(1); // There might be multiple inputs if tabs render all?
    // Actually Tabs usually unmount or hide.
    // Use `visible: true` filter
    const visibleInput = page.getByPlaceholder('용기 일련번호 직접 입력').filter({ hasText: '' }).first();
    await visibleInput.fill('E2E-TEST-CYL-01');
    await page.getByRole('button', { name: '입력' }).filter({ hasText: '입력' }).visible().click();
    
    await expect(page.getByText('E2E-TEST-CYL-01')).toBeVisible();
    
  });
});
