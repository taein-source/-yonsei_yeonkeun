import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
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
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([]));
    return [];
  }
  try {
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
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(products));
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

// ----------------------------------------
// FIRESTORE & SERVER API FUNCTIONS
// ----------------------------------------

/**
 * Fetch all items/products from Firestore (realtime subscriber format), or backend/localStorage fallback.
 */
export const getProducts = async (callback: (products: Product[]) => void) => {
  const fetchBackendProducts = async () => {
    try {
      const res = await fetch("/api/products");
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
  const finalImageUrl = productData.imageUrl || productData.image || "";
  const payload = {
    ...productData,
    imageUrl: finalImageUrl,
    image: finalImageUrl,
    likes: productData.likes || 0,
    views: productData.views || 0,
    date: productData.date || new Date().toISOString().split('T')[0]
  };

  let createdProduct: Product | null = null;

  // 1. Save directly to Firestore 'items' collection
  if (isFirebaseAvailable && db) {
    try {
      const docRef = await addDoc(collection(db, "items"), payload);
      // Also write to products collection for cross-compatibility
      try {
        await setDoc(doc(db, "products", docRef.id), payload);
      } catch {}

      createdProduct = {
        id: docRef.id,
        ...payload
      };
      console.log("Item saved to Firestore 'items' collection with ID:", docRef.id);
    } catch (error) {
      console.error("Failed to add to Firestore 'items':", error);
    }
  }

  // 2. Send to Backend Server API
  try {
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.product && !createdProduct) {
        createdProduct = data.product;
      }
    }
  } catch (err) {
    console.error("Backend addProduct error:", err);
  }

  // Fallback if neither API succeeded
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
    await fetch(`/api/products/${productId}`, {
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
    await fetch(`/api/products/${productId}`, {
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
    await fetch(`/api/products/${productId}`, {
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
    await fetch(`/api/products/${productId}`, {
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
    await fetch(`/api/products/${productId}`, {
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
