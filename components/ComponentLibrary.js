// components/ComponentLibrary.js

export class ComponentLibrary {
  
  // BACKGROUNDS
  background = {
    gradient: (props, position, size, zIndex) => {
      const { color1, color2, angle = 135, opacity = 1 } = props
      
      return `
        <div style="
          position: absolute;
          top: ${this.toPixels(position.y)};
          left: ${this.toPixels(position.x)};
          width: ${this.toPixels(size.width)};
          height: ${this.toPixels(size.height)};
          background: linear-gradient(${angle}deg, ${color1}, ${color2});
          opacity: ${opacity};
          z-index: ${zIndex};
        "></div>
      `
    },
    
    solid: (props, position, size, zIndex) => {
      const { color, opacity = 1 } = props
      
      return `
        <div style="
          position: absolute;
          top: ${this.toPixels(position.y)};
          left: ${this.toPixels(position.x)};
          width: ${this.toPixels(size.width)};
          height: ${this.toPixels(size.height)};
          background: ${color};
          opacity: ${opacity};
          z-index: ${zIndex};
        "></div>
      `
    }
  }
  
  // TEXT
  text = {
    headline: (props, position, size, zIndex) => {
      const { 
        text, 
        font = 'Arial', 
        fontSize = 48, 
        color = '#000', 
        align = 'left',
        textShadow = 'none',
        fontWeight = 'bold'
      } = props
      
      return `
        <div style="
          position: absolute;
          top: ${this.toPixels(position.y)};
          left: ${this.toPixels(position.x)};
          ${position.transform ? `transform: ${position.transform};` : ''}
          width: ${this.toPixels(size.width)};
          font-family: '${font}', sans-serif;
          font-size: ${fontSize}px;
          font-weight: ${fontWeight};
          color: ${color};
          text-align: ${align};
          text-shadow: ${textShadow};
          z-index: ${zIndex};
          line-height: 1.2;
        ">
          ${text}
        </div>
      `
    },
    
    subtext: (props, position, size, zIndex) => {
      const { 
        text, 
        font = 'Arial', 
        fontSize = 24, 
        color = '#000', 
        align = 'left'
      } = props
      
      return `
        <div style="
          position: absolute;
          top: ${this.toPixels(position.y)};
          left: ${this.toPixels(position.x)};
          ${position.transform ? `transform: ${position.transform};` : ''}
          width: ${this.toPixels(size.width)};
          font-family: '${font}', sans-serif;
          font-size: ${fontSize}px;
          color: ${color};
          text-align: ${align};
          z-index: ${zIndex};
          line-height: 1.4;
        ">
          ${text}
        </div>
      `
    }
  }
  
  // IMAGES
  image = {
    heroImage: (props, position, size, zIndex) => {
      const { 
        src, 
        borderRadius = 0, 
        objectFit = 'cover' 
      } = props
      
      return `
        <img 
          src="${src}"
          style="
            position: absolute;
            top: ${this.toPixels(position.y)};
            left: ${this.toPixels(position.x)};
            ${position.transform ? `transform: ${position.transform};` : ''}
            width: ${this.toPixels(size.width)};
            height: ${this.toPixels(size.height)};
            object-fit: ${objectFit};
            border-radius: ${borderRadius}px;
            z-index: ${zIndex};
          "
        />
      `
    },
    
    logo: (props, position, size, zIndex) => {
      const { src } = props
      
      return `
        <img 
          src="${src}"
          style="
            position: absolute;
            top: ${this.toPixels(position.y)};
            left: ${this.toPixels(position.x)};
            width: ${this.toPixels(size.width)};
            height: ${this.toPixels(size.height)};
            object-fit: contain;
            z-index: ${zIndex};
          "
        />
      `
    }
  }
  
  // DECORATIONS
  decoration = {
    circle: (props, position, size, zIndex) => {
      const { color, opacity = 1 } = props
      
      return `
        <div style="
          position: absolute;
          top: ${this.toPixels(position.y)};
          left: ${this.toPixels(position.x)};
          width: ${this.toPixels(size.width)};
          height: ${this.toPixels(size.height)};
          background: ${color};
          opacity: ${opacity};
          border-radius: 50%;
          z-index: ${zIndex};
        "></div>
      `
    }
  }
  
  // Helper
  toPixels(value) {
    if (typeof value === 'string') {
      return value
    }
    return `${value}px`
  }
}