// js/checkout.js — buying: checkout box + placing the order.
// Parts in this file:
//   1) Checkout box (price summary: subtotal - discount + delivery)
//   2) Place the order (saves it, gives it an SN- number)
//   3) My Orders + track one order by its SN- number
// Delivery: 80৳ inside Dhaka, 120৳ outside. Coupon BLACK20 = 20% off.

import { getFirebase, FIREBASE_CONFIGURED } from "./firebase.js";
import { session, requireLogin } from "./auth.js";
import { cart, cartDetailed, subtotal, discountFor, clearCart } from "./cart.js";

// Find one thing on the page, like "#loginBtn".
function findElement(selector) {
  return document.querySelector(selector);
}

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

// Delivery charge: Dhaka 80৳, baire 120৳ — video theke neoa rate, change korle ekhanei koro.
function deliveryFor(zone) {
  return zone === "dhaka" ? 80 : 120;
}

// Read the orders saved in this browser (used when Firebase
// is not set up yet).
function localOrders() {
  return JSON.parse(localStorage.getItem("shopnest_orders") || "[]");
}

// Save one order in this browser.
function saveLocalOrder(order) {
  const orders = localOrders();
  orders.push(order);
  localStorage.setItem("shopnest_orders", JSON.stringify(orders));
}

// Open the checkout box. You must be logged in, and the cart
// must not be empty.
// ----- CHECKOUT BOX PART -----
export function openCheckout() {
  if (!requireLogin()) {
    return;
  }
  if (!cart.length) {
    alert("Cart is empty.");
    return;
  }
  findElement("#cartDrawer").style.display = "none";
  updateCheckoutSummary();
  findElement("#checkoutModal").style.display = "flex";
}

// Update the price summary in the checkout box whenever the
// delivery zone changes.
export function updateCheckoutSummary() {
  const subtotalAmount = subtotal();
  const discount = discountFor(subtotalAmount);
  const zone = document.querySelector("#checkoutForm select[name=zone]")?.value || "dhaka";
  const delivery = deliveryFor(zone);
  findElement("#checkoutSummary").innerHTML = `<p>Subtotal: ${formatPrice(subtotalAmount)}<br/>Discount: −${formatPrice(discount)}<br/>Delivery: ${formatPrice(delivery)}<br/><b>Total: ${formatPrice(subtotalAmount - discount + delivery)}</b></p>`;
}

// Show one order line (number, status, total) in HTML.
function orderLineHtml(order) {
  return `<p>${escapeHtml(order.orderNumber)} — ${escapeHtml(order.status)} — ${formatPrice(order.total)}</p>`;
}

// Find one order in the browser by its SN- number and show it.
function trackLocalOrder(orderNumber, outputBox) {
  const order = localOrders().find((item) => item.orderNumber === orderNumber);
  if (order) {
    outputBox.innerHTML = `<p>Order ${escapeHtml(order.orderNumber)} — Status: <b>${escapeHtml(order.status)}</b> • Total: ${formatPrice(order.total)}</p>`;
  } else {
    outputBox.innerHTML = "<p>Order not found (local orders only — Firebase not configured).</p>";
  }
}

// Track one order by its SN- number. The visitor types the
// number and presses Track. Only the owner of the order (or the
// admin) sees the total; everyone else sees only the status.
// ----- TRACK ORDER PART -----
export async function trackOrder() {
  const orderNumber = findElement("#trackInput").value.trim();
  const outputBox = findElement("#trackResult");
  if (!orderNumber) {
    outputBox.textContent = "Enter an SN- number.";
    return;
  }
  if (!FIREBASE_CONFIGURED) {
    trackLocalOrder(orderNumber, outputBox);
    return;
  }
  const firebase = await getFirebase();
  if (!firebase) {
    outputBox.textContent = "Firebase could not be reached — check your internet connection, then try again.";
    return;
  }
  try {
    const snapshot = await firebase.getDocs(
      firebase.query(firebase.collection(firebase.db, "orders"), firebase.where("orderNumber", "==", orderNumber))
    );
    if (snapshot.empty) {
      outputBox.textContent = "Order not found.";
      return;
    }
    const order = snapshot.docs[0].data();
    const isMine = session.user && (order.userId === session.user.uid || session.isAdmin);
    const totalText = isMine ? ` • Total: ${formatPrice(order.total)}` : "";
    outputBox.innerHTML = `<p>Order ${escapeHtml(order.orderNumber)} — Status: <b>${escapeHtml(order.status)}</b>${totalText}</p>`;
  } catch (error) {
    outputBox.textContent = "Could not track order: " + error.message;
  }
}

