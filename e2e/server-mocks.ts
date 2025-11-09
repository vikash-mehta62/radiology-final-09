import { Page, Route } from '@playwright/test';

/**
 * Mock API responses for E2E testing
 * Enable with PW_USE_MOCK=1 environment variable
 */

// Mock data fixtures
const MOCK_USER = {
  _id: 'user-123',
  username: 'test-radiologist',
  email: 'radiologist@test.com',
  role: 'radiologist',
  canSign: true,
};

const MOCK_TEMPLATE = {
  _id: 'template-xray-chest',
  name: 'Chest X-Ray',
  modality: 'CR',
  bodyPart: 'CHEST',
  sections: [
    { id: 'indication', label: 'Clinical Indication', type: 'text' },
    { id: 'technique', label: 'Technique', type: 'text' },
    { id: 'findings', label: 'Findings', type: 'structured' },
    { id: 'impression', label: 'Impression', type: 'text' },
  ],
};

let MOCK_REPORTS: any[] = [];
let reportIdCounter = 1;

export function createMockReport(overrides: any = {}) {
  const id = `report-${reportIdCounter++}`;
  return {
    _id: id,
    reportId: id,
    patientId: 'patient-123',
    studyInstanceUID: 'study-456',
    templateId: 'template-xray-chest',
    reportStatus: 'draft',
    version: 1,
    content: {
      indication: '',
      technique: '',
      findings: [],
      impression: '',
    },
    metadata: {
      createdBy: 'user-123',
      createdAt: new Date().toISOString(),
      lastModifiedBy: 'user-123',
      lastModifiedAt: new Date().toISOString(),
    },
    ...overrides,
  };
}

export async function mockReportingRoutes(page: Page) {
  const useMock = process.env.PW_USE_MOCK === '1';
  if (!useMock) return;

  // Mock GET /api/reports (list)
  await page.route('**/api/reports?*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_REPORTS),
    });
  });

  // Mock GET /api/reports/:id (single report)
  await page.route('**/api/reports/*', async (route: Route) => {
    const method = route.request().method();
    const url = route.request().url();
    const reportId = url.split('/reports/')[1]?.split('?')[0]?.split('/')[0];

    if (method === 'GET') {
      const report = MOCK_REPORTS.find(r => r._id === reportId || r.reportId === reportId);
      if (report) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(report),
        });
      } else {
        await route.fulfill({ status: 404, body: 'Report not found' });
      }
      return;
    }

    if (method === 'PUT' && url.includes('/finalize')) {
      const report = MOCK_REPORTS.find(r => r._id === reportId || r.reportId === reportId);
      if (report) {
        report.reportStatus = 'preliminary';
        report.version += 1;
        report.metadata.lastModifiedAt = new Date().toISOString();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(report),
        });
      } else {
        await route.fulfill({ status: 404 });
      }
      return;
    }

    if (method === 'POST' && url.includes('/sign')) {
      const report = MOCK_REPORTS.find(r => r._id === reportId || r.reportId === reportId);
      if (report) {
        const body = await route.request().postDataJSON();
        report.reportStatus = 'final';
        report.version += 1;
        report.signature = {
          signedBy: 'user-123',
          signedAt: new Date().toISOString(),
          signatureData: body.signatureData || 'mock-signature-base64',
          meaning: body.meaning || 'Approved',
        };
        report.metadata.lastModifiedAt = new Date().toISOString();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(report),
        });
      } else {
        await route.fulfill({ status: 404 });
      }
      return;
    }

    if (method === 'POST' && url.includes('/addendum')) {
      const report = MOCK_REPORTS.find(r => r._id === reportId || r.reportId === reportId);
      if (report) {
        const body = await route.request().postDataJSON();
        report.addenda = report.addenda || [];
        report.addenda.push({
          text: body.text,
          addedBy: 'user-123',
          addedAt: new Date().toISOString(),
        });
        report.version += 1;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(report),
        });
      } else {
        await route.fulfill({ status: 404 });
      }
      return;
    }

    if (method === 'GET' && url.includes('/export')) {
      const format = url.includes('format=pdf') ? 'pdf' : 'docx';
      const mockBlob = Buffer.from(`Mock ${format.toUpperCase()} content for report ${reportId}`);
      await route.fulfill({
        status: 200,
        contentType: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        body: mockBlob,
        headers: {
          'Content-Disposition': `attachment; filename="report-${reportId}.${format}"`,
        },
      });
      return;
    }

    // Default: continue to real API
    await route.continue();
  });

  // Mock POST /api/reports (create)
  await page.route('**/api/reports', async (route: Route) => {
    if (route.request().method() === 'POST') {
      const body = await route.request().postDataJSON();
      const newReport = createMockReport(body);
      MOCK_REPORTS.push(newReport);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(newReport),
      });
    } else {
      await route.continue();
    }
  });

  // Mock templates
  await page.route('**/api/templates*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([MOCK_TEMPLATE]),
    });
  });

  // Mock auth/user
  await page.route('**/api/auth/me', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_USER),
    });
  });
}

export function resetMockData() {
  MOCK_REPORTS = [];
  reportIdCounter = 1;
}

export { MOCK_USER, MOCK_TEMPLATE };
