// js/profile.js — the "My Profile" page + dark mode.
// Parts in this file:
//   1) Profile page (name, phone, address, photo)
//   2) Photo picker (from the gallery)
//   3) My Orders + track an order by its SN- number
//   4) Logout (kept apart from delete)
//   5) Delete Account (type DELETE to confirm)
//   6) Dark mode (the switch + the saved choice)

import { getFirebase, FIREBASE_CONFIGURED } from "./firebase.js";
import { session, openAuth, updateHeaderUserLabel } from "./auth.js";

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

// The photo the user just picked (from the gallery or a link),
// not saved yet. It becomes the profile photo when they press
// "Save Changes".
let pendingPhotoData = "";

// The order steps, in order. "Pending" is shown as "Placed"
// because that is easier to understand.
const ORDER_STEPS = ["Pending", "Processing", "Shipped", "Delivered"];

function stepLabel(status) {
  return status === "Pending" ? "Placed" : status;
}

// Read the orders saved in this browser (used when Firebase
// is not set up yet).
function localOrders() {
  return JSON.parse(localStorage.getItem("shopnest_orders") || "[]");
}

// Turn an order's date into readable text. Firestore dates and
// plain text dates are both handled.
function orderDate(order) {
  const date = order.createdAt;
  if (date && date.toDate) {
    return date.toDate().toLocaleString();
  }
  return date || "";
}

// Build the HTML for one order card.
function orderCardHtml(order) {
  const items = (order.items || []).map((item) => `${escapeHtml(item.name)} × ${item.qty}`).join("<br/>");
  const status = order.status || "Pending";
  return `<div class="order-card">
    <p><b>${escapeHtml(order.orderNumber)}</b> — ${orderDate(order)}</p>
    <p>${items}</p>
    <p>Total: <b>${formatPrice(order.total || 0)}</b> • Payment: ${escapeHtml(order.payment || "")}</p>
    <p>Status: <span class="pill ${escapeHtml(status.toLowerCase())}">${escapeHtml(status)}</span></p>
    <p class="meta">${escapeHtml(order.address || "")}, ${escapeHtml(order.district || "")} • ${escapeHtml(order.phone || "")}</p>
  </div>`;
}

// Build the status timeline: Placed → Processing → Shipped → Delivered.
// The steps already passed are filled in.
function timelineHtml(status) {
  if (status === "Cancelled") {
    return `<p class="error">This order was cancelled.</p>`;
  }
  const currentStep = Math.max(0, ORDER_STEPS.indexOf(status));
  const steps = ORDER_STEPS.map((step, index) => {
    const done = index <= currentStep ? " done" : "";
    return `<span class="step${done}">${stepLabel(step)}</span>`;
  }).join("<span class=\"arrow\">→</span>");
  return `<div class="timeline">${steps}</div>`;
}

// Load the profile details (phone, address, photo) saved in
// Firestore for the logged-in user. Returns null if there is
// no saved profile or Firebase cannot be reached.
async function loadProfileDocument() {
  const user = session.user;
  if (!user || !FIREBASE_CONFIGURED) {
    return null;
  }
  const firebase = await getFirebase();
  if (!firebase) {
    return null;
  }
  try {
    const snapshot = await firebase.getDoc(firebase.doc(firebase.db, "users", user.uid));
    return snapshot.exists() ? snapshot.data() : null;
  } catch (error) {
    return null;
  }
}

