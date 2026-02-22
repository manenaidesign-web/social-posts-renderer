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

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Social Posts Renderer is running!',
    version: '1.0.0'
  })
})

// Render endpoint
app.post('/render', async (req, res) => {
  try {
    const { templateId, data } = req.body
    
    if (!templateId) {
      return res.status(400).json({
        success: false,
        error: 'templateId is required'
      })
    }
    
    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'data is required'
      })
    }
    
    console.log(`Rendering template: ${templateId}`)
    
    const renderer = new TemplateRenderer(templateId)
    const { html, css } = renderer.render(data)
    
    const imageBase64 = await renderToPNG(html, css)
    
    const filename = `${templateId}_${Date.now()}.png`
    let imageUrl = null

    if (process.env.S3_BUCKET && process.env.AWS_ACCESS_KEY_ID) {
      try {
        imageUrl = await uploadToS3(imageBase64, filename)
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
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// List templates
app.get('/templates', (req, res) => {
  try {
    const files = fs.readdirSync('./configs')
    const templates = files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''))
    
    res.json({
      success: true,
      templates
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Test endpoint
app.get('/test', async (req, res) => {
  try {
    const renderer = new TemplateRenderer('t_bold_promo')
    const { html, css } = renderer.render({
      primaryColor: "#FF5733",
      secondaryColor: "#C70039",
      accentColor: "#FFC300",
      headline: "HUGE SALE!",
      subtext: "50% OFF EVERYTHING",
      fontPrimary: "Heebo",
      fontSecondary: "Assistant",
      logoUrl: "https://via.placeholder.com/150"
    })
    
    const imageBase64 = await renderToPNG(html, css)
    const filename = `test_${Date.now()}.png`
    
    let imageUrl = null
    if (process.env.S3_BUCKET && process.env.AWS_ACCESS_KEY_ID) {
      try {
        imageUrl = await uploadToS3(imageBase64, filename)
        console.log('✅ Uploaded to S3:', imageUrl)
      } catch (error) {
        console.log('⚠️  S3 upload failed:', error.message)
      }
    }
    
    fs.writeFileSync(`./output/${filename}`, imageBase64, 'base64')
    
    res.json({
      success: true,
      message: 'Test image created!',
      filename,
      imageUrl: imageUrl || `file://./output/${filename}`
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Extract Colors endpoint
app.post('/extract-colors', async (req, res) => {
  const { websiteUrl, logoUrl } = req.body;
  const browser = await chromium.launch();

  // המר RGB ל-HEX
  const rgbToHex = (rgb) => {
    const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return rgb;
    return '#' + [match[1], match[2], match[3]]
      .map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
  };

  try {
    // שלב 1: צבעים מה-CSS
    const page = await browser.newPage();
    await page.goto(websiteUrl, { waitUntil: 'networkidle', timeout: 30000 });

    const cssColors = await page.evaluate(() => {
      const colors = {};
      const selectors = ['header', 'nav', 'button', 'a', 'h1', 'h2', '.btn'];
      selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          const style = getComputedStyle(el);
          ['backgroundColor', 'color'].forEach(prop => {
            const c = style[prop];
            if (c && !c.includes('rgba(0') && c !== 'transparent') {
              colors[c] = (colors[c] || 0) + 1;
            }
          });
        });
      });
      return colors;
    });

    await page.close();

    // שלב 2: צבעים מהלוגו (משקל x3)
    const logoColors = {};
    if (logoUrl) {
      const logoPage = await browser.newPage();
      try {
        await logoPage.goto(logoUrl, { timeout: 15000 });
        const lc = await logoPage.evaluate(() => {
          const img = document.querySelector('img');
          if (!img) return {};
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 100;
          canvas.height = img.naturalHeight || 100;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const colors = {};
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          for (let i = 0; i < data.length; i += 16) {
            const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
            if (a < 128) continue;
            const hex = '#' + [r,g,b].map(x => x.toString(16).padStart(2,'0')).join('');
            colors[hex] = (colors[hex] || 0) + 1;
          }
          return colors;
        });
        Object.entries(lc).forEach(([c, w]) => {
          logoColors[c] = w * 3;
        });
      } catch (e) {
        console.log('Logo fetch failed:', e.message);
      }
      await logoPage.close();
    }

    // שלב 3: מזג, המר ל-HEX, הסר כפולים
    const all = { ...cssColors };
    Object.entries(logoColors).forEach(([c, w]) => {
      all[c] = (all[c] || 0) + w;
    });

    const top6 = Object.entries(all)
      .sort((a, b) => b[1] - a[1])
      .map(([color, weight]) => [rgbToHex(color), weight])
      .filter(([color], idx, arr) =>
        color.startsWith('#') &&
        arr.findIndex(([c]) => c === color) === idx
      )
      .slice(0, 6)
      .map(([color]) => color);

    await browser.close();
    res.json({ success: true, colors: top6 });

  } catch (error) {
    await browser.close();
    res.json({ success: false, error: error.message, colors: [] });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
  console.log(`📝 Ready to render templates!`)
})
