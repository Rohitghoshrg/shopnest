// js/shop.js — what the visitor sees.
// Parts in this file:
//   1) Product card (photo, name, price, buttons)
//   2) Home page (hero, flash sale, categories, fashion picks)
//   3) Filter bar (sort, brand, max price)
//   4) List pages (a category, all products, search)
//   5) One product in a popup
//   6) Sidebar drawer (the dark navy menu)
//   7) Which page to show (reads the #/ address)

import { PRODUCTS, CATEGORIES, getProduct, getProductsByCategory } from "./data.js";
import { FIREBASE_CONFIGURED } from "./firebase.js";
import { trackOrder, loadMyOrders } from "./checkout.js";
import { renderAdmin } from "./admin.js";
import { renderProfile, toggleDark, doLogout } from "./profile.js";
import { session, isAuthReady, isGuestMode, renderWelcomePage, renderUserLoginPage, renderAdminLoginPage } from "./auth.js";

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

// Make text safe to put into the page. This stops a product
// name from ever breaking the page or running code.
function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[character]));
}

// How many products are shown on a list page right now.
// It starts at "pageSize" and grows by "pageSize" each time
// "Load More" is pressed. A single category page shows all
// 30 products at once, so its page size is 30.
let shownCount = 12;
let pageSize = 12;

// The last page address we drew. We use it to know when the
// visitor moved to a different page, so we can reset the
// "Load More" count back to 12.
let lastRoute = "";

// The current filter choices on a list page.
let filter = { sort: "popular", brand: "", maxPrice: "" };

// A photo to show when a product photo fails to load.
const FALLBACK_PHOTO = "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&q=80&auto=format&fit=crop";

// Build the HTML for one product card.
// "off" is the discount percent, worked out from old vs new price.
// ----- PRODUCT CARD PART -----
export function cardHTML(product) {
  const discountPercent = product.oldPrice > product.price
    ? Math.round((1 - product.price / product.oldPrice) * 100)
    : 0;
  return `<div class="card">
    <a href="#/product/${product.id}"><img src="${product.image}" alt="${escapeHtml(product.name)}" width="600" height="600" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${FALLBACK_PHOTO}'" /></a>
    <div class="card-body">
      <h3><a href="#/product/${product.id}">${escapeHtml(product.name)}</a></h3>
      <div><span class="price">${formatPrice(product.price)}</span>${product.oldPrice > product.price ? `<span class="old">${formatPrice(product.oldPrice)}</span>` : ""}${discountPercent ? ` <span>-${discountPercent}%</span>` : ""}</div>
      <div class="meta">★ ${product.rating} • ${product.sold} sold • ${escapeHtml(product.variant)}</div>
      <button onclick="window.shopnestAdd('${product.id}')">Add to Cart</button>
      <button class="secondary" onclick="window.shopnestBuy('${product.id}')">Buy Now</button>
    </div>
  </div>`;
}

// Sort and filter a list of products using the current filter.
// Returns a new list; the original list is not changed.
function applyFilter(productList) {
  let result = [...productList];
  if (filter.brand) {
    result = result.filter((product) => product.brand === filter.brand);
  }
  if (filter.maxPrice) {
    result = result.filter((product) => product.price <= Number(filter.maxPrice));
  }
  if (filter.sort === "low") {
    result.sort((first, second) => first.price - second.price);
  } else if (filter.sort === "high") {
    result.sort((first, second) => second.price - first.price);
  } else if (filter.sort === "rating") {
    result.sort((first, second) => second.rating - first.rating);
  } else {
    // "popular" is the default: most sold first.
    result.sort((first, second) => second.sold - first.sold);
  }
  return result;
}

// The first photo of a category, used as the category tile image.
function categoryThumbnail(categorySlug) {
  const firstProduct = getProductsByCategory(categorySlug)[0];
  return firstProduct ? firstProduct.image : "";
}

// ----- CATEGORY TILES PART -----
// Build the "Shop by Category" tiles for the home page.
function categoryTilesHtml() {
  return CATEGORIES.map((category) => {
    const thumbnail = categoryThumbnail(category.slug);
    return `<a class="cat-tile" href="#/cat/${category.slug}"><img src="${thumbnail}" alt="${escapeHtml(category.name)}" width="300" height="192" loading="lazy" decoding="async" onerror="this.style.display='none'" />${escapeHtml(category.name)}</a>`;
  }).join("");
}


