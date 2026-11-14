/*============================================================
  script.js — AESPA AesMERCH
  Handles: hamburger nav, sticky header, active nav links,
           dark mode, and Swiper initialization.
============================================================*/

/* ============================================================
   HAMBURGER MENU / MOBILE NAV
   ============================================================ */
const menuIcon = document.querySelector('#menu-icon');
const navbar   = document.querySelector('.navbar');

if (menuIcon && navbar) {
    menuIcon.addEventListener('click', () => {
        menuIcon.classList.toggle('bx-x');
        navbar.classList.toggle('active');
    });

    // Close menu when a nav link is clicked
    navbar.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            menuIcon.classList.remove('bx-x');
            navbar.classList.remove('active');
        });
    });
}

/* ============================================================
   STICKY HEADER + ACTIVE NAV LINK ON SCROLL
   ============================================================ */
const header   = document.querySelector('.header');
const sections = document.querySelectorAll('section');
const navLinks = document.querySelectorAll('header nav a');

window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;

    // Toggle sticky class
    if (header) {
        header.classList.toggle('sticky', scrollY > 80);
    }

    // Highlight active nav link based on scroll position
    sections.forEach(sec => {
        const offset = sec.offsetTop - 160;
        const height = sec.offsetHeight;
        const id     = sec.getAttribute('id');

        if (scrollY >= offset && scrollY < offset + height) {
            navLinks.forEach(link => link.classList.remove('active'));
            const activeLink = document.querySelector(`header nav a[href*="${id}"]`);
            if (activeLink) activeLink.classList.add('active');
        }
    });

    // Auto-close hamburger on scroll
    if (menuIcon && navbar) {
        menuIcon.classList.remove('bx-x');
        navbar.classList.remove('active');
    }
});

/* ============================================================
   DARK MODE TOGGLE
   ============================================================ */
const darkModeIcon = document.querySelector('#darkMode-icon');

if (darkModeIcon) {
    // Restore preference from localStorage
    if (localStorage.getItem('aesmerch_darkmode') === 'true') {
        document.body.classList.add('dark-mode');
        darkModeIcon.classList.replace('bx-moon', 'bx-sun');
    }

    darkModeIcon.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark-mode');
        darkModeIcon.classList.toggle('bx-sun', isDark);
        darkModeIcon.classList.toggle('bx-moon', !isDark);
        localStorage.setItem('aesmerch_darkmode', isDark);
    });
}

/* ============================================================
   SWIPER — Core Members carousel
   ============================================================ */
// Wait for Swiper to be available (loaded via CDN in HTML)
if (typeof Swiper !== 'undefined') {
    new Swiper('.mySwiper', {
        slidesPerView: 1,
        spaceBetween: 30,
        loop: true,
        grabCursor: true,
        pagination: {
            el: '.swiper-pagination',
            clickable: true,
        },
        navigation: {
            nextEl: '.swiper-button-next',
            prevEl: '.swiper-button-prev',
        },
        autoplay: {
            delay: 5000,
            disableOnInteraction: false,
            pauseOnMouseEnter: true,
        },
    });
}
