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

// Random delay to simulate human behavior
function randomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Scroll page
function scrollPage() {
    window.scrollBy({
        top: window.innerHeight * 0.8,
        behavior: 'smooth'
    });
    sendLog('📜 Đang lướt trang...', 'info');
}

// Find and click like button
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
        
        // First, try to find in articles (more reliable)
        const articles = document.querySelectorAll('article');
        for (const article of articles) {
            // Check if already liked
            const alreadyLiked = article.querySelector('[aria-label*="Unlike"], [aria-label*="Bỏ thích"], [aria-label*="Liked"], [aria-label*="Đã thích"]');
            if (alreadyLiked) continue;
            
            // Try to find like button
            for (const selector of likeSelectors) {
                try {
                    const likeButton = article.querySelector(selector);
                    if (likeButton && likeButton.offsetParent !== null) {
                        likeButton.click();
                        stats.likeCount++;
                        updateStats();
                        sendLog(`❤️ Đã like bài viết (Tổng: ${stats.likeCount})`, 'success');
                        return true;
                    }
                } catch (e) {
                    continue;
                }
            }
        }
        
        // Alternative: find by text content in visible buttons
        const allButtons = Array.from(document.querySelectorAll('div[role="button"], span[role="button"], a[role="button"]'));
        for (const btn of allButtons) {
            if (btn.offsetParent === null) continue; // Skip hidden elements
            
            const text = (btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase();
            if ((text.includes('like') || text.includes('thích')) && 
                !text.includes('unlike') && !text.includes('bỏ thích') &&
                !text.includes('liked') && !text.includes('đã thích')) {
                try {
                    btn.click();
                    stats.likeCount++;
                    updateStats();
                    sendLog(`❤️ Đã like bài viết (Tổng: ${stats.likeCount})`, 'success');
                    return true;
                } catch (e) {
                    continue;
                }
            }
        }
        
        sendLog('⚠️ Không tìm thấy nút Like', 'warning');
        return false;
    } catch (error) {
        sendLog('❌ Lỗi khi like: ' + error.message, 'error');
        return false;
    }
}

