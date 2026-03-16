# 🏎️ F1 LIVE — Data Dashboard

Real-time Formula 1 data dashboard — works as a website AND an installable mobile app (PWA).

**Live race tracking · Championship standings · Lap times · F1 Fantasy predictor**

Powered by the [OpenF1 API](https://openf1.org).

---

## 🚀 Deploy to Vercel (3 steps)

### Step 1: Push to GitHub

```bash
cd f1-dashboard
git init
git add .
git commit -m "F1 Live Dashboard"
```

Then create a repo on github.com and push:

```bash
git remote add origin https://github.com/YOUR_USERNAME/f1-live-dashboard.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy on Vercel

1. Go to **[vercel.com/new](https://vercel.com/new)**
2. Sign in with GitHub
3. Click **Import** next to your `f1-live-dashboard` repo
4. Click **Deploy** (Vercel auto-detects Vite — no config needed)
5. Your site is live at `https://f1-live-dashboard.vercel.app`

### Step 3: Share with friends

Send them the Vercel URL. On their phones they can:

- **Android**: A banner appears asking to "Install" — tap it
- **iPhone**: Tap **Share** → **Add to Home Screen**

The app gets its own icon and opens fullscreen, just like a native app.

---

## 📱 PWA Features

- **Installable** on iOS and Android (home screen icon, splash screen)
- **Offline support** — cached data loads even without internet
- **Fullscreen mode** — no browser chrome when launched from home screen
- **Auto-refresh** — live session data updates every 15 seconds

## 🏁 Dashboard Features

| Tab | What it does |
|-----|-------------|
| **Live Session** | Positions, intervals, gaps, tires, pit stops, win probability |
| **Standings** | Driver & constructor championship (works between races too) |
| **Fantasy** | AI team picker, PPM analysis, value picks, strategy tips |
| **Schedule** | Full calendar with countdown to next race |
| **Lap Times** | Per-driver laps with sector splits and speed traps |

## 🛠 Run Locally

```bash
npm install
npm run dev
# Opens at http://localhost:5173
```

## 🌐 Optional: Custom Domain

If you want a URL like `f1live.app` instead of `*.vercel.app`:

1. Buy a domain (~$10/year) from Namecheap, Cloudflare, or Google
2. In Vercel dashboard → your project → **Settings** → **Domains**
3. Add your domain and follow the DNS instructions

---

## Tech Stack

React 18 · Vite 6 · PWA · OpenF1 API · Zero external UI libraries

Not affiliated with Formula 1.
