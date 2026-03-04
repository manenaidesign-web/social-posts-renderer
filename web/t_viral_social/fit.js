/* =========================================================
   MANEN — FIT v2 + ZONE ENFORCER
   ========================================================= */

(function () {
  // -------------------------------
  // Helpers
  // -------------------------------
  const $ = (sel) => document.querySelector(sel);

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  function isRTLText(str) {
    return /[\u0590-\u08FF]/.test(str || "");
  }

  function setVariant(v) {
    document.body.setAttribute("data-variant", v);
  }

  function getVariant() {
    return document.body.getAttribute("data-variant") || "A";
  }

  function rect(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, r };
  }

  function intersects(a, b, pad = 0) {
    if (!a || !b) return false;
    return !(
      a.x + a.w < b.x + pad ||
      b.x + b.w < a.x + pad ||
      a.y + a.h < b.y + pad ||
      b.y + b.h < a.y + pad
    );
  }

  function wait(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }

  async function waitForFonts() {
    try {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
        await wait(20);
      } else {
        await wait(60);
      }
    } catch (_) {
      await wait(60);
    }
  }

  async function waitForImages(imgEls) {
    const imgs = (imgEls || []).filter(Boolean);
    if (!imgs.length) return;

    await Promise.allSettled(
      imgs.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise((res) => {
          const done = () => res();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        });
      })
    );

    await wait(20);
  }

  // -------------------------------
  // Constraints
  // -------------------------------
  const DEFAULT_CONSTRAINTS = {
    headline: { maxLines: 2, minFontPx: 56, maxFontPx: 110 },
    subtext: { maxLines: 2, minFontPx: 22, maxFontPx: 38 },
    cta: { maxChars: 22, minFontPx: 20, maxFontPx: 30 }
  };

  function getConstraints() {
    const c = window.__MANEN_CONSTRAINTS || {};
    return {
      headline: { ...DEFAULT_CONSTRAINTS.headline, ...(c.headline || {}) },
      subtext: { ...DEFAULT_CONSTRAINTS.subtext, ...(c.subtext || {}) },
      cta: { ...DEFAULT_CONSTRAINTS.cta, ...(c.cta || {}) }
    };
  }

  // -------------------------------
  // Core Fit Routines
  // -------------------------------
  function setFontPx(el, px) {
    el.style.fontSize = `${px}px`;
  }

  function getLineHeightPx(el) {
    if (!el) return 18;
    const cs = getComputedStyle(el);
    const lh = cs.lineHeight;
    if (lh === "normal") {
      const fs = parseFloat(cs.fontSize) || 16;
      return fs * 1.15;
    }
    return parseFloat(lh) || 18;
  }

  function maxLinesToMaxHeight(el, maxLines) {
    const lh = getLineHeightPx(el);
    return lh * maxLines + 2;
  }

  function setMaxLinesClamp(el, maxLines) {
    el.style.display = "-webkit-box";
    el.style.webkitBoxOrient = "vertical";
    el.style.webkitLineClamp = String(maxLines);
    el.style.overflow = "hidden";
  }

  function fitsByHeight(el, maxHeight) {
    return el.scrollHeight <= maxHeight;
  }

  function fitTextBlock(el, constraint) {
    if (!el) return { ok: true, fontPx: null };

    const { maxLines, minFontPx, maxFontPx } = constraint;

    setMaxLinesClamp(el, maxLines);

    let font = maxFontPx;
    setFontPx(el, font);
    void el.offsetHeight;

    const maxHeight = maxLinesToMaxHeight(el, maxLines);

    while (font > minFontPx && !fitsByHeight(el, maxHeight)) {
      font -= 2;
      setFontPx(el, font);
      void el.offsetHeight;
    }

    const ok = fitsByHeight(el, maxHeight);
    return { ok, fontPx: font };
  }

  function shortenCtaText(text, maxChars) {
    const t = (text || "").trim();
    if (!t) return t;
    if (t.length <= maxChars) return t;

    const rtl = isRTLText(t);
    const english = /^[\x00-\x7F]*$/.test(t);

    const fallbacksEn = ["Shop Now", "Order Now", "Learn More", "Get Offer", "Get Deal"];
    const fallbacksHe = ["קנה עכשיו", "הזמן עכשיו", "לפרטים", "למידע נוסף", "קבל הצעה"];

    const pool = rtl ? fallbacksHe : (english ? fallbacksEn : fallbacksEn);
    const pick = pool.find(x => x.length <= maxChars);
    if (pick) return pick;

    if (maxChars <= 3) return t.slice(0, maxChars);
    return t.slice(0, maxChars - 1).trimEnd() + "…";
  }

  function fitCta(ctaEl, ctaConstraint) {
    if (!ctaEl) return { ok: true };

    const maxChars = ctaConstraint.maxChars ?? 22;
    const minFontPx = ctaConstraint.minFontPx ?? 20;
    const maxFontPx = ctaConstraint.maxFontPx ?? 30;

    let textNode = ctaEl.querySelector(".ctaText") || ctaEl.querySelector("span");
    if (!textNode) {
      const current = ctaEl.textContent || "";
      ctaEl.textContent = "";
      const sp = document.createElement("span");
      sp.className = "ctaText";
      sp.textContent = current.trim();
      ctaEl.appendChild(sp);
      textNode = sp;
    }

    const original = textNode.textContent || "";
    const shortened = shortenCtaText(original, maxChars);
    if (shortened !== original) textNode.textContent = shortened;

    let font = maxFontPx;
    ctaEl.style.fontSize = `${font}px`;

    const maxW = ctaEl.clientWidth - 64;
    const maxH = ctaEl.clientHeight;

    const measureOk = () =>
      textNode.scrollWidth <= maxW && textNode.scrollHeight <= maxH;

    void ctaEl.offsetHeight;

    while (font > minFontPx && !measureOk()) {
      font -= 1;
      ctaEl.style.fontSize = `${font}px`;
      void ctaEl.offsetHeight;
    }

    return { ok: measureOk(), fontPx: font, text: textNode.textContent };
  }

  // -------------------------------
  // Zone / Collision Enforcement
  // -------------------------------
  function enforceZones({ heroEl, headlineEl, badgeEl }) {
    const hRect = rect(headlineEl);
    const heroRect = rect(heroEl);
    const bRect = rect(badgeEl);

    if (intersects(hRect, heroRect, 6)) return false;
    if (intersects(hRect, bRect, 6)) return false;

    return true;
  }

  // -------------------------------
  // Variant Strategy
  // -------------------------------
  async function runFit() {
    const constraints = getConstraints();

    const headlineEl = $("#headline");
    const subtitleEl = $("#subtitle");
    const ctaEl = $(".cta");

    const heroEl = $(".hero") || $("#hero");
    const heroImg = $("#heroImg");
    const logoImg = $("#logoImg");

    const badgeEl = $(".badge");

    const originalVariant = getVariant();

    await waitForFonts();
    await waitForImages([heroImg, logoImg]);

    const candidates = ["A", "B", "C"];
    const startIndex = Math.max(0, candidates.indexOf(originalVariant));
    const ordered = [
      ...candidates.slice(startIndex),
      ...candidates.slice(0, startIndex)
    ];

    let lastGood = null;

    for (const v of ordered) {
      setVariant(v);
      await wait(20);

      const hFit = fitTextBlock(headlineEl, constraints.headline);
      const sFit = fitTextBlock(subtitleEl, constraints.subtext);
      const cFit = fitCta(ctaEl, constraints.cta);

      const zonesOk = enforceZones({ heroEl, headlineEl, badgeEl });

      if (hFit.ok && sFit.ok && cFit.ok && zonesOk) {
        lastGood = v;
        break;
      }
    }

    if (!lastGood) {
      setVariant(originalVariant);
    }

    await wait(10);
  }

  // -------------------------------
  // Public hook
  // -------------------------------
  window.__MANEN_RUN_FIT = runFit;

  // Legacy compat exports (in case runtime.js calls these)
  window.fitHeadlineWithFallback = function ({ headlineEl, tpl, fallbackVariant = 'C' }) {
    if (!headlineEl) return { fit: true };
    const c = tpl?.constraints?.headline || DEFAULT_CONSTRAINTS.headline;
    const body = document.body;
    const original = body.dataset.variant || 'A';
    const r = fitTextBlock(headlineEl, c);
    if (r.ok) return true;
    if (original === fallbackVariant) return false;
    body.dataset.variant = fallbackVariant;
    return fitTextBlock(headlineEl, c).ok;
  };
  window.fitSubtext = function ({ subtextEl, tpl }) {
    if (!subtextEl) return { skipped: true };
    const c = tpl?.constraints?.subtext || DEFAULT_CONSTRAINTS.subtext;
    return fitTextBlock(subtextEl, c).ok;
  };

  // Auto-run
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      runFit();
      setTimeout(runFit, 120);
    });
  } else {
    runFit();
    setTimeout(runFit, 120);
  }
})();