// Comment on post (returns Promise)
function commentPost(commentText) {
    return new Promise((resolve) => {
        // Find comment box
        const commentSelectors = [
            'div[contenteditable="true"][data-testid*="comment"]',
            'div[contenteditable="true"][aria-label*="comment"]',
            'div[contenteditable="true"][aria-label*="bình luận"]',
            'div[contenteditable="true"][placeholder*="comment"]',
            'div[contenteditable="true"][placeholder*="bình luận"]',
            'textarea[placeholder*="comment"]',
            'textarea[placeholder*="bình luận"]'
        ];
        
        let found = false;
        
        for (const selector of commentSelectors) {
            try {
                const commentBoxes = document.querySelectorAll(selector);
                for (const commentBox of commentBoxes) {
                    if (commentBox && commentBox.offsetParent !== null && !found) {
                        found = true;
                        commentBox.focus();
                        commentBox.click();
                        
                        // Wait a bit for the box to be ready
                        setTimeout(() => {
                            try {
                                // Set comment text
                                if (commentBox.contentEditable === 'true') {
                                    commentBox.textContent = commentText;
                                    commentBox.innerText = commentText;
                                    commentBox.dispatchEvent(new Event('input', { bubbles: true }));
                                    commentBox.dispatchEvent(new Event('keyup', { bubbles: true }));
                                } else {
                                    commentBox.value = commentText;
                                    commentBox.dispatchEvent(new Event('input', { bubbles: true }));
                                }
                                
                                // Find and click submit button
                                setTimeout(() => {
                                    const submitSelectors = [
                                        'div[aria-label*="Post"]',
                                        'div[aria-label*="Đăng"]',
                                        'button[type="submit"]',
                                        'div[role="button"][aria-label*="Post"]',
                                        'div[role="button"][aria-label*="Comment"]'
                                    ];
                                    
                                    let submitted = false;
                                    for (const subSelector of submitSelectors) {
                                        const submitBtn = commentBox.closest('form')?.querySelector(subSelector) ||
                                                       commentBox.parentElement?.querySelector(subSelector) ||
                                                       commentBox.closest('div[role="article"]')?.querySelector(subSelector) ||
                                                       commentBox.closest('article')?.querySelector(subSelector);
                                        if (submitBtn && submitBtn.offsetParent !== null && !submitted) {
                                            submitBtn.click();
                                            stats.commentCount++;
                                            updateStats();
                                            sendLog(`💬 Đã comment: "${commentText.substring(0, 30)}${commentText.length > 30 ? '...' : ''}" (Tổng: ${stats.commentCount})`, 'success');
                                            submitted = true;
                                            resolve(true);
                                            return;
                                        }
                                    }
                                    if (!submitted) {
                                        sendLog('⚠️ Không tìm thấy nút đăng comment', 'warning');
                                        resolve(false);
                                    }
                                }, 1000);
                            } catch (e) {
                                sendLog('❌ Lỗi khi comment: ' + e.message, 'error');
                                resolve(false);
                            }
                        }, 500);
                        break;
                    }
                }
                if (found) break;
            } catch (e) {
                sendLog('❌ Lỗi khi tìm ô comment: ' + e.message, 'error');
                continue;
            }
        }
        
        if (!found) {
            sendLog('⚠️ Không tìm thấy ô comment', 'warning');
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
function loginToFacebook(email, password) {
    return new Promise((resolve) => {
        sendLog(`🔐 Đang đăng nhập với: ${email.substring(0, 20)}...`, 'info');
        
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
        
        if (isLoggedIn && !document.querySelector('input[type="email"], input[name="email"]')) {
            sendLog('✅ Đã đăng nhập sẵn', 'success');
            resolve(true);
            return;
        }
        
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
            resolve(false);
            return;
        }
        
        try {
            // Fill email
            emailInput.focus();
            emailInput.value = email;
            emailInput.dispatchEvent(new Event('input', { bubbles: true }));
            emailInput.dispatchEvent(new Event('change', { bubbles: true }));
            
            // Wait a bit
            setTimeout(() => {
                // Fill password
                passwordInput.focus();
                passwordInput.value = password;
                passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
                passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
                
                // Wait and click login
                setTimeout(() => {
                    if (loginButton) {
                        loginButton.click();
                        sendLog('⏳ Đang xử lý đăng nhập...', 'info');
                        
                        // Wait for login to complete
                        setTimeout(() => {
                            // Check if login successful
                            let checkCount = 0;
                            const maxChecks = 15; // 15 seconds max
                            const checkLogin = setInterval(() => {
                                checkCount++;
                                let loggedIn = false;
                                
                                // Check for logged in indicators
                                for (const selector of loggedInIndicators) {
                                    const element = document.querySelector(selector);
                                    if (element && !document.querySelector('input[type="email"], input[name="email"]')) {
                                        loggedIn = true;
                                        break;
                                    }
                                }
                                
                                // Check for error messages
                                const errorElements = document.querySelectorAll('div[role="alert"], .error, [data-testid*="error"], div[id*="error"]');
                                let hasError = false;
                                for (const err of errorElements) {
                                    const text = (err.textContent || '').toLowerCase();
                                    if (text.includes('incorrect') || text.includes('wrong') || text.includes('sai') || text.includes('không đúng')) {
                                        hasError = true;
                                        break;
                                    }
                                }
                                
                                if (loggedIn) {
                                    clearInterval(checkLogin);
                                    sendLog(`✅ Đăng nhập thành công: ${email}`, 'success');
                                    chrome.runtime.sendMessage({
                                        type: 'currentAccount',
                                        account: email
                                    }).catch(() => {});
                                    resolve(true);
                                } else if (hasError || checkCount >= maxChecks) {
                                    clearInterval(checkLogin);
                                    if (hasError) {
                                        sendLog('❌ Đăng nhập thất bại: Sai email hoặc password', 'error');
                                    } else {
                                        sendLog('⚠️ Timeout đăng nhập', 'warning');
                                    }
                                    resolve(false);
                                }
                            }, 1000);
                        }, 2000);
                    } else {
                        // Try Enter key
                        passwordInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                        sendLog('⏳ Đang xử lý đăng nhập...', 'info');
                        setTimeout(() => resolve(true), 3000);
                    }
                }, 500);
            }, 500);
        } catch (error) {
            sendLog('❌ Lỗi khi đăng nhập: ' + error.message, 'error');
            resolve(false);
        }
    });
}

// Logout from Facebook
function logoutFromFacebook() {
    return new Promise((resolve) => {
        sendLog('🚪 Đang đăng xuất...', 'info');
        
        // Try to find logout button/menu
        const logoutSelectors = [
            'div[aria-label*="Account"]',
            'div[aria-label*="Menu"]',
            'div[role="button"][aria-label*="Account"]',
            'div[aria-label*="Your profile"]'
        ];
        
        // First, try to open account menu
        for (const selector of logoutSelectors) {
            const menuBtn = document.querySelector(selector);
            if (menuBtn && menuBtn.offsetParent !== null) {
                menuBtn.click();
                setTimeout(() => {
                    // Look for logout link
                    const allLinks = document.querySelectorAll('a[href*="logout"], span, div[role="menuitem"]');
                    for (const link of allLinks) {
                        const text = (link.textContent || link.getAttribute('aria-label') || '').toLowerCase();
                        if ((text.includes('log out') || text.includes('đăng xuất')) && link.offsetParent !== null) {
                            link.click();
                            setTimeout(() => resolve(true), 2000);
                            return;
                        }
                    }
                    // If can't find, just navigate to login page
                    chrome.runtime.sendMessage({ type: 'navigate', url: 'https://www.facebook.com/login' });
                    setTimeout(() => resolve(true), 2000);
                }, 1000);
                return;
            }
        }
        
        // Fallback: navigate to login page
        chrome.runtime.sendMessage({ type: 'navigate', url: 'https://www.facebook.com/login' });
        setTimeout(() => resolve(true), 2000);
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

async function switchToNextAccount(settings) {
    if (!settings.multiAccount || accounts.length === 0 || isSwitchingAccount) return;
    
    isSwitchingAccount = true;
    
    // Clear automation timeout
    if (automationTimeout) {
        clearTimeout(automationTimeout);
        automationTimeout = null;
    }
    
    try {
        // Check if we've completed one full cycle
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
        
        const account = accounts[currentAccountIndex];
        switchRetryCount = 0; // Reset retry count on successful switch
        
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
        updateStats();
        
        // Logout current account
        await logoutFromFacebook();
        
        // Wait for page to load
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Login with new account
        const loginSuccess = await loginToFacebook(account.email, account.password);
        
        if (loginSuccess) {
            accountStartTime = Date.now();
            isSwitchingAccount = false;
            // Restart automation
            if (isRunning) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                runAutomation(settings);
            }
        } else {
            switchRetryCount++;
            const maxRetries = accounts.length;
            
            if (switchRetryCount < maxRetries) {
                sendLog(`⚠️ Không thể đăng nhập (${switchRetryCount}/${maxRetries}), thử account tiếp theo...`, 'warning');
                isSwitchingAccount = false;
                setTimeout(() => switchToNextAccount(settings), 5000);
            } else {
                sendLog('❌ Đã thử tất cả accounts, dừng automation', 'error');
                isSwitchingAccount = false;
                stopAutomation();
            }
        }
    } catch (error) {
        sendLog('❌ Lỗi khi chuyển account: ' + error.message, 'error');
        isSwitchingAccount = false;
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
        // Auto scroll
        if (settings.autoScroll) {
            scrollPage();
            await new Promise(resolve => setTimeout(resolve, settings.speed * 1000));
        }
        
        // Auto like
        if (settings.autoLike) {
            const liked = likePost();
            if (liked) {
                actionCount++;
                await new Promise(resolve => setTimeout(resolve, randomDelay(settings.speed * 1000, (settings.speed + 2) * 1000)));
            } else {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        // Auto comment
        if (settings.autoComment && settings.commentList) {
            const comments = settings.commentList.split('\n').filter(c => c.trim());
            if (comments.length > 0) {
                const randomComment = comments[Math.floor(Math.random() * comments.length)];
                const commented = await commentPost(randomComment.trim());
                if (commented) {
                    actionCount++;
                    await new Promise(resolve => setTimeout(resolve, randomDelay(settings.speed * 1500, (settings.speed + 3) * 1500)));
                } else {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
        
        // Auto friend search
        if (settings.autoFriend && settings.searchKeyword) {
            if (actionCount % 5 === 0 && actionCount > 0) { // Search every 5 actions
                const friendAdded = await searchAndAddFriend(settings.searchKeyword);
                if (friendAdded) {
                    actionCount++;
                }
                await new Promise(resolve => setTimeout(resolve, randomDelay(settings.speed * 2000, (settings.speed + 2) * 2000)));
            }
        }
        
        // Continue loop
        if (isRunning && !isSwitchingAccount) {
            const delay = randomDelay(settings.speed * 1000, (settings.speed + 1) * 1000);
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
            
            if (alreadyLoggedIn) {
                sendLog('✅ Đã đăng nhập sẵn, bắt đầu với account hiện tại', 'info');
                currentAccountIndex = 0; // Assume using first account
                accountStartTime = Date.now();
            } else {
                // Login with first account (index 0)
                currentAccountIndex = 0;
                const firstAccount = accounts[0];
                sendLog(`🔐 Đăng nhập với account đầu tiên: ${firstAccount.email}`, 'info');
                const loginSuccess = await loginToFacebook(firstAccount.email, firstAccount.password);
                
                if (!loginSuccess) {
                    sendLog('❌ Không thể đăng nhập với account đầu tiên', 'error');
                    stopAutomation();
                    return;
                }
                
                accountStartTime = Date.now();
            }
            
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

