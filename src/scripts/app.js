// ?? INICIALIZA��O DO SERVI�O CEP
document.addEventListener('DOMContentLoaded', function() {
  // Auto-complete autom�tico para campos CEP
  if (document.querySelector('#cep')) {
    window.cepService.initAutoComplete('#cep', {
      logradouro: '#logradouro, #endereco',
      bairro: '#bairro',
      cidade: '#cidade, #localidade',
      estado: '#estado, #uf'
    });
  }

  // Exemplo de consulta manual
  window.searchCepManual = async function(cep) {
    try {
      const result = await window.cepService.searchCep(cep);
      console.log('?? Endere�o encontrado:', result);
      return result;
    } catch (error) {
      console.error('? Erro CEP:', error.message);
      alert('CEP n�o encontrado: ' + error.message);
      return null;
    }
  };

  // Exemplo: preencher endere�o via bot�o
  window.fillAddressByCep = async function() {
    const cepInput = document.querySelector('#cep');
    if (!cepInput || !cepInput.value) return;

    const cep = cepInput.value;
    const address = await window.searchCepManual(cep);
    
    if (address) {
      // Disparar eventos para atualizar outros componentes
      document.dispatchEvent(new CustomEvent('addressUpdated', {
        detail: address
      }));
    }
  };
});

// ?? EXEMPLOS DE USO AVAN�ADO:

// 1. Consulta com tratamento de erro
async function validateAddress(cep) {
  try {
    const address = await window.cepService.searchCep(cep);
    
    if (address.cidade.toLowerCase().includes('s�o paulo')) {
      console.log('?? Entregamos em S�o Paulo!');
    }
    
    return address;
  } catch (error) {
    console.warn('?? CEP fora da �rea de entrega');
    return null;
  }
}

// 2. M�ltiplas consultas para rotas
async function calculateShippingRoute(ceps) {
  const results = await window.cepService.searchMultipleCeps(ceps);
  const validAddresses = results.filter(r => r.success).map(r => r.data);
  
  console.log('??? Rota calculada para:', validAddresses.length, 'endere�os');
  return validAddresses;
}

// 3. Integra��o com Google Maps
async function showAddressOnMap(cep) {
  const address = await window.cepService.searchCep(cep);
  
  if (address.latitude && address.longitude) {
    // Usar coordenadas com Google Maps
    if (window.google && window.google.maps) {
      new google.maps.Map(document.getElementById('map'), {
        center: { lat: address.latitude, lng: address.longitude },
        zoom: 15
      });
    }
  }
  
  return address;
}
