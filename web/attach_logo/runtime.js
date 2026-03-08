(function () {
  var p = window.__PAYLOAD__ || {};
  var assets = p.assets || {};

  var bgImg      = document.getElementById('bgImg');
  var productImg = document.getElementById('productImg');
  var logoImg    = document.getElementById('logoImg');
  var logoWrap   = document.getElementById('logoWrap');

  // Apply dynamic logo positioning to the wrapper using fixed pixel values from edges
  var logoPos = assets.logoPosition;
  if (logoPos && logoWrap) {
    logoWrap.style.top    = logoPos.top    != null ? logoPos.top    + 'px' : 'auto';
    logoWrap.style.left   = logoPos.left   != null ? logoPos.left   + 'px' : 'auto';
    logoWrap.style.right  = logoPos.right  != null ? logoPos.right  + 'px' : 'auto';
    logoWrap.style.bottom = logoPos.bottom != null ? logoPos.bottom + 'px' : 'auto';
  }

  var pending   = 0;
  var completed = 0;

  function checkReady() {
    completed++;
    if (completed >= pending) {
      window.__RENDER_READY__ = true;
    }
  }

  function loadImg(el, src) {
    if (!el || !src) return;
    pending++;
    el.src = src;
    el.decode().then(checkReady).catch(checkReady);
  }

  loadImg(bgImg,      assets.backgroundDataUrl);
  loadImg(productImg, assets.productDataUrl);
  loadImg(logoImg,    assets.logoDataUrl);

  if (pending === 0) {
    window.__RENDER_READY__ = true;
  }
})();
