/* =========================================
   1. MENU & NAVIGATION (Hamburger)
   ========================================= */
const hamburger = document.querySelector(".hamburger");
const menu = document.getElementById("menu");
const closeBtn = document.querySelector(".menu-drawer .close");
const menuOverlay = document.querySelector('.menu-overlay');

function openMenu() {
    menu.classList.add('open');
    menu.setAttribute('aria-hidden', 'false');
    if (hamburger) hamburger.setAttribute('aria-expanded', 'true');
    if (menuOverlay) menuOverlay.classList.add('active');
}

function closeMenu() {
    menu.classList.remove('open');
    menu.setAttribute('aria-hidden', 'true');
    if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
    if (menuOverlay) menuOverlay.classList.remove('active');
}

if (hamburger && menu) {
    hamburger.addEventListener('click', openMenu);
    if (closeBtn) closeBtn.addEventListener('click', closeMenu);
    if (menuOverlay) menuOverlay.addEventListener('click', closeMenu);

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && menu.classList.contains('open')) closeMenu();
    });

    // Close if clicking outside
    document.addEventListener('click', (e) => {
        if (!menu.classList.contains('open')) return;
        const target = e.target;
        if (!menu.contains(target) && !hamburger.contains(target)) {
            closeMenu();
        }
    });
}

/* =========================================
   2. FOOTER REVEAL ON SCROLL
   ========================================= */
(function(){
    const footer = document.querySelector('.site-footer');
    const footerBottom = document.querySelector('.footer-bottom');
    const target = footerBottom || footer;
    if(!target) return;

    const onEnter = (entries, obs) => {
        entries.forEach(entry => {
            if(entry.isIntersecting) {
                if(footer) footer.classList.add('in-view');
                if(footerBottom) footerBottom.classList.add('in-view');
                obs.disconnect();
            }
        });
    };

    const io = new IntersectionObserver(onEnter, { threshold: 0.06 });
    io.observe(target);
})();

/* =========================================
   3. LIGHTBOX GALLERY (For Collaborators Page)
   ========================================= */
(function(){
    const galleryImgs = Array.from(document.querySelectorAll('.gallery-grid .photo img'));
    const lightbox = document.getElementById('lightbox');
    if (!galleryImgs.length || !lightbox) return;

    const lbImg = lightbox.querySelector('.lightbox-content img');
    const closeBtn = lightbox.querySelector('.lightbox-close');
    const prevBtn = lightbox.querySelector('.lightbox-prev');
    const nextBtn = lightbox.querySelector('.lightbox-next');

    // Helper to get larger image if available
    function largeSrc(src){
        try { return src.replace(/\/\d+x\d+\//, '/1200x800/'); } catch (e) { return src; }
    }

    const images = galleryImgs.map(img => ({ 
        el: img, 
        src: img.getAttribute('data-large') || largeSrc(img.src), 
        alt: img.alt || '' 
    }));
    
    let current = 0;

    function open(index){
        current = index;
        lbImg.src = images[current].src;
        lbImg.alt = images[current].alt;
        lightbox.classList.add('open');
        lightbox.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        closeBtn.focus();
    }

    function close(){
        lightbox.classList.remove('open');
        lightbox.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        lbImg.src = '';
    }

    function showNext(){ open((current + 1) % images.length); }
    function showPrev(){ open((current - 1 + images.length) % images.length); }

    galleryImgs.forEach((imgEl, i) => {
        imgEl.style.cursor = 'zoom-in';
        imgEl.addEventListener('click', (e) => { e.preventDefault(); open(i); });
        imgEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(i); });
    });

    closeBtn.addEventListener('click', close);
    nextBtn.addEventListener('click', (e)=>{ e.stopPropagation(); showNext(); });
    prevBtn.addEventListener('click', (e)=>{ e.stopPropagation(); showPrev(); });

    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) close();
    });

    document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('open')) return;
        if (e.key === 'Escape') close();
        if (e.key === 'ArrowRight') showNext();
        if (e.key === 'ArrowLeft') showPrev();
    });
})();