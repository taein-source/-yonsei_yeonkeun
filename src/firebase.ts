import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  getDoc,
  updateDoc, 
  deleteDoc,
  doc, 
  onSnapshot, 
  query, 
  where,
  orderBy, 
  increment,
  setDoc,
  getDocFromServer,
  arrayUnion
} from "firebase/firestore";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  uploadString
} from "firebase/storage";
import firebaseConfigJson from "../firebase-applet-config.json";
import { compressImage } from "./utils/imageCompressor";
import { getApiUrl, getAssetUrl, API_BASE_URL } from "./utils/api";

// Firebase Configuration from provisioned configuration
const firebaseConfig = {
  apiKey: firebaseConfigJson.apiKey,
  authDomain: firebaseConfigJson.authDomain,
  projectId: firebaseConfigJson.projectId,
  storageBucket: firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId,
  appId: firebaseConfigJson.appId,
};

let app: any;
let db: any = null;
let storage: any = null;
let isFirebaseAvailable = false;

try {
  if (firebaseConfig.projectId && firebaseConfig.apiKey) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = firebaseConfigJson.firestoreDatabaseId && firebaseConfigJson.firestoreDatabaseId !== "(default)"
      ? getFirestore(app, firebaseConfigJson.firestoreDatabaseId)
      : getFirestore(app);
    storage = getStorage(app);
    isFirebaseAvailable = true;
    console.log("Firebase (Firestore & Storage) initialized successfully!");
  } else {
    console.warn("Firebase config missing. Operating in local fallback mode.");
  }
} catch (error) {
  console.error("Firebase initialization failed, falling back to Local Storage:", error);
}

// Test Firestore connection on boot
if (db) {
  try {
    getDocFromServer(doc(db, 'test', 'connection')).catch(() => {
      // Benign connection probe
    });
  } catch {}
}

export { db, storage, isFirebaseAvailable };

export interface Product {
  id: string | number;
  name: string;
  category?: string;
  location: string;
  price: string;
  icon: string;
  imageUrl?: string;
  image?: string;
  status: '나눔중' | '예약중' | '완료' | '무료';
  rank?: string;
  rankBg?: string;
  date: string;
  seller: string;
  sellerUsername?: string;
  description: string;
  tags?: string[];
  likes: number;
  views: number;
}

// Pre-seeded products (Cleared upon user request)
export const initialProducts: Product[] = [];

// Offline fallbacks via localStorage
const LOCAL_STORAGE_KEY = "dorm_share_products";

export const getLocalProducts = (): Product[] => {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!stored) {
      return [];
    }
    const parsed: Product[] = JSON.parse(stored);
    const obsoleteMockIds = ["prod_init_001", "prod_init_002"];
    const filtered = parsed.filter(p => !obsoleteMockIds.includes(String(p.id)));
    if (filtered.length !== parsed.length) {
      saveLocalProducts(filtered);
    }
    return filtered;
  } catch {
    return [];
  }
};

export const saveLocalProducts = (products: Product[]) => {
  try {
    // Attempt saving full products with compressed images
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(products));
  } catch (err: any) {
    console.warn("saveLocalProducts localStorage quota exceeded, attempting sanitized cache:", err);
    try {
      // Exclude large data: URIs only when browser storage quota is exceeded
      const sanitized = products.map(p => {
        const isDataUrl = (url?: string) => typeof url === "string" && url.startsWith("data:");
        if (isDataUrl(p.image) || isDataUrl(p.imageUrl)) {
          return {
            ...p,
            image: isDataUrl(p.image) ? "" : p.image,
            imageUrl: isDataUrl(p.imageUrl) ? "" : p.imageUrl,
          };
        }
        return p;
      });

      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sanitized));
    } catch {
      // safe fallback
    }
  }
};

// ----------------------------------------
// FIREBASE STORAGE DIRECT IMAGE UPLOAD
// ----------------------------------------

/**
 * Upload and retrieve the top event banner image URL from Firebase Storage
 */
export const getOrUploadTopEventBanner = async (): Promise<string> => {
  const defaultUrl = "/upperbanner-png.jpg";
  const localFallbackUrl = "/upperbanner-png.jpg";
  if (!storage) {
    return defaultUrl;
  }

  const eventBannerRef = ref(storage, "banners/upperbanner_clean_v3.jpg");
  try {
    const existingUrl = await getDownloadURL(eventBannerRef);
    if (existingUrl) return existingUrl;
  } catch {
    // Need upload
  }

  try {
    // Try fetching local first, then remote url if needed
    let res = await fetch(localFallbackUrl);
    if (!res.ok) {
      res = await fetch(defaultUrl);
    }
    if (res.ok) {
      const blob = await res.blob();
      const snapshot = await uploadBytes(eventBannerRef, blob, {
        contentType: "image/jpeg",
        customMetadata: {
          title: "연근마켓 맨 위 상단 배너",
          uploadedAt: new Date().toISOString()
        }
      });
      const downloadUrl = await getDownloadURL(snapshot.ref);
      return downloadUrl;
    }
  } catch (err) {
    console.warn("Firebase Storage top banner sync warning:", err);
  }

  return defaultUrl;
};

/**
 * Upload and retrieve the home register banner image URL from Firebase Storage
 */
export const getOrUploadHomeBanner = async (): Promise<string> => {
  const defaultUrl = "https://i.ibb.co/0p8r3cLM/banner-png.jpg";
  const localFallbackUrl = "/banner_register.jpg";
  if (!storage) {
    return defaultUrl;
  }

  const bannerStorageRef = ref(storage, "banners/register_banner_v2.jpg");
  try {
    const existingUrl = await getDownloadURL(bannerStorageRef);
    if (existingUrl) return existingUrl;
  } catch {
    // Not found or network error, proceed to upload
  }

  try {
    let res = await fetch(localFallbackUrl);
    if (!res.ok) {
      res = await fetch(defaultUrl);
    }
    if (res.ok) {
      const blob = await res.blob();
      const snapshot = await uploadBytes(bannerStorageRef, blob, {
        contentType: "image/jpeg",
        customMetadata: {
          title: "연근마켓 등록하기 배너",
          originalFile: "banner_register.jpg",
          uploadedAt: new Date().toISOString()
        }
      });
      const downloadUrl = await getDownloadURL(snapshot.ref);
      return downloadUrl;
    }
  } catch (err) {
    console.warn("Firebase Storage register banner sync warning:", err);
  }

  return defaultUrl;
};

export interface SampleAvatarData {
  id: string;
  name: string;
  url: string;
  localPath: string;
  storagePath: string;
}

export const SAMPLE_AVATAR_DEFINITIONS: SampleAvatarData[] = [
  { id: 'samplepic1', name: '샘플 프로필 1', url: 'https://i.ibb.co/YTTbzcmw/samplepic1.png', localPath: '/samplepic1.png', storagePath: 'avatars/samplepic1_v2.png' },
  { id: 'samplepic2', name: '샘플 프로필 2', url: 'https://i.ibb.co/tTvSdxFv/samplepic2.png', localPath: '/samplepic2.png', storagePath: 'avatars/samplepic2_v2.png' },
  { id: 'samplepic3', name: '샘플 프로필 3', url: 'https://i.ibb.co/1Yz4gjmW/samplepic3.png', localPath: '/samplepic3.png', storagePath: 'avatars/samplepic3_v2.png' },
  { id: 'samplepic4', name: '샘플 프로필 4', url: 'https://i.ibb.co/JWYbcYfL/samplepic4.png', localPath: '/samplepic4.png', storagePath: 'avatars/samplepic4_v2.png' },
  { id: 'samplepic5', name: '샘플 프로필 5', url: 'https://i.ibb.co/PzY20pv0/samplepic5.png', localPath: '/samplepic5.png', storagePath: 'avatars/samplepic5_v2.png' }
];

