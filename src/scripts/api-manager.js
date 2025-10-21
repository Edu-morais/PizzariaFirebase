// Gerenciador de APIs com foco em performance e segurança
class APIManager {
  constructor() {
    this.cache = new Map();
    this.requestQueue = new Map();
  }

  // ? GOOGLE MAPS (Carregamento otimizado)
  async loadGoogleMaps() {
    const cacheKey = "google-maps";
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    if (this.requestQueue.has(cacheKey)) {
      return this.requestQueue.get(cacheKey);
    }

    const loadPromise = new Promise(async (resolve) => {
      try {
        const response = await fetch("/api/getMapConfig");
        const { config } = await response.json();
        
        const { Loader } = await import("https://unpkg.com/@googlemaps/js-api-loader@1.16.2/dist/index.mjs");
        
        const loader = new Loader({
          apiKey: config.apiKey,
          version: "weekly",
          libraries: config.libraries,
          language: config.language,
          region: config.region
        });

        await loader.load();
        this.cache.set(cacheKey, window.google);
        resolve(window.google);
      } catch (error) {
        console.error("Google Maps loading error:", error);
        resolve(null);
      } finally {
        this.requestQueue.delete(cacheKey);
      }
    });

    this.requestQueue.set(cacheKey, loadPromise);
    return loadPromise;
  }

  // ? WHATSAPP (Otimizado)
  async sendWhatsApp(phone, message, name = "") {
    try {
      const response = await fetch("/api/sendWhatsAppMessage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone,
          message: \`\${message}\${name ? \` - \${name}\` : ""}\`,
          name
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Abrir em nova aba
        window.open(result.url, "_blank", "noopener,noreferrer");
        return true;
      }
      return false;
    } catch (error) {
      console.error("WhatsApp error:", error);
      return false;
    }
  }

  // ? CORREIOS (Com cache)
  async calculateShipping(addressData) {
    const cacheKey = \`shipping-\${JSON.stringify(addressData)}\`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const response = await fetch("/api/calculateShipping", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(addressData)
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Cache por 5 minutos
        this.cache.set(cacheKey, result);
        setTimeout(() => this.cache.delete(cacheKey), 300000);
      }
      
      return result;
    } catch (error) {
      console.error("Correios API error:", error);
      return {success: false, error: error.message};
    }
  }

  // ? GMAIL (Com retry)
  async sendEmail(emailData, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch("/api/sendEmail", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(emailData)
        });
        
        return await response.json();
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  // ? HEALTH CHECK
  async checkHealth() {
    try {
      const response = await fetch("/api/healthCheck");
      return await response.json();
    } catch (error) {
      return {status: "unhealthy", error: error.message};
    }
  }

  // Limpar cache
  clearCache() {
    this.cache.clear();
  }
}

// Singleton global
window.apiManager = new APIManager();
export default window.apiManager;
