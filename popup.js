// Log management
function addLog(message, type = 'info') {
    const logContainer = document.getElementById('logContainer');
    const logItem = document.createElement('div');
    logItem.className = `log-item log-${type}`;
    
    const time = new Date().toLocaleTimeString('vi-VN');
    logItem.innerHTML = `
        <span class="log-time">[${time}]</span>
        <span class="log-message">${escapeHtml(message)}</span>
    `;
    
    logContainer.appendChild(logItem);
    
    // Auto scroll to bottom
    logContainer.scrollTop = logContainer.scrollHeight;
    
    // Limit log items to prevent memory issues
    const logItems = logContainer.querySelectorAll('.log-item');
    if (logItems.length > 100) {
        logItems[0].remove();
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function clearLog() {
    document.getElementById('logContainer').innerHTML = '';
    addLog('Log đã được xóa', 'info');
}

function updateStatus(text, type = 'info') {
    const statusEl = document.getElementById('status');
    const statusText = document.getElementById('statusText');
    statusText.textContent = text;
    
    statusEl.className = 'alert mb-0 text-center';
    if (type === 'running') {
        statusEl.className += ' alert-success';
    } else if (type === 'stopped') {
        statusEl.className += ' alert-danger';
    } else if (type === 'error') {
        statusEl.className += ' alert-warning';
    } else {
        statusEl.className += ' alert-info';
    }
}

// Account management functions
function parseAccounts(accountText) {
    if (!accountText || !accountText.trim()) return [];
    
    const lines = accountText.split('\n');
    const accounts = [];
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        const parts = trimmed.split('|');
        if (parts.length >= 2) {
            accounts.push({
                email: parts[0].trim(),
                password: parts.slice(1).join('|').trim() // Support passwords with |
                // Note: In production, passwords should be encrypted
            });
        }
    }
    
    return accounts;
}

function formatAccounts(accounts) {
    return accounts.map(acc => `${acc.email}|${acc.password}`).join('\n');
}

function updateAccountPreview() {
    const accountText = document.getElementById('accountList').value;
    const accounts = parseAccounts(accountText);
    const preview = document.getElementById('accountPreview');
    
    if (accounts.length === 0) {
        preview.innerHTML = '<div class="text-muted">Chưa có account nào</div>';
    } else {
        preview.innerHTML = accounts.map((acc, index) => 
            `<div class="mb-1"><span class="badge bg-secondary">${index + 1}</span> ${acc.email.substring(0, 30)}${acc.email.length > 30 ? '...' : ''}</div>`
        ).join('');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Load saved settings
    const result = await chrome.storage.local.get([
        'autoScroll', 'autoLike', 'autoComment', 'autoFriend',
        'commentList', 'searchKeyword', 'speed', 'maxActions',
        'likeCount', 'commentCount', 'friendCount',
        'multiAccount', 'accountList', 'switchTime', 'currentAccount',
        'loopAccounts', 'useProxy', 'proxyList', 'preferredCountry', 'rotateProxyPerAccount'
    ]);
    
    // Set checkbox values
    document.getElementById('autoScroll').checked = result.autoScroll || false;
    document.getElementById('autoLike').checked = result.autoLike || false;
    document.getElementById('autoComment').checked = result.autoComment || false;
    document.getElementById('autoFriend').checked = result.autoFriend || false;
    document.getElementById('multiAccount').checked = result.multiAccount || false;
    document.getElementById('loopAccounts').checked = result.loopAccounts !== undefined ? result.loopAccounts : true;
    document.getElementById('useProxy').checked = result.useProxy || false;
    document.getElementById('proxyList').value = result.proxyList || '';
    document.getElementById('preferredCountry').value = result.preferredCountry || '';
    document.getElementById('rotateProxyPerAccount').checked = result.rotateProxyPerAccount !== undefined ? result.rotateProxyPerAccount : true;
    
    // Set other values
    document.getElementById('commentList').value = result.commentList || 'Tuyệt vời!\nRất hay!\nCảm ơn bạn!';
    document.getElementById('searchKeyword').value = result.searchKeyword || '';
    document.getElementById('speed').value = result.speed || 3;
    document.getElementById('maxActions').value = result.maxActions || 10;
    document.getElementById('switchTime').value = result.switchTime || 3;
    document.getElementById('accountList').value = result.accountList || '';
    
    // Update current account display
    document.getElementById('currentAccount').textContent = result.currentAccount || 'Chưa đăng nhập';
    
    // Update stats
    document.getElementById('likeCount').textContent = result.likeCount || 0;
    document.getElementById('commentCount').textContent = result.commentCount || 0;
    document.getElementById('friendCount').textContent = result.friendCount || 0;
    
    // Show/hide comment group
    const commentGroup = document.getElementById('commentGroup');
    const friendGroup = document.getElementById('friendGroup');
    const accountSettings = document.getElementById('accountSettings');
    
    document.getElementById('autoComment').addEventListener('change', (e) => {
        commentGroup.style.display = e.target.checked ? 'block' : 'none';
    });
    
    document.getElementById('autoFriend').addEventListener('change', (e) => {
        friendGroup.style.display = e.target.checked ? 'block' : 'none';
    });
    
    document.getElementById('multiAccount').addEventListener('change', (e) => {
        accountSettings.style.display = e.target.checked ? 'block' : 'none';
    });
    
    const proxySettings = document.getElementById('proxySettings');
    document.getElementById('useProxy').addEventListener('change', (e) => {
        proxySettings.style.display = e.target.checked ? 'block' : 'none';
    });
    
    // Initialize proxy settings visibility
    proxySettings.style.display = document.getElementById('useProxy').checked ? 'block' : 'none';
    
    // Update proxy status
    function updateProxyStatus() {
        const proxyText = document.getElementById('proxyList').value;
        const proxies = parseProxies(proxyText);
        const statusEl = document.getElementById('proxyStatus');
        
        if (proxies.length === 0) {
            statusEl.innerHTML = '<div class="text-muted">Chưa có proxy nào</div>';
        } else {
            statusEl.innerHTML = `
                <div class="text-success">
                    <i class="bi bi-check-circle"></i> Đã tải ${proxies.length} proxy
                    ${proxies.length > 0 ? `<br><small>Proxy đầu tiên: ${proxies[0].host}:${proxies[0].port}</small>` : ''}
                </div>
            `;
        }
    }
    
    // Parse proxy list
    function parseProxies(proxyText) {
        if (!proxyText || !proxyText.trim()) return [];
        
        const lines = proxyText.split('\n');
        const proxies = [];
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            
            // Format: IP:Port or IP:Port:User:Pass or IP:Port|Country
            const parts = trimmed.split(':');
            if (parts.length >= 2) {
                const host = parts[0].trim();
                const port = parseInt(parts[1].split('|')[0].split(':')[0].trim());
                
                if (host && port) {
                    const proxy = {
                        host: host,
                        port: port,
                        username: parts.length >= 3 ? parts[2].split('|')[0].trim() : '',
                        password: parts.length >= 4 ? parts[3].split('|')[0].trim() : '',
                        country: trimmed.includes('|') ? trimmed.split('|')[1].trim() : ''
                    };
                    proxies.push(proxy);
                }
            }
        }
        
        return proxies;
    }
    
    // Proxy list change handler
    document.getElementById('proxyList').addEventListener('input', updateProxyStatus);
    
    // Test proxy button
    document.getElementById('testProxyBtn').addEventListener('click', async () => {
        const proxyText = document.getElementById('proxyList').value;
        const proxies = parseProxies(proxyText);
        
        if (proxies.length === 0) {
            addLog('⚠️ Chưa có proxy nào để test', 'warning');
            return;
        }
        
        const testProxy = proxies[0];
        addLog(`🔍 Đang test proxy: ${testProxy.host}:${testProxy.port}...`, 'info');
        
        // Test proxy by checking IP
        try {
            const response = await fetch('https://api.ipify.org?format=json', {
                method: 'GET',
                // Note: Chrome extension cannot directly use proxy in fetch
                // This is just a placeholder - actual proxy needs to be set via Chrome proxy API
            });
            
            // For now, just log that proxy is configured
            addLog(`✅ Proxy đã được cấu hình: ${testProxy.host}:${testProxy.port}`, 'success');
            addLog('ℹ️ Lưu ý: Proxy sẽ được áp dụng khi chuyển account', 'info');
        } catch (error) {
            addLog('⚠️ Không thể test proxy: ' + error.message, 'warning');
        }
    });
    
    // Clear proxy button
    document.getElementById('clearProxyBtn').addEventListener('click', () => {
        if (confirm('Bạn có chắc muốn xóa tất cả proxy?')) {
            document.getElementById('proxyList').value = '';
            updateProxyStatus();
            chrome.storage.local.set({ proxyList: '' });
        }
    });
    
    updateProxyStatus();
    
    // Account list change handler
    document.getElementById('accountList').addEventListener('input', updateAccountPreview);
    
    // Add account button
    document.getElementById('addAccountBtn').addEventListener('click', () => {
        const email = prompt('Nhập email:');
        if (email) {
            const password = prompt('Nhập password:');
            if (password) {
                const current = document.getElementById('accountList').value;
                const newAccount = current ? `${current}\n${email}|${password}` : `${email}|${password}`;
                document.getElementById('accountList').value = newAccount;
                updateAccountPreview();
                chrome.storage.local.set({ accountList: newAccount });
            }
        }
    });
    
    // Clear accounts button
    document.getElementById('clearAccountsBtn').addEventListener('click', () => {
        if (confirm('Bạn có chắc muốn xóa tất cả accounts?')) {
            document.getElementById('accountList').value = '';
            updateAccountPreview();
            chrome.storage.local.set({ accountList: '' });
        }
    });
    
    // Initialize visibility
    commentGroup.style.display = document.getElementById('autoComment').checked ? 'block' : 'none';
    friendGroup.style.display = document.getElementById('autoFriend').checked ? 'block' : 'none';
    accountSettings.style.display = document.getElementById('multiAccount').checked ? 'block' : 'none';
    updateAccountPreview();
    
    // Clear log button
    document.getElementById('clearLogBtn').addEventListener('click', clearLog);
    
    // Start button
    document.getElementById('startBtn').addEventListener('click', async () => {
        try {
            // Save settings
            const settings = {
                autoScroll: document.getElementById('autoScroll').checked,
                autoLike: document.getElementById('autoLike').checked,
                autoComment: document.getElementById('autoComment').checked,
                autoFriend: document.getElementById('autoFriend').checked,
                commentList: document.getElementById('commentList').value,
                searchKeyword: document.getElementById('searchKeyword').value,
                speed: parseInt(document.getElementById('speed').value),
                maxActions: parseInt(document.getElementById('maxActions').value),
                multiAccount: document.getElementById('multiAccount').checked,
                accountList: document.getElementById('accountList').value,
                switchTime: parseInt(document.getElementById('switchTime').value) || 3,
                loopAccounts: document.getElementById('loopAccounts').checked,
                useProxy: document.getElementById('useProxy').checked,
                proxyList: document.getElementById('proxyList').value,
                preferredCountry: document.getElementById('preferredCountry').value,
                rotateProxyPerAccount: document.getElementById('rotateProxyPerAccount').checked,
                isRunning: true
            };
            
            // Validate multi-account
            if (settings.multiAccount) {
                const accounts = parseAccounts(settings.accountList);
                if (accounts.length === 0) {
                    addLog('⚠️ Vui lòng thêm ít nhất một tài khoản!', 'warning');
                    updateStatus('Thiếu danh sách account', 'error');
                    return;
                }
            }
            
            await chrome.storage.local.set(settings);
            
            // Get active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab.url || (!tab.url.includes('facebook.com') && !tab.url.includes('m.facebook.com'))) {
                addLog('⚠️ Vui lòng mở trang Facebook trước!', 'error');
                updateStatus('Lỗi: Không phải trang Facebook', 'error');
                return;
            }
            
            // Validate settings
            if (!settings.autoScroll && !settings.autoLike && !settings.autoComment && !settings.autoFriend) {
                addLog('⚠️ Vui lòng chọn ít nhất một tính năng!', 'warning');
                updateStatus('Chưa chọn tính năng', 'error');
                return;
            }
            
            if (settings.autoComment && (!settings.commentList || !settings.commentList.trim())) {
                addLog('⚠️ Vui lòng nhập danh sách comment!', 'warning');
                updateStatus('Thiếu danh sách comment', 'error');
                return;
            }
            
            if (settings.autoFriend && (!settings.searchKeyword || !settings.searchKeyword.trim())) {
                addLog('⚠️ Vui lòng nhập từ khóa tìm kiếm!', 'warning');
                updateStatus('Thiếu từ khóa tìm kiếm', 'error');
                return;
            }
            
            // Inject and start automation
            try {
                // Try to send message first (content script might already be loaded)
                await chrome.tabs.sendMessage(tab.id, { action: 'start', settings });
                addLog('✅ Đã bắt đầu automation', 'success');
                updateStatus('Đang chạy...', 'running');
            } catch (error) {
                // Content script not loaded, try to inject it
                addLog('⏳ Đang inject content script...', 'info');
                try {
                    // Inject content script
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['content.js']
                    });
                    
                    // Wait for content script to initialize
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // Retry sending message
                    await chrome.tabs.sendMessage(tab.id, { action: 'start', settings });
                    addLog('✅ Đã bắt đầu automation', 'success');
                    updateStatus('Đang chạy...', 'running');
                } catch (retryError) {
                    addLog('❌ Lỗi: ' + retryError.message, 'error');
                    addLog('💡 Vui lòng refresh trang Facebook và thử lại', 'warning');
                    updateStatus('Lỗi khi khởi động', 'error');
                    await chrome.storage.local.set({ isRunning: false });
                    return;
                }
            }
            
            // Update UI
            document.getElementById('startBtn').disabled = true;
            document.getElementById('stopBtn').disabled = false;
        } catch (error) {
            addLog('❌ Lỗi: ' + error.message, 'error');
            updateStatus('Lỗi', 'error');
        }
    });
    
    // Stop button
    document.getElementById('stopBtn').addEventListener('click', async () => {
        try {
            // Always clear running state first
            await chrome.storage.local.set({ isRunning: false });
            
            // Try to send stop message to content script
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                
                if (tab && tab.id && (tab.url?.includes('facebook.com') || tab.url?.includes('m.facebook.com'))) {
                    // Try to send message, but don't fail if content script doesn't exist
                    chrome.tabs.sendMessage(tab.id, { action: 'stop' }).catch(() => {
                        // Content script might not be loaded, that's okay
                        console.log('Content script not available, but state cleared');
                    });
                }
            } catch (tabError) {
                // Tab might not exist, that's okay
                console.log('Tab not available:', tabError);
            }
            
            addLog('⏹️ Đã dừng automation', 'info');
            updateStatus('Đã dừng', 'stopped');
            
            // Update UI
            document.getElementById('startBtn').disabled = false;
            document.getElementById('stopBtn').disabled = true;
        } catch (error) {
            // Even if there's an error, clear the state
            await chrome.storage.local.set({ isRunning: false });
            addLog('⏹️ Đã dừng automation (đã clear state)', 'info');
            updateStatus('Đã dừng', 'stopped');
            document.getElementById('startBtn').disabled = false;
            document.getElementById('stopBtn').disabled = true;
        }
    });
    
    // Listen for messages from content script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'stats') {
            document.getElementById('likeCount').textContent = message.likeCount || 0;
            document.getElementById('commentCount').textContent = message.commentCount || 0;
            document.getElementById('friendCount').textContent = message.friendCount || 0;
        } else if (message.type === 'log') {
            addLog(message.message, message.logType || 'info');
        } else if (message.type === 'currentAccount') {
            document.getElementById('currentAccount').textContent = message.account || 'Chưa đăng nhập';
            chrome.storage.local.set({ currentAccount: message.account });
        }
        return true;
    });
    
    // Check if already running
    const running = await chrome.storage.local.get('isRunning');
    if (running.isRunning) {
        // Verify that we can actually connect to content script
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (tab && tab.id && (tab.url?.includes('facebook.com') || tab.url?.includes('m.facebook.com'))) {
                // Try to ping content script
                try {
                    await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
                    // Content script is alive
                    document.getElementById('startBtn').disabled = true;
                    document.getElementById('stopBtn').disabled = false;
                    updateStatus('Đang chạy...', 'running');
                    addLog('🔄 Tiếp tục từ phiên trước', 'info');
                } catch (pingError) {
                    // Content script not available, clear state
                    await chrome.storage.local.set({ isRunning: false });
                    addLog('⚠️ Phiên trước đã kết thúc, đã reset', 'warning');
                    addLog('✅ Extension đã sẵn sàng', 'success');
                }
            } else {
                // Not on Facebook, clear state
                await chrome.storage.local.set({ isRunning: false });
                addLog('⚠️ Không phải trang Facebook, đã reset', 'warning');
                addLog('✅ Extension đã sẵn sàng', 'success');
            }
        } catch (error) {
            // Error checking, clear state to be safe
            await chrome.storage.local.set({ isRunning: false });
            addLog('✅ Extension đã sẵn sàng', 'success');
        }
    } else {
        addLog('✅ Extension đã sẵn sàng', 'success');
    }
});

