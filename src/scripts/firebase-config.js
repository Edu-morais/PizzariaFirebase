// Configuração otimizada do Firebase com lazy loading
class FirebaseManager {
  constructor() {
    this.app = null;
    this.db = null;
    this.auth = null;
    this.storage = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Carregar configuração do Firebase
      const response = await fetch("/api/getFirebaseConfig");
      const { config } = await response.json();
      
      const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js");
      const { getFirestore, enableIndexedDbPersistence } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
      const { getAuth } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
      const { getStorage } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js");
      
      this.app = initializeApp(config);
      this.db = getFirestore(this.app);
      this.auth = getAuth(this.app);
      this.storage = getStorage(this.app);
      
      // Habilitar cache offline para performance
      await enableIndexedDbPersistence(this.db);
      
      this.initialized = true;
      console.log("Firebase initialized with performance optimizations");
    } catch (error) {
      console.error("Firebase initialization error:", error);
    }
  }

  getFirestore() {
    if (!this.initialized) throw new Error("Firebase not initialized");
    return this.db;
  }

  getAuth() {
    if (!this.initialized) throw new Error("Firebase not initialized");
    return this.auth;
  }

  getStorage() {
    if (!this.initialized) throw new Error("Firebase not initialized");
    return this.storage;
  }
}

// Singleton global
window.firebaseManager = new FirebaseManager();
export default window.firebaseManager;
