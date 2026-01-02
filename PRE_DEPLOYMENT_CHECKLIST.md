# ✅ Pre-Deployment Checklist

Complete this checklist before deploying to production.

---

## 🔐 Security & Configuration

### Environment Variables
- [ ] `env.example` is up to date with all required variables
- [ ] `.env.local` is in `.gitignore` (already done ✓)
- [ ] No hardcoded API keys or secrets in code
- [ ] All sensitive data uses environment variables

### Firebase Security
- [ ] Firestore security rules deployed (`firebase deploy --only firestore:rules`)
- [ ] Storage security rules deployed (`firebase deploy --only storage`)
- [ ] Authentication methods enabled (Email/Password + Google)
- [ ] Authorized domains added for production URLs

### Stripe
- [ ] Test mode tested thoroughly
- [ ] Production API keys obtained
- [ ] Webhook endpoint configured for production
- [ ] Webhook secret added to environment variables

---

## 🧪 Testing

### Public Website (Client Portal)
- [ ] Homepage loads and displays correctly
- [ ] All services display with correct information
- [ ] Booking flow works (all 4 steps)
  - [ ] Service selection
  - [ ] Client details form
  - [ ] Date/time selection with available slots
  - [ ] Payment processing
- [ ] Google Sign-In works
- [ ] Email/Password login works
- [ ] Password reset emails send
- [ ] Guest checkout works
- [ ] Logged-in users have auto-filled forms
- [ ] Booking confirmation emails send
- [ ] Mobile responsiveness verified
- [ ] No horizontal overflow on mobile

### Backoffice (Admin Portal)
- [ ] Owner login works
- [ ] Dashboard displays data correctly
- [ ] Service management (create, edit, delete)
- [ ] Employee management (create, edit, schedule)
- [ ] Booking management (view, edit, cancel)
- [ ] Calendar view works
- [ ] Financial reports load correctly
- [ ] Sharing links copy correctly

### Employee Portal
- [ ] Employee login works
- [ ] Dashboard shows assigned bookings
- [ ] Schedule management works
- [ ] Can update booking status

---

## 🗂️ Code Quality

### Code Cleanup
- [ ] All `console.log` statements removed or commented
- [ ] No debug code left in production
- [ ] No TODO comments that should be addressed
- [ ] All TypeScript errors resolved
- [ ] ESLint passes (`npm run lint`)

### Documentation
- [ ] README.md is up to date
- [ ] DEPLOYMENT.md is complete
- [ ] env.example shows all required variables
- [ ] API routes are documented (if needed)

---

## 📦 Git & GitHub

### Repository Setup
- [ ] Repository created on GitHub
- [ ] `.gitignore` is properly configured
- [ ] All files committed
- [ ] Pushed to `main` branch
- [ ] No sensitive files in repository

### Git Hygiene
- [ ] No `.env.local` or `.env` files committed
- [ ] No `node_modules` committed
- [ ] No `.next` build folders committed
- [ ] No API keys in commit history

---

## 🌐 Deployment Setup

### Vercel - Public Website
- [ ] Project created in Vercel
- [ ] GitHub repository connected
- [ ] `NEXT_PUBLIC_APP_MODE=web` set
- [ ] All environment variables added
- [ ] Build settings configured
- [ ] Domain configured (if custom)

### Vercel - Backoffice
- [ ] Second project created in Vercel
- [ ] Same GitHub repository connected
- [ ] `NEXT_PUBLIC_APP_MODE=backoffice` set
- [ ] All environment variables added
- [ ] Build settings configured
- [ ] Domain configured (if custom)

---

## 🔗 External Services

### Firebase
- [ ] Production project created (or using existing)
- [ ] Authorized domains added:
  - [ ] Public website URL
  - [ ] Backoffice URL
  - [ ] Custom domains (if any)
- [ ] Google Sign-In enabled
- [ ] Firestore indexes created (if needed)
- [ ] Storage bucket configured

### Stripe
- [ ] Account in production mode
- [ ] Webhook endpoint configured:
  - URL: `https://your-domain.com/api/webhooks/stripe`
  - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`
- [ ] Webhook secret saved to environment variables
- [ ] Test payment flow in production

### Resend (Email)
- [ ] Production API key obtained
- [ ] Domain verified (if using custom domain)
- [ ] Email templates tested
- [ ] From email address configured

---

## 📊 Post-Deployment

### Verification
- [ ] Public website loads at production URL
- [ ] Backoffice loads at production URL
- [ ] Test booking flow end-to-end
- [ ] Test payment processing with real card
- [ ] Verify emails are sending
- [ ] Check Firebase logs for errors
- [ ] Monitor Vercel logs for issues

### Data Setup
- [ ] Create owner account
- [ ] Add initial services
- [ ] Add employee profiles
- [ ] Test with real booking

### Monitoring
- [ ] Vercel Analytics enabled
- [ ] Firebase usage alerts configured
- [ ] Stripe fraud protection enabled
- [ ] Error monitoring set up (optional: Sentry)

---

## 📝 Final Steps

- [ ] Announce launch to team
- [ ] Update marketing materials with live URLs
- [ ] Test booking links in social media
- [ ] Create backup schedule for Firestore
- [ ] Document any custom processes
- [ ] Celebrate! 🎉

---

## 🆘 Emergency Contacts

Keep these handy after deployment:

- **Firebase Console**: https://console.firebase.google.com
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Stripe Dashboard**: https://dashboard.stripe.com
- **Resend Dashboard**: https://resend.com/emails

---

## ⚡ Quick Rollback (if needed)

If something goes wrong:

1. Go to Vercel project → Deployments
2. Find the last working deployment
3. Click the three dots → "Promote to Production"
4. Fix issues locally and redeploy

---

**Last Updated**: {{ DATE }}

**Deployment Status**: ⏳ Pending / ✅ Complete

