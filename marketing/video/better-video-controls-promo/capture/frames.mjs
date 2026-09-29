import { chromium } from '/Users/apinix/.npm/_npx/31e32ef8478fbf80/node_modules/playwright/index.mjs';
import path from 'node:path';
const browser=await chromium.launch({headless:true,executablePath:'/Users/apinix/Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
await page.goto('file://'+path.resolve(import.meta.dirname,'../index.html'));
await page.waitForTimeout(500);
for(const t of [1.8,7,12,16.8,22]){
 await page.evaluate(t=>{window.__timelines.main.seek(t);const v=document.querySelector('video');v.currentTime=Math.min(t,18)},t);
 await page.waitForTimeout(350);
 await page.screenshot({path:path.resolve(import.meta.dirname,`../assets/frame-${t}.png`)});
}
await browser.close();
