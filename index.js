const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

async function uploadTikTok() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  const cookiesPath = path.join(__dirname, "cookies.json");
  if (fs.existsSync(cookiesPath)) {
    const cookies = JSON.parse(fs.readFileSync(cookiesPath));
    await context.addCookies(cookies);
  }

  const page = await context.newPage();
  await page.goto("https://www.tiktok.com/upload", { waitUntil: "networkidle" });

  await browser.close();
}

(async () => {
  await uploadTikTok();
})();
