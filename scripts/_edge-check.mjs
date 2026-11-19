import puppeteer from 'puppeteer-core';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: 'new', args: ['--mute-audio'], defaultViewport: { width: 1600, height: 900 },
});
const page = await browser.newPage();
await page.goto('http://localhost:4175/', { waitUntil: 'domcontentloaded' });
await sleep(14000);
const info = await page.evaluate(() => {
  const sheet = [...document.styleSheets].find((s) => s.href && s.href.endsWith('.css'));
  const svg = [...document.querySelectorAll('svg')].find((s) => s.getBoundingClientRect().width > 300);
  return {
    rules: sheet ? sheet.cssRules.length : 0,
    oversizedSvg: svg ? Math.round(svg.getBoundingClientRect().width) : null,
    svgCount: document.querySelectorAll('svg').length,
  };
});
console.log('桌面 Edge 读同一份 CSS:', JSON.stringify(info));
await page.screenshot({ path: 'D:\\ds-whale-shooter-mobile\\shots\\11-edge-flattened.png' });
await browser.close();