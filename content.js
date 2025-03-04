class StudioProcessor {
  constructor() {
    this.backgrounds = {
      modern: `url(${chrome.runtime.getURL('backgrounds/bg-1.jpg')})`,
      classic: `url(${chrome.runtime.getURL('backgrounds/bg-2.jpg')})`,
      dark: `url(${chrome.runtime.getURL('backgrounds/bg-3.jpg')})`,
      light: `url(${chrome.runtime.getURL('backgrounds/bg-4.jpg')})`
    };
    
    // API yapılandırması ve kontrolleri
    this.apiEndpoint = 'https://api.carstudio.ai/api/v1/process';
    this.apiKey = '41cef9753f1c4e979cfa0ecb7e9e4f03';
    
    console.log('Constructor - API Yapılandırması:', {
        endpoint: this.apiEndpoint,
        apiKey: this.apiKey ? 'Mevcut' : 'Eksik'
    });

    if (!this.apiKey) {
        console.error('API key bulunamadı!');
    }

    // Lottie animasyonunu önceden yükle
    this.loadingAnimation = null;
    this.preloadLoadingAnimation();

    this.originalImages = new Map();
    this.detectedImages = new Set(); // Tespit edilen resimleri saklamak için
    this.init();
  }

  async preloadLoadingAnimation() {
    try {
        const response = await fetch(chrome.runtime.getURL('animations/loading.json'));
        this.loadingAnimation = await response.json();
        console.log('Loading animasyonu yüklendi');
    } catch (error) {
        console.error('Loading animasyonu yüklenemedi:', error);
    }
  }

  showLoading(container) {
    const loadingContainer = document.createElement('div');
    loadingContainer.className = 'loading-container';
    loadingContainer.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        background: rgba(0, 0, 0, 0.7);
        z-index: 1000;
    `;

    const animContainer = document.createElement('div');
    animContainer.id = 'lottie-' + Math.random().toString(36).substr(2, 9);
    animContainer.style.cssText = `
        width: 150px;
        height: 150px;
    `;
    loadingContainer.appendChild(animContainer);
    container.appendChild(loadingContainer);

    if (this.loadingAnimation && typeof lottie !== 'undefined') {
        const anim = lottie.loadAnimation({
            container: animContainer,
            renderer: 'svg',
            loop: true,
            autoplay: true,
            animationData: this.loadingAnimation
        });
        loadingContainer.animation = anim;
    } else {
        animContainer.innerHTML = 'Loading...';
    }

    return loadingContainer;
  }

  init() {
    // Sayfa tamamen yüklendiğinde başlat
    if (document.readyState === 'complete') {
      this.startProcessor();
    } else {
      window.addEventListener('load', () => this.startProcessor());
    }
  }

  startProcessor() {
    try {
        // İlk çalıştırma
        this.detectCarImages();

        // Sayfa yüklendiğinde tekrar dene
        if (document.readyState !== 'complete') {
            window.addEventListener('load', () => {
                this.detectCarImages();
            });
        }

        // Dinamik içerik için gözlemci
        const observer = new MutationObserver(this.debounce(() => {
            this.detectCarImages();
        }, 500));

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['src', 'class']
        });

        // Mesaj dinleyicisi
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'changeStudio') {
                console.log('Stüdyo değişikliği istendi:', request.studioType);
                // Önce resimleri tekrar tespit et
                this.detectCarImages();
                // Sonra işleme başla
                setTimeout(() => {
                    this.processDetectedImages(request.studioType);
                }, 500); // Resimlerin tespit edilmesi için kısa bir bekleme
            } else if (request.action === 'toggleView') {
                this.toggleView(request.view);
            }
        });
    } catch (error) {
        console.error('Başlatma hatası:', error);
    }
  }

  detectCarImages() {
    // Mevcut sitenin host adını al
    const currentHost = window.location.hostname.replace('www.', '');
    
    // Site özel selektörler
    const coverSelectors = {
        'autoscout24': 'img',
        'sahibinden.com': '.classifiedDetailMainPhoto img:first-child, #bigPhotos img:first-child',
        'arabam.com': '.listing-image-container img, .gallery-view-container img, .listing-item-image img, .image-container img, .classified-detail-image img, .classified-detail-slider img',
        'cars.com': '.modal-slideshow__image:first-child',
        'mobile.de': '.gallery-img:first-child',
        'cars24.com': '.gallery-image img, .car-image img, .vehicle-image img',
        'facebook.com': 'img[src*="scontent"]'
    };

    // Arabam.com için özel kontrol
    if (currentHost.includes('arabam.com')) {
        const images = document.querySelectorAll(coverSelectors['arabam.com']);
        console.log('Arabam.com resimleri bulundu:', images.length);
        
        images.forEach(img => {
            if (!this.detectedImages.has(img) && this.isValidCarImage(img)) {
                console.log('Arabam.com resmi işleniyor:', img.src);
                img.classList.add('car-cover-image');
                this.detectedImages.add(img);
                this.prepareContainer(img);
            }
        });
        return;
    }

    // Cars24 için özel kontrol
    if (currentHost.includes('cars24.com')) {
        const images = document.querySelectorAll('.gallery-image img, .car-image img, .vehicle-image img');
        images.forEach(img => {
            if (!this.detectedImages.has(img) && this.isValidCarImage(img)) {
                img.classList.add('car-cover-image');
                this.detectedImages.add(img);
                this.prepareContainer(img);
            }
        });
        return;
    }

    // Diğer siteler için genel kontrol
    const selector = coverSelectors[currentHost] || 
        '.vehicle-image img:first-child, .car-gallery img:first-child, .main-photo img:first-child';

    const coverImage = document.querySelector(selector);
    
    if (coverImage && !this.detectedImages.has(coverImage)) {
        console.log('Kapak resmi tespit edildi:', coverImage.src);
        coverImage.classList.add('car-cover-image');
        this.detectedImages.add(coverImage);
        this.prepareContainer(coverImage);
    }
  }

  isLikelyCarImage(img) {
    // Minimum boyut kontrolü
    const minWidth = 100;
    const minHeight = 100;

    // Boyut kontrolü
    if (img.naturalWidth < minWidth || img.naturalHeight < minHeight) {
        return false;
    }

    // Araç ile ilgili anahtar kelimeler
    const carKeywords = [
        'car', 'auto', 'vehicle', 'araç', 'araba', 'otomobil',
        'sedan', 'suv', 'truck', 'pickup', 'van', 'wagon',
        'bmw', 'mercedes', 'audi', 'toyota', 'honda', 'ford',
        'chevrolet', 'volkswagen', 'hyundai', 'kia', 'listing',
        'gallery', 'detail', 'photo'
    ];

    // Resim kaynağı ve çevresi kontrolü
    const contextText = (
        img.src.toLowerCase() + ' ' + 
        img.alt.toLowerCase() + ' ' + 
        img.className.toLowerCase() + ' ' +
        (img.closest('[class*="car"],[class*="vehicle"],[class*="gallery"],[class*="listing"]')?.className || '') + ' ' +
        (img.closest('[id*="car"],[id*="vehicle"],[id*="gallery"],[id*="listing"]')?.id || '')
    );

    // Parent element kontrolü
    const hasRelevantParent = img.closest(
        '[class*="car"],[class*="vehicle"],[class*="gallery"],[class*="listing"],' +
        '[id*="car"],[id*="vehicle"],[id*="gallery"],[id*="listing"]'
    ) !== null;

    // URL yapısı kontrolü
    const urlIndicatesVehicle = carKeywords.some(keyword => img.src.toLowerCase().includes(keyword));

    // Aspect ratio kontrolü (araç fotoğrafları genellikle yatay olur)
    const ratio = img.naturalWidth / img.naturalHeight;
    const hasValidRatio = ratio >= 1 && ratio <= 2;

    return (
        hasValidRatio &&
        (
            urlIndicatesVehicle ||
            hasRelevantParent ||
            carKeywords.some(keyword => contextText.includes(keyword))
        )
    );
  }

  isImageVisible(img) {
    const rect = img.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  observePageChanges() {
    const observer = new MutationObserver(this.debounce(() => {
      this.detectCarImages();
    }, 300));

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  async processImage(img, studioType) {
    try {
        const container = img.closest('.studio-container');
        const loadingContainer = this.showLoading(container);

        const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: 'fetchImage',
                imageUrl: img.src
            }, response => {
                if (response?.success) {
                    resolve(response.processedImageUrl);
                } else {
                    reject(new Error(response?.error || 'İşlem başarısız'));
                }
            });
        });

        this.originalImages.set(img, img.cloneNode(true));
        img.src = response;
        container.style.background = this.backgrounds[studioType];
        container.style.backgroundSize = 'cover';

        if (loadingContainer.animation) {
            loadingContainer.animation.destroy();
        }
        loadingContainer.remove();
    } catch (error) {
        console.error('İşlem hatası:', error);
        this.showError(container, error.message);
    }
  }

  // Yeni metod: Sadece container hazırla
  prepareContainer(img) {
    // Eğer resim zaten bir container içindeyse, yeni container oluşturma
    if (img.closest('.studio-container')) return;

    // Resmin orijinal boyutlarını ve stilini sakla
    const originalWidth = img.width || img.naturalWidth;
    const originalHeight = img.height || img.naturalHeight;
    const originalStyle = {
        width: img.style.width,
        height: img.style.height,
        maxWidth: img.style.maxWidth,
        maxHeight: img.style.maxHeight
    };

    // Container oluştur
    const container = document.createElement('div');
    container.className = 'studio-container';
    
    // Container stilini ayarla - orijinal boyutları koru
    container.style.cssText = `
        position: relative;
        width: ${originalWidth}px;
        height: ${originalHeight}px;
        overflow: hidden;
        border-radius: 8px;
        transition: all 0.3s ease;
        background-size: cover;
        background-position: center;
        display: inline-block;
        margin: 0;
        padding: 0;
    `;

    // Resmi container'a taşı
    const parent = img.parentNode;
    parent.insertBefore(container, img);
    container.appendChild(img);

    // Resmin stilini ayarla - orijinal boyutları koru
    img.style.cssText = `
        width: ${originalWidth}px !important;
        height: ${originalHeight}px !important;
        object-fit: contain;
        display: block;
        transition: opacity 0.3s ease;
        margin: 0;
        padding: 0;
        max-width: none !important;
        max-height: none !important;
    `;

    console.log('Container oluşturuldu:', {
        imgSrc: img.src,
        originalWidth,
        originalHeight,
        containerWidth: container.offsetWidth,
        containerHeight: container.offsetHeight
    });

    // Boyutları doğru olduğundan emin ol
    setTimeout(() => {
        if (container.offsetWidth !== originalWidth || container.offsetHeight !== originalHeight) {
            container.style.width = originalWidth + 'px';
            container.style.height = originalHeight + 'px';
            img.style.width = originalWidth + 'px';
            img.style.height = originalHeight + 'px';
        }
    }, 100);
  }

  // Yeni metod: Tespit edilen resimleri işle
  async processDetectedImages(studioType) {
    try {
        // Tüm car-cover-image sınıflı resimleri bul
        const carImages = document.querySelectorAll('.car-cover-image');
        const imageCount = carImages.length;
        
        console.log('İşlem başlıyor:', {
            bulunanResimSayisi: imageCount,
            studioType: studioType
        });

        if (imageCount === 0) {
            console.log('Resim bulunamadı, tekrar tespit deneniyor...');
            this.detectCarImages();
            // Tekrar kontrol et
            const newCarImages = document.querySelectorAll('.car-cover-image');
            console.log('Tekrar tespit sonrası resim sayısı:', newCarImages.length);
            if (newCarImages.length === 0) {
                console.log('Hala resim bulunamadı');
                return;
            }
        }

        // Her resim için işlem yap
        for (const img of carImages) {
            if (!img.classList.contains('processing')) {
                img.classList.add('processing');
                
                const container = img.closest('.studio-container');
                if (!container) {
                    console.log('Container bulunamadı, yeni oluşturuluyor:', img.src);
                    this.prepareContainer(img);
                    continue;
                }

                // Loading göstergesi
                const loadingDiv = document.createElement('div');
                loadingDiv.className = 'loading-indicator';
                loadingDiv.textContent = 'İşleniyor...';
                loadingDiv.style.cssText = `
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: rgba(0,0,0,0.7);
                    color: white;
                    padding: 10px 20px;
                    border-radius: 4px;
                    z-index: 2;
                `;
                container.appendChild(loadingDiv);

                try {
                    // API isteği gönder
                    const response = await new Promise((resolve, reject) => {
                        chrome.runtime.sendMessage({
                            action: 'fetchImage',
                            imageUrl: img.src
                        }, response => {
                            if (response?.success) {
                                resolve(response);
                            } else {
                                reject(new Error(response?.error || 'API hatası'));
                            }
                        });
                    });

                    // Orijinal resmi sakla
                    this.originalImages.set(img, img.cloneNode(true));

                    // İşlenmiş resmi göster
                    img.src = response.processedImageUrl;
                    container.style.background = this.backgrounds[studioType];

                    console.log('Resim işlendi:', {
                        original: this.originalImages.get(img).src,
                        processed: response.processedImageUrl
                    });
                } catch (error) {
                    console.error('Resim işleme hatası:', error);
                    loadingDiv.textContent = 'Hata: ' + error.message;
                } finally {
                    // Loading göstergesini kaldır
                    setTimeout(() => loadingDiv.remove(), 1000);
                }
            }
        }
    } catch (error) {
        console.error('processDetectedImages hatası:', error);
    }
  }

  toggleView(view) {
    // Tüm studio containerları al
    const containers = document.getElementsByClassName('studio-container');
    if (!containers || containers.length === 0) {
        console.log('İşlenmiş resim bulunamadı');
        return;
    }

    // Her container için işlem yap
    Array.from(containers).forEach(container => {
        const img = container.querySelector('img');
        if (!img) {
            console.log('Container içinde resim bulunamadı');
            return;
        }

        if (view === 'before') {
            const originalImg = this.originalImages.get(img);
            if (originalImg) {
                img.src = originalImg.src;
                container.style.background = 'none';
                console.log('Orijinal resme geçildi:', originalImg.src);
            } else {
                console.log('Orijinal resim bulunamadı');
            }
        } else {
            chrome.storage.local.get(['selectedStudio'], (result) => {
                if (result.selectedStudio) {
                    this.processImage(img, result.selectedStudio);
                    console.log('İşlenmiş resme geçildi:', img.src);
                } else {
                    console.log('Seçili stüdyo bulunamadı');
                }
            });
        }
    });
  }

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Yeni metod: Resmin geçerli bir araç resmi olup olmadığını kontrol et
  isValidCarImage(img) {
    // 1. Resim yüklenme kontrolü
    if (!img.complete) {
        img.onload = () => this.detectCarImages();
        return false;
    }

    // 2. URL kontrolü - Arabam.com ve diğer siteler için
    const validUrls = [
        'prod.pictures.autoscout24',
        'arbstorage.mncdn.com',
        'img.arabam.com',
        'arbstorage.mncdn.com'
    ];
    
    // URL kontrolü
    if (validUrls.some(domain => img.src.includes(domain))) {
        return true;
    }

    // 3. Resim boyutu kontrolü
    if (img.naturalWidth < 200 || img.naturalHeight < 150) {
        return false;
    }

    // 4. Resim container kontrolü
    const hasValidContainer = img.closest('.listing-image-container') || 
                            img.closest('.gallery-view-container') ||
                            img.closest('.listing-item-image') ||
                            img.closest('.image-container') ||
                            img.closest('.classified-detail-image') ||
                            img.closest('.classified-detail-slider');

    return hasValidContainer;
  }

  // Yeni yardımcı metod
  processMainImage(mainImage) {
    if (!this.detectedImages.has(mainImage)) {
        mainImage.classList.add('car-cover-image');
        this.detectedImages.add(mainImage);
        this.prepareContainer(mainImage);
    }
  }

  // Yeni metod: Liste resmi kontrolü
  isValidListingImage(img) {
    // Resmin görünür olduğundan emin ol
    if (!img.complete || !img.naturalWidth) return false;

    // Minimum boyut kontrolü
    if (img.naturalWidth < 200 || img.naturalHeight < 150) return false;

    // Resmin bir liste öğesi içinde olduğunu kontrol et
    const isInListItem = img.closest('article') || 
                        img.closest('.ListItem') || 
                        img.closest('[data-type="listing"]');

    if (!isInListItem) return false;

    // Resmin URL'sinde araç resmi olduğunu gösteren kelimeler
    const validUrlPatterns = [
        'vehicle', 'car', 'auto', 'listing-image', 
        'gallery', 'main', 'cover', 'thumbnail'
    ];

    return validUrlPatterns.some(pattern => img.src.toLowerCase().includes(pattern));
  }
}

// Güvenli başlatma
try {
  const studioProcessor = new StudioProcessor();
} catch (error) {
  console.error('Extension başlatma hatası:', error);
}