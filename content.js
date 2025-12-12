let isRunning = false;
let actionCount = 0;
let stats = {
    likeCount: 0,
    commentCount: 0,
    friendCount: 0
};
let accountSwitchTimer = null;
let currentAccountIndex = 0;
let accounts = [];
let accountStartTime = null;
// Track processed posts to avoid duplicates
let processedPosts = new Set();

// Random delay to simulate human behavior
function randomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Close popups automatically
function closePopups(silent = false) {
    try {
        // Don't close popups when switching account (let logout process handle it)
        if (isSwitchingAccount) {
            return false;
        }
        
        // Try multiple selectors for close button
        const closeSelectors = [
            '[aria-label*="Close"]',
            '[aria-label*="Đóng"]',
            '[aria-label*="close"]',
            'div[role="button"][aria-label*="Close"]',
            'div[role="button"][aria-label*="Đóng"]',
            'div[aria-label="Close"]',
            'div[aria-label="Đóng"]',
            'button[aria-label*="Close"]',
            'button[aria-label*="Đóng"]',
            // Facebook specific close buttons
            'div[role="dialog"] div[role="button"]:last-child',
            'div[role="dialog"] svg[aria-label*="Close"]',
            'div[role="dialog"] svg[aria-label*="Đóng"]'
        ];
        
        // Find and click close button in dialogs/popups
        const dialogs = document.querySelectorAll('div[role="dialog"], div[role="presentation"]');
        for (const dialog of dialogs) {
            // Check if dialog is visible
            if (dialog.offsetParent === null) continue;
            
            // Try to find close button within dialog
            for (const selector of closeSelectors) {
                try {
                    const closeBtn = dialog.querySelector(selector);
                    if (closeBtn && closeBtn.offsetParent !== null) {
                        closeBtn.click();
                        if (!silent) {
                            sendLog('🔒 Đã đóng popup', 'info');
                        }
                        return true;
                    }
                } catch (e) {
                    continue;
                }
            }
            
            // Alternative: look for X button (usually in top-right corner)
            const buttons = dialog.querySelectorAll('div[role="button"], button, span[role="button"]');
            for (const btn of buttons) {
                if (btn.offsetParent === null) continue;
                
                // Check if button is in top-right area of dialog
                const rect = btn.getBoundingClientRect();
                const dialogRect = dialog.getBoundingClientRect();
                const isTopRight = rect.top < dialogRect.top + 50 && rect.right > dialogRect.right - 50;
                
                // Check if it looks like a close button (has X or close icon)
                const hasCloseIcon = btn.querySelector('svg[aria-label*="Close"], svg[aria-label*="Đóng"], svg path[d*="M"]');
                const text = (btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase();
                const isCloseText = text.includes('close') || text.includes('đóng') || text === '×' || text === '✕';
                
                if ((isTopRight || hasCloseIcon || isCloseText) && btn.offsetParent !== null) {
                    try {
                        btn.click();
                        if (!silent) {
                            sendLog('🔒 Đã đóng popup (X button)', 'info');
                        }
                        return true;
                    } catch (e) {
                        continue;
                    }
                }
            }
        }
        
        // Alternative: Click outside to close (press Escape key)
        try {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
            document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', keyCode: 27, bubbles: true }));
            return true;
        } catch (e) {
            // Ignore
        }
        
        return false;
    } catch (error) {
        // Silently fail - don't log errors for popup closing
        return false;
    }
}

// Monitor and auto-close popups using MutationObserver
let popupObserver = null;

function startPopupWatcher() {
    if (popupObserver) return; // Already watching
    
    popupObserver = new MutationObserver((mutations) => {
        // Check for new popups every 500ms
        setTimeout(() => {
            // Don't close popups when switching account or not running
            if (isRunning && !isSwitchingAccount) {
                closePopups(true); // Silent mode to reduce log spam
            }
        }, 100);
    });
    
    popupObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'aria-hidden']
    });
}

function stopPopupWatcher() {
    if (popupObserver) {
        popupObserver.disconnect();
        popupObserver = null;
    }
}

// Scroll page
function scrollPage() {
    window.scrollBy({
        top: window.innerHeight * 0.8,
        behavior: 'smooth'
    });
    sendLog('📜 Đang lướt trang...', 'info');
}

// Helper: Check if element is visible in viewport
function isElementVisible(element) {
    if (!element || element.offsetParent === null) return false;
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    
    // Check if element is within viewport (with some margin)
    return (
        rect.top >= -100 && // Allow some margin above
        rect.left >= -100 &&
        rect.bottom <= viewportHeight + 100 && // Allow some margin below
        rect.right <= viewportWidth + 100
    );
}

