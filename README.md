# 💆‍♀️ Amor Amar - Luxury Spa Management System

A complete, production-ready spa and wellness center management platform with public booking system and comprehensive backoffice.

## ✨ Features

### 🌐 Public Website (Client Portal)
- **Elegant Landing Page**: Luxury design inspired by Toni & Guy aesthetics
- **Smart Booking System**: 4-step booking flow with Stripe payment integration
- **Client Authentication**: Google Sign-In + Email/Password with password reset
- **Client Dashboard**: View bookings, loyalty points, favorites, and booking history
- **Mobile-First Design**: Fully responsive and optimized for phone usage
- **Auto-fill Forms**: Logged-in clients have details pre-filled for faster booking

### 🔐 Backoffice (Admin Portal)
- **Owner Dashboard**: Complete management system with analytics and financial reports
- **Service Management**: Create, edit, and manage services with employee assignments
- **Employee Management**: Comprehensive employee profiles and schedule management
- **Booking Management**: View, edit, cancel, and track all bookings
- **Financial Reports**: Revenue tracking, expense management, and profit analysis
- **Advanced Calendar**: Visual booking calendar with drag-and-drop functionality

### 👥 Employee Portal
- **Personal Dashboard**: View assigned bookings and upcoming appointments
- **Schedule Management**: Set weekly availability and time off
- **Booking Updates**: Mark bookings as completed or add notes

## 🛠 Tech Stack

- **Framework**: Next.js 16 (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS with custom utility classes
- **Backend**: Next.js API Routes
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth (Email/Password + Google Sign-In)
- **Payments**: Stripe (deposits with card payments)
- **Email**: Resend (transactional emails)
- **Storage**: Firebase Storage (employee profile images)
- **Form Handling**: React Hook Form + Zod validation

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Firebase project (Firestore, Auth, Storage)
- Stripe account (for payments)
- Resend account (for emails)

### Installation

1. **Clone the repository:**
```bash
git clone <repository-url>
cd amoramar-app
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment variables:**
```bash
# Copy the example file
cp env.example .env.local

# Edit .env.local with your actual credentials
```

Required services to configure:
- **Firebase**: Authentication, Firestore, Storage
- **Stripe**: Payment processing
- **Resend**: Email notifications

4. **Deploy Firebase security rules:**
```bash
firebase deploy --only firestore:rules
firebase deploy --only storage
```

5. **Run the development servers:**

For **Backoffice** (Admin Portal):
```bash
npm run dev:backoffice
# Opens at http://localhost:3000
```

For **Public Website** (Client Portal):
```bash
npm run dev:web
# Opens at http://localhost:3001
```

Or run default (backoffice):
```bash
npm run dev
```

## Project Structure

```
src/
├── app/                    # Next.js app router pages
│   ├── api/               # API routes
│   ├── dashboard/         # Owner dashboard pages
│   ├── employee/          # Employee portal pages
│   ├── login/             # Login page
│   └── page.tsx           # Public landing page
├── components/            # React components
│   ├── auth/             # Authentication components
│   ├── dashboard/        # Dashboard-specific components
│   ├── employee/         # Employee portal components
│   └── shared/           # Shared UI components
├── context/              # React context providers
├── hooks/               # Custom React hooks
├── lib/                 # Utilities and configurations
│   ├── firebase.ts      # Firebase initialization
│   ├── firestore.ts     # Firestore helpers
│   ├── types.ts         # TypeScript types
│   └── utils.ts         # Utility functions
└── styles/              # Global styles
```

## 👤 User Roles & Capabilities

### 👑 Owner (Admin)
- ✅ Full dashboard access with analytics
- ✅ Service management (create, edit, delete, assign employees)
- ✅ Employee management (profiles, schedules, deactivation)
- ✅ Booking management (view, edit, cancel all bookings)
- ✅ Financial reports (revenue, expenses, profit analysis)
- ✅ Calendar overview with all appointments
- ✅ Share booking links for marketing

### 💼 Employee
- ✅ Personal dashboard with assigned bookings
- ✅ Schedule management (set weekly availability)
- ✅ View upcoming appointments
- ✅ Update booking status (completed, add notes)
- ✅ Manage time off and blocked slots

### 👥 Client
- ✅ Browse services and team members
- ✅ Smart booking with 4-step flow
- ✅ Stripe payment (50% deposit)
- ✅ Google Sign-In or Email/Password authentication
- ✅ Password reset functionality
- ✅ Personal dashboard with:
  - View all bookings
  - Loyalty points tracking
  - Booking history
  - Favorite services and therapists
  - Profile management
- ✅ Guest checkout option (no account needed)
- ✅ Auto-fill forms when logged in

## Key Features

### Booking Flow
1. Client selects a service
2. Client selects an employee
3. System shows available time slots
4. Client selects date and time
5. Client provides contact information
6. Booking is confirmed

### Availability Management
- Employees set weekly recurring schedules
- System automatically excludes booked slots
- Real-time availability calculation
- Prevents double-booking

### Booking Management
- Filter by status, date, employee
- View booking details
- Update booking status
- Add internal notes
- Cancel bookings

## Development

### Available Scripts

```bash
# Development
npm run dev              # Run default (backoffice on port 3000)
npm run dev:backoffice  # Run backoffice on port 3000
npm run dev:web         # Run public website on port 3001

# Production
npm run build           # Build for production
npm run start           # Start production server
npm run lint            # Run ESLint

# Cleanup
npm run clean           # Clean all build artifacts and kill processes
npm run clean:web       # Clean web build only
npm run clean:backoffice # Clean backoffice build only
```

### Environment Variables

All configuration is in `.env.local` (never commit this file!). Use `env.example` as a template.

Required variables:
- Firebase (Auth, Firestore, Storage)
- Stripe (Payments)
- Resend (Emails)
- App mode (`web` or `backoffice`)

## 📦 Deployment

This application has **two deployment targets**:

1. **Public Website** (`amoramar-web`) - For clients
2. **Backoffice** (`amoramar-backoffice`) - For admin/employees

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the complete step-by-step deployment guide.

### Quick Deploy to Vercel

1. **Push to GitHub:**
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/amoramar-app.git
git push -u origin main
```

2. **Deploy Public Website:**
   - Go to [Vercel Dashboard](https://vercel.com)
   - Import GitHub repository
   - Set `NEXT_PUBLIC_APP_MODE=web`
   - Add all environment variables from `env.example`
   - Deploy

3. **Deploy Backoffice:**
   - Import the same GitHub repository again
   - Set `NEXT_PUBLIC_APP_MODE=backoffice`
   - Add all environment variables
   - Deploy

For detailed instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## Security

- Firestore security rules are configured in `firestore.rules`
- Authentication required for owner/employee routes
- Role-based access control implemented
- Input validation on all forms

## ✅ Implemented Features

- ✅ Stripe payment integration (50% deposits)
- ✅ Email notifications via Resend
- ✅ Client authentication (Google + Email/Password)
- ✅ Client dashboard with booking history
- ✅ Loyalty points system
- ✅ Financial analytics and reports
- ✅ Mobile-responsive design
- ✅ Smart booking flow with auto-fill
- ✅ Password reset functionality
- ✅ Service sharing links for marketing

## 🎯 Future Enhancements

- ⏳ SMS notifications (Twilio)
- ⏳ Multi-location support
- ⏳ Review/rating system
- ⏳ Waitlist functionality
- ⏳ Gift card/voucher system
- ⏳ Automated reminder emails
- ⏳ Advanced reporting dashboard
- ⏳ Client referral program

## License

This project is proprietary software.

## Support

For issues or questions, please contact the development team.















