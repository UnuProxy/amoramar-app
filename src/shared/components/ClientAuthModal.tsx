'use client';

import React, { useEffect, useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider,
  sendPasswordResetEmail 
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/shared/lib/firebase';
import { cn } from '@/shared/lib/utils';
import { useDelayedRender } from '@/shared/hooks/useDelayedRender';

interface ClientAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode?: 'login' | 'signup';
}

export const ClientAuthModal: React.FC<ClientAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  mode: initialMode = 'login',
}) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>(initialMode);
  const transitionMs = 220;
  const shouldRender = useDelayedRender(isOpen, transitionMs);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!shouldRender) return null;

  const handleGoogleSignIn = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    if (!auth || !db) {
      setError('Firebase no está configurado.');
      setLoading(false);
      return;
    }

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user document exists
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (!userDoc.exists()) {
        // New user - create user and client profile
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          role: 'client',
          phone: user.phoneNumber || null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const displayNameParts = (user.displayName || '').split(' ');
        const firstName = displayNameParts[0] || '';
        const lastName = displayNameParts.slice(1).join(' ') || '';

        await setDoc(doc(db, 'clients', user.uid), {
          userId: user.uid,
          firstName: firstName,
          lastName: lastName,
          email: user.email || '',
          phone: user.phoneNumber || null,
          loyaltyPoints: 0,
          totalSpent: 0,
          totalBookings: 0,
          favoriteServices: [],
          favoriteEmployees: [],
          notificationPreferences: {
            email: true,
            sms: false,
            promotions: true,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } else {
        // Existing user - verify they're a client
        if (userDoc.data()?.role !== 'client') {
          await auth.signOut();
          setError('Esta cuenta no es válida. ¿Eres empleado? Usa el portal de empleados.');
          setLoading(false);
          return;
        }
      }

      onSuccess();
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Autenticación cancelada.');
      } else if (err.code === 'auth/popup-blocked') {
        setError('Por favor, permite las ventanas emergentes para usar Google Sign-In.');
      } else {
        setError('Error al iniciar sesión con Google. Inténtalo de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!auth) {
      setError('Firebase no está configurado.');
      setLoading(false);
      return;
    }

    if (!formData.email) {
      setError('Por favor, ingresa tu email.');
      setLoading(false);
      return;
    }

    try {
      await sendPasswordResetEmail(auth, formData.email);
      setSuccess('¡Email de recuperación enviado! Revisa tu bandeja de entrada.');
    } catch (err: any) {
      console.error('Password reset error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('No existe una cuenta con este email.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Email inválido.');
      } else {
        setError('Error al enviar el email. Inténtalo de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!auth || !db) {
      setError('Firebase no está configurado.');
      setLoading(false);
      return;
    }

    try {
      if (mode === 'reset') {
        await handlePasswordReset(e);
        return;
      }
      
      if (mode === 'signup') {
        // Create Firebase Auth user
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          formData.email,
          formData.password
        );

        // Create user document
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          email: formData.email,
          role: 'client',
          phone: formData.phone || null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Create client profile document
        await setDoc(doc(db, 'clients', userCredential.user.uid), {
          userId: userCredential.user.uid,
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone || null,
          loyaltyPoints: 0,
          totalSpent: 0,
          totalBookings: 0,
          favoriteServices: [],
          favoriteEmployees: [],
          notificationPreferences: {
            email: true,
            sms: false,
            promotions: true,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        onSuccess();
      } else {
        // Login
        const userCredential = await signInWithEmailAndPassword(
          auth,
          formData.email,
          formData.password
        );

        // Verify user is a client
        const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
        if (!userDoc.exists() || userDoc.data()?.role !== 'client') {
          await auth.signOut();
          setError('Esta cuenta no es válida. ¿Eres empleado? Usa el portal de empleados.');
          return;
        }

        onSuccess();
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Este email ya está registrado. Intenta iniciar sesión.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Email inválido.');
      } else if (err.code === 'auth/weak-password') {
        setError('La contraseña debe tener al menos 6 caracteres.');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Email o contraseña incorrectos.');
      } else {
        setError('Error al procesar tu solicitud. Inténtalo de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={cn(
        'fixed inset-0 z-[100] flex items-center justify-center p-4 bg-neutral-900/90 backdrop-blur-xl transition-opacity duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]',
        isOpen ? 'opacity-100' : 'opacity-0'
      )}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          'bg-white rounded-2xl sm:rounded-[32px] max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl border-2 border-white/20 transform transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]',
          isOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-3 scale-[0.97]'
        )}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* Header - Luxury Dark */}
        <div className="sticky top-0 z-10 bg-neutral-900 px-5 sm:px-8 py-4 sm:py-6 text-white border-b border-white/5 rounded-t-2xl sm:rounded-t-[32px]">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
                <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-rose-400">Acceso Cliente</p>
              </div>
              <h2 className="text-xl sm:text-3xl font-black tracking-tighter uppercase leading-none">
                {mode === 'login' ? 'Bienvenido' : mode === 'reset' ? 'Recuperar' : 'Registrarse'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-white/5 text-white/40 hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-neutral-500 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider leading-relaxed max-w-[90%]">
            {mode === 'login'
              ? 'Accede a tu historial y gestiona tus reservas exclusivas'
              : mode === 'reset'
              ? 'Te enviaremos un enlace para restablecer tu contraseña'
              : 'Únete a Amor Amar y comienza tu viaje de bienestar personalizado'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 sm:space-y-5">
          
          {/* Google Sign-In Button - Only for login/signup */}
          {mode !== 'reset' && (
            <>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full px-4 py-3 bg-white border-2 border-neutral-200 rounded-xl hover:border-neutral-300 hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="text-sm font-bold text-neutral-700">
                  {mode === 'login' ? 'Continuar con Google' : 'Registrarse con Google'}
                </span>
              </button>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-neutral-200"></div>
                </div>
                <div className="relative flex justify-center text-[9px] uppercase tracking-widest">
                  <span className="px-4 bg-white text-neutral-400 font-black">O {mode === 'login' ? 'inicia sesión' : 'regístrate'} con email</span>
                </div>
              </div>
            </>
          )}

          {mode === 'signup' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-black text-neutral-400 uppercase tracking-wider">
                    Nombre
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-4 py-3 bg-neutral-50 border-2 border-neutral-100 rounded-xl text-neutral-900 font-bold focus:border-rose-500 transition-all outline-none text-base"
                    placeholder="María"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-black text-neutral-400 uppercase tracking-wider">
                    Apellido
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-4 py-3 bg-neutral-50 border-2 border-neutral-100 rounded-xl text-neutral-900 font-bold focus:border-rose-500 transition-all outline-none text-base"
                    placeholder="García"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[9px] font-black text-neutral-400 uppercase tracking-wider">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 bg-neutral-50 border-2 border-neutral-100 rounded-xl text-neutral-900 font-bold focus:border-rose-500 transition-all outline-none text-base"
                  placeholder="+34 600 000 000"
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <label className="block text-[9px] font-black text-neutral-400 uppercase tracking-wider">
              Email
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 bg-neutral-50 border-2 border-neutral-100 rounded-xl text-neutral-900 font-bold focus:border-rose-500 transition-all outline-none text-base"
              placeholder="tu@email.com"
            />
          </div>

          {mode !== 'reset' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[9px] font-black text-neutral-400 uppercase tracking-wider">
                  Contraseña
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('reset');
                      setError('');
                      setSuccess('');
                    }}
                    className="text-[9px] font-black text-rose-600 hover:text-rose-700 uppercase tracking-wider"
                  >
                    ¿Olvidaste?
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 bg-neutral-50 border-2 border-neutral-100 rounded-xl text-neutral-900 font-bold focus:border-rose-500 transition-all outline-none pr-12 text-base"
                  placeholder="••••••••"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-300 hover:text-neutral-900 transition-colors p-1"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                  )}
                </button>
              </div>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
              <p className="text-[9px] font-black text-emerald-600 uppercase tracking-wider leading-relaxed">{success}</p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
              <p className="text-[9px] font-black text-amber-600 uppercase tracking-wider leading-relaxed">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-4 bg-neutral-900 text-white text-xs font-black uppercase tracking-[0.2em] rounded-xl hover:bg-rose-600 active:scale-[0.98] transition-all shadow-xl shadow-rose-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? 'PROCESANDO...'
              : mode === 'login'
              ? 'ENTRAR'
              : mode === 'reset'
              ? 'ENVIAR EMAIL'
              : 'CREAR CUENTA'}
          </button>

          <div className="text-center pt-3 border-t border-neutral-100">
            <button
              type="button"
              onClick={() => {
                if (mode === 'reset') {
                  setMode('login');
                } else {
                  setMode(mode === 'login' ? 'signup' : 'login');
                }
                setError('');
                setSuccess('');
              }}
              className="text-[9px] font-black text-neutral-400 hover:text-rose-600 transition-colors uppercase tracking-wider py-2"
            >
              {mode === 'reset'
                ? '← Volver al inicio de sesión'
                : mode === 'login'
                ? '¿No tienes cuenta? Regístrate gratis'
                : '¿Ya eres miembro? Inicia sesión'}
            </button>
          </div>
        </form>

        {/* Benefits for Signup */}
        {mode === 'signup' && (
          <div className="px-5 sm:px-6 pb-5 sm:pb-6">
            <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-100">
              <p className="text-[9px] font-black text-neutral-900 uppercase tracking-wider mb-3 border-b border-neutral-200 pb-2 text-center">
                Membresía Amor Amar
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { title: 'RESERVAS 24/7', desc: 'Gestiona tu tiempo' },
                  { title: 'LOYALTY POINTS', desc: 'Acumula beneficios' },
                  { title: 'OFERTAS VIP', desc: 'Acceso anticipado' },
                  { title: 'HISTORIAL', desc: 'Tus favoritos siempre' },
                ].map((item) => (
                  <div key={item.title}>
                    <p className="text-[8px] font-black text-rose-600 uppercase tracking-wider">{item.title}</p>
                    <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider mt-0.5">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