// ----- LEFT SIDEBAR PART -----
// Build the left sidebar: every category with a small photo
// and its product count. Clicking an item opens that
// category's own section page. "activeSlug" is the category
// the visitor is looking at right now ("" on the home page),
// so it can be highlighted.
function sidebarHtml(activeSlug) {
  const items = CATEGORIES.map((category) => {
    const thumbnail = categoryThumbnail(category.slug);
    const count = getProductsByCategory(category.slug).length;
    const activeClass = category.slug === activeSlug ? " active" : "";
    return `<a class="side-item${activeClass}" href="#/cat/${category.slug}">
      <img src="${thumbnail}" alt="" width="48" height="48" loading="lazy" decoding="async" onerror="this.style.display='none'" />
      <span class="side-name">${escapeHtml(category.name)}</span>
      <span class="side-count">${count}</span></a>`;
  }).join("");
  return `<aside class="sidebar" id="sidebar">
    <h3>Shop by Category</h3>
    <p class="side-sub">Fashion, gadgets, home &amp; more</p>
    <nav class="side-list">${items}</nav>
    <a class="side-all" href="#/all">All Products →</a>
  </aside>`;
}

// Connect the "☰ Categories" button that opens / closes the
// sidebar on small screens (phones and tablets).
function wireSidebarToggle() {
  const toggleButton = findElement("#sidebarToggle");
  const sidebar = findElement("#sidebar");
  if (!toggleButton || !sidebar) return;
  toggleButton.onclick = () => {
    sidebar.classList.toggle("open");
    toggleButton.textContent = sidebar.classList.contains("open")
      ? "✕ Close Categories" : "☰ Categories";
  };
}

// The small button that shows the sidebar on phones.
function sidebarToggleHtml() {
  return `<button id="sidebarToggle" class="sidebar-toggle">☰ Categories</button>`;
}


// ----- SIDEBAR DRAWER PART -----
// The dark navy menu that slides in from the left, opened by
// the hamburger button in the header. Top: logo mark, then
// your big round photo, name and email. Then the menu, then
// the categories. Guests see Home + Login; logged-in users
// also see Orders, Profile, Dark Mode, Logout; the admin
// also sees Dashboard. Re-drawn on every page, so the photo
// and name are always current.

