/* Lybi — The team, modeled.
 *
 * Each founder is presented as a Lybi agent. A visitor asks questions; every
 * answer is quoted verbatim from the founder's approved bio on the company
 * page (lybi.ai/lybi#/company) — nothing is generated or paraphrased. Each
 * answer is also a signal on the visitor's own decision path, which the HUD
 * models the way the Conative Engine does: UNCOVERS drivers, ASSEMBLES value,
 * ESTABLISHES conditions. Scrolling only advances "Process" — the page acts
 * out the site's own line: advancing the process is not the same as
 * advancing the decision.
 */
(function () {
  'use strict';

  var BASE = '/lybi-site/team/';
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var STAGES = [
    { verb: 'UNCOVERS', noun: 'Drivers', found: 'Driver uncovered' },
    { verb: 'ASSEMBLES', noun: 'Value', found: 'Value assembled' },
    { verb: 'ESTABLISHES', noun: 'Conditions', found: 'Condition established' }
  ];

  // Answers and bios are the approved copy, word for word. Do not edit them
  // here — change the company page content first, then mirror it.
  var AGENTS = [
    {
      id: 'hila', num: '01', name: 'Hila Carmel', first: 'Hila', role: 'Co-founder',
      bio: 'Hila brings 25 years of experience connecting customer understanding, business strategy and technology. She founded a customer experience consultancy and an analytics platform, both acquired by EY, where she became a partner leading business transformation in Israel. She later founded Freeda, bringing AI-powered, continuous support to women navigating menopause. Across financial services and health, that work shaped the insight behind Lybi: technology needs to work with how people decide. Today, she is building that understanding into Conative AI.',
      focus: 'Connecting customer understanding, business strategy and technology.',
      crew: ['Customer understanding', 'Business strategy', 'Technology'],
      kb: ['customer-experience.md', 'ey-business-transformation.md', 'freeda.md', 'conative-ai.md'],
      asks: [
        { stage: 0, q: 'What drives you?', crew: 'Customer understanding', kb: 'freeda.md',
          signal: 'Technology needs to work with how people decide',
          a: ['She later founded Freeda, bringing AI-powered, continuous support to women navigating menopause. Across financial services and health, that work shaped the insight behind Lybi: technology needs to work with how people decide.'] },
        { stage: 1, q: 'What do you bring?', crew: 'Business strategy', kb: 'ey-business-transformation.md',
          signal: '25 years connecting customer understanding, strategy and technology',
          a: ['Hila brings 25 years of experience connecting customer understanding, business strategy and technology. She founded a customer experience consultancy and an analytics platform, both acquired by EY, where she became a partner leading business transformation in Israel.'] },
        { stage: 2, q: 'Why Lybi?', crew: 'Technology', kb: 'conative-ai.md',
          signal: 'Building that understanding into Conative AI',
          a: ['Today, she is building that understanding into Conative AI.', 'Customer experience and business transformation bring an understanding of how organizations create value.'] }
      ]
    },
    {
      id: 'noa', num: '02', name: 'Noa Assouline', first: 'Noa', role: 'Co-founder',
      bio: 'Noa brings financial-services strategy and enterprise transformation experience to Lybi. At EY and Accenture, she worked across growth strategy, customer journeys, digital products and operating models, translating business ambitions into practical change. At Lybi, she brings that expertise into the product itself: turning domain knowledge and professional judgment into ready Decision Journeys, with the organizational goals, policies and operating requirements needed to put them to work.',
      focus: 'Translating business ambitions into practical change.',
      crew: ['Growth strategy', 'Customer journeys', 'Digital products', 'Operating models'],
      kb: ['financial-services-strategy.md', 'ey-accenture.md', 'decision-journeys.md'],
      asks: [
        { stage: 0, q: 'What drives you?', crew: 'Growth strategy', kb: 'ey-accenture.md',
          signal: 'Translating business ambitions into practical change',
          a: ['At EY and Accenture, she worked across growth strategy, customer journeys, digital products and operating models, translating business ambitions into practical change.'] },
        { stage: 1, q: 'What do you bring?', crew: 'Customer journeys', kb: 'financial-services-strategy.md',
          signal: 'Financial-services strategy and enterprise transformation',
          a: ['Noa brings financial-services strategy and enterprise transformation experience to Lybi.', 'Financial-services and health experience bring the professional context of the decisions people face.'] },
        { stage: 2, q: 'Why Lybi?', crew: 'Operating models', kb: 'decision-journeys.md',
          signal: 'Domain knowledge turned into ready Decision Journeys',
          a: ['At Lybi, she brings that expertise into the product itself: turning domain knowledge and professional judgment into ready Decision Journeys, with the organizational goals, policies and operating requirements needed to put them to work.'] }
      ]
    },
    {
      id: 'shlomi', num: '03', name: 'Shlomi Zevin', first: 'Shlomi', role: 'Chief Technology Officer',
      bio: 'Shlomi has co-founded and led engineering at startups and built systems using neural networks, decision trees and genetic algorithms. His conversational AI experience spans banking onboarding, sales negotiation and wellness.',
      focus: 'Conversational AI across banking onboarding, sales negotiation and wellness.',
      crew: ['Neural networks', 'Decision trees', 'Genetic algorithms'],
      kb: ['startups-engineering.md', 'decision-systems.md', 'conversational-ai.md'],
      asks: [
        { stage: 0, q: 'What have you built?', crew: 'Decision trees', kb: 'decision-systems.md',
          signal: 'Systems built on neural networks, decision trees and genetic algorithms',
          a: ['Shlomi has co-founded and led engineering at startups and built systems using neural networks, decision trees and genetic algorithms.'] },
        { stage: 1, q: 'What do you bring?', crew: 'Neural networks', kb: 'conversational-ai.md',
          signal: 'Conversational AI across banking, sales and wellness',
          a: ['His conversational AI experience spans banking onboarding, sales negotiation and wellness.'] },
        { stage: 2, q: 'Why Lybi?', crew: 'Genetic algorithms', kb: 'startups-engineering.md',
          signal: 'The decision models, methods and platform behind Lybi',
          a: ['Together with AI engineering, that experience becomes the decision models, professional methods and platform behind Lybi.'] }
      ]
    }
  ];

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var el = function (tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, REDUCED ? 0 : ms); }); };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  };

  /* ================= Sound ================= */
  var Sound = (function () {
    var FILES = { enter: 'enter', select: 'select', think: 'think', node: 'node', stage: 'stage', complete: 'complete', theme: 'theme' };
    var ctx, sfxGain, musicGain, music, loading, on = false, buffers = {};

    function init() {
      if (ctx) return;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      sfxGain = ctx.createGain(); sfxGain.gain.value = 0.5; sfxGain.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0; musicGain.connect(ctx.destination);
      loading = Promise.all(Object.keys(FILES).map(function (k) {
        return fetch(BASE + 'audio/' + FILES[k] + '.mp3')
          .then(function (r) { return r.arrayBuffer(); })
          .then(function (b) { return new Promise(function (res, rej) { ctx.decodeAudioData(b, res, rej); }); })
          .then(function (buf) { buffers[k] = buf; })
          .catch(function () { /* a missing sound never breaks the page */ });
      }));
    }

    // The mp3 encoder pads both ends with silence; loop between the first and
    // last audible samples so the theme has no gap at the seam.
    function audibleBounds(buf) {
      var d = buf.getChannelData(0), a = 0, b = d.length - 1, t = 0.002;
      while (a < b && Math.abs(d[a]) < t) a++;
      while (b > a && Math.abs(d[b]) < t) b--;
      return [a / buf.sampleRate, b / buf.sampleRate];
    }

    function startMusic() {
      if (music || !buffers.theme) return;
      var bounds = audibleBounds(buffers.theme);
      music = ctx.createBufferSource();
      music.buffer = buffers.theme;
      music.loop = true; music.loopStart = bounds[0]; music.loopEnd = bounds[1];
      music.connect(musicGain);
      music.start(0, bounds[0]);
    }

    function fade(gain, to, secs) {
      var now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(to, now + secs);
    }

    function set(v, intro) {
      on = v;
      store.set('lybi-team-sound', v ? 'on' : 'off');
      var btn = $('#sound');
      btn.setAttribute('aria-pressed', String(v));
      $('.sound__label', btn).textContent = v ? 'Sound on' : 'Sound off';
      if (v) {
        init();
        if (!ctx) return;
        ctx.resume();
        loading.then(function () {
          if (!on) return;
          if (intro) play('enter', 0.9);
          startMusic();
          fade(musicGain, 0.2, 2.5);
        });
      } else if (ctx) {
        fade(musicGain, 0, 0.4);
      }
    }

    function play(name, vol) {
      if (!on || !ctx || !buffers[name]) return;
      var s = ctx.createBufferSource(), g = ctx.createGain();
      s.buffer = buffers[name]; g.gain.value = vol == null ? 1 : vol;
      s.connect(g); g.connect(sfxGain); s.start();
    }

    document.addEventListener('visibilitychange', function () {
      if (!ctx) return;
      if (document.hidden) ctx.suspend(); else if (on) ctx.resume();
    });

    return { set: set, play: play, isOn: function () { return on; } };
  })();

  /* ================= Light filaments (boot + hero) =================
   * Soft curves of light that undulate and flow left to right. Every line is
   * a travelling wave on a frame-rate-independent clock, drawn twice: a wide
   * faint glow and a fine bright core, fading out at both ends. The pointer is
   * deliberately not involved, so nothing can jump. */
  function filaments(canvas, opts) {
    var g = canvas.getContext('2d'), w = 0, h = 0, dpr = 1, t = 0, raf = 0, visible = true, last = 0;
    var lines = [];
    for (var i = 0; i < opts.count; i++) {
      lines.push({
        y: opts.yMin + Math.random() * (opts.yMax - opts.yMin),
        amp: 0.04 + Math.random() * 0.11, freq: 1.1 + Math.random() * 2.2,
        speed: 0.22 + Math.random() * 0.38, phase: Math.random() * Math.PI * 2,
        swell: 0.07 + Math.random() * 0.1, tilt: (Math.random() - 0.5) * 0.4,
        // A few accent strands carry the light; the rest stay soft behind them.
        alpha: i < 3 ? 0.42 + Math.random() * 0.18 : 0.06 + Math.random() * 0.16,
        hue: Math.random() < 0.55 ? '174,128,255' : (Math.random() < 0.5 ? '158,80,239' : '216,190,255'),
        width: i < 3 ? 1.4 + Math.random() * 0.6 : 0.7 + Math.random() * 1.0
      });
    }
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Gradients depend only on size: build them once per resize, not per frame.
      lines.forEach(function (L) {
        var x0 = w * opts.fadeFrom;
        var core = g.createLinearGradient(x0, 0, w, 0);
        core.addColorStop(0, 'rgba(' + L.hue + ',0)');
        core.addColorStop(0.35, 'rgba(' + L.hue + ',' + L.alpha + ')');
        core.addColorStop(0.8, 'rgba(' + L.hue + ',' + (L.alpha * 0.8) + ')');
        core.addColorStop(1, 'rgba(' + L.hue + ',0)');
        var glow = g.createLinearGradient(x0, 0, w, 0);
        glow.addColorStop(0, 'rgba(' + L.hue + ',0)');
        glow.addColorStop(0.4, 'rgba(' + L.hue + ',' + (L.alpha * 0.22) + ')');
        glow.addColorStop(1, 'rgba(' + L.hue + ',0)');
        L.core = core; L.glow = glow;
      });
    }
    function draw() {
      g.clearRect(0, 0, w, h);
      g.globalCompositeOperation = 'lighter';
      g.lineJoin = 'round';
      for (var i = 0; i < lines.length; i++) {
        var L = lines[i], path = new Path2D();
        // The whole line also rises and falls slowly, so it never looks static.
        var base = L.y + Math.sin(t * L.swell + L.phase) * 0.025;
        for (var s = 0; s <= 60; s++) {
          var x = s / 60;
          var y = base + L.tilt * (x - 0.5)
                + Math.sin(x * L.freq * Math.PI - t * L.speed + L.phase) * L.amp * (0.35 + 0.65 * x);
          if (s === 0) path.moveTo(x * w, y * h); else path.lineTo(x * w, y * h);
        }
        g.strokeStyle = L.glow; g.lineWidth = L.width * 5; g.stroke(path);
        g.strokeStyle = L.core; g.lineWidth = L.width; g.stroke(path);
      }
      g.globalCompositeOperation = 'source-over';
    }
    function frame(now) {
      t += last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      draw();
      raf = visible ? requestAnimationFrame(frame) : 0;
      if (!raf) last = 0;
    }
    resize(); draw();
    window.addEventListener('resize', function () { resize(); draw(); });
    if (REDUCED) return { stop: function () {} };
    new IntersectionObserver(function (es) {
      visible = es[0].isIntersecting;
      if (visible && !raf) { last = 0; raf = requestAnimationFrame(frame); }
    }).observe(canvas);
    raf = requestAnimationFrame(frame);
    return { stop: function () { visible = false; cancelAnimationFrame(raf); raf = 0; } };
  }

  /* ================= State ================= */
  var state = {
    current: 0,
    view: 'agent',
    signals: [],               // ordered [{agent, stage}] — the trajectory history
    process: { entered: false, hero: false, agents: false, close: false },
    busy: {}, logs: {}, asked: {},
    touched: false             // stops the attract-mode cycling
  };
  var has = function (a, s) { return state.signals.some(function (x) { return x.agent === a && x.stage === s; }); };
  var stageCount = function (s) { return state.signals.filter(function (x) { return x.stage === s; }).length; };
  var agentCount = function (a) { return state.signals.filter(function (x) { return x.agent === a; }).length; };
  var processCount = function () { var p = state.process; return [p.entered, p.hero, p.agents, p.close].filter(Boolean).length; };

  /* ================= Boot ================= */
  var heroLines = null;
  var bootLines = filaments($('.boot__lines'), { count: 30, yMin: 0.18, yMax: 0.88, fadeFrom: 0 });
  function enter(withSound) {
    document.body.classList.remove('is-booting');
    $('#boot').classList.add('is-gone');
    setTimeout(function () { bootLines.stop(); $('#boot').remove(); }, 1000);
    Sound.set(withSound, true);
    // The hero's lines start only now: animating them under the boot screen
    // doubled the per-frame work and made the boot animation stutter.
    if (!heroLines) heroLines = filaments($('.hero__lines'), { count: 24, yMin: 0.5, yMax: 0.95, fadeFrom: 0.25 });
    state.process.entered = true;
    renderProcess();
    $('.hero__actions .site-action').focus({ preventScroll: true });
  }
  $('#enter-sound').addEventListener('click', function () { enter(true); });
  $('#enter-quiet').addEventListener('click', function () { enter(false); });
  $('#enter-sound').focus();
  $('#sound').addEventListener('click', function () { Sound.set(!Sound.isOn()); });

  /* ================= Hero + nav ================= */
  var heroBg = $('.hero__bg');
  window.addEventListener('scroll', function () {
    var y = window.scrollY;
    $('#nav').classList.toggle('is-solid', y > 40);
    if (!REDUCED && y < window.innerHeight * 1.2) heroBg.style.transform = 'translate3d(0,' + (y * 0.18) + 'px,0) scale(1.04)';
  }, { passive: true });

  /* ================= Roster + stage ================= */
  var roster = $('#roster');
  AGENTS.forEach(function (A, i) {
    var t = el('button', 'tab');
    t.type = 'button'; t.setAttribute('role', 'tab'); t.id = 'tab-' + A.id;
    t.setAttribute('aria-controls', 'stage');
    t.innerHTML = '<img class="tab__face" src="' + BASE + 'img/' + A.id + '-agent.jpg" alt="">' +
      '<span class="tab__text"><span class="tab__num">AGENT ' + A.num + '</span><span class="tab__name">' + A.name + '</span><span class="tab__role">' + A.role + '</span></span>' +
      '<span class="tab__met" aria-hidden="true"></span>';
    t.addEventListener('click', function () { state.touched = true; select(i); });
    roster.appendChild(t);
    // preload both portraits so switching never flashes
    [A.id + '-agent.jpg', A.id + '-photo.jpg'].forEach(function (f) { new Image().src = BASE + 'img/' + f; });
  });

  function select(i, quiet) {
    var A = AGENTS[i];
    state.current = i;
    Array.prototype.forEach.call(roster.children, function (t, j) {
      t.setAttribute('aria-selected', String(j === i));
      t.tabIndex = j === i ? 0 : -1;
    });
    $('#stage').setAttribute('aria-labelledby', 'tab-' + A.id);
    $('#sheet-focus').textContent = A.focus;
    $('#sheet-crew').innerHTML = A.crew.map(function (c) { return '<li data-crew="' + c + '">' + c + '</li>'; }).join('');
    $('#sheet-kb').innerHTML = A.kb.map(function (k) { return '<li data-kb="' + k + '">' + k + '</li>'; }).join('');
    $('#about-name').textContent = A.name;
    $('#about-role').textContent = A.role;
    $('#about-bio').textContent = A.bio;
    $('#about-back').textContent = 'Ask ' + A.first + '’s agent instead';
    showLog(i);
    renderView();
    showPortrait(true);
    renderAsks();
    if (!quiet) Sound.play('select', 0.4);
  }

  /* Portrait: assembles from lines of light on every switch. Every switch
     takes a ticket; an image or animation frame from an older switch sees a
     newer ticket and drops out, so quick clicking can never leave a stale
     portrait (or the other view's portrait) on screen. */
  var cardImg = $('#card-img'), cardCanvas = $('#card-canvas'), assembleRaf = 0, ticket = 0, revealTimer = 0;
  function portraitSrc() { var A = AGENTS[state.current]; return BASE + 'img/' + A.id + '-' + (state.view === 'agent' ? 'agent' : 'photo') + '.jpg'; }
  function showPortrait(animate, duration) {
    var A = AGENTS[state.current], view = state.view, src = portraitSrc(), mine = ++ticket;
    cancelAnimationFrame(assembleRaf); clearTimeout(revealTimer);
    var img = new Image();
    img.onload = function () {
      if (mine !== ticket) return;
      cardImg.alt = view === 'agent' ? A.name + ', rendered as an agent portrait' : A.name + ', portrait photograph';
      cardImg.classList.toggle('is-photo', view === 'photo');
      cardImg.src = src;
      if (!animate || REDUCED) { cardImg.style.opacity = 1; cardCanvas.style.opacity = 0; return; }
      assemble(img, mine, view, duration || 520);
    };
    img.src = src;
  }
  function assemble(img, mine, view, DUR) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = cardCanvas.clientWidth, H = cardCanvas.clientHeight;
    cardCanvas.width = Math.round(W * dpr); cardCanvas.height = Math.round(H * dpr);
    var g = cardCanvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // object-fit: cover, object-position y 20% for agents, 30% for photos (matches team.css)
    var scale = Math.max(W / img.width, H / img.height), dw = img.width * scale, dh = img.height * scale;
    var dx = (W - dw) / 2, dy = (H - dh) * (view === 'agent' ? 0.2 : 0.3);
    var band = 3, rows = Math.ceil(H / band), seeds = [];
    for (var r = 0; r < rows; r++) seeds.push({ off: (Math.random() - 0.5) * W * 0.6, delay: (r / rows) * 0.4 + Math.random() * 0.15 });
    cardImg.style.opacity = 0; cardCanvas.style.opacity = 1;
    var start = performance.now();
    (function step(now) {
      if (mine !== ticket) return;
      var T = Math.min(1, (now - start) / DUR);
      g.clearRect(0, 0, W, H);
      for (var r = 0; r < rows; r++) {
        var lt = Math.max(0, Math.min(1, (T - seeds[r].delay) / 0.45));
        if (lt <= 0) continue;
        var e = 1 - Math.pow(1 - lt, 3), y = r * band;
        g.globalAlpha = e;
        g.drawImage(img, 0, (y - dy) / scale, img.width, band / scale, dx + seeds[r].off * (1 - e), y, dw, band);
        if (lt < 1) {
          g.globalAlpha = (1 - lt) * 0.9;
          g.fillStyle = '#C9A8FF';
          g.fillRect(dx + seeds[r].off * (1 - e) + dw * 0.5 * (1 - e), y + 1, Math.max(8, dw * (1 - e)), 1);
        }
      }
      g.globalAlpha = 1;
      if (T < 1) { assembleRaf = requestAnimationFrame(step); return; }
      cardImg.style.opacity = 1;
      revealTimer = setTimeout(function () { if (mine === ticket) cardCanvas.style.opacity = 0; }, 40);
    })(start);
  }
  /* Agent view = the console; Human view = the founder's approved bio in the
     same pane. The thread is only hidden, never rebuilt, so it survives. */
  var toggleBtns = document.querySelectorAll('.card__toggle button');
  function renderView() {
    var A = AGENTS[state.current], human = state.view === 'photo';
    Array.prototype.forEach.call(toggleBtns, function (o) {
      var on = o.dataset.view === state.view;
      o.classList.toggle('is-on', on); o.setAttribute('aria-pressed', String(on));
    });
    $('#card-tag').textContent = (human ? 'FOUNDER ' : 'AGENT ') + A.num;
    $('#console-title').textContent = human ? 'About ' + A.first : 'Ask ' + A.first + '’s agent';
    $('#console').classList.toggle('is-about', human);
    $('#about').hidden = !human;
    $('#log').hidden = human;
    $('#asks').hidden = human;
    if (!human) $('#log').scrollTop = $('#log').scrollHeight;
  }
  function setView(v) {
    if (v === state.view) return;
    state.touched = true;
    state.view = v;
    renderView();
    showPortrait(true, 360);
    Sound.play('select', 0.3);
  }
  Array.prototype.forEach.call(toggleBtns, function (b) {
    b.addEventListener('click', function () { setView(b.dataset.view); });
  });
  $('#about-back').addEventListener('click', function () {
    setView('agent');
    var first = $('#asks .ask:not(:disabled)');
    if (first) first.focus();
  });
  // Tilt + sheen
  var card = $('#card'), frame = $('.card__frame');
  if (!REDUCED) {
    frame.addEventListener('pointermove', function (e) {
      var r = frame.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      frame.style.transform = 'rotateY(' + ((x - 0.5) * 10) + 'deg) rotateX(' + ((0.5 - y) * 10) + 'deg)';
      card.style.setProperty('--mx', (x * 100) + '%'); card.style.setProperty('--my', (y * 100) + '%');
    });
    frame.addEventListener('pointerleave', function () { frame.style.transform = ''; });
  }

  /* ================= Console ================= */
  // One thread per agent, kept while the visitor switches between them.
  function showLog(i) {
    var A = AGENTS[i], host = $('#log');
    if (!state.logs[A.id]) {
      var log = el('div', 'console__thread');
      var hello = el('div', 'msg msg--agent msg--hello');
      hello.innerHTML = '<span class="msg__from">' + A.first + '’s agent</span><div class="msg__text"><p>I answer only from ' + A.first + '’s approved bio. Pick a question below.</p></div>';
      log.appendChild(hello);
      state.logs[A.id] = log;
      host.appendChild(log);
    }
    Object.keys(state.logs).forEach(function (k) { state.logs[k].hidden = k !== A.id; });
    host.scrollTop = host.scrollHeight;
  }

  function renderAsks() {
    var A = AGENTS[state.current], box = $('#asks');
    box.innerHTML = '';
    A.asks.forEach(function (ask, k) {
      var done = state.asked[A.id + k];
      var b = el('button', 'ask' + (done ? ' is-done' : ''));
      b.type = 'button';
      b.disabled = !!state.busy[A.id];
      b.innerHTML = '<span class="ask__stage">' + STAGES[ask.stage].verb + '</span>' + ask.q;
      b.setAttribute('aria-label', ask.q + ' (' + STAGES[ask.stage].verb.toLowerCase() + ' ' + STAGES[ask.stage].noun.toLowerCase() + ')');
      b.addEventListener('click', function () { state.touched = true; askQuestion(state.current, k); });
      box.appendChild(b);
    });
  }

  function hot(attr, value, on) {
    var n = document.querySelector('[data-' + attr + '="' + value + '"]');
    if (n) n.classList.toggle('is-hot', on);
  }

  function askQuestion(ai, k) {
    var A = AGENTS[ai], ask = A.asks[k], log = state.logs[A.id], host = $('#log');
    if (state.busy[A.id]) return;
    state.busy[A.id] = true; renderAsks();
    var scroll = function () { host.scrollTop = host.scrollHeight; };

    var you = el('div', 'msg msg--you'); you.textContent = ask.q; log.appendChild(you); scroll();
    Sound.play('select', 0.35);

    var think = el('div', 'think');
    var steps = [
      'Routing to crew member <b>' + ask.crew + '</b>',
      'Searching knowledge base <b>' + ask.kb + '</b>',
      'Grounding check <b>matched approved bio</b>'
    ].map(function (s) { var d = el('div', 'think__step', s); think.appendChild(d); return d; });

    var current = function () { return state.current === ai; };
    return wait(350).then(function () {
      log.appendChild(think); scroll();
      Sound.play('think', 0.3);
      steps[0].classList.add('is-in'); if (current()) hot('crew', ask.crew, true);
      return wait(650);
    }).then(function () {
      steps[0].classList.add('is-done'); steps[1].classList.add('is-in'); if (current()) hot('kb', ask.kb, true);
      return wait(700);
    }).then(function () {
      steps[1].classList.add('is-done'); steps[2].classList.add('is-in');
      return wait(600);
    }).then(function () {
      steps[2].classList.add('is-done');
      var msg = el('div', 'msg msg--agent');
      msg.innerHTML = '<span class="msg__from">From ' + A.first + '’s approved bio</span><div class="msg__text"></div>';
      log.appendChild(msg); scroll();
      return typeOut($('.msg__text', msg), ask.a, scroll).then(function () { return msg; });
    }).then(function (msg) {
      var src = el('a', 'msg__src', 'Source · lybi.ai company page');
      src.href = '/lybi#/company';
      msg.appendChild(src);
      msg.appendChild(el('span', 'msg__stage', STAGES[ask.stage].verb));
      scroll();
      if (current()) { hot('crew', ask.crew, false); hot('kb', ask.kb, false); }
      state.asked[A.id + k] = true;
      state.busy[A.id] = false;
      if (current()) renderAsks();
      addSignal(ai, ask.stage);
    });
  }

  function typeOut(box, paras, scroll) {
    if (REDUCED) {
      box.innerHTML = paras.map(function (p) { return '<p>' + p + '</p>'; }).join('');
      return Promise.resolve();
    }
    var caret = el('span', 'caret');
    var i = 0;
    return paras.reduce(function (chain, text) {
      return chain.then(function () {
        var p = el('p'); box.appendChild(p); p.appendChild(document.createTextNode('')); p.appendChild(caret);
        var node = p.firstChild, n = 0;
        return new Promise(function (done) {
          (function tick() {
            n = Math.min(text.length, n + 3);
            node.nodeValue = text.slice(0, n);
            if (++i % 6 === 0) scroll();
            if (n < text.length) setTimeout(tick, 16); else { scroll(); setTimeout(done, 220); }
          })();
        });
      });
    }, Promise.resolve()).then(function () { caret.remove(); });
  }

  /* ================= Decision path ================= */
  var GX = [72, 142, 212], GY = [50, 90, 130];
  function renderGraph(fresh) {
    var svg = $('#hud-graph');
    var h = '<defs><linearGradient id="trail" x1="0" x2="1"><stop offset="0" stop-color="#7B39C5"/><stop offset="1" stop-color="#AE80FF"/></linearGradient></defs>';
    STAGES.forEach(function (s, c) { h += '<text class="col-label" x="' + GX[c] + '" y="20" text-anchor="middle">' + s.verb + '</text>'; });
    AGENTS.forEach(function (A, r) {
      h += '<text class="row-label" x="4" y="' + (GY[r] + 3) + '">' + A.first.toUpperCase() + '</text>';
      h += '<line class="grid" x1="' + GX[0] + '" y1="' + GY[r] + '" x2="' + GX[2] + '" y2="' + GY[r] + '"/>';
    });
    if (state.signals.length > 1) {
      h += '<polyline class="trail" points="' + state.signals.map(function (s) { return GX[s.stage] + ',' + GY[s.agent]; }).join(' ') + '"/>';
    }
    AGENTS.forEach(function (A, r) {
      STAGES.forEach(function (s, c) {
        var on = has(r, c), isNew = fresh && fresh.agent === r && fresh.stage === c;
        h += '<circle class="n' + (on ? ' is-on' : '') + (isNew ? ' is-new' : '') + '" cx="' + GX[c] + '" cy="' + GY[r] + '" r="6"/>';
      });
    });
    svg.innerHTML = h;
  }

  function renderStages() {
    $('#hud-stages').innerHTML = STAGES.map(function (s, c) {
      var n = stageCount(c);
      return '<li class="' + (n === 3 ? 'is-done' : '') + '"><b>' + s.verb + '<span>' + s.noun + '</span></b><em>' + n + '/3</em><span class="bar"><i style="width:' + (n / 3 * 100) + '%"></i></span></li>';
    }).join('');
    $('#hud-score').textContent = state.signals.length + '/9';
    $('#ledger-decision').style.width = (state.signals.length / 9 * 100) + '%';
    $('#ledger-decision-v').textContent = state.signals.length + '/9 signals';
  }

  function renderProcess() {
    var n = processCount();
    $('#hud-process').style.width = (n / 4 * 100) + '%';
    $('#hud-process-v').textContent = n + '/4';
    $('#ledger-process').style.width = (n / 4 * 100) + '%';
    $('#ledger-process-v').textContent = n + '/4 steps';
  }

  function renderFound() {
    $('#found').innerHTML = STAGES.map(function (s, c) {
      var items = state.signals.filter(function (x) { return x.stage === c; }).map(function (x) {
        return '<li>' + AGENTS[x.agent].asks.filter(function (a) { return a.stage === c; })[0].signal + '</li>';
      });
      if (!items.length) items = ['<li class="is-empty">Still open. Ask an agent above.</li>'];
      return '<div class="found__col"><h4>' + s.verb + ' <span>' + s.noun + '</span></h4><ul>' + items.join('') + '</ul></div>';
    }).join('');
    var all = state.signals.length === 9;
    $('#close-eyebrow').textContent = all ? 'Decision established' : 'Your path so far';
  }

  function feed(html, hint) {
    var f = $('#hud-feed'), li = el('li', hint ? 'is-hint' : '', html);
    if (!hint) Array.prototype.forEach.call(f.querySelectorAll('.is-hint'), function (n) { n.remove(); });
    f.insertBefore(li, f.firstChild);
    while (f.children.length > (HUD_BAR.matches ? 3 : 6)) f.lastChild.remove();
  }

  function addSignal(ai, stage) {
    if (has(ai, stage)) return;
    var A = AGENTS[ai], ask = A.asks.filter(function (a) { return a.stage === stage; })[0];
    var sig = { agent: ai, stage: stage };
    state.signals.push(sig);
    renderGraph(sig); renderStages(); renderFound();
    feed('<b>' + STAGES[stage].found + ' · ' + A.first + '</b>' + ask.signal);
    Sound.play('node', 0.5);

    if (agentCount(ai) === 1) {
      roster.children[ai].classList.add('is-met');
      var met = AGENTS.filter(function (_, j) { return agentCount(j) > 0; }).length;
      document.querySelectorAll('.met__pips i').forEach(function (p, j) { p.classList.toggle('is-on', j < met); });
      $('#met-count').textContent = met + '/3';
    }
    var stageDone = stageCount(stage) === 3, agentDone = agentCount(ai) === 3;
    if (state.signals.length === 9) {
      setTimeout(finale, 700);
    } else if (stageDone) {
      setTimeout(function () { Sound.play('stage', 0.9); toast('<b>' + STAGES[stage].verb + '</b> complete · all three ' + STAGES[stage].noun.toLowerCase() + ' in place'); }, 450);
    } else if (agentDone) {
      setTimeout(function () { toast('<b>' + A.first + '’s agent</b> fully mapped'); }, 450);
    }
  }

  var toastTimer;
  function toast(html) {
    var t = $('#toast'), c = $('#console').getBoundingClientRect(), asks = $('#asks');
    // Desktop: float it over the chat, just above the questions, so it never
    // covers a button. Elsewhere it keeps its default bottom-centre spot.
    if (!HUD_BAR.matches && !asks.hidden && c.top < window.innerHeight && c.bottom > 0) {
      t.style.left = (c.left + c.width / 2) + 'px';
      t.style.bottom = (window.innerHeight - asks.getBoundingClientRect().top + 12) + 'px';
    } else { t.style.left = ''; t.style.bottom = ''; }
    t.innerHTML = html; t.classList.add('is-on');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('is-on'); }, 3200);
  }

  var lastFocus;
  function finale() {
    clearTimeout(toastTimer); $('#toast').classList.remove('is-on');
    Sound.play('complete', 1);
    burst();
    lastFocus = document.activeElement;
    $('#won').hidden = false;
    $('#won-see').focus();
  }
  function closeFinale(go) {
    $('#won').hidden = true;
    if (go) document.getElementById('close').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
    else if (lastFocus) lastFocus.focus();
  }
  $('#won-see').addEventListener('click', function () { closeFinale(true); });
  $('#won-close').addEventListener('click', function () { closeFinale(false); });

  function burst() {
    if (REDUCED) return;
    var cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    for (var i = 0; i < 46; i++) {
      var p = el('i', 'burst'), a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 320;
      p.style.left = cx + 'px'; p.style.top = cy + 'px';
      document.body.appendChild(p);
      p.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: 'translate(' + Math.cos(a) * d + 'px,' + Math.sin(a) * d + 'px) scale(.2)', opacity: 0 }],
        { duration: 900 + Math.random() * 700, easing: 'cubic-bezier(.2,.7,.2,1)' }).onfinish = (function (n) { return function () { n.remove(); }; })(p);
    }
  }

  /* ================= HUD + process tracking ================= */
  // Desktop: an in-flow column of the agents station. Below 1100px: a
  // collapsible bottom bar that appears once the hero is scrolled away.
  var hud = $('#hud'), HUD_BAR = window.matchMedia('(max-width: 1099px)');
  function syncHud() {
    var bar = HUD_BAR.matches;
    hud.classList.toggle('is-collapsed', bar);
    $('#hud-toggle').setAttribute('aria-expanded', String(!bar));
  }
  syncHud();
  if (HUD_BAR.addEventListener) HUD_BAR.addEventListener('change', syncHud);
  $('#hud-toggle').addEventListener('click', function () {
    if (!HUD_BAR.matches) return;
    var c = hud.classList.toggle('is-collapsed');
    this.setAttribute('aria-expanded', String(!c));
  });
  new IntersectionObserver(function (es) {
    document.body.classList.toggle('hud-on', es[0].intersectionRatio < 0.35);
  }, { threshold: [0, 0.35, 1] }).observe($('#hero'));

  var sectionIO = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      var k = e.target.dataset.process;
      if (state.process[k]) return;
      state.process[k] = true;
      renderProcess();
    });
  }, { threshold: 0.3 });
  document.querySelectorAll('[data-process]').forEach(function (s) { sectionIO.observe(s); });

  /* ================= Keys + attract mode ================= */
  document.addEventListener('keydown', function (e) {
    if (!$('#won').hidden) { if (e.key === 'Escape') closeFinale(false); return; }
    if (document.body.classList.contains('is-booting') || e.altKey || e.ctrlKey || e.metaKey) return;
    var n = AGENTS.length, i = state.current;
    var onTab = document.activeElement && document.activeElement.classList.contains('tab');
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault(); state.touched = true;
      select(e.key === 'ArrowRight' ? (i + 1) % n : (i + n - 1) % n);
      if (onTab) roster.children[state.current].focus();
    }
    else if (/^[1-3]$/.test(e.key)) { state.touched = true; select(+e.key - 1); }
  });

  var agentsInView = false;
  new IntersectionObserver(function (es) { agentsInView = es[0].isIntersecting; }, { threshold: 0.4 }).observe($('#stage'));
  if (!REDUCED) {
    setInterval(function () {
      if (state.touched || !agentsInView || state.busy[AGENTS[state.current].id]) return;
      select((state.current + 1) % AGENTS.length, true);
    }, 7000);
  }

  /* ================= Start ================= */
  select(0, true);
  renderGraph(); renderStages(); renderProcess(); renderFound();
  feed('Ask an agent a question to start your path.', true);
})();
