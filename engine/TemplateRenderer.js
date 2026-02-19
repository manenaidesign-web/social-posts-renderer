// engine/TemplateRenderer.js

import { ComponentLibrary } from '../components/ComponentLibrary.js'
import fs from 'fs'

export class TemplateRenderer {
  constructor(templateId) {
    const configPath = `./configs/${templateId}.json`
    
    if (!fs.existsSync(configPath)) {
      throw new Error(`Template ${templateId} not found`)
    }
    
    this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    this.components = new ComponentLibrary()
  }
  
  render(data) {
    const resolvedConfig = this.resolvePlaceholders(this.config, data)
    const html = this.buildHTML(resolvedConfig)
    const css = this.buildCSS(resolvedConfig)
    
    return { html, css }
  }
  
  resolvePlaceholders(config, data) {
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
  
  buildHTML(config) {
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
  
  buildCSS(config) {
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