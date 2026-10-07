const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('https://workspace.pautta.app/auth');
  
  // Wait for email input
  await page.waitForSelector('input[type="email"]', { timeout: 5000 }).catch(() => console.log('no email input'));
  
  // Try to type credentials
  try {
    await page.type('input[type="email"]', 'everton.cmi.mkt@gmail.com');
    await page.type('input[type="password"]', '3ff3f4f95cfd5c17');
    await page.click('button[type="submit"]');
  } catch (e) {
    console.log('Login form failed:', e.message);
  }
  
  // Wait for login to process
  await new Promise(r => setTimeout(r, 5000));
  
  // Extract text
  const text = await page.evaluate(() => document.body.innerText);
  console.log("TEXT START\n", text.substring(0, 3000), "\nTEXT END");
  
  // Extract links to see menu items
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a')).map(a => a.innerText + ' (' + a.href + ')');
  });
  console.log("LINKS:\n", links.join('\n'));
  
  await page.setViewport({width: 1440, height: 900}); await page.screenshot({path: 'C:/Users/Aécio/.gemini/antigravity-ide/brain/72a4f1e6-fa3e-4651-8d5c-91a28d929045/pautta_dashboard.png', fullPage: true}); await browser.close();
})();
