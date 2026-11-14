/*============================================================
  app.js — Gallery carousel prev/next controls
============================================================*/
const nextBtn = document.querySelector('.next');
const prevBtn = document.querySelector('.prev');

if (nextBtn && prevBtn) {
    nextBtn.addEventListener('click', () => {
        const slide = document.querySelector('.slide');
        const items = document.querySelectorAll('.item');
        if (slide && items.length) {
            slide.appendChild(items[0]);
        }
    });

    prevBtn.addEventListener('click', () => {
        const slide = document.querySelector('.slide');
        const items = document.querySelectorAll('.item');
        if (slide && items.length) {
            slide.insertBefore(items[items.length - 1], items[0]);
        }
    });
}
