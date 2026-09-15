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
  orderBy, 
  increment,
  setDoc,
  getDocFromServer
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
import { getApiUrl, getAssetUrl } from "./utils/api";

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
    const mockNames = [
      "2단 행거 (상태양호)", "LED 책상 스탠드", "전공서적 (컴공)", "미니 탁상 선풍기", "멀티탭 4구 (3m)", "빨래바구니",
      "접이식 2단 원룸 빨래 건조대", "접이식 2단 미니 빨래 건조대", "샤오미 4구 고속 충전 멀티탭 (3m)", "샤오미 4구 고속 충전 멀티탭(3m)"
    ];
    const filtered = parsed.filter(p => 
      !mockNames.some(m => p.name.includes(m) || m.includes(p.name)) && 
      p.id !== "prod_init_001" && 
      p.id !== "prod_init_002"
    );
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
  const defaultUrl = "https://i.ibb.co/PvMGnBvN/upperbanner-png.jpg";
  const localFallbackUrl = "/upperbanner-png.jpg";
  if (!storage) {
    return defaultUrl;
  }

  const eventBannerRef = ref(storage, "banners/upperbanner_v2.jpg");
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
export const getProducts = async (callback: (products: Product[]) => void) => {
  const fetchBackendProducts = async () => {
    try {
      const res = await fetch(getApiUrl("/api/products"));
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.products)) {
          saveLocalProducts(data.products);
          callback(data.products);
          return true;
        }
      }
    } catch (err) {
      console.warn("Backend products fetch warning:", err);
    }
    return false;
  };

  if (isFirebaseAvailable && db) {
    try {
      // Query 'items' collection in Firestore
      const q = query(collection(db, "items"), orderBy("date", "desc"));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
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
          callback(itemsList);
        } else {
          // If items collection is empty, check fallback products collection
          const qProd = query(collection(db, "products"), orderBy("date", "desc"));
          getDocs(qProd).then((prodSnap) => {
            if (!prodSnap.empty) {
              const productsList: Product[] = [];
              prodSnap.forEach((docSnap) => {
                const data = docSnap.data();
                const img = data.imageUrl || data.image || undefined;
                productsList.push({
                  id: docSnap.id,
                  name: data.name,
                  category: data.category,
                  location: data.location,
                  price: data.price,
                  icon: data.icon,
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
              saveLocalProducts(productsList);
              callback(productsList);
            } else {
              fetchBackendProducts().then(success => {
                if (!success) callback(getLocalProducts());
              });
            }
          }).catch(() => {
            fetchBackendProducts();
          });
        }
      }, async (_err) => {
        const success = await fetchBackendProducts();
        if (!success) callback(getLocalProducts());
      });

      return unsubscribe;
    } catch (e) {
      console.error("Firestore error, fallback to backend/localStorage:", e);
    }
  }

  // Initial fetch from backend API
  const success = await fetchBackendProducts();
  if (!success) {
    callback(getLocalProducts());
  }

  // Polling fallback
  const pollInterval = setInterval(() => {
    fetchBackendProducts();
  }, 4000);

  return () => {
    clearInterval(pollInterval);
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

  const payload = {
    ...productData,
    imageUrl: finalImageUrl,
    image: finalImageUrl,
    likes: productData.likes || 0,
    views: productData.views || 0,
    date: productData.date || new Date().toISOString().split('T')[0]
  };

  let createdProduct: Product | null = null;

  // 1. Send to Backend Server API first to ensure image is saved to static /uploads/ if needed
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
        // Keep persistent data URL or remote cloud URL, do not overwrite with ephemeral local /uploads/
        if (createdProduct.imageUrl && !createdProduct.imageUrl.startsWith("/uploads/")) {
          payload.imageUrl = createdProduct.imageUrl;
          payload.image = createdProduct.imageUrl;
        }
      }
    }
  } catch (err) {
    console.error("Backend addProduct error:", err);
  }

  // 2. Save directly to Firestore 'items' collection with safe image URL
  if (isFirebaseAvailable && db) {
    try {
      const docRef = await addDoc(collection(db, "items"), payload);
      // Also write to products collection for cross-compatibility
      try {
        await setDoc(doc(db, "products", docRef.id), payload);
      } catch {}

      if (createdProduct) {
        createdProduct.id = docRef.id;
      } else {
        createdProduct = {
          id: docRef.id,
          ...payload
        };
      }
      console.log("Item saved to Firestore 'items' collection with ID:", docRef.id);
    } catch (error) {
      console.error("Failed to add to Firestore 'items':", error);
    }
  }

  // 3. Fallback if neither API succeeded
  if (!createdProduct) {
    createdProduct = {
      id: `item_${Date.now()}`,
      ...payload
    };
  }

  // Update local storage backup
  const locals = getLocalProducts();
  const updatedLocals = [createdProduct, ...locals.filter(p => p.id !== createdProduct!.id)];
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
  if (isFirebaseAvailable && db && typeof productId === 'string') {
    try {
      const itemRef = doc(db, "items", productId);
      await updateDoc(itemRef, { likes: increment(incrementVal) }).catch(async () => {
        const prodRef = doc(db, "products", productId);
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
  if (isFirebaseAvailable && db && typeof productId === 'string') {
    try {
      const itemRef = doc(db, "items", productId);
      await updateDoc(itemRef, { views: increment(1) }).catch(async () => {
        const prodRef = doc(db, "products", productId);
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
  if (isFirebaseAvailable && db && typeof productId === 'string') {
    try {
      const itemRef = doc(db, "items", productId);
      await deleteDoc(itemRef).catch(async () => {
        const prodRef = doc(db, "products", productId);
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

// -------------------------------------------------------------
// FIRESTORE USER AUTHENTICATION & MEMBERSHIP MANAGEMENT
// -------------------------------------------------------------

export interface FirestoreUser {
  id: string;
  username: string;
  password?: string;
  name: string;
  location: string;
  role: 'admin' | 'user';
  avatarUrl: string;
  createdAt: string;
  lastLoginAt?: string;
}

// Initial admin & sample accounts to guarantee they exist in Firestore
export const DEFAULT_SYSTEM_ACCOUNTS: FirestoreUser[] = [
  {
    id: "user_sys_admin_9842",
    username: "sys_admin_yeonkeun_9842",
    password: "YK#DormAdmin!2026$Secure",
    name: "시스템 최고 관리자",
    location: "제1기숙사 A동 302호",
    role: "admin",
    avatarUrl: "https://i.ibb.co/tTvSdxFv/samplepic2.png",
    createdAt: "2026-01-01T00:00:00.000Z",
    lastLoginAt: new Date().toISOString()
  },
  {
    id: "user_1789468611691_gyoee",
    username: "terry3305",
    password: "1234asdf!!",
    name: "김태인",
    location: "제1기숙사 A동 302호",
    role: "user",
    avatarUrl: "https://i.ibb.co/tTvSdxFv/samplepic2.png",
    createdAt: "2026-09-15T10:36:51.691Z",
    lastLoginAt: new Date().toISOString()
  }
];

/**
 * Automatically seeds default users to Firestore on load
 */
export const seedInitialUsersToFirestore = async () => {
  if (!isFirebaseAvailable || !db) return;
  try {
    for (const acc of DEFAULT_SYSTEM_ACCOUNTS) {
      const userRef = doc(db, "users", acc.username.toLowerCase());
      const existing = await getDoc(userRef);
      if (!existing.exists()) {
        await setDoc(userRef, acc);
      }
    }
  } catch (err) {
    console.warn("Firestore user seeding note:", err);
  }
};

// Trigger background seeding if Firebase is ready
if (isFirebaseAvailable && db) {
  seedInitialUsersToFirestore().catch(() => {});
}

/**
 * Check if a username is available directly in Firestore.
 */
export const checkUsernameInFirestore = async (username: string): Promise<{ available: boolean; message: string }> => {
  const clean = username.trim().toLowerCase();
  if (!clean) {
    return { available: false, message: "아이디를 입력해주세요." };
  }

  // 1. Direct Firestore lookup (instant, resilient across all cloud environments)
  if (isFirebaseAvailable && db) {
    try {
      const userRef = doc(db, "users", clean);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        return { available: false, message: "중복되는 아이디가 존재합니다. 다른 아이디를 입력해주세요." };
      }
      return { available: true, message: "사용 가능한 아이디입니다!" };
    } catch (err) {
      console.warn("Firestore checkUsername warning, falling back to API:", err);
    }
  }

  // 2. Fallback to API if Firestore is not directly reachable
  try {
    const res = await fetch(getApiUrl("/api/auth/check-username"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: clean })
    });
    if (res.ok) {
      const data = await res.json();
      return {
        available: !!data.available,
        message: data.message || (data.available ? "사용 가능한 아이디입니다!" : "중복되는 아이디가 존재합니다.")
      };
    }
  } catch {}

  // 3. Fallback to default local accounts
  const taken = DEFAULT_SYSTEM_ACCOUNTS.some(a => a.username.toLowerCase() === clean);
  return {
    available: !taken,
    message: taken ? "중복되는 아이디가 존재합니다. 다른 아이디를 입력해주세요." : "사용 가능한 아이디입니다!"
  };
};

/**
 * Register a user directly in Firestore.
 */
export const registerUserInFirestore = async (userData: {
  username: string;
  password: string;
  name: string;
  location: string;
  avatarUrl: string;
}): Promise<{ success: boolean; user?: FirestoreUser; message?: string }> => {
  const cleanUsername = userData.username.trim();
  const cleanKey = cleanUsername.toLowerCase();

  const newUser: FirestoreUser = {
    id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    username: cleanUsername,
    password: userData.password,
    name: userData.name.trim(),
    location: userData.location,
    role: "user",
    avatarUrl: userData.avatarUrl,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString()
  };

  // 1. Direct Firestore write
  if (isFirebaseAvailable && db) {
    try {
      const userRef = doc(db, "users", cleanKey);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        return { success: false, message: "이미 사용 중인 아이디입니다." };
      }
      await setDoc(userRef, newUser);
      
      // Also notify backend in background if available
      fetch(getApiUrl("/api/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData)
      }).catch(() => {});

      return { success: true, user: newUser };
    } catch (err: any) {
      console.warn("Firestore register warning, trying backend:", err);
    }
  }

  // 2. Fallback to backend API
  try {
    const res = await fetch(getApiUrl("/api/auth/register"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData)
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, message: err?.message || "회원가입 처리 중 오류가 발생했습니다." };
  }
};

/**
 * Login user directly via Firestore.
 */
export const loginUserInFirestore = async (
  username: string,
  password: string
): Promise<{ success: boolean; user?: FirestoreUser; personalData?: any; message?: string }> => {
  const cleanUsername = username.trim();
  const cleanKey = cleanUsername.toLowerCase();

  // 1. Try Firestore direct authentication
  if (isFirebaseAvailable && db) {
    try {
      const userRef = doc(db, "users", cleanKey);
      let snap = await getDoc(userRef);
      
      // If user not in Firestore yet, check default accounts and seed
      if (!snap.exists()) {
        const defaultAcc = DEFAULT_SYSTEM_ACCOUNTS.find(a => a.username.toLowerCase() === cleanKey);
        if (defaultAcc) {
          await setDoc(userRef, defaultAcc);
          snap = await getDoc(userRef);
        }
      }

      if (snap.exists()) {
        const user = snap.data() as FirestoreUser;
        if (user.password !== password) {
          return { success: false, message: "비밀번호가 일치하지 않습니다." };
        }
        // Update last login
        const now = new Date().toISOString();
        updateDoc(userRef, { lastLoginAt: now }).catch(() => {});
        const safeUser = { ...user, lastLoginAt: now };
        delete (safeUser as any).password;

        // Also notify backend in background if available
        fetch(getApiUrl("/api/auth/login"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password })
        }).catch(() => {});

        return { success: true, user: safeUser };
      } else {
        return { success: false, message: "존재하지 않는 아이디입니다." };
      }
    } catch (err) {
      console.warn("Firestore login failed, trying API fallback:", err);
    }
  }

  // 2. Fallback to API
  try {
    const res = await fetch(getApiUrl("/api/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: cleanUsername, password })
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, message: err?.message || "로그인 처리 중 오류가 발생했습니다." };
  }
};

