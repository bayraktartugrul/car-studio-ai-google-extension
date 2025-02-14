// Proxy URL'i
const PROXY_URL = 'https://api.allorigins.win/raw?url=';

// Background service worker'ı aktif tut
let keepAliveInterval;

function startKeepAlive() {
    keepAliveInterval = setInterval(() => {
        console.log('Background service worker is alive');
    }, 20000);
}

chrome.runtime.onStartup.addListener(startKeepAlive);
chrome.runtime.onInstalled.addListener(startKeepAlive);

// API isteklerini yönet
async function handleAPIRequest(request) {
    try {
        console.log('API isteği başlatılıyor:', {
            endpoint: request.apiEndpoint,
            hasApiKey: !!request.apiKey,
            dataSize: request.data.image.length
        });

        const response = await fetch(request.apiEndpoint, {
            method: 'POST',
            mode: 'cors',
            credentials: 'omit',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': request.apiKey,
                'Origin': 'https://carstudio.ai',
                'Accept': 'application/json'
            },
            body: JSON.stringify(request.data)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return { success: true, data };
    } catch (error) {
        console.error('API Hatası:', error);
        return {
            success: false,
            error: error.message,
            details: {
                type: error.name,
                message: error.message,
                timestamp: new Date().toISOString()
            }
        };
    }
}

// Sabit tanımlamalar
const FIXED_ORIGIN = 'https://carstudio.ai';
const API_ENDPOINT = 'https://tokyo.carstudio.ai/webEditor/uploadImagesWithUrlV2';
const API_KEY = '41cef9753f1c4e979cfa0ecb7e9e4f03';

// Tek bir request origin için fetch fonksiyonu
async function fetchWithFixedOrigin(url, options) {
    const defaultHeaders = {
        'apiKey': API_KEY,
        'Content-Type': 'application/json',
        'Origin': FIXED_ORIGIN,
        'Referer': FIXED_ORIGIN
    };

    const response = await fetch(url, {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers
        }
    });

    return response;
}

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fetchImage') {
        // API isteği
        fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'apiKey': API_KEY,
                'Content-Type': 'application/json',
                'Origin': FIXED_ORIGIN,
                'Referer': FIXED_ORIGIN,
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({
                images: [
                    {
                        fileUrl: request.imageUrl,
                        position: "FRONT"
                    }
                ],
                plateImageUrl: ""
            })
        })
        .then(async response => {
            // Hata durumunda detaylı log
            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Yanıt Detayları:', {
                    status: response.status,
                    statusText: response.statusText,
                    body: errorText,
                    headers: Object.fromEntries(response.headers),
                    requestUrl: request.imageUrl
                });
                throw new Error(`API Error: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success && data.return?.afterStudioImages?.[0]?.imageUrl) {
                sendResponse({ 
                    success: true, 
                    processedImageUrl: data.return.afterStudioImages[0].imageUrl
                });
            } else {
                throw new Error('API yanıtı geçersiz format');
            }
        })
        .catch(error => {
            console.error('API Hatası:', error);
            sendResponse({ 
                success: false, 
                error: error.message 
            });
        });

        return true;
    }

    if (request.action === 'processImage') {
        handleAPIRequest(request)
            .then(response => {
                console.log('İşlem sonucu:', response);
                sendResponse(response);
            })
            .catch(error => {
                console.error('İşlem hatası:', error);
                sendResponse({
                    success: false,
                    error: error.message
                });
            });
        return true;
    }
});

// Service worker'ı uyanık tut
chrome.alarms.create('keepAlive', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'keepAlive') {
        console.log('Service worker is alive');
    }
}); 