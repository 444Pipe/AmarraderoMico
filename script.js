// Loader: barra de progreso real segun recursos cargados
(function initLoader() {
    const loader = document.getElementById('loader');
    const loaderBar = document.getElementById('loaderBar');
    if (!loader || !loaderBar) return;

    const images = Array.from(document.querySelectorAll('img'));
    const hasVideo = !!document.getElementById('heroVideo');
    const total = images.length + (hasVideo ? 1 : 0);
    let loaded = 0;
    let minProgress = 0;
    const ticker = setInterval(() => {
        minProgress = Math.min(minProgress + 2, 90);
        const realPct = total ? (loaded / total) * 100 : 0;
        const pct = Math.max(realPct, minProgress);
        loaderBar.style.width = pct + '%';
    }, 120);

    const bump = () => { loaded++; };
    images.forEach(img => {
        if (img.complete) bump();
        else {
            img.addEventListener('load', bump, { once: true });
            img.addEventListener('error', bump, { once: true });
        }
    });
    if (hasVideo) {
        const v = document.getElementById('heroVideo');
        if (v.readyState >= 1) bump();
        else {
            v.addEventListener('loadedmetadata', bump, { once: true });
            v.addEventListener('error', bump, { once: true });
        }
    }

    const hideLoader = () => {
        clearInterval(ticker);
        loaderBar.style.width = '100%';
        setTimeout(() => {
            loader.classList.add('hidden');
            document.body.classList.remove('loading');
        }, 450);
    };

    if (document.readyState === 'complete') hideLoader();
    else window.addEventListener('load', hideLoader);
    setTimeout(hideLoader, 7000); // failsafe
})();

// Navbar scroll effect
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
    if (window.scrollY > 60) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Mobile menu toggle
const navToggle = document.getElementById('navToggle');
const navMenu = document.getElementById('navMenu');
navToggle.addEventListener('click', () => {
    navMenu.classList.toggle('active');
});

// Close mobile menu on link click
document.querySelectorAll('.nav-menu a').forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('active');
    });
});

// ============= SCROLL PROGRESS BAR =============
const scrollProgress = document.getElementById('scrollProgress');
let ticking = false;
const updateScrollProgress = () => {
    const h = document.documentElement;
    const scrollTop = h.scrollTop || document.body.scrollTop;
    const scrollHeight = h.scrollHeight - h.clientHeight;
    const pct = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
    if (scrollProgress) scrollProgress.style.width = pct + '%';
    ticking = false;
};
window.addEventListener('scroll', () => {
    if (!ticking) {
        requestAnimationFrame(updateScrollProgress);
        ticking = true;
    }
}, { passive: true });

// ============= HERO PARALLAX =============
const heroSection = document.querySelector('.hero');
const heroVideoEl = document.querySelector('.hero-video');
const heroContent = document.querySelector('.hero-content');
let heroTicking = false;
const updateHeroParallax = () => {
    const scrollY = window.scrollY;
    if (heroSection && scrollY < window.innerHeight) {
        if (heroVideoEl) heroVideoEl.style.transform = `translateY(${scrollY * 0.35}px)`;
        if (heroContent) {
            heroContent.style.transform = `translateY(${scrollY * 0.5}px)`;
            heroContent.style.opacity = Math.max(0, 1 - scrollY / (window.innerHeight * 0.7));
        }
    }
    heroTicking = false;
};
window.addEventListener('scroll', () => {
    if (!heroTicking) {
        requestAnimationFrame(updateHeroParallax);
        heroTicking = true;
    }
}, { passive: true });

// ============= SCROLL REVEAL =============
const revealSelectors = [
    { sel: '.historia-img', cls: 'from-left' },
    { sel: '.historia-text', cls: 'from-right' },
    { sel: '.exp-img', cls: 'from-left' },
    { sel: '.exp-text', cls: 'from-right' },
    { sel: '.carta-header', cls: 'fade-only' },
    { sel: '.sedes-header', cls: 'fade-only' },
    { sel: '.noticias-header', cls: 'fade-only' },
    { sel: '.sede-map-text', cls: 'from-left' },
    { sel: '.sede-map-frame', cls: 'from-right' },
    { sel: '.cta-content', cls: 'scale-up' },
];
revealSelectors.forEach(({ sel, cls }) => {
    document.querySelectorAll(sel).forEach(el => {
        el.classList.add('reveal', cls);
    });
});

// Grids con stagger (cards aparecen una despues de otra)
const staggerGrids = [
    { sel: '.dish', step: 80, max: 5 },
    { sel: '.sede-card', step: 150, max: 3 },
    { sel: '.news-card', step: 130, max: 3 },
    { sel: '.exp-list li', step: 100, max: 4 },
    { sel: '.strip-item', step: 100, max: 4 },
];
staggerGrids.forEach(({ sel, step, max }) => {
    document.querySelectorAll(sel).forEach((el, i) => {
        el.classList.add('reveal');
        el.setAttribute('data-delay', Math.min(i, max) * step);
    });
});

const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ============= NAVBAR ACTIVE LINK ON SCROLL =============
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-menu a');
const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const id = entry.target.id;
            navLinks.forEach(link => {
                link.classList.toggle('active', link.getAttribute('href') === '#' + id);
            });
        }
    });
}, { threshold: 0.4, rootMargin: '-80px 0px -50% 0px' });
sections.forEach(s => sectionObserver.observe(s));
