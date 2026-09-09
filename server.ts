import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

// User Auth, Access Log & Data Persistence Interfaces
export interface UserAccount {
  id: string;
  username: string;
  password: string; // In production, hash with bcrypt
  name: string;
  location: string;
  role: 'admin' | 'user';
  avatarUrl?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface AccessLog {
  id: string;
  userId: string;
  username: string;
  name: string;
  role: string;
  action: 'LOGIN' | 'REGISTER' | 'LOGOUT' | 'PRODUCT_CREATE' | 'PURCHASE' | 'WISH_TOGGLE' | 'ADMIN_ACCESS';
  details: string;
  ip: string;
  userAgent: string;
  timestamp: string;
}

export interface UserPersonalData {
  userId: string;
  wishlist: (string | number)[];
  purchasedProductIds: (string | number)[];
  createdProductIds: (string | number)[];
  chatHistorySummary?: string[];
}

export interface ServerProduct {
  id: string;
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

export interface ServerChatMessage {
  id: string;
  senderUsername: string;
  senderName: string;
  text: string;
  timestamp: string;
  createdAt: number;
  imageUrl?: string;
}

export interface ServerChatRoom {
  id: string;
  productId?: string;
  productName: string;
  productPrice: string;
  productIcon: string;
  participants: {
    username: string;
    name: string;
    location: string;
    avatarUrl: string;
  }[];
  lastMessage: string;
  lastTime: string;
  updatedAt: number;
  messages: ServerChatMessage[];
}

// In-Memory Data Stores with File Persistence Fallback
const DATA_DIR = path.join(process.cwd(), ".data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const USERS_FILE = path.join(DATA_DIR, "users.json");
const LOGS_FILE = path.join(DATA_DIR, "access_logs.json");
const USER_DATA_FILE = path.join(DATA_DIR, "user_data.json");
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");
const CHATS_FILE = path.join(DATA_DIR, "chats.json");

const DEFAULT_AVATAR = "https://i.ibb.co/YTTbzcmw/samplepic1.png";

const SAMPLE_AVATARS = [
  "https://i.ibb.co/YTTbzcmw/samplepic1.png",
  "https://i.ibb.co/tTvSdxFv/samplepic2.png",
  "https://i.ibb.co/1Yz4gjmW/samplepic3.png",
  "https://i.ibb.co/JWYbcYfL/samplepic4.png",
  "https://i.ibb.co/PzY20pv0/samplepic5.png"
];

function getRandomAvatar(): string {
  const randomIndex = Math.floor(Math.random() * SAMPLE_AVATARS.length);
  return SAMPLE_AVATARS[randomIndex];
}

const SYSTEM_ADMIN_AVATAR = DEFAULT_AVATAR;

const SYSTEM_ADMIN_ACCOUNT: UserAccount = {
  id: "user_sys_admin_9842",
  username: "sys_admin_yeonkeun_9842",
  password: "YK#DormAdmin!2026$Secure",
  name: "시스템 최고 관리자",
  location: "중앙 기숙사 관리실",
  role: "admin",
  avatarUrl: SYSTEM_ADMIN_AVATAR,
  createdAt: new Date("2026-01-01T00:00:00Z").toISOString(),
  lastLoginAt: new Date().toISOString()
};

// Helper functions for reading/writing persistence files
function loadJSON<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      if (data && data.trim().length > 0) {
        return JSON.parse(data);
      }
    }
  } catch (err) {
    console.error(`Failed to load ${filePath}:`, err);
  }
  return fallback;
}

