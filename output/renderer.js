// output/renderer.js

import puppeteer from 'puppeteer'

export const renderToPNG = async (html, css) => {
  let browser
  
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 
                      process.env.CHROME_BIN ||
                      '/usr/bin/chromium-browser' ||
                      undefined
    })
    
    const page = await browser.newPage()
    
    await page.setViewport({
      width: 1080,
      height: 1080,
      deviceScaleFactor: 2
    })
    
    const fullHTML = `
      <!DOCTYPE html>
      <html lang="en" dir="ltr">
        <head>
          <meta charset="UTF-8">
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;700;900&family=Assistant:wght@400;700&family=Rubik:wght@400;700&display=swap" rel="stylesheet">
          <style>
            ${css}
            
            * {
              font-family: 'Heebo', 'Assistant', 'Rubik', Arial, sans-serif !important;
            }
          </style>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `
    
    await page.setContent(fullHTML, {
      waitUntil: 'networkidle0',
      timeout: 10000
    })
    
    await page.evaluateHandle('document.fonts.ready')
    
    const screenshot = await page.screenshot({
      type: 'png',
      encoding: 'base64',
      fullPage: false
    })
    
    await browser.close()
    
    return screenshot
    
  } catch (error) {
    if (browser) {
      await browser.close()
    }
    throw error
  }
}
```

---
