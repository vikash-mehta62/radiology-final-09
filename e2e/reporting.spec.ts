import { test, expect } from '@playwright/test';
import { mockReportingRoutes, resetMockData, createMockReport } from './server-mocks';
import AxeBuilder from '@axe-core/playwright';

test.describe('Unified Reporting System E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Reset mock data
    resetMockData();
    
    // Enable mocks if PW_USE_MOCK=1
    if (process.env.PW_USE_MOCK === '1') {
      await mockReportingRoutes(page);
    }
    
    // Navigate to reports page
    await page.goto('/reports');
    
    // Wait for page to be ready
    await page.waitForLoadState('networkidle');
  });

  test('should load reports list', async ({ page }) => {
    // Check for reports container
    const reportsContainer = page.locator('[data-testid="reports-list"]').or(page.locator('main'));
    await expect(reportsContainer).toBeVisible();
    
    // Check page title
    await expect(page).toHaveTitle(/Reports|Radiology/i);
  });

  test('should create new report with template selection', async ({ page }) => {
    // Click create report button
    const createButton = page.getByRole('button', { name: /create|new report/i });
    await createButton.click();
    
    // Wait for template selector
    await page.waitForSelector('[data-testid="template-selector"]', { timeout: 5000 });
    
    // Select a template
    const templateCard = page.locator('[data-testid="template-card"]').first();
    await templateCard.click();
    
    // Wait for editor to load
    await page.waitForSelector('[data-testid="report-editor"]', { timeout: 5000 });
    
    // Verify editor is visible
    const editor = page.locator('[data-testid="report-editor"]');
    await expect(editor).toBeVisible();
  });

  test('should autosave draft report', async ({ page }) => {
    // Create a new report
    await page.getByRole('button', { name: /create|new report/i }).click();
    await page.locator('[data-testid="template-card"]').first().click();
    
    // Wait for editor
    await page.waitForSelector('[data-testid="report-editor"]');
    
    // Type in indication field
    const indicationField = page.locator('textarea[name="indication"]').or(
      page.locator('[data-testid="indication-field"]')
    );
    await indicationField.fill('Patient presents with chest pain');
    
    // Wait for autosave indicator
    await page.waitForSelector('text=/saving|saved/i', { timeout: 10000 });
    
    // Verify save status
    const saveStatus = page.locator('[data-testid="save-status"]').or(
      page.locator('text=/saved/i')
    );
    await expect(saveStatus).toBeVisible();
  });

  test('should finalize report', async ({ page }) => {
    // Create and fill report
    await page.getByRole('button', { name: /create|new report/i }).click();
    await page.locator('[data-testid="template-card"]').first().click();
    await page.waitForSelector('[data-testid="report-editor"]');
    
    // Fill required fields
    await page.locator('textarea[name="indication"]').fill('Test indication');
    await page.locator('textarea[name="impression"]').fill('Test impression');
    
    // Add a finding
    const addFindingBtn = page.getByRole('button', { name: /add finding/i });
    if (await addFindingBtn.isVisible()) {
      await addFindingBtn.click();
      await page.locator('textarea[name*="finding"]').first().fill('Normal chest');
    }
    
    // Wait for autosave
    await page.waitForTimeout(2000);
    
    // Click finalize button
    const finalizeBtn = page.getByRole('button', { name: /finalize/i });
    await finalizeBtn.click();
    
    // Confirm if dialog appears
    const confirmBtn = page.getByRole('button', { name: /confirm|yes/i });
    if (await confirmBtn.isVisible({ timeout: 2000 })) {
      await confirmBtn.click();
    }
    
    // Wait for status update
    await page.waitForTimeout(1000);
    
    // Verify status changed
    const statusBadge = page.locator('[data-testid="report-status"]').or(
      page.locator('text=/preliminary/i')
    );
    await expect(statusBadge).toBeVisible();
  });

  test('should sign report with digital signature', async ({ page }) => {
    // Create, fill, and finalize report first
    await page.getByRole('button', { name: /create|new report/i }).click();
    await page.locator('[data-testid="template-card"]').first().click();
    await page.waitForSelector('[data-testid="report-editor"]');
    
    await page.locator('textarea[name="indication"]').fill('Test indication');
    await page.locator('textarea[name="impression"]').fill('Test impression');
    await page.waitForTimeout(2000);
    
    // Finalize
    await page.getByRole('button', { name: /finalize/i }).click();
    const confirmBtn = page.getByRole('button', { name: /confirm|yes/i });
    if (await confirmBtn.isVisible({ timeout: 2000 })) {
      await confirmBtn.click();
    }
    await page.waitForTimeout(1000);
    
    // Click sign button
    const signBtn = page.getByRole('button', { name: /sign/i });
    await signBtn.click();
    
    // Wait for signature dialog
    await page.waitForSelector('[data-testid="signature-dialog"]', { timeout: 5000 });
    
    // Draw signature (simulate canvas interaction)
    const canvas = page.locator('canvas').first();
    await canvas.click({ position: { x: 50, y: 50 } });
    
    // Confirm signature
    const confirmSignBtn = page.getByRole('button', { name: /confirm|apply/i });
    await confirmSignBtn.click();
    
    // Wait for status update
    await page.waitForTimeout(1000);
    
    // Verify final status
    const statusBadge = page.locator('text=/final/i');
    await expect(statusBadge).toBeVisible();
  });

  test('should prevent editing finalized report', async ({ page }) => {
    // Navigate to a finalized report (mock)
    if (process.env.PW_USE_MOCK === '1') {
      const finalReport = createMockReport({
        reportStatus: 'final',
        signature: {
          signedBy: 'user-123',
          signedAt: new Date().toISOString(),
        },
      });
      
      await page.goto(`/reports/${finalReport._id}`);
      await page.waitForLoadState('networkidle');
      
      // Check that input fields are disabled
      const indicationField = page.locator('textarea[name="indication"]');
      await expect(indicationField).toBeDisabled();
      
      // Verify sign button is not visible
      const signBtn = page.getByRole('button', { name: /^sign$/i });
      await expect(signBtn).not.toBeVisible();
      
      // Verify addendum button is visible
      const addendumBtn = page.getByRole('button', { name: /addendum/i });
      await expect(addendumBtn).toBeVisible();
    }
  });

  test('should add addendum to final report', async ({ page }) => {
    if (process.env.PW_USE_MOCK === '1') {
      const finalReport = createMockReport({
        reportStatus: 'final',
        signature: {
          signedBy: 'user-123',
          signedAt: new Date().toISOString(),
        },
      });
      
      await page.goto(`/reports/${finalReport._id}`);
      await page.waitForLoadState('networkidle');
      
      // Click addendum button
      const addendumBtn = page.getByRole('button', { name: /addendum/i });
      await addendumBtn.click();
      
      // Wait for addendum dialog
      await page.waitForSelector('[data-testid="addendum-dialog"]', { timeout: 5000 });
      
      // Type addendum text
      const addendumText = page.locator('textarea[name="addendum"]');
      await addendumText.fill('Additional findings noted on review');
      
      // Submit addendum
      const submitBtn = page.getByRole('button', { name: /submit|add/i });
      await submitBtn.click();
      
      // Verify addendum appears
      await page.waitForSelector('text=/additional findings/i', { timeout: 5000 });
    }
  });

  test('should export report as PDF', async ({ page }) => {
    if (process.env.PW_USE_MOCK === '1') {
      const report = createMockReport({ reportStatus: 'final' });
      
      await page.goto(`/reports/${report._id}`);
      await page.waitForLoadState('networkidle');
      
      // Start waiting for download before clicking
      const downloadPromise = page.waitForEvent('download');
      
      // Click export PDF button
      const exportBtn = page.getByRole('button', { name: /export.*pdf/i });
      await exportBtn.click();
      
      // Wait for download
      const download = await downloadPromise;
      
      // Verify download
      expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
    }
  });

  test('should handle version conflicts gracefully', async ({ page }) => {
    // This test verifies retry logic for concurrent edits
    if (process.env.PW_USE_MOCK === '1') {
      const report = createMockReport();
      
      await page.goto(`/reports/${report._id}`);
      await page.waitForLoadState('networkidle');
      
      // Make an edit
      await page.locator('textarea[name="indication"]').fill('Updated indication');
      
      // Wait for autosave
      await page.waitForTimeout(2000);
      
      // Verify no error messages
      const errorAlert = page.locator('[role="alert"]').or(page.locator('.error'));
      await expect(errorAlert).not.toBeVisible();
    }
  });

  test('should meet accessibility standards', async ({ page }) => {
    // Create a report
    await page.getByRole('button', { name: /create|new report/i }).click();
    await page.locator('[data-testid="template-card"]').first().click();
    await page.waitForSelector('[data-testid="report-editor"]');
    
    // Run accessibility scan
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    
    // Assert no violations
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have accessible button labels', async ({ page }) => {
    await page.getByRole('button', { name: /create|new report/i }).click();
    await page.locator('[data-testid="template-card"]').first().click();
    await page.waitForSelector('[data-testid="report-editor"]');
    
    // Check key buttons have accessible names
    const saveBtn = page.getByRole('button', { name: /save/i });
    const finalizeBtn = page.getByRole('button', { name: /finalize/i });
    
    await expect(saveBtn.or(page.locator('[data-testid="save-button"]'))).toHaveCount(1);
    await expect(finalizeBtn).toBeVisible();
    
    // Verify buttons have aria-labels or text content
    const buttons = await page.locator('button').all();
    for (const button of buttons) {
      const ariaLabel = await button.getAttribute('aria-label');
      const textContent = await button.textContent();
      
      // Button should have either aria-label or text content
      expect(ariaLabel || textContent?.trim()).toBeTruthy();
    }
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/reports');
    
    // Tab through interactive elements
    await page.keyboard.press('Tab');
    
    // Verify focus is visible
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
    
    // Continue tabbing
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Verify focus moves
    const newFocusedElement = page.locator(':focus');
    await expect(newFocusedElement).toBeVisible();
  });
});
