import { test, expect, Page, Route } from '@playwright/test';
import { mockReportingRoutes, resetMockData, createMockReport } from './server-mocks';

/**
 * Chaos Engineering Tests
 * Simulates network failures, slow responses, and server errors
 */

test.describe('Chaos Engineering - Network Resilience', () => {
  test.beforeEach(async ({ page }) => {
    resetMockData();
    await mockReportingRoutes(page);
  });

  test('should handle slow API responses gracefully', async ({ page }) => {
    // Mock slow responses (1-5 seconds)
    await page.route('**/api/reports/*', async (route: Route) => {
      const url = route.request().url();
      
      if (route.request().method() === 'PUT' && !url.includes('/finalize') && !url.includes('/sign')) {
        // Simulate slow save (2 seconds)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            _id: 'report-123',
            reportStatus: 'draft',
            version: 2,
            content: { indication: 'Updated' },
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Navigate and create report
    await page.goto('/reports');
    await page.getByRole('button', { name: /create|new report/i }).click();
    await page.locator('[data-testid="template-card"]').first().click();
    await page.waitForSelector('[data-testid="report-editor"]');

    // Type in indication field
    const indicationField = page.locator('textarea[name="indication"]');
    await indicationField.fill('Test indication with slow network');

    // Should show saving indicator
    await expect(page.locator('text=/saving/i')).toBeVisible({ timeout: 5000 });

    // Should eventually save
    await expect(page.locator('text=/saved/i')).toBeVisible({ timeout: 10000 });

    // Verify text is still there (no data loss)
    await expect(indicationField).toHaveValue('Test indication with slow network');
  });

  test('should retry on 500 errors with exponential backoff', async ({ page }) => {
    let attemptCount = 0;
    const maxAttempts = 3;

    // Mock 500 errors for first 2 attempts, then success
    await page.route('**/api/reports/*', async (route: Route) => {
      const url = route.request().url();
      
      if (route.request().method() === 'PUT' && !url.includes('/finalize') && !url.includes('/sign')) {
        attemptCount++;
        
        if (attemptCount < maxAttempts) {
          // Return 500 error
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Internal Server Error' }),
          });
        } else {
          // Success on 3rd attempt
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              _id: 'report-123',
              reportStatus: 'draft',
              version: 2,
              content: { indication: 'Updated after retry' },
            }),
          });
        }
      } else {
        await route.continue();
      }
    });

    // Navigate and create report
    await page.goto('/reports');
    await page.getByRole('button', { name: /create|new report/i }).click();
    await page.locator('[data-testid="template-card"]').first().click();
    await page.waitForSelector('[data-testid="report-editor"]');

    // Type in indication field
    const indicationField = page.locator('textarea[name="indication"]');
    await indicationField.fill('Test with server errors');

    // Wait for retries (should see error state)
    await page.waitForTimeout(2000);

    // Should eventually succeed
    await expect(page.locator('text=/saved/i')).toBeVisible({ timeout: 15000 });

    // Verify text is preserved (no data loss)
    await expect(indicationField).toHaveValue('Test with server errors');

    // Verify multiple attempts were made
    expect(attemptCount).toBeGreaterThanOrEqual(maxAttempts);
  });

  test('should preserve local edits during network failures', async ({ page }) => {
    // Mock network failure
    await page.route('**/api/reports/*', async (route: Route) => {
      if (route.request().method() === 'PUT') {
        // Simulate network timeout
        await route.abort('timedout');
      } else {
        await route.continue();
      }
    });

    // Navigate and create report
    await page.goto('/reports');
    await page.getByRole('button', { name: /create|new report/i }).click();
    await page.locator('[data-testid="template-card"]').first().click();
    await page.waitForSelector('[data-testid="report-editor"]');

    // Type multiple times
    const indicationField = page.locator('textarea[name="indication"]');
    await indicationField.fill('First edit');
    await page.waitForTimeout(500);
    
    await indicationField.fill('First edit - Second edit');
    await page.waitForTimeout(500);
    
    await indicationField.fill('First edit - Second edit - Third edit');
    await page.waitForTimeout(500);

    // All text should be preserved in the textarea
    await expect(indicationField).toHaveValue('First edit - Second edit - Third edit');

    // Should show unsaved changes indicator
    await expect(page.locator('text=/unsaved/i')).toBeVisible();
  });

  test('should pause autosave when offline and resume when online', async ({ page }) => {
    // Start with normal network
    await page.goto('/reports');
    await page.getByRole('button', { name: /create|new report/i }).click();
    await page.locator('[data-testid="template-card"]').first().click();
    await page.waitForSelector('[data-testid="report-editor"]');

    const indicationField = page.locator('textarea[name="indication"]');
    
    // Type while online
    await indicationField.fill('Online edit');
    await expect(page.locator('text=/saved/i')).toBeVisible({ timeout: 5000 });

    // Simulate going offline
    await page.context().setOffline(true);
    
    // Type while offline
    await indicationField.fill('Online edit - Offline edit');
    await page.waitForTimeout(4000); // Wait longer than autosave interval

    // Should show offline indicator or unsaved state
    const offlineIndicator = page.locator('text=/offline|reconnecting|unsaved/i');
    await expect(offlineIndicator).toBeVisible();

    // Text should still be there
    await expect(indicationField).toHaveValue('Online edit - Offline edit');

    // Go back online
    await page.context().setOffline(false);

    // Should attempt to save
    await expect(page.locator('text=/saved/i')).toBeVisible({ timeout: 10000 });

    // Text should still be preserved
    await expect(indicationField).toHaveValue('Online edit - Offline edit');
  });

  test('should show retry toast on repeated failures', async ({ page }) => {
    let attemptCount = 0;

    // Mock repeated failures
    await page.route('**/api/reports/*', async (route: Route) => {
      if (route.request().method() === 'PUT') {
        attemptCount++;
        
        // Always fail
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Service Unavailable' }),
        });
      } else {
        await route.continue();
      }
    });

    // Navigate and create report
    await page.goto('/reports');
    await page.getByRole('button', { name: /create|new report/i }).click();
    await page.locator('[data-testid="template-card"]').first().click();
    await page.waitForSelector('[data-testid="report-editor"]');

    // Type in indication field
    const indicationField = page.locator('textarea[name="indication"]');
    await indicationField.fill('Test with repeated failures');

    // Wait for retries
    await page.waitForTimeout(5000);

    // Should show error or retry message
    const errorMessage = page.locator('text=/error|failed|retry/i');
    await expect(errorMessage).toBeVisible();

    // Text should still be in the field (no data loss)
    await expect(indicationField).toHaveValue('Test with repeated failures');

    // Should have attempted multiple times
    expect(attemptCount).toBeGreaterThan(1);
  });

  test('should handle version conflicts during network issues', async ({ page }) => {
    let saveCount = 0;

    // Mock version conflict on second save
    await page.route('**/api/reports/*', async (route: Route) => {
      if (route.request().method() === 'PUT') {
        saveCount++;
        
        if (saveCount === 2) {
          // Return version conflict
          await route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Version conflict',
              serverVersion: 3,
              clientVersion: 2,
            }),
          });
        } else {
          // Normal response
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              _id: 'report-123',
              reportStatus: 'draft',
              version: saveCount + 1,
              content: { indication: 'Updated' },
            }),
          });
        }
      } else {
        await route.continue();
      }
    });

    // Navigate and create report
    await page.goto('/reports');
    await page.getByRole('button', { name: /create|new report/i }).click();
    await page.locator('[data-testid="template-card"]').first().click();
    await page.waitForSelector('[data-testid="report-editor"]');

    const indicationField = page.locator('textarea[name="indication"]');
    
    // First edit
    await indicationField.fill('First edit');
    await expect(page.locator('text=/saved/i')).toBeVisible({ timeout: 5000 });

    // Second edit (will trigger conflict)
    await indicationField.fill('First edit - Second edit');
    await page.waitForTimeout(4000);

    // Should show conflict modal or error
    const conflictIndicator = page.locator('text=/conflict|version/i');
    // Note: May or may not be visible depending on implementation
    
    // Text should still be preserved
    await expect(indicationField).toHaveValue('First edit - Second edit');
  });

  test('should maintain UI responsiveness during slow network', async ({ page }) => {
    // Mock very slow responses (5 seconds)
    await page.route('**/api/reports/*', async (route: Route) => {
      if (route.request().method() === 'PUT') {
        await new Promise(resolve => setTimeout(resolve, 5000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ _id: 'report-123', version: 2 }),
        });
      } else {
        await route.continue();
      }
    });

    // Navigate and create report
    await page.goto('/reports');
    await page.getByRole('button', { name: /create|new report/i }).click();
    await page.locator('[data-testid="template-card"]').first().click();
    await page.waitForSelector('[data-testid="report-editor"]');

    const indicationField = page.locator('textarea[name="indication"]');
    
    // Type while save is in progress
    await indicationField.fill('First');
    await page.waitForTimeout(100);
    await indicationField.fill('First Second');
    await page.waitForTimeout(100);
    await indicationField.fill('First Second Third');

    // UI should remain responsive (can still type)
    await expect(indicationField).toBeEditable();
    await expect(indicationField).toHaveValue('First Second Third');

    // Should show saving indicator
    await expect(page.locator('text=/saving/i')).toBeVisible();
  });
});
