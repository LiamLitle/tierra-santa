  window.addEventListener("load", () => {
    gsap.registerPlugin(ScrollTrigger);

    /* ─────────────────────────────────────────
       1. LENIS — single RAF via GSAP ticker
    ───────────────────────────────────────── */
    const lenis = new Lenis({ lerp: 0.07, wheelMultiplier: 0.9, touchMultiplier: 2 });
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.on('scroll', ScrollTrigger.update);

    /* ─────────────────────────────────────────
       2. NAV — dark glass after 60px of scroll
       Fires immediately so content scrolls
       behind the opaque bar, never through it.
    ───────────────────────────────────────── */
    const nav = document.getElementById('nav');
    lenis.on('scroll', ({ scroll }) => {
      if (scroll > 60) {
        nav.classList.add('scrolled');
      } else {
        nav.classList.remove('scrolled');
      }
    });

    /* ─────────────────────────────────────────
       2b. MOBILE NAV — hamburger toggle
       Shared markup/CSS across every page; guarded
       so pages without it (there are none, but just
       in case) don't error.
    ───────────────────────────────────────── */
    const navToggle = document.getElementById('nav-toggle');
    const navLinksEl = document.getElementById('nav-links');
    if (navToggle && navLinksEl) {
      const setOpen = (open) => {
        navLinksEl.classList.toggle('is-open', open);
        navToggle.classList.toggle('is-open', open);
        navToggle.setAttribute('aria-expanded', String(open));
      };
      navToggle.addEventListener('click', () => {
        setOpen(!navLinksEl.classList.contains('is-open'));
      });
      navLinksEl.querySelectorAll('a').forEach((a) => {
        a.addEventListener('click', () => setOpen(false));
      });
    }

    /* ─────────────────────────────────────────
       4. SECTION CONTENT PARALLAX
       Each content block rises 40px slower than
       scroll — creates a gentle "mist lifting"
       layered depth between sections.
    ───────────────────────────────────────── */
    const parallaxBlocks = [
      '.intro-text', '.intro-quote',
      '.tenets-intro', '.tenets-grid',
      '.experience-body',
      '.testimonial-inner',
      '.place-header', '.place-images',
      '.guide-body',
      '.journey-intro', '.steps',
      '.paths-header', '.paths-grid',
      '.contact-inner'
    ];
    parallaxBlocks.forEach(sel => {
      const el = document.querySelector(sel);
      if (!el) return;
      gsap.fromTo(el,
        { y: 40 },
        { y: 0, ease: 'none',
          scrollTrigger: {
            trigger: el,
            start: 'top bottom',
            end: 'center 60%',
            scrub: 2.5
          }
        }
      );
    });

    /* ─────────────────────────────────────────
       10. IMAGES — crystallise from deep blur
    ───────────────────────────────────────── */
    gsap.utils.toArray('.place-img, .experience-image, .guide-image').forEach((el, i) => {
      gsap.fromTo(el,
        { opacity: 0, scale: 0.96, filter: 'blur(22px)' },
        { opacity: 1, scale: 1,    filter: 'blur(0px)',
          duration: 1.6, ease: 'power2.out', delay: i * 0.07,
          onComplete() { gsap.set(el, { filter: 'none' }); },
          scrollTrigger: { trigger: el, start: 'top 88%', once: true }
        }
      );
    });

    setTimeout(() => ScrollTrigger.refresh(), 300);

    // Web fonts (Italiana, Cormorant Garamond, Jost) often finish swapping in
    // AFTER the initial refresh above, which silently shifts every section's
    // vertical position and desyncs the scroll-triggered reveals below the
    // fold (headings/cards can stay stuck at opacity:0 forever). Re-measure
    // once fonts are fully ready, and once more shortly after as a safety net.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => ScrollTrigger.refresh());
    }
    setTimeout(() => ScrollTrigger.refresh(), 1500);

    /* ── AMBIENT SOUND ──────────────────────────────────── */
    const audio       = document.getElementById('ambient-audio');
    const soundBtn    = document.getElementById('sound-toggle');
    const waveSmall   = document.getElementById('sound-wave-1');
    const waveLarge   = document.getElementById('sound-wave-2');

    audio.volume = 0;
    let audioStarted  = false;
    let isMuted       = false;

    function fadeAudioIn() {
      // Smoothly ramp volume from 0 → 0.14 over ~3 s
      const target  = 0.14;
      const step    = target / 60;          // 60 ticks ≈ 3 s at 20 ms interval
      const ramp    = setInterval(() => {
        audio.volume = Math.min(audio.volume + step, target);
        if (audio.volume >= target) clearInterval(ramp);
      }, 50);
    }

    function startAudio() {
      if (audioStarted) return;
      audio.play().then(() => {
        audioStarted = true;
        fadeAudioIn();
      }).catch(() => {
        // Still blocked — try again on next interaction
      });
    }

    // Force playback to begin immediately when the page loads.
    startAudio();

    function updateIcon() {
      if (isMuted) {
        // Show crossed-out waves
        waveSmall.setAttribute('stroke-dasharray', '0 100');
        waveLarge.setAttribute('stroke-dasharray', '0 100');
        soundBtn.classList.add('is-muted');
      } else {
        waveSmall.removeAttribute('stroke-dasharray');
        waveLarge.removeAttribute('stroke-dasharray');
        soundBtn.classList.remove('is-muted');
      }
    }

    soundBtn.addEventListener('click', () => {
      if (!audioStarted) {
        // First click: start audio, unmuted
        startAudio();
        isMuted = false;
      } else if (!isMuted) {
        audio.pause();
        isMuted = true;
      } else {
        audio.play().catch(() => {});
        isMuted = false;
      }
      updateIcon();
    });

    // Try autoplay on first scroll or any touch/click on the page
    const tryStart = () => { startAudio(); };
    lenis.on('scroll', tryStart);
    document.addEventListener('pointerdown', tryStart, { once: true });
  });


/* ─────────────────────────────────────────
   GALLERY LIGHTBOX — click to enlarge
   Scoped to "The Place" and "In Sacred
   Alliance" (Ngäbe-Buglé) photo galleries.
   Deliberately standalone and independent of
   GSAP/Lenis/ScrollTrigger — those load from
   external CDNs and can fail to load (ad
   blockers, slow networks, corporate
   firewalls). This must keep working even
   when they don't.
───────────────────────────────────────── */
(function () {
  function init() {
    const lightbox     = document.getElementById('lightbox');
    const lightboxImg   = document.getElementById('lightbox-img');
    const lightboxClose = document.getElementById('lightbox-close');
    if (!lightbox || !lightboxImg) return;

    function openLightbox(src, alt) {
      lightboxImg.src = src;
      lightboxImg.alt = alt || '';
      lightbox.classList.add('is-open');
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.classList.add('lightbox-locked');
    }
    function closeLightbox() {
      lightbox.classList.remove('is-open');
      lightbox.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('lightbox-locked');
    }

    document.querySelectorAll('#place .place-img img, #sacred-alliance .place-img img').forEach(img => {
      img.addEventListener('click', () => openLightbox(img.currentSrc || img.src, img.alt));
    });
    if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
    // Click anywhere on the dark backdrop (outside the card) closes it
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeLightbox();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
