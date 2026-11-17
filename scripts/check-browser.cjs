const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:1100}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:3000',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Classic view',exact:true}).click();
 await page.getByRole('button',{name:'View Linen Everyday Shirt',exact:true}).click();
 await page.getByRole('button',{name:'M',exact:true}).click();
 await page.getByRole('button',{name:'Add to bag',exact:false}).click();
 await page.getByRole('button',{name:'My bag',exact:false}).click();
 await page.getByRole('button',{name:'Continue to checkout'}).click();
 await page.getByLabel('Full name').fill('Demo Customer');await page.getByLabel('Email address').fill('demo@example.com');await page.getByLabel('Phone number').fill('03001234567');await page.getByLabel('Street address').fill('123 Demo Street');await page.getByLabel('City',{exact:true}).fill('Lahore');await page.getByLabel('Postal code').fill('54000');
 await page.getByRole('button',{name:'Place demo order'}).click();
 await page.getByRole('heading',{name:'Lovely choices.'}).waitFor();
 await page.getByRole('button',{name:'Back to discovering'}).click();
 await page.getByRole('button',{name:'Demo studio'}).click();
 await page.getByRole('button',{name:'Active',exact:true}).first().click();
 await page.getByRole('button',{name:'Close panel'}).click();
 assert.equal(await page.getByRole('button',{name:'View Linen Everyday Shirt',exact:true}).count(),0);
 await page.reload();await page.waitForTimeout(800);assert.equal(await page.getByRole('button',{name:'View Linen Everyday Shirt',exact:true}).count(),0);
 await page.getByRole('button',{name:'Demo studio'}).click();await page.getByRole('button',{name:'Hidden',exact:true}).click();await page.getByRole('button',{name:'Close panel'}).click();
 await page.getByRole('button',{name:'3D mall',exact:true}).click();
 await page.waitForTimeout(2000);assert.equal(await page.locator('canvas').count(),1);
 await page.screenshot({path:'desktop-preview.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'mobile-preview.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'mobile page must not overflow');
 await page.goto('http://localhost:3000/shops/ms-clothing/products/linen-everyday-shirt');await page.getByRole('heading',{name:'Linen Everyday Shirt'}).waitFor();
 assert.equal(errors.length,0,errors.join('\n'));console.log('PASS: bag, variants, checkout, visibility persistence, 3D canvas, mobile layout, SSR product page.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});


