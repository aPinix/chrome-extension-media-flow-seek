import { chromium } from '/Users/apinix/.npm/_npx/31e32ef8478fbf80/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
const root=path.resolve(import.meta.dirname,'../../../..');
const output=path.resolve(import.meta.dirname,'../assets');
const server=createServer((req,res)=>{
try{const file=path.join(path.resolve(import.meta.dirname,'..'),decodeURIComponent(new URL(req.url,'http://localhost').pathname));const size=statSync(file).size;
const type=file.endsWith('.mp4')?'video/mp4':file.endsWith('.png')?'image/png':'text/html';
if(req.headers.range){const [a,b]=req.headers.range.replace('bytes=','').split('-');const start=Number(a),end=b?Number(b):size-1;res.writeHead(206,{'Content-Type':type,'Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':end-start+1});createReadStream(file,{start,end}).pipe(res)}else{res.writeHead(200,{'Content-Type':type,'Accept-Ranges':'bytes','Content-Length':size});createReadStream(file).pipe(res)}}catch{res.writeHead(404);res.end()}});
await new Promise(resolve=>server.listen(4179,'127.0.0.1',resolve));
const context=await chromium.launchPersistentContext(await fs.mkdtemp('/tmp/bvc-promo-browser-'),{
  executablePath:'/Users/apinix/Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  headless:true, viewport:{width:1280,height:800}, deviceScaleFactor:1,
  args:[`--disable-extensions-except=${root}/.output/chrome-mv3`,`--load-extension=${root}/.output/chrome-mv3`,'--autoplay-policy=no-user-gesture-required'],
  recordVideo:{dir:output,size:{width:1280,height:800}}
});
const page=await context.newPage();
const logs=[];
page.on('pageerror',e=>logs.push({error:e.message}));
await page.goto('http://localhost:4179/capture/demo.html');
await page.waitForFunction(()=>document.querySelector('video').readyState>=2);
await page.waitForTimeout(1800);
await page.evaluate(async()=>{const v=document.querySelector('video');v.pause();v.currentTime=3;await new Promise(resolve=>v.addEventListener('seeked',resolve,{once:true}))});
await page.mouse.move(645,415);
await page.waitForTimeout(500);
const start=performance.now();
const state=async(label)=>logs.push({label,elapsed:(performance.now()-start)/1000,...await page.evaluate(()=>({time:document.querySelector('video').currentTime,overlays:document.querySelectorAll('.scrub-wrapper').length,speed:document.querySelector('.mfs-seek-speed-label')?.textContent}))});
const waitUntil=async(t)=>{const wait=t*1000-(performance.now()-start);if(wait>0)await page.waitForTimeout(wait)};
const swipe=async(delta,count,keys=[])=>{for(const key of keys)await page.keyboard.down(key);for(let i=0;i<count;i++){await page.mouse.wheel(-delta,0);await page.waitForTimeout(70)}for(const key of keys.reverse())await page.keyboard.up(key)};
await state('start');
await waitUntil(.65);await swipe(64,16);await state('forward');
await waitUntil(3.1);await swipe(-44,9);await state('backward');
await waitUntil(5.5);await swipe(36,10);await state('forward-again');
await waitUntil(7.8);await swipe(-62,13);await state('rewind');
await waitUntil(10.8);await swipe(34,9,['Alt']);await state('fast');
await waitUntil(14.5);await swipe(-40,10,['Alt','Shift']);await state('precision-back');
await waitUntil(16.2);await swipe(27,8,['Alt','Shift']);await state('precision-forward');
await waitUntil(18.4);await page.screenshot({path:path.join(output,'usage-still.png')});
await fs.writeFile(path.join(output,'capture-log.json'),JSON.stringify(logs,null,2));
await page.close();
await page.video().saveAs(path.join(output,'usage-raw.webm'));
await context.close();
server.close();
console.log(JSON.stringify(logs,null,2));
