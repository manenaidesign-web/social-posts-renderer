// server.js

import express from 'express'
import sharp from 'sharp'
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
      const requestMeta = req.body.requestMeta || {}
      const heroImageUrl = req.body.heroImageUrl ?? data.heroImageUrl ?? null
      console.log('[server] calling renderer.render for templateId:', templateId)
      const result = await renderer.render(data, { requestMeta, heroImageUrl })
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

app.post('/check-image', async (req, res) => {
  try {
    const { imageUrl } = req.body
    if (!imageUrl) return res.status(400).json({ error: 'imageUrl required' })

    const response = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const buffer = Buffer.from(await response.arrayBuffer())
    const metadata = await sharp(buffer).metadata()

    const hasAlpha = !!metadata.hasAlpha
    const aspectRatio = metadata.width / metadata.height

    res.json({
      hasAlpha,
      aspectRatio,
      width: metadata.width,
      height: metadata.height,
      format: metadata.format
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
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
    const imageBuffer = Buffer.from(imageBase64, 'base64')
    let imageUrl = null
    if (process.env.S3_BUCKET && process.env.AWS_ACCESS_KEY_ID) {
      try {
        imageUrl = await uploadToS3(imageBuffer, filename)
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

const LOGO_ZONES = {
  'top-right':     { x: 92, y: 6,  anchor: 'top-right'     },
  'top-left':      { x: 8,  y: 6,  anchor: 'top-left'      },
  'bottom-right':  { x: 92, y: 94, anchor: 'bottom-right'  },
  'bottom-left':   { x: 8,  y: 94, anchor: 'bottom-left'   },
  'top-center':    { x: 50, y: 6,  anchor: 'top-center'    },
  'bottom-center': { x: 50, y: 94, anchor: 'bottom-center' }
}

// ── Shared helper: fetch image → ask GPT-4o for logo zone ────────────────────
async function resolveLogoZone(imageUrl) {
  const imageRes = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) })
  if (!imageRes.ok) throw new Error(`Image fetch failed: HTTP ${imageRes.status}`)
  const buf = Buffer.from(await imageRes.arrayBuffer())
  const contentType = imageRes.headers.get('content-type') || 'image/jpeg'
  const base64Image = buf.toString('base64')

  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Look at this image and decide where a brand logo would look best visually.\nFollow these rules strictly:\n1. Must NOT overlap any text in the image\n2. Must be placed on a LIGHT, bright, or neutral background — avoid dark or busy areas\n3. Must avoid the main subject of the image\n4. Consider overall visual balance and harmony\n\nReturn ONLY one of these exact strings, nothing else:\ntop-right / top-left / bottom-right / bottom-left / top-center / bottom-center'
          },
          {
            type: 'image_url',
            image_url: { url: `data:${contentType};base64,${base64Image}` }
          }
        ]
      }],
      max_tokens: 20
    })
  })

  if (!openaiRes.ok) {
    const errText = await openaiRes.text()
    throw new Error(`OpenAI API error: ${openaiRes.status} ${errText}`)
  }

  const openaiData = await openaiRes.json()
  const raw = (openaiData.choices?.[0]?.message?.content || '').trim().toLowerCase()
  const zone = Object.keys(LOGO_ZONES).find(z => raw.includes(z)) || 'top-right'
  console.log(`[resolveLogoZone] GPT returned: "${raw}" → zone: "${zone}"`)
  return { zone, logoPosition: LOGO_ZONES[zone] }
}

app.post('/analyze-logo-position', async (req, res) => {
  try {
    const { imageUrl } = req.body
    if (!imageUrl) return res.status(400).json({ error: 'imageUrl required' })
    const { zone, logoPosition } = await resolveLogoZone(imageUrl)
    res.json({ success: true, zone, logoPosition })
  } catch (err) {
    console.error('/analyze-logo-position error:', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── /generate-variants helpers ────────────────────────────────────────────────

function buildUserPrompt(template, brandData, variant) {
  const vars = { ...brandData, headline: variant.headline, userIntent: variant.tone || '' }
  return (template || '').replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}

async function callGPTForVisual(systemPrompt, userPrompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt }
      ],
      max_tokens: 500,
      response_format: { type: 'json_object' }
    })
  })
  if (!res.ok) throw new Error(`GPT-4o-mini error: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return JSON.parse(data.choices?.[0]?.message?.content || '{}')
}

async function callIdeogram(visualPrompt, aspectRatio) {
  const fullPrompt = visualPrompt +
    ' The composition is minimalist and cinematic. The top-right area is completely empty and consists of a clean, smooth, out-of-focus background to allow for a professional overlay.'

  const res = await fetch('https://api.ideogram.ai/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': process.env.IDEOGRAM_API_KEY
    },
    body: JSON.stringify({
      image_request: {
        prompt: fullPrompt,
        aspect_ratio: aspectRatio,
        model: 'V_2',
        magic_prompt_option: 'OFF'
      }
    })
  })
  if (!res.ok) throw new Error(`Ideogram error: ${res.status} ${await res.text()}`)
  const data = await res.json()
  const imageUrl = data.data?.[0]?.url
  if (!imageUrl) throw new Error('No image URL in Ideogram response')
  return imageUrl
}

async function renderAttachLogoVariant({ backgroundImage, logoUrl, logoZone }) {
  const renderer = new TemplateRenderer('attach_logo')
  const result = await renderer.render({ backgroundImage, logoUrl, logoZone }, {})
  const imageBase64 = await renderToPNG(result.html, result.css)
  const filename = `attach_logo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`

  let imageUrl = null
  if (process.env.S3_BUCKET && process.env.AWS_ACCESS_KEY_ID) {
    try {
      imageUrl = await uploadToS3(Buffer.from(imageBase64, 'base64'), filename)
    } catch (err) {
      console.warn('[generate-variants] S3 upload failed:', err.message)
    }
  }

  fs.writeFileSync(`./output/${filename}`, imageBase64, 'base64')
  return imageUrl || `file://./output/${filename}`
}

app.post('/generate-variants', async (req, res) => {
  try {
    const { brandData, variants, systemPrompt, userPromptTemplate } = req.body

    if (!brandData || !Array.isArray(variants) || variants.length === 0) {
      return res.status(400).json({ success: false, error: 'brandData and variants[] required' })
    }

    const results = await Promise.all(variants.map(async (variant) => {
      console.log(`[generate-variants] starting variant ${variant.variantId}`)

      // Step 1: Build user prompt
      const userPrompt = buildUserPrompt(userPromptTemplate, brandData, variant)

      // Step 2: GPT-4o-mini → { visual_prompt, aspect_ratio }
      const { visual_prompt, aspect_ratio } = await callGPTForVisual(systemPrompt, userPrompt)

      // Step 3: Ideogram → background image URL
      const imageUrl = await callIdeogram(visual_prompt, aspect_ratio)

      // Step 4: Analyze logo position
      const { zone } = await resolveLogoZone(imageUrl)

      // Step 5: Render attach_logo template
      const finalImageUrl = await renderAttachLogoVariant({
        backgroundImage: imageUrl,
        logoUrl: brandData.logoUrl,
        logoZone: zone
      })

      console.log(`[generate-variants] variant ${variant.variantId} done → ${finalImageUrl}`)
      return {
        variantId: variant.variantId,
        headline: variant.headline,
        subtext: variant.subtext,
        ctaText: variant.ctaText,
        imageUrl: finalImageUrl
      }
    }))

    res.json({ success: true, variants: results })
  } catch (err) {
    console.error('/generate-variants error:', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
  console.log(`📝 Ready to render templates!`)
})
