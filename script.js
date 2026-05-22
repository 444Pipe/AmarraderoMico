// Hero video: empieza en el segundo 26 y hace loop desde ahi
const HERO_START = 26;
const heroVideo = document.getElementById('heroVideo');
if (heroVideo) {
    heroVideo.addEventListener('loadedmetadata', () => {
        if (heroVideo.currentTime < HERO_START) heroVideo.currentTime = HERO_START;
    });
    heroVideo.addEventListener('ended', () => {
        heroVideo.currentTime = HERO_START;
        heroVideo.play();
    });
}

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
const reveals = document.querySelectorAll('.historia-text, .historia-img, .dish, .sede-card, .exp-text, .exp-img');
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