/**
 * Permanently upload and synchronize all 5 sample avatars to Firebase Storage
 */
export const getOrUploadSampleAvatars = async (): Promise<Record<string, string>> => {
  const result: Record<string, string> = {};

  for (const item of SAMPLE_AVATAR_DEFINITIONS) {
    result[item.id] = item.url;
    if (!storage) continue;

    const avatarRef = ref(storage, item.storagePath);
    try {
      const existingUrl = await getDownloadURL(avatarRef);
      if (existingUrl) {
        result[item.id] = existingUrl;
        continue;
      }
    } catch {
      // Need upload
    }

    try {
      let res = await fetch(item.localPath);
      if (!res.ok) {
        res = await fetch(item.url);
      }
      if (res.ok) {
        const blob = await res.blob();
        const snapshot = await uploadBytes(avatarRef, blob, {
          contentType: "image/png",
          customMetadata: {
            title: item.name,
            avatarId: item.id,
            uploadedAt: new Date().toISOString()
          }
        });
        const downloadUrl = await getDownloadURL(snapshot.ref);
        result[item.id] = downloadUrl;
      }
    } catch (err) {
      console.warn(`Firebase Storage avatar sync warning for ${item.id}:`, err);
    }
  }

  return result;
};

/**
 * Upload an original image file directly to Firebase Storage and return its public download URL
 */
export const uploadImageToFirebaseStorage = async (
  fileOrBlob: File | Blob | string,
  fileNamePrefix = "item"
): Promise<string> => {
  if (!storage) {
    throw new Error("Firebase Storage가 초기화되지 않았습니다.");
  }

  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);

  if (typeof fileOrBlob === "string") {
    // If it's already a web/remote URL (http), return directly
    if (fileOrBlob.startsWith("http://") || fileOrBlob.startsWith("https://")) {
      return fileOrBlob;
    }
    // If it's a data URL / base64 string
    const isPng = fileOrBlob.startsWith("data:image/png");
    const ext = isPng ? "png" : "jpg";
    const storageRef = ref(storage, `items/${fileNamePrefix}_${timestamp}_${randomStr}.${ext}`);
    const snapshot = await uploadString(storageRef, fileOrBlob, "data_url");
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } else {
    // File or Blob directly from input[type="file"]
    const fileName = (fileOrBlob as File).name;
    const nameExt = fileName && fileName.includes('.') ? fileName.split('.').pop() : 'jpg';
    const storageRef = ref(storage, `items/${fileNamePrefix}_${timestamp}_${randomStr}.${nameExt || 'jpg'}`);
    const snapshot = await uploadBytes(storageRef, fileOrBlob, {
      contentType: fileOrBlob.type || 'image/jpeg'
    });
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  }
};

/**
 * Upload image to backend local storage (/api/upload) as reliable fallback
 */
export const uploadImageToBackend = async (dataUrl: string, prefix = "item"): Promise<string> => {
  try {
    if (!dataUrl || !dataUrl.startsWith("data:")) return dataUrl;
    const res = await fetch(getApiUrl("/api/upload"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: dataUrl, filename: prefix })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.url) {
        return getAssetUrl(data.url);
      }
    }
  } catch (err) {
    console.warn("uploadImageToBackend warning:", err);
  }
  return dataUrl;
};

/**
 * Multi-layer image processing:
 * 1. Resizes & compresses huge photo (often 5MB+) into light, high-clarity image (~70KB)
 * 2. Attempts Firebase Storage upload with quick timeout
 * 3. Fallback to backend /api/upload static storage
 * 4. Fallback to compressed base64 (which safely fits in Firestore 1MB document limit)
 */
export const uploadItemImage = async (
  fileOrBlob: File | Blob | string,
  fileNamePrefix = "item"
): Promise<string> => {
  if (!fileOrBlob) return "";

  // If already a remote or static URL
  if (typeof fileOrBlob === "string" && (fileOrBlob.startsWith("http://") || fileOrBlob.startsWith("https://") || fileOrBlob.startsWith("/uploads/"))) {
    return fileOrBlob;
  }

  // 1. Compress image to prevent Firestore 1MB quota and memory bloat
  let compressedDataUrl = "";
  try {
    compressedDataUrl = await compressImage(fileOrBlob, 900, 900, 0.82);
  } catch (e) {
    console.warn("compressImage fallback:", e);
    if (typeof fileOrBlob === "string") {
      compressedDataUrl = fileOrBlob;
    }
  }

  if (!compressedDataUrl) {
    return typeof fileOrBlob === "string" ? fileOrBlob : "";
  }

  // 2. Try Firebase Storage upload
  if (storage) {
    try {
      const storagePromise = uploadImageToFirebaseStorage(compressedDataUrl, fileNamePrefix);
      const timeoutPromise = new Promise<string>((_, reject) => 
        setTimeout(() => reject(new Error("Storage upload timeout")), 3500)
      );
      const storageUrl = await Promise.race([storagePromise, timeoutPromise]);
      if (storageUrl && (storageUrl.startsWith("http://") || storageUrl.startsWith("https://"))) {
        return storageUrl;
      }
    } catch (err) {
      console.warn("Firebase Storage skipped or timed out:", err);
    }
  }

  // 3. Return high-clarity compressed data URL directly
  // By storing the lightweight compressed base64 directly in Firestore and application memory,
  // uploaded photos are guaranteed to persist permanently across Cloud Run container reboots.
  return compressedDataUrl;
};

// ----------------------------------------
// FIRESTORE & SERVER API FUNCTIONS
// ----------------------------------------

/**
 * Fetch all items/products from Firestore (realtime subscriber format), or backend/localStorage fallback.
 */
