import { useAuth } from '@/shared/context/AuthContext';

export function useFirebaseUser() {
  const { firebaseUser } = useAuth();
  return firebaseUser;
}