// First and last letter initials, e.g. "Rohit Ghosh" -> "RG".
function drawerInitials(name, email) {
  const source = (name || email || "?").trim();
  const words = source.split(/\s+/);
  if (words.length > 1) {
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

// One menu row: an icon, a label, and where it goes.
function drawerMenuItem(icon, label, href, isActive) {
  return `<a class="drawer-menu-item${isActive ? " active" : ""}" href="${href}"><span class="mi-icon">${icon}</span>${label}</a>`;
}

// Draw (or re-draw) the sidebar content.
export function renderDrawer() {
  const drawer = findElement("#sideDrawer");
  if (!drawer) {
    return;
  }
  const hash = location.hash || "#/";
  const user = session.user;
  const userName = user ? (user.displayName || user.email.split("@")[0]) : "";
  const userEmail = user ? user.email : "";
  // Big round photo at the top: the user's own photo if they set
  // one, otherwise their initials in a gradient circle.
  const avatar = user
    ? (user.photoURL
      ? `<img class="drawer-avatar" src="${escapeHtml(user.photoURL)}" alt="Profile photo" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><span class="drawer-avatar-fallback" style="display:none">${escapeHtml(drawerInitials(userName, userEmail))}</span>`
      : `<span class="drawer-avatar-fallback">${escapeHtml(drawerInitials(userName, userEmail))}</span>`)
    : `<span class="drawer-avatar-fallback">?</span>`;
  const profileBlock = user
    ? `<div class="drawer-profile">${avatar}<p class="drawer-name">${escapeHtml(userName)}</p><p class="drawer-email">${escapeHtml(userEmail)}</p></div>`
    : `<div class="drawer-profile">${avatar}<p class="drawer-name">Guest</p><p class="drawer-email">Login to see your profile</p><a href="#/login"><button class="drawer-login-btn">Login / Sign Up</button></a></div>`;

  // The menu: everyone gets Home; only the admin gets Dashboard.
  // Orders, Track Order and Profile need a login, so guests do
  // not see them — a guest only sees Home and Login / Sign Up.
  // (Before, guests saw those links and got a login box popped
  // up at them for no reason.)
  let menu = drawerMenuItem("🏠", "Home", "#/", hash === "#/" || hash === "");
  if (session.isAdmin) {
    menu += drawerMenuItem("🛡️", "Dashboard", "#/admin", hash === "#/admin");
  }
  if (user) {
    menu += drawerMenuItem("📦", "My Orders", "#/orders", hash === "#/orders");
    menu += drawerMenuItem("🔍", "Track Order", "#/orders", false);
    menu += drawerMenuItem("👤", "Profile", "#/profile", hash === "#/profile");
  } else {
    menu += drawerMenuItem("🔑", "Login / Sign Up", "#/login", hash === "#/login");
  }
  menu += `<button class="drawer-menu-item" id="drawerDarkBtn"><span class="mi-icon">🌙</span>Dark Mode</button>`;
  if (user) {
    menu += `<button class="drawer-menu-item" id="drawerLogoutBtn"><span class="mi-icon">🚪</span>Logout</button>`;
  }

  const categories = CATEGORIES.map((category) => {
    const thumbnail = categoryThumbnail(category.slug);
    const count = getProductsByCategory(category.slug).length;
    const activeClass = hash === `#/cat/${category.slug}` ? " active" : "";
    return `<a class="drawer-cat${activeClass}" href="#/cat/${category.slug}">
      <img src="${thumbnail}" alt="" width="36" height="36" loading="lazy" decoding="async" onerror="this.style.display='none'" />
      <span class="side-name">${escapeHtml(category.name)}</span>
      <span class="side-count">${count}</span></a>`;
  }).join("");

  drawer.innerHTML = `
    <div class="drawer-top">
      <span class="logo-tile"><img class="logo-mark-img" src="logo-mark.png" alt="" width="68" height="44" /></span>
      <span class="logo-word">ShopNest</span>
      <button class="drawer-close" id="drawerCloseBtn" aria-label="Close menu">✕</button>
    </div>
    ${profileBlock}
    <nav class="drawer-menu">${menu}</nav>
    <div class="drawer-section">Shop Categories</div>
    <nav class="drawer-cats">${categories}</nav>`;

  // Wire the buttons inside the drawer.
  findElement("#drawerCloseBtn").onclick = closeDrawer;
  const darkButton = findElement("#drawerDarkBtn");
  if (darkButton) {
    darkButton.onclick = () => {
      toggleDark();
      renderDrawer();
    };
  }
  const logoutButton = findElement("#drawerLogoutBtn");
  if (logoutButton) {
    logoutButton.onclick = () => {
      closeDrawer();
      doLogout();
    };
  }
}

// Open the drawer (and the dark overlay behind it).
export function openDrawer() {
  renderDrawer();
  findElement("#sideDrawer").classList.add("open");
  findElement("#drawerOverlay").style.display = "block";
}

// Close the drawer and hide the overlay.
export function closeDrawer() {
  const drawer = findElement("#sideDrawer");
  if (drawer) {
    drawer.classList.remove("open");
  }
  const overlay = findElement("#drawerOverlay");
  if (overlay) {
    overlay.style.display = "none";
  }
}

// Connect the hamburger button, the overlay, and the drawer so
// it re-draws whenever the logged-in user changes.
function initDrawer() {
  findElement("#menuBtn").onclick = openDrawer;
  findElement("#drawerOverlay").onclick = closeDrawer;
  // Any link inside the drawer closes it after the click.
  findElement("#sideDrawer").addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      closeDrawer();
    }
  });
  // The profile photo can change on the Profile page — redraw
  // the drawer then so the new photo shows straight away.
  window.addEventListener("shopnest-user-changed", renderDrawer);
}

