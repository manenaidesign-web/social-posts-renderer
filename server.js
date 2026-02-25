// server.js

import express from 'express'
import { TemplateRenderer } from './engine/TemplateRenderer.js'
import { renderToPNG } from './output/renderer.js'
import { uploadToS3 } from './utils/upload.js'
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
    const { templateId, data, decisions, requestMeta, heroImageUrl } = req.body
    
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
    
    // 1. Load template and render HTML
    const renderer = new TemplateRenderer(templateId)
    const renderResult = await renderer.render(data, {
      decisions,
      requestMeta,
      heroImageUrl
    })
    
    const { html, css, canvas, meta } = renderResult
    
    // 2. Convert to PNG
    const width = canvas?.width || 1080
    const height = canvas?.height || 1080
    const imageBase64 = await renderToPNG({ html, css, width, height })
    const imageBuffer = Buffer.from(imageBase64, 'base64')
    
    // 3. Upload to S3
    const filename = `${templateId}_${Date.now()}.png`
    let imageUrl = null

    if (process.env.S3_BUCKET && process.env.AWS_ACCESS_KEY_ID) {
      try {
        imageUrl = await uploadToS3(imageBuffer, filename)
        console.log('✅ Uploaded to S3:', imageUrl)
      } catch (error) {
        console.log('⚠️  S3 upload failed, saving locally:', error.message)
      }
    }

    // 4. Also save locally for backup
    fs.writeFileSync(`./output/${filename}`, imageBuffer)

    // 5. Return result
    res.json({
      success: true,
      templateId,
      imageUrl: imageUrl || `file://./output/${filename}`,
      localPath: `./output/${filename}`,
      meta: meta || null,
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

// Test endpoint for browser
app.get('/test', async (req, res) => {
  try {
    const renderer = new TemplateRenderer('t_bold_promo')
    const { html, css, canvas } = await renderer.render({
      primaryColor: "#FF5733",
      secondaryColor: "#C70039",
      accentColor: "#FFC300",
      headline: "HUGE SALE!",
      subtext: "50% OFF EVERYTHING",
      fontPrimary: "Heebo",
      fontSecondary: "Assistant",
      logoUrl: "https://via.placeholder.com/150"
    })
    
    const width = canvas?.width || 1080
    const height = canvas?.height || 1080
    const imageBase64 = await renderToPNG({ html, css, width, height })
    const imageBuffer = Buffer.from(imageBase64, 'base64')
    const filename = `test_${Date.now()}.png`
    
    // Upload to S3
    let imageUrl = null
    if (process.env.S3_BUCKET && process.env.AWS_ACCESS_KEY_ID) {
      try {
        imageUrl = await uploadToS3(imageBuffer, filename)
        console.log('✅ Uploaded to S3:', imageUrl)
      } catch (error) {
        console.log('⚠️  S3 upload failed:', error.message)
      }
    }
    
    // Also save locally
    fs.writeFileSync(`./output/${filename}`, imageBuffer)
    
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

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
  console.log(`📝 Ready to render templates!`)
})