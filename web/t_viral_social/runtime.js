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

  // 14. Perfect Base — derived colors, CTA/badge fallbacks
  ;(function applyPerfectBase() {
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
    function mix(hexA, hexB, t) {
      const a = hexToRgb(hexA), b = hexToRgb(hexB);
      if (!a || !b) return hexA;
      return rgbToHex(
        Math.round(a.r + (b.r - a.r) * t),
        Math.round(a.g + (b.g - a.g) * t),
        Math.round(a.b + (b.b - a.b) * t)
      );
    }
    function luminance(rgb) {
      const s = [rgb.r, rgb.g, rgb.b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
    }
    function cv(name, fb) {
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb;
    }

    function apply() {
      const accent  = cv('--accent',  '#ff0000');
      const primary = cv('--primary', '#0b0b0b');

      const accentDeep = mix(accent, '#000000', 0.24);
      const accentGlow = mix(accent, '#ffffff', 0.18);

      const dde = document.documentElement;
      dde.style.setProperty('--accentDeep', accentDeep);
      dde.style.setProperty('--accentGlow', accentGlow);
      dde.style.setProperty('--accentDeepA', mix(accentDeep, primary, 0.22));
      dde.style.setProperty('--accentGlowShadow', mix(accentGlow, '#000000', 0.55));
      dde.style.setProperty('--badgeBg', accent);

      // CTA contrast
      const rgb = hexToRgb(accent);
      const ctaTextColor = rgb && luminance(rgb) > 0.53 ? '#111827' : '#ffffff';
      dde.style.setProperty('--ctaTextColor', ctaTextColor);

      const ctaEl = document.querySelector('.cta');
      if (ctaEl) {
        ctaEl.classList.toggle('cta--light', ctaTextColor !== '#ffffff');
        if (!(ctaEl.textContent || '').trim()) ctaEl.textContent = 'SHOP NOW';
      }

      const badgeEl = document.querySelector('.badge');
      if (badgeEl && !(badgeEl.textContent || '').trim()) {
        badgeEl.textContent = 'SPECIAL';
      }
    }

    apply();
    setTimeout(apply, 120);
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