// Build the full profile page. If nobody is logged in, open
// the login box instead.
// ----- PROFILE PAGE PART -----
export function renderProfile() {
  if (!session.user) {
    appArea.innerHTML = "<h2>My Profile</h2><p>Please login first to see your profile.</p>";
    openAuth("login");
    return;
  }
  const user = session.user;
  const photoUrl = user.photoURL || "";
  const firstLetter = (user.displayName || user.email || "?").trim().charAt(0).toUpperCase();
  const darkModeOn = document.body.classList.contains("dark");

  const profileName = user.displayName || user.email;
  appArea.innerHTML = `<div class="page-banner"><img src="https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=1200&q=80&auto=format&fit=crop" alt="My profile" width="1200" height="340" loading="lazy" decoding="async" /><div class="pb-text"><h2>Welcome back, ${escapeHtml(profileName)}!</h2><p>Your orders, style and account — all in one place.</p></div></div>
    <div class="profile-head">
      <img id="profileAvatar" class="avatar" src="${escapeHtml(photoUrl)}" alt="Profile photo" style="${photoUrl ? "" : "display:none"}" onerror="this.style.display='none';document.getElementById('avatarFallback').style.display='flex'" />
      <span id="avatarFallback" class="avatar-fallback" style="${photoUrl ? "display:none" : "display:flex"}">${escapeHtml(firstLetter)}</span>
      <div><h3>${escapeHtml(user.displayName || user.email)}</h3><p class="meta">${escapeHtml(user.email)}</p></div>
    </div>

    <section class="profile-card">
      <h3>Profile Information</h3>
      <p class="meta">Update your name, phone, address and profile photo.</p>
      <label>Full name<input id="pfName" /></label>
      <label>Phone<input id="pfPhone" placeholder="01XXXXXXXXX" /></label>
      <label>Address<input id="pfAddress" placeholder="House, road, area" /></label>
      <label>Profile photo</label>
      <div class="photo-picker">
        <img id="pfPreview" class="photo-preview" style="display:none" alt="Photo preview" />
        <div>
          <label class="photo-pick-btn" for="pfPhotoFile">📷 Change photo — from gallery</label>
          <input id="pfPhotoFile" type="file" accept="image/*" style="display:none" />
          <p class="photo-hint">Tap to pick a photo from your gallery, or paste a link below.</p>
        </div>
      </div>
      <label>... or paste a photo link<input id="pfPhoto" placeholder="https://.../your-photo.jpg" /></label>
      <p><button id="pfSave">Save Changes</button></p>
      <p id="pfMsg"></p>
    </section>

    <section class="profile-card">
      <h3>Appearance</h3>
      <label class="switch-row">Dark mode
        <button id="darkToggleProfile" class="secondary">${darkModeOn ? "Dark: On" : "Dark: Off"}</button>
      </label>
    </section>

    <section class="profile-card">
      <h3>My Orders</h3>
      <div id="profileOrders"><p>Loading orders...</p></div>
    </section>

    <section class="profile-card">
      <h3>Track Order</h3>
      <p class="meta">Enter your SN- number to see where your order is.</p>
      <input id="pfTrackInput" placeholder="SN- number" />
      <button id="pfTrackBtn">Track Order</button>
      <div id="pfTrackResult"></div>
    </section>

    <section class="profile-card">
      <h3>Logout</h3>
      <p class="meta">Sign out of your ShopNest account on this device.</p>
      <button id="pfLogout" class="secondary">Logout</button>
    </section>

    <section class="profile-card danger">
      <h3>Delete Account</h3>
      <p class="meta">This permanently deletes your account and profile. Your orders stay with the store for records. This cannot be undone.</p>
      <p>Type <b>DELETE</b> below to confirm, then press the button.</p>
      <input id="pfDeleteConfirm" placeholder="Type DELETE" />
      <p><button id="pfDelete" class="danger-btn">Delete My Account</button></p>
      <p id="pfDeleteMsg"></p>
    </section>`;

  fillProfileForm(user);
  wireProfileButtons();
  loadProfileOrders();
}


// ----- PHOTO PART -----
// Shrink a photo file so it stays small: at most 128 pixels on
// its longest side, saved as a JPEG data URL. A 128px photo is
// only a few KB and is plenty for a round profile photo.
// NOTE: Firebase Auth does NOT accept a data URL as the photo —
// it is too long and fails with "Photo URL too long"
// (auth/invalid-profile-attribute). So a gallery photo is
// saved ONLY in Firestore (users/{uid}.photoURL), never in Auth.
function resizePhotoFile(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const longestSide = Math.max(image.width, image.height);
      const scale = longestSide > 128 ? 128 / longestSide : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read that photo."));
    };
    image.src = objectUrl;
  });
}

// Show a photo (file or link) in the round preview and in the
// big avatar at the top of the profile page.
function showPhotoPreview(photoUrl) {
  const preview = findElement("#pfPreview");
  if (preview) {
    preview.src = photoUrl;
    preview.style.display = "block";
  }
  const avatar = findElement("#profileAvatar");
  if (avatar) {
    avatar.src = photoUrl;
    avatar.style.display = "block";
    findElement("#avatarFallback").style.display = "none";
  }
}

