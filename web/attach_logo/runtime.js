(function () {
  var p = window.__PAYLOAD__ || {};
  var assets = p.assets || {};

  var bgImg         = document.getElementById('bgImg');
  var productImg    = document.getElementById('productImg');
  var logoContainer = document.getElementById('logoContainer');
  var logoImg       = document.getElementById('logoImg');

  // Apply dynamic logo positioning to the glassmorphism container
  var logoPos = assets.logoPosition;
  if (logoPos && logoContainer) {
    var CANVAS = 1080;
    var left = (logoPos.x / 100) * CANVAS;
    var top  = (logoPos.y / 100) * CANVAS;
    var anchorTransforms = {
      'top-left':     'translate(0, 0)',
      'top-right':    'translate(-100%, 0)',
      'bottom-left':  'translate(0, -100%)',
      'bottom-right': 'translate(-100%, -100%)',
      'center':       'translate(-50%, -50%)'
    };
    var transform = anchorTransforms[logoPos.anchor] || 'translate(-100%, 0)';
    logoContainer.style.top       = top + 'px';
    logoContainer.style.left      = left + 'px';
    logoContainer.style.right     = 'auto';
    logoContainer.style.transform = transform;
    if (logoPos.size) {
      logoImg.style.width  = Math.round(logoPos.size / 100 * 1080) + 'px';
      logoImg.style.height = 'auto';
    }
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
