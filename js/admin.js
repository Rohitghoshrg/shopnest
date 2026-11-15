// js/admin.js — the Admin Dashboard. Only the shop owner sees it.
// Parts in this file:
//   1) Admin page (name card, numbers, orders, products, customers)
//   2) Seed 450 products to Firestore
//   3) Number cards (orders, sales, products, customers)
//   4) Orders list + change an order's status
//   5) Products list, customers list

import { getFirebase, FIREBASE_CONFIGURED } from "./firebase.js";
import { PRODUCTS, CATEGORIES, getProductsByCategory } from "./data.js";
import { session, openAuth } from "./auth.js";

// Find one thing on the page, like "#loginBtn".
function findElement(selector) {
  return document.querySelector(selector);
}

// The main area of the page where pages are drawn.
const appArea = findElement("#app");

// Format a number as a Taka price, for example 8000 -> "8,000৳".
function formatPrice(amount) {
  return Number(amount).toLocaleString("en-US") + "৳";
}

// Make text safe to put into the page.
function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[character]));
}

// The order statuses the owner can choose from.
const ORDER_STATUSES = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];

// Show the Admin Dashboard page. If nobody is logged in, open
// the login box. If a normal customer tries to open it, they
// get a message instead — Admin is for the owner only.
// ----- ADMIN PAGE PART -----
export async function renderAdmin() {
  if (!session.user) {
    appArea.innerHTML = "<p>Please login first.</p>";
    openAuth("login");
    return;
  }
  if (!session.isAdmin) {
    appArea.innerHTML = "<p>This is not the admin account. Admin dashboard is only for the store owner (Mohendhro).</p>";
    return;
  }
  // The admin's own card: photo or initial, NAME (not just the
  // email), email and the "Store Owner" badge.
  const adminName = session.user.displayName || "Mohendhro";
  const adminFirstLetter = adminName.trim().charAt(0).toUpperCase();
  const adminAvatar = session.user.photoURL
    ? `<img class="admin-avatar-img" src="${escapeHtml(session.user.photoURL)}" alt="Admin photo" onerror="this.style.display='none'" />`
    : `<span class="admin-avatar">${escapeHtml(adminFirstLetter)}</span>`;
  appArea.innerHTML = `<div class="page-banner"><img src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&q=80&auto=format&fit=crop" alt="Admin dashboard" width="1200" height="340" loading="lazy" decoding="async" /><div class="pb-text"><h2>Admin Dashboard</h2><p>Welcome back, ${escapeHtml(adminName)} — this is your store.</p></div></div>
    <div class="admin-id-card">${adminAvatar}<div><h3>${escapeHtml(adminName)}</h3><p>${escapeHtml(session.user.email)}</p><span class="owner-badge">Store Owner • Admin</span></div></div>
    <p class="meta">Signed in as owner: ${escapeHtml(session.user.email)}</p>
    <button id="seedBtn">Seed 450 products to Firestore</button> <span id="seedMsg"></span>
    <div class="stat-grid" id="stats"><p>Loading stats...</p></div>
    <h3>Orders</h3>
    <input id="orderSearch" placeholder="Search by SN- number, name or phone" />
    <select id="statusFilter"><option value="">All statuses</option><option>Pending</option><option>Processing</option><option>Shipped</option><option>Delivered</option><option>Cancelled</option></select>
    <div id="ordersList"></div>
    <h3>Products</h3><div id="productsList"></div>
    <h3>Customers</h3><div id="customersList"></div>`;
  findElement("#seedBtn").onclick = seedProducts;
  findElement("#orderSearch").oninput = loadAdminOrders;
  findElement("#statusFilter").onchange = loadAdminOrders;
  loadAdminStats();
  loadAdminOrders();
  loadAdminProducts();
  loadAdminCustomers();
}

