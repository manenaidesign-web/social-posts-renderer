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

  // 13. Meta & ready flag
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

