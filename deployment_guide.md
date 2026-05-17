# DEPLOYMENT GUIDE: SYSTEMATIC QUANTITATIVE RESEARCH & BACKTESTING PLATFORM

This guide details the exact steps to publish your **Quantitative Strategy Research & Backtesting Platform** live on your GitHub Pages account (`https://github.com/chiiinmay`).

We have already configured a local Git repository, created a clean `.gitignore`, set up environment-agnostic relative asset routing in `vite.config.js`, made the initial local commit, and integrated a professional **GitHub Actions CI/CD pipeline** at `.github/workflows/deploy.yml`.

---

## Step 1: Create the Remote Repository on GitHub

1. Open your web browser and navigate to: [https://github.com/new](https://github.com/new) (make sure you are logged in to your account `chiiinmay`).
2. Set the **Repository name** to: `quantitative-trading-engine`
3. Set the visibility to **Public** (required for free GitHub Pages hosting).
4. **DO NOT** check any initialization options (No README, No .gitignore, No License) — keep it a completely blank repository.
5. Click **Create repository**.

---

## Step 2: Connect and Push the Local Repository

Open a terminal or command prompt inside your project workspace folder (`c:\Users\User\OneDrive\Desktop\Quantitative Trading Strategy Backtesting Engine`) and run the following two commands:

```bash
# 1. Connect your local git repository to your new remote GitHub repository
git remote add origin https://github.com/chiiinmay/quantitative-trading-engine.git

# 2. Push the local main branch up to GitHub
git push -u origin main
```

---

## Step 3: Grant Workflow Permissions on GitHub (Crucial)

Because our automated deployment workflow builds and publishes the production static assets to the `gh-pages` branch, GitHub Actions needs **Write Permissions** on your repository:

1. Navigate to your repository page on GitHub: `https://github.com/chiiinmay/quantitative-trading-engine`
2. Click on the **Settings** tab in the top navigation bar of the repository.
3. In the left sidebar, scroll down to the **Actions** section and click on **General**.
4. Scroll all the way down to the bottom to the **Workflow permissions** section.
5. Select **Read and write permissions**.
6. Click **Save**.

---

## Step 4: Monitor the Automated Build and Get Your Live Link!

Once permissions are saved, you can watch your site compile and deploy:

1. Click on the **Actions** tab at the top of your GitHub repository.
2. You will see a running workflow named **Deploy to GitHub Pages**. Click on it to see live logs of the setup, build, and deploy steps.
3. Once the workflow turns green (completed successfully), GitHub will automatically spin up the deployment.
4. Go to **Settings** > **Pages** (in the left sidebar).
5. At the top of the Pages settings, you will see a banner with your live URL:
   
   **👉 Live Link:** `https://chiiinmay.github.io/quantitative-trading-engine/`

---
*Your platform is now fully version-controlled, production-optimized, and ready to showcase!*
