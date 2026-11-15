// js/cart.js — the shopping cart.
// Parts in this file:
//   1) The cart itself (kept in the browser, survives refresh)
//   2) Add a product, change quantity, clear the cart
//   3) Subtotal + the BLACK20 coupon discount
//   4) Cart drawer (the slide-in panel)
// The cart is just a list like: [{ id: "headphones-01", qty: 2 }]

import { getProduct } from "./data.js";

// Find one thing on the page, like "#loginBtn".
function findElement(selector) {
  return document.querySelector(selector);
}

// Load the saved cart from the browser, or start with an empty cart.
export let cart = JSON.parse(localStorage.getItem("shopnest_cart") || "[]");

// Load the saved coupon code from the browser, or start empty.
export let coupon = localStorage.getItem("shopnest_coupon") || "";

// The checkout function, set by js/main.js. When the visitor
// clicks "Checkout" in the cart, this function opens checkout.
export let onCheckout = null;

export function setCheckoutHandler(checkoutFunction) {
  onCheckout = checkoutFunction;
}

// Save the cart to the browser and update the number on the
// Cart button in the header.
export function saveCart() {
  localStorage.setItem("shopnest_cart", JSON.stringify(cart));
  const totalItems = cart.reduce((total, line) => total + line.qty, 0);
  findElement("#cartCount").textContent = totalItems;
}

// Turn the cart into a full list of products, with the quantity
// and variant attached to each one. Lines for products that no
// longer exist are dropped.
export function cartDetailed() {
  return cart
    .map((line) => ({ ...getProduct(line.id), qty: line.qty, variant: line.variant }))
    .filter((product) => product.id);
}

// Add up the price of everything in the cart (before discount
// and before delivery).
export function subtotal() {
  return cartDetailed().reduce((total, product) => total + product.price * product.qty, 0);
}

// BLACK20 discount: 20% off, kintu 1000৳ or more hole tobei.
// BLACK20 gives 20% off, but only when the subtotal is 1000৳
// or more. Any other coupon gives no discount.
export function discountFor(subtotalAmount) {
  if (coupon === "BLACK20" && subtotalAmount >= 1000) {
    return Math.round(subtotalAmount * 0.2);
  }
  return 0;
}

// ----- ADD TO CART PART -----
// Add a product to the cart (or add more of it if it is already
// in the cart), then save the cart.
export function addToCart(productId, quantity) {
  const product = getProduct(productId);
  if (!product) {
    return;
  }
  const line = cart.find((cartLine) => cartLine.id === productId);
  if (line) {
    line.qty += quantity;
  } else {
    cart.push({ id: productId, qty: quantity, variant: product.variant });
  }
  saveCart();
}

// Change the quantity of a product already in the cart.
// If the quantity drops to zero, the product is removed.
// After changing, the cart panel is redrawn.
export function changeQty(productId, change) {
  const line = cart.find((cartLine) => cartLine.id === productId);
  if (!line) {
    return;
  }
  line.qty += change;
  if (line.qty <= 0) {
    cart = cart.filter((cartLine) => cartLine.id !== productId);
  }
  saveCart();
  openCart();
}

// Empty the cart completely and forget the coupon.
export function clearCart() {
  cart = [];
  coupon = "";
  localStorage.removeItem("shopnest_coupon");
  saveCart();
}

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

// Build the HTML for one line in the cart panel.
function cartLineHtml(product) {
  return `<p>${escapeHtml(product.name)} (${escapeHtml(product.variant)}) — ${formatPrice(product.price)} × ${product.qty} = <b>${formatPrice(product.price * product.qty)}</b>
    <button onclick="window.shopnestQty('${product.id}',1)">+</button>
    <button onclick="window.shopnestQty('${product.id}',-1)">−</button></p>`;
}

// ----- CART PANEL PART -----
// Open the cart panel and fill it with the current cart.
export function openCart() {
  const items = cartDetailed();
  if (items.length) {
    findElement("#cartItems").innerHTML = items.map(cartLineHtml).join("");
  } else {
    findElement("#cartItems").innerHTML = "<p>Cart is empty.</p>";
  }
  const subtotalAmount = subtotal();
  let totalText = `Subtotal: ${formatPrice(subtotalAmount)}`;
  if (coupon === "BLACK20") {
    totalText += ` • BLACK20 discount: −${formatPrice(discountFor(subtotalAmount))}`;
  }
  findElement("#cartTotal").textContent = totalText;
  findElement("#cartDrawer").style.display = "block";
}

// ----- COUPON PART -----
// Check the coupon the visitor typed and show a message.
function applyCoupon() {
  coupon = findElement("#couponInput").value.trim().toUpperCase();
  localStorage.setItem("shopnest_coupon", coupon);
  if (coupon === "BLACK20") {
    if (subtotal() >= 1000) {
      findElement("#couponMsg").textContent = "BLACK20 applied — 20% off!";
    } else {
      findElement("#couponMsg").textContent = "BLACK20 needs minimum 1000৳ subtotal.";
    }
  } else {
    findElement("#couponMsg").textContent = "Invalid coupon. Try BLACK20.";
  }
  openCart();
}

// ----- START CART PART -----
// Connect the cart buttons on the page to their actions.
export function initCart() {
  findElement("#cartBtn").onclick = openCart;
  findElement("#closeCartBtn").onclick = () => {
    findElement("#cartDrawer").style.display = "none";
  };
  findElement("#applyCouponBtn").onclick = applyCoupon;
  findElement("#checkoutBtn").onclick = () => {
    if (onCheckout) {
      onCheckout();
    }
  };
}
