// Background service worker
chrome.runtime.onInstalled.addListener(() => {
    console.log('Auto Social Media Extension installed');
});

// Clear proxy on extension startup (safety measure)
chrome.runtime.onStartup.addListener(() => {
    chrome.proxy.settings.clear({});
});

// Parse proxy string
function parseProxy(proxyString) {
    if (!proxyString) return null;
    
    const parts = proxyString.split(':');
    if (parts.length >= 2) {
        const host = parts[0].trim();
        const portPart = parts[1].split('|')[0].split(':')[0].trim();
        const port = parseInt(portPart);
        
        if (host && port) {
            return {
                host: host,
                port: port,
                username: parts.length >= 3 ? parts[2].split('|')[0].trim() : '',
                password: parts.length >= 4 ? parts[3].split('|')[0].trim() : ''
            };
        }
    }
    return null;
}

// Set proxy configuration
async function setProxy(proxyConfig) {
    if (!proxyConfig) {
        // Clear proxy - use system proxy
        chrome.proxy.settings.clear({});
        return;
    }
    
    const config = {
        mode: 'fixed_servers',
        rules: {
            singleProxy: {
                scheme: 'http',
                host: proxyConfig.host,
                port: proxyConfig.port
            }
        }
    };
    
    // If proxy requires authentication, we need to use webRequest API
    // For now, set basic proxy
    try {
        await chrome.proxy.settings.set({ value: config });
        console.log('Proxy set:', proxyConfig.host + ':' + proxyConfig.port);
    } catch (error) {
        console.error('Error setting proxy:', error);
    }
}

// Handle messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'navigate') {
        // Navigate to URL
        if (sender && sender.tab && sender.tab.id) {
            chrome.tabs.update(sender.tab.id, { url: message.url }).catch((error) => {
                console.error('Navigation error:', error);
                sendResponse({ success: false, error: error.message });
            });
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, error: 'No tab ID available' });
        }
    } else if (message.type === 'setProxy') {
        // Set proxy
        const proxy = parseProxy(message.proxyString);
        setProxy(proxy).then(() => {
            sendResponse({ success: true, proxy: proxy });
        }).catch((error) => {
            sendResponse({ success: false, error: error.message });
        });
        return true; // Keep channel open for async response
    } else if (message.type === 'clearProxy') {
        // Clear proxy
        chrome.proxy.settings.clear({});
        sendResponse({ success: true });
    }
    return true;
});

