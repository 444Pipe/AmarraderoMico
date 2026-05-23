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

// Reveal on scroll
const reveals = document.querySelectorAll('.historia-text, .historia-img, .dish, .sede-card, .exp-text, .exp-img, .news-card');
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.12 });

reveals.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(40px)';
    el.style.transition = 'opacity 0.9s ease, transform 0.9s ease';
    observer.observe(el);
});