export const getProducts = (callback: (products: Product[]) => void) => {
  let isUnsubscribed = false;
  let hasReceivedFirestoreData = false;

  const fetchBackendProducts = async () => {
    // If Firestore has already delivered real-time accurate data, do not overwrite with stale backend data
    if (hasReceivedFirestoreData) {
      return true;
    }
    try {
      const res = await fetch(getApiUrl("/api/products"));
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.products)) {
          if (!hasReceivedFirestoreData) {
            saveLocalProducts(data.products);
            if (!isUnsubscribed) {
              callback(data.products);
            }
          }
          return true;
        }
      }
    } catch (err) {
      console.warn("Backend products fetch warning:", err);
    }
    return false;
  };

  let unsubscribeFirestore: (() => void) | null = null;
  let pollInterval: NodeJS.Timeout | null = null;

  if (isFirebaseAvailable && db) {
    try {
      // Query 'items' collection in Firestore
      const q = query(collection(db, "items"), orderBy("date", "desc"));
      
      unsubscribeFirestore = onSnapshot(q, (snapshot) => {
        hasReceivedFirestoreData = true;
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }

        const itemsList: Product[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const img = data.imageUrl || data.image || undefined;
          itemsList.push({
            id: docSnap.id,
            name: data.name,
            category: data.category,
            location: data.location,
            price: data.price,
            icon: data.icon || "fa-solid fa-box",
            imageUrl: img,
            image: img,
            status: data.status,
            rank: data.rank,
            rankBg: data.rankBg,
            date: data.date,
            seller: data.seller,
            sellerUsername: data.sellerUsername,
            description: data.description,
            tags: data.tags,
            likes: data.likes || 0,
            views: data.views || 0,
          });
        });
        saveLocalProducts(itemsList);
        if (!isUnsubscribed) {
          callback(itemsList);
        }
      }, async (_err) => {
        hasReceivedFirestoreData = false;
        const success = await fetchBackendProducts();
        if (!success && !isUnsubscribed) callback(getLocalProducts());
      });
    } catch (e) {
      console.error("Firestore error, fallback to backend/localStorage:", e);
    }
  }

  // Initial fetch from backend API only if Firestore hasn't responded yet
  fetchBackendProducts().then(success => {
    if (!success && !hasReceivedFirestoreData && !isUnsubscribed) {
      callback(getLocalProducts());
    }
  });

  // Fallback polling ONLY if Firestore is unavailable
  if (!isFirebaseAvailable || !db) {
    pollInterval = setInterval(() => {
      if (!isUnsubscribed) {
        fetchBackendProducts();
      }
    }, 2500);
  }

  return () => {
    isUnsubscribed = true;
    if (pollInterval) {
      clearInterval(pollInterval);
    }
    if (unsubscribeFirestore) {
      unsubscribeFirestore();
    }
  };
};

/**
 * Add a new item to Firestore 'items' collection with imageUrl, and sync with backend server.
 */
export const addProduct = async (productData: Omit<Product, 'id'>): Promise<Product> => {
  let finalImageUrl = productData.imageUrl || productData.image || "";

  // If image is a large data URL, safely process via uploadItemImage (compress + upload)
  if (finalImageUrl && finalImageUrl.startsWith("data:")) {
    try {
      finalImageUrl = await uploadItemImage(finalImageUrl, "item");
    } catch (e) {
      console.warn("Image upload fallback during addProduct:", e);
      try {
        finalImageUrl = await compressImage(finalImageUrl, 800, 800, 0.8);
      } catch {}
    }
  }

  // Unified ID across Firestore and backend server
  const unifiedId = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const payload = {
    id: unifiedId,
    ...productData,
    imageUrl: finalImageUrl,
    image: finalImageUrl,
    likes: productData.likes || 0,
    views: productData.views || 0,
    date: productData.date || new Date().toISOString().split('T')[0]
  };

  let createdProduct: Product = { ...payload };

  // 1. Send to Backend Server API first
  try {
    const res = await fetch(getApiUrl("/api/products"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.product) {
        createdProduct = data.product;
      }
    }
  } catch (err) {
    console.error("Backend addProduct error:", err);
  }

  // 2. Save directly to Firestore 'items' and 'products' collections with the same unified ID
  if (isFirebaseAvailable && db) {
    try {
      await setDoc(doc(db, "items", unifiedId), payload);
      try {
        await setDoc(doc(db, "products", unifiedId), payload);
      } catch {}
      console.log("Item saved to Firestore with ID:", unifiedId);
    } catch (error) {
      console.error("Failed to add to Firestore 'items':", error);
    }
  }

  // Update local storage backup
  const locals = getLocalProducts();
  const updatedLocals = [createdProduct, ...locals.filter(p => String(p.id) !== String(createdProduct.id))];
  saveLocalProducts(updatedLocals);

  return createdProduct;
};

/**
 * Update product/item details on Firestore & backend server.
 */
export const updateProductDetails = async (productId: string | number, updatedFields: Partial<Product>) => {
  const fields = { ...updatedFields };
  if (fields.imageUrl) fields.image = fields.imageUrl;
  if (fields.image && !fields.imageUrl) fields.imageUrl = fields.image;

  // Backend server API
  try {
    await fetch(getApiUrl(`/api/products/${productId}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields)
    });
  } catch (err) {
    console.error("Backend updateProductDetails error:", err);
  }

  // Firestore update
  if (isFirebaseAvailable && db && typeof productId === 'string') {
    try {
      const itemRef = doc(db, "items", productId);
      await updateDoc(itemRef, fields).catch(async () => {
        // Fallback to products collection
        const prodRef = doc(db, "products", productId);
        await updateDoc(prodRef, fields);
      });
    } catch (error) {
      console.error("Firestore updateProductDetails error:", error);
    }
  }

  // Local update
  const locals = getLocalProducts();
  const updated = locals.map(p => String(p.id) === String(productId) ? { ...p, ...fields } : p);
  saveLocalProducts(updated);
};

/**
 * Update product/item status on Firestore & backend server.
 */
export const updateProductStatus = async (productId: string | number, newStatus: '나눔중' | '예약중' | '완료' | '무료') => {
  // Backend server API
  try {
    await fetch(getApiUrl(`/api/products/${productId}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });
  } catch (err) {
    console.error("Backend updateProductStatus error:", err);
  }

  // Firestore update
  if (isFirebaseAvailable && db && typeof productId === 'string') {
    try {
      const itemRef = doc(db, "items", productId);
      await updateDoc(itemRef, { status: newStatus }).catch(async () => {
        const prodRef = doc(db, "products", productId);
        await updateDoc(prodRef, { status: newStatus });
      });
    } catch (error) {
      console.error("Firestore updateProductStatus error:", error);
    }
  }

  // Local update
  const locals = getLocalProducts();
  const updated = locals.map(p => String(p.id) === String(productId) ? { ...p, status: newStatus } : p);
  saveLocalProducts(updated);
};

/**
 * Toggle like/favorite of product/item.
 */
export const updateProductLikes = async (productId: string | number, isLiking: boolean) => {
  const incrementVal = isLiking ? 1 : -1;

  // Backend server API
  try {
    await fetch(getApiUrl(`/api/products/${productId}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ likeDelta: incrementVal })
    });
  } catch (err) {
    console.error("Backend updateProductLikes error:", err);
  }

  // Firestore update
  if (isFirebaseAvailable && db) {
    try {
      const idStr = String(productId);
      const itemRef = doc(db, "items", idStr);
      await updateDoc(itemRef, { likes: increment(incrementVal) }).catch(async () => {
        const prodRef = doc(db, "products", idStr);
        await updateDoc(prodRef, { likes: increment(incrementVal) });
      });
    } catch (error) {
      console.error("Firestore updateProductLikes error:", error);
    }
  }

  // Local update
  const locals = getLocalProducts();
  const updated = locals.map(p => String(p.id) === String(productId) ? { ...p, likes: Math.max(0, (p.likes || 0) + incrementVal) } : p);
  saveLocalProducts(updated);
};

/**
 * Increment view count of a product/item.
 */
export const incrementProductViews = async (productId: string | number) => {
  // Backend server API
  try {
    await fetch(getApiUrl(`/api/products/${productId}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ viewDelta: 1 })
    });
  } catch (err) {
    console.error("Backend incrementProductViews error:", err);
  }

  // Firestore update
  if (isFirebaseAvailable && db) {
    try {
      const idStr = String(productId);
      const itemRef = doc(db, "items", idStr);
      await updateDoc(itemRef, { views: increment(1) }).catch(async () => {
        const prodRef = doc(db, "products", idStr);
        await updateDoc(prodRef, { views: increment(1) });
      });
    } catch (error) {
      console.error("Firestore incrementProductViews error:", error);
    }
  }

  // Local update
  const locals = getLocalProducts();
  const updated = locals.map(p => String(p.id) === String(productId) ? { ...p, views: (p.views || 0) + 1 } : p);
  saveLocalProducts(updated);
};

