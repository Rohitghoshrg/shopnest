// js/main.js — the starting point. Start reading here.
// Parts in this file:
//   1) Cart buttons (Add to Cart, Buy Now)
//   2) Wiring: connects login, cart, shop, checkout, dark mode
//   3) Shows the first page
// Think of it as the switchboard: it just wires things up.

import { initAuth, requireLogin } from "./auth.js";
import { addToCart, changeQty, openCart, saveCart, initCart, setCheckoutHandler } from "./cart.js";
import { render, initShop } from "./shop.js";
import { openCheckout, initCheckout } from "./checkout.js";
import { initDark } from "./profile.js";

// ----- CART BUTTONS PART -----
// These three functions are called from buttons inside the
// product cards (see js/shop.js). They live on "window" so the
// button code in the HTML can find them by name.
window.shopnestAdd = (productId) => {
  // You must be logged in before you can buy anything.
  if (!requireLogin()) {
    return;
  }
  addToCart(productId, 1);
  alert("Added to cart");
};

window.shopnestBuy = (productId) => {
  // "Buy Now" adds the product and opens the cart straight away.
  if (!requireLogin()) {
    return;
  }
  addToCart(productId, 1);
  openCart();
};

window.shopnestQty = (productId, change) => {
  changeQty(productId, change);
};

// When the cart's "Checkout" button is pressed, open checkout.
setCheckoutHandler(openCheckout);

// ----- START EVERYTHING PART -----
// Start each part of the shop, one by one.
initCart();
initShop();
initCheckout();
initDark();

// Start login: it watches who is signed in and updates the
// header (Login button, user name, Admin link). Whenever the
// login changes, redraw the page.
initAuth(render);

// When the page address changes (for example #/cat/saree),
// redraw the page to show the new page.
window.addEventListener("hashchange", render);

// Save the cart and show the first page.
saveCart();
render();

// A small flag other code can check: "yes, the shop started".
window.__shopnestBooted = true;
