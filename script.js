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