// Find and click like button (like hàng loạt)
function likePost() {
    try {
        // Try multiple selectors for like button
        const likeSelectors = [
            '[aria-label*="Like"]',
            '[aria-label*="Thích"]',
            'div[role="button"][aria-label*="Like"]',
            'div[role="button"][aria-label*="Thích"]',
            'a[href*="/reactions/picker"]'
        ];
        
        // Find all articles (including video posts)
        const allArticles = document.querySelectorAll('article, div[role="article"], div[data-pagelet*="FeedUnit"]');
        const visibleArticles = [];
        
        // Filter to only visible articles in viewport
        for (const article of allArticles) {
            if (isElementVisible(article)) {
                visibleArticles.push(article);
            }
        }
        
        if (visibleArticles.length === 0) {
            sendLog('⚠️ Không tìm thấy bài viết nào trong viewport', 'warning');
            return false;
        }
        
        let likedCount = 0;
        const maxLikesPerCall = Math.min(visibleArticles.length, 5); // Like tối đa 5 bài visible cùng lúc
        
        sendLog(`🔍 Tìm thấy ${visibleArticles.length} bài viết visible, đang like ${maxLikesPerCall} bài...`, 'info');
        
        // Like multiple posts in batch
        for (let i = 0; i < maxLikesPerCall; i++) {
            const article = visibleArticles[i];
            
            // Get article ID to track processed posts
            const articleId = article.getAttribute('data-pagelet') || 
                            article.getAttribute('id') || 
                            Array.from(article.querySelectorAll('a[href*="/posts/"], a[href*="/permalink/"], a[href*="/videos/"]'))[0]?.href || 
                            article.textContent.substring(0, 50);
            
            // Skip if already processed
            if (processedPosts.has(articleId + '_like')) continue;
            
            // Check if already liked
            const alreadyLiked = article.querySelector('[aria-label*="Unlike"], [aria-label*="Bỏ thích"], [aria-label*="Liked"], [aria-label*="Đã thích"]');
            if (alreadyLiked) {
                processedPosts.add(articleId + '_like');
                continue;
            }
            
            // Try to find like button
            let liked = false;
            for (const selector of likeSelectors) {
                try {
                    const likeButton = article.querySelector(selector);
                    if (likeButton && likeButton.offsetParent !== null) {
                        // Click with small delay between likes
                        setTimeout(() => {
                            likeButton.click();
                        }, i * 200); // Stagger clicks by 200ms
                        
                        processedPosts.add(articleId + '_like');
                        stats.likeCount++;
                        likedCount++;
                        liked = true;
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }
            
            if (liked) {
                sendLog(`❤️ Đã like bài viết ${likedCount}/${maxLikesPerCall} (Tổng: ${stats.likeCount})`, 'success');
            }
        }
        
        // Update stats after batch
        if (likedCount > 0) {
            updateStats();
            // Auto close popups after batch
            setTimeout(() => closePopups(), 500);
            
            // Check if there are more unliked posts in viewport
            let hasMoreUnliked = false;
            for (const article of visibleArticles) {
                const articleId = article.getAttribute('data-pagelet') || 
                                article.getAttribute('id') || 
                                Array.from(article.querySelectorAll('a[href*="/posts/"], a[href*="/permalink/"], a[href*="/videos/"]'))[0]?.href || 
                                article.textContent.substring(0, 50);
                
                if (processedPosts.has(articleId + '_like')) continue;
                
                const alreadyLiked = article.querySelector('[aria-label*="Unlike"], [aria-label*="Bỏ thích"], [aria-label*="Liked"], [aria-label*="Đã thích"]');
                if (!alreadyLiked) {
                    hasMoreUnliked = true;
                    break;
                }
            }
            
            // Return object with liked status and hasMore flag
            return { liked: true, hasMore: hasMoreUnliked };
        }
        
        // Fallback: find by text content in visible buttons
        const allButtons = Array.from(document.querySelectorAll('div[role="button"], span[role="button"], a[role="button"]'));
        for (const btn of allButtons) {
            if (!isElementVisible(btn)) continue;
            
            const text = (btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase();
            if ((text.includes('like') || text.includes('thích')) && 
                !text.includes('unlike') && !text.includes('bỏ thích') &&
                !text.includes('liked') && !text.includes('đã thích')) {
                try {
                    const article = btn.closest('article, div[role="article"]');
                    if (article) {
                        const articleId = article.getAttribute('data-pagelet') || article.getAttribute('id') || article.textContent.substring(0, 50);
                        if (processedPosts.has(articleId + '_like')) continue;
                        processedPosts.add(articleId + '_like');
                    }
                    
                    btn.click();
                    stats.likeCount++;
                    updateStats();
                    sendLog(`❤️ Đã like bài viết (Tổng: ${stats.likeCount})`, 'success');
                    setTimeout(() => closePopups(), 300);
                    return { liked: true, hasMore: false };
                } catch (e) {
                    continue;
                }
            }
        }
        
        if (likedCount === 0) {
            sendLog('⚠️ Không tìm thấy bài viết mới để like trong viewport', 'warning');
        }
        return { liked: false, hasMore: false };
    } catch (error) {
        sendLog('❌ Lỗi khi like: ' + error.message, 'error');
        return false;
    }
}

// Comment on post (returns Promise) - Batch processing (smarter & more reliable for Facebook)
function commentPost(commentText) {
    const preview = `${commentText.substring(0, 30)}${commentText.length > 30 ? '...' : ''}`;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    const getArticleId = (article) => (
        article.getAttribute('data-pagelet') ||
        article.getAttribute('id') ||
        Array.from(article.querySelectorAll('a[href*="/posts/"], a[href*="/permalink/"], a[href*="/videos/"]'))[0]?.href ||
        article.textContent.substring(0, 50)
    );

    const isCommentComposer = (el) => {
        if (!el || el.offsetParent === null) return false;
        const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
        const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
        const dataTestId = (el.getAttribute('data-testid') || '').toLowerCase();

        // Exclude search
        if (
            placeholder.includes('search') || placeholder.includes('tìm kiếm') ||
            ariaLabel.includes('search') || ariaLabel.includes('tìm kiếm') ||
            dataTestId.includes('search')
        ) return false;

        const hay = `${placeholder} ${ariaLabel} ${dataTestId}`;
        return (
            hay.includes('write a comment') ||
            hay.includes('add a comment') ||
            hay.includes('comment') ||
            hay.includes('bình luận') ||
            hay.includes('viết')
        );
    };

    const distanceScore = (aRect, bRect) => {
        // Prefer below-article and close horizontally
        const dy = Math.max(0, bRect.top - aRect.bottom);
        const dx = Math.abs((bRect.left + bRect.right) / 2 - (aRect.left + aRect.right) / 2);
        return dy * 1.0 + dx * 0.5;
    };

    const findCommentButtonNear = (article) => {
        const aRect = article.getBoundingClientRect();
        const candidates = Array.from(document.querySelectorAll('div[role="button"], a[role="button"], button, span[role="button"]'))
            .filter(el => el && el.offsetParent !== null);

        let best = null;
        let bestScore = Infinity;

        for (const el of candidates) {
            const rect = el.getBoundingClientRect();
            const near =
                rect.bottom > aRect.top - 100 &&
                rect.top < aRect.bottom + 600 &&
                Math.abs(rect.left - aRect.left) < 450;
            if (!near) continue;

            const text = (el.textContent || '').trim().toLowerCase();
            const aria = (el.getAttribute('aria-label') || '').trim().toLowerCase();
            const combined = `${text} ${aria}`;

            // Must look like comment action, not a count
            const looksLikeComment =
                combined === 'bình luận' ||
                combined === 'comment' ||
                combined.includes('bình luận') ||
                combined.includes('comment');

            if (!looksLikeComment) continue;
            if (/\d+/.test(text) && (text.includes('bình luận') || text.includes('comment'))) continue;

            const s = distanceScore(aRect, rect);
            if (s < bestScore) {
                best = el;
                bestScore = s;
            }
        }
        return best;
    };

    const findComposerForArticle = (article) => {
        const aRect = article.getBoundingClientRect();

        // 1) Search inside article
        const inArticle = Array.from(article.querySelectorAll('div[contenteditable="true"], textarea, div[role="textbox"][contenteditable="true"]'))
            .filter(isCommentComposer);
        if (inArticle.length > 0) return inArticle[0];

        // 2) Search near article in document
        const all = Array.from(document.querySelectorAll('div[contenteditable="true"], textarea, div[role="textbox"][contenteditable="true"]'))
            .filter(isCommentComposer);

        let best = null;
        let bestScore = Infinity;
        for (const el of all) {
            const rect = el.getBoundingClientRect();
            const near =
                rect.top > aRect.top - 100 &&
                rect.top < aRect.bottom + 1200 &&
                Math.abs(rect.left - aRect.left) < 500;
            if (!near) continue;
            const s = distanceScore(aRect, rect);
            if (s < bestScore) {
                best = el;
                bestScore = s;
            }
        }
        return best;
    };

    const setNativeValue = (element, value) => {
        const { set } = Object.getOwnPropertyDescriptor(element.__proto__, 'value') || {};
        if (set) set.call(element, value);
        else element.value = value;
    };

    const typeInto = (el, text) => {
        el.focus();
        try { el.click(); } catch (_) {}

        if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
            // Prefer execCommand so FB/React detects input
            try {
                document.execCommand('selectAll', false, null);
                document.execCommand('insertText', false, text);
            } catch (_) {
                el.textContent = text;
            }
            el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: text, inputType: 'insertText' }));
        } else {
            setNativeValue(el, text);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }
    };

    const findSubmitButton = (composer, article) => {
        const cRect = composer.getBoundingClientRect();
        const root = composer.closest('form') || composer.closest('[role="dialog"]') || article;
        const candidates = Array.from(root.querySelectorAll('div[role="button"], button, a[role="button"], span[role="button"]'))
            .filter(el => el && el.offsetParent !== null);

        const keywords = ['đăng', 'post', 'send', 'gửi', 'bình luận', 'comment'];
        let best = null;
        let bestScore = Infinity;

        for (const el of candidates) {
            const aria = (el.getAttribute('aria-label') || '').toLowerCase();
            const text = (el.textContent || '').toLowerCase();
            const combined = `${aria} ${text}`;

            if (!keywords.some(k => combined.includes(k))) continue;
            // Avoid picking random icon buttons (emoji/gif/attach)
            if (combined.includes('emoji') || combined.includes('gif') || combined.includes('sticker') || combined.includes('ảnh') || combined.includes('file')) continue;

            const rect = el.getBoundingClientRect();
            const near =
                Math.abs(rect.top - cRect.top) < 250 ||
                (rect.top > cRect.top - 50 && rect.top < cRect.bottom + 250);
            if (!near) continue;

            const s = distanceScore(cRect, rect);
            if (s < bestScore) {
                best = el;
                bestScore = s;
            }
        }
        return best;
    };

    const submitByEnterFallback = (composer) => {
        try {
            composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
            composer.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
            return true;
        } catch (_) {
            return false;
        }
    };

    const commentOne = async (article, text) => {
        const articleId = getArticleId(article);
        if (processedPosts.has(articleId + '_comment')) return false;

        // Try open comment area
        const commentBtn = findCommentButtonNear(article);
        if (commentBtn) {
            try { commentBtn.click(); } catch (_) {}
            await sleep(700);
        }

        let composer = findComposerForArticle(article);
        if (!composer) {
            // Try clicking any “Viết bình luận/Write a comment” hint inside article
            const hint = Array.from(article.querySelectorAll('span, div, a'))
                .find(el => el.offsetParent !== null && /viết bình luận|write a comment|add a comment|bình luận|comment/i.test(el.textContent || ''));
            if (hint) {
                try { hint.click(); } catch (_) {}
                await sleep(700);
                composer = findComposerForArticle(article);
            }
        }

        if (!composer) {
            sendLog('⚠️ Không tìm thấy ô comment cho bài này', 'warning');
            processedPosts.add(articleId + '_comment'); // avoid getting stuck on same post
            return false;
        }

        try {
            composer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (_) {}
        await sleep(300);

        // Type
        try {
            typeInto(composer, text);
        } catch (e) {
            sendLog('❌ Lỗi khi nhập comment: ' + e.message, 'error');
            return false;
        }

        await sleep(600);

        // Submit
        const submitBtn = findSubmitButton(composer, article);
        let submitted = false;
        if (submitBtn) {
            try {
                submitBtn.click();
                submitted = true;
            } catch (_) {}
        }
        if (!submitted) {
            submitted = submitByEnterFallback(composer);
        }

        if (submitted) {
            processedPosts.add(articleId + '_comment');
            stats.commentCount++;
            updateStats();
            sendLog(`💬 Đã comment: "${preview}" (Tổng: ${stats.commentCount})`, 'success');
            setTimeout(() => closePopups(true), 500);
            return true;
        }

        sendLog('⚠️ Không thể submit comment (không thấy nút Đăng/Gửi)', 'warning');
        processedPosts.add(articleId + '_comment'); // avoid infinite retry
        return false;
    };

    return new Promise(async (resolve) => {
        try {
            sendLog(`💬 Đang comment hàng loạt: "${preview}"`, 'info');

            const allArticles = document.querySelectorAll('article, div[role="article"], div[data-pagelet*="FeedUnit"]');
            const visible = Array.from(allArticles).filter(isElementVisible);
            if (visible.length === 0) {
                sendLog('⚠️ Không có bài viết nào visible để comment', 'warning');
                resolve(false);
                return;
            }

            const max = Math.min(visible.length, 3);
            let ok = 0;
            for (let i = 0; i < max; i++) {
                const success = await commentOne(visible[i], commentText.trim());
                if (success) ok++;
                await sleep(1200);
            }

            resolve(ok > 0);
        } catch (error) {
            sendLog('❌ Lỗi khi comment: ' + error.message, 'error');
            resolve(false);
        }
    });
}