// ----- HOME PAGE PART -----
// The home page: hero, flash sale, categories, fashion, just for you.
// Only 28 cards are drawn at first, so the page stays fast.
function renderHome() {
  const flashSaleProducts = PRODUCTS.slice(0, 8);
  // Fashion means the clothing categories.
  const fashionCategories = ["saree", "threepiece", "kurti", "tshirt", "shirt", "hoodie", "jacket"];
  const fashionProducts = PRODUCTS.filter((product) => fashionCategories.includes(product.category)).slice(0, 8);
  const justForYouProducts = PRODUCTS.slice(8, 20);

  appArea.innerHTML = `
    ${sidebarToggleHtml()}
    <div class="layout">
    ${sidebarHtml("")}
    <div class="layout-content">
    <div class="hero"><div><span class="pill">New season • Fashion & more</span><h1>Find your perfect <em>style</em></h1>
    <p class="welcome-tagline">Shop Smart. Live Better.</p>
    <p>Best prices in Bangladesh, cash on delivery, and 20% off your first order with code <b>BLACK20</b>. Fashion, gadgets, home and more — all in one place, delivered fast to your door.</p>
    <a href="#/all"><button>Shop All Products</button></a> <a href="#/cat/saree"><button class="secondary">Shop Fashion</button></a></div>
    <img src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&q=80&auto=format&fit=crop" alt="New season fashion" width="1200" height="800" fetchpriority="high" decoding="async" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&q=80&auto=format&fit=crop'" /></div>
    <div class="section-head"><h2>Flash Sale</h2><a href="#/all">See all →</a></div><div class="grid">${flashSaleProducts.map(cardHTML).join("")}</div>
    <div class="section-head"><h2>Shop by Category</h2></div>
    <div class="cat-grid">${categoryTilesHtml()}</div>
    <div class="fashion-banner"><img src="https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1200&q=80&auto=format&fit=crop" alt="Fashion collection" width="1200" height="480" loading="lazy" decoding="async" /><div class="fb-text"><h3>Fashion Edit — New Looks</h3><p>Saree • Three Piece • Kurti • T-Shirt • Hoodie • Jacket — fresh styles, real prices.</p></div></div>
    <div class="section-head"><h2>Fashion Picks For You</h2><a href="#/cat/saree">Shop fashion →</a></div><div class="grid">${fashionProducts.map(cardHTML).join("")}</div>
    <div class="section-head"><h2>Just For You</h2></div><div class="grid">${justForYouProducts.map(cardHTML).join("")}</div>
    </div>
    </div>`;
  wireSidebarToggle();
}

// ----- FILTER BAR PART -----
// Build the filter bar (sort, brand, max price) for a list page.
function filtersHtml(brandList) {
  const brandOptions = brandList.map((brand) => `<option>${escapeHtml(brand)}</option>`).join("");
  return `<div class="filters">
      <select id="sortSel">
        <option value="popular">Most popular</option>
        <option value="low">Price: low to high</option>
        <option value="high">Price: high to low</option>
        <option value="rating">Top rated</option>
      </select>
      <select id="brandSel"><option value="">All brands</option>${brandOptions}</select>
      <input id="maxPrice" type="number" placeholder="Max price ৳" style="width:150px" />
      <button id="filterBtn" class="secondary">Filter</button>
    </div>`;
}

// Connect the filter bar, and keep the chosen values showing.
// The filters apply straight away: changing the sort or the
// brand re-sorts the list at once, and the max price applies
// shortly after you stop typing (or when you press Enter).
// The "Filter" button does the same thing, for anyone who
// would rather press a button. The choices are kept in the
// "filter" box above, so a re-draw never loses them.
function wireFilters() {
  findElement("#sortSel").value = filter.sort;
  findElement("#brandSel").value = filter.brand;
  findElement("#maxPrice").value = filter.maxPrice;
  // Read the bar and redraw the list with those filters.
  const applyFiltersNow = () => {
    filter = {
      sort: findElement("#sortSel").value,
      brand: findElement("#brandSel").value,
      maxPrice: findElement("#maxPrice").value,
    };
    shownCount = pageSize;
    render();
  };
  findElement("#sortSel").onchange = applyFiltersNow;
  findElement("#brandSel").onchange = applyFiltersNow;
  // Max price: wait a moment after typing, so the list does
  // not jump while you are still typing the number.
  let maxPriceTimer = null;
  findElement("#maxPrice").oninput = () => {
    clearTimeout(maxPriceTimer);
    maxPriceTimer = setTimeout(applyFiltersNow, 700);
  };
  findElement("#maxPrice").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      clearTimeout(maxPriceTimer);
      applyFiltersNow();
    }
  });
  findElement("#filterBtn").onclick = applyFiltersNow;
  // "Show all products" on the empty page: clear the filters
  // and go back to the full list.
  const clearFiltersButton = findElement("#clearFiltersBtn");
  if (clearFiltersButton) {
    clearFiltersButton.onclick = () => {
      filter = { sort: "popular", brand: "", maxPrice: "" };
      shownCount = pageSize;
      location.hash = "#/all";
    };
  }
  const loadMoreButton = findElement("#loadMore");
  if (loadMoreButton) {
    loadMoreButton.onclick = () => {
      shownCount += pageSize;
      render();
    };
  }
}

