
/**
 * Mobile SafetyReport Filter Drawer Simulation Test
 * 
 * This test simulates clicking the "검색 옵션 열기" button
 * to verify if the drawer opens correctly.
 */

import { test, expect } from '@playwright/test';

test.describe('Mobile SafetyReport Filter Drawer', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to login
        await page.goto('http://localhost:3000/login');
        
        // Login
        await page.fill('input[type="text"]', 'admin');
        await page.fill('input[type="password"]', 'admin123');
        await page.click('button[type="submit"]');
        
        // Wait for redirect
        await page.waitForURL('**/menu');
        
        // Navigate to System Settings
        await page.goto('http://localhost:3000/system');
        await page.waitForLoadState('networkidle');
    });

    test('should open filter drawer when clicking 검색옵션열기', async ({ page }) => {
        // Set mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });
        
        // Open Safety Report Modal
        const safetyReportButton = page.locator('text=안전 리포트').first();
        await safetyReportButton.click();
        
        // Wait for modal to appear
        await page.waitForSelector('text=안전 관리 리포트');
        
        // Click on "검색 옵션 열기" button
        const filterButton = page.locator('button:has-text("검색 옵션 열기")');
        
        console.log('Filter Button Count:', await filterButton.count());
        
        // Take screenshot before click
        await page.screenshot({ path: 'before_click.png', fullPage: true });
        
        // Click the button
        await filterButton.click();
        
        // Wait a bit for drawer to open
        await page.waitForTimeout(500);
        
        // Take screenshot after click
        await page.screenshot({ path: 'after_click.png', fullPage: true });
        
        // Check if drawer is visible
        const drawer = page.locator('[role="dialog"]').filter({ hasText: '조회 기간' });
        const drawerVisible = await drawer.isVisible();
        
        console.log('Drawer Visible:', drawerVisible);
        
        // Assert drawer is visible
        expect(drawerVisible).toBe(true);
    });
});
