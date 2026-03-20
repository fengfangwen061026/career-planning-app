const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

async function run() {
  const outDir = path.resolve('playwright-artifacts');
  fs.mkdirSync(outDir, { recursive: true });

  const desktopErrors = [];
  const mobileErrors = [];
  const desktopShots = [];
  const mobileShots = [];
  const sampleResume = path.resolve('应届生通用简历.docx');

  function attachObservers(page, bucket, failedBucket) {
    page.on('console', (msg) => {
      if (['error', 'warning'].includes(msg.type())) {
        bucket.push(`[console:${msg.type()}] ${msg.text()}`);
      }
    });
    page.on('pageerror', (err) => {
      bucket.push(`[pageerror] ${err.message}`);
    });
    page.on('requestfailed', (req) => {
      failedBucket.push(
        `[requestfailed] ${req.method()} ${req.url()} -> ${req.failure()?.errorText || 'unknown'}`,
      );
    });
    page.on('response', (res) => {
      if (res.status() >= 400) {
        failedBucket.push(`[http ${res.status()}] ${res.request().method()} ${res.url()}`);
      }
    });
  }

  const browser = await chromium.launch({ headless: true });

  try {
    const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    const desktopPage = await desktopContext.newPage();
    attachObservers(desktopPage, desktopErrors, desktopErrors);

    const desktopRoutes = [
      { name: 'dashboard', url: 'http://127.0.0.1:5173/' },
      { name: 'jobs', url: 'http://127.0.0.1:5173/jobs' },
      { name: 'job-profiles', url: 'http://127.0.0.1:5173/jobs/profiles' },
      { name: 'job-graph', url: 'http://127.0.0.1:5173/jobs/graph' },
      { name: 'resume', url: 'http://127.0.0.1:5173/resume' },
      { name: 'students', url: 'http://127.0.0.1:5173/students' },
      { name: 'matching', url: 'http://127.0.0.1:5173/matching' },
      { name: 'reports', url: 'http://127.0.0.1:5173/reports' },
    ];

    for (const route of desktopRoutes) {
      await desktopPage.goto(route.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await desktopPage.waitForTimeout(2000);
      const shot = path.join(outDir, `desktop-${route.name}.png`);
      await desktopPage.screenshot({ path: shot, fullPage: true });
      desktopShots.push(shot);
    }

    const mobileContext = await browser.newContext({ ...devices['iPhone 13'] });
    const mobilePage = await mobileContext.newPage();
    attachObservers(mobilePage, mobileErrors, mobileErrors);

    await mobilePage.goto('http://127.0.0.1:5176/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await mobilePage.waitForTimeout(1200);
    const onboardingShot = path.join(outDir, 'mobile-onboarding.png');
    await mobilePage.screenshot({ path: onboardingShot, fullPage: true });
    mobileShots.push(onboardingShot);

    const inputs = mobilePage.locator('input');
    await inputs.nth(0).fill('Playwright测试同学');
    await inputs.nth(1).fill(`playwright-${Date.now()}@example.com`);
    await mobilePage.locator('form button[type="submit"]').click();
    await mobilePage.waitForURL(/\/upload$/, { timeout: 30000 });
    await mobilePage.waitForTimeout(1200);

    const uploadShot = path.join(outDir, 'mobile-upload.png');
    await mobilePage.screenshot({ path: uploadShot, fullPage: true });
    mobileShots.push(uploadShot);

    await mobilePage.locator('input[type="file"]').setInputFiles(sampleResume);
    await mobilePage.waitForURL(/\/parsing$/, { timeout: 15000 });
    const parsingShot = path.join(outDir, 'mobile-parsing-start.png');
    await mobilePage.screenshot({ path: parsingShot, fullPage: true });
    mobileShots.push(parsingShot);

    await mobilePage.waitForURL(/\/profile$/, { timeout: 240000 });
    await mobilePage.waitForTimeout(1500);
    const profileShot = path.join(outDir, 'mobile-profile.png');
    await mobilePage.screenshot({ path: profileShot, fullPage: true });
    mobileShots.push(profileShot);

    const aiFillButton = mobilePage.getByRole('button', { name: 'AI 对话补全画像' });
    if (await aiFillButton.isVisible().catch(() => false)) {
      await aiFillButton.click();
      await mobilePage.waitForURL(/\/chat-fill$/, { timeout: 20000 });
      await mobilePage.waitForTimeout(1500);

      for (let i = 0; i < 3; i += 1) {
        const textarea = mobilePage.locator('textarea');
        if (!(await textarea.isVisible().catch(() => false))) {
          break;
        }
        await textarea.fill(
          i === 0
            ? '我负责接口开发与联调，服务多个团队使用，并通过优化查询把响应时间缩短约30%。'
            : '我组织过跨团队协作，定期同步进度并推动需求按计划落地。',
        );
        const primaryButton = mobilePage.locator('button').filter({ hasText: /下一题|完成并写回画像/ }).last();
        if (!(await primaryButton.isVisible().catch(() => false))) {
          break;
        }
        await primaryButton.click();
        await mobilePage.waitForTimeout(1000);
        if (/\/profile$/.test(mobilePage.url())) {
          break;
        }
      }

      await mobilePage.waitForURL(/\/profile$/, { timeout: 30000 }).catch(() => {});
    }

    await mobilePage.goto('http://127.0.0.1:5176/explore', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await mobilePage.waitForFunction(
      () => {
        const text = document.body.innerText;
        const hasCards = Array.from(document.querySelectorAll('button')).some((button) =>
          (button.textContent || '').includes('匹配分'),
        );
        const loading = text.includes('正在刷新推荐');
        const hasError = text.includes('加载推荐失败');
        return hasCards || hasError || !loading;
      },
      { timeout: 90000 },
    ).catch(() => {});
    await mobilePage.waitForTimeout(1200);
    const exploreShot = path.join(outDir, 'mobile-explore.png');
    await mobilePage.screenshot({ path: exploreShot, fullPage: true });
    mobileShots.push(exploreShot);

    const recommendationCards = mobilePage.locator('button').filter({ hasText: '匹配分' });
    const recommendationCardCount = await recommendationCards.count();

    if (recommendationCardCount > 0) {
      await recommendationCards.first().click();
      await mobilePage.waitForURL(/\/match\//, { timeout: 20000 });
      await mobilePage.waitForTimeout(2500);
      const detailShot = path.join(outDir, 'mobile-match-detail.png');
      await mobilePage.screenshot({ path: detailShot, fullPage: true });
      mobileShots.push(detailShot);

      const reportEntryButton = mobilePage.getByRole('button', { name: '基于该岗位生成职业规划报告' });
      await reportEntryButton.click();
      await mobilePage.waitForURL(/\/report$/, { timeout: 20000 });
    } else {
      await mobilePage.goto('http://127.0.0.1:5176/report', { waitUntil: 'domcontentloaded', timeout: 30000 });
    }
    await mobilePage.waitForTimeout(1200);

    const generateButton = mobilePage.locator('button').filter({ hasText: /为当前岗位生成报告|生成最新报告/ }).first();
    if (await generateButton.isVisible().catch(() => false)) {
      await generateButton.click();
    }

    await mobilePage.waitForFunction(
      () => {
        const text = document.body.innerText;
        return text.includes('更新时间') || text.includes('历史报告') || text.includes('导出 PDF');
      },
      { timeout: 240000 },
    ).catch(() => {});
    await mobilePage.waitForTimeout(1200);

    const reportShot = path.join(outDir, 'mobile-report.png');
    await mobilePage.screenshot({ path: reportShot, fullPage: true });
    mobileShots.push(reportShot);

    const pdfButton = mobilePage.getByRole('button', { name: '导出 PDF' });
    if (await pdfButton.isVisible().catch(() => false)) {
      const downloadPromise = mobilePage.waitForEvent('download', { timeout: 120000 }).catch(() => null);
      await pdfButton.click();
      const download = await downloadPromise;
      if (download) {
        const filePath = path.join(outDir, await download.suggestedFilename());
        await download.saveAs(filePath);
        mobileShots.push(filePath);
      }
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          desktopErrors,
          mobileErrors,
          desktopShots,
          mobileShots,
          finalMobileUrl: mobilePage.url(),
          recommendationCardCount,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: error && error.stack ? error.stack : String(error),
          desktopErrors,
          mobileErrors,
          desktopShots,
          mobileShots,
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
