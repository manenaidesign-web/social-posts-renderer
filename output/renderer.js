// output/renderer.js

import { chromium } from 'playwright'

export const renderToPNG = async (html, css) => {
  let browser
  
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    
    const context = await browser.newContext({
      viewport: { width: 1080, height: 1080 },
      deviceScaleFactor: 2
    })
    
    const page = await context.newPage()
    
    const fullHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;700;900&family=Assistant:wght@400;700&display=swap" rel="stylesheet">
          <style>
            ${css}
            * {
              font-family: 'Heebo', 'Assistant', Arial, sans-serif !important;
            }
          </style>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `
    
    await page.setContent(fullHTML, {
      waitUntil: 'networkidle',
      timeout: 10000
    })
    
    await page.waitForLoadState('networkidle')
    
    const screenshot = await page.screenshot({
      type: 'png'
    })
    
    await browser.close()
    
    return screenshot.toString('base64')
    
  } catch (error) {
    if (browser) {
      await browser.close()
    }
    throw error
  }
}