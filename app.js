// Simple POS (front-end only) - LocalStorage based

const money = (n) => {
  const v = Number.isFinite(n) ? n : 0;
  return `$${v.toFixed(2)}`;
};

const LS_KEYS = {
  PRODUCTS: "pos_products_v1",
  CART: "pos_cart_v1",
  SETTINGS: "pos_settings_v1",
};

const defaultProducts = [
  { id: crypto.randomUUID(), barcode: "701228", name: "Coca Cola", price: 23.00 },
  { id: crypto.randomUUID(), barcode: "100101", name: "Polo Shirt", price: 35.00 },
  { id: crypto.randomUUID(), barcode: "200202", name: "Milk 1L", price: 18.50 },
  { id: crypto.randomUUID(), barcode: "300303", name: "Instant Noodles", price: 2.20 },
  { id: crypto.randomUUID(), barcode: "400404", name: "Chocolate", price: 4.90 },
  { id: crypto.randomUUID(), barcode: "500505", name: "Coffee", price: 6.50 },
];

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

let products = loadJSON(LS_KEYS.PRODUCTS, null);
if (!Array.isArray(products) || products.length === 0) {
  products = defaultProducts;
  saveJSON(LS_KEYS.PRODUCTS, products);
}

let cart = loadJSON(LS_KEYS.CART, []);
if (!Array.isArray(cart)) cart = [];

let settings = loadJSON(LS_KEYS.SETTINGS, { discountPct: 0, taxPct: 0 });
if (!settings || typeof settings !== "object") settings = { discountPct: 0, taxPct: 0 };

// Elements
const productGrid = document.getElementById("productGrid");
const searchInput = document.getElementById("searchInput");
const cartList = document.getElementById("cartList");
const cartCount = document.getElementById("cartCount");

const discountInput = document.getElementById("discountInput");
const taxInput = document.getElementById("taxInput");
const subtotalText = document.getElementById("subtotalText");
const discountText = document.getElementById("discountText");
const taxText = document.getElementById("taxText");
const totalText = document.getElementById("totalText");
const cashInput = document.getElementById("cashInput");
const changeText = document.getElementById("changeText");
const completeMsg = document.getElementById("completeMsg");

const btnNewSale = document.getElementById("btnNewSale");
const btnReceipt = document.getElementById("btnReceipt");
const btnComplete = document.getElementById("btnComplete");

// Product modal
const productModal = document.getElementById("productModal");
const btnAddProduct = document.getElementById("btnAddProduct");
const closeProductModal = document.getElementById("closeProductModal");
const cancelProduct = document.getElementById("cancelProduct");
const saveProductBtn = document.getElementById("saveProduct");
const pBarcode = document.getElementById("pBarcode");
const pName = document.getElementById("pName");
const pPrice = document.getElementById("pPrice");

// Receipt modal
const receiptModal = document.getElementById("receiptModal");
const receiptArea = document.getElementById("receiptArea");
const closeReceiptModal = document.getElementById("closeReceiptModal");
const btnCloseReceipt = document.getElementById("btnCloseReceipt");
const btnPrintNow = document.getElementById("btnPrintNow");

// Init inputs
discountInput.value = settings.discountPct ?? 0;
taxInput.value = settings.taxPct ?? 0;

// Helpers
function openModal(el) {
  el.classList.add("show");
  el.setAttribute("aria-hidden", "false");
}
function closeModal(el) {
  el.classList.remove("show");
  el.setAttribute("aria-hidden", "true");
}

function findCartItem(productId) {
  return cart.find(i => i.productId === productId);
}

function addToCart(productId) {
  const p = products.find(x => x.id === productId);
  if (!p) return;

  const item = findCartItem(productId);
  if (item) item.qty += 1;
  else cart.push({ productId, qty: 1 });

  saveJSON(LS_KEYS.CART, cart);
  renderCart();
}

function setQty(productId, qty) {
  const item = findCartItem(productId);
  if (!item) return;
  item.qty = Math.max(1, Math.floor(qty));
  saveJSON(LS_KEYS.CART, cart);
  renderCart();
}