// ----- FILL THE FORM PART -----
// Fill the profile form with what we already know, and show a
// live preview when the photo URL changes.
function fillProfileForm(user) {
  pendingPhotoData = "";
  const photoUrl = user.photoURL || "";
  findElement("#pfName").value = user.displayName || "";
  findElement("#pfPhoto").value = photoUrl;
  if (photoUrl) {
    const preview = findElement("#pfPreview");
    preview.src = photoUrl;
    preview.style.display = "block";
  }
  // Picking a photo from the gallery: the phone opens its
  // gallery / file picker (accept="image/*"). The photo is
  // shrunk to 256px and previewed in a circle right away.
  const fileInput = findElement("#pfPhotoFile");
  if (fileInput) {
    fileInput.onchange = async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) {
        return;
      }
      try {
        pendingPhotoData = await resizePhotoFile(file);
        findElement("#pfPhoto").value = "";
        showPhotoPreview(pendingPhotoData);
      } catch (error) {
        alert("Could not read that photo — please try another one.");
      }
    };
  }
  // Pasting a photo link instead: preview it straight away too.
  findElement("#pfPhoto").oninput = () => {
    const newUrl = findElement("#pfPhoto").value.trim();
    if (newUrl) {
      pendingPhotoData = newUrl;
      showPhotoPreview(newUrl);
    } else {
      pendingPhotoData = "";
      findElement("#pfPreview").style.display = "none";
    }
  };
  // Fill in phone and address from the saved profile, if any.
  loadProfileDocument().then((savedProfile) => {
    if (!savedProfile) {
      return;
    }
    if (savedProfile.name && !findElement("#pfName").value) {
      findElement("#pfName").value = savedProfile.name;
    }
    if (savedProfile.phone) {
      findElement("#pfPhone").value = savedProfile.phone;
    }
    if (savedProfile.address) {
      findElement("#pfAddress").value = savedProfile.address;
    }
    if (savedProfile.photoURL && !findElement("#pfPhoto").value) {
      findElement("#pfPhoto").value = savedProfile.photoURL;
      pendingPhotoData = savedProfile.photoURL;
      showPhotoPreview(savedProfile.photoURL);
    }
  });
}

// Connect the profile page buttons to their actions.
function wireProfileButtons() {
  findElement("#pfSave").onclick = saveProfile;
  findElement("#darkToggleProfile").onclick = () => {
    toggleDark();
    renderProfile();
  };
  findElement("#pfLogout").onclick = doLogout;
  findElement("#pfDelete").onclick = deleteAccount;
  findElement("#pfTrackBtn").onclick = trackProfileOrder;
}

// Save the profile form: update the login account (name and
// photo) and the profile in Firestore.
// ----- SAVE PROFILE PART -----
async function saveProfile() {
  const user = session.user;
  const messageBox = findElement("#pfMsg");
  const name = findElement("#pfName").value.trim();
  const phone = findElement("#pfPhone").value.trim();
  const address = findElement("#pfAddress").value.trim();
  // The photo to save: a picked gallery photo first, then a
  // pasted link, then the photo already on the account.
  const photoUrl = pendingPhotoData || findElement("#pfPhoto").value.trim() || user.photoURL || "";
  if (!name) {
    messageBox.textContent = "Please enter your name.";
    return;
  }
  messageBox.textContent = "Saving...";
  const firebase = await getFirebase();
  try {
    if (firebase && user) {
      // Firebase Auth only accepts a SHORT web link as a photo.
      // A gallery photo is a long data URL, so it must NOT go
      // into Auth (that was the "Photo URL too long" error).
      // Auth gets the name, and the photo link only if it is a
      // short https link. The full photo always goes to
      // Firestore below, where long text is fine.
      const shortWebLink = photoUrl.startsWith("http") && photoUrl.length < 1000 ? photoUrl : null;
      try {
        await firebase.updateProfile(firebase.auth.currentUser, {
          displayName: name,
          photoURL: shortWebLink,
        });
      } catch (authError) {
        // The name/photo in Auth is not essential — the profile
        // in Firestore is what the site shows. Keep going.
      }
      await firebase.setDoc(firebase.doc(firebase.db, "users", user.uid), {
        name,
        email: user.email,
        phone,
        address,
        photoURL: photoUrl,
        role: user.email.toLowerCase() === "mohendhroghoshrohit@gmail.com" ? "admin" : "customer",
        updatedAt: firebase.serverTimestamp(),
      }, { merge: true });
    }
    // Update the "Hi, name" chip in the header without a reload.
    updateHeaderUserLabel(name, photoUrl);
    // The sidebar and header both show the photo: tell them the
    // user (and their photo) just changed. The admin sees the
    // same update, because the admin uses this same profile page.
    if (session.user) {
      session.user.photoURL = photoUrl || null;
    }
    window.dispatchEvent(new Event("shopnest-user-changed"));
    messageBox.textContent = "Profile saved.";
  } catch (error) {
    messageBox.textContent = "Photo save hoy ni — abar try koro. (" + error.message + ")";
  }
}