// Search and add friend (returns Promise)
function searchAndAddFriend(keyword) {
    return new Promise((resolve) => {
        sendLog(`🔍 Đang tìm kiếm: "${keyword}"`, 'info');
        
        // Open search
        const searchSelectors = [
            'input[placeholder*="Search"]',
            'input[placeholder*="Tìm kiếm"]',
            'input[type="search"]',
            'input[aria-label*="Search"]',
            'input[aria-label*="Tìm kiếm"]'
        ];
        
        let searchBox = null;
        for (const selector of searchSelectors) {
            searchBox = document.querySelector(selector);
            if (searchBox && searchBox.offsetParent !== null) break;
        }
        
        if (searchBox) {
            try {
                searchBox.focus();
                searchBox.value = keyword;
                searchBox.dispatchEvent(new Event('input', { bubbles: true }));
                searchBox.dispatchEvent(new Event('change', { bubbles: true }));
                searchBox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                
                // Wait for results and click add friend
                setTimeout(() => {
                    const addFriendSelectors = [
                        'div[aria-label*="Add Friend"]',
                        'div[aria-label*="Thêm bạn"]',
                        'span[aria-label*="Add Friend"]',
                        'span[aria-label*="Thêm bạn"]',
                        'div[role="button"][aria-label*="Add Friend"]',
                        'div[role="button"][aria-label*="Thêm bạn"]'
                    ];
                    
                    let found = false;
                    for (const selector of addFriendSelectors) {
                        const addBtn = document.querySelector(selector);
                        if (addBtn && addBtn.offsetParent !== null && !found) {
                            addBtn.click();
                            stats.friendCount++;
                            updateStats();
                            sendLog(`👥 Đã gửi lời mời kết bạn: "${keyword}" (Tổng: ${stats.friendCount})`, 'success');
                            found = true;
                            resolve(true);
                            return;
                        }
                    }
                    if (!found) {
                        sendLog('⚠️ Không tìm thấy nút kết bạn', 'warning');
                        resolve(false);
                    }
                }, 2500);
            } catch (e) {
                sendLog('❌ Lỗi khi tìm kiếm: ' + e.message, 'error');
                resolve(false);
            }
        } else {
            sendLog('❌ Không tìm thấy ô tìm kiếm', 'error');
            resolve(false);
        }
    });
}

