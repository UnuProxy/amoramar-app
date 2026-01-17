'use client';

import { useAuth } from '@/shared/hooks/useAuth';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/shared/lib/firebase';

export default function CheckRolePage() {
  const { user } = useAuth();
  const [userDoc, setUserDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserDoc = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        if (!db) {
          throw new Error('Firebase not initialized');
        }
        
        const userDocRef = doc(db, 'users', user.id);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists()) {
          setUserDoc(userDocSnap.data());
        } else {
          setUserDoc(null);
        }
      } catch (error) {
        console.error('Error fetching user doc:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserDoc();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Authentication & Role Check</h1>
        
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Current User (from useAuth)</h2>
            {user ? (
              <pre className="bg-gray-100 p-4 rounded overflow-auto">
                {JSON.stringify(user, null, 2)}
              </pre>
            ) : (
              <p className="text-red-600">Not logged in</p>
            )}
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4">User Document from Firestore</h2>
            {user ? (
              userDoc ? (
                <div>
                  <pre className="bg-gray-100 p-4 rounded overflow-auto mb-4">
                    {JSON.stringify(userDoc, null, 2)}
                  </pre>
                  
                  <div className="mt-4 p-4 rounded border-2 border-blue-500 bg-blue-50">
                    <h3 className="font-bold text-lg mb-2">Your Role:</h3>
                    <p className="text-2xl font-bold text-blue-600">{userDoc.role || 'NO ROLE SET'}</p>
                    
                    {userDoc.role !== 'owner' && (
                      <div className="mt-4 p-3 bg-yellow-100 border border-yellow-400 rounded">
                        <p className="font-semibold text-yellow-800">⚠️ You are NOT logged in as owner!</p>
                        <p className="text-sm mt-2 text-yellow-700">
                          To delete employees, you need role='owner'.
                        </p>
                        <p className="text-sm mt-2 text-yellow-700">
                          Current role: <strong>{userDoc.role || 'undefined'}</strong>
                        </p>
                      </div>
                    )}
                    
                    {userDoc.role === 'owner' && (
                      <div className="mt-4 p-3 bg-green-100 border border-green-400 rounded">
                        <p className="font-semibold text-green-800">✅ You are logged in as owner!</p>
                        <p className="text-sm mt-2 text-green-700">
                          You should be able to delete employees.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-red-100 border border-red-400 rounded">
                  <p className="font-semibold text-red-800">❌ User document NOT found in Firestore!</p>
                  <p className="text-sm mt-2 text-red-700">
                    Path: users/{user.id}
                  </p>
                  <p className="text-sm mt-2 text-red-700">
                    This user document needs to be created with role='owner'.
                  </p>
                </div>
              )
            ) : (
              <p className="text-gray-500">Log in first</p>
            )}
          </div>

          <div className="mt-6 p-4 bg-gray-100 rounded">
            <h3 className="font-bold mb-2">How to Fix:</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Go to <a href="https://console.firebase.google.com" target="_blank" rel="noopener" className="text-blue-600 underline">Firebase Console</a></li>
              <li>Select your project</li>
              <li>Go to Firestore Database</li>
              <li>Navigate to <code className="bg-white px-2 py-1 rounded">users</code> collection</li>
              <li>Find document with ID: <code className="bg-white px-2 py-1 rounded">{user?.id || 'your-user-id'}</code></li>
              <li>Edit the document and set: <code className="bg-white px-2 py-1 rounded">role: "owner"</code></li>
              <li>Refresh this page to verify</li>
            </ol>
          </div>

          {user && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
              <p className="font-semibold mb-2">Quick Copy:</p>
              <p className="text-sm">User ID: <code className="bg-white px-2 py-1 rounded select-all">{user.id}</code></p>
              <p className="text-sm mt-2">Email: <code className="bg-white px-2 py-1 rounded select-all">{user.email}</code></p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
