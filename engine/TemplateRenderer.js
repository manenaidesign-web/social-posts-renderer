// engine/TemplateRenderer.js

import { ComponentLibrary } from '../components/ComponentLibrary.js'
import { decideRules } from './DecisionEngine.js'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function urlToDataUrl(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const contentType = res.headers.get('content-type') || 'image/png'
  return `data:${contentType};base64,${buf.toString('base64')}`
}

export class TemplateRenderer {
  constructor(templateId) {
    const configPath = `./configs/${templateId}.json`
    
    if (!fs.existsSync(configPath)) {
      throw new Error(`Template ${templateId} not found`)
    }
    
    this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    this.templateId = this.config.id || templateId
    this.components = new ComponentLibrary()
  }
  
  async render(data, context = {}) {
    if (this.config.schemaVersion === '2.0') {
      return this.renderV2(data, context)
    }
    
    const resolvedConfig = this.resolvePlaceholdersLegacy(this.config, data)
    const html = this.buildHTMLLegacy(resolvedConfig)
    const css = this.buildCSSLegacy(resolvedConfig)
    
    return {
      html,
      css,
      canvas: this.config.canvas,
      meta: {
        schemaVersion: this.config.schemaVersion || '1.x',
        templateId: this.templateId
      }
    }
  }
  