// ----- MY ORDERS PART -----
// Load "My Orders" on the profile page, newest first.
// If Firebase cannot be reached, show the orders saved in
// this browser instead.
async function loadProfileOrders() {
  const ordersBox = findElement("#profileOrders");
  if (!ordersBox || !session.user) {
    return;
  }
  const myLocalOrders = localOrders().filter((order) => order.userId === session.user.uid);
  const emptyStateHtml = `<div class="empty"><img src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80&auto=format&fit=crop" alt="No orders yet" width="800" height="360" loading="lazy" decoding="async" /><p>No orders yet — your first order will show up here.</p></div>`;
  if (!FIREBASE_CONFIGURED) {
    ordersBox.innerHTML = myLocalOrders.length
      ? myLocalOrders.map(orderCardHtml).join("")
      : "<p>No orders yet (saved locally — Firebase not configured).</p>";
    return;
  }
  const firebase = await getFirebase();
  if (!firebase) {
    ordersBox.innerHTML = myLocalOrders.length
      ? myLocalOrders.map(orderCardHtml).join("")
      : "<p>Firebase could not be reached — showing local orders only.</p>";
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
    const orders = snapshot.docs.map((doc) => doc.data());
    ordersBox.innerHTML = orders.length ? orders.map(orderCardHtml).join("") : emptyStateHtml;
  } catch (error) {
    if (myLocalOrders.length) {
      ordersBox.innerHTML = myLocalOrders.map(orderCardHtml).join("") +
        "<p class=\"meta\">Could not load online orders: " + escapeHtml(error.message) + "</p>";
    } else {
      ordersBox.innerHTML = "<p>Could not load orders: " + escapeHtml(error.message) + "</p>";
    }
  }
}

// ----- TRACK ORDER PART -----
// Track one order from the profile page by its SN- number.
// Only the owner of the order (or the admin) can see it.
async function trackProfileOrder() {
  const orderNumber = findElement("#pfTrackInput").value.trim();
  const outputBox = findElement("#pfTrackResult");
  if (!orderNumber) {
    outputBox.textContent = "Enter an SN- number.";
    return;
  }
  const showLocalOrder = () => {
    const order = localOrders().find((item) => item.orderNumber === orderNumber && item.userId === session.user.uid);
    outputBox.innerHTML = order
      ? orderCardHtml(order) + timelineHtml(order.status)
      : "<p>Order not found.</p>";
  };
  if (!FIREBASE_CONFIGURED) {
    showLocalOrder();
    return;
  }
  const firebase = await getFirebase();
  if (!firebase) {
    showLocalOrder();
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
    if (order.userId !== session.user.uid && !session.isAdmin) {
      outputBox.textContent = "This order does not belong to your account.";
      return;
    }
    outputBox.innerHTML = orderCardHtml(order) + timelineHtml(order.status);
  } catch (error) {
    outputBox.textContent = "Could not track order: " + error.message;
  }
}

// ----- LOGOUT PART -----
// Log out and go back to the home page.
export async function doLogout() {
  const firebase = await getFirebase();
  if (firebase) {
    await firebase.signOut(firebase.auth).catch(() => {});
  }
  location.hash = "#/";
  location.reload();
}

// ----- DELETE ACCOUNT PART -----
// Delete the account for good. The visitor must type DELETE
// first, and then confirm once more in the browser dialog.
async function deleteAccount() {
  const messageBox = findElement("#pfDeleteMsg");
  if (findElement("#pfDeleteConfirm").value.trim() !== "DELETE") {
    messageBox.textContent = "Type DELETE exactly to confirm.";
    return;
  }
  const user = session.user;
  if (!user) {
    return;
  }
  if (!confirm("Are you sure? Your account will be permanently deleted.")) {
    return;
  }
  messageBox.textContent = "Deleting...";
  const firebase = await getFirebase();
  try {
    if (firebase) {
      // Delete the profile first. If that fails, keep going:
      // deleting the login account is the important part.
      try {
        await firebase.deleteDoc(firebase.doc(firebase.db, "users", user.uid));
      } catch (error) {
        // Ignore it and continue with the account delete.
      }
      await firebase.deleteUser(firebase.auth.currentUser);
    }
    location.hash = "#/";
    location.reload();
  } catch (error) {
    if (error.code === "auth/requires-recent-login") {
      messageBox.textContent = "For safety, please log out and log back in, then try deleting again.";
    } else {
      messageBox.textContent = "Could not delete account: " + error.message;
    }
  }
}

// ----- DARK MODE PART -----
// --- Dark mode ---
// The choice is saved in the browser as "shopnest_dark":
// "1" means dark mode on, "0" means off.

// Turn dark mode on or off, and update the header button text.
export function applyDark(savedValue) {
  const darkOn = savedValue === "1";
  document.body.classList.toggle("dark", darkOn);
  const darkButton = findElement("#darkToggle");
  if (darkButton) {
    darkButton.textContent = darkOn ? "☀️ Light Mode" : "🌙 Dark Mode";
  }
}

// Switch dark mode to the opposite of what it is now, and save it.
export function toggleDark() {
  const darkOn = !document.body.classList.contains("dark");
  localStorage.setItem("shopnest_dark", darkOn ? "1" : "0");
  applyDark(darkOn ? "1" : "0");
}

// Set up dark mode when the shop starts: read the saved
// choice, apply it, and connect the header button.
export function initDark() {
  applyDark(localStorage.getItem("shopnest_dark") || "0");
  const darkButton = findElement("#darkToggle");
  if (darkButton) {
    darkButton.onclick = toggleDark;
  }
}
