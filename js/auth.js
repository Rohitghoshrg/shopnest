// js/auth.js — login and sign up.
// Parts in this file:
//   1) Login box (open it, close it)
//   2) Log in + sign up
//   3) Who is logged in, and who is the admin
//   4) Welcome page, User Login page, Admin Login page
//   5) Header buttons after login (Hi, Name / Logout / Admin)

import { getFirebase, FIREBASE_CONFIGURED, ADMIN_EMAIL } from "./firebase.js";

// The session is the shop's memory of the current visitor.
// user = the logged-in person (or null if nobody is logged in).
// isAdmin = true only when the owner is logged in.
// ----- SESSION PART -----
export const session = { user: null, isAdmin: false };

// Which mode is the login box in right now: "login" or "signup".
let authMode = "login";

// Has Firebase told us yet who is signed in? The shop waits for
// this before showing the login-first page, so a logged-in
// person is never flashed the login page by mistake.
let authReady = false;
export function isAuthReady() {
  return authReady;
}

// Is this visit in "browse as guest" mode? Guests can look
// around, but buying still needs a login (see requireLogin).
// ----- GUEST MODE PART -----
export function isGuestMode() {
  return localStorage.getItem("shopnest_guest") === "1";
}

// Start guest browsing: remember it, then show the home page.
export function startGuestBrowsing(onChange) {
  localStorage.setItem("shopnest_guest", "1");
  location.hash = "#/";
  onChange();
}