// Login to Facebook
function loginToFacebook(email, password, forceLogin = false) {
    return new Promise((resolve) => {
        sendLog(`🔐 Đang đăng nhập với: ${email.substring(0, 20)}...`, 'info');

        // Close popups that may block the login form (cookie dialogs, etc.)
        try { closePopups(true); } catch (_) {}

        // Hard timeout guard (extra safety in case outer caller doesn't wrap)
        let hardTimeoutId = setTimeout(() => {
            sendLog('⚠️ Timeout đăng nhập (45s). Có thể Facebook đang checkpoint/2FA/captcha.', 'warning');
            resolve(false);
        }, 45000);

        const cleanupAndResolve = (value) => {
            if (hardTimeoutId) {
                clearTimeout(hardTimeoutId);
                hardTimeoutId = null;
            }
            resolve(value);
        };

        const setNativeValue = (element, value) => {
            try {
                const proto = Object.getPrototypeOf(element);
                const desc = Object.getOwnPropertyDescriptor(proto, 'value');
                if (desc && desc.set) desc.set.call(element, value);
                else element.value = value;
            } catch (_) {
                element.value = value;
            }
        };
        
        // Check if already logged in
        const loggedInIndicators = [
            'input[placeholder*="Search"]',
            'div[aria-label*="Home"]',
            'a[href*="/home"]',
            'div[role="navigation"]'
        ];
        
        let isLoggedIn = false;
        for (const selector of loggedInIndicators) {
            if (document.querySelector(selector)) {
                isLoggedIn = true;
                break;
            }
        }
        
        // If already logged in and not forcing login, check if we're on login page
        if (isLoggedIn && !forceLogin && !document.querySelector('input[type="email"], input[name="email"]')) {
            sendLog('✅ Đã đăng nhập sẵn', 'success');
            cleanupAndResolve(true);
            return;
        }
        
        // Helper function to perform actual login
        const performLogin = () => {
            // Find email input
            const emailSelectors = [
                'input[type="email"]',
                'input[name="email"]',
                'input[id*="email"]',
                'input[placeholder*="Email"]',
                'input[placeholder*="Phone"]'
            ];
            
            // Find password input
            const passwordSelectors = [
                'input[type="password"]',
                'input[name="pass"]',
                'input[id*="pass"]'
            ];
            
            // Find login button
            const loginButtonSelectors = [
                'button[type="submit"]',
                'button[name="login"]',
                'input[type="submit"]',
                'button[value*="Log"]'
            ];
            
            let emailInput = null;
            let passwordInput = null;
            let loginButton = null;
            
            // Find email input
            for (const selector of emailSelectors) {
                emailInput = document.querySelector(selector);
                if (emailInput && emailInput.offsetParent !== null) break;
            }
            
            // Find password input
            for (const selector of passwordSelectors) {
                passwordInput = document.querySelector(selector);
                if (passwordInput && passwordInput.offsetParent !== null) break;
            }
            
            // Find login button - try selectors first
            for (const selector of loginButtonSelectors) {
                const buttons = document.querySelectorAll(selector);
                for (const btn of buttons) {
                    if (btn.offsetParent !== null) {
                        const text = (btn.textContent || btn.value || btn.getAttribute('aria-label') || '').toLowerCase();
                        if (text.includes('log') || text.includes('đăng nhập') || selector.includes('submit')) {
                            loginButton = btn;
                            break;
                        }
                    }
                }
                if (loginButton) break;
            }
            
            // Fallback: find any submit button near the form
            if (!loginButton && emailInput && passwordInput) {
                const form = emailInput.closest('form') || passwordInput.closest('form');
                if (form) {
                    loginButton = form.querySelector('button[type="submit"], input[type="submit"]');
                }
            }
            
            if (!emailInput || !passwordInput) {
                sendLog('❌ Không tìm thấy form đăng nhập', 'error');
                cleanupAndResolve(false);
                return;
            }
            
            try {
                // Fill email
                emailInput.focus();
                setNativeValue(emailInput, email);
                emailInput.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: email, inputType: 'insertText' }));
                emailInput.dispatchEvent(new Event('change', { bubbles: true }));
                
                // Wait a bit
                setTimeout(() => {
                    // Fill password
                    passwordInput.focus();
                    setNativeValue(passwordInput, password);
                    passwordInput.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: password, inputType: 'insertText' }));
                    passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
                    
                    // Wait and click login
                    setTimeout(() => {
                        // Start checker (used for both click and Enter fallback)
                        const startLoginCheck = () => {
                            let checkCount = 0;
                            const maxChecks = 30; // 30 seconds max (1s interval)
                            const startedAt = Date.now();

                            // Progress log every ~5 seconds
                            const progressId = setInterval(() => {
                                const secs = Math.floor((Date.now() - startedAt) / 1000);
                                if (secs > 0 && secs % 5 === 0) {
                                    sendLog(`⏳ Đang chờ đăng nhập... (${secs}s)`, 'info');
                                }
                            }, 1000);

                            const checkLogin = setInterval(() => {
                                checkCount++;

                                // Detect checkpoint / captcha / 2FA pages
                                const href = (window.location.href || '').toLowerCase();
                                if (href.includes('checkpoint') || href.includes('two_factor') || href.includes('recover') || href.includes('captcha')) {
                                    clearInterval(checkLogin);
                                    clearInterval(progressId);
                                    sendLog('❌ Facebook yêu cầu xác minh (checkpoint/2FA/captcha). Không thể tự động đăng nhập.', 'error');
                                    cleanupAndResolve(false);
                                    return;
                                }

                                let loggedIn = false;
                                // Check for logged in indicators (and ensure login inputs are gone)
                                for (const selector of loggedInIndicators) {
                                    const element = document.querySelector(selector);
                                    if (element && !document.querySelector('input[type="email"], input[name="email"], input[name="pass"], input[type="password"]')) {
                                        loggedIn = true;
                                        break;
                                    }
                                }

                                // Check for error messages
                                const errorElements = document.querySelectorAll('div[role="alert"], .error, [data-testid*="error"], div[id*="error"]');
                                let hasError = false;
                                for (const err of errorElements) {
                                    const text = (err.textContent || '').toLowerCase();
                                    if (text.includes('incorrect') || text.includes('wrong') || text.includes('sai') || text.includes('không đúng') || text.includes('mật khẩu') || text.includes('password')) {
                                        hasError = true;
                                        break;
                                    }
                                }

                                if (loggedIn) {
                                    clearInterval(checkLogin);
                                    clearInterval(progressId);
                                    sendLog(`✅ Đăng nhập thành công: ${email}`, 'success');
                                    chrome.runtime.sendMessage({
                                        type: 'currentAccount',
                                        account: email
                                    }).catch(() => {});
                                    cleanupAndResolve(true);
                                } else if (hasError || checkCount >= maxChecks) {
                                    clearInterval(checkLogin);
                                    clearInterval(progressId);
                                    if (hasError) {
                                        sendLog('❌ Đăng nhập thất bại: Sai email hoặc password / bị Facebook chặn', 'error');
                                    } else {
                                        sendLog('⚠️ Timeout đăng nhập (30s)', 'warning');
                                    }
                                    cleanupAndResolve(false);
                                }
                            }, 1000);
                        };

                        if (loginButton) {
                            loginButton.click();
                            sendLog('⏳ Đang xử lý đăng nhập...', 'info');
                            startLoginCheck();
                        } else {
                            // Try Enter key
                            passwordInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                            sendLog('⏳ Đang xử lý đăng nhập...', 'info');
                            startLoginCheck(); // Verify login instead of resolving true blindly
                        }
                    }, 500);
                }, 500);
            } catch (error) {
                sendLog('❌ Lỗi khi đăng nhập: ' + error.message, 'error');
                cleanupAndResolve(false);
            }
        };
        
        // If forcing login and already logged in, navigate to login page first
        if (forceLogin && isLoggedIn) {
            sendLog('🔄 Đang chuyển đến trang đăng nhập để đăng nhập tài khoản mới...', 'info');
            chrome.runtime.sendMessage({ type: 'navigate', url: 'https://www.facebook.com/login' });
            // Wait for page to load, then perform login
            setTimeout(performLogin, 3000);
        } else {
            // Call immediately
            performLogin();
        }
    });
}

