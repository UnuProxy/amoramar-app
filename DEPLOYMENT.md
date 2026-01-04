# 🚀 Deployment Guide - Amor Amar

This guide will help you deploy both the **public website** and **backoffice** to production.

---

## 📋 Pre-Deployment Checklist

### 1. ✅ Code Sanitization
- [ ] All sensitive data is in environment variables (not hardcoded)
- [ ] `.env.local` is in `.gitignore` (already done ✓)
- [ ] `env.example` is committed to show required variables
- [ ] No console.logs with sensitive information
- [ ] Firebase security rules are properly configured

### 2. ✅ Environment Variables Setup
Copy `env.example` to `.env.local` and fill in your actual values:

```bash
cp env.example .env.local
```

Required services:
- **Firebase** (Authentication, Firestore, Storage)
- **Stripe** (Payments)
- **Resend** (Email notifications)

---

## 🎯 Deployment Strategy

You have **2 applications** in one codebase:
1. **Public Website** (`NEXT_PUBLIC_APP_MODE=web`) - For clients
2. **Backoffice** (`NEXT_PUBLIC_APP_MODE=backoffice`) - For admin/employees

**Deploy them as 2 separate Vercel projects** for better security and isolation.

---

## 📦 Step 1: Push to GitHub

### Create a new repository:

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Amor Amar Spa Management System"

# Add remote repository
git remote add origin https://github.com/YOUR_USERNAME/amoramar-app.git

# Push to GitHub
git push -u origin main
```

---

## 🌐 Step 2: Deploy Public Website (Client Portal)

### A. Create Vercel Project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New Project"**
3. Import your GitHub repository
4. **Project Name:** `amoramar-web` (or your domain name)

### B. Configure Build Settings

**Framework Preset:** Next.js

**Build Command:**
```bash
npm run build
```

**Output Directory:** `.next` (default)

**Install Command:** `npm install` (default)

### C. Environment Variables

Add all variables from `env.example` with these specific values:

```bash
NEXT_PUBLIC_APP_MODE=web
NEXT_PUBLIC_BASE_URL=https://your-domain.vercel.app

# Add all other Firebase, Stripe, Resend variables
```

### D. Deploy

Click **"Deploy"** and wait for the build to complete.

---

## 🔒 Step 3: Deploy Backoffice (Admin Portal)

### A. Create Second Vercel Project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New Project"** again
3. Import the **same** GitHub repository
4. **Project Name:** `amoramar-backoffice` or `admin-amoramar`

### B. Configure Build Settings

**Framework Preset:** Next.js

**Build Command:**
```bash
npm run build
```

**Output Directory:** `.next` (default)

### C. Environment Variables

Add all variables with these specific values:

```bash
NEXT_PUBLIC_APP_MODE=backoffice
NEXT_PUBLIC_BACKOFFICE_URL=https://admin-amoramar.vercel.app

# Add all other Firebase, Stripe, Resend variables (same as web)
```

### D. Deploy

Click **"Deploy"**.

---

## 🔐 Step 4: Security Configuration

### Firebase Security

1. **Authentication Settings:**
   - Enable Google Sign-In for client portal
   - Add authorized domains in Firebase Console:
     - `your-domain.vercel.app`
     - `admin-amoramar.vercel.app`
     - Your custom domain (if any)

2. **Firestore Security Rules:**
   - Already configured in `firestore.rules`
   - Deploy rules: `firebase deploy --only firestore:rules`

3. **Storage Security Rules:**
   - Already configured in `storage.rules`
   - Deploy rules: `firebase deploy --only storage`

### Stripe Webhooks

1. Go to Stripe Dashboard > Developers > Webhooks
2. Add endpoint for production:
   - URL: `https://your-domain.vercel.app/api/webhooks/stripe`
   - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`
3. Copy webhook secret and add to Vercel environment variables

---

## 🌍 Step 5: Custom Domains (Optional)

### For Public Website:
1. In Vercel project settings → Domains
2. Add: `amoramar.com` and `www.amoramar.com`
3. Configure DNS as Vercel instructs

### For Backoffice:
1. In Vercel project settings → Domains
2. Add: `admin.amoramar.com`
3. Configure DNS

---

## 🧪 Step 6: Testing

### Test Public Website:
- [ ] Homepage loads correctly
- [ ] Client can view services
- [ ] Booking flow works (all 4 steps)
- [ ] Stripe payment processes
- [ ] Email notifications send
- [ ] Client login/signup works
- [ ] Google Sign-In works

### Test Backoffice:
- [ ] Owner can log in
- [ ] Dashboard displays data
- [ ] Can create/edit services
- [ ] Can manage employees
- [ ] Calendar works
- [ ] Financial reports load
- [ ] Bookings management works

---

## 📊 Monitoring & Maintenance

### Vercel Analytics
- Enable in Project Settings → Analytics
- Monitor performance and errors

### Firebase Usage
- Monitor in Firebase Console → Usage
- Set up budget alerts

### Stripe
- Monitor payments in Stripe Dashboard
- Set up fraud protection

---

## 🆘 Troubleshooting

### Build Fails on Vercel

**Check:**
1. All environment variables are set correctly
2. No syntax errors in code
3. Build logs in Vercel dashboard

### Firebase Connection Issues

**Check:**
1. Firebase config environment variables are correct
2. Authorized domains are added in Firebase Console
3. API keys are for the correct Firebase project

### Stripe Payment Fails

**Check:**
1. Using correct Stripe keys (production vs test)
2. Webhook is configured correctly
3. Payment intent amount is valid

---

## 🔄 Continuous Deployment

Once set up, every push to `main` branch will:
1. Automatically deploy to both Vercel projects
2. Run build checks
3. Deploy if successful

To deploy from a different branch:
1. Change in Vercel Project Settings → Git
2. Select your preferred branch

---

## 📝 Post-Deployment Tasks

- [ ] Update README with live URLs
- [ ] Test all critical user flows
- [ ] Set up error monitoring (Sentry, LogRocket)
- [ ] Configure backup strategy for Firestore
- [ ] Set up automated testing (optional)
- [ ] Create admin user accounts
- [ ] Import initial service/employee data

---

## 🎉 You're Live!

Your applications are now live and ready to handle bookings!

**Public Website:** `https://your-domain.vercel.app`  
**Backoffice:** `https://admin-your-domain.vercel.app`

For support, refer to:
- [Next.js Deployment Docs](https://nextjs.org/docs/deployment)
- [Vercel Docs](https://vercel.com/docs)
- [Firebase Docs](https://firebase.google.com/docs)