// ----- HEADER NAME CHIP PART -----
// First and last letter initials, e.g. "Rohit Ghosh" -> "RG".
function initialsOf(name, email) {
  const source = (name || email || "?").trim();
  const words = source.split(/\s+/);
  if (words.length > 1) {
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

// The header chip for a logged-in user: avatar + "Hi, Name".
// "photoUrl" is the profile photo, if the user set one.
export function headerUserChipHtml(name, email, photoUrl) {
  const displayName = name || email || "";
  const shortName = displayName.includes("@")
    ? displayName.split("@")[0]
    : displayName.split(" ")[0];
  // The initial letter sits underneath the photo. If the photo
  // fails to load it hides itself and the initial shows instead.
  const avatar = photoUrl
    ? `<span class="user-avatar-stack"><span class="user-avatar-initial">${initialsOf(displayName, email)}</span><img class="user-avatar-sm" src="${photoUrl}" alt="" onerror="this.style.display='none'" /></span>`
    : `<span class="user-avatar-initial">${initialsOf(displayName, email)}</span>`;
  return `<span class="user-chip">${avatar}Hi, ${shortName}</span>`;
}

// Update just the header chip (used after saving the profile).
export function updateHeaderUserLabel(name, photoUrl) {
  const label = findElement("#userLabel");
  if (!label || !session.user) {
    return;
  }
  label.innerHTML = headerUserChipHtml(name, session.user.email, photoUrl);
}

// The function that redraws the page (passed in by initAuth).
// We keep it here so the submit handler can call it too.
let redrawPage = () => {};

// Find one thing on the page, like "#loginBtn".
function findElement(selector) {
  return document.querySelector(selector);
}

// Show the login box in login mode or sign-up mode.
// "message" is the small text shown under the title.
// ----- LOGIN BOX PART -----
export function openAuth(mode, message) {
  authMode = mode;
  findElement("#authTitle").textContent = mode === "login" ? "Login" : "Sign Up";
  findElement("#authMsg").textContent = message || (mode === "login" ? "Login to your ShopNest account" : "Create a ShopNest account");
  // The name box only matters when signing up, so hide it for login.
  findElement("#authName").style.display = mode === "signup" ? "block" : "none";
  findElement("#authSubmit").textContent = mode === "login" ? "Login" : "Sign Up";
  findElement("#authToggle").textContent = mode === "login" ? "No account? Sign up" : "Have an account? Login";
  findElement("#authError").textContent = "";
  findElement("#authModal").style.display = "flex";
}

// Hide the login box.
export function closeAuth() {
  findElement("#authModal").style.display = "none";
}

// Ask: "is someone logged in?"
// If yes, return true and the caller can continue.
// If no, open the login box and return false, so buying stops.
export function requireLogin() {
  if (session.user) {
    return true;
  }
  openAuth("login", "Please login to buy — kinte hole login koro");
  return false;
}

// ----- AFTER LOGIN PART -----
// Load the photo saved in Firestore (users/{uid}.photoURL)
// and show it in the header. This is needed because a gallery
// photo is a long data URL: Firebase Auth cannot store it, so
// it lives only in Firestore. Without this, the photo would
// disappear from the header/sidebar after a reload.
async function loadSavedPhoto(loggedInUser) {
  try {
    const firebase = await getFirebase();
    if (!firebase) {
      return;
    }
    const snapshot = await firebase.getDoc(firebase.doc(firebase.db, "users", loggedInUser.uid));
    if (snapshot.exists() && snapshot.data().photoURL && snapshot.data().photoURL !== loggedInUser.photoURL) {
      loggedInUser.photoURL = snapshot.data().photoURL;
      findElement("#userLabel").innerHTML = headerUserChipHtml(loggedInUser.displayName, loggedInUser.email, loggedInUser.photoURL);
    }
  } catch (error) {
    // Photo is not essential — ignore and keep the header as is.
  }
}

// Update the whole page after someone logs in or out.
// It saves the user in the session, works out if they are the
// admin, and shows or hides the header buttons.
function applyUser(loggedInUser, onChange) {
  session.user = loggedInUser;
  // Only the owner email is the admin. The same check is also
  // enforced by firestore.rules on the server, so a normal
  // customer can never fake their way into Admin.
  session.isAdmin = !!loggedInUser && loggedInUser.email && loggedInUser.email.toLowerCase() === ADMIN_EMAIL;
  findElement("#userLabel").innerHTML = loggedInUser
    ? headerUserChipHtml(loggedInUser.displayName, loggedInUser.email, loggedInUser.photoURL)
    : "";
  if (loggedInUser) {
    loadSavedPhoto(loggedInUser);
  }
  findElement("#loginBtn").style.display = loggedInUser ? "none" : "inline-block";
  findElement("#logoutBtn").style.display = loggedInUser ? "inline-block" : "none";
  findElement("#profileBtn").style.display = loggedInUser ? "inline" : "none";
  findElement("#adminLink").style.display = session.isAdmin ? "inline" : "none";
  onChange();
}

// Refresh the header buttons and the "Hi, Name" chip right
// after a login on a login page. Without this, the header kept
// showing "Login / Sign Up" (and no Admin link) until Firebase's
// own login watcher fired a moment later — the page said you
// were in, but the header said you were not.
export function refreshHeaderAfterLogin() {
  const user = session.user;
  findElement("#userLabel").innerHTML = user
    ? headerUserChipHtml(user.displayName, user.email, user.photoURL)
    : "";
  findElement("#loginBtn").style.display = user ? "none" : "inline-block";
  findElement("#logoutBtn").style.display = user ? "inline-block" : "none";
  findElement("#profileBtn").style.display = user ? "inline" : "none";
  findElement("#adminLink").style.display = session.isAdmin ? "inline" : "none";
  if (user) {
    loadSavedPhoto(user);
  }
}

// ----- LOG IN + SIGN UP PART -----
// Read what the visitor typed into the login box.
function readAuthForm() {
  return {
    email: findElement("#authEmail").value.trim(),
    password: findElement("#authPassword").value,
    name: findElement("#authName").value.trim(),
  };
}

// Show a short error message under the login box.
function showAuthError(message) {
  findElement("#authError").textContent = message;
}

// Save a new user's profile in the database.
// This must NEVER break sign up: if saving the profile fails
// (for example the Firestore rules are not published yet), the
// account is still created and the person can still log in.
async function saveNewUserProfile(firebase, newAccount, name, email) {
  try {
    await firebase.updateProfile(newAccount.user, { displayName: name });
  } catch (error) {
    // The display name is nice to have, not essential. Ignore it.
  }
  try {
    await firebase.setDoc(firebase.doc(firebase.db, "users", newAccount.user.uid), {
      name,
      email,
      role: email.toLowerCase() === ADMIN_EMAIL ? "admin" : "customer",
      createdAt: firebase.serverTimestamp(),
    });
  } catch (error) {
    // Same idea: a failed profile save must not fail the sign up.
  }
}

// Log an existing user in with their email and password.
async function doLogin(firebase, email, password) {
  await firebase.signInWithEmailAndPassword(firebase.auth, email, password);
}

// Create a brand-new account, then save the profile for it.
async function doSignUp(firebase, email, password, name) {
  if (!name) {
    showAuthError("Please enter your name.");
    return false;
  }
  const newAccount = await firebase.createUserWithEmailAndPassword(firebase.auth, email, password);
  await saveNewUserProfile(firebase, newAccount, name, email);
  return true;
}

// Turn a Firebase error code into a short, friendly message.
// If the email is already registered, switch the box to login
// mode, because the person probably needs to log in instead.
function friendlyAuthErrorMessage(error) {
  const code = (error && error.code) || "";
  if (code === "auth/email-already-in-use") {
    showAuthError("Ei email diye account already ache — 'Have an account? Login' e click kore login koro.");
    authMode = "login";
    findElement("#authTitle").textContent = "Login";
    findElement("#authSubmit").textContent = "Login";
    findElement("#authToggle").textContent = "No account? Sign up";
    return;
  }
  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
    showAuthError("Email ba password vul — thik kore abar try koro.");
    return;
  }
  if (code === "auth/weak-password") {
    showAuthError("Password kompokkhe 6 character hote hobe.");
    return;
  }
  if (code === "auth/invalid-email") {
    showAuthError("Email ta thik moto lekho.");
    return;
  }
  if (code === "auth/network-request-failed") {
    showAuthError("Internet connection check koro, tarpor abar try koro.");
    return;
  }
  showAuthError(error.message);
}

// Handle the Login / Sign Up button being pressed.
async function handleAuthSubmit() {
  const submitButton = findElement("#authSubmit");
  // If a login is already running, ignore extra clicks. This
  // stops double-clicks from creating duplicate accounts.
  if (submitButton.disabled) {
    return;
  }
  const form = readAuthForm();
  showAuthError("");
  if (!FIREBASE_CONFIGURED) {
    showAuthError("Firebase is not configured yet — paste your config into js/firebase.js first.");
    return;
  }
  const firebase = await getFirebase();
  if (!firebase) {
    showAuthError("Firebase could not be reached — check your internet connection, then try again.");
    return;
  }

  // Lock the button and show "Please wait..." while it works.
  submitButton.disabled = true;
  const oldButtonText = submitButton.textContent;
  submitButton.textContent = "Please wait...";
  try {
    if (authMode === "login") {
      await doLogin(firebase, form.email, form.password);
    } else {
      const signedUp = await doSignUp(firebase, form.email, form.password, form.name);
      if (!signedUp) {
        return;
      }
    }
    // Success: close the box and redraw the page. The login
    // watcher below will also update the header, but fix the
    // header right now so it never lags behind.
    closeAuth();
    refreshHeaderAfterLogin();
    redrawPage();
  } catch (error) {
    friendlyAuthErrorMessage(error);
  } finally {
    // Always unlock the button again, success or failure.
    submitButton.disabled = false;
    submitButton.textContent = oldButtonText;
  }
}

// ----- START LOGIN PART -----
// Connect all the login buttons on the page to their actions.
// "onChange" is a function that redraws the page; it runs
// whenever someone logs in or out.
export function initAuth(onChange) {
  // Remember the redraw function for the submit handler.
  redrawPage = onChange;
  findElement("#loginBtn").onclick = () => openAuth("login");

  // Log out: sign out of Firebase, clear the session, go home.
  findElement("#logoutBtn").onclick = async () => {
    const firebase = await getFirebase();
    if (firebase) {
      await firebase.signOut(firebase.auth).catch(() => {});
    }
    localStorage.removeItem("shopnest_guest");
    applyUser(null, onChange);
    location.hash = "#/";
  };

  findElement("#authClose").onclick = closeAuth;
  findElement("#authToggle").onclick = () => openAuth(authMode === "login" ? "signup" : "login");
  findElement("#authSubmit").onclick = handleAuthSubmit;

  // Watch for login changes in the background. If Firebase
  // fails to load, we still mark auth as checked (nobody is
  // logged in) so the welcome / login page can show.
  getFirebase().then((firebase) => {
    if (!firebase) {
      authReady = true;
      onChange();
      return;
    }
    firebase.onAuthStateChanged(firebase.auth, (user) => {
      authReady = true;
      applyUser(user, onChange);
    });
  });
  // Safety net: if Firebase is slow or blocked, do not leave
  // the visitor waiting forever — after 3 seconds, decide with
  // whoever is (not) logged in so far.
  setTimeout(() => {
    if (!authReady) {
      authReady = true;
      onChange();
    }
  }, 3000);
}

// ----- LOGIN PAGES PART -----
// The login-first pages: welcome, User Login, Admin Login.
// When the site opens and nobody is logged in, the visitor
// sees the welcome page first — not the shop. They choose
// User Login, Admin Login, or Browse as guest.

// Small decorative graphics for the logo card: a shopping bag,
// a cart and a sparkle. They float gently (see css/style.css).
const DECO_BAG = `<svg class="deco-float d1" width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 8h14l-1.2 11a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8z" fill="#f97316"/><path d="M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8" stroke="#f97316" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const DECO_CART = `<svg class="deco-float d2" width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 3h2l2.4 12.4A2 2 0 0 0 9.4 17h7.9a2 2 0 0 0 2-1.6L21 7H6" stroke="#14532d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="21" r="1.6" fill="#14532d"/><circle cx="18" cy="21" r="1.6" fill="#14532d"/></svg>`;
const DECO_STAR = `<svg class="deco-float d3" width="22" height="22" viewBox="0 0 24 24" fill="#ec4899" aria-hidden="true"><path d="M12 0l2.4 9.6L24 12l-9.6 2.4L12 24l-2.4-9.6L0 12l9.6-2.4z"/></svg>`;

// The full ShopNest logo inside its graphic card, with the
// floating decorations around it. Used on the welcome and
// login pages, where the logo has room to breathe.
function logoGraphicCardHtml() {
  return `<div class="logo-graphic-card">${DECO_BAG}${DECO_CART}${DECO_STAR}<img src="logo.png" alt="ShopNest — Shop Smart. Live Better." width="480" height="240" /></div>`;
}

// Make text safe to put into the page.
function escapePageHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[character]));
}