// Logout from Facebook
function logoutFromFacebook() {
    return new Promise((resolve) => {
        sendLog('🚪 Đang đăng xuất...', 'info');
        
        // Method 1: Try to find and click logout button in account menu
        const accountMenuSelectors = [
            'div[aria-label*="Account"]',
            'div[aria-label*="Menu"]',
            'div[role="button"][aria-label*="Account"]',
            'div[aria-label*="Your profile"]',
            'div[aria-label*="Profile"]',
            'div[role="button"][aria-label*="Menu"]',
            'div[data-testid*="account"]',
            'div[data-testid*="menu"]'
        ];
        
        let menuOpened = false;
        
        // Try to open account menu
        for (const selector of accountMenuSelectors) {
            const menuBtn = document.querySelector(selector);
            if (menuBtn && menuBtn.offsetParent !== null) {
                try {
                    menuBtn.click();
                    menuOpened = true;
                    sendLog('🔍 Đã mở menu tài khoản, đang tìm nút đăng xuất...', 'info');
                    break;
                } catch (e) {
                    continue;
                }
            }
        }
        
        // Wait for menu to open, then look for logout
        setTimeout(() => {
            let logoutFound = false;
            
            // Look for logout link/button with various selectors
            const logoutTexts = ['log out', 'đăng xuất', 'logout', 'sign out', 'đăng xuất khỏi'];
            const allClickableElements = document.querySelectorAll('a, span, div[role="button"], div[role="menuitem"], div[role="link"], button');
            
            for (const element of allClickableElements) {
                if (element.offsetParent === null) continue;
                
                const text = (element.textContent || element.getAttribute('aria-label') || '').toLowerCase();
                const href = element.getAttribute('href') || '';
                
                // Check if it's a logout element
                const isLogout = logoutTexts.some(logoutText => text.includes(logoutText)) || 
                                href.includes('logout') || 
                                href.includes('logout.php');
                
                if (isLogout) {
                    try {
                        sendLog('✅ Tìm thấy nút đăng xuất, đang click...', 'info');
                        element.click();
                        logoutFound = true;
                        
                        // Wait for logout to complete
                        setTimeout(() => {
                            // Verify logout by checking if we're on login page or login form is visible
                            const loginFormVisible = document.querySelector('input[type="email"], input[name="email"]');
                            if (loginFormVisible || window.location.href.includes('login')) {
                                sendLog('✅ Đã đăng xuất thành công', 'success');
                                resolve(true);
                            } else {
                                // Force navigate to login page
                                sendLog('⚠️ Chưa thấy form đăng nhập, đang chuyển đến trang login...', 'warning');
                                chrome.runtime.sendMessage({ type: 'navigate', url: 'https://www.facebook.com/login' });
                                setTimeout(() => resolve(true), 3000);
                            }
                        }, 3000);
                        return;
                    } catch (e) {
                        continue;
                    }
                }
            }
            
            // If logout button not found, try direct logout URL
            if (!logoutFound) {
                sendLog('⚠️ Không tìm thấy nút đăng xuất, thử dùng URL logout...', 'warning');
                // Use Facebook's logout URL
                chrome.runtime.sendMessage({ type: 'navigate', url: 'https://www.facebook.com/logout.php' });
                
                // Wait and verify
                setTimeout(() => {
                    chrome.runtime.sendMessage({ type: 'navigate', url: 'https://www.facebook.com/login' });
                    setTimeout(() => {
                        const loginFormVisible = document.querySelector('input[type="email"], input[name="email"]');
                        if (loginFormVisible) {
                            sendLog('✅ Đã đăng xuất thành công (qua URL)', 'success');
                            resolve(true);
                        } else {
                            sendLog('⚠️ Đã chuyển đến trang login (có thể vẫn đang đăng nhập)', 'warning');
                            // Still resolve to continue, login function will handle it
                            resolve(true);
                        }
                    }, 2000);
                }, 2000);
            } else if (!menuOpened) {
                // If menu wasn't opened and logout not found, try direct URL
                sendLog('⚠️ Không thể mở menu, thử dùng URL logout...', 'warning');
                chrome.runtime.sendMessage({ type: 'navigate', url: 'https://www.facebook.com/logout.php' });
                setTimeout(() => {
                    chrome.runtime.sendMessage({ type: 'navigate', url: 'https://www.facebook.com/login' });
                    setTimeout(() => resolve(true), 2000);
                }, 2000);
            }
        }, menuOpened ? 1500 : 500);
    });
}

