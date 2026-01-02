import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import firebaseApp from './firebase';

const storage = getStorage(firebaseApp!);

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
 * Delete an employee profile image from Firebase Storage
 * @param imageUrl - The URL of the image to delete
 */
export const deleteEmployeeProfileImage = async (imageUrl: string): Promise<void> => {
  try {
    // Extract the path from the URL
    const baseUrl = 'https://firebasestorage.googleapis.com/v0/b/';
    if (!imageUrl.startsWith(baseUrl)) {
      return; // Not a Firebase Storage URL
    }

    const pathStart = imageUrl.indexOf('/o/') + 3;
    const pathEnd = imageUrl.indexOf('?');
    const path = decodeURIComponent(imageUrl.substring(pathStart, pathEnd));

    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (error) {
    console.error('Error deleting profile image:', error);
    // Don't throw - deletion failure shouldn't block other operations
  }
};