// Show a short error message on a login page (not the modal).
function showPageAuthError(message) {
  const box = findElement("#pageAuthError");
  if (box) {
    box.textContent = message;
  }
}

// --- The first page: welcome + two login choices ---
export function renderWelcomePage(onChange) {
  redrawPage = onChange;
  findElement("#app").innerHTML = `
  <div class="welcome-page">
    <div class="welcome-hero">
      <div class="welcome-left">
        ${logoGraphicCardHtml()}
        <h1>Welcome to ShopNest</h1>
        <p>Shop smart, live better — 450 products, 15 categories, cash on delivery across Bangladesh.</p>
        <button class="choice-btn" id="welcomeUserBtn">👤 User Login</button>
        <button class="choice-btn admin" id="welcomeAdminBtn">🛡️ Admin Login</button>
        <p class="guest-note">Just looking around? <button id="welcomeGuestBtn">Browse as guest</button></p>
        <p class="guest-note">Buying needs a login — guest browsing is view-only.</p>
      </div>
      <div class="welcome-right"><img src="https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1000&q=80&auto=format&fit=crop" alt="Shopping" width="1000" height="1200" fetchpriority="high" decoding="async" onerror="this.style.display='none'" /></div>
    </div>
  </div>`;
  findElement("#welcomeUserBtn").onclick = () => { location.hash = "#/login"; };
  findElement("#welcomeAdminBtn").onclick = () => { location.hash = "#/admin-login"; };
  findElement("#welcomeGuestBtn").onclick = () => startGuestBrowsing(onChange);
}

