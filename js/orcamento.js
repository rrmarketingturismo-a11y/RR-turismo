/* ==========================================================================
   RR TURISMO - SISTEMA DE ORÇAMENTOS (JAVASCRIPT PRINCIPAL COM SUPABASE CLOUD)
   ========================================================================== */

(function () {
  'use strict';

  // --- CONFIGURAÇÃO DO SUPABASE CLOUD (SINCRONIZAÇÃO EM TEMPO REAL) ---
  // Insira a URL e a Anon Key do seu projeto Supabase abaixo:
  const SUPABASE_URL = 'https://uyylbgyxbhppkhdjgoxq.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_WUH3JoVUU9dNLbiMH_AxRQ_Iic6ESqz';

  let supabaseClient = null;
  if (typeof window.supabase !== 'undefined' && SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (e) {
      console.warn('Supabase não inicializado:', e);
    }
  }

  // --- DADOS INICIAIS DE FÁBRICA (SEED DATA) ---
  const DEFAULT_PRODUCTS = [
    { id: 'prod_1', name: 'Assessoria Visto Procura de Trabalho - Portugal', category: 'Vistos & Imigração', price: 3500.00, desc: 'Montagem de dossiê, agendamento consular e suporte documental.' },
    { id: 'prod_2', name: 'Assessoria Visto D2 (Empreendedor) / D7 (Rendimentos)', category: 'Vistos & Imigração', price: 4800.00, desc: 'Elaboração de dossiê financeiro/plano de negócios e acompanhamento consular.' },
    { id: 'prod_3', name: 'Combo NIF + NISS + Abertura de Conta Bancária', category: 'Documentação', price: 1200.00, desc: 'Obtenção de NIF, NISS e conta em Portugal com representante fiscal.' },
    { id: 'prod_4', name: 'Emissão e Validação de PB4 (CDAM)', category: 'Documentação', price: 450.00, desc: 'Certificado de saúde Brasil/Portugal junto ao Ministério da Saúde.' },
    { id: 'prod_5', name: 'Apostilamento de Haia (Por Documento)', category: 'Documentação', price: 180.00, desc: 'Apostilamento de certidões para validade legal internacional.' },
    { id: 'prod_6', name: 'Reserva Otimizada de Passagem Aérea', category: 'Passagens', price: 350.00, desc: 'Pesquisa tarifária inteligente e emissão de reserva confirmada.' },
    { id: 'prod_7', name: 'Translado VIP Aeroporto (Lisboa/Porto)', category: 'Recepção', price: 280.00, desc: 'Recepção no desembarque com motorista privativo até a acomodação.' },
    { id: 'prod_8', name: 'Seguro Viagem Internacional (€30.000)', category: 'Seguros', price: 320.00, desc: 'Seguro obrigatório Tratado de Schengen com cobertura médica.' },
    { id: 'prod_9', name: 'Assessoria de Acomodação / Carta Convite', category: 'Hospedagem', price: 650.00, desc: 'Arrendamento residencial temporário ou termo de responsabilidade.' },
    { id: 'prod_10', name: 'Pacote Imigração Europa Completo VIP', category: 'Pacotes VIP', price: 5900.00, desc: 'Solução 360º: Visto + NIF/NISS + Conta + Voo + Suporte na chegada.' }
  ];

  const DEFAULT_SELLERS = [
    { id: 'sell_1', name: 'Rodrigo Rodrigues', role: 'Consultor Especialista em Imigração', phone: '5514996321001', email: 'rodrigo@rrturismo.com.br' },
    { id: 'sell_2', name: 'Mariana Silva', role: 'Consultora de Vistos Consulares', phone: '5514996321002', email: 'vendas@rrturismo.com.br' },
    { id: 'sell_3', name: 'Lucas Oliveira', role: 'Atendimento ao Cliente', phone: '5514996321003', email: 'atendimento@rrturismo.com.br' }
  ];

  // --- GERENCIADOR DE ESTADO DA APLICAÇÃO ---
  const AppState = {
    products: [],
    sellers: [],
    quotesHistory: [],
    cart: [],
    currentQuote: null,

    async init() {
      const savedProds = localStorage.getItem('rr_products');
      this.products = savedProds ? JSON.parse(savedProds) : [...DEFAULT_PRODUCTS];
      if (!savedProds) this.saveProducts();

      const savedSellers = localStorage.getItem('rr_sellers');
      this.sellers = savedSellers ? JSON.parse(savedSellers) : [...DEFAULT_SELLERS];
      if (!savedSellers) this.saveSellers();

      const savedQuotes = localStorage.getItem('rr_quotes');
      this.quotesHistory = savedQuotes ? JSON.parse(savedQuotes) : [];

      if (supabaseClient) {
        await this.syncFromCloud();
      }
    },

    async syncFromCloud() {
      if (!supabaseClient) return;
      try {
        const { data: cloudProds, error: pErr } = await supabaseClient.from('rr_products').select('*');
        if (!pErr && cloudProds && cloudProds.length > 0) {
          this.products = cloudProds;
          localStorage.setItem('rr_products', JSON.stringify(this.products));
        }

        const { data: cloudSellers, error: sErr } = await supabaseClient.from('rr_sellers').select('*');
        if (!sErr && cloudSellers && cloudSellers.length > 0) {
          this.sellers = cloudSellers;
          localStorage.setItem('rr_sellers', JSON.stringify(this.sellers));
        }

        const { data: cloudQuotes, error: qErr } = await supabaseClient.from('rr_quotes').select('*').order('created_at', { ascending: false });
        if (!qErr && cloudQuotes && cloudQuotes.length > 0) {
          this.quotesHistory = cloudQuotes.map(q => typeof q.data === 'string' ? JSON.parse(q.data) : (q.data || q));
          localStorage.setItem('rr_quotes', JSON.stringify(this.quotesHistory));
        }

        populateDropdowns();
        renderProductsList();
        renderSellersList();
        renderHistory();
      } catch (err) {
        console.warn('Erro ao sincronizar do Supabase Cloud:', err);
      }
    },

    async saveProducts() {
      localStorage.setItem('rr_products', JSON.stringify(this.products));
      if (supabaseClient) {
        try {
          await supabaseClient.from('rr_products').upsert(this.products);
        } catch (e) { console.warn('Erro no upload de produto:', e); }
      }
    },

    async saveSellers() {
      localStorage.setItem('rr_sellers', JSON.stringify(this.sellers));
      if (supabaseClient) {
        try {
          await supabaseClient.from('rr_sellers').upsert(this.sellers);
        } catch (e) { console.warn('Erro no upload de vendedor:', e); }
      }
    },

    async saveQuotes() {
      localStorage.setItem('rr_quotes', JSON.stringify(this.quotesHistory));
      if (supabaseClient && this.currentQuote) {
        try {
          await supabaseClient.from('rr_quotes').upsert([{ id: this.currentQuote.id, data: this.currentQuote, created_at: this.currentQuote.date }]);
        } catch (e) { console.warn('Erro no upload do orçamento:', e); }
      }
    }
  };

  // --- ELEMENTOS DO DOM ---
  const DOM = {
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),

    sellerSelect: document.getElementById('sellerSelect'),
    clientName: document.getElementById('clientName'),
    clientDestination: document.getElementById('clientDestination'),
    quoteValidity: document.getElementById('quoteValidity'),
    quoteNotes: document.getElementById('quoteNotes'),
    paymentMethod: document.getElementById('paymentMethod'),
    installmentsCount: document.getElementById('installmentsCount'),
    discountType: document.getElementById('discountType'),
    discountValue: document.getElementById('discountValue'),
    downPaymentValue: document.getElementById('downPaymentValue'),

    productSelect: document.getElementById('productSelect'),
    quickAddBtn: document.getElementById('quickAddBtn'),
    cartTableBody: document.getElementById('cartTableBody'),
    emptyCartState: document.getElementById('emptyCartState'),
    cartCountBadge: document.getElementById('cartCountBadge'),

    subtotalDisplay: document.getElementById('subtotalDisplay'),
    discountDisplay: document.getElementById('discountDisplay'),
    totalDisplay: document.getElementById('totalDisplay'),
    paymentSummaryDetails: document.getElementById('paymentSummaryDetails'),
    btnGenerateQuote: document.getElementById('btnGenerateQuote'),

    productForm: document.getElementById('productForm'),
    productSearchInput: document.getElementById('productSearchInput'),
    productCategoryFilter: document.getElementById('productCategoryFilter'),
    productsTableBody: document.getElementById('productsTableBody'),
    
    sellerForm: document.getElementById('sellerForm'),
    sellersListContainer: document.getElementById('sellersListContainer'),

    historyTableBody: document.getElementById('historyTableBody'),
    historyCountBadge: document.getElementById('historyCountBadge'),

    quoteModal: document.getElementById('quoteModal'),
    btnCloseModal: document.getElementById('btnCloseModal'),
    quotePaperContent: document.getElementById('quotePaperContent'),
    btnPrintQuote: document.getElementById('btnPrintQuote'),
    btnWhatsappQuote: document.getElementById('btnWhatsappQuote'),
    btnCopyQuoteText: document.getElementById('btnCopyQuoteText'),

    // Modal de Edição
    editProductModal: document.getElementById('editProductModal'),
    editProductForm: document.getElementById('editProductForm'),
    editProdId: document.getElementById('editProdId'),
    editProdName: document.getElementById('editProdName'),
    editProdCat: document.getElementById('editProdCat'),
    editProdPrice: document.getElementById('editProdPrice'),
    editProdDesc: document.getElementById('editProdDesc'),
    btnCloseEditModal: document.getElementById('btnCloseEditModal'),
    btnCancelEditModal: document.getElementById('btnCancelEditModal'),

    printArea: document.getElementById('printArea')
  };

  function formatMoney(val) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  }

  function formatDate(dateStr) {
    const d = dateStr ? new Date(dateStr) : new Date();
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function setupTabs() {
    DOM.tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');

        DOM.tabBtns.forEach(b => b.classList.remove('active'));
        DOM.tabContents.forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById(targetTab).classList.add('active');
      });
    });
  }

  function populateDropdowns() {
    DOM.sellerSelect.innerHTML = '<option value="">-- Selecione o Vendedor Responsável --</option>';
    AppState.sellers.forEach(seller => {
      const opt = document.createElement('option');
      opt.value = seller.id;
      opt.textContent = `${seller.name} (${seller.role})`;
      DOM.sellerSelect.appendChild(opt);
    });

    DOM.productSelect.innerHTML = '<option value="">-- Selecione um Serviço ou Pacote --</option>';
    AppState.products.forEach(prod => {
      const opt = document.createElement('option');
      opt.value = prod.id;
      opt.textContent = `${prod.name} - ${formatMoney(prod.price)}`;
      DOM.productSelect.appendChild(opt);
    });
  }

  function addItemToCart(productId) {
    const prod = AppState.products.find(p => p.id === productId);
    if (!prod) return;

    const existingIndex = AppState.cart.findIndex(item => item.productId === productId);
    if (existingIndex > -1) {
      AppState.cart[existingIndex].qty += 1;
    } else {
      AppState.cart.push({
        id: 'cart_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        productId: prod.id,
        name: prod.name,
        category: prod.category,
        unitPrice: parseFloat(prod.price),
        qty: 1,
        desc: prod.desc || ''
      });
    }

    renderCart();
  }

  function removeFromCart(itemId) {
    AppState.cart = AppState.cart.filter(item => item.id !== itemId);
    renderCart();
  }

  function updateCartItem(itemId, field, value) {
    const item = AppState.cart.find(i => i.id === itemId);
    if (!item) return;

    if (field === 'qty') {
      item.qty = Math.max(1, parseInt(value) || 1);
    } else if (field === 'unitPrice') {
      item.unitPrice = Math.max(0, parseFloat(value) || 0);
    }

    renderCart();
  }

  function renderCart() {
    DOM.cartTableBody.innerHTML = '';

    if (AppState.cart.length === 0) {
      DOM.emptyCartState.style.display = 'block';
      DOM.cartCountBadge.textContent = '0';
    } else {
      DOM.emptyCartState.style.display = 'none';
      DOM.cartCountBadge.textContent = AppState.cart.length;

      AppState.cart.forEach(item => {
        const tr = document.createElement('tr');
        const itemTotal = item.qty * item.unitPrice;

        tr.innerHTML = `
          <td>
            <span class="item-name">${item.name}</span>
            <span class="item-cat">${item.category}</span>
          </td>
          <td>
            <input type="number" class="input-ctrl qty-input" value="${item.qty}" min="1" data-id="${item.id}" data-field="qty">
          </td>
          <td>
            <input type="number" class="input-ctrl price-input" value="${item.unitPrice}" min="0" step="10" data-id="${item.id}" data-field="unitPrice">
          </td>
          <td style="font-weight:700; color: var(--navy-deep);">
            ${formatMoney(itemTotal)}
          </td>
          <td style="text-align: right;">
            <button class="btn-icon-del" data-id="${item.id}" title="Remover Item">
              <i class="fas fa-trash-alt"></i>
            </button>
          </td>
        `;

        DOM.cartTableBody.appendChild(tr);
      });

      DOM.cartTableBody.querySelectorAll('input').forEach(input => {
        input.addEventListener('change', (e) => {
          const id = e.target.getAttribute('data-id');
          const field = e.target.getAttribute('data-field');
          updateCartItem(id, field, e.target.value);
        });
      });

      DOM.cartTableBody.querySelectorAll('.btn-icon-del').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          removeFromCart(id);
        });
      });
    }

    calculateTotals();
  }

  function calculateTotals() {
    const subtotal = AppState.cart.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0);

    let discount = 0;
    let discountPercentStr = "0%";
    const discVal = parseFloat(DOM.discountValue.value) || 0;
    const discType = DOM.discountType.value;

    if (discType === 'percent') {
      discount = (subtotal * discVal) / 100;
      discountPercentStr = `${discVal.toFixed(1)}%`;
    } else {
      discount = discVal;
      if (subtotal > 0 && discount > 0) {
        const calculatedPct = (discount / subtotal) * 100;
        discountPercentStr = `${calculatedPct.toFixed(1)}%`;
      }
    }

    const total = Math.max(0, subtotal - discount);

    DOM.subtotalDisplay.textContent = formatMoney(subtotal);
    DOM.discountDisplay.textContent = discount > 0 ? `${formatMoney(discount)} (${discountPercentStr})` : 'R$ 0,00';
    DOM.totalDisplay.textContent = formatMoney(total);

    const pMethod = DOM.paymentMethod.value;
    const instCount = parseInt(DOM.installmentsCount.value) || 1;
    const downVal = parseFloat(DOM.downPaymentValue.value) || 0;

    let summaryText = '';

    if (pMethod === 'avista') {
      summaryText = `<strong>À Vista (PIX / Transferência):</strong> ${formatMoney(total)}`;
    } else if (pMethod === 'parcelado') {
      const valorParcela = total / instCount;
      summaryText = `<strong>${instCount}x de ${formatMoney(valorParcela)}</strong> sem juros no cartão de crédito.`;
    } else if (pMethod === 'sinal') {
      const saldoRestante = Math.max(0, total - downVal);
      const valorParcela = instCount > 1 ? saldoRestante / instCount : saldoRestante;
      summaryText = `<strong>Entrada:</strong> ${formatMoney(downVal)} + <strong>${instCount}x de ${formatMoney(valorParcela)}</strong> do saldo.`;
    }

    DOM.paymentSummaryDetails.innerHTML = summaryText;

    return { subtotal, discount, discountPercentStr, discType, total, pMethod, instCount, downVal, summaryText };
  }

  // --- RENDERIZAR TABELA DE PRODUTOS COM BUSCA & EDIÇÃO ---
  function renderProductsList() {
    DOM.productsTableBody.innerHTML = '';

    const searchTerm = DOM.productSearchInput ? DOM.productSearchInput.value.toLowerCase().trim() : '';
    const selectedCat = DOM.productCategoryFilter ? DOM.productCategoryFilter.value : 'all';

    const filteredProds = AppState.products.filter(prod => {
      const matchesSearch = prod.name.toLowerCase().includes(searchTerm) || (prod.desc && prod.desc.toLowerCase().includes(searchTerm));
      const matchesCat = selectedCat === 'all' || prod.category === selectedCat;
      return matchesSearch && matchesCat;
    });

    if (filteredProds.length === 0) {
      DOM.productsTableBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; padding: 2rem; color: var(--slate-400);">
            <i class="fas fa-search" style="font-size: 1.5rem; margin-bottom: 0.5rem;"></i>
            <p>Nenhum serviço encontrado no catálogo com esses filtros.</p>
          </td>
        </tr>
      `;
      return;
    }

    filteredProds.forEach(prod => {
      const tr = document.createElement('tr');
      tr.className = 'catalog-row';
      tr.innerHTML = `
        <td>
          <span class="catalog-prod-title">${prod.name}</span>
          ${prod.desc ? `<div class="catalog-prod-desc">${prod.desc}</div>` : ''}
        </td>
        <td>
          <span class="badge-cat">${prod.category}</span>
        </td>
        <td style="text-align: right; font-weight: 700; color: var(--slate-900);">
          ${formatMoney(prod.price)}
        </td>
        <td style="text-align: right;">
          <div style="display: flex; gap: 0.35rem; justify-content: flex-end;">
            <button class="btn-outline btn-sm" data-edit-prod="${prod.id}" title="Editar Serviço">
              <i class="fas fa-pen"></i> Editar
            </button>
            <button class="btn-icon-del" data-del-prod="${prod.id}" title="Excluir Serviço">
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>
        </td>
      `;
      DOM.productsTableBody.appendChild(tr);
    });

    DOM.productsTableBody.querySelectorAll('[data-edit-prod]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-edit-prod');
        openEditProductModal(id);
      });
    });

    DOM.productsTableBody.querySelectorAll('[data-del-prod]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-del-prod');
        if (confirm('Deseja realmente remover este serviço do catálogo?')) {
          AppState.products = AppState.products.filter(p => p.id !== id);
          AppState.saveProducts();
          populateDropdowns();
          renderProductsList();
        }
      });
    });
  }

  // --- MODAL DE EDIÇÃO DE PRODUTO ---
  function openEditProductModal(productId) {
    const prod = AppState.products.find(p => p.id === productId);
    if (!prod) return;

    DOM.editProdId.value = prod.id;
    DOM.editProdName.value = prod.name;
    DOM.editProdCat.value = prod.category;
    DOM.editProdPrice.value = prod.price;
    DOM.editProdDesc.value = prod.desc || '';

    DOM.editProductModal.classList.add('active');
  }

  function closeEditProductModal() {
    DOM.editProductModal.classList.remove('active');
  }

  function renderSellersList() {
    DOM.sellersListContainer.innerHTML = '';
    AppState.sellers.forEach(seller => {
      const div = document.createElement('div');
      div.className = 'catalog-item-card';
      div.innerHTML = `
        <div>
          <div class="catalog-item-title">${seller.name}</div>
          <div class="catalog-item-desc">${seller.role} • ${seller.phone}</div>
        </div>
        <button class="btn-icon-del" data-del-seller="${seller.id}" title="Excluir"><i class="fas fa-trash-alt"></i></button>
      `;
      DOM.sellersListContainer.appendChild(div);
    });

    DOM.sellersListContainer.querySelectorAll('[data-del-seller]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-del-seller');
        if (confirm('Deseja excluir este vendedor?')) {
          AppState.sellers = AppState.sellers.filter(s => s.id !== id);
          AppState.saveSellers();
          populateDropdowns();
          renderSellersList();
        }
      });
    });
  }

  function generateQuote() {
    if (AppState.cart.length === 0) {
      alert('Por favor, adicione pelo menos um serviço ao orçamento antes de gerar.');
      return;
    }

    const sellerId = DOM.sellerSelect.value;
    const seller = AppState.sellers.find(s => s.id === sellerId) || { name: 'Rodrigo Rodrigues', role: 'Consultor Especialista', phone: '5514996321001', email: 'rodrigo@rrturismo.com.br' };

    const totals = calculateTotals();
    const quoteId = 'ORC-' + Math.floor(100000 + Math.random() * 900000);
    const dateNow = new Date().toISOString();

    const quoteData = {
      id: quoteId,
      date: dateNow,
      seller: seller,
      client: {
        name: DOM.clientName.value.trim() || 'Cliente Não Informado',
        destination: DOM.clientDestination.value.trim() || 'Portugal / Europa'
      },
      validity: DOM.quoteValidity ? DOM.quoteValidity.value : '7 Dias Úteis',
      items: [...AppState.cart],
      notes: DOM.quoteNotes.value.trim(),
      financials: totals,
      status: 'Aprovado'
    };

    AppState.currentQuote = quoteData;

    AppState.quotesHistory.unshift(quoteData);
    AppState.saveQuotes();
    renderHistory();

    renderQuotePaper(quoteData);

    DOM.quoteModal.classList.add('active');
  }

  // --- RENDERIZAR FOLHA DE ORÇAMENTO EXECUTIVA (1 PÁGINA A4 COM DATA DE HOJE) ---
  function renderQuotePaper(quote) {
    const todayFormatted = new Date().toLocaleDateString('pt-BR');

    const itemsHtml = quote.items.map(item => `
      <tr class="quote-item-row">
        <td>
          <div class="item-title-print">${item.name}</div>
          <div class="item-cat-print">${item.category}</div>
        </td>
        <td style="text-align:center; font-weight:600;">${item.qty}</td>
        <td style="text-align:right;">${formatMoney(item.unitPrice)}</td>
        <td style="text-align:right; font-weight:700; color:var(--slate-900);">${formatMoney(item.qty * item.unitPrice)}</td>
      </tr>
    `).join('');

    const discountPadded = quote.financials.discount > 0 
      ? `- ${formatMoney(quote.financials.discount)} <span class="discount-pct-badge">(${quote.financials.discountPercentStr})</span>`
      : null;

    DOM.quotePaperContent.innerHTML = `
      <div class="quote-paper">
        
        <!-- HEADER TIMBRADO OFICIAL RR TURISMO -->
        <div class="quote-header-print">
          <div class="quote-logo-brand">
            <img src="assets/logo.png" alt="RR Turismo Logo" class="quote-logo-img">
            <div class="brand-text-print">
              <h2>RR TURISMO</h2>
              <p class="subtext">Assessoria de Imigração &amp; Viagens</p>
              <p class="reg-text">Registro RA 12563/23 | Marília - SP</p>
            </div>
          </div>

          <div class="quote-meta-badge">
            <div class="quote-code">${quote.id}</div>
            <div class="quote-date-info">
              <span><strong>Data de Emissão:</strong> ${todayFormatted}</span>
              <span><strong>Validade da Proposta:</strong> ${quote.validity || '7 Dias Úteis'}</span>
            </div>
          </div>
        </div>

        <!-- DADOS DO CLIENTE E CONSULTOR -->
        <div class="quote-dossier-grid">
          <div class="dossier-card">
            <div class="dossier-header">DADOS DO CLIENTE</div>
            <div class="dossier-body">
              <p><strong>Cliente:</strong> ${quote.client.name}</p>
              <p><strong>Destino:</strong> <span class="destination-highlight">${quote.client.destination}</span></p>
            </div>
          </div>

          <div class="dossier-card">
            <div class="dossier-header">CONSULTOR RESPONSÁVEL</div>
            <div class="dossier-body">
              <p><strong>Vendedor:</strong> ${quote.seller.name}</p>
              <p><strong>Cargo:</strong> ${quote.seller.role}</p>
              <p><strong>Contato:</strong> ${quote.seller.phone}</p>
              <p><strong>E-mail:</strong> ${quote.seller.email}</p>
            </div>
          </div>
        </div>

        <!-- TABELA DE SERVIÇOS VENDIDOS -->
        <div class="section-title-print">
          SERVIÇOS E PACOTES INCLUSOS
        </div>

        <table class="quote-items-table">
          <thead>
            <tr>
              <th style="width: 55%;">Item / Serviço</th>
              <th style="width: 10%; text-align: center;">Qtd</th>
              <th style="width: 17%; text-align: right;">Valor Unit.</th>
              <th style="width: 18%; text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <!-- RODAPÉ FINANCEIRO E FORMA DE PAGAMENTO -->
        <div class="quote-footer-grid">
          <div class="payment-terms-compact">
            <div class="terms-title">CONDIÇÕES DE PAGAMENTO</div>
            <p class="payment-highlight">${quote.financials.summaryText}</p>
            ${quote.notes ? `<p class="notes-compact"><strong>Obs:</strong> ${quote.notes}</p>` : ''}
          </div>

          <div class="financial-box-print">
            <table class="summary-table-print">
              <tr>
                <td class="lbl">Subtotal:</td>
                <td class="val">${formatMoney(quote.financials.subtotal)}</td>
              </tr>
              ${discountPadded ? `
              <tr class="discount-row">
                <td class="lbl">Desconto:</td>
                <td class="val discount-val">${discountPadded}</td>
              </tr>
              ` : ''}
              <tr class="total-row-print">
                <td class="lbl">TOTAL LÍQUIDO:</td>
                <td class="val total-val">${formatMoney(quote.financials.total)}</td>
              </tr>
            </table>
          </div>
        </div>

        <!-- ASSINATURAS -->
        <div class="signatures-print-grid">
          <div class="signature-box">
            <div class="signature-line-mark"></div>
            <strong>${quote.seller.name}</strong>
            <p>RR Turismo</p>
          </div>
          <div class="signature-box">
            <div class="signature-line-mark"></div>
            <strong>${quote.client.name}</strong>
            <p>Aceite do Cliente</p>
          </div>
        </div>

      </div>
    `;
  }

  function triggerIsolatedPrint() {
    if (!AppState.currentQuote) return;
    
    DOM.printArea.innerHTML = DOM.quotePaperContent.innerHTML;
    window.print();
    
    setTimeout(() => {
      DOM.printArea.innerHTML = '';
    }, 1000);
  }

  function sendToWhatsapp() {
    if (!AppState.currentQuote) return;
    const q = AppState.currentQuote;

    let msg = `✈️ *ORÇAMENTO - RR TURISMO*\n`;
    msg += `📄 *Orçamento:* ${q.id}\n`;
    msg += `👤 *Cliente:* ${q.client.name}\n`;
    msg += `🎯 *Destino:* ${q.client.destination}\n`;
    msg += `👔 *Consultor:* ${q.seller.name}\n`;
    msg += `⏳ *Validade:* ${q.validity || '7 Dias Úteis'}\n\n`;
    msg += `📋 *ITENS VENDIDOS:*\n`;

    q.items.forEach(item => {
      msg += `• ${item.qty}x ${item.name} (${formatMoney(item.unitPrice)})\n`;
    });

    msg += `\n💰 *SUBTOTAL:* ${formatMoney(q.financials.subtotal)}\n`;
    if (q.financials.discount > 0) {
      msg += `🏷️ *DESCONTO:* -${formatMoney(q.financials.discount)} (${q.financials.discountPercentStr})\n`;
    }
    msg += `✅ *VALOR TOTAL:* ${formatMoney(q.financials.total)}\n`;
    msg += `💳 *CONDIÇÃO:* ${q.financials.summaryText.replace(/<\/?[^>]+(>|$)/g, "")}\n\n`;
    msg += `Ficamos à disposição!`;

    const encoded = encodeURIComponent(msg);
    const waUrl = `https://wa.me/?text=${encoded}`;
    window.open(waUrl, '_blank');
  }

  function copyQuoteText() {
    if (!AppState.currentQuote) return;
    const q = AppState.currentQuote;

    let text = `ORÇAMENTO RR TURISMO - ${q.id}\n`;
    text += `Cliente: ${q.client.name} | Destino: ${q.client.destination}\n`;
    text += `Consultor: ${q.seller.name} | Validade: ${q.validity || '7 Dias Úteis'}\n\n`;
    text += `SERVIÇOS:\n`;
    q.items.forEach(item => {
      text += `- ${item.qty}x ${item.name}: ${formatMoney(item.qty * item.unitPrice)}\n`;
    });
    text += `\nSUBTOTAL: ${formatMoney(q.financials.subtotal)}\n`;
    if (q.financials.discount > 0) {
      text += `DESCONTO: -${formatMoney(q.financials.discount)} (${q.financials.discountPercentStr})\n`;
    }
    text += `TOTAL: ${formatMoney(q.financials.total)}\n`;
    text += `CONDIÇÃO DE PAGAMENTO: ${q.financials.summaryText.replace(/<\/?[^>]+(>|$)/g, "")}\n`;

    navigator.clipboard.writeText(text).then(() => {
      alert('Resumo do orçamento copiado!');
    });
  }

  function renderHistory() {
    DOM.historyTableBody.innerHTML = '';
    DOM.historyCountBadge.textContent = AppState.quotesHistory.length;

    if (AppState.quotesHistory.length === 0) {
      DOM.historyTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-state">
            <i class="fas fa-folder-open"></i>
            <p>Nenhum orçamento gerado ainda.</p>
          </td>
        </tr>
      `;
      return;
    }

    AppState.quotesHistory.forEach(q => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${q.id}</strong></td>
        <td>${formatDate(q.date)}</td>
        <td>${q.client.name}</td>
        <td>${q.seller.name}</td>
        <td style="font-weight:700; color:var(--slate-900);">${formatMoney(q.financials.total)}</td>
        <td style="text-align:right;">
          <button class="btn-outline" data-view-q="${q.id}"><i class="fas fa-eye"></i> Ver Orçamento</button>
          <button class="btn-icon-del" data-del-q="${q.id}"><i class="fas fa-trash-alt"></i></button>
        </td>
      `;
      DOM.historyTableBody.appendChild(tr);
    });

    DOM.historyTableBody.querySelectorAll('[data-view-q]').forEach(btn => {
      btn.addEventListener('click', () => {
        const qId = btn.getAttribute('data-view-q');
        const q = AppState.quotesHistory.find(item => item.id === qId);
        if (q) {
          AppState.currentQuote = q;
          renderQuotePaper(q);
          DOM.quoteModal.classList.add('active');
        }
      });
    });

    DOM.historyTableBody.querySelectorAll('[data-del-q]').forEach(btn => {
      btn.addEventListener('click', () => {
        const qId = btn.getAttribute('data-del-q');
        if (confirm('Excluir este orçamento do histórico?')) {
          AppState.quotesHistory = AppState.quotesHistory.filter(item => item.id !== qId);
          AppState.saveQuotes();
          renderHistory();
        }
      });
    });
  }

  function setupEventListeners() {
    DOM.quickAddBtn.addEventListener('click', () => {
      const selectedId = DOM.productSelect.value;
      if (!selectedId) {
        alert('Por favor, selecione um serviço no catálogo.');
        return;
      }
      addItemToCart(selectedId);
    });

    ['change', 'input'].forEach(evt => {
      DOM.discountType.addEventListener(evt, calculateTotals);
      DOM.discountValue.addEventListener(evt, calculateTotals);
      DOM.paymentMethod.addEventListener(evt, () => {
        if (DOM.paymentMethod.value === 'sinal') {
          document.getElementById('downPaymentGroup').style.display = 'flex';
        } else {
          document.getElementById('downPaymentGroup').style.display = 'none';
        }
        calculateTotals();
      });
      DOM.installmentsCount.addEventListener(evt, calculateTotals);
      DOM.downPaymentValue.addEventListener(evt, calculateTotals);
    });

    DOM.btnGenerateQuote.addEventListener('click', generateQuote);

    DOM.btnCloseModal.addEventListener('click', () => {
      DOM.quoteModal.classList.remove('active');
    });

    DOM.btnPrintQuote.addEventListener('click', triggerIsolatedPrint);
    DOM.btnWhatsappQuote.addEventListener('click', sendToWhatsapp);
    DOM.btnCopyQuoteText.addEventListener('click', copyQuoteText);

    if (DOM.productSearchInput) {
      DOM.productSearchInput.addEventListener('input', renderProductsList);
    }
    if (DOM.productCategoryFilter) {
      DOM.productCategoryFilter.addEventListener('change', renderProductsList);
    }

    DOM.productForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('newProdName').value.trim();
      const category = document.getElementById('newProdCat').value;
      const price = parseFloat(document.getElementById('newProdPrice').value);
      const desc = document.getElementById('newProdDesc').value.trim();

      if (!name || isNaN(price)) return;

      const newProd = {
        id: 'prod_' + Date.now(),
        name,
        category,
        price,
        desc: desc || ''
      };

      AppState.products.push(newProd);
      AppState.saveProducts();
      populateDropdowns();
      renderProductsList();

      DOM.productForm.reset();
      alert('Serviço cadastrado com sucesso!');
    });

    DOM.editProductForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = DOM.editProdId.value;
      const prod = AppState.products.find(p => p.id === id);
      if (!prod) return;

      prod.name = DOM.editProdName.value.trim();
      prod.category = DOM.editProdCat.value;
      prod.price = parseFloat(DOM.editProdPrice.value) || 0;
      prod.desc = DOM.editProdDesc.value.trim();

      AppState.saveProducts();
      populateDropdowns();
      renderProductsList();
      closeEditProductModal();

      alert('Serviço atualizado com sucesso no catálogo!');
    });

    DOM.btnCloseEditModal.addEventListener('click', closeEditProductModal);
    DOM.btnCancelEditModal.addEventListener('click', closeEditProductModal);

    DOM.sellerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('newSellerName').value.trim();
      const role = document.getElementById('newSellerRole').value.trim();
      const phone = document.getElementById('newSellerPhone').value.trim();
      const email = document.getElementById('newSellerEmail').value.trim();

      if (!name) return;

      const newSeller = {
        id: 'sell_' + Date.now(),
        name,
        role: role || 'Consultor',
        phone,
        email
      };

      AppState.sellers.push(newSeller);
      AppState.saveSellers();
      populateDropdowns();
      renderSellersList();

      DOM.sellerForm.reset();
      alert('Vendedor cadastrado com sucesso!');
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await AppState.init();
    setupTabs();
    populateDropdowns();
    renderCart();
    renderProductsList();
    renderSellersList();
    renderHistory();
    setupEventListeners();
  });

})();