// Proxy management
let currentProxyIndex = 0;
let proxies = [];

function parseProxies(proxyText) {
    if (!proxyText || !proxyText.trim()) return [];
    
    const lines = proxyText.split('\n');
    const proxyList = [];
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        const parts = trimmed.split(':');
        if (parts.length >= 2) {
            const host = parts[0].trim();
            const portPart = parts[1].split('|')[0].split(':')[0].trim();
            const port = parseInt(portPart);
            
            if (host && port) {
                proxyList.push({
                    host: host,
                    port: port,
                    username: parts.length >= 3 ? parts[2].split('|')[0].trim() : '',
                    password: parts.length >= 4 ? parts[3].split('|')[0].trim() : '',
                    country: trimmed.includes('|') ? trimmed.split('|')[1].trim() : '',
                    string: `${host}:${port}${parts.length >= 3 ? ':' + parts.slice(2).join(':').split('|')[0] : ''}`
                });
            }
        }
    }
    
    return proxyList;
}

async function switchProxy(settings) {
    if (!settings.useProxy || proxies.length === 0) return;
    
    if (settings.rotateProxyPerAccount) {
        // Rotate to next proxy
        currentProxyIndex = (currentProxyIndex + 1) % proxies.length;
    }
    
    const proxy = proxies[currentProxyIndex];
    
    // Filter by preferred country if set
    if (settings.preferredCountry) {
        const countryProxies = proxies.filter(p => 
            p.country && p.country.toUpperCase() === settings.preferredCountry.toUpperCase()
        );
        if (countryProxies.length > 0) {
            const randomProxy = countryProxies[Math.floor(Math.random() * countryProxies.length)];
            sendLog(`🌐 Đổi proxy: ${randomProxy.host}:${randomProxy.port} (${randomProxy.country || 'N/A'})`, 'info');
            
            // Set proxy via background script
            chrome.runtime.sendMessage({
                type: 'setProxy',
                proxyString: randomProxy.string
            }).catch(() => {});
            return;
        }
    }
    
    sendLog(`🌐 Đổi proxy: ${proxy.host}:${proxy.port} (${proxy.country || 'N/A'})`, 'info');
    
    // Set proxy via background script
    chrome.runtime.sendMessage({
        type: 'setProxy',
        proxyString: proxy.string
    }).catch(() => {});
}

// Switch to next account
let isSwitchingAccount = false;
let switchRetryCount = 0;
let totalAccountCycles = 0; // Track how many times we've gone through all accounts

