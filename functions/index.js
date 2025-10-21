const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const axios = require("axios");
const cors = require("cors")({origin: true});
const express = require("express");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

admin.initializeApp();

// Configuração de segurança com Helmet e Rate Limiting
const app = express();
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'\'self'"],
      scriptSrc: ["'\'self'", "'\'unsafe-inline'", "https://apis.google.com", "https://maps.googleapis.com"],
      styleSrc: ["'\'self'", "'\'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'\'self'", "data:", "https:"],
      connectSrc: ["'\'self'", "https://firestore.googleapis.com", "https://maps.googleapis.com"]
    }
  }
}));
app.use(compression());
app.use(express.json({limit: "10kb"}));

// Rate Limiting - Segurança contra ataques
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // limite de 100 requests por IP
});
app.use(limiter);

// ? API GOOGLE MAPS (Otimizada)
exports.getMapConfig = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const mapConfig = {
        apiKey: process.env.GOOGLE_MAPS_API_KEY,
        libraries: ["places", "geometry"],
        language: "pt-BR",
        region: "BR"
      };
      
      // Cache por 1 hora para performance
      res.set("Cache-Control", "public, max-age=3600");
      res.json({success: true, config: mapConfig});
    } catch (error) {
      res.status(500).json({success: false, error: error.message});
    }
  });
});

// ? API GMAIL (Segura e Otimizada)
const gmailTransporter = nodemailer.createTransporter({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  },
  pool: true, // Conexões persistentes para performance
  maxConnections: 5,
  maxMessages: 100
});

exports.sendEmail = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const { to, subject, html, text } = req.body;
      
      const mailOptions = {
        from: process.env.GMAIL_USER,
        to,
        subject: subject || "Contato - Pizzaria MMS",
        html: html || text,
        text: text || html
      };
      
      await gmailTransporter.sendMail(mailOptions);
      res.json({success: true, message: "E-mail enviado com sucesso!"});
    } catch (error) {
      res.status(500).json({success: false, error: error.message});
    }
  });
});

// ? API CORREIOS (Com cache para performance)
const correiosCache = new Map();
exports.calculateShipping = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const { cep, peso, comprimento, altura, largura } = req.body;
      const cacheKey = \`\${cep}-\${peso}\`;
      
      // Verificar cache (5 minutos)
      if (correiosCache.has(cacheKey)) {
        const cached = correiosCache.get(cacheKey);
        if (Date.now() - cached.timestamp < 300000) {
          res.json({...cached.data, cached: true});
          return;
        }
      }
      
      const response = await axios.post("https://api.correios.com.br/preco/v1/nacional", {
        cepOrigem: "00000000", // Seu CEP
        cepDestino: cep,
        peso,
        comprimento,
        altura,
        largura,
        servico: ["04014", "04510"] // SEDEX e PAC
      }, {
        headers: {
          "Authorization": \`Bearer \${process.env.CORREIOS_TOKEN}\`,
          "Content-Type": "application/json"
        }
      });
      
      const result = {
        success: true,
        data: response.data,
        timestamp: Date.now()
      };
      
      // Salvar no cache
      correiosCache.set(cacheKey, result);
      res.json(result);
    } catch (error) {
      res.status(500).json({success: false, error: error.message});
    }
  });
});

// ? API WHATSAPP (Otimizada)
exports.sendWhatsAppMessage = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const { phone, message, name } = req.body;
      
      // Formatar número (remover caracteres não numéricos)
      const formattedPhone = phone.replace(/\D/g, "");
      
      const whatsappUrl = \`https://api.whatsapp.com/send?phone=55\${formattedPhone}&text=\${encodeURIComponent(message)}\`;
      
      res.json({
        success: true, 
        url: whatsappUrl,
        message: "Link WhatsApp gerado com sucesso"
      });
    } catch (error) {
      res.status(500).json({success: false, error: error.message});
    }
  });
});

// ? HEALTH CHECK (Monitoramento de performance)
exports.healthCheck = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    const health = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: "1.0.0"
    };
    
    res.set("Cache-Control", "no-cache");
    res.json(health);
  });
});

// ? FIREBASE CONFIG (Otimizado)
exports.getFirebaseConfig = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    const config = {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID
    };
    
    res.set("Cache-Control", "public, max-age=86400"); // 24 horas
    res.json(config);
  });
});

exports.api = functions.https.onRequest(app);