// Load "My Orders" for the logged-in user, newest first.
// ----- MY ORDERS PART -----
export async function loadMyOrders() {
  const box = findElement("#myOrders");
  if (!box || !session.user) {
    return;
  }
  if (!FIREBASE_CONFIGURED) {
    const myOrders = localOrders().filter((order) => order.userId === session.user.uid);
    if (myOrders.length) {
      box.innerHTML = myOrders.map(orderLineHtml).join("");
    } else {
      box.innerHTML = "<p>No orders yet (saved locally — Firebase not configured).</p>";
    }
    return;
  }
  const firebase = await getFirebase();
  if (!firebase) {
    box.textContent = "Firebase could not be reached — check your internet connection.";
    return;
  }
  try {
    const snapshot = await firebase.getDocs(
      firebase.query(
        firebase.collection(firebase.db, "orders"),
        firebase.where("userId", "==", session.user.uid),
        firebase.orderBy("createdAt", "desc")
      )
    );
    if (snapshot.empty) {
      box.innerHTML = "<p>No orders yet.</p>";
      return;
    }
    box.innerHTML = snapshot.docs.map((doc) => {
      const order = doc.data();
      return `<p>${escapeHtml(order.orderNumber)} — ${escapeHtml(order.status)} — ${formatPrice(order.total)} — ${escapeHtml(order.payment || "")}</p>`;
    }).join("");
  } catch (error) {
    box.textContent = "Could not load orders: " + error.message;
  }
}

// ----- PLACE ORDER PART -----
// Build an order object from the checkout form and the cart.
// The order number is "SN-" plus the time, so it is unique.
function buildOrderFromForm(formData) {
  const subtotalAmount = subtotal();
  const discount = discountFor(subtotalAmount);
  const zone = formData.get("zone");
  const delivery = deliveryFor(zone);
  const orderNumber = "SN-" + Date.now().toString().slice(-10);
  return {
    orderNumber,
    userId: session.user.uid,
    customerEmail: session.user.email,
    name: formData.get("name"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    district: formData.get("district"),
    zone,
    deliveryCharge: delivery,
    payment: formData.get("payment"),
    items: cartDetailed().map((product) => ({
      id: product.id,
      name: product.name,
      variant: product.variant,
      qty: product.qty,
      price: product.price,
    })),
    subtotal: subtotalAmount,
    discount,
    total: subtotalAmount - discount + delivery,
    status: "Pending",
    createdAt: new Date().toISOString(),
  };
}

// Save the order: online to Firestore if Firebase is ready,
// otherwise in this browser so nothing is lost.
async function saveOrder(order) {
  const firebase = await getFirebase();
  if (firebase) {
    await firebase.addDoc(firebase.collection(firebase.db, "orders"), {
      ...order,
      createdAt: firebase.serverTimestamp(),
    });
    return "Order placed! Your order number is <b>" + order.orderNumber + "</b>. Saved to Firestore. <a href=\"#/orders\">Track your order →</a>";
  }
  saveLocalOrder(order);
  return "Order placed! Your order number is <b>" + order.orderNumber + "</b>. Saved locally on this device — configure Firebase (README step 4) to save orders online. <a href=\"#/orders\">Track your order →</a>";
}

// Handle the checkout form being submitted ("Place Order").
async function handlePlaceOrder(event) {
  event.preventDefault();
  if (!requireLogin()) {
    return;
  }
  const formData = new FormData(event.target);
  const order = buildOrderFromForm(formData);
  findElement("#checkoutMsg").textContent = "Placing order...";
  try {
    findElement("#checkoutMsg").innerHTML = await saveOrder(order);
    clearCart();
    event.target.reset();
  } catch (error) {
    findElement("#checkoutMsg").textContent = "Order failed: " + error.message;
  }
}

// Connect the checkout box to its actions.
// ----- START CHECKOUT PART -----
export function initCheckout() {
  document.querySelector("#checkoutForm select[name=zone]").addEventListener("change", updateCheckoutSummary);
  findElement("#checkoutClose").onclick = () => {
    findElement("#checkoutModal").style.display = "none";
  };
  findElement("#checkoutForm").addEventListener("submit", handlePlaceOrder);
}