/**
 * Delete product/item from Firestore & backend server.
 */
export const deleteProductFromDb = async (productId: string | number, deleterName?: string) => {
  // Backend server API
  try {
    await fetch(getApiUrl(`/api/products/${productId}`), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deletedBy: deleterName || "사용자" })
    });
  } catch (err) {
    console.error("Backend deleteProductFromDb error:", err);
  }

  // Firestore delete
  if (isFirebaseAvailable && db) {
    try {
      const idStr = String(productId);
      const itemRef = doc(db, "items", idStr);
      await deleteDoc(itemRef).catch(async () => {
        const prodRef = doc(db, "products", idStr);
        await deleteDoc(prodRef);
      });
    } catch (error) {
      console.error("Firestore deleteProductFromDb error:", error);
    }
  }

  // Local delete
  const locals = getLocalProducts();
  const updated = locals.filter(p => String(p.id) !== String(productId));
  saveLocalProducts(updated);
};

// ----------------------------------------
// FIRESTORE CHAT & MESSAGE SYSTEM
// ----------------------------------------

export interface FirestoreChatParticipant {
  username: string;
  name: string;
  location?: string;
  avatarUrl?: string;
}

export interface FirestoreChatMessage {
  id: string;
  senderUsername: string;
  senderName: string;
  text: string;
  imageUrl?: string;
  timestamp: string;
  createdAt: number;
}

export interface FirestoreChatRoom {
  id: string;
  productId?: string;
  productName?: string;
  productPrice?: string;
  productIcon?: string;
  participants: FirestoreChatParticipant[];
  participantUsernames: string[];
  lastMessage?: string;
  lastTime?: string;
  updatedAt: number;
  messages?: FirestoreChatMessage[];
  logs?: string[];
  createdAt?: number;
}

/**
 * Real-time listener for all chat rooms where the given user is a participant.
 */
export const subscribeUserChatRooms = (
  username: string,
  callback: (rooms: FirestoreChatRoom[]) => void
): (() => void) => {
  if (!username) return () => {};
  const cleanUsername = username.trim().toLowerCase();
  const cacheKey = `yeonkeun_user_chat_rooms_${cleanUsername}`;

  let isUnsubscribed = false;
  let unsubscribeFirestore: (() => void) | null = null;
  let cachedRoomsMap = new Map<string, FirestoreChatRoom>();

  // 1. Load from local cache immediately for instant, flicker-free rendering
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        parsed.forEach((r: FirestoreChatRoom) => {
          if (r && r.id) cachedRoomsMap.set(r.id, r);
        });
        callback(Array.from(cachedRoomsMap.values()));
      }
    }
  } catch {}

  const mergeAndNotify = (newRooms: FirestoreChatRoom[]) => {
    if (isUnsubscribed) return;
    newRooms.forEach((r) => {
      if (!r || !r.id) return;
      const existing = cachedRoomsMap.get(r.id);
      if (!existing) {
        cachedRoomsMap.set(r.id, r);
      } else {
        cachedRoomsMap.set(r.id, {
          ...existing,
          ...r,
          participants: r.participants && r.participants.length > 0 ? r.participants : existing.participants,
          participantUsernames: Array.from(new Set([...(existing.participantUsernames || []), ...(r.participantUsernames || [])])),
          messages: (r.messages && r.messages.length >= (existing.messages?.length || 0)) ? r.messages : existing.messages,
          lastMessage: r.lastMessage || existing.lastMessage,
          lastTime: r.lastTime || existing.lastTime,
          updatedAt: Math.max(r.updatedAt || 0, existing.updatedAt || 0)
        });
      }
    });

    const allRooms = Array.from(cachedRoomsMap.values());
    allRooms.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    try {
      localStorage.setItem(cacheKey, JSON.stringify(allRooms));
    } catch {}

    callback(allRooms);
  };

  // 2. 백엔드 보조 조회 (오프라인이거나 별도 VITE_API_URL이 설정된 경우에만 1회성 보조 조회)
  if (!isFirebaseAvailable && API_BASE_URL) {
    const fetchBackendRooms = async () => {
      try {
        const res = await fetch(getApiUrl(`/api/chats?username=${encodeURIComponent(username)}`));
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.rooms)) {
            mergeAndNotify(data.rooms);
          }
        }
      } catch (err) {
        console.warn("Backend chat fetch fallback warning:", err);
      }
    };
    fetchBackendRooms();
  }

  // 3. 순수 Firestore onSnapshot 실시간 리스너 (Vercel 배포에 최적화된 즉각 동기화)
  if (isFirebaseAvailable && db) {
    try {
      const q = query(
        collection(db, "chats"),
        where("participantUsernames", "array-contains", cleanUsername)
      );

      unsubscribeFirestore = onSnapshot(
        q,
        (snapshot) => {
          const rooms: FirestoreChatRoom[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            rooms.push({
              id: docSnap.id,
              productId: data.productId,
              productName: data.productName,
              productPrice: data.productPrice,
              productIcon: data.productIcon,
              participants: data.participants || [],
              participantUsernames: data.participantUsernames || [],
              lastMessage: data.lastMessage || "",
              lastTime: data.lastTime || "방금 전",
              updatedAt: data.updatedAt || 0,
              messages: data.messages || []
            });
          });

          mergeAndNotify(rooms);
        },
        (error) => {
          console.warn("Firestore chat subscription error:", error);
        }
      );
    } catch (e) {
      console.error("Failed to initialize Firestore chat subscriber:", e);
    }
  }

  return () => {
    isUnsubscribed = true;
    if (unsubscribeFirestore) {
      unsubscribeFirestore();
    }
  };
};

/**
 * Format timestamp in Korean Standard Time (KST, Asia/Seoul)
 */