function decQty(productId) {
  const item = findCartItem(productId);
  if (!item) return;
  item.qty -= 1;
  if (item.qty <= 0) cart = cart.filter(x => x.productId !== productId);
  saveJSON(LS_KEYS.CART, cart);
  renderCart();
}

function removeItem(productId) {
  cart = cart.filter(x => x.productId !== productId);
  saveJSON(LS_KEYS.CART, cart);
  renderCart();
}

function calcTotals() {
  let subtotal = 0;
  for (const item of cart) {
    const p = products.find(x => x.id === item.productId);
    if (!p) continue;
    subtotal += p.price * item.qty;
  }

  const discountPct = clampPct(Number(discountInput.value));
  const taxPct = clampPct(Number(taxInput.value));

  const discountAmt = subtotal * (discountPct / 100);
  const taxable = Math.max(0, subtotal - discountAmt);
  const taxAmt = taxable * (taxPct / 100);
  const total = taxable + taxAmt;

  return { subtotal, discountPct, discountAmt, taxPct, taxAmt, total };
}

function clampPct(v) {
  if (!Number.isFinite(v)) return 0;
  return Math.min(100, Math.max(0, v));
}

function renderProducts() {
  const q = (searchInput.value || "").trim().toLowerCase();

  const list = products.filter(p => {
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      String(p.barcode).toLowerCase().includes(q)
    );
  });

  productGrid.innerHTML = list.map(p => `
    <div class="product">
      <div class="name">${escapeHtml(p.name)}</div>
      <div class="meta">
        <span>Barcode: ${escapeHtml(p.barcode || "-")}</span>
        <span>Each</span>
      </div>
      <div class="price">${money(p.price)}</div>
      <div class="actions">
        <button class="btn primary" data-add="${p.id}">Add</button>
      </div>
    </div>
  `).join("");

  productGrid.querySelectorAll("[data-add]").forEach(btn => {
    btn.addEventListener("click", () => addToCart(btn.dataset.add));
  });
}

function renderCart() {
  completeMsg.textContent = "";

  if (cart.length === 0) {
    cartList.innerHTML = `<div class="hint">Cart is empty. Add products from the left.</div>`;
  } else {
    cartList.innerHTML = cart.map(item => {
      const p = products.find(x => x.id === item.productId);
      if (!p) return "";
      const line = p.price * item.qty;

      return `
        <div class="cart-item">
          <div class="top">
            <div>
              <div class="title">${escapeHtml(p.name)}</div>
              <div class="sub">Barcode: ${escapeHtml(p.barcode || "-")} • ${money(p.price)} each</div>
            </div>
            <div class="right">
              <div class="lineprice">${money(line)}</div>
            </div>
          </div>
          <div class="qty">
            <button data-dec="${p.id}" aria-label="Decrease">−</button>
            <div class="q">${item.qty}</div>
            <button data-inc="${p.id}" aria-label="Increase">+</button>
            <button class="btn ghost remove" data-remove="${p.id}">Remove</button>
          </div>
        </div>
      `;
    }).join("");

    cartList.querySelectorAll("[data-dec]").forEach(b => b.addEventListener("click", () => decQty(b.dataset.dec)));
    cartList.querySelectorAll("[data-inc]").forEach(b => b.addEventListener("click", () => addToCart(b.dataset.inc)));
    cartList.querySelectorAll("[data-remove]").forEach(b => b.addEventListener("click", () => removeItem(b.dataset.remove)));
  }

  // Count
  const count = cart.reduce((acc, i) => acc + i.qty, 0);
  cartCount.textContent = `${count} item${count === 1 ? "" : "s"}`;

  // Totals
  const t = calcTotals();
  subtotalText.textContent = money(t.subtotal);
  discountText.textContent = `-${money(t.discountAmt)}`;
  taxText.textContent = money(t.taxAmt);
  totalText.textContent = money(t.total);

  // Change
  const cash = Number(cashInput.value);
  const change = Number.isFinite(cash) ? (cash - t.total) : 0;
  changeText.textContent = money(change);

  // Persist settings
  settings.discountPct = t.discountPct;
  settings.taxPct = t.taxPct;
  saveJSON(LS_KEYS.SETTINGS, settings);
}

