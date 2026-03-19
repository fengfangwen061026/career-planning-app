const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium, request } = require('playwright');

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173';
const STUDENT_NAME = process.env.PLAYWRIGHT_STUDENT_NAME || 'Codex Resume E2E';
const STUDENT_ID = process.env.PLAYWRIGHT_STUDENT_ID || '';
const RESUME_FILE = process.env.PLAYWRIGHT_RESUME_FILE || '';
const ARTIFACT_ROOT = path.join(os.tmpdir(), 'codex-resume-playwright');
const SAMPLE_FILES = [
  path.resolve(__dirname, 'backend', 'test_resume.docx'),
  path.resolve(__dirname, '个人简历.docx'),
  path.resolve(__dirname, '读博简历模板.docx'),
];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function safeSlug(value) {
  return value.replace(/[^\w.-]+/g, '_');
}

function uniqueFiles(filePaths) {
  const seen = new Set();
  return filePaths.filter((filePath) => {
    if (!filePath || !fs.existsSync(filePath)) {
      return false;
    }
    const resolved = path.resolve(filePath);
    if (seen.has(resolved)) {
      return false;
    }
    seen.add(resolved);
    return true;
  });
}

async function ensureStudent(apiContext) {
  const response = await apiContext.get('students/');
  if (!response.ok()) {
    throw new Error(`Failed to list students: HTTP ${response.status()}`);
  }

  const students = await response.json();

  if (STUDENT_ID) {
    const matchedById = students.find((student) => student.id === STUDENT_ID);
    if (!matchedById) {
      throw new Error(`Student ${STUDENT_ID} was not found`);
    }
    return matchedById;
  }

  const matchedByName = students.find(
    (student) => (student.name || '').trim() === STUDENT_NAME || (student.email || '').trim() === STUDENT_NAME,
  );
  if (matchedByName) {
    return matchedByName;
  }

  const createResponse = await apiContext.post('students/', {
    data: {
      name: STUDENT_NAME,
      email: `codex-resume-e2e-${Date.now()}@example.com`,
      phone: '13800000000',
    },
  });
  if (!createResponse.ok()) {
    throw new Error(`Failed to create student: HTTP ${createResponse.status()} ${await createResponse.text()}`);
  }
  return createResponse.json();
}

async function selectStudent(page, student) {
  const select = page.locator('[data-testid="resume-student-panel"] .ant-select').first();
  await select.waitFor({ state: 'visible', timeout: 15000 });
  await select.click();

  const optionText = (student.name || student.email || '').trim();
  const option = page.locator('.ant-select-item-option').filter({ hasText: optionText }).first();
  await option.waitFor({ state: 'visible', timeout: 15000 });
  await option.click();
}

async function collectPageState(page) {
  const counts = page.locator('[data-testid="resume-field-counts"]').first();
  const hasCounts = (await counts.count()) > 0;
  const countValues = {
    education: hasCounts ? Number((await counts.getAttribute('data-education-count')) || 0) : 0,
    experience: hasCounts ? Number((await counts.getAttribute('data-experience-count')) || 0) : 0,
    projects: hasCounts ? Number((await counts.getAttribute('data-project-count')) || 0) : 0,
    skills: hasCounts ? Number((await counts.getAttribute('data-skill-count')) || 0) : 0,
  };

  const debugState = await page.evaluate(() => {
    const win = window;
    return win.__resumeUploadDebug || null;
  });

  const warning = page.locator('[data-testid="resume-parse-warning"]').first();
  const warningVisible = await warning.isVisible().catch(() => false);

  return {
    previewVisible: await page.locator('[data-testid="resume-preview"]').isVisible().catch(() => false),
    completeVisible: await page.locator('[data-testid="resume-complete"]').isVisible().catch(() => false),
    parseStatus: await page.locator('[data-testid="resume-preview"]').getAttribute('data-parse-status').catch(() => null),
    warningVisible,
    warningStatus: warningVisible ? await warning.getAttribute('data-status') : null,
    counts: countValues,
    debugState,
  };
}

