// ?? INICIALIZAÇÃO DO SERVIÇO CEP
document.addEventListener('DOMContentLoaded', function() {
  // Auto-complete automático para campos CEP
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
      console.log('?? Endereço encontrado:', result);
      return result;
    } catch (error) {
      console.error('? Erro CEP:', error.message);
      alert('CEP não encontrado: ' + error.message);
      return null;
    }
  };

  // Exemplo: preencher endereço via botão
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

// ?? EXEMPLOS DE USO AVANÇADO:

// 1. Consulta com tratamento de erro
async function validateAddress(cep) {
  try {
    const address = await window.cepService.searchCep(cep);
    
    if (address.cidade.toLowerCase().includes('são paulo')) {
      console.log('?? Entregamos em São Paulo!');
    }
    
    return address;
  } catch (error) {
    console.warn('?? CEP fora da área de entrega');
    return null;
  }
}

// 2. Múltiplas consultas para rotas
async function calculateShippingRoute(ceps) {
  const results = await window.cepService.searchMultipleCeps(ceps);
  const validAddresses = results.filter(r => r.success).map(r => r.data);
  
  console.log('??? Rota calculada para:', validAddresses.length, 'endereços');
  return validAddresses;
}

// 3. Integração com Google Maps
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
