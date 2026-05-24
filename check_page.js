const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err));

  console.log("Navigating to localhost:3000...");
  try {
    await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle0' });
    const content = await page.content();
    console.log("Content length:", content.length);
    console.log("Content snippet:", content.substring(0, 200));
  } catch (err) {
    console.error("Navigation error:", err);
  }
  
  await browser.close();
})();
