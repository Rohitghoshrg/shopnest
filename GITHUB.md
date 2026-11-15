# ShopNest on GitHub — a simple guide

This file explains, in plain words, how to put this code on
GitHub. No Git knowledge needed — just follow the steps.

## Which file is which part

| Part | File | What it is |
| --- | --- | --- |
| Login part | `js/auth.js` | Login box, sign up, who is logged in, who is the admin, welcome page, User Login page, Admin Login page |
| Shop / home | `js/shop.js` | Home page, product cards, filter bar, list pages, search, sidebar drawer, which page to show |
| Cart | `js/cart.js` | The shopping cart, quantities, BLACK20 coupon |
| Checkout | `js/checkout.js` | Checkout box, placing the order, My Orders, track an order |
| Admin | `js/admin.js` | Admin Dashboard, orders, customers, Seed 450 products |
| Profile | `js/profile.js` | Profile page, photo picker, My Orders, Logout, Delete Account, dark mode |
| Products data | `js/data.js` | All 450 products and the 15 categories |
| Firebase setup | `js/firebase.js` | Your Firebase project address (config) + loading Firebase |
| Design | `css/style.css` | Colours, header, cards, popups, dark mode |
| Main page | `index.html` | The one page: header, main area, login box, cart, checkout, footer |
| Database rules | `firestore.rules` | Safety rules — paste into Firebase Console > Firestore > Rules |

Every file starts with a short list like "Parts in this file",
and before each big part there is a marker like
`// ----- LOGIN PART -----`. Search for the part name
(for example `LOGIN PART`) and you will jump straight to it.

## Push to GitHub, step by step

Do this in a terminal, inside this folder.

**1. Make a new empty repo on GitHub**

- Go to github.com, click **+** (top right) → **New repository**.
- Name it `shopnest` (or anything you like).
- Leave it empty — do NOT tick "Add a README".
- Click **Create repository**. GitHub will show you a page
  with your repo address, like
  `https://github.com/YOUR-USERNAME/shopnest.git`.

**2. Push this code to it**

Run these commands one by one (replace `YOUR-USERNAME`
and `shopnest` with your own ones):

```bash
git init
git add .
git commit -m "ShopNest — first version"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/shopnest.git
git push -u origin main
```

That is all. Your code is now on GitHub.

**3. When you change the code later**

```bash
git add .
git commit -m "What you changed, in a few words"
git push
```

## A note about keys — read this

- `js/firebase.js` has your Firebase project keys (apiKey,
  projectId, and so on). Those are the normal **web** keys
  for a Firebase web app — they are meant to be in the code,
  and the real safety comes from `firestore.rules`, not from
  hiding these keys. So it is fine that they are in the repo.
- But NEVER put a **service account key** (`serviceAccountKey.json`)
  in the repo. That file is private and powerful. The
  `.gitignore` file in this folder already blocks it (and
  `node_modules`), so even if you add one by mistake, Git
  will not upload it.

## How to run it again (quick reminder)

Open this folder in VS Code, right-click `index.html` and
choose **Open with Live Server**. Do not double-click the file.
Full steps are in `README.md`.
