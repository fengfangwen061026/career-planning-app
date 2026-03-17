import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs/promises';

const screenshotDir = path.resolve('artifacts', 'resume-e2e');

async function findResumeFile() {
  const candidates = [
    path.resolve('..', 'backend', 'uploads', 'resumes', '9e882ecb-816d-4478-b836-4dcaf7bc1660'),
    path.resolve('..', 'backend'),
    path.resolve('..'),
  ];

  for (const dir of candidates) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          try {
            const nested = await findResumeFileInDir(fullPath);
            if (nested) {
              return nested;
            }
          } catch {
            // ignore nested lookup errors for unrelated directories
          }
        } else if (entry.isFile() && entry.name.endsWith('.docx') && entry.name.includes('冯访问')) {
          return fullPath;
        }
      }
    } catch {
      // ignore missing directories
    }
  }

  throw new Error('Could not find 冯访问个人简历.docx');
}

async function findResumeFileInDir(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await findResumeFileInDir(fullPath);
      if (nested) {
        return nested;
      }
    } else if (entry.isFile() && entry.name.endsWith('.docx') && entry.name.includes('冯访问')) {
      return fullPath;
    }
  }
  return null;
}

await fs.mkdir(screenshotDir, { recursive: true });
const resumePath = await findResumeFile();

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

page.on('console', (msg) => {
  console.log(`[browser:${msg.type()}] ${msg.text()}`);
});

page.on('pageerror', (error) => {
  console.log(`[pageerror] ${error.stack || error.message}`);
});

page.on('response', async (response) => {
  if (response.status() >= 400) {
    let body = '';
    try {
      body = await response.text();
    } catch {
      body = '<unreadable>';
    }
    console.log(`[response:${response.status()}] ${response.url()} ${body.slice(0, 1000)}`);
  }
});

async function screenshot(name) {
  const target = path.join(screenshotDir, name);
  await page.screenshot({ path: target, fullPage: true });
  console.log(`[screenshot] ${target}`);
}

async function removeViteOverlay() {
  await page.evaluate(() => {
    document.querySelector('vite-error-overlay')?.remove();
  });
}

try {
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await screenshot('01-home.png');

  await page.getByText('简历上传').first().click();
  await page.waitForURL('**/resume', { timeout: 30000 });
  await page.locator('.ant-select').first().click();
  await page.locator('.ant-select-item-option').first().click();
  await page.locator('input[type="file"]').setInputFiles(resumePath);
  await page.waitForSelector('text=基本信息', { timeout: 120000 });
  await page.waitForTimeout(1500);
  await screenshot('02-preview.png');

  const visibleInputs = page.locator('input:visible');
  const inputValues = await visibleInputs.evaluateAll((nodes) =>
    nodes.map((node) => ({
      id: node.id,
      placeholder: node.getAttribute('placeholder'),
      value: (node instanceof HTMLInputElement ? node.value : ''),
    }))
  );
  console.log(`[debug] visible input values ${JSON.stringify(inputValues, null, 2)}`);

  const schoolValue = inputValues.find((item) => item.id === 'education_0_school')?.value || '';
  const majorValue = inputValues.find((item) => item.id === 'education_0_major')?.value || '';
  const projectValues = inputValues
    .filter((item) => item.id.startsWith('projects_') && item.id.endsWith('_name'))
    .map((item) => item.value)
    .filter(Boolean);
  console.log(`[assert] preview school value: ${schoolValue}`);
  console.log(`[assert] preview major value: ${majorValue}`);
  console.log(`[assert] preview projects count: ${projectValues.length}`);

  await removeViteOverlay();

  await page.getByRole('button', { name: '确认并创建画像' }).click();
  await page.waitForSelector('text=学生画像创建成功', { timeout: 120000 });
  await page.getByRole('button', { name: '查看学生画像' }).click();
  await page.waitForURL('**/students', { timeout: 30000 });
  await removeViteOverlay();
  await page.locator('.ant-select').first().click();
  await page.locator('.ant-select-item-option').first().click();
  await page.waitForTimeout(2000);
  await screenshot('03-student-profile.png');

  const profileText = await page.locator('body').innerText();
  console.log(`[assert] profile page loaded: ${profileText.includes('学生画像')}`);
  console.log('[result] e2e flow completed');
} finally {
  await browser.close();
}
