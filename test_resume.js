const { chromium } = require('playwright');
const path = require('path');

const tmpDir = 'C:/Users/ffw/AppData/Local/Temp';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // 收集控制台消息
  const consoleMessages = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push({ type: msg.type(), text: text });
  });
  
  // 收集所有网络请求（不过滤）
  const allRequests = [];
  page.on('request', request => {
    allRequests.push({
      url: request.url(),
      method: request.method(),
    });
  });
  
  // 收集所有响应
  const allResponses = [];
  page.on('response', async response => {
    try {
      const body = await response.text();
      allResponses.push({ 
        url: response.url(), 
        status: response.status(),
        body: body
      });
    } catch (e) {}
  });
  
  try {
    console.log('=== 1. 访问主页 ===');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    
    console.log('=== 2. 导航到简历上传页面 ===');
    await page.goto('http://localhost:5173/resume', { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(tmpDir, 'resume_test_2.png') });
    
    // 等待上传区域
    await page.waitForSelector('.ant-upload-drag', { timeout: 10000 });
    
    console.log('=== 3. 上传测试简历 ===');
    const filePath = 'D:/Users/ffw/Desktop/a13/程序/backend/test_resume.docx';
    const fileInput = await page.locator('.ant-upload-drag input[type="file"]');
    await fileInput.setInputFiles(filePath);
    console.log('已选择文件');
    
    // 等待上传
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(tmpDir, 'resume_test_3.png') });
    
    // 等待解析
    await page.waitForTimeout(10000);
    await page.screenshot({ path: path.join(tmpDir, 'resume_test_4.png') });
    
    // 输出所有请求
    console.log('\n=== 所有网络请求 ===');
    allRequests.forEach(req => {
      if (req.url.includes('upload') || req.url.includes('resume') || req.url.includes('api/students')) {
        console.log(`${req.method} ${req.url}`);
      }
    });
    
    // 输出所有包含 resume 或 upload 的响应
    console.log('\n=== 简历相关响应 ===');
    for (const resp of allResponses) {
      if (resp.url.includes('upload') || resp.url.includes('resume')) {
        console.log(`\nURL: ${resp.url}`);
        console.log(`Status: ${resp.status}`);
        try {
          const parsed = JSON.parse(resp.body);
          console.log(`Body: ${JSON.stringify(parsed, null, 2).substring(0, 2000)}`);
        } catch (e) {
          console.log(`Body: ${resp.body.substring(0, 500)}`);
        }
      }
    }
    
    // 输出所有控制台消息
    console.log('\n=== 所有控制台消息 ===');
    consoleMessages.forEach(msg => {
      console.log(`[${msg.type}] ${msg.text}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
    await page.screenshot({ path: path.join(tmpDir, 'resume_test_error.png') });
  }
  
  await page.waitForTimeout(3000);
  await browser.close();
})();
