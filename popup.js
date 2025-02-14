document.addEventListener('DOMContentLoaded', function() {
    // Geri butonu işleyicisi
    document.getElementById('backToOnboarding').addEventListener('click', () => {
        // Onboarding durumunu sıfırla
        chrome.storage.local.set({ onboardingComplete: false }, () => {
            // Onboarding sayfasına yönlendir
            window.location.href = 'onboarding.html';
        });
    });

    // Önce onboarding kontrolü yap
    chrome.storage.local.get(['onboardingComplete'], function(result) {
        if (!result.onboardingComplete) {
            window.location.href = 'onboarding.html';
            return;
        }
        
        // Onboarding tamamlanmışsa normal popup işlemlerine devam et
        const studioItems = document.querySelectorAll('.studio-item');
        const statusDiv = document.getElementById('status');
        const beforeBtn = document.getElementById('beforeBtn');
        const afterBtn = document.getElementById('afterBtn');
        const viewToggle = document.querySelector('.view-toggle');
        const initialMessage = document.querySelector('.initial-message');

        // Başlangıçta Before/After butonlarını gizle
        viewToggle.style.display = 'none';

        // Seçili stüdyoyu storage'dan al ve uygula
        chrome.storage.local.get(['selectedStudio'], function(result) {
            if (result.selectedStudio) {
                const selectedItem = document.querySelector(`[data-studio="${result.selectedStudio}"]`);
                if (selectedItem) {
                    selectedItem.classList.add('active');
                    initialMessage.style.display = 'none';
                    viewToggle.style.display = 'flex';
                    afterBtn.classList.add('active');
                }
            }
        });

        studioItems.forEach(item => {
            item.addEventListener('click', async function() {
                // İlk mesajı gizle
                initialMessage.style.display = 'none';
                
                // Before/After butonlarını göster
                viewToggle.style.display = 'flex';
                
                document.querySelector('.studio-item.active')?.classList.remove('active');
                this.classList.add('active');
                
                const studioType = this.dataset.studio;
                await chrome.storage.local.set({ selectedStudio: studioType });

                // After görünümünü aktif et
                beforeBtn.classList.remove('active');
                afterBtn.classList.add('active');

                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                chrome.tabs.sendMessage(tab.id, {
                    action: 'changeStudio',
                    studioType: studioType
                });

                statusDiv.textContent = 'Stüdyo uygulanıyor...';
                setTimeout(() => {
                    statusDiv.textContent = 'Stüdyo başarıyla uygulandı!';
                }, 1000);
            });
        });

        beforeBtn.addEventListener('click', async () => {
            beforeBtn.classList.add('active');
            afterBtn.classList.remove('active');
            
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            chrome.tabs.sendMessage(tab.id, {
                action: 'toggleView',
                view: 'before'
            });
        });

        afterBtn.addEventListener('click', async () => {
            afterBtn.classList.add('active');
            beforeBtn.classList.remove('active');
            
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            chrome.tabs.sendMessage(tab.id, {
                action: 'toggleView',
                view: 'after'
            });
        });

        // E-posta test butonu
        const testEmailBtn = document.getElementById('testEmailBtn');
        testEmailBtn.addEventListener('click', async () => {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            chrome.tabs.sendMessage(tab.id, {
                action: 'sendEmailTest'
            });
            
            statusDiv.textContent = 'E-posta gönderiliyor...';
            setTimeout(() => {
                statusDiv.textContent = 'E-posta gönderildi! Lütfen gelen kutunuzu kontrol edin.';
            }, 2000);
        });

        document.querySelectorAll('.studio-option').forEach(option => {
            option.addEventListener('click', function() {
                const studioType = this.dataset.type;
                console.log('Stüdyo seçildi:', studioType);
                
                // Aktif sekmeye mesaj gönder
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'changeStudio',
                        studioType: studioType
                    }, response => {
                        console.log('Stüdyo değişikliği yanıtı:', response);
                    });
                });

                // Seçimi sakla
                chrome.storage.local.set({
                    selectedStudio: studioType
                });
            });
        });
    });
});

function getStudioData(studioId) {
  // Stüdyo verilerini döndür
  const studios = {
    studio1: {
      background: 'backgrounds/studio1.jpg',
      lighting: 'modern',
      // Diğer stüdyo özellikleri
    },
    studio2: {
      background: 'backgrounds/studio2.jpg',
      lighting: 'classic',
      // Diğer stüdyo özellikleri
    }
  };
  
  return studios[studioId];
}

document.getElementById('analyzeBtn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: analyzeImages
    });
});

function analyzeImages() {
    const images = document.getElementsByClassName('car-image');
    for (let img of images) {
        // Burada resim analizi yapılacak
        console.log('Resim bulundu:', img.src);
    }
} 