// Which mode the User Login page is in: "login" or "signup".
let pageAuthMode = "login";

// --- The User Login page (normal customers) ---
// ----- USER LOGIN PAGE PART -----
export function renderUserLoginPage(onChange) {
  redrawPage = onChange;
  pageAuthMode = "login";
  findElement("#app").innerHTML = `
  <div class="login-page">
    <div class="login-grid">
      <div class="login-form">
        <a class="login-back" href="#/">← Back</a>
        ${logoGraphicCardHtml()}
        <h1 id="pageAuthTitle">Welcome back!</h1>
        <p class="sub">Login to your ShopNest account to shop and track orders.</p>
        <label>Email<input id="pageAuthEmail" type="email" name="email" autocomplete="username" placeholder="you@example.com" /></label>
        <label>Password<input id="pageAuthPassword" type="password" name="password" autocomplete="current-password" placeholder="Password (min 6 characters)" /></label>
        <label id="pageAuthNameLabel" style="display:none">Your name<input id="pageAuthName" type="text" name="name" autocomplete="name" placeholder="Your name" /></label>
        <button class="full-btn" id="pageAuthSubmit">Login</button>
        <button class="link-btn" id="pageAuthToggle">No account? Sign up</button>
        <p id="pageAuthError" class="error"></p>
      </div>
      <div class="login-banner-wrap"><img class="login-banner-img" src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1000&q=80&auto=format&fit=crop" alt="ShopNest store" width="1000" height="1200" loading="lazy" decoding="async" onerror="this.style.display='none'" /></div>
    </div>
  </div>`;
  findElement("#pageAuthToggle").onclick = () => {
    pageAuthMode = pageAuthMode === "login" ? "signup" : "login";
    const signup = pageAuthMode === "signup";
    findElement("#pageAuthTitle").textContent = signup ? "Join ShopNest!" : "Welcome back!";
    findElement("#pageAuthNameLabel").style.display = signup ? "block" : "none";
    findElement("#pageAuthSubmit").textContent = signup ? "Create Account" : "Login";
    findElement("#pageAuthToggle").textContent = signup ? "Have an account? Login" : "No account? Sign up";
    showPageAuthError("");
  };
  findElement("#pageAuthSubmit").onclick = () => handlePageAuthSubmit("user", onChange);
}

