'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { auth, db } from '@/shared/lib/firebase';
import { createUser, getUser, updateUser } from '@/shared/lib/firestore';
import type { User, UserRole } from '@/shared/lib/types';
import { doc, setDoc, Timestamp } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  patchUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    if (!firebaseUser) return;
    try {
      const userData = await getUser(firebaseUser.uid);
      if (userData) {
        setUser(userData);
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  const patchUser = (updates: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : prev));
  };

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          let userData = await getUser(firebaseUser.uid);
          
          if (!userData) {
            // User document doesn't exist - create it automatically
            console.log('Creating user document in Firestore...');
            try {
              // Create user document with the Firebase UID
              if (db) {
                const userRef = doc(db, 'users', firebaseUser.uid);
                await setDoc(userRef, {
                  email: firebaseUser.email || '',
                  role: 'owner', // Default to owner for first login - can be changed later
                  isActive: true,
                  mustChangePassword: false,
                  createdAt: Timestamp.now(),
                  updatedAt: Timestamp.now(),
                });
                // Fetch the newly created user
                userData = await getUser(firebaseUser.uid);
              } else {
                throw new Error('Firestore not initialized');
              }
            } catch (createError: any) {
              console.error('Failed to create user document:', createError);
              // If creation fails, still allow login but show warning
              console.warn('User logged in but document creation failed. Please create user document manually in Firestore.');
            }
          }
          
          if (userData) {
            // Only employees should ever be forced to change password. Normalize locally and
            // try to persist the fix, but don't block login if the write fails.
            if (userData.role !== 'employee' && userData.mustChangePassword) {
              const normalized = { ...userData, mustChangePassword: false };
              try {
                await updateUser(userData.id, { mustChangePassword: false });
              } catch (updateError) {
                console.warn('Failed to clear mustChangePassword for non-employee user:', updateError);
              }
              setUser(normalized);
            } else {
              setUser(userData);
            }
          } else {
            setUser(null);
          }
        } catch (error: any) {
          // Handle permission errors gracefully
          if (error?.code === 'permission-denied') {
            console.error('❌ PERMISSION DENIED: Firestore rules need to be deployed!');
            console.error('Go to Firebase Console > Firestore > Rules and deploy the updated rules.');
            console.error('The user is authenticated but cannot read their own document.');
          } else {
            console.error('Error fetching user data:', error);
          }
          setUser(null);
        }
      } else {
        setUser(null);
        setFirebaseUser(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  const login = async (email: string, password: string) => {
    if (!auth) {
      throw new Error('Firebase no está configurado. Por favor, añade la configuración de Firebase a .env.local');
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // User state will be updated by onAuthStateChanged
    } catch (error: any) {
      // Provide more helpful error messages in Spanish
      let errorMessage = 'Error al iniciar sesión';
      
      // Check for specific Firebase error codes
      const errorCode = error?.code || error?.error?.message || '';
      
      if (errorCode.includes('user-not-found') || errorCode === 'auth/user-not-found') {
        errorMessage = 'No se encontró ninguna cuenta con este correo. Por favor, crea una cuenta primero en Firebase Console > Authentication > Users.';
      } else if (errorCode.includes('wrong-password') || errorCode === 'auth/wrong-password' || errorCode.includes('INVALID_PASSWORD')) {
        errorMessage = 'Contraseña incorrecta. Por favor, inténtalo de nuevo.';
      } else if (errorCode.includes('invalid-email') || errorCode === 'auth/invalid-email' || errorCode.includes('INVALID_EMAIL')) {
        errorMessage = 'Dirección de correo electrónico no válida. Por favor, verifica el formato de tu correo.';
      } else if (errorCode.includes('user-disabled') || errorCode === 'auth/user-disabled') {
        errorMessage = 'Esta cuenta ha sido deshabilitada. Por favor, contacta con soporte.';
      } else if (errorCode.includes('too-many-requests') || errorCode === 'auth/too-many-requests') {
        errorMessage = 'Demasiados intentos de inicio de sesión fallidos. Por favor, inténtalo más tarde.';
      } else if (errorCode.includes('operation-not-allowed') || errorCode === 'auth/operation-not-allowed' || errorCode.includes('OPERATION_NOT_ALLOWED')) {
        errorMessage = 'La autenticación por correo/contraseña no está habilitada. Ve a Firebase Console > Authentication > Sign-in method y habilita Email/Password.';
      } else if (errorCode.includes('invalid-api-key') || errorCode.includes('API_KEY_NOT_VALID')) {
        errorMessage = 'Clave API de Firebase no válida. Por favor, verifica tu archivo .env.local.';
      } else if (errorCode.includes('INVALID_CREDENTIAL') || errorCode.includes('invalid-credential')) {
        errorMessage = 'Correo electrónico o contraseña no válidos. Por favor, verifica tus credenciales.';
      } else if (error?.message) {
        errorMessage = `${error.message} (Código: ${errorCode || 'desconocido'})`;
      } else {
        errorMessage = `Error al iniciar sesión. Código de error: ${errorCode || 'desconocido'}. Asegúrate de: 1) El usuario existe en Firebase Auth, 2) La autenticación Email/Password está habilitada, 3) Las credenciales son correctas.`;
      }
      
      // Improved error logging for Firebase errors
      const errorDetails = {
        code: error?.code || errorCode || 'desconocido',
        message: error?.message || 'Sin mensaje',
        errorName: error?.name || 'Desconocido',
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      };
      console.error('Detalles del error de inicio de sesión:', errorDetails);
      throw new Error(errorMessage);
    }
  };

  const signup = async (email: string, password: string, role: UserRole) => {
    if (!auth) {
      throw new Error('Firebase not configured. Please add Firebase config to .env.local');
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser: Omit<User, 'id' | 'createdAt' | 'updatedAt'> = {
        email,
        role,
        mustChangePassword: false,
        isActive: true,
      };
      await createUser(newUser, userCredential.user.uid);
      // User state will be updated by onAuthStateChanged
    } catch (error: any) {
      throw new Error(error.message || 'Failed to sign up');
    }
  };

  const logout = async () => {
    if (!auth) {
      setUser(null);
      setFirebaseUser(null);
      return;
    }
    try {
      await signOut(auth);
      setUser(null);
      setFirebaseUser(null);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to logout');
    }
  };

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, login, signup, logout, refreshUser, patchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