function buildReceiptText() {
  const t = calcTotals();
  const now = new Date();

  const lines = [];
  lines.push("=== SIMPLE POS RECEIPT ===");
  lines.push(`Date: ${now.toLocaleString()}`);
  lines.push("--------------------------");

  for (const item of cart) {
    const p = products.find(x => x.id === item.productId);
    if (!p) continue;
    const line = p.price * item.qty;
    lines.push(`${p.name} x${item.qty}  ${money(line)}`);
  }

  lines.push("--------------------------");
  lines.push(`Subtotal:   ${money(t.subtotal)}`);
  lines.push(`Discount:  -${money(t.discountAmt)} (${t.discountPct}%)`);
  lines.push(`Tax:        ${money(t.taxAmt)} (${t.taxPct}%)`);
  lines.push(`TOTAL:      ${money(t.total)}`);

  const cash = Number(cashInput.value);
  if (Number.isFinite(cash) && cash > 0) {
    const change = cash - t.total;
    lines.push(`Cash:       ${money(cash)}`);
    lines.push(`Change:     ${money(change)}`);
  }

  lines.push("--------------------------");
  lines.push("Thank you!");
  return lines.join("\n");
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Events
searchInput.addEventListener("input", renderProducts);

discountInput.addEventListener("input", renderCart);
taxInput.addEventListener("input", renderCart);
cashInput.addEventListener("input", renderCart);

btnNewSale.addEventListener("click", () => {
  cart = [];
  cashInput.value = "";
  saveJSON(LS_KEYS.CART, cart);
  renderCart();
});

btnAddProduct.addEventListener("click", () => {
  pBarcode.value = "";
  pName.value = "";
  pPrice.value = "";
  openModal(productModal);
  pBarcode.focus();
});

function closeProduct() { closeModal(productModal); }
closeProductModal.addEventListener("click", closeProduct);
cancelProduct.addEventListener("click", closeProduct);
productModal.addEventListener("click", (e) => {
  if (e.target === productModal) closeProduct();
});

saveProductBtn.addEventListener("click", () => {
  const barcode = (pBarcode.value || "").trim();
  const name = (pName.value || "").trim();
  const price = Number(pPrice.value);

  if (!name || !Number.isFinite(price) || price < 0) {
    alert("Please enter a valid Name and Price.");
    return;
  }

  products.unshift({
    id: crypto.randomUUID(),
    barcode,
    name,
    price: Math.round(price * 100) / 100,
  });

  saveJSON(LS_KEYS.PRODUCTS, products);
  closeProduct();
  renderProducts();
});

btnReceipt.addEventListener("click", () => {
  receiptArea.textContent = buildReceiptText();
  openModal(receiptModal);
});

function closeReceipt() { closeModal(receiptModal); }
closeReceiptModal.addEventListener("click", closeReceipt);
btnCloseReceipt.addEventListener("click", closeReceipt);
receiptModal.addEventListener("click", (e) => {
  if (e.target === receiptModal) closeReceipt();
});

btnPrintNow.addEventListener("click", () => {
  // Print only the receipt area
  const html = `
    <html>
      <head>
        <title>Receipt</title>
        <style>
          body{ font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; padding:18px; }
          pre{ white-space:pre-wrap; font-size:13px; line-height:1.45; }
        </style>
      </head>
      <body>
        <pre>${escapeHtml(receiptArea.textContent)}</pre>
      </body>
    </html>
  `;
  const w = window.open("", "_blank");
  if (!w) return alert("Popup blocked. Allow popups to print.");
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
});

btnComplete.addEventListener("click", () => {
  if (cart.length === 0) {
    completeMsg.textContent = "Cart is empty.";
    return;
  }

  const t = calcTotals();
  const cash = Number(cashInput.value);

  if (!Number.isFinite(cash) || cash < t.total) {
    completeMsg.textContent = "Not enough cash received.";
    return;
  }

  // Show receipt immediately
  receiptArea.textContent = buildReceiptText();
  openModal(receiptModal);

  // Clear cart after completing
  cart = [];
  cashInput.value = "";
  saveJSON(LS_KEYS.CART, cart);
  renderCart();
  completeMsg.textContent = "Sale completed.";
});

// Initial render
renderProducts();
renderCart();
