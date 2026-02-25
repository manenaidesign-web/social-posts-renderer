import crypto from 'crypto'

const pickBackgroundId = (template, variantHint) => {
  const backgrounds = template?.decisionSpace?.backgrounds || {}
  const ids = Object.keys(backgrounds)
  if (ids.length === 0) return null
  
  const hint = variantHint || 'default'
  const hash = crypto.createHash('sha1').update(String(hint)).digest('hex')
  const index = parseInt(hash.slice(0, 8), 16) % ids.length
  
  return ids[index]
}

const decideHeroMode = (signals = {}) => {
  const aspectRatio = typeof signals.aspectRatio === 'number' && signals.aspectRatio > 0
    ? signals.aspectRatio
    : 1
  const hasAlpha = !!signals.hasAlpha
  
  if (aspectRatio > 1.2) {
    return 'wide_object'
  }
  
  if (aspectRatio < 0.9) {
    return 'vertical_object'
  }
  
  if (hasAlpha) {
    return 'person_cutout'
  }
  
  return 'product_packshot'
}

const decideVariant = (headline, heroMode) => {
  if ((headline || '').length > 55) {
    return 'C'
  }
  
  if (heroMode === 'vertical_object') {
    return 'B'
  }
  
  return 'A'
}

const decideTextDir = languageRaw => {
  const language = (languageRaw || '').toLowerCase()
  
  if (language.startsWith('he') || language.startsWith('ar')) {
    return 'rtl'
  }
  
  if (language.startsWith('en')) {
    return 'ltr'
  }
  
  return 'auto'
}

const decideEmphasisWords = headline => {
  if (!headline) return []
  
  const words = headline
    .split(/\s+/)
    .map(w => w.replace(/^[^\w]+|[^\w]+$/g, ''))
    .filter(w => w.length >= 2 && w.length <= 12)
  
  const picked = []
  
  for (const w of words) {
    const lower = w.toLowerCase()
    if (!picked.some(p => p.toLowerCase() === lower)) {
      picked.push(w)
    }
    if (picked.length >= 2) break
  }
  
  return picked
}

export const decideRules = ({ template, request = {}, copy = {}, signals = {}, variantHint } = {}) => {
  const headline = copy.headline || ''
  const language = copy.language || request.language || 'en'
  
  const heroMode = decideHeroMode(signals)
  const variant = decideVariant(headline, heroMode)
  const heroSide = heroMode === 'vertical_object' ? 'right' : 'left'
  const backgroundId = pickBackgroundId(template, variantHint || request.variantHint || headline)
  
  let decorAnchor
  if (variant === 'A') {
    decorAnchor = 'top-right'
  } else if (variant === 'B') {
    decorAnchor = 'top-left'
  } else {
    decorAnchor = 'behind-hero'
  }
  
  const removeBg = (heroMode === 'person_cutout' || heroMode === 'product_packshot') && !signals.hasAlpha
  const textDir = decideTextDir(language)
  const emphasisWords = decideEmphasisWords(headline)
  
  return {
    variant,
    heroMode,
    heroSide,
    backgroundId,
    decorAnchor,
    removeBg,
    textDir,
    emphasisWords
  }
}

