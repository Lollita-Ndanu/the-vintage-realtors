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

/* =========================================
   4. CONTACT FORM HANDLING
   ========================================= */
(function() {
    const contactForm = document.querySelector('.form-contact');
    if (!contactForm) return;

    const submitBtn = contactForm.querySelector('button[type="submit"]');
    if (!submitBtn) return;

    let isSubmitting = false;

    function createStatusMessage(form, message, isError = false) {
        let statusEl = form.querySelector('.form-status-message');
        if (!statusEl) {
            statusEl = document.createElement('div');
            statusEl.className = 'form-status-message';
            statusEl.setAttribute('role', 'status');
            statusEl.setAttribute('aria-live', 'polite');
            const btnRow = form.querySelector('.form-row:last-child') || form.querySelector('button[type="submit"]').parentElement;
            btnRow.parentNode.insertBefore(statusEl, btnRow.nextSibling);
        }
        statusEl.textContent = message;
        statusEl.className = `form-status-message ${isError ? 'error' : 'success'}`;
        statusEl.style.display = 'block';
        return statusEl;
    }

    function clearStatusMessage(form) {
        const statusEl = form.querySelector('.form-status-message');
        if (statusEl) {
            statusEl.style.display = 'none';
            statusEl.textContent = '';
        }
    }

    function setButtonState(btn, disabled, text) {
        btn.disabled = disabled;
        if (text) btn.textContent = text;
    }

    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(String(email).toLowerCase());
    }

    contactForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        if (isSubmitting) return;

        clearStatusMessage(contactForm);

        const nameInput = contactForm.querySelector('#name');
        const emailInput = contactForm.querySelector('#email');
        const phoneInput = contactForm.querySelector('#phone');
        const messageInput = contactForm.querySelector('#message');

        const name = nameInput ? nameInput.value.trim() : '';
        const email = emailInput ? emailInput.value.trim() : '';
        const phone = phoneInput ? phoneInput.value.trim() : '';
        const message = messageInput ? messageInput.value.trim() : '';

        if (!name) {
            createStatusMessage(contactForm, 'Please enter your name.', true);
            if (nameInput) nameInput.focus();
            return;
        }

        if (!email) {
            createStatusMessage(contactForm, 'Please enter your email address.', true);
            if (emailInput) emailInput.focus();
            return;
        }

        if (!validateEmail(email)) {
            createStatusMessage(contactForm, 'Please enter a valid email address.', true);
            if (emailInput) emailInput.focus();
            return;
        }

        if (!message) {
            createStatusMessage(contactForm, 'Please enter your message.', true);
            if (messageInput) messageInput.focus();
            return;
        }

        isSubmitting = true;
        const originalBtnText = submitBtn.textContent;
        setButtonState(submitBtn, true, 'Sending...');

        try {
            let result = null;
            let usedFallback = false;

            try {
                const response = await fetch('/api/contact', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: name,
                        email: email,
                        phone: phone,
                        message: message
                    })
                });

                const data = await response.json();
                
                if (response.ok && data.success) {
                    result = data;
                } else if (response.status === 429) {
                    throw new Error('Too many requests. Please wait a minute and try again.');
                } else if (response.status === 400 && data.details) {
                    throw new Error(data.details.join('. '));
                } else if (!response.ok) {
                    throw new Error(data.error || 'Server error. Please try again.');
                }
            } catch (apiError) {
                console.warn('API endpoint failed, attempting fallback:', apiError.message);
                
                if (window.TVR && window.TVR.db) {
                    result = await window.TVR.db.submitContact({
                        name: name,
                        email: email,
                        phone: phone,
                        message: message
                    });
                    usedFallback = true;
                } else {
                    throw apiError;
                }
            }

            if (result && result.success) {
                const successMsg = usedFallback 
                    ? 'Thank you! Your message has been saved. We will get back to you soon.'
                    : 'Thank you! Your message has been sent. We will get back to you soon.';
                createStatusMessage(contactForm, successMsg);
                contactForm.reset();
                setButtonState(submitBtn, true, 'Sent');
                
                setTimeout(() => {
                    setButtonState(submitBtn, false, originalBtnText);
                }, 3000);
            } else {
                createStatusMessage(contactForm, (result && result.error) || 'Failed to send message. Please try again.', true);
                setButtonState(submitBtn, false, originalBtnText);
            }
        } catch (error) {
            console.error('Contact form error:', error);
            createStatusMessage(contactForm, error.message || 'An error occurred. Please try again later.', true);
            setButtonState(submitBtn, false, originalBtnText);
        } finally {
            isSubmitting = false;
        }
    });
})();

/* =========================================
   5. NEWSLETTER FORM HANDLING (Contact Page)
   ========================================= */
(function() {
    const subscribeForm = document.getElementById('subscribeForm');
    if (!subscribeForm) return;

    const submitBtn = subscribeForm.querySelector('button[type="submit"]');
    const msgEl = document.getElementById('subscribeMessage');
    if (!submitBtn) return;

    let isSubmitting = false;

    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(String(email).toLowerCase());
    }

    subscribeForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        if (isSubmitting) return;

        const nameInput = subscribeForm.querySelector('#sub_name');
        const emailInput = subscribeForm.querySelector('#sub_email');

        const name = nameInput ? nameInput.value.trim() : '';
        const email = emailInput ? emailInput.value.trim() : '';

        if (!email || !validateEmail(email)) {
            if (msgEl) {
                msgEl.textContent = 'Please enter a valid email address.';
                msgEl.style.color = 'crimson';
            }
            if (emailInput) emailInput.focus();
            return;
        }

        isSubmitting = true;
        const originalBtnText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Subscribing...';

        try {
            if (!window.TVR || !window.TVR.db) {
                throw new Error('Database connection not available.');
            }

            const result = await window.TVR.db.subscribe({
                name: name || 'Subscriber',
                email: email
            });

            if (result.success) {
                if (msgEl) {
                    msgEl.textContent = result.message || 'Thank you! Check your inbox for confirmation.';
                    msgEl.style.color = '';
                }
                subscribeForm.reset();
                submitBtn.textContent = 'Subscribed';
                submitBtn.classList.add('subscribed');
                
                setTimeout(() => {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalBtnText;
                    submitBtn.classList.remove('subscribed');
                    if (msgEl) msgEl.textContent = '';
                }, 5000);
            } else {
                if (msgEl) {
                    msgEl.textContent = result.error || 'Failed to subscribe. Please try again.';
                    msgEl.style.color = 'crimson';
                }
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
        } catch (error) {
            console.error('Newsletter subscription error:', error);
            if (msgEl) {
                msgEl.textContent = error.message || 'An error occurred. Please try again.';
                msgEl.style.color = 'crimson';
            }
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        } finally {
            isSubmitting = false;
        }
    });
})();