// --- The Admin Login page (store owner only) ---
// ----- ADMIN LOGIN PAGE PART -----
export function renderAdminLoginPage(onChange) {
  redrawPage = onChange;
  findElement("#app").innerHTML = `
  <div class="login-page">
    <div class="login-grid">
      <div class="login-form">
        <a class="login-back" href="#/">← Back</a>
        ${logoGraphicCardHtml()}
        <span class="admin-badge">🛡️ Admin only</span>
        <h1>Admin Login</h1>
        <p class="sub">Only the store owner can log in here. Customers, please use User Login.</p>
        <label>Admin email<input id="pageAuthEmail" type="email" name="email" autocomplete="username" placeholder="Owner email" /></label>
        <label>Password<input id="pageAuthPassword" type="password" name="password" autocomplete="current-password" placeholder="Password" /></label>
        <button class="full-btn" id="pageAuthSubmit">Login as Admin</button>
        <p id="pageAuthError" class="error"></p>
      </div>
      <div class="login-banner-wrap"><img class="login-banner-img" src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1000&q=80&auto=format&fit=crop" alt="Admin dashboard" width="1000" height="1200" loading="lazy" decoding="async" onerror="this.style.display='none'" /></div>
    </div>
  </div>`;
  findElement("#pageAuthSubmit").onclick = () => handlePageAuthSubmit("admin", onChange);
}

