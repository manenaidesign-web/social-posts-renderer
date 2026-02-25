(function () {
  const getLineCount = el => {
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    let lineHeight = parseFloat(style.lineHeight);
    if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
      const fontSize = parseFloat(style.fontSize) || 16;
      lineHeight = fontSize * 1.1;
    }
    if (lineHeight <= 0) return 0;
    return Math.max(1, Math.round(rect.height / lineHeight));
  };

  const setFontSize = (el, px) => {
    if (!el) return;
    el.style.fontSize = `${px}px`;
  };

  const fitTextBlock = ({ el, maxLines, maxFontPx, minFontPx }) => {
    if (!el || !maxLines || !maxFontPx || !minFontPx) return false;

    const style = window.getComputedStyle(el);
    let current = parseFloat(style.fontSize) || maxFontPx;
    current = Math.min(maxFontPx, current);
    setFontSize(el, current);

    let lines = getLineCount(el);
    if (lines <= maxLines && current <= maxFontPx && current >= minFontPx) {
      return true;
    }

    while (current > minFontPx && lines > maxLines) {
      current -= 2;
      setFontSize(el, current);
      lines = getLineCount(el);
    }

    return lines <= maxLines;
  };

  const fitHeadlineWithFallback = ({ headlineEl, tpl, fallbackVariant = 'C' }) => {
    if (!headlineEl || !tpl || !tpl.constraints || !tpl.constraints.headline) {
      return false;
    }

    const body = document.body;
    const originalVariant =
      body.dataset.variant || tpl.defaults?.variant || 'A';

    const constraints = tpl.constraints.headline;
    const successPrimary = fitTextBlock({
      el: headlineEl,
      maxLines: constraints.maxLines,
      maxFontPx: constraints.maxFontPx,
      minFontPx: constraints.minFontPx
    });

    if (successPrimary) {
      return true;
    }

    if (originalVariant === fallbackVariant) {
      return false;
    }

    body.dataset.variant = fallbackVariant;

    return fitTextBlock({
      el: headlineEl,
      maxLines: constraints.maxLines,
      maxFontPx: constraints.maxFontPx,
      minFontPx: constraints.minFontPx
    });
  };

  const fitSubtext = ({ subtextEl, tpl }) => {
    if (!subtextEl || !tpl || !tpl.constraints || !tpl.constraints.subtext) {
      return false;
    }

    const constraints = tpl.constraints.subtext;
    return fitTextBlock({
      el: subtextEl,
      maxLines: constraints.maxLines,
      maxFontPx: constraints.maxFontPx,
      minFontPx: constraints.minFontPx
    });
  };

  window._lineCount = getLineCount;
  window._setFont = setFontSize;
  window.fitTextBlock = fitTextBlock;
  window.fitHeadlineWithFallback = fitHeadlineWithFallback;
  window.fitSubtext = fitSubtext;
})();

