// ?? Módulo de Consulta CEP com Fallback e Performance
class CepService {
  constructor() {
    this.cache = new Map();
    this.timeout = 5000; // 5 segundos timeout
    this.retryAttempts = 2;
  }

  // ? VALIDAÇÃO DE CEP
  validateCep(cep) {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      throw new Error('CEP deve conter 8 dígitos');
    }
    return cleanCep;
  }

  // ? FORMATAR RESPOSTA PADRÃO
  formatResponse(data, source) {
    const baseResponse = {
      source,
      cep: data.cep,
      logradouro: data.logradouro || data.street || data.address || '',
      bairro: data.bairro || data.neighborhood || '',
      cidade: data.localidade || data.city || '',
      estado: data.uf || data.state || '',
      complemento: data.complemento || data.complement || '',
      ddd: data.ddd || '',
      ibge: data.ibge || data.city_ibge || '',
      gia: data.gia || '',
      siafi: data.siafi || ''
    };

    // Adicionar coordenadas se disponíveis
    if (data.location?.coordinates) {
      baseResponse.latitude = data.location.coordinates.latitude;
      baseResponse.longitude = data.location.coordinates.longitude;
    }

    return baseResponse;
  }

  // ? CONSULTA VIACEP (Primário - Mais rápido)
  async fetchViaCep(cep) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      
      if (data.erro) {
        throw new Error('CEP não encontrado no ViaCEP');
      }

      return this.formatResponse(data, 'viacep');
    } catch (error) {
      clearTimeout(timeoutId);
      throw new Error(`ViaCEP: ${error.message}`);
    }
  }

  // ? CONSULTA BRASILAPI (Fallback - Mais dados)
  async fetchBrasilApi(cep) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      
      if (data.errors) {
        throw new Error('CEP não encontrado na BrasilAPI');
      }

      return this.formatResponse(data, 'brasilapi');
    } catch (error) {
      clearTimeout(timeoutId);
      throw new Error(`BrasilAPI: ${error.message}`);
    }
  }

  // ? ESTRATÉGIA COM FALLBACK AUTOMÁTICO
  async searchCep(cep, useCache = true) {
    const cleanCep = this.validateCep(cep);
    
    // Verificar cache
    if (useCache && this.cache.has(cleanCep)) {
      const cached = this.cache.get(cleanCep);
      // Cache válido por 1 hora
      if (Date.now() - cached.timestamp < 3600000) {
        return { ...cached.data, cached: true };
      }
      this.cache.delete(cleanCep);
    }

    let lastError = null;

    // Tentar ViaCEP primeiro
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const result = await this.fetchViaCep(cleanCep);
        
        // Salvar no cache
        this.cache.set(cleanCep, {
          data: result,
          timestamp: Date.now()
        });

        return result;
      } catch (error) {
        lastError = error;
        if (attempt < this.retryAttempts) {
          await this.delay(500 * attempt); // Backoff exponencial
        }
      }
    }

    // Fallback para BrasilAPI
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const result = await this.fetchBrasilApi(cleanCep);
        
        // Salvar no cache
        this.cache.set(cleanCep, {
          data: result,
          timestamp: Date.now()
        });

        return result;
      } catch (error) {
        lastError = error;
        if (attempt < this.retryAttempts) {
          await this.delay(500 * attempt);
        }
      }
    }

    throw new Error(`Não foi possível consultar o CEP ${cep}. ${lastError?.message}`);
  }

  // ? CONSULTA EM LOTE (Múltiplos CEPs)
  async searchMultipleCeps(ceps, delayBetweenRequests = 100) {
    const results = [];
    
    for (const cep of ceps) {
      try {
        const result = await this.searchCep(cep);
        results.push({ cep, success: true, data: result });
      } catch (error) {
        results.push({ cep, success: false, error: error.message });
      }
      
      // Respeitar rate limit
      if (delayBetweenRequests > 0) {
        await this.delay(delayBetweenRequests);
      }
    }
    
    return results;
  }

  // ? AUTOCOMPLETE PARA FORMULÁRIOS
  initAutoComplete(inputSelector, fieldMappings = {}) {
    const defaultMappings = {
      logradouro: '#logradouro, #rua, #street',
      bairro: '#bairro, #neighborhood',
      cidade: '#cidade, #city, #localidade',
      estado: '#estado, #uf, #state',
      complemento: '#complemento, #complement'
    };

    const mappings = { ...defaultMappings, ...fieldMappings };
    const cepInput = document.querySelector(inputSelector);

    if (!cepInput) {
      console.warn(`CEP input não encontrado: ${inputSelector}`);
      return;
    }

    let searchTimeout;
    
    cepInput.addEventListener('input', (e) => {
      const cep = e.target.value.replace(/\D/g, '');
      
      // Clear previous timeout
      clearTimeout(searchTimeout);
      
      // Search when CEP is complete
      if (cep.length === 8) {
        searchTimeout = setTimeout(async () => {
          try {
            cepInput.disabled = true;
            const result = await this.searchCep(cep);
            this.fillFormFields(mappings, result);
          } catch (error) {
            console.error('Erro na consulta CEP:', error.message);
            this.showError('CEP não encontrado ou inválido');
          } finally {
            cepInput.disabled = false;
          }
        }, 800); // Delay para evitar requests desnecessários
      }
    });
  }

  // ? PREENCHER FORMULÁRIOS AUTOMATICAMENTE
  fillFormFields(mappings, data) {
    Object.entries(mappings).forEach(([field, selectors]) => {
      const elements = document.querySelectorAll(selectors);
      elements.forEach(element => {
        if (data[field] && element.value === '') {
          element.value = data[field];
          
          // Disparar evento para outros scripts
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    });
  }

  // ? MÉTODOS UTILITÁRIOS
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  showError(message) {
    // Você pode customizar isso com sua UI
    console.error('CEP Error:', message);
    
    // Exemplo: mostrar notificação
    if (typeof window.showNotification === 'function') {
      window.showNotification(message, 'error');
    }
  }

  // ? ESTATÍSTICAS E MONITORAMENTO
  getStats() {
    return {
      cacheSize: this.cache.size,
      cachedCeps: Array.from(this.cache.keys()),
      hitRate: this.calculateHitRate()
    };
  }

  calculateHitRate() {
    // Implementar lógica de tracking se necessário
    return 0;
  }

  // ? LIMPAR CACHE
  clearCache() {
    this.cache.clear();
  }

  // ? DESTRUCTOR
  destroy() {
    this.clearCache();
  }
}

// ? INSTÂNCIA GLOBAL SINGLETON
window.cepService = new CepService();

// ? EXPORTAÇÃO PARA MÓDULOS
export default window.cepService;

// ? USO RÁPIDO (Exemplos)
/*
// 1. Consulta simples
cepService.searchCep('01001000')
  .then(data => console.log('Endereço:', data))
  .catch(error => console.error('Erro:', error.message));

// 2. Autocomplete em formulário
cepService.initAutoComplete('#cep', {
  logradouro: '#endereco',
  bairro: '#bairro', 
  cidade: '#cidade',
  estado: '#estado'
});

// 3. Múltiplos CEPs
cepService.searchMultipleCeps(['01001000', '22030060'])
  .then(results => console.log('Resultados:', results));
*/