// ----- LOGIN SUBMIT PART -----
// Handle the Login button on the User Login / Admin Login pages.
// "kind" is "user" or "admin".
async function handlePageAuthSubmit(kind, onChange) {
  const submitButton = findElement("#pageAuthSubmit");
  if (!submitButton || submitButton.disabled) {
    return;
  }
  const email = findElement("#pageAuthEmail").value.trim();
  const password = findElement("#pageAuthPassword").value;
  showPageAuthError("");
  // Admin Login accepts ONLY the owner email. Anyone else is
  // stopped here, before Firebase is even called.
  if (kind === "admin" && email.toLowerCase() !== ADMIN_EMAIL) {
    showPageAuthError("This is not the admin account. Admin dashboard sudhu store owner er jonno.");
    return;
  }
  if (!FIREBASE_CONFIGURED) {
    showPageAuthError("Firebase is not configured yet — paste your config into js/firebase.js first.");
    return;
  }
  const firebase = await getFirebase();
  if (!firebase) {
    showPageAuthError("Firebase could not be reached — check your internet connection, then try again.");
    return;
  }
  submitButton.disabled = true;
  const oldButtonText = submitButton.textContent;
  submitButton.textContent = "Please wait...";
  try {
    if (kind === "admin") {
      await doLogin(firebase, email, password);
      session.user = firebase.auth.currentUser;
      session.isAdmin = (firebase.auth.currentUser?.email || "").toLowerCase() === ADMIN_EMAIL;
      // Safety net: even if the email matched, the account that
      // just signed in must really be the owner.
      if (!session.isAdmin && firebase.auth.currentUser?.email?.toLowerCase() !== ADMIN_EMAIL) {
        await firebase.signOut(firebase.auth).catch(() => {});
        showPageAuthError("This is not the admin account. Admin dashboard sudhu store owner er jonno.");
        return;
      }
      location.hash = "#/admin";
    } else if (pageAuthMode === "login") {
      await doLogin(firebase, email, password);
      session.user = firebase.auth.currentUser;
      session.isAdmin = (firebase.auth.currentUser?.email || "").toLowerCase() === ADMIN_EMAIL;
      location.hash = "#/";
    } else {
      const name = findElement("#pageAuthName").value.trim();
      const signedUp = await doSignUp(firebase, email, password, name);
      if (!signedUp) {
        return;
      }
      session.user = firebase.auth.currentUser;
      session.isAdmin = (firebase.auth.currentUser?.email || "").toLowerCase() === ADMIN_EMAIL;
      location.hash = "#/";
    }
    // Fix the header at once (name chip, Logout button, Admin
    // link) — do not wait for Firebase's login watcher.
    refreshHeaderAfterLogin();
    onChange();
  } catch (error) {
    const code = (error && error.code) || "";
    if (code === "auth/email-already-in-use") {
      showPageAuthError("Ei email diye account already ache — please login instead.");
      pageAuthMode = "login";
      const title = findElement("#pageAuthTitle");
      if (title) {
        title.textContent = "Welcome back!";
      }
      const nameLabel = findElement("#pageAuthNameLabel");
      if (nameLabel) {
        nameLabel.style.display = "none";
      }
      submitButton.textContent = "Login";
    } else if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
      showPageAuthError("Email ba password vul — thik kore abar try koro.");
    } else if (code === "auth/weak-password") {
      showPageAuthError("Password kompokkhe 6 character hote hobe.");
    } else if (code === "auth/invalid-email") {
      showPageAuthError("Email ta thik moto lekho.");
    } else if (code === "auth/network-request-failed") {
      showPageAuthError("Internet connection check koro, tarpor abar try koro.");
    } else {
      showPageAuthError(error.message);
    }
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = oldButtonText;
  }
}
