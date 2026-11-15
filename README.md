# ShopNest — a simple online shop for Bangladesh

This is a Daraz-style shop. It has 450 products in 15 categories
(30 products in each category). People can log in, add things to
the cart, check out, and track their order. The shop owner has a
separate Admin page where he can see all orders, customers and sales.

No clever tricks are used in this code. Every file starts with a
short comment that says what the file does. Variable names are
full words, so you can read the code like a story.

## The files, one by one

| File | What it does |
| --- | --- |
| `index.html` | The one page of the shop. It holds the header (logo, search, menu), an empty main area, and the pop-up boxes (login, product, cart, checkout). |
| `css/style.css` | How the shop looks: colours, sizes, cards, pop-ups, dark mode. The colours are at the top, in the `:root` list. |
| `js/main.js` | The starting point. It connects all the parts and shows the first page. Start reading here. |
| `js/firebase.js` | Your Firebase project address (the config), and the code that loads Firebase from Google when it is needed. |
| `js/data.js` | All 450 products and the 15 categories. Each product has an id, name, price, photo and description. |
| `js/auth.js` | Login and sign up. It also remembers who is logged in, and decides who is the admin. |
| `js/cart.js` | The shopping cart. Add products, change quantities, and the BLACK20 coupon discount. |
| `js/shop.js` | What the visitor sees: the home page, category pages, search, and one product in a pop-up. It also reads the page address (`#/cat/saree`, `#/product/...`) and shows the right page. |
| `js/checkout.js` | Checkout and orders. It works out the total, places the order, and lets people track an order by its SN- number. |
| `js/admin.js` | The Admin Dashboard: total orders, total sales, all orders, all customers, and the "Seed 450 products" button. |
| `js/profile.js` | The Profile page (My Orders, Track Order, dark mode, Logout, Delete Account) and the dark mode switch. |
| `firestore.rules` | The safety rules for the online database. Paste this into the Firebase Console and press Publish. |

## Push to GitHub

There is a separate simple guide for this: `GITHUB.md`.
In short: make an empty repo on github.com, then run
`git init`, `git add .`, `git commit -m "ShopNest — first version"`,
`git branch -M main`, `git remote add origin <your repo address>`,
`git push -u origin main`. `GITHUB.md` also has a table that says
which file is which part (Login = `js/auth.js`, Shop = `js/shop.js`,
Cart = `js/cart.js`, Checkout = `js/checkout.js`, Admin = `js/admin.js`,
Profile = `js/profile.js`, Products = `js/data.js`, Firebase setup =
`js/firebase.js`, Design = `css/style.css`, Main page = `index.html`).
The `.gitignore` file blocks `node_modules` and any
`serviceAccountKey.json`, so those never get uploaded.

## How to run it

1. Open this folder in VS Code.
2. Install the "Live Server" extension.
3. Right-click `index.html` and choose **Open with Live Server**.
4. The shop opens in your browser (http://127.0.0.1:5500 or similar).

Do NOT double-click `index.html` to open it. That opens it as a
file, and login will not work. The shop must be served over
http (Live Server does this for you). If you see only the header
and footer and no products, you opened it as a file — use Live
Server instead. You can also run `python -m http.server 8000`
in this folder and open http://localhost:8000.

## How login and orders work, step by step

**Sign up and log in**

1. Click "Login / Sign Up" in the header.
2. To make a new account, click "No account? Sign up", type your
   name, email and a password (at least 6 characters), and press
   "Sign Up". The account is made in Firebase Auth.
3. To log in later, type the same email and password and press
   "Login".
4. You can look around the shop without logging in. But to buy
   something, you must log in first — the shop will ask you to
   log in when you press "Add to Cart" or "Buy Now".

**Buy something**

1. Find a product and press "Add to Cart" (or "Buy Now").
2. Open the cart and press "Checkout".
3. Fill in your name, phone, full address, district, delivery
   zone and payment method, then press "Place Order".
4. The order gets a number like `SN-1234567890`. Write it down —
   you need it to track the order.
5. If you are logged in and Firebase is set up, the order is
   saved online in Firestore. If Firebase is not set up yet,
   the order is saved in your browser instead, so nothing is lost.

**Track an order**

1. Go to "My Orders" or your Profile page.
2. Type the SN- number and press "Track Order".
3. You will see the steps: Placed → Processing → Shipped →
   Delivered. The owner changes the status in the Admin page.

## Where to change things

**Change a price**

Open `js/data.js`, find the product by its id (for example
`"headphones-01"`), and change its `"price"` number. Save the
file and refresh the page. That is all.

**Change a product photo**

In `js/data.js`, find the product and change its `"image"` link
to a new photo link.

**Change the coupon**

The coupon is `BLACK20` (20% off, only when the total is 1000৳
or more). It lives in `js/cart.js`, in the function called
`discountFor`. Change the word `BLACK20` and the `0.2` (20%)
there if you want a different coupon.

**Change the delivery charge**

Delivery is 80৳ inside Dhaka and 120৳ outside Dhaka. It lives
in `js/checkout.js`, in the function called `deliveryFor`.
Change the numbers `80` and `120` there.

**Change the admin (shop owner)**

The admin is the email `mohendhroghoshrohit@gmail.com`. Only
this person sees the Admin page. To change the owner, change
the email in TWO places:

1. `js/firebase.js` — the line `ADMIN_EMAIL = "..."`.
2. `firestore.rules` — the line with `request.auth.token.email`.

Both must be the same email, or Admin will not work.

**Change the colours**

Open `css/style.css` and look at the `:root` list at the top.
Change `--orange` and `--pink` for the main colour, and
`--cream` for the page background.

## Firebase setup (so login and orders work online)

The shop already has a Firebase project set up:
ShopNest, project id `shopnest-76167`, free Spark plan.

If you ever need to set it up again from scratch:

1. Go to console.firebase.google.com and add a project
   (name it `shopnest`). The free Spark plan is fine.
2. Build → Authentication → Sign-in method → enable
   Email/Password.
3. Build → Firestore Database → Create database, production
   mode, location `asia-south1`.
4. Project settings (the gear) → Your apps → Web app, copy the
   config and paste it into `js/firebase.js`.
5. Firestore Database → Rules, paste in the whole
   `firestore.rules` file, and press Publish.
6. Log in with the owner email, open Admin, and click
   "Seed 450 products to Firestore".

Until step 4 is done, the shop still works locally: products
show from `js/data.js` and orders save in the browser, and a
yellow banner says Firebase is not configured yet.

## If something goes wrong

- **Page is blank (only header and footer):** you opened the
  file by double-clicking it. Use Live Server instead.
- **"Email already in use" on sign up:** the account already
  exists. Click "Have an account? Login" and log in instead.
- **"Wrong email or password" on login:** check the spelling,
  and make sure you are using the password from sign up
  (not your Gmail password — the shop password is separate).
- **"Seed failed: Missing or insufficient permissions":** the
  Firestore rules are not published yet. Do step 5 above,
  wait one minute, and press Seed again.
- **Product photos are blank:** check your internet connection.
  The photos come from Unsplash. If one photo fails, a
  fallback photo is shown instead.
