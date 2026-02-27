// server.js

import express from 'express'
import { TemplateRenderer } from './engine/TemplateRenderer.js'
import { renderToPNG } from './output/renderer.js'
import { uploadToS3 } from './utils/upload.js'
import { chromium } from 'playwright'
import dotenv from 'dotenv'
import fs from 'fs'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Social Posts Renderer is running!', version: '1.1.0' })
})

app.post('/render', async (req, res) => {
  try {
    const { templateId, data } = req.body
    if (!templateId) return res.status(400).json({ success: false, error: 'templateId is required' })
    if (!data) return res.status(400).json({ success: false, error: 'data is required' })

    console.log(`Rendering template: ${templateId}`)

    let html, css

    const htmlPath = `./configs/${templateId}.html`
    const jsonPath = `./configs/${templateId}.json`

    if (fs.existsSync(htmlPath)) {
      // ✅ HTML template - החלף variables ישירות
      console.log(`Using HTML template: ${htmlPath}`)
      let htmlContent = fs.readFileSync(htmlPath, 'utf-8')

      Object.keys(data).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g')
        htmlContent = htmlContent.replace(regex, data[key] || '')
      })

      html = htmlContent
      css = ''
    } else if (fs.existsSync(jsonPath)) {
      // ✅ JSON template - כמו עכשיו
      console.log(`Using JSON template: ${jsonPath}`)
      const renderer = new TemplateRenderer(templateId)
      console.log('[server] calling renderer.render for templateId:', templateId)
      const result = await renderer.render(data)
      html = result.html
      css = result.css
    } else {
      return res.status(404).json({ success: false, error: `Template '${templateId}' not found` })
    }

    const imageBase64 = await renderToPNG(html, css)
    const filename = `${templateId}_${Date.now()}.png`

    let imageUrl = null
    if (process.env.S3_BUCKET && process.env.AWS_ACCESS_KEY_ID) {
      try {
        const imageBuffer = Buffer.from(imageBase64, 'base64')
        imageUrl = await uploadToS3(imageBuffer, filename)
        console.log('✅ Uploaded to S3:', imageUrl)
      } catch (error) {
        console.log('⚠️  S3 upload failed, saving locally:', error.message)
      }
    }

    fs.writeFileSync(`./output/${filename}`, imageBase64, 'base64')
    res.json({
      success: true,
      templateId,
      imageUrl: imageUrl || `file://./output/${filename}`,
      localPath: `./output/${filename}`,
      message: 'Rendered successfully'
    })

  } catch (error) {
    console.error('Render error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

app.get('/debug-html', (req, res) => {
  try {
    const html = fs.readFileSync('/tmp/debug_output.html', 'utf8')
    res.setHeader('Content-Type', 'text/html')
    res.send(html)
  } catch (e) {
    res.json({ error: e.message })
  }
})

app.get('/templates', (req, res) => {
  try {
    const files = fs.readdirSync('./configs')
    const templates = files
      .filter(f => f.endsWith('.json') || f.endsWith('.html'))
      .map(f => ({
        templateId: f.replace('.json', '').replace('.html', ''),
        type: f.endsWith('.html') ? 'html' : 'json'
      }))
    res.json({ success: true, templates })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

app.get('/test', async (req, res) => {
  try {
    const renderer = new TemplateRenderer('t_bold_promo')
    const { html, css } = await renderer.render({
      primaryColor: "#FF5733", secondaryColor: "#C70039", accentColor: "#FFC300",
      headline: "HUGE SALE!", subtext: "50% OFF EVERYTHING",
      fontPrimary: "Heebo", fontSecondary: "Assistant",
      logoUrl: "https://via.placeholder.com/150"
    })
    const imageBase64 = await renderToPNG(html, css)
    const filename = `test_${Date.now()}.png`
    let imageUrl = null
    if (process.env.S3_BUCKET && process.env.AWS_ACCESS_KEY_ID) {
      try {
        imageUrl = await uploadToS3(imageBase64, filename)
      } catch (error) {
        console.log('⚠️  S3 upload failed:', error.message)
      }
    }
    fs.writeFileSync(`./output/${filename}`, imageBase64, 'base64')
    res.json({ success: true, message: 'Test image created!', filename, imageUrl: imageUrl || `file://./output/${filename}` })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Capture header screenshot and upload to S3
app.post('/header-color', async (req, res) => {
  const { websiteUrl } = req.body;
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(websiteUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    const screenshot = await page.screenshot({
      clip: { x: 0, y: 0, width: 1920, height: 100 }
    });

    await browser.close();

    const filename = `header_${Date.now()}.png`;
    const imageUrl = await uploadToS3(screenshot.toString('base64'), filename);

    res.json({ success: true, headerImageUrl: imageUrl });

  } catch (error) {
    await browser.close();
    res.json({ success: false, error: error.message });
  }
});

// Extract header background color from CSS
app.post('/extract-colors', async (req, res) => {
  const { websiteUrl } = req.body;
  const browser = await chromium.launch();

  const rgbToHex = (rgb) => {
    const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return null;
    return '#' + [match[1], match[2], match[3]]
      .map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
  };

  try {
    const page = await browser.newPage();
    await page.goto(websiteUrl, { waitUntil: 'networkidle', timeout: 30000 });

    const headerColor = await page.evaluate(() => {
      const isUsable = (color) => {
        if (!color) return false;
        if (color === 'transparent') return false;
        if (color.includes('rgba(0, 0, 0, 0)')) return false;
        if (color.includes('rgba(0,0,0,0)')) return false;
        return true;
      };

      const selectors = [
        'header', '#header', '#masthead', '.header', '.site-header',
        '.main-header', '.page-header', '.top-header',
        '[class*="header"]', '[class*="site-header"]',
        '[class*="masthead"]', '[role="banner"]',
        'nav', '#nav', '.nav', '[class*="navbar"]',
        '[class*="nav-bar"]', '[class*="top-bar"]',
      ];

      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          const bg = getComputedStyle(el).backgroundColor;
          if (isUsable(bg)) return bg;
        }
      }

      const bodyBg = getComputedStyle(document.body).backgroundColor;
      if (isUsable(bodyBg)) return bodyBg;

      return null;
    });

    await browser.close();

    if (!headerColor) {
      return res.json({ success: false, error: 'Header color not found', headerColor: '#ffffff' });
    }

    const hex = rgbToHex(headerColor);
    res.json({ success: true, headerColor: hex || '#ffffff' });

  } catch (error) {
    await browser.close();
    res.json({ success: false, error: error.message, headerColor: '#ffffff' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
  console.log(`📝 Ready to render templates!`)
})
