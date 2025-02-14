// Animasyon için araba resmini ekle
document.querySelector('.car-animation').style.backgroundImage = "url('icons/favicon.png')";

document.addEventListener('DOMContentLoaded', async function() {
    // Eski favicon background'ı kaldır
    document.querySelector('.car-animation').style.backgroundImage = '';
    
    try {
        // GIF'in URL'sini al ve ayarla
        const gifUrl = chrome.runtime.getURL('images/carstudio-ai.gif');
        console.log('GIF URL:', gifUrl);
        
        const gifElement = document.getElementById('carGif');
        if (gifElement) {
            gifElement.src = gifUrl;
            gifElement.onload = () => console.log('GIF başarıyla yüklendi');
            gifElement.onerror = (e) => console.error('GIF yüklenemedi:', e);
        }

        // Onboarding kontrolü
        const result = await chrome.storage.local.get(['onboardingComplete']);
        if (result.onboardingComplete) {
            window.location.href = 'popup.html';
        }
    } catch (error) {
        console.error('Onboarding hatası:', error);
    }
});

// Get Started butonu için event listener
document.getElementById('getStarted').addEventListener('click', () => {
    chrome.storage.local.set({ onboardingComplete: true }, () => {
        window.location.href = 'popup.html';
    });
}); 