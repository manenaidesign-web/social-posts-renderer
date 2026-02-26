// output/renderer.js

import { chromium } from 'playwright'

let _browserPromise = null

const getBrowser = async () => {
  if (!_browserPromise) {
    _browserPromise = chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }).catch(error => {
      _browserPromise = null
      throw error
    })
  }
  return _browserPromise
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
  
  console.log('[renderer] html length received:', html ? html.length : 0)
  
  let context

  try {
    let browser
    try {
      browser = await getBrowser()
    } catch (err) {
      _browserPromise = null
      throw err
    }

    context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 2
    })
    
    const page = await context.newPage()
    page.on('pageerror', err => console.log('[renderer] PAGE ERROR:', err.message))
    page.on('console', msg => {
      if (msg.type() === 'error') console.log('[renderer] CONSOLE ERROR:', msg.text())
    })

    const isFullDocument = html.trimStart().toLowerCase().startsWith('<!doctype')
    const fullHTML = isFullDocument
      ? html
      : `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8">
<style>
${css || ''}
* { animation: none !important; transition: none !important; }
</style>
</head>
<body>${html}</body>
</html>`

    await page.setContent(fullHTML, {
      waitUntil: 'load',
      timeout: 10000
    })

    await page.addStyleTag({
      content: `
  :root {
    color-scheme: light !important;
  }
  .canvas {
    display: block !important;
    visibility: visible !important;
  }
`
    })

    console.log('[renderer] waiting for RENDER_READY...')
    
    try {
      await page.waitForFunction('window.__RENDER_READY__ === true', {
        timeout: 30000
      })
      await page.waitForTimeout(500)
    } catch (error) {
      console.warn('waitForFunction __RENDER_READY__ timed out or failed, continuing render:', error?.message || error)
      await page.waitForTimeout(5000)
    }

    const debugInfo = await page.evaluate(() => {
      const canvas = document.querySelector('.canvas')
      const bg = document.querySelector('.bg')
      const computed = window.getComputedStyle(canvas)
      const bgComputed = window.getComputedStyle(bg)
      return {
        canvasWidth: canvas ? canvas.offsetWidth : 'NOT FOUND',
        canvasHeight: canvas ? canvas.offsetHeight : 'NOT FOUND',
        canvasBg: computed.backgroundColor,
        bgBackground: bgComputed.background,
        primaryVar: getComputedStyle(document.documentElement).getPropertyValue('--primary'),
        bgCssVar: getComputedStyle(document.documentElement).getPropertyValue('--bgCss'),
        bodyBg: getComputedStyle(document.body).backgroundColor,
        renderReady: window.__RENDER_READY__,
        payloadExists: !!window.__PAYLOAD__
      }
    })
    console.log('[renderer] DEBUG:', JSON.stringify(debugInfo))

    console.log('[renderer] __RENDER_READY__ confirmed, taking screenshot...')
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 1080, height: 1080 }
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