// ----- SEED PRODUCTS PART -----
// Copy all 450 local products into Firestore.
// Firestore writes at most 500 items at a time, so 450 products
// go in two groups (400 + 50).
async function seedProducts() {
  if (!FIREBASE_CONFIGURED) {
    findElement("#seedMsg").textContent = "Configure Firebase first (README step 4).";
    return;
  }
  const firebase = await getFirebase();
  if (!firebase) {
    findElement("#seedMsg").textContent = "Firebase could not be reached — check your internet connection.";
    return;
  }
  findElement("#seedMsg").textContent = "Seeding...";
  try {
    for (let start = 0; start < PRODUCTS.length; start += 400) {
      const batch = firebase.writeBatch(firebase.db);
      const group = PRODUCTS.slice(start, start + 400);
      group.forEach((product) => {
        batch.set(firebase.doc(firebase.db, "products", product.id), product);
      });
      await batch.commit();
    }
    findElement("#seedMsg").textContent = "Seeded 450 products to Firestore.";
    loadAdminProducts();
    loadAdminStats();
  } catch (error) {
    findElement("#seedMsg").textContent = "Seed failed: " + error.message;
  }
}

// ----- NUMBER CARDS PART -----
// Build the four number cards (orders, sales, products, customers).
function statsCardsHtml(totalOrders, totalSales, totalCustomers) {
  return `<div class="stat"><span class="stat-icon">📦</span><b>${totalOrders}</b>Total Orders</div>
      <div class="stat grad-2"><span class="stat-icon">💰</span><b>${formatPrice(totalSales)}</b>Total Sales</div>
      <div class="stat grad-3"><span class="stat-icon">🛍️</span><b>${PRODUCTS.length}</b>Total Products</div>
      <div class="stat grad-4"><span class="stat-icon">👥</span><b>${totalCustomers}</b>Total Customers</div>`;
}

// Load the numbers for the top of the dashboard.
async function loadAdminStats() {
  const statsBox = findElement("#stats");
  if (!statsBox) {
    return;
  }
  if (!FIREBASE_CONFIGURED) {
    statsBox.innerHTML = statsCardsHtml(0, 0, 0) + "<p>Firebase not configured — stats from Firestore will show here once it is.</p>";
    return;
  }
  const firebase = await getFirebase();
  if (!firebase) {
    statsBox.textContent = "Stats unavailable: Firebase could not be reached.";
    return;
  }
  try {
    const [ordersSnapshot, usersSnapshot] = await Promise.all([
      firebase.getDocs(firebase.collection(firebase.db, "orders")),
      firebase.getDocs(firebase.collection(firebase.db, "users")),
    ]);
    const orders = ordersSnapshot.docs.map((doc) => doc.data());
    // Cancelled orders do not count as sales.
    const totalSales = orders
      .filter((order) => order.status !== "Cancelled")
      .reduce((total, order) => total + (order.total || 0), 0);
    statsBox.innerHTML = statsCardsHtml(orders.length, totalSales, usersSnapshot.size);
  } catch (error) {
    statsBox.textContent = "Stats unavailable: " + error.message;
  }
}

// Keep only the orders that match the search box and status filter.
function filterAdminOrders(orders) {
  const searchText = (findElement("#orderSearch").value || "").toLowerCase();
  const statusFilter = findElement("#statusFilter").value;
  let result = orders;
  if (searchText) {
    result = result.filter((order) => {
      const text = [order.orderNumber, order.name, order.phone].join(" ").toLowerCase();
      return text.includes(searchText);
    });
  }
  if (statusFilter) {
    result = result.filter((order) => order.status === statusFilter);
  }
  return result;
}

// Build one row of the orders table, with a status dropdown.
// An order with no status saved yet counts as Pending —
// without this, the page would crash on that order.
function adminOrderRowHtml(order) {
  const orderDate = order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString() : order.createdAt || "";
  const itemList = (order.items || []).map((item) => `${escapeHtml(item.name)} × ${item.qty}`).join("<br/>");
  const status = order.status || "Pending";
  const statusOptions = ORDER_STATUSES.map((statusOption) => {
    const selected = statusOption === status ? "selected" : "";
    return `<option ${selected}>${statusOption}</option>`;
  }).join("");
  return `
      <tr><td>${escapeHtml(order.orderNumber)}<br/><small>${escapeHtml(orderDate)}</small></td>
      <td>${escapeHtml(order.name)}<br/>${escapeHtml(order.phone)}<br/><small>${escapeHtml(order.address)}, ${escapeHtml(order.district)}</small></td>
      <td>${formatPrice(order.total || 0)}</td><td><span class="pill ${escapeHtml(status.toLowerCase())}">${escapeHtml(status)}</span></td>
      <td><select data-order="${order._id}" class="statusSel">${statusOptions}</select>
      <br/><small>${itemList}</small></td></tr>`;
}

