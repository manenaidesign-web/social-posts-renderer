// output/renderer.js

import { chromium } from 'playwright'

let browserPromise = null

const getBrowser = async () => {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }).catch(error => {
      browserPromise = null
      throw error
    })
  }
  
  return browserPromise
}

export const renderToPNG = async (input, maybeCss) => {
  const options = typeof input === 'string'
    ? { html: input, css: maybeCss }
    : (input || {})
  
  const {
    html,
    css,
    width = 1080,
    height = 1080
  } = options
  
  let context
  
  try {
    const browser = await getBrowser()
    
    context = await browser.newContext({
      viewport: { width, height },
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
            * {
              animation: none !important;
              transition: none !important;
            }
          </style>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `
    
    await page.setContent(fullHTML, {
      waitUntil: 'load',
      timeout: 10000
    })
    
    try {
      await page.waitForFunction('window.__RENDER_READY__ === true', {
        timeout: 12000
      })
    } catch (error) {
      // Ignore timeout for legacy templates that don't set __RENDER_READY__
    }
    
    const screenshot = await page.screenshot({
      type: 'png'
    })
    
    await context.close()
    
    return screenshot.toString('base64')
    
  } catch (error) {
    if (context) {
      try {
        await context.close()
      } catch (_) {
        // ignore context close errors
      }
    }
    throw error
  }
}