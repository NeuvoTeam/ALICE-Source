// ALICE card 8i - measurement (advance test, rank 8b method reused).
// narrow = 10 x 'i', wide = 10 x 'W' at 16px. A monospaced face gives narrow === wide.
// Measured two ways (canvas measureText + a real DOM span) so a canvas size-adjust gap
// cannot silently invalidate the result.
(function () {
  var GEIST_STACK = '"Geist Mono", "Geist Mono Fallback", ui-monospace, SFMono-Regular, Menlo, monospace';
  var TAIL_STACK = 'ui-monospace, SFMono-Regular, Menlo, monospace';
  var NARROW = "iiiiiiiiii";
  var WIDE = "WWWWWWWWWW";

  function round(n) {
    return Math.round(n * 100) / 100;
  }

  function canvasAdvance(stack) {
    var c = document.createElement("canvas");
    var ctx = c.getContext("2d");
    ctx.font = "16px " + stack;
    var n = ctx.measureText(NARROW).width;
    var w = ctx.measureText(WIDE).width;
    return { narrow: round(n), wide: round(w), monospaced: Math.abs(n - w) < 0.01 };
  }

  var host = document.createElement("div");
  host.setAttribute(
    "style",
    "position:absolute;left:-9999px;top:0;white-space:pre;visibility:hidden"
  );
  document.body.appendChild(host);

  function domAdvance(stack) {
    var s = document.createElement("span");
    s.style.cssText =
      'font-family:' + stack + ";font-size:16px;white-space:pre;position:absolute;left:-9999px;";
    host.appendChild(s);
    s.textContent = NARROW;
    var n = s.getBoundingClientRect().width;
    s.textContent = WIDE;
    var w = s.getBoundingClientRect().width;
    host.removeChild(s);
    return { narrow: round(n), wide: round(w), monospaced: Math.abs(n - w) < 0.01 };
  }

  var faces = [];
  document.fonts.forEach(function (f) {
    faces.push(f.family + " | " + f.status + " | " + (f.weight || "normal"));
  });

  var els = Array.prototype.slice.call(
    document.querySelectorAll('[class*="font-mono"]')
  );

  var rows = els.map(function (el, i) {
    var cs = getComputedStyle(el);
    return {
      i: i,
      tag: el.tagName,
      cls: el.className,
      text: (el.textContent || "").trim().slice(0, 60),
      computedFontFamily: cs.fontFamily,
      declared: cs.fontFamily || GEIST_STACK,
      canvas: canvasAdvance(cs.fontFamily),
      dom: domAdvance(cs.fontFamily),
      tail: canvasAdvance(TAIL_STACK)
    };
  });

  var references = {
    geistMonoCanvas: canvasAdvance(GEIST_STACK),
    geistMonoDom: domAdvance(GEIST_STACK),
    tailCanvas: canvasAdvance(TAIL_STACK),
    tailDom: domAdvance(TAIL_STACK)
  };

  document.body.removeChild(host);

  var monoCanvas = rows.filter(function (r) { return r.canvas.monospaced; }).length;
  var monoDom = rows.filter(function (r) { return r.dom.monospaced; }).length;

  return JSON.stringify(
    {
      url: location.href,
      probeCalls: (window.__probeCalls || []).slice(),
      bodyClass: document.body.className,
      varFontMonoRoot: getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim(),
      varFontGeistMonoBody: getComputedStyle(document.body).getPropertyValue("--font-geist-mono").trim(),
      bodyComputedFontFamily: getComputedStyle(document.body).fontFamily,
      geistMonoCheck: document.fonts.check('16px "Geist Mono"'),
      geistMonoFallbackCheck: document.fonts.check('16px "Geist Mono Fallback"'),
      faces: faces,
      references: references,
      elements: rows,
      elementCount: rows.length,
      monospacedCanvas: monoCanvas,
      monospacedDom: monoDom,
      proportionalCanvas: rows.length - monoCanvas,
      proportionalDom: rows.length - monoDom
    },
    null,
    1
  );
})();