// ----- PRODUCT LIST PART -----
// Show a list page: a title, the filter bar, and the products.
// Only the first "shownCount" products are drawn; the rest wait
// for the "Load More" button. A category page has pageSize 30,
// so all 30 products of that category are shown at once.
// "activeSlug" highlights the current category in the sidebar.
function renderList(title, productList, activeSlug) {
  const brandList = [...new Set(productList.map((product) => product.brand))].sort();
  const filteredProducts = applyFilter(productList);
  const pageProducts = filteredProducts.slice(0, shownCount);
  const remainingCount = filteredProducts.length - shownCount;
  // No match at all: say so in plain words, and give the
  // visitor a clear next step instead of a dead end.
  const noMatchHtml = `<div class="empty-state"><p><b>No products match.</b></p><p>Try a different word, a higher max price, or another brand.</p><p><button id="clearFiltersBtn">Show all products</button></p></div>`;
  appArea.innerHTML = `${sidebarToggleHtml()}
    <div class="layout">
    ${sidebarHtml(activeSlug || "")}
    <div class="layout-content">
    <h2>${escapeHtml(title)}</h2>
    ${filtersHtml(brandList)}
    <div class="grid">${pageProducts.map(cardHTML).join("") || noMatchHtml}</div>
    ${remainingCount > 0 ? `<p><button id="loadMore">Load More (${remainingCount} left)</button></p>` : ""}
    </div>
    </div>`;
  wireFilters();
  wireSidebarToggle();
}

// ----- ONE PRODUCT POPUP PART -----
// Show one product in a popup, and the product's category below it.
function openProduct(productId) {
  const product = getProduct(productId);
  if (!product) {
    appArea.innerHTML = "<p>Product not found.</p>";
    return;
  }
  findElement("#productModalBox").innerHTML = `
    <img src="${product.image}" alt="${escapeHtml(product.name)}" width="600" height="600" decoding="async" onerror="this.onerror=null;this.src='${FALLBACK_PHOTO}'" />
    <h2>${escapeHtml(product.name)}</h2>
    <p><span class="price">${formatPrice(product.price)}</span> <span class="old">${formatPrice(product.oldPrice)}</span></p>
    <p class="meta">★ ${product.rating} • ${product.sold} sold • Stock: ${product.stock} • Variant: ${escapeHtml(product.variant)} • Brand: ${escapeHtml(product.brand)}</p>
    <p>${escapeHtml(product.description)}</p>
    <p>Delivery: 80৳ inside Dhaka, 120৳ outside • Cash on delivery available</p>
    <button onclick="window.shopnestAdd('${product.id}')">Add to Cart</button>
    <button class="secondary" onclick="window.shopnestBuy('${product.id}')">Buy Now</button>
    <button class="secondary" id="pmClose">Close</button>`;
  findElement("#productModal").style.display = "flex";
  findElement("#pmClose").onclick = () => {
    findElement("#productModal").style.display = "none";
    location.hash = "#/";
  };
  renderList(product.categoryName, getProductsByCategory(product.category));
}

// ----- MY ORDERS PAGE PART -----
// Show the "My Orders / Track Order" page.
function renderOrdersPage() {
  appArea.innerHTML = `<h2>My Orders / Track Order</h2>
    <p>Enter your order number (e.g. SN-...) to track it. Only the status is shown here — no other customer's details.</p>
    <input id="trackInput" placeholder="SN- number" />
    <button id="trackBtn">Track Order</button>
    <div id="trackResult"></div>
    <h3>My Orders</h3><div id="myOrders">Login to see your orders.</div>`;
  findElement("#trackBtn").onclick = trackOrder;
  loadMyOrders();
}

// Colour the header link for the page you are on, so you can
// always see where you are in the shop.
function highlightNav(hash) {
  const linkForPage = {
    "#/": "#navHome",
    "#/all": "#navAll",
    "#/orders": "#myOrdersLink",
    "#/profile": "#profileBtn",
    "#/admin": "#adminLink",
  };
  let activeId = linkForPage[hash] || "";
  // Category, search and product pages all belong to shopping,
  // so they highlight "All Products".
  if (!activeId && (hash.startsWith("#/cat/") || hash.startsWith("#/search/") || hash.startsWith("#/product/"))) {
    activeId = "#navAll";
  }
  document.querySelectorAll(".nav-link").forEach((link) => link.classList.remove("active"));
  if (activeId) {
    const activeLink = findElement(activeId);
    if (activeLink) {
      activeLink.classList.add("active");
    }
  }
}