  async renderV2(data = {}, context = {}) {
    console.log('[V2] renderV2 called')
    try {
    const tpl = this.config
    const {
      decisions: providedDecisions,
      requestMeta = {},
      heroImageUrl
    } = context
    
    const defaultTokens = {
      primary: data.primaryColor || '#FF4B4B',
      secondary: data.secondaryColor || '#111827',
      accent: data.accentColor || '#F97316',
      textOnPrimary: '#FFFFFF',
      textOnAccent: '#111827',
      fontPrimary: data.fontPrimary || 'Heebo',
      fontSecondary: data.fontSecondary || 'Assistant'
    }
    const tokens = { ...defaultTokens, ...(data.tokens || {}) }
    
    const content = {
      headline: data.headline || data.content?.headline || '',
      subtext: data.subtext || data.content?.subtext || '',
      cta: data.cta || data.ctaText || data.content?.cta || '',
      fineprint: data.fineprint || data.content?.fineprint || '',
      badge: data.badge || data.content?.badge || '',
      logoText: data.logoText || data.content?.logoText || '',
      brandName: data.brandName || data.content?.brandName || '',
      language: data.language || data.content?.language || requestMeta.language || 'en'
    }
    
    const signals = data.signals || {
      aspectRatio: data.aspectRatio || 1,
      hasAlpha: data.hasAlpha !== undefined ? data.hasAlpha : true
    }

    const heroImageUrlResolved = heroImageUrl || data.heroImageUrl || data.assets?.heroImageUrl || null
    let heroDataUrl = null
    if (heroImageUrlResolved) {
      try {
        heroDataUrl = await urlToDataUrl(heroImageUrlResolved)
      } catch (err) {
        console.warn('[V2] hero fetch failed:', err?.message || err)
      }
    }

    const logoUrl = data.logoImageUrl || data.logoUrl || data.assets?.logoImageUrl || data.assets?.logoUrl || null
    let logoDataUrl = null
    if (logoUrl) {
      try {
        logoDataUrl = await urlToDataUrl(logoUrl)
      } catch (err) {
        console.warn('[V2] logo fetch failed, will use logoUrl fallback:', err?.message || err)
      }
    }

    const backgroundImageUrl = data.backgroundImage || data.assets?.backgroundImage || null
    let backgroundDataUrl = null
    if (backgroundImageUrl) {
      try {
        backgroundDataUrl = await urlToDataUrl(backgroundImageUrl)
      } catch (err) {
        console.warn('[V2] background fetch failed:', err?.message || err)
      }
    }

    const productImageUrl = data.productImage || data.assets?.productImage || null
    let productDataUrl = null
    if (productImageUrl) {
      try {
        productDataUrl = await urlToDataUrl(productImageUrl)
      } catch (err) {
        console.warn('[V2] product fetch failed:', err?.message || err)
      }
    }

    const LOGO_ZONES = {
      'bottom-right':  { right: 40, bottom: 40 },
      'bottom-left':   { left: 40,  bottom: 40 },
      'bottom-center': { left: '540px', bottom: 40, transform: 'translateX(-50%)' },
      'top-right':     { right: 40, bottom: 40 },
      'top-left':      { left: 40,  bottom: 40 }
    }
    // Resolve zone from logoZone, or from anchor inside logoPosition, defaulting to bottom-right
    const rawZone = 'bottom-center'
    const logoPosition = LOGO_ZONES[rawZone] || LOGO_ZONES['bottom-right']

    const assets = {
      heroDataUrl: heroDataUrl || null,
      heroImageUrl: heroImageUrlResolved,
      logoDataUrl: logoDataUrl || null,
      logoUrl: logoUrl || null,
      decorDataUrl: data.decorDataUrl || data.assets?.decorDataUrl || null,
      backgroundDataUrl: backgroundDataUrl || null,
      productDataUrl: productDataUrl || null,
      logoPosition: logoPosition
    }
    
    let decisions = providedDecisions
    if (!decisions) {
      decisions = decideRules({
        template: tpl,
        request: requestMeta,
        copy: content,
        signals,
        variantHint: data.variantHint || requestMeta.variantHint || content.headline
      })
    }
    
    const payload = {
      template: tpl,
      tokens,
      content,
      decisions,
      assets,
      requestMeta
    }
    
    const web = tpl.web || {}
    const templateHtmlPath = join(__dirname, '..', (web.templateHtml || '').replace('./', ''))
    const styleCssPath = join(__dirname, '..', (web.styleCss || '').replace('./', ''))
    const fitJsPath = web.fitJs ? join(__dirname, '..', web.fitJs.replace('./', '')) : null
    const runtimeJsPath = join(__dirname, '..', (web.runtimeJs || '').replace('./', ''))

    console.log('[TemplateRenderer.renderV2] file paths', {
      templateId: this.templateId,
      templateHtmlPath,
      styleCssPath,
      fitJsPath,
      runtimeJsPath
    })

    console.log('[V2] paths:', { templateHtmlPath, styleCssPath, fitJsPath, runtimeJsPath })
    
    const templateHtml = fs.readFileSync(templateHtmlPath, 'utf8')
    const googleFontsImport = "@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;700;900&family=Assistant:wght@400;700&display=swap');\n"
    let styleCss = fs.readFileSync(styleCssPath, 'utf8')
    styleCss = googleFontsImport + styleCss
    const fitJs = fitJsPath ? fs.readFileSync(fitJsPath, 'utf8') : ''
    const runtimeJs = fs.readFileSync(runtimeJsPath, 'utf8')

    console.log('[TemplateRenderer.renderV2] file lengths', {
      templateHtml: templateHtml.length,
      styleCss: styleCss.length,
      fitJs: fitJs.length,
      runtimeJs: runtimeJs.length
    })

    console.log('[TemplateRenderer.renderV2] payload summary', {
      templateId: tpl.id,
      tokens,
      content,
      decisions,
      assetsPresent: {
        heroDataUrl: !!assets.heroDataUrl,
        heroImageUrl: !!assets.heroImageUrl,
        logoDataUrl: !!assets.logoDataUrl,
        logoUrl: !!assets.logoUrl,
        decorDataUrl: !!assets.decorDataUrl,
        backgroundDataUrl: !!assets.backgroundDataUrl,
        productDataUrl: !!assets.productDataUrl
      },
      requestMeta
    })

    console.log('[V2] css length:', styleCss.length)
    console.log('[V2] fitJs length:', fitJs.length)
    console.log('[V2] runtimeJs length:', runtimeJs.length)
    console.log('[V2] template html length before replace:', templateHtml.length)
    
    const payloadStr = JSON.stringify(payload).replace(/<\/script/gi, '<\\/script')
    const payloadRegex = /\/\*__PAYLOAD__\*\/[\s\r\n]*\{\s*\}/
    // Use function replacements: a function's return value is used literally,
    // whereas a plain string is scanned for $& / $' / $` / $n special patterns
    // which corrupt the injected JS/CSS (e.g. '\\$&' in runtime.js escapeRegExp).
    let fullHTML = templateHtml
      .replace(/\/\*__STYLE__\*\//, () => styleCss)
      .replace(/\/\*__FIT__\*\//, () => fitJs)
      .replace(/\/\*__RUNTIME__\*\//, () => runtimeJs)
      .replace(payloadRegex, () => `/*__PAYLOAD__*/ ${payloadStr}`)
    console.log('[V2] payload injected?', fullHTML.includes('"primary"'))
    if (!fullHTML.includes('"tokens"')) {
      console.error('[TemplateRenderer.renderV2] PAYLOAD INJECTION FAILED: "tokens" not in output. Placeholder in template must be exactly: /*__PAYLOAD__*/ {}')
    }

    console.log('[TemplateRenderer.renderV2] fullHTML length', fullHTML.length)
    console.log('[V2] final html length:', fullHTML.length)

    fs.writeFileSync('/tmp/debug_output.html', fullHTML, 'utf8')
    console.log('[V2] Wrote debug HTML to /tmp/debug_output.html')
    
    return {
      html: fullHTML,
      css: '',
      canvas: tpl.canvas,
      meta: {
        schemaVersion: tpl.schemaVersion || '2.0',
        templateId: this.templateId,
        decisions
      }
    }
    } catch (e) {
      console.error('[V2] renderV2 CRASHED:', e.message, e.stack)
      throw e
    }
  }
  
  resolvePlaceholdersLegacy(config, data) {
    const resolved = JSON.parse(JSON.stringify(config))
    
    resolved.layers.forEach(layer => {
      Object.keys(layer.props).forEach(key => {
        const value = layer.props[key]
        
        if (typeof value === 'string' && value.includes('{{')) {
          const matches = value.matchAll(/{{(.+?)}}/g)
          let newValue = value
          
          for (const match of matches) {
            const placeholder = match[1].trim()
            if (data[placeholder] !== undefined) {
              newValue = newValue.replace(match[0], data[placeholder])
            }
          }
          
          layer.props[key] = newValue
        }
      })
    })
    
    return resolved
  }
  
  buildHTMLLegacy(config) {
    let html = `
      <div class="canvas" style="
        width: ${config.canvas.width}px;
        height: ${config.canvas.height}px;
        position: relative;
        background: ${config.canvas.backgroundColor};
        overflow: hidden;
      ">
    `
    
    const sortedLayers = [...config.layers].sort((a, b) => a.zIndex - b.zIndex)
    
    sortedLayers.forEach(layer => {
      try {
        const componentType = this.components[layer.type]
        if (componentType && componentType[layer.component]) {
          const layerHTML = componentType[layer.component](
            layer.props,
            layer.position,
            layer.size,
            layer.zIndex
          )
          html += layerHTML
        }
      } catch (error) {
        console.error(`Error rendering layer ${layer.id}:`, error)
      }
    })
    
    html += '</div>'
    return html
  }
  
  buildCSSLegacy(config) {
    return `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        font-family: Arial, sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      
      @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;700&family=Assistant:wght@400;700&display=swap');
    `
  }
}