async function runCase(browser, student, filePath) {
  const fileName = path.basename(filePath);
  const caseSlug = safeSlug(fileName);
  const artifactDir = path.join(ARTIFACT_ROOT, caseSlug);
  ensureDir(artifactDir);

  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleMessages = [];
  const networkEvents = [];

  page.on('console', (msg) => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
    });
  });

  page.on('request', (req) => {
    if (req.url().includes('/resume') || req.url().includes('/api/students')) {
      networkEvents.push({
        kind: 'request',
        method: req.method(),
        url: req.url(),
      });
    }
  });

  page.on('response', async (res) => {
    if (!res.url().includes('/resume') && !res.url().includes('/api/students')) {
      return;
    }
    const entry = {
      kind: 'response',
      url: res.url(),
      status: res.status(),
    };
    try {
      if (!res.url().includes('/upload-resume/stream')) {
        entry.body = (await res.text()).slice(0, 4000);
      }
    } catch (error) {
      entry.bodyError = String(error);
    }
    networkEvents.push(entry);
  });

  let result = null;

  try {
    await page.goto(`${BASE_URL}/resume`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('[data-testid="resume-page"]', { timeout: 15000 });
    await selectStudent(page, student);

    const uploadInput = page.locator('[data-testid="resume-upload-input"]');
    await uploadInput.setInputFiles(filePath);

    await page.waitForFunction(
      () => {
        const win = window;
        const state = win.__resumeUploadDebug;
        if (!state) {
          return false;
        }

        const events = Array.isArray(state.events) ? state.events : [];
        if (events.some((event) => event && event.type === 'ui_error')) {
          return true;
        }

        const parseMeta = state.parseMeta;
        if (!parseMeta || parseMeta.retrying !== false) {
          return false;
        }

        return Boolean(
          document.querySelector('[data-testid="resume-preview"]') ||
          document.querySelector('[data-testid="resume-complete"]'),
        );
      },
      null,
      { timeout: 240000 },
    );

    result = await collectPageState(page);
    await page.screenshot({ path: path.join(artifactDir, 'final.png'), fullPage: true });

    const hasStructuredData =
      result.counts.education > 0 || result.counts.experience > 0 || result.counts.skills > 0;
    const finalFallback = Boolean(result.debugState?.parseMeta?.is_fallback);
    const stillWarning = result.warningVisible && ['fallback', 'retrying'].includes(result.warningStatus || '');
    const passed = (result.previewVisible || result.completeVisible) && !finalFallback && !stillWarning && hasStructuredData;

    const summary = {
      fileName,
      filePath,
      passed,
      ...result,
    };

    fs.writeFileSync(
      path.join(artifactDir, 'summary.json'),
      JSON.stringify(summary, null, 2),
      'utf8',
    );
    fs.writeFileSync(
      path.join(artifactDir, 'console.json'),
      JSON.stringify(consoleMessages, null, 2),
      'utf8',
    );
    fs.writeFileSync(
      path.join(artifactDir, 'network.json'),
      JSON.stringify(networkEvents, null, 2),
      'utf8',
    );

    return summary;
  } catch (error) {
    await page.screenshot({ path: path.join(artifactDir, 'error.png'), fullPage: true }).catch(() => {});
    const debugState = await page.evaluate(() => {
      const win = window;
      return win.__resumeUploadDebug || null;
    }).catch(() => null);
    const failure = {
      fileName,
      filePath,
      passed: false,
      error: String(error),
      debugState,
    };
    fs.writeFileSync(
      path.join(artifactDir, 'failure.json'),
      JSON.stringify(failure, null, 2),
      'utf8',
    );
    fs.writeFileSync(
      path.join(artifactDir, 'console.json'),
      JSON.stringify(consoleMessages, null, 2),
      'utf8',
    );
    fs.writeFileSync(
      path.join(artifactDir, 'network.json'),
      JSON.stringify(networkEvents, null, 2),
      'utf8',
    );
    return failure;
  } finally {
    await context.close();
  }
}

async function main() {
  ensureDir(ARTIFACT_ROOT);

  const apiContext = await request.newContext({
    baseURL: `${BASE_URL}/api/`,
    extraHTTPHeaders: {
      Accept: 'application/json',
    },
  });

  const student = await ensureStudent(apiContext);
  const files = uniqueFiles([RESUME_FILE, ...SAMPLE_FILES]);

  if (files.length === 0) {
    throw new Error('No valid resume files found for Playwright run');
  }

  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    for (const filePath of files) {
      console.log(`\n=== Running resume upload case: ${filePath} ===`);
      const summary = await runCase(browser, student, filePath);
      results.push(summary);
      console.log(JSON.stringify(summary, null, 2));
    }
  } finally {
    await browser.close();
    await apiContext.dispose();
  }

  const failed = results.filter((item) => !item.passed);
  const report = {
    baseUrl: BASE_URL,
    artifactRoot: ARTIFACT_ROOT,
    student: {
      id: student.id,
      name: student.name,
      email: student.email,
    },
    cases: results,
    failedCount: failed.length,
  };

  fs.writeFileSync(
    path.join(ARTIFACT_ROOT, 'report.json'),
    JSON.stringify(report, null, 2),
    'utf8',
  );

  if (failed.length > 0) {
    console.error(`\nResume Playwright run failed for ${failed.length} case(s). Artifacts: ${ARTIFACT_ROOT}`);
    process.exitCode = 1;
    return;
  }

  console.log(`\nResume Playwright run passed. Artifacts: ${ARTIFACT_ROOT}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