// ----- WHICH PAGE TO SHOW PART -----
// Read the page address and show the right page.
// Examples: "#/" is home, "#/cat/saree" is a category,
// "#/product/headphones-01" is one product, "#/admin" is admin.
export function render() {
  // Keep the sidebar's photo and name up to date on every page.
  renderDrawer();
  // Show the yellow "Firebase not configured" banner if needed.
  findElement("#configBanner").style.display = FIREBASE_CONFIGURED ? "none" : "block";
  const hash = location.hash || "#/";
  highlightNav(hash);
  // While Firebase is still checking who is signed in, show a
  // short "loading" note instead of the shop — otherwise the
  // shop flashes for a second and then jumps to the login page.
  if (!isAuthReady()) {
    appArea.innerHTML = `<div class="loading-box"><p>Loading ShopNest...</p></div>`;
    return;
  }
  // Login first: once Firebase has told us who is signed in,
  // a logged-out visitor sees the welcome page first — never
  // the shop itself. A logged-in user skips straight to the shop.
  // The two login pages must also open for guests: a guest who
  // clicks "Login / Sign Up" in the sidebar would otherwise get
  // a dead page, because no shop page matches #/login.
  if (isAuthReady() && !session.user) {
    if (hash === "#/login") {
      renderUserLoginPage(render);
      window.scrollTo(0, 0);
      return;
    }
    if (hash === "#/admin-login") {
      renderAdminLoginPage(render);
      window.scrollTo(0, 0);
      return;
    }
    // Searching is just looking around: a logged-out visitor
    // who searches becomes a guest for that search, so the
    // search actually shows results instead of bouncing back
    // to the login page. (We only set the guest flag here —
    // the "Browse as guest" button does the same thing, but
    // it also jumps home, which would lose the search.)
    if (hash.startsWith("#/search/") && !isGuestMode()) {
      localStorage.setItem("shopnest_guest", "1");
    }
    if (!isGuestMode()) {
      renderWelcomePage(render);
      window.scrollTo(0, 0);
      return;
    }
  }
  const parts = hash.replace(/^#\//, "").split("/");
  // A category section shows all 30 of its products at once;
  // other lists start at 12 and grow with "Load More".
  pageSize = hash.startsWith("#/cat/") ? 30 : 12;
  // Only reset the "Load More" count when the page really changes.
  const routeKey = hash.split("/").slice(0, 3).join("/");
  if (routeKey !== lastRoute) {
    shownCount = pageSize;
    lastRoute = routeKey;
    // A new search starts with clean filters, so an old max
    // price or brand from another page cannot hide results.
    if (hash.startsWith("#/search/")) {
      filter = { sort: "popular", brand: "", maxPrice: "" };
    }
  }
  if (hash.startsWith("#/cat/")) {
    const category = CATEGORIES.find((item) => item.slug === parts[1]);
    renderList(category ? category.name : parts[1], getProductsByCategory(parts[1]), parts[1]);
  } else if (hash.startsWith("#/product/")) {
    openProduct(parts[1]);
  } else if (hash === "#/all") {
    renderList("All Products", PRODUCTS);
  } else if (hash.startsWith("#/search/")) {
    const searchText = decodeURIComponent(parts[1] || "").toLowerCase();
    const matches = PRODUCTS.filter((product) => {
      const haystack = (product.name + " " + product.brand + " " + product.categoryName).toLowerCase();
      return haystack.includes(searchText);
    });
    renderList(`Search: ${searchText}`, matches);
  } else if (hash === "#/orders") {
    renderOrdersPage();
  } else if (hash === "#/profile") {
    renderProfile();
  } else if (hash === "#/admin") {
    renderAdmin();
  } else {
    renderHome();
  }
  window.scrollTo(0, 0);
}

// ----- SEARCH BOX PART -----
// Connect the search box and the product popup to their actions.
export function initShop() {
  initDrawer();
  findElement("#searchBtn").onclick = () => {
    const searchText = findElement("#searchInput").value.trim();
    if (searchText) {
      location.hash = "#/search/" + encodeURIComponent(searchText);
    }
  };
  // Pressing Enter in the search box works like the Search button.
  findElement("#searchInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      findElement("#searchBtn").click();
    }
  });
  // Clicking the dark area around the product popup closes it.
  findElement("#productModal").addEventListener("click", (event) => {
    if (event.target.id === "productModal") {
      findElement("#productModal").style.display = "none";
    }
  });
}