export const formatKoreanChatTime = (date?: Date | number | string): string => {
  if (!date) {
    return new Date().toLocaleTimeString('ko-KR', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }
  if (typeof date === 'number') {
    return new Date(date).toLocaleTimeString('ko-KR', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }
  if (typeof date === 'string') {
    if (date.includes('T') || date.includes('-') || date.includes('Z')) {
      const parsed = new Date(date);
      if (!isNaN(parsed.getTime())) {
        return parsed.toLocaleTimeString('ko-KR', {
          timeZone: 'Asia/Seoul',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      }
    }
    return date;
  }
  return date.toLocaleTimeString('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

/**
 * Real-time listener for messages in a specific chat room.
 */
export const subscribeRoomMessages = (
  roomId: string,
  callback: (messages: FirestoreChatMessage[]) => void
): (() => void) => {
  if (!roomId) return () => {};

  let isUnsubscribed = false;
  let unsubscribeFirestore: (() => void) | null = null;
  let msgMap = new Map<string, FirestoreChatMessage>();

  const emitMessages = () => {
    const list = Array.from(msgMap.values());
    list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    callback(list);
  };

  // 3번 최적화: 순수 Firestore onSnapshot 실시간 리스너 (Vercel 배포 시 404 오류 방지 및 즉각 반영)
  if (isFirebaseAvailable && db) {
    try {
      const messagesRef = collection(db, "chats", roomId, "messages");
      const q = query(messagesRef, orderBy("createdAt", "asc"));

      unsubscribeFirestore = onSnapshot(
        q,
        (snapshot) => {
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const kstTime = data.createdAt ? formatKoreanChatTime(data.createdAt) : formatKoreanChatTime(data.timestamp);
            msgMap.set(docSnap.id, {
              id: docSnap.id,
              senderUsername: data.senderUsername,
              senderName: data.senderName,
              text: data.text || "",
              imageUrl: data.imageUrl,
              timestamp: kstTime,
              createdAt: data.createdAt || Date.now()
            });
          });
          if (!isUnsubscribed) {
            emitMessages();
          }
        },
        (error) => {
          console.warn(`Firestore messages subscription error for room ${roomId}:`, error);
        }
      );
    } catch (e) {
      console.error(`Failed to setup messages subscriber for ${roomId}:`, e);
    }
  } else if (API_BASE_URL) {
    // 오프라인이거나 별도 백엔드 URL이 있을 때만 보조 조회
    const fetchBackendMessages = async () => {
      try {
        const res = await fetch(getApiUrl(`/api/chats`));
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.rooms)) {
            const room = data.rooms.find((r: any) => r.id === roomId);
            if (room && Array.isArray(room.messages)) {
              room.messages.forEach((m: any) => {
                if (m && m.id) {
                  const kstTime = m.createdAt ? formatKoreanChatTime(m.createdAt) : formatKoreanChatTime(m.timestamp);
                  msgMap.set(m.id, { ...m, timestamp: kstTime });
                }
              });
              emitMessages();
            }
          }
        }
      } catch {}
    };
    fetchBackendMessages();
  }

  return () => {
    isUnsubscribed = true;
    if (unsubscribeFirestore) {
      unsubscribeFirestore();
    }
  };
};

/**
 * Get or create a 1:1 chat room in Firestore and sync with backend server.
 */
export const getOrCreateFirestoreChatRoom = async (params: {
  myUsername: string;
  myName: string;
  myLocation?: string;
  myAvatar?: string;
  targetUsername: string;
  targetName: string;
  targetLocation?: string;
  targetAvatar?: string;
  productId?: string;
  productName?: string;
  productPrice?: string;
  productIcon?: string;
  initialMessage?: string;
}): Promise<FirestoreChatRoom> => {
  let cleanMyUsername = params.myUsername.trim().toLowerCase();
  let cleanTargetUsername = params.targetUsername.trim().toLowerCase();

  // 2번 기능: sellerUsername이 비어있거나 가짜 아이디(user_...)인 경우 Firestore users 컬렉션에서 상대방의 진짜 아이디 탐색
  if ((!cleanTargetUsername || cleanTargetUsername.startsWith("user_")) && params.targetName) {
    try {
      const realUsername = await findSellerUsernameFromFirestore(params.targetName, params.targetLocation);
      if (realUsername) {
        cleanTargetUsername = realUsername.trim().toLowerCase();
        params.targetUsername = realUsername.trim();
      }
    } catch {}
  }

  // 1번 문제 해결: 두 참여자의 아이디를 정렬하여 고정된 대화방 ID(Deterministic Room ID) 생성
  // (무작위 난수 생성을 제거하여 누가 어디서 접속하든 언제나 100% 동일한 단 하나의 대화방으로 매칭)
  const sortedUserPair = [cleanMyUsername, cleanTargetUsername].sort().join("__");
  const cleanProdId = params.productId ? String(params.productId).trim() : "chat";
  const deterministicRoomId = `room_${cleanProdId}_${sortedUserPair}`;
  const roomId = deterministicRoomId;

  // 1. Sync with backend API
  let serverRoom: FirestoreChatRoom | null = null;
  try {
    const res = await fetch(getApiUrl("/api/chats/room"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...params,
        roomId: deterministicRoomId
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.room) {
        serverRoom = data.room;
      }
    }
  } catch (err) {
    console.warn("Backend chat room creation error:", err);
  }

  const participants: FirestoreChatParticipant[] = [
    { username: params.myUsername.trim(), name: params.myName.trim(), location: params.myLocation || "기숙사", avatarUrl: params.myAvatar },
    { username: params.targetUsername.trim(), name: params.targetName.trim(), location: params.targetLocation || "기숙사", avatarUrl: params.targetAvatar }
  ];

  // Comprehensive participant usernames list to ensure matching regardless of format
  const participantUsernames = Array.from(new Set([
    cleanMyUsername,
    cleanTargetUsername,
    params.myUsername.trim(),
    params.targetUsername.trim(),
    params.myName.trim(),
    params.targetName.trim(),
    params.myName.trim().toLowerCase(),
    params.targetName.trim().toLowerCase()
  ].filter(Boolean)));

  const nowStr = formatKoreanChatTime();
  const createLogText = `[${nowStr}] 1:1 대화방 개설: @${params.myUsername}(${params.myName}) ↔ @${params.targetUsername}(${params.targetName}) - ${params.productName || "물품"}`;

  const roomData: FirestoreChatRoom = {
    id: roomId,
    productId: params.productId ? String(params.productId) : undefined,
    productName: params.productName || "물품 대화",
    productPrice: params.productPrice || "무료",
    productIcon: params.productIcon || "fa-solid fa-box",
    participants,
    participantUsernames,
    lastMessage: params.initialMessage ? params.initialMessage.trim() : `'${params.productName || "물품"}' 대화를 시작했습니다.`,
    lastTime: "방금 전",
    updatedAt: Date.now(),
    messages: [],
    logs: [createLogText],
    createdAt: Date.now()
  };

  // 2. Persist room in Firestore (내역 및 로그 완벽 기록)
  if (isFirebaseAvailable && db) {
    try {
      const roomRef = doc(db, "chats", roomId);
      const docSnap = await getDoc(roomRef);
      if (!docSnap.exists()) {
        const initialMessagesList: any[] = [];
        if (params.initialMessage && params.initialMessage.trim()) {
          const msgId = `m_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
          const initialMsgObj = {
            id: msgId,
            senderUsername: params.myUsername,
            senderName: params.myName,
            text: params.initialMessage.trim(),
            timestamp: nowStr,
            createdAt: Date.now()
          };
          initialMessagesList.push(initialMsgObj);

          // Subcollection messages에 개별 문서 저장
          const msgDocRef = doc(db, "chats", roomId, "messages", msgId);
          await setDoc(msgDocRef, initialMsgObj);
        }

        // Firestore chats 문서 본문에 대화 내역(messages) 및 생성 로그(logs) 보존
        await setDoc(roomRef, {
          ...roomData,
          messages: initialMessagesList,
          logs: [createLogText],
          createdAt: Date.now()
        }, { merge: true });

        // Firestore chats 하위 logs 서브컬렉션에도 감사 로그 저장
        const logDocRef = doc(db, "chats", roomId, "logs", `log_${Date.now()}`);
        await setDoc(logDocRef, {
          id: `log_${Date.now()}`,
          action: "ROOM_CREATED",
          details: createLogText,
          timestamp: nowStr,
          createdAt: Date.now()
        }).catch(() => {});
      } else {
        // 기존 대화방의 마지막 대화 내역 및 시간 보존
        const existingData = docSnap.data();
        const existingUsernames = existingData.participantUsernames || [];
        const existingMessages = Array.isArray(existingData.messages) ? existingData.messages : [];
        const existingLogs = Array.isArray(existingData.logs) ? existingData.logs : [];
        const accessLogText = `[${nowStr}] 대화방 접속: @${params.myUsername}(${params.myName})`;

        await updateDoc(roomRef, {
          participants,
          participantUsernames: Array.from(new Set([...existingUsernames, ...participantUsernames])),
          updatedAt: Date.now(),
          logs: [...existingLogs.slice(-49), accessLogText]
        });

        // Firestore chats 하위 logs 서브컬렉션에 접속 로그 저장
        const logDocRef = doc(db, "chats", roomId, "logs", `log_${Date.now()}`);
        await setDoc(logDocRef, {
          id: `log_${Date.now()}`,
          action: "ROOM_ACCESSED",
          details: accessLogText,
          timestamp: nowStr,
          createdAt: Date.now()
        }).catch(() => {});

        roomData.lastMessage = existingData.lastMessage || roomData.lastMessage;
        roomData.lastTime = existingData.lastTime || roomData.lastTime;
        roomData.updatedAt = existingData.updatedAt || roomData.updatedAt;
        roomData.messages = existingMessages;
        roomData.logs = [...existingLogs.slice(-49), accessLogText];
      }

      // If initialMessage provided and doc existed, add to subcollection
      if (docSnap.exists() && params.initialMessage && params.initialMessage.trim()) {
        const msgId = `m_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
        const msgDocRef = doc(db, "chats", roomId, "messages", msgId);
        await setDoc(msgDocRef, {
          id: msgId,
          senderUsername: params.myUsername,
          senderName: params.myName,
          text: params.initialMessage.trim(),
          timestamp: nowStr,
          createdAt: Date.now()
        });
      }
    } catch (err) {
      console.error("Firestore chat room save error:", err);
    }
  }

  // 3. Immediately update local storage cache for instant persistence across page/back nav
  try {
    const cacheKey = `yeonkeun_user_chat_rooms_${cleanMyUsername}`;
    const raw = localStorage.getItem(cacheKey);
    const list: FirestoreChatRoom[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter(r => r.id !== roomId);
    filtered.unshift(serverRoom || roomData);
    localStorage.setItem(cacheKey, JSON.stringify(filtered));
  } catch {}

  return serverRoom || roomData;
};

/**
 * Send a message to a chat room in Firestore and backend server.
 */
export const sendFirestoreChatMessage = async (params: {
  roomId: string;
  senderUsername: string;
  senderName: string;
  senderAvatar?: string;
  senderLocation?: string;
  targetUsername?: string;
  targetName?: string;
  targetAvatar?: string;
  targetLocation?: string;
  productName?: string;
  productPrice?: string;
  productIcon?: string;
  text: string;
  imageUrl?: string;
}): Promise<FirestoreChatMessage> => {
  const nowStr = formatKoreanChatTime();
  const messageId = `m_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;

  const messageData: FirestoreChatMessage = {
    id: messageId,
    senderUsername: params.senderUsername,
    senderName: params.senderName,
    text: params.text || "",
    imageUrl: params.imageUrl,
    timestamp: nowStr,
    createdAt: Date.now()
  };

  const displayLastMsg = params.imageUrl 
    ? (params.text ? `📷 ${params.text}` : "📷 사진을 보냈습니다.")
    : params.text;

  const cleanSender = params.senderUsername.trim().toLowerCase();
  const cleanTarget = (params.targetUsername || '').trim().toLowerCase();

  const extraUsernames = [
    cleanSender,
    params.senderUsername.trim(),
    params.senderName.trim(),
    params.senderName.trim().toLowerCase(),
    ...(cleanTarget ? [cleanTarget, params.targetUsername!.trim()] : []),
    ...(params.targetName ? [params.targetName.trim(), params.targetName.trim().toLowerCase()] : [])
  ].filter(Boolean);

  const msgLogText = `[${nowStr}] 메시지: @${params.senderUsername}(${params.senderName}): ${displayLastMsg}`;

  // 1. Save directly to Firestore subcollection & update chat room doc with messages history and logs
  if (isFirebaseAvailable && db) {
    try {
      // Subcollection 'messages'에 개별 메시지 문서 저장
      const messageDocRef = doc(db, "chats", params.roomId, "messages", messageId);
      await setDoc(messageDocRef, messageData);

      // Subcollection 'logs'에 개별 전송 로그 문서 저장
      const logDocRef = doc(db, "chats", params.roomId, "logs", `log_${Date.now()}`);
      await setDoc(logDocRef, {
        id: `log_${Date.now()}`,
        action: "MESSAGE_SENT",
        sender: params.senderUsername,
        senderName: params.senderName,
        text: displayLastMsg,
        timestamp: nowStr,
        createdAt: Date.now()
      }).catch(() => {});

      const roomDocRef = doc(db, "chats", params.roomId);
      const roomSnap = await getDoc(roomDocRef).catch(() => null);

      if (roomSnap && roomSnap.exists()) {
        const data = roomSnap.data();
        const existingPUsernames: string[] = data.participantUsernames || [];
        const existingMessages: any[] = Array.isArray(data.messages) ? data.messages : [];
        const existingLogs: string[] = Array.isArray(data.logs) ? data.logs : [];
        const updatedPUsernames = Array.from(new Set([
          ...existingPUsernames, 
          ...extraUsernames
        ]));

        await updateDoc(roomDocRef, {
          lastMessage: displayLastMsg,
          lastTime: "방금 전",
          updatedAt: Date.now(),
          participantUsernames: updatedPUsernames,
          messages: [...existingMessages.slice(-99), messageData],
          logs: [...existingLogs.slice(-49), msgLogText]
        });
      } else {
        const participants: FirestoreChatParticipant[] = [
          { 
            username: params.senderUsername, 
            name: params.senderName, 
            location: params.senderLocation || "기숙사",
            avatarUrl: params.senderAvatar
          }
        ];
        if (params.targetUsername && params.targetName) {
          participants.push({
            username: params.targetUsername,
            name: params.targetName,
            location: params.targetLocation || "기숙사",
            avatarUrl: params.targetAvatar
          });
        }

        await setDoc(roomDocRef, {
          id: params.roomId,
          productName: params.productName || "물품 대화",
          productPrice: params.productPrice || "무료",
          productIcon: params.productIcon || "fa-solid fa-box",
          lastMessage: displayLastMsg,
          lastTime: "방금 전",
          updatedAt: Date.now(),
          participantUsernames: Array.from(new Set(extraUsernames)),
          participants,
          messages: [messageData],
          logs: [msgLogText],
          createdAt: Date.now()
        }, { merge: true });
      }
    } catch (err) {
      console.error("Firestore message send error:", err);
    }
  }

  // 2. Sync with backend API
  try {
    await fetch(getApiUrl(`/api/chats/${params.roomId}/messages`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        senderUsername: params.senderUsername,
        senderName: params.senderName,
        text: params.text,
        imageUrl: params.imageUrl
      })
    });
  } catch (err) {
    console.warn("Backend chat message sync error:", err);
  }

  // 3. Update local cache immediately
  try {
    const cacheKey = `yeonkeun_user_chat_rooms_${cleanSender}`;
    const raw = localStorage.getItem(cacheKey);
    if (raw) {
      const list: FirestoreChatRoom[] = JSON.parse(raw);
      const idx = list.findIndex(r => r.id === params.roomId);
      if (idx !== -1) {
        list[idx].lastMessage = displayLastMsg;
        list[idx].lastTime = "방금 전";
        list[idx].updatedAt = Date.now();
        list[idx].messages = [...(list[idx].messages || []), messageData];
        localStorage.setItem(cacheKey, JSON.stringify(list));
      }
    }
  } catch {}

  return messageData;
};

/**
 * 2번 기능: sellerUsername이 비어있을 때 Firestore의 users 컬렉션을 조회하여 상대방의 진짜 아이디 탐색
 */
export const findSellerUsernameFromFirestore = async (
  sellerNameRaw: string,
  sellerLocation?: string
): Promise<string | null> => {
  if (!sellerNameRaw) return null;
  // "홍길동 (제1기숙사 A동 302호)" 같은 형태에서 순수 이름 추출
  const cleanName = sellerNameRaw.replace(/\(.*?\)/g, "").trim().toLowerCase();
  if (!cleanName || !isFirebaseAvailable || !db) return null;

  try {
    const snap = await getDocs(collection(db, "users"));
    let candidateUsername: string | null = null;

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (!data || !data.username) return;

      const uName = (data.name || "").trim().toLowerCase();
      const uLoc = (data.location || "").trim().toLowerCase();

      // 1. 이름과 기숙사 위치가 모두 일치하는 경우 우선 확정
      if (sellerLocation && uName === cleanName && uLoc.includes(sellerLocation.trim().toLowerCase())) {
        candidateUsername = data.username.trim();
      }
      // 2. 이름이 일치하는 경우 후보 등록
      else if (!candidateUsername && (uName === cleanName || uName === sellerNameRaw.trim().toLowerCase())) {
        candidateUsername = data.username.trim();
      }
    });

    return candidateUsername;
  } catch (err) {
    console.warn("Firestore findSellerUsername error:", err);
    return null;
  }
};

// ----------------------------------------
// FIRESTORE ALL REGISTERED USERS MANAGEMENT
// ----------------------------------------

export interface FirestoreUserData {
  id: string;
  username: string;
  password?: string;
  name: string;
  location: string;
  role: 'admin' | 'user';
  avatarUrl?: string;
  createdAt: string;
  lastLoginAt?: string;
}

/**
 * Save newly registered or logged-in user profile to Firestore globally
 */
export const saveFirestoreUser = async (user: Partial<FirestoreUserData> & { username: string; password?: string }): Promise<void> => {
  if (!user || !user.username) return;
  const cleanUsername = user.username.trim().toLowerCase();
  
  if (isFirebaseAvailable && db) {
    try {
      const userDocRef = doc(db, "users", cleanUsername);
      const userPayload: any = {
        id: user.id || `user_${Date.now()}`,
        username: user.username.trim(),
        name: user.name ? user.name.trim() : user.username.trim(),
        location: user.location || "제1기숙사 A동 302호",
        role: user.role || (cleanUsername === 'sys_admin_yeonkeun_9842' ? 'admin' : 'user'),
        avatarUrl: user.avatarUrl || '',
        createdAt: user.createdAt || new Date().toISOString(),
        lastLoginAt: user.lastLoginAt || new Date().toISOString()
      };
      if (user.password) {
        userPayload.password = user.password;
      }
      await setDoc(userDocRef, userPayload, { merge: true });
    } catch (err) {
      console.warn("Firestore save user warning:", err);
    }
  }
};

/**
 * Check if a username is available in Firestore (Used when backend API is unavailable)
 */
export const checkUsernameAvailabilityFirestore = async (
  username: string
): Promise<{ available: boolean; message?: string }> => {
  const clean = username.trim().toLowerCase();
  if (!clean) {
    return { available: false, message: '아이디를 입력해주세요.' };
  }
  if (clean === 'sys_admin_yeonkeun_9842' || clean === 'admin') {
    return { available: false, message: '이미 존재하는 관리자 계정 아이디입니다.' };
  }
  if (!isFirebaseAvailable || !db) {
    try {
      const hist = JSON.parse(localStorage.getItem('yeongeun_logged_in_history') || '[]');
      const exists = hist.some((u: any) => u.username?.toLowerCase() === clean);
      return exists
        ? { available: false, message: '이미 사용 중인 아이디입니다.' }
        : { available: true };
    } catch {
      return { available: true };
    }
  }

  try {
    const userDoc = await getDoc(doc(db, "users", clean));
    if (userDoc.exists()) {
      return { available: false, message: '이미 등록된 아이디입니다.' };
    }
    return { available: true };
  } catch (err) {
    console.warn("Firestore check username error:", err);
    return { available: true };
  }
};

/**
 * Direct Login via Firestore (Vercel 및 서버리스 배포 단독 구동 지원)
 */
export const loginFirestoreUser = async (
  usernameInput: string,
  passwordInput: string
): Promise<{ success: boolean; message?: string; user?: any; personalData?: any }> => {
  const clean = usernameInput.trim().toLowerCase();
  
  // 1. 최고 관리자 계정 상시 인증 보장
  if (clean === 'sys_admin_yeonkeun_9842') {
    if (passwordInput === 'YK#DormAdmin!2026$Secure') {
      const adminUser = {
        id: "user_sys_admin_9842",
        username: "sys_admin_yeonkeun_9842",
        password: "YK#DormAdmin!2026$Secure",
        name: "시스템 최고 관리자",
        location: "중앙 기숙사 관리실",
        role: "admin" as const,
        avatarUrl: "https://i.ibb.co/YTTbzcmw/samplepic1.png",
        createdAt: "2026-01-01T00:00:00Z",
        lastLoginAt: new Date().toISOString()
      };
      saveFirestoreUser(adminUser).catch(() => {});
      return {
        success: true,
        user: adminUser,
        personalData: { wishlist: [] }
      };
    } else {
      return {
        success: false,
        message: '최고 관리자 비밀번호가 일치하지 않습니다.'
      };
    }
  }

  // 2. Firestore에서 유저 문서 조회
  if (isFirebaseAvailable && db) {
    try {
      const userRef = doc(db, "users", clean);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const u = userSnap.data();
        if (u.password && u.password !== passwordInput) {
          return {
            success: false,
            message: '비밀번호가 일치하지 않습니다. 다시 확인해주세요.'
          };
        }

        const updatedUser = {
          id: u.id || `user_${clean}`,
          username: u.username || clean,
          name: u.name || clean,
          location: u.location || "제1기숙사 A동 302호",
          role: (u.role || 'user') as 'admin' | 'user',
          avatarUrl: u.avatarUrl || '',
          createdAt: u.createdAt || new Date().toISOString(),
          lastLoginAt: new Date().toISOString()
        };
        await setDoc(userRef, { lastLoginAt: updatedUser.lastLoginAt }, { merge: true }).catch(() => {});

        return {
          success: true,
          user: updatedUser,
          personalData: { wishlist: [] }
        };
      }
    } catch (e) {
      console.warn("Firestore direct login attempt error:", e);
    }
  }

  // 3. 로컬 스토리지 백업 확인
  try {
    const saved = localStorage.getItem('yeongeun_current_user');
    if (saved) {
      const u = JSON.parse(saved);
      if (u.username?.toLowerCase() === clean) {
        if (u.password && u.password !== passwordInput) {
          return { success: false, message: '비밀번호가 일치하지 않습니다.' };
        }
        return {
          success: true,
          user: u,
          personalData: { wishlist: [] }
        };
      }
    }
    const hist = JSON.parse(localStorage.getItem('yeongeun_logged_in_history') || '[]');
    const match = hist.find((h: any) => h.username?.toLowerCase() === clean);
    if (match) {
      if (match.password && match.password !== passwordInput) {
        return { success: false, message: '비밀번호가 일치하지 않습니다.' };
      }
      return {
        success: true,
        user: match,
        personalData: { wishlist: [] }
      };
    }
  } catch {}

  return {
    success: false,
    message: '등록되지 않은 아이디입니다. 회원가입을 먼저 진행해 주세요.'
  };
};

/**
 * Direct Register via Firestore (Vercel 및 서버리스 배포 단독 구동 지원)
 */
export const registerFirestoreUser = async (userData: {
  username: string;
  password: string;
  name: string;
  location: string;
  avatarUrl?: string;
}): Promise<{ success: boolean; message?: string; user?: any }> => {
  const clean = userData.username.trim().toLowerCase();
  
  if (clean === 'sys_admin_yeonkeun_9842') {
    return { success: false, message: '해당 아이디는 예약된 시스템 관리자 계정입니다.' };
  }

  const newUser: FirestoreUserData = {
    id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    username: userData.username.trim(),
    password: userData.password,
    name: userData.name.trim(),
    location: userData.location || "제1기숙사 A동 302호",
    role: 'user',
    avatarUrl: userData.avatarUrl || '',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString()
  };

  if (isFirebaseAvailable && db) {
    try {
      const userRef = doc(db, "users", clean);
      const existing = await getDoc(userRef);
      if (existing.exists()) {
        return { success: false, message: '이미 등록된 아이디입니다.' };
      }
      await setDoc(userRef, newUser);
    } catch (err: any) {
      console.warn("Firestore register user warning:", err);
    }
  }

  return {
    success: true,
    user: newUser
  };
};

/**
 * Fetch all registered and active users from Firestore (users + products sellers + chats participants)
 */
export const getFirestoreUsers = async (): Promise<FirestoreUserData[]> => {
  if (!isFirebaseAvailable || !db) return [];
  try {
    const userMap = new Map<string, FirestoreUserData>();

    // 1. users 컬렉션 직접 조회
    try {
      const snap = await getDocs(collection(db, "users"));
      snap.forEach((d) => {
        const data = d.data();
        if (data && data.username) {
          const clean = data.username.trim().toLowerCase();
          if (!clean.startsWith("testrandomavatar") && data.name !== "테스트유저") {
            userMap.set(clean, {
              id: data.id || d.id,
              username: data.username,
              password: data.password || undefined,
              name: data.name || data.username,
              location: data.location || "제1기숙사 A동 302호",
              role: data.role || (clean === 'sys_admin_yeonkeun_9842' ? 'admin' : 'user'),
              avatarUrl: data.avatarUrl || '',
              createdAt: data.createdAt || new Date().toISOString(),
              lastLoginAt: data.lastLoginAt || data.createdAt || new Date().toISOString()
            });
          }
        }
      });
    } catch {}

    // 2. products 컬렉션에서 판매자 자동 발굴
    try {
      const prodSnap = await getDocs(collection(db, "products"));
      prodSnap.forEach((d) => {
        const p = d.data();
        const sellerUsername = (p.sellerUsername || p.seller || "").trim();
        if (sellerUsername) {
          const clean = sellerUsername.toLowerCase();
          if (!clean.startsWith("testrandomavatar") && p.seller !== "테스트유저") {
            if (!userMap.has(clean)) {
              userMap.set(clean, {
                id: `u_${clean}`,
                username: sellerUsername,
                name: p.seller || sellerUsername,
                location: p.location || "기숙사",
                role: clean === 'sys_admin_yeonkeun_9842' ? 'admin' : 'user',
                avatarUrl: p.sellerAvatar || '',
                createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
                lastLoginAt: new Date().toISOString()
              });
            }
          }
        }
      });
    } catch {}

    // 3. chats 컬렉션에서 참여자 자동 발굴
    try {
      const chatSnap = await getDocs(collection(db, "chats"));
      chatSnap.forEach((d) => {
        const c = d.data();
        if (Array.isArray(c.participants)) {
          c.participants.forEach((p: any) => {
            const uName = (p.username || p.name || "").trim();
            if (uName) {
              const clean = uName.toLowerCase();
              if (!clean.startsWith("testrandomavatar") && p.name !== "테스트유저") {
                if (!userMap.has(clean)) {
                  userMap.set(clean, {
                    id: `u_${clean}`,
                    username: p.username || p.name,
                    name: p.name || p.username,
                    location: p.location || "기숙사",
                    role: clean === 'sys_admin_yeonkeun_9842' ? 'admin' : 'user',
                    avatarUrl: p.avatarUrl || '',
                    createdAt: new Date().toISOString(),
                    lastLoginAt: new Date().toISOString()
                  });
                }
              }
            }
          });
        }
      });
    } catch {}

    return Array.from(userMap.values());
  } catch (err) {
    console.warn("Firestore get users error:", err);
    return [];
  }
};

/**
 * Real-time subscription to all registered users in Firestore
 */
export const subscribeFirestoreUsers = (
  callback: (users: FirestoreUserData[]) => void
): (() => void) => {
  if (!isFirebaseAvailable || !db) return () => {};
  try {
    const unsub = onSnapshot(collection(db, "users"), (snapshot) => {
      const users: FirestoreUserData[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (data && data.username) {
          users.push({
            id: data.id || d.id,
            username: data.username,
            password: data.password || undefined,
            name: data.name || data.username,
            location: data.location || "제1기숙사 A동 302호",
            role: data.role || (data.username === 'sys_admin_yeonkeun_9842' ? 'admin' : 'user'),
            avatarUrl: data.avatarUrl || '',
            createdAt: data.createdAt || new Date().toISOString(),
            lastLoginAt: data.lastLoginAt || data.createdAt || new Date().toISOString()
          });
        }
      });
      callback(users);
    }, (err) => {
      console.warn("Firestore users subscription error:", err);
    });
    return unsub;
  } catch (e) {
    console.warn("Failed to subscribe to Firestore users:", e);
    return () => {};
  }
};

/**
 * Delete a user profile from Firestore
 */
export const deleteFirestoreUser = async (usernameOrId: string): Promise<void> => {
  if (!isFirebaseAvailable || !db || !usernameOrId) return;
  try {
    const clean = usernameOrId.trim().toLowerCase();
    await deleteDoc(doc(db, "users", clean)).catch(() => {});
  } catch (err) {
    console.warn("Firestore delete user error:", err);
  }
};