async function switchToNextAccount(settings, skipIndexIncrement = false) {
    if (!settings.multiAccount || accounts.length === 0 || isSwitchingAccount) return;
    
    isSwitchingAccount = true;
    
    // Stop popup watcher during account switch to prevent interference
    stopPopupWatcher();
    
    // Clear automation timeout
    if (automationTimeout) {
        clearTimeout(automationTimeout);
        automationTimeout = null;
    }
    
    try {
        // Check if we've completed one full cycle
        // If skipIndexIncrement is true, we're retrying after a failed login, so don't increment
        if (!skipIndexIncrement) {
            const nextIndex = currentAccountIndex + 1;
            if (nextIndex >= accounts.length) {
            // Completed one full cycle
            totalAccountCycles++;
            
            if (!settings.loopAccounts) {
                // Don't loop, stop after one cycle
                sendLog(`✅ Đã chạy xong 1 lượt tất cả ${accounts.length} accounts. Dừng automation.`, 'success');
                isSwitchingAccount = false;
                stopAutomation();
                return;
            } else {
                // Loop back to start
                currentAccountIndex = 0;
                sendLog(`🔄 Đã chạy xong 1 lượt, bắt đầu lại từ đầu (Lượt ${totalAccountCycles + 1})`, 'info');
            }
        } else {
            currentAccountIndex = nextIndex;
        }
        } // End of !skipIndexIncrement block
        
        // If skipIndexIncrement is true, check if we need to loop back
        if (skipIndexIncrement && currentAccountIndex >= accounts.length) {
            if (settings.loopAccounts) {
                currentAccountIndex = 0;
                totalAccountCycles++;
                sendLog(`🔄 Đã hết accounts, quay lại từ đầu (Lượt ${totalAccountCycles + 1})`, 'info');
            } else {
                sendLog(`✅ Đã chạy xong tất cả accounts. Dừng automation.`, 'success');
                isSwitchingAccount = false;
                stopAutomation();
                return;
            }
        }
        
        const account = accounts[currentAccountIndex];
        
        sendLog(`🔄 Chuyển sang account ${currentAccountIndex + 1}/${accounts.length}: ${account.email}`, 'info');
        
        // Switch proxy if enabled
        if (settings.useProxy && settings.rotateProxyPerAccount) {
            await switchProxy(settings);
            // Wait a bit for proxy to take effect
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Reset stats for new account
        stats.likeCount = 0;
        stats.commentCount = 0;
        stats.friendCount = 0;
        actionCount = 0;
        processedPosts.clear(); // Clear processed posts for new account
        updateStats();
        
        // Logout current account
        await logoutFromFacebook();
        
        // Wait for page to load and ensure we're logged out
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Verify we're on login page
        const loginFormVisible = document.querySelector('input[type="email"], input[name="email"]');
        if (!loginFormVisible) {
            // Force navigate to login page if not already there
            sendLog('🔄 Đang chuyển đến trang đăng nhập...', 'info');
            chrome.runtime.sendMessage({ type: 'navigate', url: 'https://www.facebook.com/login' });
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
        // Login with new account (force login to ensure we login with the new account)
        const loginSuccess = await loginToFacebook(account.email, account.password, true);
        
        if (loginSuccess) {
            accountStartTime = Date.now();
            switchRetryCount = 0; // Reset retry count on successful login
            isSwitchingAccount = false;
            
            // Update current account display
            chrome.runtime.sendMessage({
                type: 'currentAccount',
                account: account.email
            }).catch(() => {});
            
            // Restart popup watcher
            if (isRunning) {
                startPopupWatcher();
            }
            // Restart automation
            if (isRunning) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                runAutomation(settings);
            }
        } else {
            switchRetryCount++;
            const maxRetries = accounts.length * 2; // Allow retrying through all accounts twice
            
            if (switchRetryCount < maxRetries) {
                sendLog(`⚠️ Không thể đăng nhập với ${account.email} (${switchRetryCount}/${maxRetries}), thử account tiếp theo...`, 'warning');
                isSwitchingAccount = false;
                // Restart popup watcher
                if (isRunning) {
                    startPopupWatcher();
                }
                // Increment index to skip the failed account, then call switchToNextAccount with skip flag
                setTimeout(() => {
                    currentAccountIndex = (currentAccountIndex + 1) % accounts.length;
                    // Pass skipIndexIncrement=true to prevent double increment
                    switchToNextAccount(settings, true);
                }, 5000);
            } else {
                sendLog('❌ Đã thử tất cả accounts nhiều lần, dừng automation', 'error');
                isSwitchingAccount = false;
                // Restart popup watcher before stopping
                if (isRunning) {
                    startPopupWatcher();
                }
                stopAutomation();
            }
        }
    } catch (error) {
        sendLog('❌ Lỗi khi chuyển account: ' + error.message, 'error');
        isSwitchingAccount = false;
        // Restart popup watcher on error
        if (isRunning) {
            startPopupWatcher();
        }
    }
}

// Send log message
function sendLog(message, type = 'info') {
    chrome.runtime.sendMessage({
        type: 'log',
        message: message,
        logType: type
    }).catch(() => {
        // Ignore errors if popup is closed
    });
}

// Update stats
function updateStats() {
    chrome.runtime.sendMessage({
        type: 'stats',
        ...stats
    });
    
    chrome.storage.local.set({
        likeCount: stats.likeCount,
        commentCount: stats.commentCount,
        friendCount: stats.friendCount
    });
}

// Main automation loop
let automationTimeout = null;

async function runAutomation(settings) {
    if (!isRunning || isSwitchingAccount) {
        if (!isRunning) {
            sendLog('⏹️ Automation đã dừng', 'info');
        }
        return;
    }
    
    // Clear any existing timeout
    if (automationTimeout) {
        clearTimeout(automationTimeout);
        automationTimeout = null;
    }
    
    // Check if need to switch account (after switchTime minutes)
    if (settings.multiAccount && accounts.length > 0 && accountStartTime) {
        const elapsedMinutes = (Date.now() - accountStartTime) / (1000 * 60);
        if (elapsedMinutes >= settings.switchTime) {
            sendLog(`⏰ Đã hết ${settings.switchTime} phút, chuyển account...`, 'info');
            await switchToNextAccount(settings);
            return;
        }
    }
    
    if (actionCount >= settings.maxActions) {
        // If multi-account, switch to next account instead of stopping
        if (settings.multiAccount && accounts.length > 0) {
            sendLog(`✅ Đã hoàn thành ${actionCount} thao tác với account hiện tại. Chuyển account...`, 'success');
            await switchToNextAccount(settings);
            return;
        } else {
            sendLog(`✅ Đã hoàn thành ${actionCount} thao tác. Tự động dừng.`, 'success');
            stopAutomation();
            return;
        }
    }
    
    try {
        // Auto close any popups before actions
        closePopups();
        
        // Auto scroll (scroll trước để load thêm bài viết mới)
        if (settings.autoScroll) {
            scrollPage();
            await new Promise(resolve => setTimeout(resolve, settings.speed * 1000));
        }
        
        let hasAction = false;
        
        // Auto like hàng loạt
        if (settings.autoLike) {
            const likeResult = likePost();
            // Handle both old boolean return and new object return for backward compatibility
            const liked = typeof likeResult === 'object' ? likeResult.liked : likeResult;
            const hasMore = typeof likeResult === 'object' ? likeResult.hasMore : false;
            
            if (liked) {
                hasAction = true;
                actionCount++;
                await new Promise(resolve => setTimeout(resolve, randomDelay(settings.speed * 800, (settings.speed + 1) * 1000)));
                // Close popup again after delay
                closePopups();
                
                // Nếu đã like hết bài visible, tự động scroll để tìm bài mới
                if (!hasMore && settings.autoScroll) {
                    sendLog('📜 Đã like hết bài visible, đang scroll để tìm bài mới...', 'info');
                    scrollPage();
                    await new Promise(resolve => setTimeout(resolve, settings.speed * 1000));
                }
            } else {
                // Nếu không tìm thấy bài để like, scroll xuống để load thêm
                if (settings.autoScroll) {
                    scrollPage();
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
        
        // Auto comment hàng loạt
        if (settings.autoComment && settings.commentList) {
            const comments = settings.commentList.split('\n').filter(c => c.trim());
            if (comments.length > 0) {
                const randomComment = comments[Math.floor(Math.random() * comments.length)];
                const commented = await commentPost(randomComment.trim());
                if (commented) {
                    hasAction = true;
                    actionCount++;
                    await new Promise(resolve => setTimeout(resolve, randomDelay(settings.speed * 1200, (settings.speed + 2) * 1500)));
                    // Close popup again after delay
                    closePopups();
                } else {
                    // Nếu không tìm thấy bài để comment, scroll xuống để load thêm
                    if (settings.autoScroll) {
                        scrollPage();
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }
        }
        
        // Auto friend search
        if (settings.autoFriend && settings.searchKeyword) {
            if (actionCount % 5 === 0 && actionCount > 0) { // Search every 5 actions
                const friendAdded = await searchAndAddFriend(settings.searchKeyword);
                if (friendAdded) {
                    actionCount++;
                    hasAction = true;
                }
                await new Promise(resolve => setTimeout(resolve, randomDelay(settings.speed * 2000, (settings.speed + 2) * 2000)));
            }
        }
        
        // Nếu không có action nào, scroll để tìm thêm bài viết
        if (!hasAction && settings.autoScroll) {
            scrollPage();
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
        // Continue loop
        if (isRunning && !isSwitchingAccount) {
            const delay = randomDelay(settings.speed * 800, (settings.speed + 1) * 1000);
            automationTimeout = setTimeout(() => runAutomation(settings), delay);
        }
    } catch (error) {
        sendLog('❌ Lỗi: ' + error.message, 'error');
        console.error('Automation error:', error);
        if (isRunning && !isSwitchingAccount) {
            automationTimeout = setTimeout(() => runAutomation(settings), settings.speed * 1000);
        }
    }
}

function parseAccounts(accountText) {
    if (!accountText || !accountText.trim()) return [];
    
    const lines = accountText.split('\n');
    const accountList = [];
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        const parts = trimmed.split('|');
        if (parts.length >= 2) {
            accountList.push({
                email: parts[0].trim(),
                password: parts.slice(1).join('|').trim()
            });
        }
    }
    
    return accountList;
}

async function startAutomation(settings) {
    // Clear any existing automation
    if (automationTimeout) {
        clearTimeout(automationTimeout);
        automationTimeout = null;
    }
    
    isRunning = true;
    isSwitchingAccount = false;
    actionCount = 0;
    totalAccountCycles = 0; // Reset cycle count
    processedPosts.clear(); // Clear processed posts tracking
    
    // Parse proxies if proxy is enabled
    if (settings.useProxy && settings.proxyList) {
        proxies = parseProxies(settings.proxyList);
        if (proxies.length > 0) {
            sendLog(`🌐 Đã tải ${proxies.length} proxy`, 'info');
            currentProxyIndex = 0;
            
            // Set first proxy
            await switchProxy(settings);
            await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
            sendLog('⚠️ Không có proxy hợp lệ, tiếp tục không dùng proxy', 'warning');
        }
    } else {
        proxies = [];
    }
    
    // Parse accounts if multi-account is enabled
    if (settings.multiAccount && settings.accountList) {
        accounts = parseAccounts(settings.accountList);
        if (accounts.length > 0) {
            sendLog(`📋 Đã tải ${accounts.length} tài khoản`, 'info');

            const withTimeout = async (promise, ms, label) => {
                let timeoutId = null;
                const timeoutPromise = new Promise((_, reject) => {
                    timeoutId = setTimeout(() => reject(new Error(`Timeout: ${label} (${ms}ms)`)), ms);
                });
                try {
                    return await Promise.race([promise, timeoutPromise]);
                } finally {
                    if (timeoutId) clearTimeout(timeoutId);
                }
            };
            
            // Check if already logged in
            const loggedInIndicators = [
                'input[placeholder*="Search"]',
                'div[aria-label*="Home"]',
                'a[href*="/home"]'
            ];
            
            let alreadyLoggedIn = false;
            for (const selector of loggedInIndicators) {
                if (document.querySelector(selector) && !document.querySelector('input[type="email"]')) {
                    alreadyLoggedIn = true;
                    break;
                }
            }

            sendLog(`🧭 Trạng thái hiện tại: ${alreadyLoggedIn ? 'Đã đăng nhập' : 'Chưa đăng nhập / đang ở trang login'}`, 'info');
            
            // Always start with the first account in the list to avoid index mismatch.
            // If user is already logged in with some other account, we must logout first.
            currentAccountIndex = 0;
            const firstAccount = accounts[0];
            
            if (alreadyLoggedIn) {
                sendLog('🔄 Đang đăng xuất để đăng nhập đúng account đầu tiên...', 'info');
                try {
                    await withTimeout(logoutFromFacebook(), 20000, 'logout');
                } catch (e) {
                    sendLog(`⚠️ Logout bị chậm/treo: ${e.message}. Thử chuyển thẳng tới trang login...`, 'warning');
                }
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
            
            // Ensure we're on login page before trying to login
            if (!document.querySelector('input[type="email"], input[name="email"]')) {
                sendLog('➡️ Chuyển tới trang đăng nhập...', 'info');
                chrome.runtime.sendMessage({ type: 'navigate', url: 'https://www.facebook.com/login' }).catch(() => {});
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
            
            sendLog(`🔐 Đăng nhập với account đầu tiên: ${firstAccount.email}`, 'info');
            let loginSuccess = false;
            try {
                loginSuccess = await withTimeout(
                    loginToFacebook(firstAccount.email, firstAccount.password, true),
                    45000,
                    'login'
                );
            } catch (e) {
                sendLog(`⚠️ Login bị chậm/treo: ${e.message}`, 'warning');
                loginSuccess = false;
            }
            
            if (!loginSuccess) {
                sendLog('❌ Không thể đăng nhập với account đầu tiên (có thể FB checkpoint/2FA/verify).', 'error');
                stopAutomation();
                return;
            }
            
            accountStartTime = Date.now();
            
            sendLog(`⏰ Sẽ chuyển account sau ${settings.switchTime} phút`, 'info');
        } else {
            sendLog('⚠️ Không có account nào, chạy với account hiện tại', 'warning');
            accounts = [];
            accountStartTime = Date.now();
        }
    } else {
        accounts = [];
        accountStartTime = Date.now();
    }
    
    sendLog('🚀 Bắt đầu automation...', 'success');
    sendLog(`⚙️ Cấu hình: Scroll=${settings.autoScroll}, Like=${settings.autoLike}, Comment=${settings.autoComment}, Friend=${settings.autoFriend}`, 'info');
    
    // Start popup watcher to auto-close popups
    startPopupWatcher();
    
    // Wait a bit for page to stabilize
    await new Promise(resolve => setTimeout(resolve, 2000));
    runAutomation(settings);
}

function stopAutomation() {
    isRunning = false;
    isSwitchingAccount = false;
    if (accountSwitchTimer) {
        clearTimeout(accountSwitchTimer);
        accountSwitchTimer = null;
    }
    if (automationTimeout) {
        clearTimeout(automationTimeout);
        automationTimeout = null;
    }
    
    // Stop popup watcher
    stopPopupWatcher();
    
    // Clear proxy when stopping
    chrome.runtime.sendMessage({ type: 'clearProxy' }).catch(() => {});
    
    chrome.storage.local.set({ isRunning: false });
    sendLog('⏹️ Đã dừng automation', 'info');
    sendLog(`📊 Tổng kết: ${stats.likeCount} likes, ${stats.commentCount} comments, ${stats.friendCount} friends`, 'info');
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'start') {
        startAutomation(message.settings);
        sendResponse({ success: true });
    } else if (message.action === 'stop') {
        stopAutomation();
        sendResponse({ success: true });
    } else if (message.action === 'ping') {
        // Ping to check if content script is alive
        sendResponse({ success: true, alive: true });
    }
    return true;
});

// Load stats on startup
chrome.storage.local.get(['likeCount', 'commentCount', 'friendCount'], (result) => {
    if (result.likeCount) stats.likeCount = result.likeCount;
    if (result.commentCount) stats.commentCount = result.commentCount;
    if (result.friendCount) stats.friendCount = result.friendCount;
});

