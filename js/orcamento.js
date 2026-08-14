/* ==========================================================================
   RR TURISMO - SISTEMA DE ORÇAMENTOS (JAVASCRIPT PRINCIPAL COM SUPABASE CLOUD)
   ========================================================================== */

(function () {
  'use strict';

  // --- CONFIGURAÇÃO DO SUPABASE CLOUD (SINCRONIZAÇÃO EM TEMPO REAL) ---
  const SUPABASE_URL = 'https://uyylbgyxbhppkhdjgoxq.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5eWxiZ3l4YmhwcGtoZGpnb3hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MDk4NTQsImV4cCI6MjEwMjI4NTg1NH0.k3Ao_eZP_4RZ08cwuap21EsHN0p-YoYkWZGJJRF6oA0';

  let supabaseClient = null;
  if (typeof window.supabase !== 'undefined' && SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (e) {
      console.warn('Supabase não inicializado:', e);
    }
  }

  // --- DADOS INICIAIS (100% ZERADOS) ---
  const DEFAULT_PRODUCTS = [];
  const DEFAULT_SELLERS = [];

  // --- GERENCIADOR DE ESTADO DA APLICAÇÃO ---
  const AppState = {
    products: [],
    sellers: [],
    quotesHistory: [],
    cart: [],
    currentQuote: null,

    async init() {
      // Limpar qualquer dado demonstrativo antigo do cache local
      let savedProdsStr = localStorage.getItem('rr_products');
      if (savedProdsStr && (savedProdsStr.includes('prod_1') || savedProdsStr.includes('Assessoria Visto'))) {
        localStorage.removeItem('rr_products');
        savedProdsStr = null;
      }
      this.products = savedProdsStr ? JSON.parse(savedProdsStr) : [];

      let savedSellersStr = localStorage.getItem('rr_sellers');
      if (savedSellersStr && (savedSellersStr.includes('sell_1') || savedSellersStr.includes('Rodrigo Rodrigues'))) {
        localStorage.removeItem('rr_sellers');
        savedSellersStr = null;
      }
      this.sellers = savedSellersStr ? JSON.parse(savedSellersStr) : [];

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
        if (pErr) {
          console.warn('Erro ao buscar produtos no Supabase:', pErr);
        } else if (cloudProds) {
          this.products = cloudProds.filter(p => p.id && !p.id.startsWith('prod_'));
          localStorage.setItem('rr_products', JSON.stringify(this.products));
        }

        const { data: cloudSellers, error: sErr } = await supabaseClient.from('rr_sellers').select('*');
        if (sErr) {
          console.warn('Erro ao buscar vendedores no Supabase:', sErr);
        } else if (cloudSellers) {
          this.sellers = cloudSellers.filter(s => s.id && !s.id.startsWith('sell_'));
          localStorage.setItem('rr_sellers', JSON.stringify(this.sellers));
        }

        const { data: cloudQuotes, error: qErr } = await supabaseClient.from('rr_quotes').select('*').order('created_at', { ascending: false });
        if (qErr) {
          console.warn('Erro ao buscar orçamentos no Supabase:', qErr);
        } else if (cloudQuotes) {
          this.quotesHistory = cloudQuotes.map(q => typeof q.data === 'string' ? JSON.parse(q.data) : (q.data || q));
          localStorage.setItem('rr_quotes', JSON.stringify(this.quotesHistory));
        }

        populateDropdowns();
        renderProductsList();
        renderSellersList();
        renderHistory();
      } catch (err) {
        console.warn('Erro na sincronização Supabase:', err);
      }
    },

    async saveProducts() {
      localStorage.setItem('rr_products', JSON.stringify(this.products));
      if (supabaseClient) {
        try {
          const { error } = await supabaseClient.from('rr_products').upsert(this.products);
          if (error) {
            console.error('Erro Supabase Produtos:', error);
            alert('Aviso do Supabase ao salvar produto: ' + error.message);
          }
        } catch (e) {
          console.error('Erro no upload de produto:', e);
        }
      }
    },

    async saveSellers() {
      localStorage.setItem('rr_sellers', JSON.stringify(this.sellers));
      if (supabaseClient) {
        try {
          const { error } = await supabaseClient.from('rr_sellers').upsert(this.sellers);
          if (error) {
            console.error('Erro Supabase Vendedores:', error);
            alert('Aviso do Supabase ao salvar vendedor: ' + error.message);
          }
        } catch (e) {
          console.error('Erro no upload de vendedor:', e);
        }
      }
    },

    async saveQuotes() {
      localStorage.setItem('rr_quotes', JSON.stringify(this.quotesHistory));
      if (supabaseClient && this.currentQuote) {
        try {
          const { error } = await supabaseClient.from('rr_quotes').upsert([{ id: this.currentQuote.id, data: this.currentQuote, created_at: this.currentQuote.date }]);
          if (error) {
            console.error('Erro Supabase Orçamento:', error);
            alert('Aviso do Supabase ao salvar orçamento: ' + error.message);
          }
        } catch (e) {
          console.error('Erro no upload do orçamento:', e);
        }
      }
    }
  };

  // --- ELEMENTOS DO DOM ---
  const DOM = {
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),

    sellerSelect: document.getElementById('sellerSelect'),
    clientName: document.getElementById('clientName'),
    clientPhone: document.getElementById('clientPhone'),
    clientDestination: document.getElementById('clientDestination'),
    quoteValidity: document.getElementById('quoteValidity'),
    quoteNotes: document.getElementById('quoteNotes'),
    paymentMethod: document.getElementById('paymentMethod'),
    installmentsCount: document.getElementById('installmentsCount'),
    discountType: document.getElementById('discountType'),
    discountValue: document.getElementById('discountValue'),
    downPaymentValue: document.getElementById('downPaymentValue'),
    downPaymentGroup: document.getElementById('downPaymentGroup'),
    customInstallmentValue: document.getElementById('customInstallmentValue'),
    customInstallmentGroup: document.getElementById('customInstallmentGroup'),

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
    btnDownloadPdf: document.getElementById('btnDownloadPdf'),
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
    const customInstVal = parseFloat(DOM.customInstallmentValue.value) || 0;

    const installmentTotal = customInstVal > 0 ? customInstVal : total;

    let summaryText = '';

    if (pMethod === 'avista') {
      summaryText = `<strong>À Vista (PIX / Transferência):</strong> ${formatMoney(total)}`;
    } else if (pMethod === 'parcelado') {
      const valorParcela = installmentTotal / instCount;
      const extraMsg = customInstVal > 0 ? ` (Total parcelado: ${formatMoney(installmentTotal)})` : '';
      summaryText = `<strong>${instCount}x de ${formatMoney(valorParcela)}</strong> no cartão de crédito${extraMsg}.`;
    } else if (pMethod === 'sinal') {
      const saldoRestante = Math.max(0, installmentTotal - downVal);
      const valorParcela = instCount > 1 ? saldoRestante / instCount : saldoRestante;
      const extraMsg = customInstVal > 0 ? ` (Total parcelado: ${formatMoney(installmentTotal)})` : '';
      summaryText = `<strong>Entrada:</strong> ${formatMoney(downVal)} + <strong>${instCount}x de ${formatMoney(valorParcela)}</strong> do saldo parcelado${extraMsg}.`;
    }

    DOM.paymentSummaryDetails.innerHTML = summaryText;

    return { subtotal, discount, discountPercentStr, discType, total, installmentTotal, pMethod, instCount, downVal, summaryText };
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
            <p>Nenhum serviço cadastrado no catálogo ainda.</p>
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
          ${prod.desc ? `<div class="catalog-prod-desc"><strong>Incluso:</strong> ${prod.desc}</div>` : ''}
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
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-del-prod');
        if (confirm('Deseja realmente remover este serviço do catálogo?')) {
          AppState.products = AppState.products.filter(p => p.id !== id);
          await AppState.saveProducts();
          if (supabaseClient) {
            try { await supabaseClient.from('rr_products').delete().eq('id', id); } catch (e) {}
          }
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
    if (AppState.sellers.length === 0) {
      DOM.sellersListContainer.innerHTML = '<p style="color: var(--slate-400); font-size: 0.85rem; padding: 0.5rem 0;">Nenhum vendedor cadastrado ainda.</p>';
      return;
    }

    AppState.sellers.forEach(seller => {
      const div = document.createElement('div');
      div.className = 'catalog-item-card';
      div.innerHTML = `
        <div>
          <div class="catalog-item-title">${seller.name}</div>
          <div class="catalog-item-desc">${seller.role || 'Consultor'} ${seller.phone ? '• ' + seller.phone : ''}</div>
        </div>
        <button class="btn-icon-del" data-del-seller="${seller.id}" title="Excluir"><i class="fas fa-trash-alt"></i></button>
      `;
      DOM.sellersListContainer.appendChild(div);
    });

    DOM.sellersListContainer.querySelectorAll('[data-del-seller]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-del-seller');
        if (confirm('Deseja excluir este vendedor?')) {
          AppState.sellers = AppState.sellers.filter(s => s.id !== id);
          await AppState.saveSellers();
          if (supabaseClient) {
            try { await supabaseClient.from('rr_sellers').delete().eq('id', id); } catch (e) {}
          }
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
    const seller = AppState.sellers.find(s => s.id === sellerId) || { name: 'Consultor RR Turismo', role: 'Consultor de Imigração', phone: '', email: '' };

    const totals = calculateTotals();
    const quoteId = 'ORC-' + Math.floor(100000 + Math.random() * 900000);
    const dateNow = new Date().toISOString();

    const quoteData = {
      id: quoteId,
      date: dateNow,
      seller: seller,
      client: {
        name: DOM.clientName.value.trim() || 'Cliente Não Informado',
        phone: DOM.clientPhone ? DOM.clientPhone.value.trim() : '',
        destination: DOM.clientDestination.value.trim() || 'Portugal / Europa'
      },
      validity: DOM.quoteValidity ? (DOM.quoteValidity.value.trim() || '7 Dias Úteis') : '7 Dias Úteis',
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
          <div class="item-cat-print">${item.category} ${item.desc ? '| Incluso: ' + item.desc : ''}</div>
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
              <p><strong>Cargo:</strong> ${quote.seller.role || 'Consultor'}</p>
              ${quote.seller.phone ? `<p><strong>Contato:</strong> ${quote.seller.phone}</p>` : ''}
              ${quote.seller.email ? `<p><strong>E-mail:</strong> ${quote.seller.email}</p>` : ''}
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
                <td class="lbl">TOTAL LÍQUIDO (À VISTA):</td>
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

  // --- GERAR NOME PERSONALIZADO DO ARQUIVO PDF ---
  // Exemplo: ORCAMENTO RR TURISMO - ORCAMENTO 30390 - CLIENTE JOAO DA SILVA
  function buildPdfFilename(quote) {
    const code = quote.id ? quote.id.replace('ORC-', '') : Math.floor(10000 + Math.random() * 90000);
    const clientName = quote.client && quote.client.name 
      ? quote.client.name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9 ]/g, '').toUpperCase()
      : 'CLIENTE';
    return `ORCAMENTO RR TURISMO - ORCAMENTO ${code} - CLIENTE ${clientName}`;
  }

  // --- DOWNLOAD DIRETO DO PDF NO NAVEGADOR ---
  function downloadPdfDirectly() {
    if (!AppState.currentQuote) return;
    const q = AppState.currentQuote;
    const filename = buildPdfFilename(q) + '.pdf';

    const element = DOM.quotePaperContent.querySelector('.quote-paper') || DOM.quotePaperContent;

    if (typeof window.html2pdf !== 'undefined') {
      const opt = {
        margin:       [6, 6, 6, 6],
        filename:     filename,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      window.html2pdf().set(opt).from(element).save();
    } else {
      triggerIsolatedPrint();
    }
  }

  function triggerIsolatedPrint() {
    if (!AppState.currentQuote) return;
    const q = AppState.currentQuote;
    const originalTitle = document.title;
    document.title = buildPdfFilename(q);
    
    DOM.printArea.innerHTML = DOM.quotePaperContent.innerHTML;
    window.print();
    
    setTimeout(() => {
      DOM.printArea.innerHTML = '';
      document.title = originalTitle;
    }, 1000);
  }

  function sendToWhatsapp() {
    if (!AppState.currentQuote) return;
    const q = AppState.currentQuote;

    const currentOrigin = window.location.origin + window.location.pathname;
    const pdfOnlineLink = `${currentOrigin}?orcamento=${q.id}`;

    let msg = `✈️ *ORÇAMENTO - RR TURISMO*\n`;
    msg += `📄 *Código:* ${q.id}\n`;
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
    msg += `📄 *Proposta em PDF:* \n${pdfOnlineLink}\n\n`;
    msg += `Ficamos à disposição!`;

    const encoded = encodeURIComponent(msg);
    let rawPhone = q.client && q.client.phone ? q.client.phone.replace(/\D/g, '') : '';
    if (rawPhone && !rawPhone.startsWith('55') && rawPhone.length >= 10) {
      rawPhone = '55' + rawPhone;
    }

    let waUrl = '';
    if (rawPhone && rawPhone.length >= 12) {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile) {
        waUrl = `https://wa.me/${rawPhone}?text=${encoded}`;
      } else {
        waUrl = `https://web.whatsapp.com/send?phone=${rawPhone}&text=${encoded}`;
      }
    } else {
      waUrl = `https://wa.me/?text=${encoded}`;
    }

    window.open(waUrl, '_blank');
  }

  function copyQuoteText() {
    if (!AppState.currentQuote) return;
    const q = AppState.currentQuote;
    const currentOrigin = window.location.origin + window.location.pathname;
    const pdfOnlineLink = `${currentOrigin}?orcamento=${q.id}`;

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
    text += `CONDIÇÃO DE PAGAMENTO: ${q.financials.summaryText.replace(/<\/?[^>]+(>|$)/g, "")}\n\n`;
    text += `PDF OFICIAL: ${pdfOnlineLink}\n`;

    navigator.clipboard.writeText(text).then(() => {
      alert('Resumo do orçamento com link do PDF copiado!');
    });
  }

  async function checkUrlQuoteParam() {
    const urlParams = new URLSearchParams(window.location.search);
    const quoteId = urlParams.get('orcamento') || urlParams.get('q');
    if (!quoteId) return;

    let targetQuote = AppState.quotesHistory.find(item => item.id === quoteId);

    if (!targetQuote && supabaseClient) {
      try {
        const { data, error } = await supabaseClient.from('rr_quotes').select('*').eq('id', quoteId).single();
        if (!error && data) {
          targetQuote = typeof data.data === 'string' ? JSON.parse(data.data) : (data.data || data);
        }
      } catch (e) {
        console.warn('Erro buscando orçamento por ID no Supabase:', e);
      }
    }

    if (targetQuote) {
      AppState.currentQuote = targetQuote;
      renderQuotePaper(targetQuote);
      DOM.quoteModal.classList.add('active');
    }
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
      btn.addEventListener('click', async () => {
        const qId = btn.getAttribute('data-del-q');
        if (confirm('Excluir este orçamento do histórico?')) {
          AppState.quotesHistory = AppState.quotesHistory.filter(item => item.id !== qId);
          await AppState.saveQuotes();
          if (supabaseClient) {
            try { await supabaseClient.from('rr_quotes').delete().eq('id', qId); } catch (e) {}
          }
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
        const pVal = DOM.paymentMethod.value;
        if (pVal === 'sinal') {
          DOM.downPaymentGroup.style.display = 'flex';
          DOM.customInstallmentGroup.style.display = 'flex';
        } else if (pVal === 'parcelado') {
          DOM.downPaymentGroup.style.display = 'none';
          DOM.customInstallmentGroup.style.display = 'flex';
        } else {
          DOM.downPaymentGroup.style.display = 'none';
          DOM.customInstallmentGroup.style.display = 'none';
        }
        calculateTotals();
      });
      DOM.installmentsCount.addEventListener(evt, calculateTotals);
      DOM.downPaymentValue.addEventListener(evt, calculateTotals);
      DOM.customInstallmentValue.addEventListener(evt, calculateTotals);
    });

    DOM.btnGenerateQuote.addEventListener('click', generateQuote);

    DOM.btnCloseModal.addEventListener('click', () => {
      DOM.quoteModal.classList.remove('active');
    });

    if (DOM.btnDownloadPdf) {
      DOM.btnDownloadPdf.addEventListener('click', downloadPdfDirectly);
    }
    DOM.btnPrintQuote.addEventListener('click', triggerIsolatedPrint);
    DOM.btnWhatsappQuote.addEventListener('click', sendToWhatsapp);
    DOM.btnCopyQuoteText.addEventListener('click', copyQuoteText);

    if (DOM.productSearchInput) {
      DOM.productSearchInput.addEventListener('input', renderProductsList);
    }
    if (DOM.productCategoryFilter) {
      DOM.productCategoryFilter.addEventListener('change', renderProductsList);
    }

    DOM.productForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('newProdName').value.trim();
      const category = document.getElementById('newProdCat').value;
      const price = parseFloat(document.getElementById('newProdPrice').value);
      const desc = document.getElementById('newProdDesc').value.trim();

      if (!name || isNaN(price)) return;

      const newProd = {
        id: 'real_prod_' + Date.now(),
        name,
        category,
        price,
        desc: desc || ''
      };

      AppState.products.push(newProd);
      await AppState.saveProducts();
      populateDropdowns();
      renderProductsList();

      DOM.productForm.reset();
      alert('Serviço cadastrado com sucesso!');
    });

    DOM.editProductForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = DOM.editProdId.value;
      const prod = AppState.products.find(p => p.id === id);
      if (!prod) return;

      prod.name = DOM.editProdName.value.trim();
      prod.category = DOM.editProdCat.value;
      prod.price = parseFloat(DOM.editProdPrice.value) || 0;
      prod.desc = DOM.editProdDesc.value.trim();

      await AppState.saveProducts();
      populateDropdowns();
      renderProductsList();
      closeEditProductModal();

      alert('Serviço atualizado com sucesso no catálogo!');
    });

    DOM.btnCloseEditModal.addEventListener('click', closeEditProductModal);
    DOM.btnCancelEditModal.addEventListener('click', closeEditProductModal);

    DOM.sellerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('newSellerName').value.trim();
      const role = document.getElementById('newSellerRole').value.trim();
      const phone = document.getElementById('newSellerPhone').value.trim();
      const email = document.getElementById('newSellerEmail').value.trim();

      if (!name) return;

      const newSeller = {
        id: 'real_sell_' + Date.now(),
        name,
        role: role || 'Consultor',
        phone,
        email
      };

      AppState.sellers.push(newSeller);
      await AppState.saveSellers();
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
    await checkUrlQuoteParam();
  });

})();