// ----- ORDERS LIST PART -----
// Load all orders, newest first, and show them in a table.
// When the owner changes a status in the dropdown, save it.
async function loadAdminOrders() {
  const ordersBox = findElement("#ordersList");
  if (!ordersBox) {
    return;
  }
  if (!FIREBASE_CONFIGURED) {
    ordersBox.innerHTML = "<p>No online orders yet — Firebase not configured.</p>";
    return;
  }
  const firebase = await getFirebase();
  if (!firebase) {
    ordersBox.textContent = "Orders unavailable: Firebase could not be reached.";
    return;
  }
  try {
    const snapshot = await firebase.getDocs(
      firebase.query(firebase.collection(firebase.db, "orders"), firebase.orderBy("createdAt", "desc"))
    );
    const allOrders = snapshot.docs.map((doc) => ({ _id: doc.id, ...doc.data() }));
    const orders = filterAdminOrders(allOrders);
    if (!orders.length) {
      ordersBox.innerHTML = "<p>No orders yet.</p>";
      return;
    }
    const rows = orders.map(adminOrderRowHtml).join("");
    ordersBox.innerHTML = `<table><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th></th></tr>${rows}</table>`;
    // Connect each status dropdown to its save action.
    ordersBox.querySelectorAll(".statusSel").forEach((select) => {
      select.onchange = async () => {
        await firebase.updateDoc(firebase.doc(firebase.db, "orders", select.dataset.order), { status: select.value });
        loadAdminStats();
      };
    });
  } catch (error) {
    ordersBox.textContent = "Orders unavailable: " + error.message;
  }
}

// ----- PRODUCTS LIST PART -----
// Show the products table: one row per category, with the
// number of products and the price range in that category.
function loadAdminProducts() {
  const productsBox = findElement("#productsList");
  if (!productsBox) {
    return;
  }
  const rows = CATEGORIES.map((category) => {
    const products = getProductsByCategory(category.slug);
    const prices = products.map((product) => product.price);
    const lowest = Math.min(...prices);
    const highest = Math.max(...prices);
    return `<tr><td>${escapeHtml(category.name)}</td><td>${products.length}</td><td>${formatPrice(lowest)} – ${formatPrice(highest)}</td></tr>`;
  }).join("");
  productsBox.innerHTML = `<p>450 products in the local catalogue (${CATEGORIES.length} categories × 30).</p>` +
    `<table><tr><th>Category</th><th>Products</th><th>Price range</th></tr>${rows}</table>`;
}

// ----- CUSTOMERS LIST PART -----
// Show the customers table: name, email and role of each user.
async function loadAdminCustomers() {
  const customersBox = findElement("#customersList");
  if (!customersBox) {
    return;
  }
  if (!FIREBASE_CONFIGURED) {
    customersBox.innerHTML = "<p>No customers yet — Firebase not configured.</p>";
    return;
  }
  const firebase = await getFirebase();
  if (!firebase) {
    customersBox.textContent = "Customers unavailable: Firebase could not be reached.";
    return;
  }
  try {
    const snapshot = await firebase.getDocs(firebase.collection(firebase.db, "users"));
    if (snapshot.empty) {
      customersBox.innerHTML = "<p>No customers yet.</p>";
      return;
    }
    const rows = snapshot.docs.map((doc) => {
      const user = doc.data();
      return `<tr><td>${escapeHtml(user.name || "")}</td><td>${escapeHtml(user.email || "")}</td><td>${escapeHtml(user.role || "")}</td></tr>`;
    }).join("");
    customersBox.innerHTML = `<table><tr><th>Name</th><th>Email</th><th>Role</th></tr>${rows}</table>`;
  } catch (error) {
    customersBox.textContent = "Customers unavailable: " + error.message;
  }
}