function saveJSON<T>(filePath: string, data: T) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tempPath = `${filePath}.${Date.now()}_${Math.random().toString(36).substring(2, 6)}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    console.error(`Failed to save ${filePath}:`, err);
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (directErr) {
      console.error(`Direct fallback write failed for ${filePath}:`, directErr);
    }
  }
}

// Initialize Stores
let usersStore: UserAccount[] = loadJSON(USERS_FILE, [SYSTEM_ADMIN_ACCOUNT]);
// Clean up test users if present
usersStore = usersStore.filter(u => 
  !u.username.startsWith("testrandomavatar") && 
  u.name !== "테스트유저" && 
  u.name !== "테스트유저3"
);
saveJSON(USERS_FILE, usersStore);

// Ensure system admin is always present with correct credentials
const adminIdx = usersStore.findIndex(u => u.username === SYSTEM_ADMIN_ACCOUNT.username);
if (adminIdx === -1) {
  usersStore.unshift(SYSTEM_ADMIN_ACCOUNT);
  saveJSON(USERS_FILE, usersStore);
} else {
  // Ensure credentials match user prompt exactly
  usersStore[adminIdx].password = SYSTEM_ADMIN_ACCOUNT.password;
  usersStore[adminIdx].role = "admin";
  saveJSON(USERS_FILE, usersStore);
}

let accessLogsStore: AccessLog[] = loadJSON(LOGS_FILE, [
  {
    id: "log_init_001",
    userId: SYSTEM_ADMIN_ACCOUNT.id,
    username: SYSTEM_ADMIN_ACCOUNT.username,
    name: SYSTEM_ADMIN_ACCOUNT.name,
    role: "admin",
    action: "LOGIN",
    details: "연근마켓 백엔드 최고 관리자 가동 및 통합 서버 초기화 완료",
    ip: "127.0.0.1",
    userAgent: "System Server Engine",
    timestamp: new Date().toISOString()
  }
]);

let userDataStore: Record<string, UserPersonalData> = loadJSON(USER_DATA_FILE, {});

const DEFAULT_PRODUCTS: ServerProduct[] = [];

let productsStore: ServerProduct[] = loadJSON(PRODUCTS_FILE, DEFAULT_PRODUCTS);
// Remove drying rack and multi-tap if present
productsStore = productsStore.filter(p => 
  p.id !== "prod_init_001" && 
  p.id !== "prod_init_002" && 
  !p.name.includes("건조대") && 
  !p.name.includes("멀티탭")
);
saveJSON(PRODUCTS_FILE, productsStore);

let chatRoomsStore: ServerChatRoom[] = loadJSON(CHATS_FILE, []);
if (!fs.existsSync(CHATS_FILE)) {
  saveJSON(CHATS_FILE, chatRoomsStore);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON request body parser with larger limit for base64 images
  app.use(express.json({ limit: "15mb" }));

  // Static files for avatar PNGs
  app.use("/avatars", express.static(path.join(process.cwd(), "public/avatars")));

  // Health check route
  app.get("/api/health", (_req, res) => {
    res.json({ 
      status: "ok", 
      message: "연근마켓 backend running",
      registeredUsersCount: usersStore.length,
      totalAccessLogs: accessLogsStore.length
    });
  });

  // -------------------------------------------------------------
  // AUTHENTICATION & USER MANAGEMENT API ROUTES
  // -------------------------------------------------------------

  // 0. 아이디 중복 확인 API
  app.post("/api/auth/check-username", (req, res) => {
    try {
      let { username } = req.body;
      if (!username || typeof username !== "string") {
        return res.status(400).json({ success: false, available: false, message: "아이디를 입력해주세요." });
      }

      if (/\s/.test(username)) {
        return res.status(400).json({ success: false, available: false, message: "아이디에 띄어쓰기를 포함할 수 없습니다." });
      }

      const cleanUsername = username.trim().toLowerCase();
      const existingUser = usersStore.find(u => u.username.trim().toLowerCase() === cleanUsername);

      if (existingUser) {
        return res.json({ 
          success: true, 
          available: false, 
          message: "중복되는 아이디가 존재합니다. 다른 아이디를 입력해주세요." 
        });
      }

      return res.json({ 
        success: true, 
        available: true, 
        message: "사용 가능한 아이디입니다!" 
      });
    } catch (err) {
      return res.status(500).json({ success: false, available: false, message: "아이디 중복 확인 중 오류가 발생했습니다." });
    }
  });

  // 1. 회원가입 API
  app.post("/api/auth/register", (req, res) => {
    try {
      let { username, password, name, location, avatarUrl } = req.body;

      if (!username || !password || !name) {
        return res.status(400).json({ success: false, message: "아이디, 비밀번호, 이름을 모두 입력해주세요." });
      }

      // 띄어쓰기 금지 검서
      if (/\s/.test(username) || /\s/.test(password)) {
        return res.status(400).json({ success: false, message: "아이디와 비밀번호에는 띄어쓰기(공백)를 사용할 수 없습니다." });
      }

      const cleanUsername = username.trim();
      const cleanPassword = password.trim();

      // 비밀번호 보안 조건 검사 (9자 이상, 영문 + 특수문자 필수)
      if (cleanPassword.length < 9) {
        return res.status(400).json({ success: false, message: "비밀번호는 최소 9자 이상이어야 합니다." });
      }

      const hasLetter = /[a-zA-Z]/.test(cleanPassword);
      const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(cleanPassword);

      if (!hasLetter || !hasSpecialChar) {
        return res.status(400).json({ 
          success: false, 
          message: "비밀번호는 영문자와 특수기호(!, @, #, $, % 등)를 무조건 포함해야 합니다." 
        });
      }

      // 아이디 중복 검사
      const existingUser = usersStore.find(u => u.username.trim().toLowerCase() === cleanUsername.toLowerCase());
      if (existingUser) {
        return res.status(409).json({ success: false, message: "중복되는 아이디가 존재합니다. 다른 아이디로 변경 후 가입해주세요." });
      }

      const assignedAvatar = (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.trim()) 
        ? avatarUrl.trim() 
        : getRandomAvatar();

      const newUser: UserAccount = {
        id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        username: cleanUsername,
        password: cleanPassword,
        name: name.trim(),
        location: location || "제1기숙사 A동 302호",
        role: cleanUsername === SYSTEM_ADMIN_ACCOUNT.username ? "admin" : "user",
        avatarUrl: assignedAvatar,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      };

      usersStore.push(newUser);
      saveJSON(USERS_FILE, usersStore);

      // 접속 로그 추가
      const registerLog: AccessLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        userId: newUser.id,
        username: newUser.username,
        name: newUser.name,
        role: newUser.role,
        action: "REGISTER",
        details: `신규 회원가입 완료 (${newUser.location})`,
        ip: req.ip || "127.0.0.1",
        userAgent: req.headers["user-agent"] || "Web Browser",
        timestamp: new Date().toISOString()
      };
      accessLogsStore.unshift(registerLog);
      saveJSON(LOGS_FILE, accessLogsStore);

      const { password: _, ...safeUser } = newUser;
      return res.json({
        success: true,
        message: "회원가입이 성공적으로 완료되었습니다!",
        user: safeUser
      });
    } catch (err: any) {
      console.error("Register Error:", err);
      return res.status(500).json({ success: false, message: "회원가입 처리 중 오류가 발생했습니다." });
    }
  });

  // 2. 로그인 API
  app.post("/api/auth/login", (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ success: false, message: "아이디와 비밀번호를 입력해주세요." });
      }

      const user = usersStore.find(
        u => u.username.trim().toLowerCase() === username.trim().toLowerCase()
      );

      if (!user || user.password !== password.trim()) {
        return res.status(401).json({ success: false, message: "아이디 또는 비밀번호가 올바르지 않습니다." });
      }

      // 로그인 성공 -> lastLoginAt 갱신
      user.lastLoginAt = new Date().toISOString();
      saveJSON(USERS_FILE, usersStore);

      // 로그인 접속 기록 로그 추가
      const loginLog: AccessLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        userId: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        action: "LOGIN",
        details: user.role === 'admin' ? "최고 관리자 권한으로 시스템 로그인" : "기숙사 메이트 회원 로그인",
        ip: req.ip || "127.0.0.1",
        userAgent: req.headers["user-agent"] || "Web Browser",
        timestamp: new Date().toISOString()
      };
      accessLogsStore.unshift(loginLog);
      saveJSON(LOGS_FILE, accessLogsStore);

      // 유저의 개인화 데이터 불러오기
      const personalData = userDataStore[user.id] || {
        userId: user.id,
        wishlist: [],
        purchasedProductIds: [],
        createdProductIds: [],
        chatHistorySummary: []
      };

      const { password: _, ...safeUser } = user;
      return res.json({
        success: true,
        message: `${user.name}님, 환영합니다!`,
        user: safeUser,
        personalData
      });
    } catch (err: any) {
      console.error("Login Error:", err);
      return res.status(500).json({ success: false, message: "로그인 처리 중 오류가 발생했습니다." });
    }
  });

  // 3. 로그아웃 API
  app.post("/api/auth/logout", (req, res) => {
    try {
      const { userId, username, name, role } = req.body;
      if (userId) {
        const logoutLog: AccessLog = {
          id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          userId: userId || "guest",
          username: username || "guest",
          name: name || "손님",
          role: role || "user",
          action: "LOGOUT",
          details: "안전하게 로그아웃 완료",
          ip: req.ip || "127.0.0.1",
          userAgent: req.headers["user-agent"] || "Web Browser",
          timestamp: new Date().toISOString()
        };
        accessLogsStore.unshift(logoutLog);
        saveJSON(LOGS_FILE, accessLogsStore);
      }
      return res.json({ success: true, message: "로그아웃 되었습니다." });
    } catch (err) {
      return res.status(500).json({ success: false, message: "로그아웃 처리 실패" });
    }
  });

  // 4. 접속 로그 조회 API
  app.get("/api/logs", (req, res) => {
    const { userId, limit = "100" } = req.query;
    let logs = accessLogsStore;
    if (userId) {
      logs = logs.filter(l => l.userId === userId);
    }
    const max = parseInt(limit as string, 10) || 100;
    return res.json({
      success: true,
      logs: logs.slice(0, max)
    });
  });

  // 5. 활동 로그 기록 생성 API
  app.post("/api/logs/action", (req, res) => {
    try {
      const { userId, username, name, role, action, details } = req.body;
      if (!action) {
        return res.status(400).json({ success: false, message: "action 정보가 필요합니다." });
      }

      const newLog: AccessLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        userId: userId || "guest",
        username: username || "guest",
        name: name || "손님",
        role: role || "user",
        action: action as any,
        details: details || "활동 실행",
        ip: req.ip || "127.0.0.1",
        userAgent: req.headers["user-agent"] || "Web Browser",
        timestamp: new Date().toISOString()
      };

      accessLogsStore.unshift(newLog);
      saveJSON(LOGS_FILE, accessLogsStore);

      return res.json({ success: true, log: newLog });
    } catch (err) {
      return res.status(500).json({ success: false, message: "로그 기록 실패" });
    }
  });

  // 6. 회원 목록 조회 (관리자 전용)
  app.get("/api/users", (_req, res) => {
    const safeUsers = usersStore
      .filter(u => !u.username.startsWith("testrandomavatar") && u.name !== "테스트유저" && u.name !== "테스트유저3")
      .map(({ password, ...u }) => u);
    return res.json({
      success: true,
      users: safeUsers
    });
  });

  // 6-1. 회원 탈퇴/삭제 API (관리자 전용)
  app.delete("/api/users/:id", (req, res) => {
    try {
      const { id } = req.params;
      usersStore = usersStore.filter(u => u.id !== id && u.username !== id);
      saveJSON(USERS_FILE, usersStore);
      return res.json({ success: true, message: "회원이 삭제되었습니다." });
    } catch (err) {
      return res.status(500).json({ success: false, message: "회원 삭제 실패" });
    }
  });

  // 7. 사용자 데이터 동기화
  app.post("/api/user/sync", (req, res) => {
    try {
      const { userId, wishlist, purchasedProductIds, createdProductIds } = req.body;
      if (!userId) {
        return res.status(400).json({ success: false, message: "userId가 필요합니다." });
      }

      userDataStore[userId] = {
        userId,
        wishlist: wishlist || [],
        purchasedProductIds: purchasedProductIds || [],
        createdProductIds: createdProductIds || [],
      };

      saveJSON(USER_DATA_FILE, userDataStore);
      return res.json({ success: true, personalData: userDataStore[userId] });
    } catch (err) {
      return res.status(500).json({ success: false, message: "유저 데이터 동기화 실패" });
    }
  });

  // 8. 사용자 프로필 수정 API (이름, 위치, 역할, 아바타 영구 보관)
  app.post("/api/user/profile", (req, res) => {
    try {
      const { username, name, location, role, avatarUrl } = req.body;
      if (!username) {
        return res.status(400).json({ success: false, message: "username이 필요합니다." });
      }

      const userIdx = usersStore.findIndex(
        u => u.username.trim().toLowerCase() === String(username).trim().toLowerCase()
      );

      if (userIdx !== -1) {
        if (name) usersStore[userIdx].name = name.trim();
        if (location) usersStore[userIdx].location = location.trim();
        if (role) usersStore[userIdx].role = role;
        if (avatarUrl) usersStore[userIdx].avatarUrl = avatarUrl;
        saveJSON(USERS_FILE, usersStore);

        // 대화방 내 프로필 정보도 동기화
        let chatUpdated = false;
        chatRoomsStore.forEach(room => {
          room.participants.forEach(p => {
            if (p.username && p.username.trim().toLowerCase() === String(username).trim().toLowerCase()) {
              if (name) p.name = name.trim();
              if (location) p.location = location.trim();
              if (avatarUrl) p.avatarUrl = avatarUrl;
              chatUpdated = true;
            }
          });
        });
        if (chatUpdated) {
          saveJSON(CHATS_FILE, chatRoomsStore);
        }

        const { password: _, ...safeUser } = usersStore[userIdx];
        return res.json({ success: true, user: safeUser, message: "프로필이 업데이트되었습니다." });
      }

      return res.status(404).json({ success: false, message: "사용자를 찾을 수 없습니다." });
    } catch (err) {
      console.error("Profile update error:", err);
      return res.status(500).json({ success: false, message: "프로필 업데이트 실패" });
    }
  });

  // -------------------------------------------------------------
  // PRODUCT MANAGEMENT API ROUTES (SHARED ACROSS ALL ACCOUNTS & DEVICES)
  // -------------------------------------------------------------

  // 1. 전체 물품 목록 조회 API
  app.get("/api/products", (_req, res) => {
    return res.json({
      success: true,
      products: productsStore
    });
  });

  // 2. 물품 등록 API
  app.post("/api/products", (req, res) => {
    try {
      const { name, category, location, price, icon, imageUrl, image, status, seller, sellerUsername, description, tags, likes, views } = req.body;
      if (!name) {
        return res.status(400).json({ success: false, message: "물품 이름이 필요합니다." });
      }

      const finalImg = imageUrl || image || undefined;

      const newProduct: ServerProduct = {
        id: `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: name.trim(),
        category: category || "기타",
        location: location || "A동 로비",
        price: price || "무료 나눔",
        icon: icon || "fa-solid fa-box",
        imageUrl: finalImg,
        image: finalImg,
        status: status || "나눔중",
        date: new Date().toISOString().split('T')[0],
        seller: seller || "기숙사 메이트",
        sellerUsername: sellerUsername || undefined,
        description: description || "기숙사 메이트와 함께 나누는 깨끗한 물품입니다.",
        tags: Array.isArray(tags) ? tags : undefined,
        likes: likes || 0,
        views: views || 0
      };

      productsStore.unshift(newProduct);
      saveJSON(PRODUCTS_FILE, productsStore);

      // 접속/활동 로그 기록
      const prodLog: AccessLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        userId: "user_product_create",
        username: seller || "user",
        name: seller || "회원",
        role: "user",
        action: "PRODUCT_CREATE",
        details: `신규 물품 등록 완료: [${newProduct.name}] (${newProduct.price})`,
        ip: req.ip || "127.0.0.1",
        userAgent: req.headers["user-agent"] || "Web Browser",
        timestamp: new Date().toISOString()
      };
      accessLogsStore.unshift(prodLog);
      saveJSON(LOGS_FILE, accessLogsStore);

      return res.json({ success: true, product: newProduct });
    } catch (err) {
      console.error("Product Create Error:", err);
      return res.status(500).json({ success: false, message: "물품 등록 중 오류가 발생했습니다." });
    }
  });

  // 3. 물품 수정 및 상태/좋아요/조회수 변경 API
  app.put("/api/products/:id", (req, res) => {
    try {
      const { id } = req.params;
      const { status, likes, views, likeDelta, viewDelta, ...otherFields } = req.body;

      const prodIndex = productsStore.findIndex(p => String(p.id) === String(id));
      if (prodIndex === -1) {
        return res.status(404).json({ success: false, message: "해당 물품을 찾을 수 없습니다." });
      }

      const prod = productsStore[prodIndex];
      if (status !== undefined) prod.status = status;
      if (likes !== undefined) prod.likes = likes;
      if (views !== undefined) prod.views = views;
      if (typeof likeDelta === 'number') prod.likes = Math.max(0, (prod.likes || 0) + likeDelta);
      if (typeof viewDelta === 'number') prod.views = (prod.views || 0) + viewDelta;

      Object.assign(prod, otherFields);
      if (otherFields.imageUrl) prod.image = otherFields.imageUrl;
      if (otherFields.image && !otherFields.imageUrl) prod.imageUrl = otherFields.image;

      productsStore[prodIndex] = prod;
      saveJSON(PRODUCTS_FILE, productsStore);

      return res.json({ success: true, product: prod });
    } catch (err) {
      return res.status(500).json({ success: false, message: "물품 정보 수정 실패" });
    }
  });

  // 4. 물품 삭제 API
  app.delete("/api/products/:id", (req, res) => {
    try {
      const { id } = req.params;
      const targetProd = productsStore.find(p => String(p.id) === String(id));
      const deleter = (req.body?.deletedBy || req.query?.deletedBy || "사용자");

      if (targetProd) {
        const prodLog: AccessLog = {
          id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          userId: String(deleter),
          username: String(deleter),
          name: String(deleter),
          role: "user",
          action: "PRODUCT_DELETE" as any,
          details: `물품 삭제 완료: [${targetProd.name}] (카테고리: ${targetProd.category || '기타'}, 가격: ${targetProd.price || '0원'}, 등록자: ${targetProd.seller || '익명'}, 삭제자: ${deleter})`,
          ip: req.ip || "127.0.0.1",
          userAgent: req.headers["user-agent"] || "Web Browser",
          timestamp: new Date().toISOString()
        };
        accessLogsStore.unshift(prodLog);
        saveJSON(LOGS_FILE, accessLogsStore);
      }

      productsStore = productsStore.filter(p => String(p.id) !== String(id));
      saveJSON(PRODUCTS_FILE, productsStore);
      return res.json({ success: true, message: "물품이 삭제되었습니다." });
    } catch (err) {
      return res.status(500).json({ success: false, message: "물품 삭제 실패" });
    }
  });

  // -------------------------------------------------------------
  // REAL-TIME MULTI-ACCOUNT CHAT API ROUTES
  // -------------------------------------------------------------

  // 1. 내 대화방 목록 조회 (상대방 최신 프로필 사진 및 정보 실시간 동기화)
  app.get("/api/chats", (req, res) => {
    try {
      const queryUsername = (req.query.username as string || "").trim().toLowerCase();
      const queryName = (req.query.name as string || "").trim();

      if (!queryUsername && !queryName) {
        return res.json({ success: true, rooms: [] });
      }

      // 내 계정이 참여중인 대화방 검색
      const userRooms = chatRoomsStore.filter(room => {
        return room.participants.some(p => {
          const pUsername = (p.username || "").trim().toLowerCase();
          const pName = (p.name || "").trim();
          return (queryUsername && pUsername === queryUsername) ||
                 (queryName && (pName.includes(queryName) || queryName.includes(pName)));
        });
      });

      // 상대방 프로필 사진/정보를 usersStore 최신 데이터로 실시간 갱신
      const refreshedRooms = userRooms.map(room => {
        const updatedParticipants = room.participants.map(p => {
          const liveUser = usersStore.find(u => {
            const uUsername = (u.username || "").trim().toLowerCase();
            const uName = (u.name || "").trim();
            const pUsername = (p.username || "").trim().toLowerCase();
            const pName = (p.name || "").trim();

            if (pUsername && uUsername === pUsername) return true;
            if (pName && (uName.includes(pName) || pName.includes(uName))) return true;
            return false;
          });

          if (liveUser) {
            return {
              ...p,
              username: liveUser.username,
              name: liveUser.name,
              location: liveUser.location || p.location,
              avatarUrl: liveUser.avatarUrl || p.avatarUrl
            };
          }
          return p;
        });

        return {
          ...room,
          participants: updatedParticipants
        };
      });

      // 최신 업데이트 순 정렬
      refreshedRooms.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

      return res.json({ success: true, rooms: refreshedRooms });
    } catch (err) {
      console.error("Get chats error:", err);
      return res.status(500).json({ success: false, message: "대화 목록 조회 실패" });
    }
  });

  // 2. 1:1 대화방 생성 또는 기존 대화방 조회
  app.post("/api/chats/room", (req, res) => {
    try {
      const {
        myUsername, myName, myLocation, myAvatar,
        targetUsername, targetName, targetLocation, targetAvatar,
        productId, productName, productPrice, productIcon,
        initialMessage
      } = req.body;

      // 상대방 유저 정보 usersStore 조회
      const targetUser = usersStore.find(u => {
        const uUsername = (u.username || "").trim().toLowerCase();
        const uName = (u.name || "").trim();
        if (targetUsername && uUsername === targetUsername.trim().toLowerCase()) return true;
        if (targetName && (uName.includes(targetName.trim()) || targetName.trim().includes(uName))) return true;
        return false;
      });

      const resTargetUsername = targetUser?.username || targetUsername || `user_${Date.now()}`;
      const resTargetName = targetUser?.name || targetName || "기숙사 메이트";
      const resTargetLocation = targetUser?.location || targetLocation || "기숙사";
      const resTargetAvatar = targetUser?.avatarUrl || targetAvatar || SYSTEM_ADMIN_AVATAR;

      // 내 유저 정보 usersStore 조회
      const myUser = usersStore.find(u => {
        const uUsername = (u.username || "").trim().toLowerCase();
        return myUsername && uUsername === myUsername.trim().toLowerCase();
      });

      const resMyUsername = myUser?.username || myUsername || "guest";
      const resMyName = myUser?.name || myName || "나";
      const resMyLocation = myUser?.location || myLocation || "기숙사";
      const resMyAvatar = myUser?.avatarUrl || myAvatar || SYSTEM_ADMIN_AVATAR;

      // 기존 동일한 대화 상대와의 대화방이 존재하는지 검색
      let existingRoom = chatRoomsStore.find(room => {
        const hasMe = room.participants.some(p => 
          (p.username && p.username.trim().toLowerCase() === resMyUsername.trim().toLowerCase()) ||
          (p.name && p.name.trim() === resMyName.trim())
        );
        const hasTarget = room.participants.some(p => 
          (p.username && p.username.trim().toLowerCase() === resTargetUsername.trim().toLowerCase()) ||
          (p.name && (p.name.trim().includes(resTargetName.trim()) || resTargetName.trim().includes(p.name.trim())))
        );
        const sameProduct = !productId || room.productId === productId || room.productName === productName;
        return hasMe && hasTarget && sameProduct;
      });

      if (existingRoom) {
        // 최신 프로필 정보 업데이트
        existingRoom.participants = [
          { username: resMyUsername, name: resMyName, location: resMyLocation, avatarUrl: resMyAvatar },
          { username: resTargetUsername, name: resTargetName, location: resTargetLocation, avatarUrl: resTargetAvatar }
        ];
        saveJSON(CHATS_FILE, chatRoomsStore);
        return res.json({ success: true, room: existingRoom });
      }

      const nowStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      const roomId = `room_${productId || Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const initialMsgs: ServerChatMessage[] = [];
      if (initialMessage && initialMessage.trim()) {
        initialMsgs.push({
          id: `m_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          senderUsername: resMyUsername,
          senderName: resMyName,
          text: initialMessage.trim(),
          timestamp: nowStr,
          createdAt: Date.now()
        });
      }

      const newRoom: ServerChatRoom = {
        id: roomId,
        productId: productId || undefined,
        productName: productName || "물품 대화",
        productPrice: productPrice || "무료",
        productIcon: productIcon || "fa-solid fa-box",
        participants: [
          { username: resMyUsername, name: resMyName, location: resMyLocation, avatarUrl: resMyAvatar },
          { username: resTargetUsername, name: resTargetName, location: resTargetLocation, avatarUrl: resTargetAvatar }
        ],
        lastMessage: initialMessage ? initialMessage.trim() : `'${productName}' 대화를 시작했습니다.`,
        lastTime: '방금 전',
        updatedAt: Date.now(),
        messages: initialMsgs
      };

      chatRoomsStore.unshift(newRoom);
      saveJSON(CHATS_FILE, chatRoomsStore);

      // 활동 로그 기록
      const chatLog: AccessLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        userId: resMyUsername,
        username: resMyUsername,
        name: resMyName,
        role: "user",
        action: "CHAT_ROOM_CREATE" as any,
        details: `1:1 대화방 생성: [${resMyName}] ↔ [${resTargetName}] (${productName || '물품 대화'})`,
        ip: req.ip || "127.0.0.1",
        userAgent: req.headers["user-agent"] || "Web Browser",
        timestamp: new Date().toISOString()
      };
      accessLogsStore.unshift(chatLog);
      saveJSON(LOGS_FILE, accessLogsStore);

      return res.json({ success: true, room: newRoom });
    } catch (err) {
      console.error("Create chat room error:", err);
      return res.status(500).json({ success: false, message: "대화방 생성 실패" });
    }
  });

  // 3. 메시지 전송 API (자동 답장 완전 제거, 오직 실제 계정 간 대화 전송)
  app.post("/api/chats/:roomId/messages", (req, res) => {
    try {
      const { roomId } = req.params;
      const { senderUsername, senderName, text, imageUrl } = req.body;

      if ((!text || !text.trim()) && !imageUrl) {
        return res.status(400).json({ success: false, message: "메시지 내용이나 사진을 입력하세요." });
      }

      const roomIndex = chatRoomsStore.findIndex(r => r.id === roomId);
      if (roomIndex === -1) {
        return res.status(404).json({ success: false, message: "대화방을 찾을 수 없습니다." });
      }

      const room = chatRoomsStore[roomIndex];
      const nowStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

      const newMsg: ServerChatMessage = {
        id: `m_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        senderUsername: senderUsername || "guest",
        senderName: senderName || "사용자",
        text: (text || "").trim(),
        timestamp: nowStr,
        createdAt: Date.now(),
        imageUrl: imageUrl || undefined
      };

      room.messages.push(newMsg);
      const trimmedText = (text || "").trim();
      room.lastMessage = imageUrl ? (trimmedText ? `📷 ${trimmedText}` : "📷 사진을 보냈습니다.") : trimmedText;
      room.lastTime = "방금 전";
      room.updatedAt = Date.now();

      chatRoomsStore[roomIndex] = room;
      saveJSON(CHATS_FILE, chatRoomsStore);

      // 메시지 전송 활동 로그 기록
      const msgLog: AccessLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        userId: senderUsername || "guest",
        username: senderUsername || "guest",
        name: senderName || "사용자",
        role: "user",
        action: "CHAT_MESSAGE" as any,
        details: `대화 메시지 전송: [${senderName}] -> "${text.trim().substring(0, 30)}${text.trim().length > 30 ? '...' : ''}"`,
        ip: req.ip || "127.0.0.1",
        userAgent: req.headers["user-agent"] || "Web Browser",
        timestamp: new Date().toISOString()
      };
      accessLogsStore.unshift(msgLog);
      saveJSON(LOGS_FILE, accessLogsStore);

      return res.json({ success: true, message: newMsg, room });
    } catch (err) {
      console.error("Send message error:", err);
      return res.status(500).json({ success: false, message: "메시지 전송 실패" });
    }
  });

  // 최고 관리자 전용 실시간 통계 및 로그 API
  app.get("/api/admin/stats", (_req, res) => {
    try {
      return res.json({
        success: true,
        stats: {
          totalUsers: usersStore.length,
          totalProducts: productsStore.length,
          completedDeals: productsStore.filter(p => p.status === '완료').length,
          activeChatRooms: chatRoomsStore.length,
          totalLogs: accessLogsStore.length
        },
        logs: accessLogsStore.slice(0, 100)
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: "관리자 통계 조회 실패" });
    }
  });

  // AI Photo Analysis API
  app.post("/api/analyze-image", async (req, res) => {
    try {
      const { imageBase64, mimeType = "image/jpeg" } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      let cleanData = imageBase64 || "";
      let detectedMime = mimeType;

      if (cleanData.startsWith("http://") || cleanData.startsWith("https://")) {
        try {
          const imgRes = await fetch(cleanData);
          const arrayBuf = await imgRes.arrayBuffer();
          cleanData = Buffer.from(arrayBuf).toString("base64");
          const cType = imgRes.headers.get("content-type");
          if (cType) detectedMime = cType;
        } catch (fetchErr) {
          console.error("Failed to fetch image URL:", fetchErr);
        }
      } else if (cleanData.includes(",")) {
        const parts = cleanData.split(",");
        const match = parts[0].match(/:(.*?);/);
        if (match) detectedMime = match[1];
        cleanData = parts[1];
      }

      if (apiKey && cleanData && !cleanData.startsWith("http")) {
        const ai = new GoogleGenAI({ apiKey });
        const modelsToTry = ["gemini-2.5-flash", "gemini-1.5-flash"];

        for (const modelName of modelsToTry) {
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      inlineData: {
                        mimeType: detectedMime || "image/jpeg",
                        data: cleanData,
                      },
                    },
                    {
                      text: `너는 대학 기숙사 중고/나눔 앱 "연근마켓"의 AI 물품 감정 및 작성 도우미야.
첨부된 물품 사진을 정밀 분석해서 기숙사 생들이 바로 올릴 수 있는 물품 정보를 작성해줘.
반드시 아래 JSON 형식 구조로만 정교하게 응답해줘. 마크다운 기호 없이 순수 JSON 텍스트만 출력해:

{
  "name": "물품 이름 (예: 대학 전공서적, 욕실 디스펜서, 4구 멀티탭, 미니 프라이팬, 필기구 세트, 간식/음료, 기타)",
  "category": "카테고리 (책 또는 교재, 욕실용품, 생활용품, 주방용품, 문구류, 음식, 기타 중 하나 선택)",
  "priceOption": "추천 나눔/가격 (무료 나눔, 500원, 1000원, 2000원, 3000원, 5000원, 기타 중 하나 선택)",
  "description": "AI 감정 결과: 물품 외관 및 상태 평가와 함께, 기숙사 메이트들이 선호하는 따뜻하고 구체적인 나눔 설명글 (2~3문장)",
  "icon": "FontAwesome 아이콘 클래스 (fa-solid fa-book, fa-solid fa-soap, fa-solid fa-house, fa-solid fa-utensils, fa-solid fa-pen-ruler, fa-solid fa-bowl-food, fa-solid fa-shapes 중 하나)"
}`,
                    },
                  ],
                },
              ],
            });

            const responseText = response.text || "";
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              return res.json({
                success: true,
                data: parsed,
                source: "gemini-ai",
                modelUsed: modelName,
              });
            }
          } catch (modelErr) {
            console.warn(`Model ${modelName} failed, trying next fallback:`, modelErr);
          }
        }
      }

      // Fallback smart response generator if no key or API call fails/unreachable
      const fallbackItems = [
        {
          name: "스마트 LED 데스크 스탠드 (밝기 조절 가능)",
          category: "생활용품",
          priceOption: "2000원",
          description: "🤖 AI 자동 감정 완료: 시험기간 열공할 때 유용한 LED 스탠드입니다. 밝기 단계 조절 작동 잘 되며 외관 스크래치 없이 매우 깨끗합니다!",
          icon: "fa-solid fa-house",
        },
        {
          name: "접이식 2단 미니 빨래 건조대",
          category: "생활용품",
          priceOption: "무료 나눔",
          description: "🤖 AI 자동 감정 완료: 기숙사 원룸 좁은 공간에 딱 맞는 미니 건조대입니다. 파손 부위 없으며 깨끗하게 소독했습니다. 필요하신 메이트분 받아가세요!",
          icon: "fa-solid fa-house",
        },
        {
          name: "대학 필수 전공서적 & 노트 세트",
          category: "책 또는 교재",
          priceOption: "1000원",
          description: "🤖 AI 자동 감정 완료: 깨끗하게 보관된 도서/교재입니다. 필기감 양호하며 다음 학기 수강생이나 기숙사 메이트에게 나눔합니다.",
          icon: "fa-solid fa-book",
        },
        {
          name: "기숙사 욕실 세면도구 정리함",
          category: "욕실용품",
          priceOption: "500원",
          description: "🤖 AI 자동 감정 완료: 기숙사 공용/개인 바구니로 쓰기 좋은 다용도 정리함입니다. 물때 없이 깨끗하며 튼튼합니다.",
          icon: "fa-solid fa-soap",
        },
      ];

      const randomFallback = fallbackItems[Math.floor(Math.random() * fallbackItems.length)];
      return res.json({
        success: true,
        data: randomFallback,
        source: "simulated-ai",
      });
    } catch (error: any) {
      console.error("Error analyzing image:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Failed to analyze image",
      });
    }
  });

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
