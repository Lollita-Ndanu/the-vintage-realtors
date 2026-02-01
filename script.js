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

// Footer reveal on scroll: add 'in-view' when footer enters viewport
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

function closeMenu() {
    menu.classList.remove('open');
    menu.setAttribute('aria-hidden', 'true');
    if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
    if (menuOverlay) menuOverlay.classList.remove('active');
}

if (hamburger && menu) {
    hamburger.addEventListener('click', openMenu);

    if (closeBtn) closeBtn.addEventListener('click', closeMenu);

    // clicking the dim overlay closes the drawer
    if (menuOverlay) menuOverlay.addEventListener('click', closeMenu);

    // close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && menu.classList.contains('open')) closeMenu();
    });

    // clicking anywhere outside the drawer also closes it (safety for non-overlay clicks)
    document.addEventListener('click', (e) => {
        if (!menu.classList.contains('open')) return;
        const target = e.target;
        if (!menu.contains(target) && !hamburger.contains(target)) {
            closeMenu();
        }
    });
}

/* Lightbox gallery behavior for collaborators page */
(function(){
    const galleryImgs = Array.from(document.querySelectorAll('.gallery-grid .photo img'));
    const lightbox = document.getElementById('lightbox');
    if (!galleryImgs.length || !lightbox) return;

    const lbImg = lightbox.querySelector('.lightbox-content img');
    const closeBtn = lightbox.querySelector('.lightbox-close');
    const prevBtn = lightbox.querySelector('.lightbox-prev');
    const nextBtn = lightbox.querySelector('.lightbox-next');

    // Normalize a higher-res URL when possible (Unsplash pattern)
    function largeSrc(src){
        try {
            return src.replace(/\/\d+x\d+\//, '/1200x800/');
        } catch (e) { return src; }
    }

    const images = galleryImgs.map(img => ({ el: img, src: img.getAttribute('data-large') || largeSrc(img.src), alt: img.alt || '' }));
    let current = 0;

    function open(index){
        current = index;
        lbImg.src = images[current].src;
        lbImg.alt = images[current].alt;
        lightbox.classList.add('open');
        lightbox.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        // focus close for keyboard users
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

    // click outside image closes
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) close();
    });

    // keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('open')) return;
        if (e.key === 'Escape') close();
        if (e.key === 'ArrowRight') showNext();
        if (e.key === 'ArrowLeft') showPrev();

        async function loadProperties() {
    const propertyContainer = document.getElementById('propertySlider');
    if (!propertyContainer) return;

    try {
        // 1. Fetch the master list of filenames
        const indexResponse = await fetch('/properties/index.json');
        const indexData = await indexResponse.json();
        const propertyFiles = indexData.all; // This is now your automatic list!

        propertyContainer.innerHTML = ''; 

        for (const property of propertyFiles) {
            const file = property.filename;
            const response = await fetch(`/properties/${file}`);
            const text = await response.text();

            // Extract the data (including the full description)
            const title = text.match(/title: (.*)/)?.[1];
            const price = text.match(/price: (.*)/)?.[1];
            const location = text.match(/location: (.*)/)?.[1];
            const image = text.match(/image: (.*)/)?.[1];
            const bedrooms = text.match(/bedrooms: (.*)/)?.[1];
            const bathrooms = text.match(/bathrooms: (.*)/)?.[1];
            const description = text.split('---').pop().trim();

            const card = document.createElement('div');
            card.className = 'property-card';
            card.innerHTML = `
                <div class="property-image"><img src="${image}" alt="${title}"></div>
                <div class="property-details">
                    <p class="property-price">${price}</p>
                    <h3>${title}</h3>
                    <p class="property-location">${location}</p>
                    <p class="property-desc-short">${description.substring(0, 100)}...</p>
                    <div class="property-meta">
                        <span>🛏 ${bedrooms} Beds</span> <span>🛁 ${bathrooms} Baths</span>
                    </div>
                </div>
            `;
            propertyContainer.appendChild(card);
        }
    } catch (error) {
        console.error("The website couldn't find the new properties:", error);
    }
}

    // ... previous lightbox code ...
        if (e.key === 'ArrowLeft') showPrev();
    }); // Closes the keydown listener
})(); // Closes the Lightbox IIFE

/* --- PROPERTIES FETCH SECTION --- */
async function loadProperties() {
    const propertyContainer = document.getElementById('propertySlider');
    if (!propertyContainer) return;

    try {
        const indexResponse = await fetch('/admin/properties/index.json');
        const indexData = await indexResponse.json();
        const propertyFiles = indexData.all; 

        propertyContainer.innerHTML = ''; 

        for (const property of propertyFiles) {
            const file = property.filename;
            const response = await fetch(`/admin/properties/${file}`);
            const text = await response.text();

            const title = text.match(/title: (.*)/)?.[1];
            const price = text.match(/price: (.*)/)?.[1];
            const location = text.match(/location: (.*)/)?.[1];
            const image = text.match(/image: (.*)/)?.[1];
            const bedrooms = text.match(/bedrooms: (.*)/)?.[1];
            const bathrooms = text.match(/bathrooms: (.*)/)?.[1];
            const description = text.split('---').pop().trim();

            const card = document.createElement('div');
            card.className = 'property-card';
            card.innerHTML = `
                <div class="property-image"><img src="${image}" alt="${title}"></div>
                <div class="property-details">
                    <p class="property-price">${price}</p>
                    <h3>${title}</h3>
                    <p class="property-location">${location}</p>
                    <p class="property-desc-short">${description.substring(0, 100)}...</p>
                    <div class="property-meta">
                        <span>🛏 ${bedrooms} Beds</span> <span>🛁 ${bathrooms} Baths</span>
                    </div>
                </div>
            `;
            propertyContainer.appendChild(card);
        }
    } catch (error) {
        console.error("The website couldn't find the new properties:", error);
    }
}

// Ensure the function runs when the page is ready
document.addEventListener('DOMContentLoaded', loadProperties);
