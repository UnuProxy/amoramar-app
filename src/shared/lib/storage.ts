import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import firebaseApp from './firebase';

const storage = getStorage(firebaseApp!);

const getStoragePathFromUrl = (fileUrl: string): string | null => {
  const baseUrl = 'https://firebasestorage.googleapis.com/v0/b/';
  if (!fileUrl.startsWith(baseUrl)) {
    return null;
  }

  const pathStart = fileUrl.indexOf('/o/') + 3;
  const pathEnd = fileUrl.indexOf('?');
  return decodeURIComponent(fileUrl.substring(pathStart, pathEnd));
};

/**
 * Upload an employee profile image to Firebase Storage
 * @param file - The image file to upload
 * @param employeeId - The employee's ID
 * @returns The download URL of the uploaded image
 */
export const uploadEmployeeProfileImage = async (
  file: File,
  employeeId: string
): Promise<string> => {
  try {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('El archivo debe ser una imagen');
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error('La imagen debe ser menor a 5MB');
    }

    // Create a unique filename
    const timestamp = Date.now();
    const extension = file.name.split('.').pop();
    const filename = `employees/${employeeId}/profile-${timestamp}.${extension}`;

    // Upload to Firebase Storage
    const storageRef = ref(storage, filename);
    const snapshot = await uploadBytes(storageRef, file);
    
    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
  } catch (error: any) {
    console.error('Error uploading profile image:', error);
    throw new Error(error.message || 'Error al subir la imagen');
  }
};

/**
 * Upload an expense receipt to Firebase Storage
 * Accepts images and PDF files up to 10MB.
 */
export const uploadExpenseReceipt = async (
  file: File,
  expenseDate: string
): Promise<string> => {
  try {
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    if (!isImage && !isPdf) {
      throw new Error('El archivo debe ser una imagen o un PDF');
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new Error('El archivo debe ser menor a 10MB');
    }

    const timestamp = Date.now();
    const safeDate = expenseDate || new Date().toISOString().split('T')[0];
    const extension = file.name.split('.').pop();
    const filename = `expenses/${safeDate}/receipt-${timestamp}.${extension}`;

    const storageRef = ref(storage, filename);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
  } catch (error: any) {
    console.error('Error uploading expense receipt:', error);
    throw new Error(error.message || 'Error al subir el recibo');
  }
};

/**
 * Delete an employee profile image from Firebase Storage
 * @param imageUrl - The URL of the image to delete
 */
export const deleteStorageFileByUrl = async (imageUrl: string): Promise<void> => {
  try {
    const path = getStoragePathFromUrl(imageUrl);
    if (!path) {
      return; // Not a Firebase Storage URL
    }

    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (error) {
    console.error('Error deleting storage file:', error);
    // Don't throw - deletion failure shouldn't block other operations
  }
};

export const deleteEmployeeProfileImage = async (imageUrl: string): Promise<void> => {
  await deleteStorageFileByUrl(imageUrl);
};

