;(async function () {
  try {
  const payload = window.__PAYLOAD__ || {};
  const p = payload;
  const template = p.template || {};
  const tokens = p.tokens || {};
  const content = p.content || {};
  const decisions = p.decisions || {};
  const assets = p.assets || {};
  const requestMeta = p.requestMeta || {};
  console.log('TOKENS:', JSON.stringify(p.tokens));
  console.log('DECISIONS:', JSON.stringify(p.decisions));

  const body = document.body;

  // 2. Set body data attributes from decisions
  if (decisions.variant) body.dataset.variant = decisions.variant;
  if (decisions.heroSide) body.dataset.heroSide = decisions.heroSide;
  if (decisions.heroMode) body.dataset.heroMode = decisions.heroMode;
  if (decisions.decorAnchor)
    body.dataset.decorAnchor = decisions.decorAnchor;

  // 3. Set CSS vars from tokens (ensure hex values are applied)
  const root = document.documentElement;
  const setVar = (name, value) => {
    const v = value !== undefined && value !== null ? String(value).trim() : null;
    if (v) root.style.setProperty(name, v);
  };

  setVar('--primary', tokens.primary || '#ff4b4b');
  setVar('--secondary', tokens.secondary || '#050816');
  setVar('--accent', tokens.accent || '#f97316');
  setVar('--textOnPrimary', tokens.textOnPrimary || '#ffffff');
  setVar('--textOnAccent', tokens.textOnAccent || '#111827');
  setVar('--fontPrimary', tokens.fontPrimary || 'Heebo');
  setVar('--fontSecondary', tokens.fontSecondary || 'Assistant');

  const primaryVal = (tokens.primary || '#ff4b4b').trim();
  const secondaryVal = (tokens.secondary || '#050816').trim();
  const accentVal = (tokens.accent || '#f97316').trim();
  const styleEl = document.createElement('style');
  styleEl.id = 'token-vars';
  styleEl.textContent = `:root,.canvas{--primary:${primaryVal};--secondary:${secondaryVal};--accent:${accentVal};}`;
  (document.head || document.documentElement).appendChild(styleEl);

  // 3b. CTA auto-contrast: pick dark/light text based on --accent luminance
  (function () {
    function hexToRgb(hex) {
      if (!hex) return null;
      let h = String(hex).trim();
      if (h.startsWith('rgb')) return null;
      if (h[0] === '#') h = h.slice(1);
      if (h.length === 3) h = h.split('').map(c => c + c).join('');
      if (h.length !== 6) return null;
      const n = parseInt(h, 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    function luminance({ r, g, b }) {
      return [r, g, b].reduce((sum, v, i) => {
        v /= 255;
        const lin = v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        return sum + lin * [0.2126, 0.7152, 0.0722][i];
      }, 0);
    }
    const accent = getComputedStyle(document.documentElement)
      .getPropertyValue('--accent').trim();
    const rgb = hexToRgb(accent);
    const textColor = rgb && luminance(rgb) > 0.53 ? '#111827' : '#ffffff';
    root.style.setProperty('--ctaTextColor', textColor);
    const ctaEl = document.querySelector('.cta');
    if (ctaEl) ctaEl.classList.toggle('cta--light', textColor !== '#ffffff');
  })();

  // 4. Background CSS from decisions.backgroundId
  const backgrounds = (template.decisionSpace && template.decisionSpace.backgrounds) || {};
  const defaultBgId =
    template.defaults && template.defaults.backgroundId
      ? template.defaults.backgroundId
      : Object.keys(backgrounds)[0];
  const bgId = decisions.backgroundId || defaultBgId;
  const bg = backgrounds[bgId] || backgrounds[defaultBgId];

  const fallbackBgCss = 'linear-gradient(135deg, var(--primary), #000)';
  if (bg && bg.css) {
    setVar('--bgCss', bg.css);
  } else {
    setVar('--bgCss', fallbackBgCss);
  }

  const bgEl = document.querySelector('.bg');
  if (bgEl) {
    if (bg && bg.css) {
      bgEl.style.background = bg.css;
    } else {
      bgEl.style.background = fallbackBgCss;
    }
  }

  // 5. Decor anchor CSS vars
  const decorAnchors = (template.anchors && template.anchors.decor) || {};
  const decorKey =
    decisions.decorAnchor ||
    (template.defaults && template.defaults.decorAnchor) ||
    null;
  const decor = (decorKey && decorAnchors[decorKey]) || null;
  if (decor && typeof decor.x === 'number' && typeof decor.y === 'number') {
    setVar('--decorX', `${decor.x}px`);
    setVar('--decorY', `${decor.y}px`);
  }

  // 6. Logo (image or text)
  const logoImg = document.getElementById('logoImg');
  const logoText = document.querySelector('.logoText');

  if (assets.logoDataUrl && logoImg) {
    logoImg.src = assets.logoDataUrl;
    logoImg.style.display = 'block';
    if (logoText) logoText.style.display = 'none';
  } else if (assets.logoUrl && logoImg) {
    logoImg.src = assets.logoUrl;
    logoImg.style.display = 'block';
    if (logoText) logoText.style.display = 'none';
  } else {
    if (logoImg) logoImg.style.display = 'none';
    if (logoText) {
      logoText.style.display = '';
      logoText.textContent = content.logoText || content.brandName || 'BRAND';
    }
  }

  // 7. Text content
  const setText = (selector, value) => {
    const el = document.querySelector(selector);
    if (el && value !== undefined && value !== null) {
      el.textContent = value;
    }
  };

  setText('#subtitle', content.subtext || '');
  const badgeEl = document.getElementById('badge');
  if (badgeEl) badgeEl.textContent = content.badge || 'SALE';
  setText('#cta', content.cta || '');
  setText('#fineprint', content.fineprint || '');

  // 8. Headline — percent number emphasis + optional word emphasis
  const escapeRegExp = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const emphasizePercent = text =>
    text.replace(/(\d{1,3}\s?%)/g, '<span class="num">$1</span>');
  const headlineEl = document.getElementById('headline');
  if (headlineEl) {
    let headlineHtml = content.headline || '';
    if (
      Array.isArray(decisions.emphasisWords) &&
      decisions.emphasisWords.length &&
      content.headline
    ) {
      const uniqueWords = decisions.emphasisWords.filter(Boolean);
      if (uniqueWords.length) {
        const pattern = new RegExp(
          '\\b(' +
            uniqueWords.map(w => escapeRegExp(String(w))).join('|') +
            ')\\b',
          'gi'
        );
        headlineHtml = String(content.headline).replace(
          pattern,
          '<span class="em">$1</span>'
        );
      }
    }
    headlineEl.innerHTML = emphasizePercent(headlineHtml);
  }

  // 9. Hero image (use data URL so Playwright can render without network)
  const heroImg = document.getElementById('heroImg');
  const heroSrc = assets.heroDataUrl || null;
  if (heroImg && heroSrc) {
    heroImg.src = heroSrc;
    heroImg.style.display = 'block';

    if (decisions.heroMode === 'wide_object') {
      heroImg.style.objectFit = 'cover';
      heroImg.style.objectPosition = 'center';
    } else if (decisions.heroMode === 'vertical_object') {
      heroImg.style.objectFit = 'contain';
      heroImg.style.objectPosition = 'center bottom';
    } else if (
      decisions.heroMode === 'person_cutout' ||
      decisions.heroMode === 'product_packshot'
    ) {
      heroImg.style.objectFit = 'contain';
      heroImg.style.objectPosition = 'center';
      if (decisions.removeBg) {
        heroImg.style.backgroundColor = 'transparent';
      }
    } else {
      heroImg.style.objectFit = 'cover';
    }
  } else if (heroImg) {
    heroImg.style.display = 'none';
  }

  // 10. Decor image
  const decorImg = document.getElementById('decorImg');
  if (decorImg && assets.decorDataUrl) {
    decorImg.src = assets.decorDataUrl;
    decorImg.style.display = 'block';
  } else if (decorImg) {
    decorImg.style.display = 'none';
  }

  // 11. Wait for fonts + key images
  const waits = []
  waits.push(
    document.fonts
      ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 3000))])
      : Promise.resolve()
  )

  if (heroImg && heroImg.src && heroImg.src !== window.location.href) {
    waits.push(heroImg.decode().catch(() => {}))
  }
  if (logoImg && logoImg.src && logoImg.src !== window.location.href) {
    waits.push(logoImg.decode().catch(() => {}))
  }
  if (decorImg && decorImg.src && decorImg.src !== window.location.href) {
    waits.push(decorImg.decode().catch(() => {}))
  }

  await Promise.all(waits);

  // 12. Fit text
  if (window.fitHeadlineWithFallback && window.fitSubtext) {
    const successHeadline = window.fitHeadlineWithFallback({
      headlineEl,
      tpl: template,
      fallbackVariant: 'C'
    });

    const subtextEl = document.getElementById('subtitle');
    const successSubtext = window.fitSubtext({
      subtextEl,
      tpl: template
    });

    // optionally could be added to meta later
    void successHeadline;
    void successSubtext;
  }

  // 13. Brand-tinted SVG assets (wave / stripes / sheen)
  ;(function () {
    function svgUri(svg) {
      return 'data:image/svg+xml;charset=utf-8,' +
        encodeURIComponent(svg).replace(/%0A/g, '').replace(/%20/g, ' ');
    }
    function cv(name, fb) {
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb;
    }
    const ac = cv('--accent', '#ff0000');
    const sc = cv('--secondary', '#333333');
    const nt = cv('--neutral', '#ffffff');

    const waveSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200"><defs><linearGradient id="g" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${sc}" stop-opacity="0"/><stop offset="0.55" stop-color="${ac}" stop-opacity="0.22"/><stop offset="1" stop-color="${ac}" stop-opacity="0"/></linearGradient><filter id="blur"><feGaussianBlur stdDeviation="0.6"/></filter></defs><g filter="url(#blur)" transform="rotate(-12 600 600)"><path d="M-80 880 C 220 720,420 1010,720 850 C 980 710,1060 760,1280 640" fill="none" stroke="url(#g)" stroke-width="120" stroke-linecap="round"/><path d="M-120 980 C 180 820,440 1140,760 960 C 1000 840,1120 900,1340 780" fill="none" stroke="${ac}" stroke-opacity="0.10" stroke-width="64" stroke-linecap="round"/><path d="M-40 760 C 240 600,520 900,840 740 C 1060 630,1140 690,1320 560" fill="none" stroke="${sc}" stroke-opacity="0.10" stroke-width="46" stroke-linecap="round"/></g></svg>`;

    const stripesSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="1100" viewBox="0 0 1100 1100"><defs><pattern id="p" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><rect width="28" height="28" fill="transparent"/><rect x="0" y="0" width="8" height="28" fill="${ac}" fill-opacity="0.10"/></pattern><mask id="fade"><linearGradient id="m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="white" stop-opacity="1"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient><rect width="1100" height="1100" fill="url(#m)"/></mask></defs><rect width="1100" height="1100" fill="url(#p)" mask="url(#fade)"/></svg>`;

    const sheenSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1400" viewBox="0 0 1400 1400"><defs><linearGradient id="s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${nt}" stop-opacity="0"/><stop offset="0.42" stop-color="${nt}" stop-opacity="0.12"/><stop offset="0.55" stop-color="${nt}" stop-opacity="0.22"/><stop offset="0.70" stop-color="${nt}" stop-opacity="0.06"/><stop offset="1" stop-color="${nt}" stop-opacity="0"/></linearGradient></defs><g transform="rotate(-18 700 700)"><ellipse cx="980" cy="240" rx="760" ry="220" fill="url(#s)"/></g></svg>`;

    const waveEl   = document.querySelector('.asset.wave');
    const stripesEl = document.querySelector('.asset.stripes');
    const sheenEl  = document.querySelector('.asset.sheen');
    if (waveEl)   waveEl.style.backgroundImage   = `url("${svgUri(waveSvg)}")`;
    if (stripesEl) stripesEl.style.backgroundImage = `url("${svgUri(stripesSvg)}")`;
    if (sheenEl)  sheenEl.style.backgroundImage  = `url("${svgUri(sheenSvg)}")`;
  })();

  // 14. Nike Energy — derived colors, upgraded CTA, manen-* layers
  ;(function () {
    function cv(n, fb) {
      return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb;
    }
    function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
    function hexToRgb(hex) {
      if (!hex) return null;
      let h = String(hex).trim();
      if (h.startsWith('rgb')) return null;
      if (h[0] === '#') h = h.slice(1);
      if (h.length === 3) h = h.split('').map(c => c + c).join('');
      if (h.length !== 6) return null;
      const n = parseInt(h, 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    function rgbToHex(r, g, b) {
      return '#' + [r, g, b].map(v => clamp(v, 0, 255).toString(16).padStart(2, '0')).join('');
    }
    function mixHex(a, b, t) {
      const ca = hexToRgb(a), cb = hexToRgb(b);
      if (!ca || !cb) return a;
      return rgbToHex(
        Math.round(ca.r + (cb.r - ca.r) * t),
        Math.round(ca.g + (cb.g - ca.g) * t),
        Math.round(ca.b + (cb.b - ca.b) * t)
      );
    }
    function luminance(rgb) {
      return [rgb.r, rgb.g, rgb.b].reduce((s, v, i) => {
        v /= 255;
        return s + (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)) * [0.2126, 0.7152, 0.0722][i];
      }, 0);
    }
    function svgUri(svg) {
      return 'data:image/svg+xml;charset=utf-8,' +
        encodeURIComponent(svg).replace(/%0A/g, '').replace(/%20/g, ' ');
    }
    function ensureLayer(cls) {
      const canvas = document.querySelector('.canvas');
      if (!canvas) return null;
      let el = canvas.querySelector('.' + cls);
      if (!el) {
        el = document.createElement('div');
        el.className = cls;
        const tw = canvas.querySelector('.textWrap');
        if (tw) canvas.insertBefore(el, tw); else canvas.appendChild(el);
      }
      return el;
    }

    const primary = cv('--primary', '#0b0b0b');
    const accent  = cv('--accent',  '#ff0000');
    const neutral = cv('--neutral', '#ffffff');

    const accentDeep = mixHex(accent, '#000000', 0.22);
    const accentGlow = mixHex(accent, '#ffffff', 0.20);

    const dde = document.documentElement;
    dde.style.setProperty('--accentDeep', accentDeep);
    dde.style.setProperty('--accentGlow', accentGlow);
    dde.style.setProperty('--accentGlowAlpha', mixHex(accentGlow, '#000000', 0.65));

    // CTA contrast (overrides step 3b with more precise values)
    const rgb = hexToRgb(accent);
    const ctaTextColor = rgb && luminance(rgb) > 0.53 ? '#111827' : '#ffffff';
    dde.style.setProperty('--ctaTextColor', ctaTextColor);
    const ctaEl = document.querySelector('.cta');
    if (ctaEl) ctaEl.classList.toggle('cta--light', ctaTextColor !== '#ffffff');

    // SVG: diagonal energy shape
    const energySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080"><defs><linearGradient id="d" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${accentDeep}" stop-opacity="0"/><stop offset="0.55" stop-color="${accentDeep}" stop-opacity="0.85"/><stop offset="1" stop-color="${primary}" stop-opacity="0"/></linearGradient></defs><path d="M-160 980 C 260 820,510 1120,920 920 C 1130 820,1240 820,1320 760 L 1320 1180 L -160 1180 Z" fill="url(#d)"/><path d="M-220 1080 C 240 910,520 1220,980 1000 C 1180 900,1280 900,1400 840 L 1400 1280 L -220 1280 Z" fill="${primary}" fill-opacity="0.22"/></svg>`;

    // SVG: motion streaks
    const streakRows = Array.from({ length: 14 }, (_, i) => {
      const y = 120 + i * 56, w = 520 + (i % 4) * 140, x = 60 + (i % 3) * 40;
      return `<rect x="${x}" y="${y}" width="${w}" height="8" rx="6" fill="${accentGlow}" fill-opacity="${(0.10 + (i % 5) * 0.02).toFixed(2)}"/>`;
    }).join('');
    const streaksSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080"><g transform="rotate(-18 540 540)">${streakRows}</g></svg>`;

    // SVG: premium sheen
    const sheenSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200"><defs><linearGradient id="s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${neutral}" stop-opacity="0"/><stop offset="0.42" stop-color="${neutral}" stop-opacity="0.10"/><stop offset="0.52" stop-color="${neutral}" stop-opacity="0.22"/><stop offset="0.70" stop-color="${neutral}" stop-opacity="0.06"/><stop offset="1" stop-color="${neutral}" stop-opacity="0"/></linearGradient></defs><g transform="rotate(-22 600 600)"><ellipse cx="920" cy="250" rx="760" ry="220" fill="url(#s)"/></g></svg>`;

    const energy  = ensureLayer('manen-energy');
    const streaks = ensureLayer('manen-streaks');
    const sheen   = ensureLayer('manen-sheen');
    if (energy)  { energy.style.backgroundImage  = `url("${svgUri(energySvg)}")`; energy.style.backgroundSize  = '1080px 1080px'; energy.style.backgroundRepeat = 'no-repeat'; energy.style.backgroundPosition = 'center'; }
    if (streaks) { streaks.style.backgroundImage = `url("${svgUri(streaksSvg)}")`; streaks.style.backgroundSize = '1080px 1080px'; streaks.style.backgroundRepeat = 'no-repeat'; streaks.style.backgroundPosition = 'center'; }
    if (sheen)   { sheen.style.backgroundImage   = `url("${svgUri(sheenSvg)}")`; sheen.style.backgroundSize   = '1200px 1200px'; sheen.style.backgroundRepeat  = 'no-repeat'; sheen.style.backgroundPosition = '65% 10%'; }
  })();

  // 15. Meta & ready flag
  window.__RENDER_META__ = {
    templateId: template.id,
    decisions,
    requestMeta
  };
  } catch (e) {
    console.error('runtime error:', e)
  } finally {
    window.__RENDER_READY__ = true;
  }
})();

