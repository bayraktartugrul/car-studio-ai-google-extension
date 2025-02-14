const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({limit: '50mb'}));

// Debug için
console.log('Başlangıç yapılandırması:', {
    user: process.env.EMAIL_USER,
    passLength: process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0
});

// Gmail SMTP yapılandırması
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// SMTP bağlantısını test et
transporter.verify((error, success) => {
    if (error) {
        console.error('SMTP Bağlantı hatası:', error);
    } else {
        console.log('SMTP sunucusu hazır');
    }
});

app.post('/send', async (req, res) => {
    try {
        console.log('Gelen istek:', req.body);
        const { to, subject, data } = req.body;

        const mailOptions = {
            from: `"Araç Stüdyo" <${process.env.EMAIL_USER}>`,
            to: to,
            subject: subject,
            html: `
                <h2>Araç Stüdyo Extension Kullanım Raporu</h2>
                <p><strong>URL:</strong> ${data.url}</p>
                <p><strong>Domain:</strong> ${data.domain}</p>
                <p><strong>Tarih:</strong> ${data.timestamp}</p>
                <p><strong>Tarayıcı:</strong> ${data.userAgent}</p>
                <p><strong>Sayfa Başlığı:</strong> ${data.title}</p>
                <p><strong>Seçilen Stüdyo:</strong> ${data.selectedStudio || 'Seçilmedi'}</p>
                <p><strong>Tespit Edilen Araç Sayısı:</strong> ${data.detectedCars}</p>
            `
        };

        console.log('Mail gönderiliyor...');
        const info = await transporter.sendMail(mailOptions);
        console.log('Mail gönderildi:', info.response);

        res.status(200).json({
            message: 'Email sent successfully',
            messageId: info.messageId
        });
    } catch (error) {
        console.error('Mail gönderme hatası:', error);
        res.status(500).json({
            error: 'Email sending failed',
            details: error.message
        });
    }
});

// Test endpoint
app.get('/test', async (req, res) => {
    try {
        // Test e-postası gönder
        const info = await transporter.sendMail({
            from: `"Test" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_USER,
            subject: 'Test E-postası',
            html: '<h1>Test başarılı!</h1>'
        });

        res.json({
            status: 'Email service is running and tested',
            testMailId: info.messageId
        });
    } catch (error) {
        res.status(500).json({
            error: 'Test failed',
            details: error.message
        });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Email service running on port ${PORT}`);
    console.log('Email configuration:', {
        user: process.env.EMAIL_USER,
        pass: '****' + process.env.EMAIL_PASS.slice(-4)
    });
}); 