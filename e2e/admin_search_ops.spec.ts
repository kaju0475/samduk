import { test, expect } from '@playwright/test';

test.describe('AI Search Admin Operations', () => {

  // Mock Data
  const mockCustomers = {
    success: true,
    data: [
        { id: 'c1', name: 'TestCustomer', type: 'BUSINESS', address: 'Seoul', representative: 'Tester', phone: '010-1234-5678' }
    ]
  };

  const mockCylinders = {
      success: true,
      data: [
          { id: 1, serialNumber: 'TEST-100', gasType: 'O2', status: '실병', owner: 'Owner', currentHolderId: 'c1' }
      ]
  };

  test.beforeEach(async ({ page }) => {
     // Setup Mocks
     await page.route('*/**/api/master/customers', async route => {
         await route.fulfill({ json: mockCustomers });
     });
     await page.route('*/**/api/master/cylinders', async route => {
         await route.fulfill({ json: mockCylinders });
     });
  });
  
  test('Admin can trigger Create Customer modal via AI Search', async ({ page }) => {
    // 1. Mock Admin Login
    await page.addInitScript(() => {
        localStorage.setItem('currentUser', JSON.stringify({ role: '관리자', name: 'AdminUser' }));
    });
    
    await page.goto('/master/customers?action=create');
    
    // 4. Verify Modal Open
    await expect(page.getByRole('dialog', { name: '거래처 신규 등록' })).toBeVisible({ timeout: 10000 });
  });

  test('Non-Admin cannot trigger Create Customer modal', async ({ page }) => {
    // 1. Mock Normal User
    await page.addInitScript(() => {
        localStorage.setItem('currentUser', JSON.stringify({ role: '사용자', name: 'NormalUser' }));
    });

    await page.goto('/master/customers?action=create');

    // 2. Verify Modal NOT Visible
    await expect(page.getByRole('dialog', { name: '거래처 신규 등록' })).not.toBeVisible();
  });

  test('History Intent opens Customer Detail with History Tab', async ({ page }) => {
    // Navigate with Search and Tab
    await page.goto('/master/customers?search=TestCustomer&tab=history');

    // Verify Modal Open with correct customer
    await expect(page.getByRole('dialog').getByText('TestCustomer', { exact: true })).toBeVisible({ timeout: 10000 });

    // Verify Tab Active (Check for "조회 기간" which is unique to History tab)
    await expect(page.getByText('조회 기간')).toBeVisible(); 
    await expect(page.getByRole('tab', { name: '거래 이력' })).toHaveAttribute('aria-selected', 'true');
  });

  test('Admin can trigger QR Modal via AI Search in Cylinders', async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem('currentUser', JSON.stringify({ role: '관리자' }));
    });

    await page.goto('/master/cylinders?action=qr');
    // Cylinder page fetches customers too, somocks handles it.
    await expect(page.getByRole('dialog', { name: 'QR 코드 출력' })).toBeVisible({ timeout: 10000 });
  });

});
