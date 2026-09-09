/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  getProducts, 
  addProduct, 
  updateProductStatus, 
  updateProductLikes, 
  incrementProductViews, 
  deleteProductFromDb,
  updateProductDetails,
  uploadImageToFirebaseStorage,
  getOrUploadTopEventBanner,
  getOrUploadHomeBanner,
  getOrUploadSampleAvatars,
  Product 
} from './firebase';
import { YeongeunLogo } from './components/YeongeunLogo';
import { CameraCaptureModal } from './components/CameraCaptureModal';
import { RECOMMENDED_AVATARS, YEONGEUN_STAND_PNG, getRandomYeongeunAvatar } from './components/YeongeunAvatars';

export const DEFAULT_AVATAR = YEONGEUN_STAND_PNG;

export interface ChatMessage {
  id: string;
  sender: 'me' | 'partner';
  text: string;
  timestamp: string;
  imageUrl?: string;
}

export interface ChatPartner {
  id: string;
  name: string;
  room: string;
  avatar: string;
  productName: string;
  productPrice: string;
  productIcon: string;
  lastMessage: string;
  lastTime: string;
  unreadCount: number;
  mannerTemp: number;
  messages: ChatMessage[];
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  // 등록 및 뷰 상태
  const [currentView, setCurrentView] = useState<'home' | 'category' | 'chat' | 'register' | 'detail' | 'favorites' | 'mypage'>('home');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // 실시간 1:1 채팅 대화 상대 및 메시지 목록 상태
  const [chatPartners, setChatPartners] = useState<ChatPartner[]>([]);
  const [selectedChatPartner, setSelectedChatPartner] = useState<ChatPartner | null>(null);
  const [chatInputText, setChatInputText] = useState('');
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [chatImagePreview, setChatImagePreview] = useState<string | null>(null);
  const [isChatCameraOpen, setIsChatCameraOpen] = useState<boolean>(false);
  const [chatImageModal, setChatImageModal] = useState<string | null>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);

  const handleChatImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 8 * 1024 * 1024) {
        alert('이미지 크기는 8MB 이하만 가능합니다.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setChatImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  // 물품에서 바로 대화 시작 핸들러 (로그인 필요)
  const startChatWithProductSeller = async (product: Product) => {
    if (!currentUser) {
      alert('🔒 로그인이 필요한 서비스입니다.\n로그인 후 판매자와 1:1 대화를 통해 구매 및 나눔을 진행해보세요!');
      setAuthMode('login');
      setIsAuthModalOpen(true);
      return;
    }

    const sellerName = product.seller || '기숙사 메이트';
    
    // 본인이 등록한 물품인 경우 처리
    if (isMyProduct(product)) {
      alert('💡 본인이 등록한 물품입니다. 타인과의 대화 목록을 확인해주세요.');
      setCurrentView('chat');
      return;
    }

    try {
      const res = await fetch("/api/chats/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          myUsername: currentUser.username,
          myName: currentUser.name,
          myLocation: currentUser.location,
          myAvatar: currentUser.avatarUrl,
          targetUsername: product.sellerUsername,
          targetName: sellerName,
          targetLocation: product.location,
          productId: String(product.id),
          productName: product.name,
          productPrice: product.price,
          productIcon: product.icon || 'fa-solid fa-box',
          initialMessage: ""
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.room) {
          const room = data.room;
          const counterpart = room.participants.find((p: any) => 
            (p.username && p.username.trim().toLowerCase() !== currentUser.username.trim().toLowerCase()) ||
            (p.name && !p.name.trim().includes(currentUser.name.trim()))
          ) || room.participants[1] || room.participants[0];

          const partnerObj: ChatPartner = {
            id: room.id,
            name: `${counterpart.name} (${counterpart.location || '기숙사'})`,
            room: counterpart.location || '기숙사',
            avatar: counterpart.avatarUrl || DEFAULT_AVATAR,
            productName: room.productName,
            productPrice: room.productPrice,
            productIcon: room.productIcon,
            lastMessage: room.lastMessage,
            lastTime: room.lastTime || '방금 전',
            unreadCount: 0,
            mannerTemp: 36.5,
            messages: (room.messages || []).map((m: any) => ({
              id: m.id,
              sender: (m.senderUsername === currentUser.username || m.senderName === currentUser.name) ? 'me' : 'partner',
              text: m.text,
              timestamp: m.timestamp,
              imageUrl: m.imageUrl
            }))
          };

          setSelectedChatPartner(partnerObj);
          setChatPartners(prev => {
            const filtered = prev.filter(p => p.id !== partnerObj.id);
            return [partnerObj, ...filtered];
          });
          setCurrentView('chat');
          return;
        }
      }
    } catch (err) {
      console.error("Start chat error:", err);
    }
  };

  // 메시지 전송 처리 (자동 답장 완전 제거, 실시간 서버 전송)
  const handleSendMessage = async (attachedImage?: string) => {
    const imgToSend = attachedImage || chatImagePreview;
    const sendText = chatInputText.trim();
    if (!sendText && !imgToSend) return;
    if (!selectedChatPartner) return;

    const nowStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    setChatInputText('');
    setChatImagePreview(null);

    // 클라이언트 즉시 반영 (Optimistic UI)
    const newMsg: ChatMessage = {
      id: `m_${Date.now()}`,
      sender: 'me',
      text: sendText,
      timestamp: nowStr,
      imageUrl: imgToSend || undefined
    };

    const displayLastMsg = imgToSend ? (sendText ? `📷 ${sendText}` : '📷 사진을 보냈습니다.') : sendText;

    const updatedPartner: ChatPartner = {
      ...selectedChatPartner,
      lastMessage: displayLastMsg,
      lastTime: '방금 전',
      messages: [...selectedChatPartner.messages, newMsg],
    };

    setSelectedChatPartner(updatedPartner);
    setChatPartners(prev => prev.map(p => p.id === updatedPartner.id ? updatedPartner : p));

    // 백엔드 서버에 실제 메시지 저장
    if (currentUser) {
      try {
        await fetch(`/api/chats/${selectedChatPartner.id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            senderUsername: currentUser.username,
            senderName: currentUser.name,
            text: sendText,
            imageUrl: imgToSend || undefined
          })
        });
      } catch (err) {
        console.error("Failed to send chat message:", err);
      }
    }
  };
  const [registerName, setRegisterName] = useState('');
  const [registerCategory, setRegisterCategory] = useState('책 또는 교재');
  const [registerTags, setRegisterTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState<string>('');
  const [registerPrice, setRegisterPrice] = useState('500원');
  const [selectedPriceOption, setSelectedPriceOption] = useState<string>('500원');
  const [customPriceInput, setCustomPriceInput] = useState<string>('');
  const [registerLocation, setRegisterLocation] = useState('');
  const [registerIcon, setRegisterIcon] = useState('fa-solid fa-book');
  const [registerDescription, setRegisterDescription] = useState('');

  // 물품 첨부 이미지 상태
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);

  // 태그 추가 및 삭제 핸들러
  const handleAddTag = (rawText?: string) => {
    const text = (rawText !== undefined ? rawText : tagInput).trim();
    if (!text) return;
    const clean = text.replace(/^#+/, '').trim();
    if (!clean) return;
    const formattedTag = `#${clean}`;
    if (!registerTags.includes(formattedTag)) {
      setRegisterTags(prev => [...prev, formattedTag]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (indexToRemove: number) => {
    setRegisterTags(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // 마이페이지 & 인적사항 사용자 정보 상태
  const [userInfo, setUserInfo] = useState<{
    name: string;
    dormLocation: string;
    avatarUrl: string;
    certified: boolean;
    role: 'user' | 'admin';
    mannerTemp: number;
  }>(() => {
    try {
      const savedUser = localStorage.getItem('yeongeun_current_user');
      if (savedUser) {
        const u = JSON.parse(savedUser);
        return {
          name: u.name || '게스트 유저',
          dormLocation: u.location || '로그인이 필요합니다',
          avatarUrl: u.avatarUrl || DEFAULT_AVATAR,
          certified: true,
          role: u.role || 'user',
          mannerTemp: 36.5,
        };
      }
    } catch {}
    return {
      name: '게스트 유저',
      dormLocation: '로그인이 필요합니다',
      avatarUrl: DEFAULT_AVATAR,
      certified: false,
      role: 'user',
      mannerTemp: 36.5,
    };
  });

  // -------------------------------------------------------------
  // 백엔드 인증, 회원가입 & 접속 로그 상태 및 핸들러
  // -------------------------------------------------------------
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    username: string;
    name: string;
    location: string;
    role: 'admin' | 'user';
    avatarUrl?: string;
  } | null>(() => {
    try {
      const saved = localStorage.getItem('yeongeun_current_user');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  // 읽은 대화 메시지 ID 집합 (로컬스토리지 보존)
  const [readMsgIds, setReadMsgIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('yeonkeun_read_msg_ids');
      if (saved) return new Set(JSON.parse(saved));
    } catch {}
    return new Set();
  });

  // 내 로그인 계정의 실시간 대화방 목록 동기화 (Polling every 2.5s)
  useEffect(() => {
    if (!currentUser) {
      setChatPartners([]);
      return;
    }

    const fetchUserChatRooms = async () => {
      try {
        const res = await fetch(`/api/chats?username=${encodeURIComponent(currentUser.username)}&name=${encodeURIComponent(currentUser.name)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.rooms)) {
            const partners: ChatPartner[] = data.rooms.map((room: any) => {
              const counterpart = room.participants.find((p: any) => 
                (p.username && p.username.trim().toLowerCase() !== currentUser.username.trim().toLowerCase()) ||
                (p.name && !p.name.trim().includes(currentUser.name.trim()))
              ) || room.participants[0] || { name: '상대방', location: '기숙사', avatarUrl: '' };

              const parsedMessages = (room.messages || []).map((m: any) => ({
                id: m.id,
                sender: (m.senderUsername === currentUser.username || m.senderName === currentUser.name) ? 'me' : 'partner',
                text: m.text,
                timestamp: m.timestamp,
                imageUrl: m.imageUrl
              }));

              const isCurrentlyActiveRoom = (currentView === 'chat' && selectedChatPartner?.id === room.id);
              const unreadMsgs = parsedMessages.filter((m: any) => 
                m.sender === 'partner' && !readMsgIds.has(m.id) && !isCurrentlyActiveRoom
              );

              return {
                id: room.id,
                name: `${counterpart.name} (${counterpart.location || '기숙사'})`,
                room: counterpart.location || '기숙사',
                avatar: counterpart.avatarUrl || DEFAULT_AVATAR,
                productName: room.productName || '물품',
                productPrice: room.productPrice || '무료',
                productIcon: room.productIcon || 'fa-solid fa-box',
                lastMessage: room.lastMessage || '',
                lastTime: room.lastTime || '방금 전',
                unreadCount: unreadMsgs.length,
                mannerTemp: 36.5,
                messages: parsedMessages
              };
            });

            setChatPartners(partners);

            // 열려있는 대화창이 있다면 최신 데이터 및 메시지로 업데이트
            setSelectedChatPartner(prev => {
              if (!prev) return null;
              const matched = partners.find(p => p.id === prev.id);
              if (matched) return matched;
              return prev;
            });
          }
        }
      } catch (err) {
        console.warn("Failed to fetch chat rooms:", err);
      }
    };

    fetchUserChatRooms();
    const interval = setInterval(fetchUserChatRooms, 2500);

    return () => clearInterval(interval);
  }, [currentUser, currentView, selectedChatPartner?.id, readMsgIds]);

  // 대화창 활성화 시 읽음 처리
  useEffect(() => {
    if (selectedChatPartner && currentView === 'chat') {
      const partnerMsgIds = selectedChatPartner.messages
        .filter(m => m.sender === 'partner')
        .map(m => m.id);

      if (partnerMsgIds.length > 0) {
        setReadMsgIds(prev => {
          let hasNew = false;
          const next = new Set(prev);
          partnerMsgIds.forEach(id => {
            if (!next.has(id)) {
              next.add(id);
              hasNew = true;
            }
          });
          if (hasNew) {
            try {
              localStorage.setItem('yeonkeun_read_msg_ids', JSON.stringify(Array.from(next)));
            } catch {}
            return next;
          }
          return prev;
        });
      }

      setChatPartners(prev => prev.map(p => p.id === selectedChatPartner.id ? { ...p, unreadCount: 0 } : p));
    }
  }, [selectedChatPartner?.id, selectedChatPartner?.messages?.length, currentView]);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    name: '',
    location: '제1기숙사 A동 302호',
  });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // 아이디 중복 확인 관련 상태
  const [usernameCheckStatus, setUsernameCheckStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [usernameCheckMsg, setUsernameCheckMsg] = useState('');

  // 기숙사 장소 분할 선택 상태 ("제 - 기숙사 -동 -호")
  const [dormNum, setDormNum] = useState('1');
  const [buildingName, setBuildingName] = useState('A');
  const [roomNum, setRoomNum] = useState('302');

  // 백엔드 접속/활동 로그 저장소 상태
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [fetchedLogs, setFetchedLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // 아이디 중복 확인 함수
  const handleCheckUsername = async () => {
    const cleanUser = authForm.username.replace(/\s/g, '').trim();
    if (!cleanUser) {
      setUsernameCheckStatus('taken');
      setUsernameCheckMsg('아이디를 입력해주세요.');
      return;
    }

    setUsernameCheckStatus('checking');
    try {
      const res = await fetch('/api/auth/check-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUser }),
      });
      const data = await res.json();

      if (data.available) {
        setUsernameCheckStatus('available');
        setUsernameCheckMsg('✅ 사용 가능한 아이디입니다!');
        setAuthError('');
      } else {
        setUsernameCheckStatus('taken');
        setUsernameCheckMsg(`❌ ${data.message || '중복되는 아이디가 존재합니다.'}`);
      }
    } catch (err) {
      console.error(err);
      setUsernameCheckStatus('taken');
      setUsernameCheckMsg('아이디 중복 확인 중 오류가 발생했습니다.');
    }
  };

  // 백엔드 로그인 처리
  const handleBackendLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthError('');
    const cleanUsername = authForm.username.replace(/\s/g, '');
    const cleanPassword = authForm.password.replace(/\s/g, '');

    if (!cleanUsername || !cleanPassword) {
      setAuthError('아이디와 비밀번호를 모두 입력해주세요.');
      return;
    }

    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUsername,
          password: cleanPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setAuthError(data.message || '로그인에 실패했습니다.');
        setAuthLoading(false);
        return;
      }

      // 로그인 성공 처리
      const user = data.user;
      setCurrentUser(user);
      localStorage.setItem('yeongeun_current_user', JSON.stringify(user));

      // userInfo 동기화
      setUserInfo(prev => ({
        ...prev,
        name: user.name,
        dormLocation: user.location || '제1기숙사 A동 302호',
        role: user.role,
        avatarUrl: user.avatarUrl || prev.avatarUrl,
      }));

      // 개인 데이터 동기화
      if (data.personalData) {
        if (Array.isArray(data.personalData.wishlist)) {
          setFavoritedIds(data.personalData.wishlist);
        }
      }

      setIsAuthModalOpen(false);
      setAuthForm({ username: '', password: '', confirmPassword: '', name: '', location: '제1기숙사 A동 302호' });
      alert(`🎉 ${user.name}님 로그인 완료! (${user.role === 'admin' ? '최고 관리자' : '기숙사 메이트'})`);
    } catch (err) {
      console.error(err);
      setAuthError('서버 통신 중 오류가 발생했습니다.');
    } finally {
      setAuthLoading(false);
    }
  };

  // 백엔드 회원가입 처리
  const handleBackendRegister = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthError('');

    const cleanUsername = authForm.username.replace(/\s/g, '');
    const cleanPassword = authForm.password.replace(/\s/g, '');
    const cleanConfirmPassword = authForm.confirmPassword.replace(/\s/g, '');
    const cleanName = authForm.name.trim();

    if (!cleanUsername || !cleanPassword || !cleanName) {
      setAuthError('필수 입력 항목(아이디, 비밀번호, 이름)을 작성해주세요.');
      return;
    }

    // 아이디 중복확인 여부 검사
    if (usernameCheckStatus !== 'available') {
      setAuthError('아이디 중복 확인 버튼을 눌러 중복 여부를 확인해주세요.');
      return;
    }

    // 비밀번호 규칙 검사 (9자 이상, 영문 + 특수문자 필수 포함)
    if (cleanPassword.length < 9) {
      setAuthError('비밀번호는 최소 9자 이상이어야 합니다.');
      return;
    }

    const hasLetter = /[a-zA-Z]/.test(cleanPassword);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(cleanPassword);

    if (!hasLetter || !hasSpecialChar) {
      setAuthError('비밀번호는 영문자와 특수기호(!, @, #, $, % 등)를 무조건 포함해야 합니다.');
      return;
    }

    if (cleanPassword !== cleanConfirmPassword) {
      setAuthError('비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    // 기숙사 장소 규격 포맷 생성: "제-기숙사 -동 -호"
    const finalLocation = `제${dormNum}기숙사 ${buildingName.trim().toUpperCase() || 'A'}동 ${roomNum.trim() || '101'}호`;

    // 5종 공식 연근 캐릭터 중 랜덤 1종 배정
    const randomAvatar = getRandomYeongeunAvatar();

    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUsername,
          password: cleanPassword,
          name: cleanName,
          location: finalLocation,
          avatarUrl: randomAvatar,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setAuthError(data.message || '회원가입에 실패했습니다.');
        setAuthLoading(false);
        return;
      }

      alert('🎉 회원가입이 성공적으로 완료되었습니다! 로그인해 주세요.');
      setAuthMode('login');
      setAuthForm({
        username: cleanUsername,
        password: '',
        confirmPassword: '',
        name: '',
        location: finalLocation,
      });
      setUsernameCheckStatus('idle');
      setUsernameCheckMsg('');
    } catch (err) {
      console.error(err);
      setAuthError('서버 통신 중 오류가 발생했습니다.');
    } finally {
      setAuthLoading(false);
    }
  };

  // 백엔드 로그아웃 처리
  const handleBackendLogout = async () => {
    if (!currentUser) return;
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          username: currentUser.username,
          name: currentUser.name,
          role: currentUser.role,
        }),
      });
    } catch (err) {
      console.error(err);
    }
    setCurrentUser(null);
    localStorage.removeItem('yeongeun_current_user');
    setUserInfo({
      name: '게스트 유저',
      dormLocation: '로그인이 필요합니다',
      avatarUrl: DEFAULT_AVATAR,
      certified: false,
      role: 'user',
      mannerTemp: 36.5,
    });
    alert('안전하게 로그아웃 되었습니다.');
  };

  // 접속 로그 불러오기
  const fetchAccessLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await fetch('/api/logs?limit=100');
      const data = await res.json();
      if (data.success) {
        setFetchedLogs(data.logs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLogsLoading(false);
    }
  };

  // 인적사항 수정 모달 상태
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editName, setEditName] = useState(userInfo.name);
  const [editDormNum, setEditDormNum] = useState('1');
  const [editBuildingName, setEditBuildingName] = useState('A');
  const [editRoomNum, setEditRoomNum] = useState('302');
  const [editRole, setEditRole] = useState<'user' | 'admin'>(userInfo.role);
  const [editAvatarUrl, setEditAvatarUrl] = useState(userInfo.avatarUrl);

  // 실시간 카메라 직접 촬영 모달 상태
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<'register' | 'editProduct' | 'editProfile'>('register');

  const handleCameraCapture = async (imageDataUrl: string) => {
    if (cameraTarget === 'register') {
      setIsUploadingImage(true);
      try {
        const downloadUrl = await uploadImageToFirebaseStorage(imageDataUrl, "item_cam");
        setUploadedImage(downloadUrl);
      } catch (err) {
        console.warn("Storage upload fallback for camera capture:", err);
        setUploadedImage(imageDataUrl);
      } finally {
        setIsUploadingImage(false);
      }
    } else if (cameraTarget === 'editProduct') {
      setIsUploadingImage(true);
      try {
        const downloadUrl = await uploadImageToFirebaseStorage(imageDataUrl, "item_edit_cam");
        setEditProdImage(downloadUrl);
      } catch (err) {
        console.warn("Storage upload fallback for edit camera capture:", err);
        setEditProdImage(imageDataUrl);
      } finally {
        setIsUploadingImage(false);
      }
    } else if (cameraTarget === 'editProfile') {
      try {
        const downloadUrl = await uploadImageToFirebaseStorage(imageDataUrl, "avatar_cam");
        setEditAvatarUrl(downloadUrl);
      } catch {
        setEditAvatarUrl(imageDataUrl);
      }
    }
  };

  const parseDormLocation = (locStr: string) => {
    let dorm = '1';
    let bld = 'A';
    let room = '302';

    const dormMatch = locStr.match(/제([12])기숙사/);
    if (dormMatch) dorm = dormMatch[1];

    const bldMatch = locStr.match(/([A-Ga-g])동/);
    if (bldMatch) bld = bldMatch[1].toUpperCase();

    const roomMatch = locStr.match(/(\d+)호/);
    if (roomMatch) room = roomMatch[1];

    if (dorm === '1' && !['A', 'B', 'C'].includes(bld)) bld = 'A';
    if (dorm === '2' && !['D', 'E', 'F', 'G'].includes(bld)) bld = 'D';

    return { dorm, bld, room };
  };

  const openEditProfileModal = () => {
    setEditName(userInfo.name);
    const { dorm, bld, room } = parseDormLocation(userInfo.dormLocation);
    setEditDormNum(dorm);
    setEditBuildingName(bld);
    setEditRoomNum(room);
    setEditRole(userInfo.role);
    setEditAvatarUrl(userInfo.avatarUrl);
    setIsEditProfileOpen(true);
  };

  // 내가 등록한 물품 상세 정보 수정 모달 상태
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [editProdName, setEditProdName] = useState('');
  const [editProdPrice, setEditProdPrice] = useState('');
  const [editPriceOption, setEditPriceOption] = useState<string>('500원');
  const [editCustomPriceInput, setEditCustomPriceInput] = useState<string>('');
  const [editProdLocation, setEditProdLocation] = useState('');
  const [editProdCategory, setEditProdCategory] = useState('');
  const [editProdDescription, setEditProdDescription] = useState('');
  const [editProdImage, setEditProdImage] = useState('');
  const [editProdStatus, setEditProdStatus] = useState<'나눔중' | '예약중' | '완료' | '무료'>('나눔중');

  // 관련 안내 및 세부 보기 모달 상태
  const [showMyProductsModal, setShowMyProductsModal] = useState(false);
  const [showCompletedDealsModal, setShowCompletedDealsModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);

  // 최고 관리자 전용 대시보드 팝업 상태
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminActiveTab, setAdminActiveTab] = useState<'logs' | 'users' | 'products'>('users');

  // 최고 관리자 전용 실시간 통계 및 백엔드 로그 상태
  const [adminStats, setAdminStats] = useState({
    totalUsers: 0,
    totalProducts: 0,
    completedDeals: 0,
    activeChatRooms: 0,
    totalLogs: 0
  });

  const fetchAdminStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.stats) {
          setAdminStats(data.stats);
          if (Array.isArray(data.logs) && data.logs.length > 0) {
            setAdminLogs(data.logs.map((l: any, idx: number) => {
              const isDelete = l.action === 'PRODUCT_DELETE' || (l.details && l.details.includes('삭제'));
              return {
                id: l.id || idx,
                type: isDelete ? 'DELETE' : (l.action === 'REGISTER' ? 'REG' : l.action === 'CHAT_MESSAGE' ? 'CHAT' : l.action || 'LOG'),
                text: `[${l.name || l.username || '회원'}] ${l.details || ''}`,
                time: new Date(l.timestamp).toLocaleString('ko-KR'),
                status: isDelete ? 'red' : (l.role === 'admin' ? 'purple' : l.action === 'LOGIN' ? 'emerald' : l.action === 'CHAT_MESSAGE' ? 'blue' : 'amber')
              };
            }));
          }
        }
      }

      // 백엔드 전체 회원 목록 조회
      const usersRes = await fetch('/api/users');
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        if (usersData.success && Array.isArray(usersData.users)) {
          const formattedUsers = usersData.users
            .filter((u: any) => !u.username?.startsWith('testrandomavatar') && !u.name?.includes('테스트유저'))
            .map((u: any, idx: number) => {
            const isAdmin = u.role === 'admin' || u.username === 'sys_admin_yeonkeun_9842';
            return {
              id: u.id || `u_${idx}`,
              name: u.name || '회원',
              handle: u.username ? (u.username.startsWith('@') ? u.username : `@${u.username}`) : `@user_${idx}`,
              role: isAdmin ? '관리자' : '일반 유저',
              room: u.location || '기숙사',
              lastLogin: u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('ko-KR') : '최근 접속',
              avatarBg: isAdmin ? 'bg-[#FEF3C7] text-amber-700' : 'bg-[#D1FAE5] text-emerald-700',
              avatarIcon: isAdmin ? '👑' : '👤',
            };
          });
          setAdminUsers(formattedUsers);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch admin stats:", err);
    }
  };

  useEffect(() => {
    if (userInfo.role === 'admin' || isAdminModalOpen) {
      fetchAdminStats();
      const interval = setInterval(fetchAdminStats, 3000);
      return () => clearInterval(interval);
    }
  }, [userInfo.role, isAdminModalOpen]);

  // 알림 센터 모달 및 목록 상태
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    title: string;
    message: string;
    time: string;
    unread: boolean;
    type: 'register' | 'like_rank' | 'welcome' | 'chat';
    icon?: string;
    iconBg?: string;
  }>>([
    {
      id: 'welcome_1',
      title: '🌱 연근마켓에 오신 것을 환영합니다!',
      message: `환영합니다! "${userInfo.name}"님, 이곳은 연결할수록 뿌리 깊어지는 연근마켓입니다`,
      time: '방금 전',
      unread: true,
      type: 'welcome',
      icon: 'fa-solid fa-leaf',
      iconBg: 'bg-amber-100 text-amber-600',
    }
  ]);

  const unreadNotifCount = notifications.filter(n => n.unread).length;

  // 로그인 필수 기능 검증 헬퍼
  const handleRequireAuth = (actionDescription: string, callback: () => void) => {
    if (!currentUser) {
      alert(`🔒 로그인이 필요한 서비스입니다.\n로그인 후 ${actionDescription} 이용하실 수 있습니다!`);
      setAuthMode('login');
      setIsAuthModalOpen(true);
      return;
    }
    callback();
  };

  // 내가 등록한 물품인지 여부 판별 헬퍼 (로그인 계정 username, 이름, 등록자명 일치 여부 포괄)
  const isMyProduct = (product: Product | null | undefined): boolean => {
    if (!product) return false;
    if (currentUser) {
      if (product.sellerUsername && currentUser.username &&
          product.sellerUsername.trim().toLowerCase() === currentUser.username.trim().toLowerCase()) {
        return true;
      }
      if (product.seller && (
        product.seller.includes(currentUser.name) || 
        product.seller.includes(currentUser.username)
      )) {
        return true;
      }
    }
    if (userInfo?.name && product.seller && product.seller.includes(userInfo.name)) {
      return true;
    }
    if (product.seller && (
      product.seller.includes('나') || 
      product.seller.includes('본인') ||
      product.seller === '나'
    )) {
      return true;
    }
    return false;
  };

  // 물품 삭제 공통 핸들러 (클릭 즉시 앱 상에서 바로 완전 삭제)
  const handleDeleteProduct = async (productToDelete: Product) => {
    if (!productToDelete) return;
    const prodIdStr = String(productToDelete.id);

    // 1. UI 상태에서 즉시 완전히 제거 (목록, 상세창, 찜, 최근 본 물품)
    setProductList(prev => prev.filter(p => String(p.id) !== prodIdStr));
    setFavoritedIds(prev => prev.filter(id => String(id) !== prodIdStr));
    setRecentlyViewedIds(prev => prev.filter(id => String(id) !== prodIdStr));

    if (selectedProduct && String(selectedProduct.id) === prodIdStr) {
      setSelectedProduct(null);
      setIsEditingProduct(false);
    }

    // 2. 백엔드 및 로컬 스토리지/DB에서 즉시 삭제
    try {
      const deleter = currentUser?.name || userInfo.name || '일반유저';
      await deleteProductFromDb(productToDelete.id, deleter);
      fetchAdminStats();
    } catch (err) {
      console.error('Delete product error:', err);
    }
  };

  // 찜 클릭 공통 핸들러 (내 물품 찜 랭킹 알림 포함)
  const handleToggleLike = async (product: Product) => {
    if (!currentUser) {
      alert('🔒 로그인이 필요한 서비스입니다.\n로그인 후 관심 물품(찜)을 등록하고 관리해보세요!');
      setAuthMode('login');
      setIsAuthModalOpen(true);
      return;
    }

    const isLiked = favoritedIds.includes(product.id);
    const nextLiked = !isLiked;
    const nextFavoritedIds = nextLiked
      ? [...favoritedIds, product.id]
      : favoritedIds.filter(id => id !== product.id);

    setFavoritedIds(nextFavoritedIds);
    await updateProductLikes(product.id, nextLiked);

    if (selectedProduct && String(selectedProduct.id) === String(product.id)) {
      setSelectedProduct({
        ...selectedProduct,
        likes: Math.max(0, (selectedProduct.likes || 0) + (nextLiked ? 1 : -1))
      });
    }

    // 내가 등록한 물품이고 찜이 올라갔을 때 랭킹 알림 생성
    const isMyProd = isMyProduct(product);
    if (isMyProd && nextLiked) {
      const rankNotif = {
        id: `notif_rank_${Date.now()}`,
        title: `🏆 인기 찜 랭킹 등극!`,
        message: `${product.name} 이 인기 찜 랭킹 TOP 3에 올랐습니다! 🎉`,
        time: '방금 전',
        unread: true,
        type: 'like_rank' as const,
        icon: 'fa-solid fa-trophy',
        iconBg: 'bg-amber-100 text-amber-600',
      };
      setNotifications(prev => [rankNotif, ...prev]);
    }
  };

  // 관리자 전용 유저 목록 데이터 (예시 팝업과 동일)
  const [adminUsers, setAdminUsers] = useState([
    {
      id: 'u1',
      name: '최고 관리자',
      handle: '@sys_admin_yeonkeun_9842',
      role: '관리자',
      room: '관리실 (A동 101호)',
      lastLogin: '8. 1. 오전 12:31',
      avatarBg: 'bg-[#FEF3C7] text-amber-700',
      avatarIcon: '👑',
    },
    {
      id: 'u2',
      name: '나는야개발자',
      handle: '@jongho061026',
      role: '일반 유저',
      room: '제 2 기숙사 E 동 717 호',
      lastLogin: '8. 1. 오전 12:26',
      avatarBg: 'bg-[#D1FAE5] text-emerald-700',
      avatarIcon: '👤',
    },
  ]);

  // 관리자 백엔드 축적 로그 데이터 (12건)
  const [adminLogs, setAdminLogs] = useState([
    { id: 1, type: 'AUTH', text: '@sys_admin_yeonkeun_9842 최고 관리자 세션 로그인 성공', time: '8. 1. 오전 12:31:05', status: 'amber' },
    { id: 2, type: 'DB_SYNC', text: "Firestore 'products' 컬렉션 동기화 완료 (물품 실시간 데이터 처리)", time: '8. 1. 오전 12:28:40', status: 'blue' },
    { id: 3, type: 'USER_LOGIN', text: '@jongho061026 유저 접속 인증 완료 (제 2 기숙사 E 동 717 호)', time: '8. 1. 오전 12:26:12', status: 'blue' },
    { id: 4, type: 'DEAL', text: '거래 완료 수신: [건조대] 나눔 거래 완료 처리됨 (거래 완료 #1)', time: '8. 1. 오전 12:15:30', status: 'emerald' },
    { id: 5, type: 'DEAL', text: '거래 완료 수신: [휴지통 10L] 나눔 완료 처리됨 (거래 완료 #2)', time: '7. 31. 오후 11:45:10', status: 'emerald' },
    { id: 6, type: 'DEAL', text: '거래 완료 수신: [슬리퍼] 나눔 완료 처리됨 (거래 완료 #3)', time: '7. 31. 오후 10:30:00', status: 'emerald' },
    { id: 7, type: 'CHAT', text: '기숙사 대화 소켓 채널 #c901 세션 활성화', time: '7. 31. 오후 09:10:00', status: 'blue' },
    { id: 8, type: 'SYSTEM', text: 'Cloud Run 백엔드 컨테이너 헬스체크 (Port 3000)', time: '7. 31. 오후 08:50:18', status: 'purple' },
    { id: 9, type: 'SECURITY', text: 'Firestore Security Rules 및 API 토큰 검증 통과', time: '7. 31. 오후 07:10:00', status: 'blue' },
    { id: 10, type: 'LOG_ACCUMULATED', text: '통합 백엔드 비동기 파이프라인 데이터 12건 축적 완료', time: '7. 31. 오후 06:40:22', status: 'purple' },
    { id: 11, type: 'USER_REG', text: '신규 유저 프로필 등록: @sys_admin_yeonkeun_9842', time: '7. 31. 오후 05:00:00', status: 'blue' },
    { id: 12, type: 'SYSTEM', text: '연근마켓 백엔드 나눔 앱 서비스 프로세스 가동 완료', time: '7. 31. 오후 04:30:00', status: 'purple' },
  ]);

  useEffect(() => {
    if (currentUser) {
      setUserInfo(prev => ({
        ...prev,
        name: currentUser.name,
        dormLocation: currentUser.location || '제1기숙사 A동 302호',
        role: currentUser.role,
        avatarUrl: currentUser.avatarUrl || prev.avatarUrl,
        certified: true,
      }));
    } else {
      setUserInfo(prev => ({
        ...prev,
        name: '게스트 유저',
        dormLocation: '로그인이 필요합니다',
        role: 'user',
        certified: false,
      }));
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('yeongeun_user_info', JSON.stringify(userInfo));
  }, [userInfo]);

  const CATEGORY_OPTIONS = [
    '책 또는 교재',
    '욕실용품',
    '생활용품',
    '주방용품',
    '문구류',
    '음식',
    '기타',
  ];

  const CATEGORY_ICON_MAP: Record<string, string> = {
    '책 또는 교재': 'fa-solid fa-book',
    '욕실용품': 'fa-solid fa-soap',
    '생활용품': 'fa-solid fa-house',
    '주방용품': 'fa-solid fa-utensils',
    '문구류': 'fa-solid fa-pen-ruler',
    '음식': 'fa-solid fa-bowl-food',
    '기타': 'fa-solid fa-shapes',
  };
  
  // 모달 팝업 상태 추가
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  // 찜(관심 물품) 목록 상태
  const [favoritedIds, setFavoritedIds] = useState<(string | number)[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('favorited_ids') || '[]');
    } catch {
      return [];
    }
  });

  // 최근 본 상품 상태 (로컬 스토리지 연동)
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<(string | number)[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('recently_viewed_ids') || '[]');
    } catch {
      return [];
    }
  });

  const [productList, setProductList] = useState<Product[]>([]);
  const [homeBannerUrl, setHomeBannerUrl] = useState<string>('https://i.ibb.co/0p8r3cLM/banner-png.jpg');
  const [topEventBannerUrl, setTopEventBannerUrl] = useState<string>('https://i.ibb.co/PvMGnBvN/upperbanner-png.jpg');
  const [sampleAvatarsList, setSampleAvatarsList] = useState(RECOMMENDED_AVATARS);

  // Firebase Storage 배너 및 샘플 아바타 5종 영구 보관 동기화
  useEffect(() => {
    // 1. 상단 이벤트 광고 배너 동기화
    getOrUploadTopEventBanner().then((url) => {
      if (url) {
        setTopEventBannerUrl(url);
      }
    }).catch(err => {
      console.warn("Top event banner Firebase Storage sync error:", err);
    });

    // 2. 홈 메인 배너 동기화
    getOrUploadHomeBanner().then((url) => {
      if (url) {
        setHomeBannerUrl(url);
      }
    }).catch(err => {
      console.warn("Home banner Firebase Storage sync error:", err);
    });

    // 3. 5종 샘플 아바타 동기화
    getOrUploadSampleAvatars().then((avatarMap) => {
      if (avatarMap && Object.keys(avatarMap).length > 0) {
        setSampleAvatarsList(prev => prev.map(item => ({
          ...item,
          url: avatarMap[item.id] || item.url
        })));
      }
    }).catch(err => {
      console.warn("Sample avatars Firebase Storage sync error:", err);
    });
  }, []);

  // 찜 상태 변화 시 localStorage에 보관
  useEffect(() => {
    localStorage.setItem('favorited_ids', JSON.stringify(favoritedIds));
  }, [favoritedIds]);

  // 최근 본 상품 상태 변화 시 localStorage에 보관
  useEffect(() => {
    localStorage.setItem('recently_viewed_ids', JSON.stringify(recentlyViewedIds));
  }, [recentlyViewedIds]);

  // Firestore 실시간 목록 바인딩 및 기본 물품 정리
  useEffect(() => {
    // 로컬 스토리지에 남아있을 수 있는 기본 테스트 물품(건조대, 멀티탭) 정리
    try {
      const stored = localStorage.getItem('dorm_share_products');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((p: any) => 
            p.id !== 'prod_init_001' && 
            p.id !== 'prod_init_002' && 
            !p.name?.includes('건조대') && 
            !p.name?.includes('멀티탭')
          );
          if (cleaned.length !== parsed.length) {
            localStorage.setItem('dorm_share_products', JSON.stringify(cleaned));
          }
        }
      }
    } catch {
      // ignore
    }

    let unsubscribeFn: (() => void) | null = null;
    
    getProducts((products) => {
      const filtered = products.filter(p => 
        p.id !== 'prod_init_001' && 
        p.id !== 'prod_init_002' && 
        !p.name.includes('건조대') && 
        !p.name.includes('멀티탭')
      );
      setProductList(filtered);
    }).then((unsub) => {
      if (typeof unsub === 'function') {
        unsubscribeFn = unsub;
      }
    }).catch(err => {
      console.error("Failed to setup realtime listener:", err);
    });

    return () => {
      if (unsubscribeFn) {
        unsubscribeFn();
      }
    };
  }, []);

  const allProductNames = productList.map(product => product.name);

  // 모든 등록된 태그 및 기본 추천 해시태그 목록
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    // 기본 추천 태그
    const defaultSampleTags = ['#기숙사필수템', '#무료나눔', '#급처', '#전공책', '#건조기', '#스탠드', '#생필품', '#깨끗함', '#선풍기', '#멀티탭'];
    defaultSampleTags.forEach(t => tagSet.add(t));

    productList.forEach(product => {
      if (product.tags && Array.isArray(product.tags)) {
        product.tags.forEach(tag => {
          if (tag && tag.trim()) {
            const clean = tag.trim().startsWith('#') ? tag.trim() : `#${tag.trim()}`;
            tagSet.add(clean);
          }
        });
      }
    });
    return Array.from(tagSet);
  }, [productList]);

  const filteredProducts = productList.filter(product => {
    if (!activeSearch || !activeSearch.trim()) return true;
    
    // 검색어 정규화: 앞뒤 공백 제거 및 소문자화
    const rawSearch = activeSearch.trim();
    const searchLower = rawSearch.toLowerCase();
    const isTagFilter = searchLower.startsWith('#');
    const tagKeyword = searchLower.replace(/^#+/, '').trim();

    if (isTagFilter) {
      // 1. '#' 단독 검색 시 태그가 등록된 모든 물품 반환
      if (!tagKeyword) {
        return Boolean(product.tags && product.tags.length > 0);
      }
      // 2. '#키워드' 검색 시 태그 매칭 우선 확인 (# 유무와 공백 무관하게 매칭)
      const exactTagMatch = product.tags ? product.tags.some(tag => {
        if (!tag) return false;
        const cleanTag = tag.toLowerCase().replace(/^#+/, '').trim();
        return cleanTag.includes(tagKeyword) || tagKeyword.includes(cleanTag);
      }) : false;

      // 보조적으로 상품명/설명/카테고리에도 해당 단어가 포함되어 있다면 함께 반환
      const secondaryNameMatch = product.name ? product.name.toLowerCase().includes(tagKeyword) : false;
      const secondaryDescMatch = product.description ? product.description.toLowerCase().includes(tagKeyword) : false;
      const secondaryCatMatch = product.category ? product.category.toLowerCase().includes(tagKeyword) : false;

      return exactTagMatch || secondaryNameMatch || secondaryDescMatch || secondaryCatMatch;
    }

    // 일반 검색어: 띄어쓰기로 구분된 다중 키워드 지원 (예: "책상 스탠드" 입력 시 둘 다 포함된 상품 매칭)
    const searchKeywords = searchLower.split(/\s+/).filter(k => k.length > 0);
    if (searchKeywords.length === 0) return true;

    // 카테고리 정확 또는 부분 일치 확인
    const prodCat = (product.category || '').toLowerCase().trim();
    const prodName = (product.name || '').toLowerCase().trim();
    const prodDesc = (product.description || '').toLowerCase().trim();
    const prodTags = (product.tags || []).map(t => (t || '').toLowerCase().replace(/^#+/, '').trim());

    // 단일 전체 검색어 매칭 검사
    if (prodCat === searchLower || prodName.includes(searchLower) || prodDesc.includes(searchLower)) {
      return true;
    }

    // 카테고리 동의어 및 연관 매칭
    let categoryMatch = false;
    if (prodCat) {
      if (prodCat.includes(searchLower) || searchLower.includes(prodCat)) {
        categoryMatch = true;
      } else if (
        (searchLower.includes('책') || searchLower.includes('교재') || searchLower.includes('도서')) && (prodCat.includes('책') || prodCat.includes('교재') || prodCat.includes('도서')) ||
        (searchLower.includes('욕실') || searchLower.includes('샤워') || searchLower.includes('세면')) && (prodCat.includes('욕실') || prodCat.includes('세면') || prodCat.includes('비누')) ||
        (searchLower.includes('생활') || searchLower.includes('가전') || searchLower.includes('전자')) && (prodCat.includes('생활') || prodCat.includes('전자') || prodCat.includes('가전')) ||
        (searchLower.includes('주방') || searchLower.includes('식기') || searchLower.includes('요리')) && (prodCat.includes('주방') || prodCat.includes('식기') || prodCat.includes('요리') || prodCat.includes('음식')) ||
        (searchLower.includes('문구') || searchLower.includes('필기') || searchLower.includes('노트')) && (prodCat.includes('문구') || prodCat.includes('필기')) ||
        (searchLower.includes('의류') || searchLower.includes('옷') || searchLower.includes('패션')) && (prodCat.includes('의류') || prodCat.includes('패션'))
      ) {
        categoryMatch = true;
      }
    }

    if (categoryMatch) return true;

    // 모든 검색 키워드가 이름, 설명, 태그, 카테고리 중 적어도 하나에 포함되는지 검사
    return searchKeywords.every(keyword => {
      const inName = prodName.includes(keyword);
      const inDesc = prodDesc.includes(keyword);
      const inCat = prodCat.includes(keyword);
      const inTags = prodTags.some(t => t.includes(keyword) || keyword.includes(t));
      return inName || inDesc || inCat || inTags;
    });
  });

  const startEditingProduct = () => {
    if (!selectedProduct) return;
    setEditProdName(selectedProduct.name || '');
    setEditProdLocation(selectedProduct.location || '');
    setEditProdCategory(selectedProduct.category || '기타');
    setEditProdDescription(selectedProduct.description || '');
    setEditProdImage(selectedProduct.imageUrl || selectedProduct.image || '');

    // 나눔 상태는 '나눔중' 또는 '완료'만 사용
    const status = selectedProduct.status === '완료' ? '완료' : '나눔중';
    setEditProdStatus(status as any);

    // 가격 및 나눔 조건 드롭다운 세팅
    const currentPrice = selectedProduct.price || '';
    const standardOptions = ['500원', '1000원', '2000원', '3000원', '5000원', '무료 나눔'];
    
    if (standardOptions.includes(currentPrice)) {
      setEditPriceOption(currentPrice);
      setEditProdPrice(currentPrice);
      setEditCustomPriceInput('');
    } else if (currentPrice === '나눔 (무료)' || currentPrice === '무료나눔' || currentPrice === '무료') {
      setEditPriceOption('무료 나눔');
      setEditProdPrice('무료 나눔');
      setEditCustomPriceInput('');
    } else {
      setEditPriceOption('기타');
      setEditProdPrice(currentPrice);
      setEditCustomPriceInput(currentPrice);
    }

    setIsEditingProduct(true);
  };

  const openProductDetail = (product: Product) => {
    setIsEditingProduct(false);
    setSelectedProduct({ ...product, views: (product.views || 0) + 1 });
    incrementProductViews(product.id);

    // 최근 본 상품 추가 (중복 방지 및 최대 8개 유지)
    setRecentlyViewedIds(prev => {
      const filtered = prev.filter(id => id !== product.id);
      return [product.id, ...filtered].slice(0, 8);
    });
  };

  const renderAiRecommendation = () => (
      <section className="space-y-3 px-0.5 pt-2">
          <div>
              <div className="flex items-center gap-1.5">
                  <span className="bg-[#4A5833] text-white text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                      <i className="fa-solid fa-sparkles text-[9px]"></i> 강력 추천
                  </span>
                  <h2 className="font-extrabold text-gray-900 text-base">
                      추천 상품
                  </h2>
              </div>
              <p className="text-xs text-gray-600 font-bold mt-1">
                  <span className="text-[#4A5833]">{userInfo.name}</span>님의 취향에 맞게 준비했어요!
              </p>
          </div>

          {/* 추천 물품 리스트 (무제한 세로 스크롤) */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
              {productList.map((product) => (
                  <div 
                      key={product.id}
                      onClick={() => openProductDetail(product)}
                      className="bg-white p-3 rounded-2xl border border-gray-100 shadow-xs hover:shadow-md hover:border-[#4A5833]/30 transition-all cursor-pointer flex flex-col justify-between relative group active:scale-[0.98]"
                  >
                      <div className="w-full h-24 bg-gray-50 rounded-xl mb-2 flex items-center justify-center text-gray-400 group-hover:scale-105 transition-transform overflow-hidden">
                          {product.image ? (
                              <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                              <i className={`${product.icon || 'fa-solid fa-box'} text-2xl text-[#4A5833]`}></i>
                          )}
                      </div>

                      <div>
                          <h4 className="text-xs font-bold text-gray-800 truncate mb-0.5">{product.name}</h4>
                          <p className="text-[10px] text-gray-400 truncate mb-1.5">{product.location}</p>
                          <div className="flex items-center justify-between pt-1.5 border-t border-gray-50">
                              <span className="text-xs font-black text-[#4A5833]">{product.price}</span>
                              <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                  {product.category || '추천'}
                              </span>
                          </div>
                      </div>
                  </div>
              ))}
              {productList.length === 0 && (
                  <div className="col-span-2 py-8 text-center text-xs text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                      <i className="fa-solid fa-box-open text-2xl mb-2 text-gray-300 block"></i>
                      등록된 추천 물품이 없습니다.
                  </div>
              )}
          </div>
      </section>
  );


  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.search-container')) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  const highlightText = (text: string, highlight: string, isTag: boolean = false) => {
    if (!highlight.trim()) {
      return isTag ? <span className="text-blue-600 font-bold">{text}</span> : <span className="text-gray-800">{text}</span>;
    }
    const cleanHighlight = highlight.replace(/^#+/, '').trim();
    const query = cleanHighlight || highlight.trim();
    if (!query) {
      return isTag ? <span className="text-blue-600 font-bold">{text}</span> : <span className="text-gray-800">{text}</span>;
    }

    try {
      const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      const parts = text.split(regex);
      return (
        <>
          {parts.map((part, index) => 
            regex.test(part) ? (
              <span 
                key={index} 
                className={isTag ? "text-blue-700 font-black bg-blue-100/80 px-1 py-0.5 rounded" : "text-[#4A5833] font-black underline decoration-[#4A5833]/40"}
              >
                {part}
              </span>
            ) : (
              <span key={index} className={isTag ? "text-blue-600 font-bold" : "text-gray-700"}>
                {part}
              </span>
            )
          )}
        </>
      );
    } catch {
      return isTag ? <span className="text-blue-600 font-bold">{text}</span> : <span>{text}</span>;
    }
  };

  const getProductStatusLabel = (product: Product) => {
    if (product.status === '완료') return '완료';
    if (product.status === '무료' || product.price.includes('무료')) return '무료';
    if (product.status === '나눔중') return product.price;
    return product.status;
  };

  return (
    <div className="max-w-md mx-auto bg-gray-50 min-h-screen relative shadow-2xl border-x border-gray-100 pb-20">

      {/* ========================================== */}
      {/* 1. SPLASH SCREEN (모바일 플래시 화면) */}
      {/* ========================================== */}
      <div 
          id="splash-screen" 
          onClick={() => setShowSplash(false)}
          className={`relative overflow-hidden px-8 text-center select-none cursor-pointer bg-[#173B2A] transition-all duration-700 ${!showSplash ? 'fade-out' : ''}`}
      >
          {/* 중앙 메인 플래시 아트워크 (업로드된 모바일 플래시 PNG와 100% 동일한 비주얼 구성) */}
          <div className="z-10 flex flex-col items-center justify-center animate-fade-in">
              {/* 연근 마켓 공식 캐릭터 아트워크 */}
              <div className="w-36 h-36 sm:w-40 sm:h-40 flex items-center justify-center mb-6 sprout-bounce">
                  <YeongeunLogo className="w-full h-full drop-shadow-lg" rotate={0} variant="dark" />
              </div>

              {/* 브랜드 메인 타이틀: 연근마켓 (업로드된 이미지와 100% 동일한 Gmarket Sans 폰트) */}
              <h1 className="text-4xl sm:text-5xl font-gmarket-bold text-white tracking-normal mb-3.5 leading-none drop-shadow-sm">
                  연근마켓
              </h1>

              {/* 메인 슬로건: 환경을 지키는 따뜻한 거래 (업로드된 이미지와 100% 동일한 Gmarket Sans 폰트) */}
              <p className="text-base sm:text-lg font-gmarket-medium text-white tracking-tight opacity-95">
                  환경을 지키는 따뜻한 거래
              </p>
          </div>

          {/* 하단 미니멀 로딩 인디케이터 (어두운 녹색 테마에 맞춘 은은한 인디케이터) */}
          <div className="absolute bottom-10 z-10 flex flex-col items-center">
              <div className="w-10 h-1 bg-white/20 rounded-full overflow-hidden">
                  <div className="w-full h-full bg-white/80 animate-pulse"></div>
              </div>
          </div>
      </div>


      {/* ========================================== */}
      {/* 2. MAIN APP UI */}
      {/* ========================================== */}

      {/* 상단 헤더: 로고 + 검색창 + 알림 */}
      <header className="sticky top-0 bg-white/95 backdrop-blur-md z-40 px-3 py-1 border-b border-gray-100 flex items-center justify-between gap-1.5">
          {/* 로고 (오른쪽 15도 회전) */}
          <div className="flex items-center gap-1.5 shrink-0 cursor-pointer" onClick={() => { setCurrentView('home'); setSearchQuery(''); setActiveSearch(''); }}>
              <YeongeunLogo className="w-11 h-11 transition-transform hover:scale-105 active:scale-95" rotate={15} />
              <div className="flex flex-col justify-center">
                  <span className="text-2xl font-gmarket-bold text-[#4A5833] leading-none">연근마켓</span>
                  <span className="text-[9px] font-gmarket-medium text-[#526233] mt-0.5 tracking-tight whitespace-nowrap">환경을 지키는 따뜻한 거래</span>
              </div>
          </div>

          {/* 검색창 */}
          <div className="flex-1 relative search-container">
              <button 
                  onClick={() => {
                      setActiveSearch(searchQuery);
                      setShowDropdown(false);
                  }}
                  className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm focus:outline-none transition ${
                      searchQuery.trim().startsWith('#') ? 'text-blue-500 hover:text-blue-700' : 'text-gray-400 hover:text-gray-600'
                  }`}
                  title={searchQuery.trim().startsWith('#') ? '해시태그 검색' : '물품 검색'}
              >
                  {searchQuery.trim().startsWith('#') ? (
                      <i className="fa-solid fa-hashtag font-black text-blue-600"></i>
                  ) : (
                      <i className="fa-solid fa-magnifying-glass"></i>
                  )}
              </button>
              <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowDropdown(true);
                  }}
                  onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                          setActiveSearch(searchQuery);
                          setShowDropdown(false);
                      }
                  }}
                  onFocus={() => {
                      if (searchQuery.trim() !== '') {
                          setShowDropdown(true);
                      }
                  }}
                  placeholder="물품 또는 #해시태그 검색..." 
                  className={`w-full text-xs py-2 pl-9 pr-7 rounded-xl focus:outline-none transition ${
                      searchQuery.trim().startsWith('#')
                          ? 'bg-blue-50/60 text-blue-900 font-bold focus:ring-2 focus:ring-blue-400/40 border border-blue-200/80 placeholder-blue-300'
                          : 'bg-gray-100 text-gray-800 focus:ring-2 focus:ring-[#4A5833]/30 border border-transparent'
                  }`}
              />
              {searchQuery && (
                  <button
                      type="button"
                      onClick={() => {
                          setSearchQuery('');
                          setActiveSearch('');
                          setShowDropdown(false);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-gray-300/80 hover:bg-gray-400 text-white flex items-center justify-center text-[9px] transition cursor-pointer"
                      title="검색어 지우기"
                  >
                      <i className="fa-solid fa-xmark"></i>
                  </button>
              )}

              {/* 실시간 연관 검색어(자동완성) 드롭다운 */}
              {showDropdown && searchQuery.trim() !== '' && (() => {
                  const isTagSearch = searchQuery.trim().startsWith('#');
                  const cleanQuery = searchQuery.trim().replace(/^#+/, '').toLowerCase();
                  
                  if (isTagSearch) {
                      // '#' 으로 검색하는 경우: 태그 목록(파란색) + 일반 물품 연관 검색어(검정색) 모두 표시
                      const matchedTags = allTags.filter(tag => {
                          if (!cleanQuery) return true;
                          const cleanTag = tag.toLowerCase().replace(/^#+/, '');
                          return cleanTag.includes(cleanQuery) || cleanQuery.includes(cleanTag);
                      });

                      const matchedProducts = allProductNames.filter(name => {
                          if (!cleanQuery) return true;
                          return name.toLowerCase().includes(cleanQuery);
                      });

                      return (
                          <div className="absolute left-0 right-0 mt-2 bg-white rounded-xl border border-blue-100 shadow-xl z-50 overflow-hidden max-h-72 overflow-y-auto animate-fade-in">
                              {/* 1. 해시태그 연관 검색어 (파란색) */}
                              <div className="p-2 text-[10px] font-bold text-blue-600 bg-blue-50/90 border-b border-blue-100 flex items-center justify-between sticky top-0 z-10">
                                  <span className="flex items-center gap-1.5">
                                      <i className="fa-solid fa-hashtag text-blue-500"></i>
                                      <span>해시태그 연관 검색어</span>
                                  </span>
                                  <span className="text-[9px] text-blue-400 font-semibold">{matchedTags.length}개</span>
                              </div>
                              {matchedTags.length > 0 ? (
                                  matchedTags.slice(0, 10).map((tag, idx) => (
                                      <button
                                          key={`tag-${idx}`}
                                          onClick={() => {
                                              setSearchQuery(tag);
                                              setActiveSearch(tag);
                                              setShowDropdown(false);
                                          }}
                                          className="w-full text-left px-3 py-2 text-xs text-blue-600 font-bold hover:bg-blue-50/80 flex items-center justify-between border-b border-blue-50/60 last:border-0 transition group cursor-pointer"
                                      >
                                          <div className="flex items-center gap-2 truncate">
                                              <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] shrink-0 group-hover:bg-blue-600 group-hover:text-white transition font-black">
                                                  #
                                              </span>
                                              <span className="truncate">{highlightText(tag, searchQuery, true)}</span>
                                          </div>
                                          <span className="text-[10px] text-blue-400 font-medium opacity-0 group-hover:opacity-100 transition shrink-0">
                                              선택
                                          </span>
                                      </button>
                                  ))
                              ) : (
                                  <div className="p-2.5 text-center text-xs text-blue-400 font-medium">
                                      일치하는 해시태그가 없습니다
                                  </div>
                              )}

                              {/* 2. 일반 물품 연관 검색어 (기존 검정색 유지) */}
                              <div className="p-2 text-[10px] font-bold text-gray-500 bg-gray-50/90 border-t border-b border-gray-100 flex items-center justify-between sticky top-0 z-10">
                                  <span className="flex items-center gap-1.5">
                                      <i className="fa-solid fa-box text-gray-400 text-[10px]"></i>
                                      <span>물품 연관 검색어</span>
                                  </span>
                                  <span className="text-[9px] text-gray-400 font-medium">{matchedProducts.length}개</span>
                              </div>
                              {matchedProducts.length > 0 ? (
                                  matchedProducts.slice(0, 10).map((name, idx) => (
                                      <button
                                          key={`prod-${idx}`}
                                          onClick={() => {
                                              setSearchQuery(name);
                                              setActiveSearch(name);
                                              setShowDropdown(false);
                                          }}
                                          className="w-full text-left px-3 py-2 text-xs text-gray-800 hover:bg-gray-50 flex items-center gap-2 border-b border-gray-50 last:border-0 transition cursor-pointer"
                                      >
                                          <i className="fa-solid fa-magnifying-glass text-gray-300 text-[10px]"></i>
                                          <span className="truncate">{highlightText(name, searchQuery, false)}</span>
                                      </button>
                                  ))
                              ) : (
                                  <div className="p-2.5 text-center text-xs text-gray-400">
                                      일치하는 물품 검색어가 없습니다
                                  </div>
                              )}
                          </div>
                      );
                  }

                  // 일반 물품 자체 검색: 기존 검정색 유지 (공백 정규화 및 소문자 매칭)
                  const cleanGeneralQuery = searchQuery.trim().toLowerCase();
                  const matchedProducts = allProductNames.filter(name => (name || '').toLowerCase().includes(cleanGeneralQuery));
                  const matchedTags = allTags.filter(tag => {
                    const cleanT = (tag || '').toLowerCase().replace(/^#+/, '').trim();
                    return cleanT.includes(cleanGeneralQuery) || cleanGeneralQuery.includes(cleanT);
                  });

                  return (
                      <div className="absolute left-0 right-0 mt-2 bg-white rounded-xl border border-gray-100 shadow-xl z-50 overflow-hidden max-h-72 overflow-y-auto animate-fade-in">
                          <div className="p-2 text-[10px] font-bold text-gray-500 bg-gray-50/80 border-b border-gray-50 flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                  <i className="fa-solid fa-magnifying-glass text-[10px]"></i>
                                  <span>물품 연관 검색어</span>
                              </span>
                              <span className="text-[9px] text-gray-400 font-medium">{matchedProducts.length}개</span>
                          </div>
                          
                          {matchedProducts.length > 0 ? (
                              matchedProducts.map((name, idx) => (
                                  <button
                                      key={idx}
                                      onClick={() => {
                                          setSearchQuery(name);
                                          setActiveSearch(name);
                                          setShowDropdown(false);
                                      }}
                                      className="w-full text-left px-3 py-2 text-xs text-gray-800 hover:bg-gray-50 flex items-center gap-2 border-b border-gray-50 last:border-0 transition cursor-pointer"
                                  >
                                      <i className="fa-solid fa-magnifying-glass text-gray-300 text-[10px]"></i>
                                      <span className="truncate">{highlightText(name, searchQuery, false)}</span>
                                  </button>
                              ))
                          ) : (
                              <div className="p-3 text-center text-xs text-gray-400">
                                  일치하는 물품 검색어가 없습니다
                              </div>
                          )}

                          {/* 일반 검색 중에도 매칭되는 해시태그가 있을 때 파란색 관련 태그 섹션 표시 */}
                          {matchedTags.length > 0 && (
                              <div className="border-t border-blue-100 bg-blue-50/20">
                                  <div className="px-2.5 py-1 text-[9px] font-bold text-blue-600 bg-blue-50/80 border-b border-blue-100/60 flex items-center gap-1">
                                      <i className="fa-solid fa-hashtag text-blue-500 text-[9px]"></i>
                                      <span>관련 해시태그</span>
                                  </div>
                                  <div className="p-2 flex flex-wrap gap-1.5">
                                      {matchedTags.map((tag, idx) => (
                                          <button
                                              key={idx}
                                              onClick={() => {
                                                  setSearchQuery(tag);
                                                  setActiveSearch(tag);
                                                  setShowDropdown(false);
                                              }}
                                              className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full hover:bg-blue-600 hover:text-white transition cursor-pointer"
                                          >
                                              <span>{tag}</span>
                                          </button>
                                      ))}
                                  </div>
                              </div>
                          )}
                      </div>
                  );
              })()}
          </div>



          {/* 알림 아이콘 */}
          <button 
              onClick={() => setIsNotificationOpen(true)}
              className="relative p-2 text-gray-600 hover:text-gray-900 transition active:scale-95 shrink-0"
              title="알림 센터 열기"
          >
              <i className="fa-regular fa-bell text-lg"></i>
              {unreadNotifCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white animate-pulse"></span>
              )}
          </button>
      </header>

      {/* 메인 스크롤 영역 (홈 화면일 때 최상단 헤더와 맨 윗 배너 사이 간격을 약 1/3 축소: pt-4(16px) -> pt-2.5(10px)) */}
      <main className={`px-4 pb-4 space-y-6 ${currentView === 'home' ? 'pt-2.5' : 'pt-4'}`}>
          {currentView === 'mypage' ? (
              /* ========================================== */
              /* 5. 마이페이지 화면 */
              /* ========================================== */
              <div className="space-y-4 animate-fade-in pb-4">
                  {/* 상단 타이틀 및 편집 버튼 */}
                  <div className="flex items-center justify-between px-1">
                      <h1 className="text-2xl font-black text-gray-900 tracking-tight">마이페이지</h1>
                      <button 
                          onClick={openEditProfileModal}
                          className="flex flex-col items-center justify-center text-gray-600 hover:text-[#4A5833] transition active:scale-95"
                      >
                          <div className="w-8 h-8 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center">
                              <i className="fa-solid fa-pen text-xs"></i>
                          </div>
                          <span className="text-[10px] font-bold text-gray-500 mt-0.5">수정</span>
                      </button>
                  </div>

                  {/* 메인 프로필 정보 카드 */}
                  <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-4">
                      {/* 프로필 이미지, 이름, 인적사항 */}
                      <div className="flex items-start gap-3.5">
                          <div className="relative shrink-0">
                              <img 
                                  src={userInfo.avatarUrl} 
                                  alt="프로필 사진" 
                                  className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md"
                                  referrerPolicy="no-referrer"
                              />
                              <button 
                                  onClick={openEditProfileModal}
                                  className="absolute bottom-0 right-0 w-5 h-5 bg-[#4A5833] text-white rounded-full flex items-center justify-center text-[10px] shadow"
                              >
                                  <i className="fa-solid fa-camera"></i>
                              </button>
                          </div>

                          <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                  <h2 className="text-base font-black text-gray-900 truncate max-w-[130px]">{userInfo.name}</h2>
                              </div>

                              {/* 사용자 역할 표시 */}
                              <div className="mt-0.5">
                                  {currentUser?.role === 'admin' ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                                          <i className="fa-solid fa-crown text-[9px]"></i> 최고 관리자
                                      </span>
                                  ) : currentUser ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">
                                          <i className="fa-solid fa-user text-[9px]"></i> 일반 유저
                                      </span>
                                  ) : (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                          <i className="fa-solid fa-circle-info text-[9px]"></i> 게스트 유저
                                      </span>
                                  )}
                              </div>

                              {/* 기숙사 위치 */}
                              <p className="text-xs font-semibold text-gray-600 mt-1.5 flex items-center gap-1 truncate">
                                  <i className="fa-solid fa-location-dot text-amber-500 text-xs"></i>
                                  <span className="truncate">{userInfo.dormLocation}</span>
                              </p>
                          </div>
                      </div>

                      {/* 3개 통계 카드 영역 */}
                      <div className="grid grid-cols-3 gap-2 pt-1">
                          {/* 내 등록물품 */}
                          <div 
                              onClick={() => setShowMyProductsModal(true)}
                              className="bg-gray-50/90 hover:bg-gray-100/80 p-3 rounded-2xl text-center border border-gray-100 transition cursor-pointer active:scale-95 flex flex-col items-center justify-center min-h-[64px]"
                          >
                              <div className="text-base font-black text-gray-900 mb-0.5">
                                  {productList.filter(isMyProduct).length}
                              </div>
                              <div className="text-[10px] font-bold text-gray-500">내 등록물품</div>
                          </div>

                          {/* 관심 목록 */}
                          <div 
                              onClick={() => {
                                  handleRequireAuth('관심 목록(찜)을', () => {
                                      setCurrentView('favorites');
                                  });
                              }}
                              className="bg-gray-50/90 hover:bg-gray-100/80 p-3 rounded-2xl text-center border border-gray-100 transition cursor-pointer active:scale-95 flex flex-col items-center justify-center min-h-[64px]"
                          >
                              <div className="text-base font-black text-red-500 mb-0.5">
                                  {favoritedIds.length}
                              </div>
                              <div className="text-[10px] font-bold text-gray-500">관심 목록</div>
                          </div>

                          {/* 완료한 나눔/거래 */}
                          <div 
                              onClick={() => setShowCompletedDealsModal(true)}
                              className="bg-gray-50/90 hover:bg-gray-100/80 p-3 rounded-2xl text-center border border-gray-100 transition cursor-pointer active:scale-95 flex flex-col items-center justify-center min-h-[64px]"
                          >
                              <div className="text-base font-black text-orange-600 mb-0.5">
                                  {productList.filter(p => p.status === '완료').length}
                              </div>
                              <div className="text-[10px] font-bold text-gray-500">완료한 나눔/거래</div>
                          </div>
                      </div>
                  </div>

                  {/* 메뉴 리스트 카드 */}
                  <div className="bg-white rounded-3xl p-2 border border-gray-100 shadow-sm divide-y divide-gray-50 text-xs font-bold text-gray-700">
                      {/* 로그인 / 회원가입 / 로그아웃 버튼 */}
                      {currentUser ? (
                          <div className="p-3 bg-emerald-50/60 rounded-2xl flex items-center justify-between border border-emerald-100">
                              <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                  <div>
                                      <div className="text-emerald-900 font-extrabold">{currentUser.name} 님 로그인 중</div>
                                      <div className="text-[10px] text-emerald-700 font-medium">아이디: {currentUser.username}</div>
                                  </div>
                              </div>
                              <button 
                                  onClick={handleBackendLogout}
                                  className="px-2.5 py-1 bg-red-100 text-red-700 text-[11px] font-bold rounded-lg hover:bg-red-200 transition"
                              >
                                  로그아웃
                              </button>
                          </div>
                      ) : (
                          <button 
                              onClick={() => {
                                  setAuthMode('login');
                                  setIsAuthModalOpen(true);
                              }}
                              className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-[#4A5833]/10 to-amber-50 rounded-2xl transition border border-[#4A5833]/20 hover:border-[#4A5833]"
                          >
                              <span className="flex items-center gap-3 text-[#4A5833] font-black">
                                  <i className="fa-solid fa-right-to-bracket text-base w-4 text-center"></i>
                                  <span>회원가입 및 로그인하기</span>
                              </span>
                              <span className="text-[10px] bg-[#4A5833] text-white font-bold px-2 py-0.5 rounded-md">시작하기</span>
                          </button>
                      )}

                      <button 
                          onClick={() => {
                              handleRequireAuth('물품 등록 서비스를', () => {
                                  setCurrentView('register');
                              });
                          }}
                          className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-2xl transition"
                      >
                          <span className="flex items-center gap-3 text-gray-800">
                              <i className="fa-solid fa-box-archive text-amber-600 text-sm w-4 text-center"></i>
                              <span>새 나눔/중고물품 등록하기</span>
                          </span>
                          <i className="fa-solid fa-chevron-right text-gray-300 text-[10px]"></i>
                      </button>
                  </div>

                  {/* 최고 관리자 전용 대시보드 (최고 관리자 권한 시 표시, 클릭 시 관리자 팝업 열기) */}
                  {userInfo.role === 'admin' && (
                      <div 
                          onClick={() => setIsAdminModalOpen(true)}
                          className="bg-gradient-to-br from-purple-900 to-indigo-900 rounded-3xl p-4 text-white shadow-md cursor-pointer hover:shadow-lg transition-all active:scale-[0.99] border border-purple-800/50 space-y-2.5"
                      >
                          <div className="flex items-center justify-between">
                              <h3 className="text-xs font-black flex items-center gap-1.5 text-amber-300">
                                  <span>👑</span> 최고 관리자 전용 대시보드
                              </h3>
                              <span className="text-[10px] bg-amber-400 text-slate-900 font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                  대시보드 팝업 열기 <i className="fa-solid fa-chevron-right text-[8px]"></i>
                              </span>
                          </div>
                          <p className="text-[11px] text-purple-200 leading-snug">
                              클릭하시면 백엔드 활동 축적 로그, 전체 회원 관리, 전체 물품 관리 및 시스템 종합 현황 팝업이 활성화됩니다.
                          </p>
                      </div>
                  )}

                  {/* 하단 브랜드 푸터 */}
                  <div className="text-center pt-4 pb-2 space-y-1">
                      <p className="text-[11px] font-bold text-gray-400">연근마켓 (Yeongeun Market) v1.0.5</p>
                      <p className="text-[10px] text-gray-400">대학 기숙사 및 학교 생활권 전용 나눔·중고거래 플랫폼</p>
                  </div>
              </div>
          ) : currentView === 'favorites' ? (
              /* ========================================== */
              /* 관심 목록 (찜) 화면 */
              /* ========================================== */
              <div className="space-y-4 animate-fade-in pb-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                      <h1 className="text-lg font-black text-gray-900 flex items-center gap-2">
                          <i className="fa-solid fa-heart text-red-500"></i>
                          내 관심 목록 ({favoritedIds.length}개)
                      </h1>
                      <button 
                          onClick={() => setCurrentView('home')}
                          className="text-xs font-bold text-[#4A5833] hover:underline"
                      >
                          홈으로
                      </button>
                  </div>

                  {favoritedIds.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3">
                          {productList
                              .filter(product => favoritedIds.includes(product.id))
                              .map(product => (
                                  <div 
                                      key={product.id} 
                                      onClick={() => openProductDetail(product)}
                                      className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm relative flex flex-col justify-between cursor-pointer hover:shadow-md transition-all"
                                  >
                                      <button
                                          onClick={async (e) => {
                                              e.stopPropagation();
                                              const nextFavoritedIds = favoritedIds.filter(id => id !== product.id);
                                              setFavoritedIds(nextFavoritedIds);
                                              handleToggleLike(product);
                                          }}
                                          className="absolute top-2 right-2 z-10 w-7 h-7 bg-white/80 rounded-full flex items-center justify-center text-red-500 shadow-sm hover:scale-110 transition"
                                      >
                                          <i className="fa-solid fa-heart text-xs"></i>
                                      </button>

                                      <div className="w-full h-24 bg-gray-100 rounded-xl mb-2 flex items-center justify-center text-gray-400 overflow-hidden">
                                          {product.image ? (
                                              <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                                          ) : (
                                              <i className={`${product.icon} text-3xl`}></i>
                                          )}
                                      </div>
                                      <div>
                                          <h4 className="text-xs font-bold text-gray-800 truncate">{product.name}</h4>
                                          <p className="text-[10px] text-gray-400 mt-0.5">{product.location}</p>
                                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                                              <span className="text-xs font-black text-[#4A5833]">{product.price}</span>
                                              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                                                  {getProductStatusLabel(product)}
                                              </span>
                                          </div>
                                      </div>
                                  </div>
                              ))}
                      </div>
                  ) : (
                      <div className="py-16 text-center bg-white rounded-3xl border border-gray-100 p-6 space-y-3">
                          <div className="w-16 h-16 bg-red-50 text-red-400 rounded-full flex items-center justify-center text-2xl mx-auto">
                              <i className="fa-regular fa-heart"></i>
                          </div>
                          <p className="text-sm font-bold text-gray-700">아직 관심 목록에 담긴 물품이 없어요!</p>
                          <p className="text-xs text-gray-400">마음에 드는 기숙사 나눔 물품의 하트 아이콘을 눌러보세요.</p>
                          <button 
                              onClick={() => setCurrentView('home')}
                              className="mt-2 bg-[#4A5833] text-white font-bold px-4 py-2 rounded-xl text-xs hover:bg-[#3E4C27] transition"
                          >
                              물품 둘러보기
                          </button>
                      </div>
                  )}

                  {/* AI 상품 추천 */}
                  {renderAiRecommendation()}
              </div>
          ) : currentView === 'chat' ? (
              /* ========================================== */
              /* 대화 (채팅) 화면 - 상대를 고르고 1:1 대화 가능 */
              /* ========================================== */
              <div className="space-y-4 animate-fade-in pb-4">
                  {!selectedChatPartner ? (
                      /* (1) 대화 상대 선택 화면 (팝업 말고 메인 앱 화면) */
                      <div className="space-y-4">
                          {/* 상단 타이틀 */}
                          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                              <div>
                                  <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
                                      <i className="fa-regular fa-comments text-[#4A5833]"></i>
                                      기숙사 메이트 대화함
                                  </h1>
                                  <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                                      대화 상대를 선택하여 1:1 실시간 나눔/거래 채팅을 시작하세요
                                  </p>
                              </div>
                              <button 
                                  onClick={() => setCurrentView('home')}
                                  className="text-xs font-bold text-[#4A5833] hover:underline"
                              >
                                  홈으로
                              </button>
                          </div>

                          {/* 검색 필터 바 */}
                          <div className="relative">
                              <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                              <input 
                                  type="text"
                                  value={chatSearchQuery}
                                  onChange={(e) => setChatSearchQuery(e.target.value)}
                                  placeholder="대화 상대 이름 또는 물품명 검색..."
                                  className="w-full bg-white border border-gray-200 text-xs py-2.5 pl-9 pr-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#4A5833]/30 shadow-xs font-medium"
                              />
                          </div>

                          {/* 대화 상대 목록 */}
                          <div className="space-y-2.5">
                              {(() => {
                                  const queryLower = chatSearchQuery.toLowerCase().trim();
                                  const filtered = chatPartners.filter(p => 
                                      p.name.toLowerCase().includes(queryLower) || 
                                      p.productName.toLowerCase().includes(queryLower) ||
                                      p.room.toLowerCase().includes(queryLower)
                                  );

                                  return (
                                      <>
                                          <div className="flex items-center justify-between px-1">
                                              <span className="text-xs font-extrabold text-gray-700">
                                                  대화 상대 목록 ({filtered.length})
                                              </span>
                                              <span className="text-[10px] font-bold text-[#4A5833] bg-[#E5ECD3] px-2 py-0.5 rounded-full">
                                                  실시간 대화 가능
                                              </span>
                                          </div>

                                          {filtered.length > 0 ? (
                                              filtered.map((partner) => (
                                                  <div 
                                                      key={partner.id}
                                                      onClick={() => {
                                                          setSelectedChatPartner(partner);
                                                          setChatPartners(prev => prev.map(p => p.id === partner.id ? { ...p, unreadCount: 0 } : p));
                                                      }}
                                                      className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-[#4A5833]/30 transition-all cursor-pointer flex items-center justify-between gap-3 active:scale-[0.99]"
                                                  >
                                                      <div className="flex items-center gap-3 min-w-0 flex-1">
                                                          <div className="relative shrink-0">
                                                              <img 
                                                                  src={partner.avatar} 
                                                                  alt={partner.name}
                                                                  className="w-12 h-12 rounded-full object-cover border border-gray-200 shadow-xs" 
                                                              />
                                                          </div>
                                                          <div className="min-w-0 flex-1">
                                                              <div className="flex items-center gap-2 mb-0.5">
                                                                  <h3 className="text-xs font-black text-gray-800 truncate">
                                                                      {partner.name}
                                                                  </h3>
                                                                  <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded font-medium shrink-0">
                                                                      {partner.room}
                                                                  </span>
                                                              </div>
                                                              <div className="flex items-center gap-1.5 mb-1">
                                                                  <span className="text-[10px] font-bold text-[#4A5833] bg-[#E5ECD3]/80 px-1.5 py-0.2 rounded flex items-center gap-1">
                                                                      <i className={`${partner.productIcon} text-[9px]`}></i>
                                                                      {partner.productName}
                                                                  </span>
                                                                  <span className="text-[10px] font-extrabold text-gray-500">
                                                                      {partner.productPrice}
                                                                  </span>
                                                              </div>
                                                              <p className={`text-xs truncate ${partner.unreadCount > 0 ? 'font-black text-gray-900' : 'text-gray-500 font-medium'}`}>
                                                                  {partner.lastMessage}
                                                              </p>
                                                          </div>
                                                      </div>

                                                      <div className="flex flex-col items-end gap-1 shrink-0">
                                                          <span className="text-[10px] font-bold text-gray-400">
                                                              {partner.lastTime}
                                                          </span>
                                                          {partner.unreadCount > 0 ? (
                                                              <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-bounce">
                                                                  {partner.unreadCount} NEW
                                                              </span>
                                                          ) : (
                                                              <i className="fa-solid fa-chevron-right text-gray-300 text-xs mt-1"></i>
                                                          )}
                                                      </div>
                                                  </div>
                                              ))
                                          ) : (
                                              <div className="py-8 text-center bg-white rounded-2xl border border-gray-100 text-gray-400 text-xs">
                                                  검색 조건과 일치하는 대화 상대가 없습니다.
                                              </div>
                                          )}
                                      </>
                                  );
                              })()}
                          </div>
                      </div>
                  ) : (
                      /* (2) 1:1 대화창 (채팅방) */
                      <div className="space-y-3">
                          {/* 대화방 상단 헤더 & 뒤로가기 */}
                          <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                              <button 
                                  onClick={() => setSelectedChatPartner(null)}
                                  className="flex items-center gap-1.5 text-xs font-bold text-[#4A5833] hover:bg-gray-50 px-2.5 py-1.5 rounded-xl transition"
                              >
                                  <i className="fa-solid fa-arrow-left"></i>
                                  <span>대화 목록</span>
                              </button>
                              <div className="flex items-center gap-2">
                                  <img 
                                      src={selectedChatPartner.avatar} 
                                      alt={selectedChatPartner.name}
                                      className="w-8 h-8 rounded-full object-cover border border-gray-200" 
                                  />
                                  <div>
                                      <h3 className="text-xs font-black text-gray-900 flex items-center gap-1">
                                          {selectedChatPartner.name}
                                          <span className="w-2 h-2 bg-emerald-500 rounded-full inline-block"></span>
                                      </h3>
                                      <p className="text-[10px] text-gray-400 font-bold">{selectedChatPartner.room}</p>
                                  </div>
                              </div>
                          </div>

                          {/* 대화 물품 상단 요약 카트 */}
                          <div className="bg-[#E5ECD3]/50 p-2.5 rounded-2xl border border-[#C2CEAB]/50 flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-[#4A5833] font-bold shadow-xs">
                                      <i className={`${selectedChatPartner.productIcon} text-sm`}></i>
                                  </div>
                                  <div>
                                      <span className="text-[10px] text-[#4A5833] font-extrabold">대화 대상 물품</span>
                                      <h4 className="font-extrabold text-gray-800 leading-tight">{selectedChatPartner.productName}</h4>
                                  </div>
                              </div>
                              <div className="text-right">
                                  <span className="text-xs font-black text-[#4A5833]">{selectedChatPartner.productPrice}</span>
                                  <p className="text-[9px] text-gray-500 font-bold">직거래 약속 가능</p>
                              </div>
                          </div>

                          {/* 메시지 히스토리 박스 */}
                          <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm min-h-[320px] max-h-[420px] overflow-y-auto space-y-3">
                              <div className="text-center my-2">
                                  <span className="text-[10px] bg-gray-100 text-gray-500 font-bold px-3 py-1 rounded-full">
                                      🌱 안전한 기숙사 직거래 대화가 시작되었습니다
                                  </span>
                              </div>

                              {selectedChatPartner.messages.map((msg) => (
                                  <div 
                                      key={msg.id}
                                      className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'}`}
                                  >
                                      <div className="flex items-end gap-1.5 max-w-[80%]">
                                          {msg.sender === 'partner' && (
                                              <img 
                                                  src={selectedChatPartner.avatar} 
                                                  alt="partner" 
                                                  className="w-6 h-6 rounded-full object-cover shrink-0 mb-1 border border-gray-200"
                                              />
                                          )}
                                          {msg.sender === 'me' && (
                                              <span className="text-[9px] text-gray-400 font-bold mb-1 shrink-0">{msg.timestamp}</span>
                                          )}
                                          <div 
                                              className={`rounded-2xl text-xs leading-relaxed font-medium break-words overflow-hidden ${
                                                  msg.imageUrl && !msg.text
                                                      ? 'p-0 bg-transparent border-0 shadow-none'
                                                      : `p-3 shadow-xs ${
                                                          msg.sender === 'me'
                                                              ? 'bg-[#4A5833] text-white rounded-tr-none'
                                                              : 'bg-gray-100 text-gray-800 rounded-tl-none border border-gray-200/50'
                                                      }`
                                              }`}
                                          >
                                              {msg.imageUrl && (
                                                  <div className={msg.text ? 'mb-2 rounded-xl overflow-hidden' : 'rounded-2xl overflow-hidden'}>
                                                      <img 
                                                          src={msg.imageUrl} 
                                                          alt="첨부 이미지" 
                                                          onClick={() => setChatImageModal(msg.imageUrl || null)}
                                                          className="max-w-[220px] sm:max-w-[260px] max-h-[260px] object-cover rounded-2xl cursor-pointer hover:opacity-95 transition border border-black/10"
                                                      />
                                                  </div>
                                              )}
                                              {msg.text && <div>{msg.text}</div>}
                                          </div>
                                          {msg.sender === 'partner' && (
                                              <span className="text-[9px] text-gray-400 font-bold mb-1 shrink-0">{msg.timestamp}</span>
                                          )}
                                      </div>
                                  </div>
                              ))}
                          </div>

                          {/* 빠른 답장 칩 */}
                          <div className="flex gap-1.5 overflow-x-auto pb-1 text-[11px] font-bold">
                              {[
                                  '📍 A동 1층 로비에서 만나요!',
                                  '⏰ 오늘 저녁 7시 괜찮으신가요?',
                                  '👍 네! 나눔 감사드립니다.',
                                  '❓ 물품 상태는 괜찮나요?'
                              ].map((chip, idx) => (
                                  <button
                                      key={idx}
                                      onClick={() => {
                                          setChatInputText(chip);
                                      }}
                                      className="bg-white hover:bg-[#E5ECD3] text-gray-700 hover:text-[#4A5833] border border-gray-200 rounded-full px-3 py-1 shrink-0 transition text-[10px] shadow-xs"
                                  >
                                      {chip}
                                  </button>
                              ))}
                          </div>

                          {/* 메시지 첨부 이미지 미리보기 */}
                          {chatImagePreview && (
                              <div className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-2xl animate-fade-in">
                                  <div className="relative">
                                      <img 
                                          src={chatImagePreview} 
                                          alt="첨부 예정 사진" 
                                          className="w-14 h-14 object-cover rounded-xl border border-gray-300 shadow-xs"
                                      />
                                      <button
                                          type="button"
                                          onClick={() => setChatImagePreview(null)}
                                          className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shadow-sm hover:bg-red-600 transition cursor-pointer"
                                      >
                                          <i className="fa-solid fa-xmark"></i>
                                      </button>
                                  </div>
                                  <div className="text-[11px] text-gray-600 font-medium">
                                      📷 사진이 첨부되었습니다.<br/>
                                      <span className="text-[10px] text-gray-400">전송 버튼을 누르면 메시지와 함께 전달됩니다.</span>
                                  </div>
                              </div>
                          )}

                          {/* 메시지 입력 창 */}
                          <form 
                              onSubmit={(e) => {
                                  e.preventDefault();
                                  handleSendMessage();
                              }}
                              className="flex items-center gap-1.5"
                          >
                              <input 
                                  type="file" 
                                  ref={chatFileInputRef} 
                                  accept="image/*" 
                                  onChange={handleChatImageSelect} 
                                  className="hidden" 
                              />

                              {/* 앨범 사진 첨부 버튼 */}
                              <button
                                  type="button"
                                  onClick={() => chatFileInputRef.current?.click()}
                                  className="p-3 bg-gray-100 hover:bg-[#E5ECD3] text-gray-600 hover:text-[#4A5833] rounded-2xl transition flex items-center justify-center shrink-0 cursor-pointer"
                                  title="사진 앨범에서 선택"
                              >
                                  <i className="fa-regular fa-image text-sm"></i>
                              </button>

                              {/* 카메라 바로 촬영 버튼 */}
                              <button
                                  type="button"
                                  onClick={() => setIsChatCameraOpen(true)}
                                  className="p-3 bg-gray-100 hover:bg-[#E5ECD3] text-gray-600 hover:text-[#4A5833] rounded-2xl transition flex items-center justify-center shrink-0 cursor-pointer"
                                  title="카메라로 직접 촬영"
                              >
                                  <i className="fa-solid fa-camera text-sm"></i>
                              </button>

                              <input 
                                  type="text"
                                  value={chatInputText}
                                  onChange={(e) => setChatInputText(e.target.value)}
                                  placeholder="메시지를 입력하거나 사진을 첨부하세요..."
                                  className="flex-1 bg-white border border-gray-200 text-xs px-3.5 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#4A5833]/30 shadow-xs font-medium"
                              />

                              <button 
                                  type="submit"
                                  disabled={!chatInputText.trim() && !chatImagePreview}
                                  className="bg-[#4A5833] hover:bg-[#3E4C27] disabled:opacity-40 text-white font-black px-4 py-3 rounded-2xl text-xs transition active:scale-95 shadow-md flex items-center justify-center gap-1 shrink-0 cursor-pointer"
                              >
                                  <span>전송</span>
                                  <i className="fa-solid fa-paper-plane text-xs"></i>
                              </button>
                          </form>
                      </div>
                  )}

                  {/* AI 상품 추천 */}
                  {renderAiRecommendation()}
              </div>
          ) : currentView === 'register' ? (
              <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-5 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                      <div>
                          <h2 className="font-bold text-gray-800 text-base flex items-center gap-1.5">
                              ✨ 기숙사 물품 등록하기
                          </h2>
                          <p className="text-[11px] text-gray-500 mt-0.5">기숙사 메이트와 소중한 물품을 함께 나누어요.</p>
                      </div>
                      <button 
                          onClick={() => setCurrentView('home')}
                          className="text-gray-400 hover:text-gray-600 p-1"
                      >
                          <i className="fa-solid fa-xmark text-lg"></i>
                      </button>
                  </div>

                  <form onSubmit={async (e) => {
                      e.preventDefault();
                      if (!currentUser) {
                          alert('🔒 로그인이 필요한 서비스입니다.\n로그인 후 물품을 등록하실 수 있습니다!');
                          setAuthMode('login');
                          setIsAuthModalOpen(true);
                          return;
                      }

                      if (!registerName.trim()) {
                          alert('물품 이름을 입력해주세요!');
                          return;
                      }

                      let finalPrice = '';
                      if (selectedPriceOption === '기타') {
                          if (!customPriceInput.trim()) {
                              alert('기타 가격 또는 방식을 직접 입력해주세요!');
                              return;
                          }
                          finalPrice = customPriceInput.trim();
                          if (!finalPrice.endsWith('원') && !finalPrice.includes('무료') && !finalPrice.includes('나눔')) {
                              finalPrice = `${finalPrice}원`;
                          }
                      } else if (selectedPriceOption === '무료 나눔') {
                          finalPrice = '나눔 (무료)';
                      } else {
                          finalPrice = selectedPriceOption;
                      }

                      const productData = {
                          name: registerName.trim(),
                          category: registerCategory,
                          location: registerLocation.trim() || currentUser.location || 'A동 로비',
                          price: finalPrice,
                          icon: registerIcon || CATEGORY_ICON_MAP[registerCategory] || 'fa-solid fa-box',
                          imageUrl: uploadedImage || undefined,
                          image: uploadedImage || undefined,
                          status: (finalPrice.includes('무료') || finalPrice.includes('나눔') ? '무료' : '나눔중') as any,
                          date: new Date().toISOString().split('T')[0],
                          seller: `${currentUser.name} (${currentUser.location || '기숙사'})`,
                          sellerUsername: currentUser.username,
                          description: registerDescription.trim() || "기숙사에서 함께 쓰기 좋아서 나눔/판매하는 깨끗한 물건입니다. 편하게 문의주세요!",
                          tags: registerTags.length > 0 ? registerTags : undefined,
                          likes: 0,
                          views: 0
                      };

                      const createdProduct = await addProduct(productData);

                      if (createdProduct) {
                          setProductList(prev => [createdProduct, ...prev.filter(p => String(p.id) !== String(createdProduct.id))]);
                      }

                      // 알림 생성
                      const newNotif = {
                          id: `notif_reg_${Date.now()}`,
                          title: `📦 물품 등록 완료`,
                          message: `${productData.name} 이 정상적으로 등록되었습니다.`,
                          time: '방금 전',
                          unread: true,
                          type: 'register' as const,
                          icon: 'fa-solid fa-box',
                          iconBg: 'bg-[#EAF2DA] text-[#4A5833]',
                      };
                      setNotifications(prev => [newNotif, ...prev]);

                      // Refresh product list from server asynchronously
                      getProducts((products) => {
                          setProductList(products);
                      });
                      
                      // 검색어 및 등록 폼 상태 초기화
                      setActiveSearch('');
                      setRegisterName('');
                      setRegisterCategory('책 또는 교재');
                      setRegisterTags([]);
                      setTagInput('');
                      setSelectedPriceOption('500원');
                      setCustomPriceInput('');
                      setRegisterPrice('500원');
                      setRegisterLocation('');
                      setRegisterIcon('fa-solid fa-book');
                      setRegisterDescription('');
                      setUploadedImage(null);
                      setCurrentView('home');
                      setIsRegisterModalOpen(false);
                      alert('새 물품이 성공적으로 등록되었습니다!');
                  }} className="space-y-4">
                      
                      {/* 📷 1. 물품 사진 첨부 (카메라 직접 촬영 또는 파일 선택) */}
                      <div className="space-y-2.5 bg-[#F7F9F4] p-3.5 rounded-2xl border border-[#DCE4CF]">
                          <div className="flex items-center justify-between">
                              <label className="block text-xs font-black text-[#3E4C27] flex items-center gap-1.5">
                                  <i className="fa-solid fa-camera text-sm text-[#4A5833]"></i>
                                  <span>물품 사진 등록 (Firebase Storage 원본 업로드)</span>
                              </label>
                              <span className="text-[10px] font-semibold text-gray-500">
                                  (선택)
                              </span>
                          </div>

                          {/* 업로드 로딩 중 표시 */}
                          {isUploadingImage ? (
                              <div className="flex flex-col items-center justify-center p-6 bg-white border-2 border-dashed border-[#4A5833] rounded-2xl shadow-xs animate-pulse">
                                  <div className="w-8 h-8 border-3 border-[#4A5833] border-t-transparent rounded-full animate-spin mb-2"></div>
                                  <span className="text-xs font-black text-[#4A5833]">Firebase Storage에 원본 사진 업로드 중...</span>
                                  <span className="text-[10px] text-gray-500 mt-0.5">AI 재가공 없이 원본 파일 그대로 업로드됩니다</span>
                              </div>
                          ) : uploadedImage ? (
                              <div className="relative rounded-2xl overflow-hidden border-2 border-[#4A5833] bg-white group shadow-sm">
                                  <img 
                                      src={uploadedImage} 
                                      alt="물품 프리뷰" 
                                      className="w-full h-48 object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                      <button
                                          type="button"
                                          onClick={() => {
                                              setCameraTarget('register');
                                              setCameraModalOpen(true);
                                          }}
                                          className="bg-[#4A5833] hover:bg-[#3E4C27] text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95 transition"
                                      >
                                          <i className="fa-solid fa-camera"></i> 다시 촬영
                                      </button>
                                      <button
                                          type="button"
                                          onClick={() => setUploadedImage(null)}
                                          className="bg-red-500 hover:bg-red-600 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95 transition"
                                      >
                                          <i className="fa-solid fa-trash-can"></i> 삭제
                                      </button>
                                  </div>
                              </div>
                          ) : (
                              <div className="grid grid-cols-2 gap-2">
                                  {/* 실시간 카메라 촬영 버튼 */}
                                  <button
                                      type="button"
                                      onClick={() => {
                                          setCameraTarget('register');
                                          setCameraModalOpen(true);
                                      }}
                                      className="flex flex-col items-center justify-center p-3.5 bg-white border-2 border-dashed border-[#4A5833] hover:bg-[#EAF2DA] text-[#4A5833] rounded-2xl transition cursor-pointer active:scale-98 shadow-2xs group"
                                  >
                                      <div className="w-10 h-10 rounded-full bg-[#EAF2DA] group-hover:bg-[#4A5833] group-hover:text-white text-[#4A5833] flex items-center justify-center text-lg transition mb-1">
                                          <i className="fa-solid fa-camera"></i>
                                      </div>
                                      <span className="text-xs font-black">직접 카메라 촬영</span>
                                      <span className="text-[10px] text-gray-500 font-medium">카메라로 원본 촬영</span>
                                  </button>

                                  {/* 갤러리/파일 첨부 버튼 (Firebase Storage 직접 업로드) */}
                                  <label 
                                      className="flex flex-col items-center justify-center p-3.5 bg-white border-2 border-dashed border-gray-300 hover:border-[#4A5833] hover:bg-gray-50 text-gray-700 rounded-2xl transition cursor-pointer active:scale-98 shadow-2xs group"
                                  >
                                      <input 
                                          type="file" 
                                          accept="image/*" 
                                          className="hidden" 
                                          onChange={async (e) => {
                                              const file = e.target.files?.[0];
                                              if (file) {
                                                  setIsUploadingImage(true);
                                                  try {
                                                      const downloadUrl = await uploadImageToFirebaseStorage(file, "item");
                                                      setUploadedImage(downloadUrl);
                                                  } catch (err) {
                                                      console.error("Firebase Storage upload error, falling back:", err);
                                                      const reader = new FileReader();
                                                      reader.onloadend = () => {
                                                          setUploadedImage(reader.result as string);
                                                      };
                                                      reader.readAsDataURL(file);
                                                  } finally {
                                                      setIsUploadingImage(false);
                                                  }
                                              }
                                          }}
                                      />
                                      <div className="w-10 h-10 rounded-full bg-gray-100 group-hover:bg-[#4A5833] group-hover:text-white text-gray-600 flex items-center justify-center text-lg transition mb-1">
                                          <i className="fa-solid fa-image"></i>
                                      </div>
                                      <span className="text-xs font-black">앨범에서 파일 선택</span>
                                      <span className="text-[10px] text-gray-500 font-medium">원본 사진 Storage 업로드</span>
                                  </label>
                              </div>
                          )}
                      </div>
                      
                      {/* 물품 이름 */}
                      <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-[#4A5833]">물품 이름</label>
                          <input 
                              type="text"
                              value={registerName}
                              onChange={(e) => setRegisterName(e.target.value)}
                              placeholder="예: LED 책상 스탠드, 2단 행거"
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#4A5833]/30 focus:bg-white transition"
                              required
                          />
                      </div>

                      {/* 물품 종류 (셀렉트 박스) */}
                      <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-[#4A5833]">물품 종류</label>
                          <select 
                              value={registerCategory}
                              onChange={(e) => {
                                  const selectedCat = e.target.value;
                                  setRegisterCategory(selectedCat);
                                  if (CATEGORY_ICON_MAP[selectedCat]) {
                                      setRegisterIcon(CATEGORY_ICON_MAP[selectedCat]);
                                  }
                              }}
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#4A5833]/30 focus:bg-white transition cursor-pointer font-medium text-gray-800"
                          >
                              {CATEGORY_OPTIONS.map((category) => (
                                  <option key={category} value={category}>
                                      {category}
                                  </option>
                              ))}
                          </select>
                      </div>

                      {/* 🏷️ 태그 (#) 추가 (선택사항) */}
                      <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                              <label className="block text-xs font-bold text-[#4A5833] flex items-center gap-1.5">
                                  <i className="fa-solid fa-hashtag text-[11px]"></i>
                                  <span>태그 추가</span>
                              </label>
                              <span className="text-[10px] font-medium text-gray-400">
                                  (선택)
                              </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                              <div className="relative flex-1 flex items-center">
                                  <span className="absolute left-3 font-black text-sm text-[#4A5833] select-none pointer-events-none">
                                      #
                                  </span>
                                  <input 
                                      type="text"
                                      value={tagInput}
                                      onChange={(e) => {
                                          const val = e.target.value;
                                          setTagInput(val.replace(/^#+/, ''));
                                      }}
                                      onKeyDown={(e) => {
                                          if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
                                              e.preventDefault();
                                              if (tagInput.trim()) {
                                                  handleAddTag();
                                              }
                                          }
                                      }}
                                      placeholder="태그 입력 (예: 건조기, 전공책, 휴지)"
                                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-7 pr-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#4A5833]/30 focus:bg-white transition"
                                  />
                              </div>
                              <button
                                  type="button"
                                  onClick={() => handleAddTag()}
                                  disabled={!tagInput.trim()}
                                  className="px-3.5 py-2.5 bg-[#4A5833] text-white text-xs font-extrabold rounded-xl hover:bg-[#3E4C27] disabled:bg-gray-200 disabled:text-gray-400 transition cursor-pointer shrink-0 shadow-2xs active:scale-95"
                              >
                                  추가
                              </button>
                          </div>

                          {/* 사용자가 글자를 입력했을 때 #이 보이도록 실시간 안내 */}
                          {tagInput.trim() && (
                              <div className="flex items-center gap-1.5 text-[11px] text-[#4A5833] font-bold px-1 animate-fade-in">
                                  <span className="text-gray-400 font-normal">입력 중:</span>
                                  <span className="bg-[#EAF2DA] text-[#3E4C27] px-2 py-0.5 rounded-md border border-[#DCE4CF]">
                                      #{tagInput.trim()}
                                  </span>
                              </div>
                          )}

                          {/* 등록된 태그 목록 칩 */}
                          {registerTags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                  {registerTags.map((tag, idx) => (
                                      <span 
                                          key={idx}
                                          className="inline-flex items-center gap-1.5 bg-[#F4F6F0] text-[#3E4C27] border border-[#DCE4CF] pl-2.5 pr-1.5 py-1 rounded-full text-xs font-extrabold shadow-2xs animate-fade-in"
                                      >
                                          <span>{tag}</span>
                                          <button
                                              type="button"
                                              onClick={() => handleRemoveTag(idx)}
                                              className="w-4 h-4 rounded-full bg-gray-200/80 hover:bg-red-500 hover:text-white text-gray-500 flex items-center justify-center text-[10px] transition cursor-pointer"
                                              title="태그 삭제"
                                          >
                                              <i className="fa-solid fa-xmark"></i>
                                          </button>
                                      </span>
                                  ))}
                              </div>
                          )}
                      </div>

                      {/* 가격 / 나눔 방식 (선택형 UI) */}
                      <div className="space-y-2">
                          <label className="block text-xs font-bold text-[#4A5833]">가격 또는 나눔 방식</label>
                          <div className="grid grid-cols-3 gap-2">
                              {[
                                  '500원',
                                  '1000원',
                                  '2000원',
                                  '3000원',
                                  '5000원',
                                  '무료 나눔',
                                  '기타'
                              ].map((option) => (
                                  <button
                                      key={option}
                                      type="button"
                                      onClick={() => {
                                          setSelectedPriceOption(option);
                                          if (option !== '기타') {
                                              setRegisterPrice(option === '무료 나눔' ? '나눔 (무료)' : option);
                                          } else {
                                              setRegisterPrice(customPriceInput || '');
                                          }
                                      }}
                                      className={`h-10 px-2 rounded-xl border text-xs font-bold transition-all text-center flex items-center justify-center gap-1 whitespace-nowrap ${
                                          selectedPriceOption === option 
                                              ? 'border-[#4A5833] bg-[#4A5833] text-white shadow-sm ring-1 ring-[#4A5833]' 
                                              : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 hover:border-gray-300'
                                      }`}
                                  >
                                      {option === '무료 나눔' ? '🎁 무료 나눔' : option === '기타' ? '✏️ 기타' : option}
                                  </button>
                              ))}
                          </div>

                          {/* 기타 선택 시 직접 입력하는 input 창 */}
                          {selectedPriceOption === '기타' && (
                              <div className="pt-1.5 animate-fade-in">
                                  <input 
                                      type="text"
                                      value={customPriceInput}
                                      onChange={(e) => {
                                          setCustomPriceInput(e.target.value);
                                          setRegisterPrice(e.target.value);
                                      }}
                                      placeholder="가격 또는 방식을 직접 입력해주세요 (예: 4,000원)"
                                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#4A5833]/30 focus:bg-white transition"
                                      required
                                  />
                              </div>
                          )}
                      </div>

                      {/* 내 방 번호 / 위치 */}
                      <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-[#4A5833]">기숙사 방 번호 / 나눔 장소</label>
                          <input 
                              type="text"
                              value={registerLocation}
                              onChange={(e) => setRegisterLocation(e.target.value)}
                              placeholder="예: A동 302호, C동 로비 (기본값: A동 로비)"
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#4A5833]/30 focus:bg-white transition"
                          />
                      </div>

                      {/* 물품 상세 설명 */}
                      <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-[#4A5833]">상세 설명</label>
                          <textarea 
                              value={registerDescription}
                              onChange={(e) => setRegisterDescription(e.target.value)}
                              placeholder="물품의 상태, 사용 기간, 기숙사 메이트와 만나서 거래하고 싶은 구체적인 설명 등을 적어주세요."
                              rows={3}
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#4A5833]/30 focus:bg-white transition resize-none"
                          />
                      </div>

                      {/* 아이콘 선택 */}
                      <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-[#4A5833]">물품 아이콘 선택</label>
                          <div className="grid grid-cols-3 gap-2">
                              {[
                                  { icon: 'fa-solid fa-shirt', label: '의류 관련' },
                                  { icon: 'fa-solid fa-pen-ruler', label: '문구류 관련' },
                                  { icon: 'fa-solid fa-soap', label: '욕실용품 관련' },
                                  { icon: 'fa-solid fa-plug', label: '전자기기 관련' },
                                  { icon: 'fa-solid fa-book', label: '도서/서적 관련' },
                                  { icon: 'fa-solid fa-box', label: '기타' }
                              ].map((item) => (
                                  <button
                                      key={item.icon}
                                      type="button"
                                      onClick={() => setRegisterIcon(item.icon)}
                                      className={`flex flex-col items-center justify-center p-2 rounded-xl border transition ${
                                          registerIcon === item.icon 
                                              ? 'border-[#4A5833] bg-[#E5ECD3]/30 text-[#4A5833]' 
                                              : 'border-gray-100 bg-gray-50 text-gray-400 hover:bg-gray-100'
                                      }`}
                                  >
                                      <i className={`${item.icon} text-base mb-1`}></i>
                                      <span className="text-[10px] font-medium leading-none">{item.label}</span>
                                  </button>
                              ))}
                          </div>
                      </div>

                      {/* 최종 버튼들 */}
                      <div className="flex gap-2.5 pt-3">
                          <button
                              type="button"
                              onClick={() => setCurrentView('home')}
                              className="flex-1 bg-gray-100 text-gray-500 font-bold py-2.5 rounded-xl text-xs hover:bg-gray-200 transition"
                          >
                              취소하기
                          </button>
                          <button
                              type="submit"
                              className="flex-1 bg-[#4A5833] text-white font-bold py-2.5 rounded-xl text-xs hover:bg-[#3E4C27] active:scale-[0.98] transition-all shadow-sm"
                          >
                              등록하기
                          </button>
                      </div>
                  </form>
              </section>
          ) : currentView === 'category' ? (
              /* ========================================== */
              /* 카테고리 전용 화면 (상단 가로 스크롤바 태그 포함) */
              /* ========================================== */
              <div className="space-y-4 animate-fade-in pb-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                      <h1 className="text-lg font-black text-gray-900 flex items-center gap-2">
                          <i className="fa-solid fa-border-all text-[#4A5833]"></i>
                          기숙사 카테고리 물품
                      </h1>
                      <button 
                          onClick={() => {
                              setCurrentView('home');
                              setActiveSearch('');
                              setSearchQuery('');
                          }}
                          className="text-xs font-bold text-[#4A5833] hover:underline"
                      >
                          홈으로
                      </button>
                  </div>

                  {/* 상단 가로 스크롤바 카테고리 태그 */}
                  <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm space-y-2">
                      <div className="text-[11px] font-bold text-gray-500 flex items-center justify-between px-1">
                          <span>카테고리 선택</span>
                          <span className="text-[#4A5833] font-black">{activeSearch || '전체'}</span>
                      </div>
                      <div className="flex gap-1.5 overflow-x-auto custom-horizontal-scrollbar pb-2.5 pt-0.5 -mx-1 px-1">
                          <button
                              onClick={() => setActiveSearch('')}
                              className={`px-3 py-1.5 rounded-full text-xs font-extrabold shrink-0 transition flex items-center gap-1.5 shadow-sm cursor-pointer ${
                                  !activeSearch 
                                      ? 'bg-[#4A5833] text-white ring-2 ring-[#4A5833]/30' 
                                      : 'bg-gray-50 text-gray-600 border border-gray-200/80 hover:bg-gray-100'
                              }`}
                          >
                              <i className={`fa-solid fa-layer-group text-[11px] ${!activeSearch ? 'text-white' : 'text-[#4A5833]'}`}></i>
                              <span>전체</span>
                          </button>
                          {CATEGORY_OPTIONS.map((cat) => (
                              <button
                                  key={cat}
                                  onClick={() => {
                                      setActiveSearch(cat);
                                  }}
                                  className={`px-3 py-1.5 rounded-full text-xs font-extrabold shrink-0 transition flex items-center gap-1.5 shadow-sm cursor-pointer ${
                                      activeSearch === cat 
                                          ? 'bg-[#4A5833] text-white ring-2 ring-[#4A5833]/30' 
                                          : 'bg-gray-50 text-gray-600 border border-gray-200/80 hover:bg-gray-100'
                                  }`}
                              >
                                  <i className={`${CATEGORY_ICON_MAP[cat] || 'fa-solid fa-box'} text-[11px] ${activeSearch === cat ? 'text-white' : 'text-[#4A5833]'}`}></i>
                                  <span>{cat}</span>
                              </button>
                          ))}
                      </div>
                  </div>

                  {/* 선택한 카테고리 결과 헤더 및 상품 목록 */}
                  <div className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                          <h2 className="text-sm font-black text-gray-800 flex items-center gap-1.5">
                              {activeSearch ? (
                                  activeSearch.startsWith('#') ? (
                                      <span className="text-blue-600 flex items-center gap-1.5">
                                          <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-black">#</span>
                                          <span>'{activeSearch}' 해시태그 목록 ({filteredProducts.length}개)</span>
                                      </span>
                                  ) : (
                                      <>
                                          <i className={`${CATEGORY_ICON_MAP[activeSearch] || 'fa-solid fa-box'} text-[#4A5833]`}></i>
                                          <span>'{activeSearch}' 목록 ({filteredProducts.length}개)</span>
                                      </>
                                  )
                              ) : (
                                  <>
                                      <i className="fa-solid fa-boxes-stacked text-[#4A5833]"></i>
                                      <span>전체 카테고리 물품 ({productList.length}개)</span>
                                  </>
                              )}
                          </h2>
                          {activeSearch && (
                              <button 
                                  onClick={() => setActiveSearch('')}
                                  className="text-[11px] text-gray-400 hover:text-gray-600 font-bold"
                              >
                                  필터 해제
                              </button>
                          )}
                      </div>

                      {filteredProducts.length > 0 ? (
                          <div className="grid grid-cols-2 gap-3">
                              {filteredProducts.map(product => (
                                  <div 
                                      key={product.id} 
                                      onClick={() => openProductDetail(product)}
                                      className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm relative flex flex-col justify-between cursor-pointer hover:shadow-md transition-all"
                                  >
                                      <button
                                          onClick={async (e) => {
                                              e.stopPropagation();
                                              const isLiked = favoritedIds.includes(product.id);
                                              const nextFavoritedIds = isLiked
                                                  ? favoritedIds.filter(id => id !== product.id)
                                                  : [...favoritedIds, product.id];
                                              setFavoritedIds(nextFavoritedIds);
                                              handleToggleLike(product);
                                          }}
                                          className={`absolute top-2 right-2 z-10 w-7 h-7 bg-white/80 rounded-full flex items-center justify-center shadow-sm hover:scale-110 transition ${
                                              favoritedIds.includes(product.id) ? 'text-red-500' : 'text-gray-300 hover:text-red-400'
                                          }`}
                                      >
                                          <i className="fa-solid fa-heart text-xs"></i>
                                      </button>

                                      <div className="w-full h-24 bg-gray-100 rounded-xl mb-2 flex items-center justify-center text-gray-400 overflow-hidden">
                                          {product.image ? (
                                              <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                                          ) : (
                                              <i className={`${product.icon} text-3xl`}></i>
                                          )}
                                      </div>
                                      <div>
                                          <div className="flex items-center justify-between gap-1 mb-0.5">
                                              <span className="text-[9px] font-bold text-[#4A5833] bg-[#E5ECD3] px-1.5 py-0.5 rounded">
                                                  {product.category || '기타'}
                                              </span>
                                          </div>
                                          <h4 className="text-xs font-bold text-gray-800 truncate">{product.name}</h4>
                                          <p className="text-[10px] text-gray-400 mt-0.5">{product.location}</p>
                                          {product.tags && product.tags.length > 0 && (
                                              <div className="flex items-center gap-1 overflow-hidden mt-1">
                                                  {product.tags.slice(0, 2).map((t, idx) => (
                                                      <span key={idx} className="text-[9px] font-bold text-[#3E4C27] bg-[#EAF2DA] px-1.5 py-0.5 rounded truncate max-w-[75px]">
                                                          {t}
                                                      </span>
                                                  ))}
                                                  {product.tags.length > 2 && (
                                                      <span className="text-[8px] font-semibold text-gray-400">+{product.tags.length - 2}</span>
                                                  )}
                                              </div>
                                          )}
                                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                                              <span className="text-xs font-black text-[#4A5833]">{product.price}</span>
                                              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                                                  {getProductStatusLabel(product)}
                                              </span>
                                          </div>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      ) : (
                          <div className="py-12 text-center bg-white rounded-3xl border border-gray-100 p-6 space-y-3">
                              <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center text-2xl mx-auto">
                                  <i className="fa-solid fa-box-open"></i>
                              </div>
                              <p className="text-sm font-bold text-gray-700">해당 카테고리에 등록된 나눔 물품이 없습니다.</p>
                              <p className="text-xs text-gray-400">첫 번째 나눔 물품의 주인공이 되어보세요!</p>
                              <button 
                                  onClick={() => handleRequireAuth('물품 등록 서비스를', () => setCurrentView('register'))}
                                  className="mt-2 bg-[#4A5833] text-white font-bold px-4 py-2 rounded-xl text-xs hover:bg-[#3E4C27] transition"
                              >
                                  물품 등록하기
                              </button>
                          </div>
                      )}
                  </div>
              </div>
          ) : (
              <>
                  {/* 배너 그룹 (상단 이벤트 배너 + 물품 등록 배너 - 간격 50% 축소) */}
                  <div className="space-y-3">
                      {/* 0. 상단 이벤트 광고 배너 (Firebase Storage 영구 보관 & 실시간 렌더링) */}
                      <section 
                          className="relative rounded-2xl overflow-hidden shadow-xs border border-amber-200/90 bg-[#FFFDF5] cursor-pointer hover:shadow-md active:scale-[0.99] transition-all duration-200 group"
                          title="연근마켓 특별 이벤트 배너"
                      >
                          <img 
                              src={topEventBannerUrl || "https://i.ibb.co/PvMGnBvN/upperbanner-png.jpg"} 
                              onError={(e) => {
                                  const target = e.currentTarget;
                                  if (target.src !== '/upperbanner-png.jpg' && !target.src.endsWith('/upperbanner-png.jpg')) {
                                      target.src = '/upperbanner-png.jpg';
                                  }
                              }}
                              alt="연근마켓 맨 위 상단 배너" 
                              className="w-full h-auto block object-cover group-hover:brightness-[1.02] transition-all select-none"
                              referrerPolicy="no-referrer"
                          />
                      </section>

                      {/* 1. 메인 배너 (Firebase Storage 영구 보관 & 실시간 렌더링) */}
                      <section 
                          onClick={() => handleRequireAuth('물품 등록 서비스를', () => setCurrentView('register'))}
                          className="relative rounded-2xl overflow-hidden shadow-sm border border-[#EAE5D8] cursor-pointer hover:shadow-md active:scale-[0.99] transition-all duration-200 group bg-[#FAF7EE]"
                          title="물품 등록하러 가기"
                      >
                          <img 
                              src={homeBannerUrl || "https://i.ibb.co/0p8r3cLM/banner-png.jpg"} 
                              onError={(e) => {
                                  const target = e.currentTarget;
                                  if (target.src !== '/banner_register.jpg' && !target.src.endsWith('/banner_register.jpg')) {
                                      target.src = '/banner_register.jpg';
                                  } else if (target.src !== '/KakaoTalk_20260902_181037717.jpg' && !target.src.endsWith('/KakaoTalk_20260902_181037717.jpg')) {
                                      target.src = '/KakaoTalk_20260902_181037717.jpg';
                                  }
                              }}
                              alt="연근마켓 등록하기 배너" 
                              className="w-full h-auto block object-cover group-hover:brightness-[1.02] transition-all select-none"
                              referrerPolicy="no-referrer"
                          />
                      </section>
                  </div>

                  {/* ========================================== */}
                  {/* 검색 결과 섹션 */}
                  {/* ========================================== */}
                  {activeSearch && (
                      <section className={`rounded-2xl p-4 border shadow-sm ${activeSearch.startsWith('#') ? 'bg-blue-50/20 border-blue-100' : 'bg-white border-gray-100'}`}>
                          <div className="flex items-center justify-between mb-4">
                              <h2 className="font-bold text-base flex items-center gap-1.5">
                                  {activeSearch.startsWith('#') ? (
                                      <span className="text-blue-600 flex items-center gap-1.5">
                                          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-black">
                                              #
                                          </span>
                                          <span>'{activeSearch}' 해시태그 검색 결과 ({filteredProducts.length}개)</span>
                                      </span>
                                  ) : (
                                      <span className="text-gray-800 flex items-center gap-1.5">
                                          <span>🔍 '{activeSearch}' 검색 결과 ({filteredProducts.length}개)</span>
                                      </span>
                                  )}
                              </h2>
                              <button 
                                  onClick={() => {
                                      setSearchQuery('');
                                      setActiveSearch('');
                                  }}
                                  className={`text-xs font-semibold hover:underline cursor-pointer ${activeSearch.startsWith('#') ? 'text-blue-600' : 'text-[#4A5833]'}`}
                              >
                                  전체 목록 보기
                              </button>
                          </div>
                          
                          {filteredProducts.length > 0 ? (
                              <div className="grid grid-cols-2 gap-3">
                                  {filteredProducts.map(product => {
                                      const isLiked = favoritedIds.includes(product.id);
                                      return (
                                          <div 
                                              key={product.id} 
                                              onClick={() => openProductDetail(product)}
                                              className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm relative flex flex-col justify-between cursor-pointer hover:shadow-md hover:border-gray-200 transition-all active:scale-[0.98]"
                                          >
                                              {/* 찜 하트 버튼 */}
                                              <button
                                                  onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleToggleLike(product);
                                                  }}
                                                  className="absolute top-2 right-2 z-10 w-7 h-7 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 shadow-sm transition"
                                              >
                                                  <i className={`${isLiked ? 'fa-solid text-red-500' : 'fa-regular'} fa-heart text-xs`}></i>
                                              </button>

                                              <div className="w-full h-24 bg-gray-100 rounded-lg mb-2 flex items-center justify-center text-gray-400 overflow-hidden">
                                                  {product.image ? (
                                                      <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                                                  ) : (
                                                      <i className={`${product.icon} text-3xl`}></i>
                                                  )}
                                              </div>
                                              <div>
                                                  <h4 className="text-xs font-semibold text-gray-800 truncate">{product.name}</h4>
                                                  <div className="flex items-center justify-between text-[10px] text-gray-400 mt-0.5">
                                                      <span>{product.location}</span>
                                                      <span className="flex items-center gap-1 text-[9px]"><i className="fa-regular fa-eye"></i> {product.views || 0}</span>
                                                  </div>
                                                   {product.tags && product.tags.length > 0 && (
                                                       <div className="flex items-center gap-1 overflow-hidden mt-1">
                                                           {product.tags.slice(0, 2).map((t, idx) => (
                                                               <span key={idx} className="text-[9px] font-bold text-[#3E4C27] bg-[#EAF2DA] px-1.5 py-0.5 rounded truncate max-w-[75px]">
                                                                   {t}
                                                               </span>
                                                           ))}
                                                           {product.tags.length > 2 && (
                                                               <span className="text-[8px] font-semibold text-gray-400">+{product.tags.length - 2}</span>
                                                           )}
                                                       </div>
                                                   )}
                                                  
                                                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                                                      <span className="text-xs font-bold text-[#4A5833]">{product.price}</span>
                                                      <div className="flex items-center gap-1">
                                                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                                                              product.status === '완료' 
                                                                  ? 'bg-gray-100 text-gray-400' 
                                                                  : 'bg-emerald-50 text-emerald-600'
                                                          }`}>
                                                              {getProductStatusLabel(product)}
                                                          </span>
                                                          {product.status !== '완료' && (
                                                              <button
                                                                  onClick={async (e) => {
                                                                      e.stopPropagation();
                                                                      await updateProductStatus(product.id, '완료');
                                                                      alert(`'${product.name}' 상태가 '완료'로 변경되었습니다.`);
                                                                  }}
                                                                  className="text-[9px] bg-[#E5ECD3] text-[#4A5833] font-bold px-1.5 py-0.5 rounded hover:bg-[#4A5833] hover:text-white transition"
                                                              >
                                                                  완료
                                                              </button>
                                                          )}
                                                      </div>
                                                  </div>
                                              </div>
                                          </div>
                                      );
                                  })}
                              </div>
                          ) : (
                              <div className="py-12 text-center">
                                  <div className="text-gray-300 text-4xl mb-3">
                                      <i className="fa-solid fa-box-open"></i>
                                  </div>
                                  <p className="text-sm text-gray-500 font-medium">검색된 물품이 없습니다.</p>
                                  <p className="text-xs text-gray-400 mt-1">다른 키워드로 검색해 보세요!</p>
                              </div>
                          )}
                      </section>
                  )}

                  {/* 기존 화면 구성 (검색어가 없을 때만 기존 레이아웃 100% 동일하게 렌더링) */}
                  {!activeSearch && (
                      <>
                          {/* 2. 찜 랭킹 (인기 나눔 품목) */}
                          <section>
                              <div className="flex items-center justify-between mb-3">
                                  <h2 className="font-bold text-gray-800 text-base flex items-center gap-1.5">
                                      🔥 찜 랭킹 TOP 3
                                  </h2>
                                  <span className="text-xs text-gray-400">클릭해서 상세 확인</span>
                              </div>
                              <div className="grid grid-cols-3 gap-2.5">
                                  {[...productList]
                                      .sort((a, b) => (b.likes || 0) - (a.likes || 0))
                                      .slice(0, 3)
                                      .map((product, index) => {
                                          const rankLabel = `${index + 1}위`;
                                          const rankBg = index === 0 ? 'bg-red-500' : index === 1 ? 'bg-orange-500' : 'bg-amber-500';
                                          return (
                                              <div 
                                                  key={product.id}
                                                  onClick={() => openProductDetail(product)}
                                                  className="bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm relative cursor-pointer hover:shadow-md hover:border-gray-200 transition-all active:scale-[0.98] flex flex-col justify-between min-h-[145px]"
                                              >
                                                  <span className={`absolute top-2 left-2 ${rankBg} text-white text-[10px] font-bold px-1.5 py-0.5 rounded`}>
                                                      {rankLabel}
                                                  </span>
                                                  <div className="w-full h-16 bg-gray-100 rounded-lg mb-1.5 flex items-center justify-center text-gray-300 overflow-hidden">
                                                      {product.image ? (
                                                          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                                                      ) : (
                                                          <i className={`${product.icon} text-xl`}></i>
                                                      )}
                                                  </div>
                                                  <div className="overflow-hidden">
                                                      <h4 className="text-xs font-semibold text-gray-800 truncate leading-snug">{product.name}</h4>
                                                      <p className="text-[9px] text-gray-400 truncate">{product.location}</p>
                                                      <div className="flex items-center justify-between mt-1 text-[9px] font-bold text-[#4A5833]">
                                                          <span className="truncate">{product.price}</span>
                                                          <span className="text-[8px] text-red-500 font-medium shrink-0 flex items-center gap-0.5">
                                                              <i className="fa-solid fa-heart"></i>{product.likes || 0}
                                                          </span>
                                                      </div>
                                                  </div>
                                              </div>
                                          );
                                      })}
                                  {productList.length === 0 && (
                                      <div className="col-span-3 py-6 text-center text-xs text-gray-400 bg-gray-50 rounded-xl">
                                          등록된 상품이 없습니다.
                                      </div>
                                  )}
                              </div>
                          </section>

                          {/* 🕒 최근 본 상품 */}
                          <section>
                              <h2 className="font-bold text-gray-800 text-base mb-3 flex items-center gap-1.5">
                                  🕒 최근 본 상품
                              </h2>
                              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                                  {recentlyViewedIds
                                      .map(id => productList.find(p => String(p.id) === String(id)))
                                      .filter((p): p is Product => !!p)
                                      .map((product) => (
                                          <div 
                                              key={product.id} 
                                              onClick={() => openProductDetail(product)}
                                              className="bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm min-w-[145px] shrink-0 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-md hover:border-gray-200 transition-all active:scale-[0.98] relative"
                                          >
                                              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 mb-2 border border-gray-100 overflow-hidden shrink-0 shadow-2xs">
                                                  {product.image ? (
                                                      <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                                                  ) : (
                                                      <i className={`${product.icon} text-2xl`}></i>
                                                  )}
                                              </div>
                                              <h4 className="text-[11px] font-semibold text-gray-800 truncate w-full px-1">{product.name}</h4>
                                              <span className="text-[9px] text-[#4A5833] font-bold mt-0.5">{product.price}</span>
                                          </div>
                                      ))}
                                  {recentlyViewedIds.length === 0 && (
                                      <div className="py-6 text-center text-xs text-gray-400 w-full bg-gray-50 rounded-xl border border-dashed border-gray-100">
                                          최근에 확인한 상품이 여기에 표시됩니다.
                                      </div>
                                  )}
                              </div>
                          </section>

                          {/* 3. 새로 등록된 상품 */}
                          <section>
                              <h2 className="font-bold text-gray-800 text-base mb-3 flex items-center gap-1.5">
                                  👀(NEW!!) 새로 등록된 상품
                              </h2>
                              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                                  {[...productList]
                                      .sort((a, b) => {
                                          if (a.date !== b.date) {
                                              return b.date.localeCompare(a.date);
                                          }
                                          const numA = Number(a.id);
                                          const numB = Number(b.id);
                                          if (!isNaN(numA) && !isNaN(numB)) {
                                              return numB - numA;
                                          }
                                          return String(b.id).localeCompare(String(a.id));
                                      })
                                      .slice(0, 10)
                                      .map((product) => (
                                          <div 
                                              key={product.id} 
                                              onClick={() => openProductDetail(product)}
                                              className="bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm min-w-[140px] shrink-0 flex items-center gap-2.5 cursor-pointer hover:shadow-md hover:border-gray-200 transition-all active:scale-[0.98]"
                                          >
                                              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 shrink-0 overflow-hidden">
                                                  {product.image ? (
                                                      <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                                                  ) : (
                                                      <i className={`${product.icon} text-lg`}></i>
                                                  )}
                                              </div>
                                              <div className="overflow-hidden flex-1">
                                                  <h4 className="text-xs font-semibold text-gray-800 truncate leading-none mb-1">{product.name}</h4>
                                                  <div className="flex items-center justify-between text-[8px]">
                                                      <span className={`font-semibold ${product.status === '완료' ? 'text-gray-400' : 'text-emerald-600'}`}>
                                                          {getProductStatusLabel(product)}
                                                      </span>
                                                      <span className="text-gray-400 font-medium shrink-0">
                                                          <i className="fa-regular fa-eye"></i> {product.views || 0}
                                                      </span>
                                                  </div>
                                              </div>
                                          </div>
                                      ))}
                                  {productList.length === 0 && (
                                      <div className="py-6 text-center text-xs text-gray-400 w-full bg-gray-50 rounded-xl">
                                          새로 등록된 상품이 없습니다.
                                      </div>
                                  )}
                              </div>
                          </section>

                          {/* 4. AI 상품 추천!! */}
                          {renderAiRecommendation()}
                      </>
                  )}
              </>
          )}

      </main>

      {/* 하단 네비게이션 바 */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-100 px-4 py-2 flex justify-around items-center z-40 text-gray-400 shadow-lg">
          {/* 1. 홈 */}
          <button 
              onClick={() => {
                  setCurrentView('home');
                  setActiveSearch('');
                  setSearchQuery('');
              }}
              className={`flex flex-col items-center gap-0.5 ${currentView === 'home' ? 'text-[#4A5833] font-bold scale-105' : 'text-gray-400 hover:text-gray-600'} transition-all`}
          >
              <i className="fa-solid fa-house text-lg"></i>
              <span className="text-[10px]">홈</span>
          </button>

          {/* 2. 카테고리 */}
          <button 
              onClick={() => {
                  setCurrentView('category');
              }}
              className={`flex flex-col items-center gap-0.5 ${currentView === 'category' ? 'text-[#4A5833] font-bold scale-105' : 'text-gray-400 hover:text-gray-600'} transition-all`}
          >
              <i className="fa-solid fa-border-all text-lg"></i>
              <span className="text-[10px]">카테고리</span>
          </button>

          {/* 3. 대화 (채팅) */}
          <button 
              onClick={() => {
                  handleRequireAuth('1:1 대화 서비스를', () => {
                      setCurrentView('chat');
                      setSelectedChatPartner(null);
                  });
              }}
              className={`flex flex-col items-center gap-0.5 ${currentView === 'chat' ? 'text-[#4A5833] font-bold scale-105' : 'text-gray-400 hover:text-gray-600'} relative transition-all`}
          >
              <i className="fa-regular fa-comments text-lg"></i>
              <span className="text-[10px]">대화</span>
              {chatPartners.reduce((acc, p) => acc + (p.unreadCount || 0), 0) > 0 && (
                  <span className="absolute -top-1 -right-0.5 bg-red-500 text-white text-[9px] font-black min-w-[17px] h-[17px] px-1 rounded-full flex items-center justify-center border-2 border-white shadow-xs">
                      {chatPartners.reduce((acc, p) => acc + (p.unreadCount || 0), 0) > 99 ? '99+' : chatPartners.reduce((acc, p) => acc + (p.unreadCount || 0), 0)}
                  </span>
              )}
          </button>

          {/* 4. 찜 */}
          <button 
              onClick={() => {
                  handleRequireAuth('관심 목록(찜)을', () => {
                      setCurrentView('favorites');
                  });
              }}
              className={`flex flex-col items-center gap-0.5 ${currentView === 'favorites' ? 'text-[#4A5833] font-bold scale-105' : 'text-gray-400 hover:text-gray-600'} transition-all`}
          >
              <i className="fa-regular fa-heart text-lg"></i>
              <span className="text-[10px]">찜</span>
          </button>

          {/* 5. 마이페이지 */}
          <button 
              onClick={() => setCurrentView('mypage')}
              className={`flex flex-col items-center gap-0.5 ${currentView === 'mypage' ? 'text-[#4A5833] font-bold scale-105' : 'text-gray-400 hover:text-gray-600'} transition-all`}
          >
              <i className="fa-regular fa-user text-lg"></i>
              <span className="text-[10px]">마이페이지</span>
          </button>
      </nav>

      {/* ========================================== */}
      {/* 팝업 모달들 */}
      {/* ========================================== */}

      {/* 0. 물품 상세 정보 팝업 모달 */}
      {selectedProduct && (
          <div 
              className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in"
              onClick={() => setSelectedProduct(null)}
          >
              <div 
                  className="bg-white rounded-3xl w-full max-w-sm max-h-[88vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden animate-scale-up"
                  onClick={(e) => e.stopPropagation()}
              >
                  {/* 상단 팝업 헤더 */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
                      <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-extrabold text-sm text-gray-800 flex items-center gap-1.5">
                              <i className="fa-solid fa-box-open text-[#4A5833]"></i>
                              물품 상세 정보
                          </h3>
                          {isMyProduct(selectedProduct) && (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <i className="fa-solid fa-user-check text-[9px]"></i> 내가 등록한 물품
                              </span>
                          )}
                      </div>
                      <div className="flex items-center gap-1">
                          {isMyProduct(selectedProduct) && !isEditingProduct && (
                              <>
                                  <button
                                      onClick={startEditingProduct}
                                      className="text-gray-500 hover:text-[#4A5833] hover:bg-gray-100 p-1.5 rounded-lg transition-colors flex items-center justify-center cursor-pointer"
                                      title="물품 상세 정보 수정하기"
                                  >
                                      <i className="fa-solid fa-pen-to-square text-base"></i>
                                  </button>
                                  <button
                                      onClick={() => handleDeleteProduct(selectedProduct)}
                                      className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors flex items-center justify-center cursor-pointer"
                                      title="물품 삭제하기"
                                  >
                                      <i className="fa-solid fa-trash-can text-base"></i>
                                  </button>
                              </>
                          )}
                          <button 
                              onClick={() => handleToggleLike(selectedProduct)}
                              className="text-gray-400 hover:text-red-500 transition-colors p-1 cursor-pointer"
                              title="찜하기"
                          >
                              <i className={`${favoritedIds.includes(selectedProduct.id) ? 'fa-solid text-red-500' : 'fa-regular'} fa-heart text-lg`}></i>
                          </button>
                          <button 
                              onClick={() => setSelectedProduct(null)} 
                              className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition cursor-pointer"
                              title="닫기"
                          >
                              <i className="fa-solid fa-xmark text-lg"></i>
                          </button>
                      </div>
                  </div>

                  {/* 팝업 바디 스크롤 영역 */}
                  <div className="overflow-y-auto flex-1">
                      {isEditingProduct ? (
                          <div className="p-4 space-y-3.5 animate-fade-in">
                              <div className="bg-[#E5ECD3]/70 border border-[#D5E0BD] rounded-2xl p-3 flex items-center justify-between gap-2 text-xs text-[#4A5833] font-black">
                                  <div className="flex items-center gap-2">
                                      <i className="fa-solid fa-pen-to-square text-base"></i>
                                      <span>내가 등록한 물품 상세 정보 수정</span>
                                  </div>
                                  <span className="text-[10px] bg-white/80 px-2 py-0.5 rounded-full text-amber-800 border border-amber-200">
                                      수정 권한 있음
                                  </span>
                              </div>

                              {/* 물품명 */}
                              <div>
                                  <label className="block text-[11px] font-bold text-gray-700 mb-1">물품명 <span className="text-red-500">*</span></label>
                                  <input 
                                      type="text" 
                                      value={editProdName} 
                                      onChange={(e) => setEditProdName(e.target.value)} 
                                      className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-[#4A5833] bg-gray-50/50"
                                      placeholder="물품 이름을 입력하세요"
                                  />
                              </div>

                              {/* 카테고리 & 물품 상태 */}
                              <div className="grid grid-cols-2 gap-2">
                                  <div>
                                      <label className="block text-[11px] font-bold text-gray-700 mb-1">카테고리</label>
                                      <select 
                                          value={editProdCategory} 
                                          onChange={(e) => setEditProdCategory(e.target.value)}
                                          className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-[#4A5833] bg-white font-bold text-gray-700"
                                      >
                                          {CATEGORY_OPTIONS.map(cat => (
                                              <option key={cat} value={cat}>{cat}</option>
                                          ))}
                                      </select>
                                  </div>
                                  <div>
                                      <label className="block text-[11px] font-bold text-gray-700 mb-1">나눔 상태</label>
                                      <select 
                                          value={editProdStatus === '완료' ? '완료' : '나눔중'} 
                                          onChange={(e) => setEditProdStatus(e.target.value as any)}
                                          className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-[#4A5833] bg-white font-bold text-[#4A5833]"
                                      >
                                          <option value="나눔중">나눔 중</option>
                                          <option value="완료">나눔 완료</option>
                                      </select>
                                  </div>
                              </div>

                              {/* 나눔 가격/조건 & 만나는 장소 */}
                              <div className="grid grid-cols-2 gap-2">
                                  <div>
                                      <label className="block text-[11px] font-bold text-gray-700 mb-1">가격/나눔조건</label>
                                      <select 
                                          value={editPriceOption} 
                                          onChange={(e) => {
                                              const opt = e.target.value;
                                              setEditPriceOption(opt);
                                              if (opt !== '기타') {
                                                  setEditProdPrice(opt);
                                              } else {
                                                  setEditProdPrice(editCustomPriceInput);
                                              }
                                          }}
                                          className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-[#4A5833] bg-white font-bold text-gray-700"
                                      >
                                          {['500원', '1000원', '2000원', '3000원', '5000원', '무료 나눔', '기타'].map(opt => (
                                              <option key={opt} value={opt}>{opt}</option>
                                          ))}
                                      </select>
                                      {editPriceOption === '기타' && (
                                          <div className="mt-1.5 animate-fade-in">
                                              <input 
                                                  type="text" 
                                                  value={editCustomPriceInput} 
                                                  onChange={(e) => {
                                                      setEditCustomPriceInput(e.target.value);
                                                      setEditProdPrice(e.target.value);
                                                  }} 
                                                  className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-[#4A5833] bg-gray-50/50"
                                                  placeholder="가격 또는 방식을 직접 입력 (예: 4,000원)"
                                              />
                                          </div>
                                      )}
                                  </div>
                                  <div>
                                      <label className="block text-[11px] font-bold text-gray-700 mb-1">만나는 장소</label>
                                      <input 
                                          type="text" 
                                          value={editProdLocation} 
                                          onChange={(e) => setEditProdLocation(e.target.value)} 
                                          className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-[#4A5833] bg-gray-50/50"
                                          placeholder="A동 1층 로비 등"
                                      />
                                  </div>
                              </div>

                              {/* 대표 사진 */}
                              <div>
                                  <label className="block text-[11px] font-bold text-gray-700 mb-1">대표 사진 (카메라 촬영 또는 파일 첨부)</label>
                                  <div className="flex flex-col items-center gap-2">
                                      <div className="w-full h-36 rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center relative">
                                          {editProdImage ? (
                                              <img src={editProdImage} alt="대표 이미지 미리보기" className="w-full h-full object-cover" />
                                          ) : (
                                              <div className="text-center text-gray-400 p-4">
                                                  <i className="fa-regular fa-image text-3xl mb-1 text-gray-300 block"></i>
                                                  <p className="text-[11px] font-medium">등록된 대표 사진이 없습니다</p>
                                              </div>
                                          )}
                                      </div>

                                      <div className="grid grid-cols-2 gap-2 w-full">
                                          <button
                                              type="button"
                                              onClick={() => {
                                                  setCameraTarget('editProduct');
                                                  setCameraModalOpen(true);
                                              }}
                                              className="py-2.5 px-3 bg-[#4A5833] hover:bg-[#3E4C27] text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs active:scale-98"
                                          >
                                              <i className="fa-solid fa-camera text-sm"></i>
                                              <span>카메라 촬영</span>
                                          </button>

                                          <label className="py-2.5 px-3 bg-white border border-[#4A5833] text-[#4A5833] font-bold rounded-xl text-xs hover:bg-[#4A5833]/5 transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs active:scale-98">
                                              <i className="fa-solid fa-image text-sm"></i>
                                              <span>앨범 선택</span>
                                              <input 
                                                  type="file" 
                                                  accept="image/*" 
                                                  className="hidden" 
                                                  onChange={async (e) => {
                                                      const file = e.target.files?.[0];
                                                      if (file) {
                                                          setIsUploadingImage(true);
                                                          try {
                                                              const downloadUrl = await uploadImageToFirebaseStorage(file, "item_edit");
                                                              setEditProdImage(downloadUrl);
                                                          } catch (err) {
                                                              console.error("Firebase Storage upload error for edit:", err);
                                                              const reader = new FileReader();
                                                              reader.onload = (uploadEvent) => {
                                                                  if (uploadEvent.target?.result) {
                                                                      setEditProdImage(uploadEvent.target.result as string);
                                                                  }
                                                              };
                                                              reader.readAsDataURL(file);
                                                          } finally {
                                                              setIsUploadingImage(false);
                                                          }
                                                      }
                                                  }}
                                              />
                                          </label>
                                      </div>
                                  </div>
                              </div>

                              {/* 상세 설명 */}
                              <div>
                                  <label className="block text-[11px] font-bold text-gray-700 mb-1">물품 상세 설명</label>
                                  <textarea 
                                      rows={3}
                                      value={editProdDescription} 
                                      onChange={(e) => setEditProdDescription(e.target.value)} 
                                      className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-[#4A5833] bg-gray-50/50 resize-none"
                                      placeholder="물품의 상태, 사용 기간 등 상세한 정보를 적어주세요"
                                  />
                              </div>

                              {/* 하단 수정 완료/취소/삭제 버튼 */}
                              <div className="pt-2 flex items-center gap-2">
                                  <button
                                      type="button"
                                      onClick={() => setIsEditingProduct(false)}
                                      className="flex-1 py-2.5 border border-gray-300 text-gray-600 font-bold rounded-xl text-xs hover:bg-gray-100 transition"
                                  >
                                      취소
                                  </button>
                                  <button
                                       type="button"
                                       onClick={() => handleDeleteProduct(selectedProduct)}
                                       className="py-2.5 px-3 bg-red-50 text-red-600 border border-red-200 font-bold rounded-xl text-xs hover:bg-red-100 transition flex items-center gap-1 cursor-pointer"
                                       title="물품 삭제"
                                   >
                                      <i className="fa-solid fa-trash-can"></i> 삭제
                                  </button>
                                  <button
                                      type="button"
                                      onClick={async () => {
                                          if (!editProdName.trim()) {
                                              alert('물품명을 입력해주세요.');
                                              return;
                                          }
                                          const finalPrice = editPriceOption === '기타' 
                                              ? (editCustomPriceInput.trim() || '기타') 
                                              : editPriceOption;
                                          const updatedFields: Partial<Product> = {
                                              name: editProdName,
                                              price: finalPrice,
                                              location: editProdLocation || '기숙사 로비',
                                              category: editProdCategory || '기타',
                                              description: editProdDescription,
                                              image: editProdImage,
                                              status: editProdStatus
                                          };
                                          await updateProductDetails(selectedProduct.id, updatedFields);
                                          const newProduct = { ...selectedProduct, ...updatedFields };
                                          setSelectedProduct(newProduct);
                                          setProductList(prev => prev.map(p => p.id === selectedProduct.id ? newProduct : p));
                                          setIsEditingProduct(false);
                                          alert('물품 상세 정보가 성공적으로 수정되었습니다!');
                                      }}
                                      className="flex-1 py-2.5 bg-[#4A5833] text-white font-extrabold rounded-xl text-xs hover:bg-[#3E4C27] active:scale-95 transition shadow-md"
                                  >
                                      저장 완료
                                  </button>
                              </div>
                          </div>
                      ) : (
                          <>
                              {/* 큰 썸네일 영역 */}
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 p-6 flex items-center justify-center relative border-b border-gray-100">
                          {selectedProduct.rank && (
                              <span className={`absolute top-3 left-3 ${selectedProduct.rankBg || 'bg-red-500'} text-white text-[10px] font-bold px-2 py-0.5 rounded-lg shadow-sm z-10`}>
                                  인기 {selectedProduct.rank}
                              </span>
                          )}
                          {selectedProduct.image ? (
                              <div className="w-full h-48 rounded-2xl overflow-hidden shadow-sm border border-gray-200 bg-white">
                                  <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-cover" />
                              </div>
                          ) : (
                              <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-[#4A5833] shadow-md border border-gray-100">
                                  <i className={`${selectedProduct.icon || 'fa-solid fa-box'} text-3xl`}></i>
                              </div>
                          )}
                      </div>

                      {/* 상세 정보 바디 */}
                      <div className="p-4 space-y-4">
                          {/* 태그 및 상태 */}
                          <div className="flex items-center justify-between flex-wrap gap-2">
                              <span className="text-[10px] font-bold text-[#4A5833] bg-[#E5ECD3] px-2 py-1 rounded-md">기숙사 나눔 물품</span>
                              <div className="flex items-center gap-1.5">
                                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold shadow-sm ${
                                      selectedProduct.status === '완료' 
                                          ? 'bg-gray-100 text-gray-400' 
                                          : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                  }`}>
                                      {getProductStatusLabel(selectedProduct)}
                                  </span>
                                  
                                  {/* 내가 등록한 상품에 한해서만 물품 상태 변경(완료로 변경) 가능 */}
                                  {isMyProduct(selectedProduct) && (
                                      <button
                                          onClick={async () => {
                                              const nextStatus = selectedProduct.status === '완료' ? '나눔중' : '완료';
                                              await updateProductStatus(selectedProduct.id, nextStatus as any);
                                              const updatedProduct = { ...selectedProduct, status: nextStatus as any };
                                              setSelectedProduct(updatedProduct);
                                              setProductList(prev => prev.map(p => p.id === selectedProduct.id ? updatedProduct : p));
                                              alert(`물품 상태가 '${nextStatus === '완료' ? '나눔 완료' : '나눔중'}'(으)로 변경되었습니다.`);
                                          }}
                                          className="text-[10px] bg-[#4A5833] text-white px-2.5 py-1 rounded-lg font-bold hover:bg-[#3E4C27] active:scale-95 transition shadow-sm"
                                      >
                                          {selectedProduct.status === '완료' ? '나눔중으로 변경' : '완료로 변경'}
                                      </button>
                                  )}
                              </div>
                          </div>

                          {/* 이름, 카테고리 표시 & 가격 */}
                          <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-2 flex-wrap">
                                      <h2 className="text-base font-black text-gray-800 leading-snug">{selectedProduct.name}</h2>
                                      {/* 이름 옆 카테고리 태그 */}
                                      <button
                                          onClick={() => {
                                              setActiveSearch(selectedProduct.category || '책 또는 교재');
                                              setCurrentView('category');
                                              setSelectedProduct(null);
                                          }}
                                          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#4A5833] bg-[#E5ECD3] px-2.5 py-0.5 rounded-full border border-[#D5E0BD] hover:bg-[#d5dfbe] transition cursor-pointer"
                                          title="카테고리 물품 모아보기"
                                      >
                                          <i className={`${CATEGORY_ICON_MAP[selectedProduct.category || ''] || 'fa-solid fa-box'} text-[10px]`}></i>
                                          <span>{selectedProduct.category || '기타'}</span>
                                      </button>
                                  </div>
                              </div>

                              <div className="text-lg font-black text-[#4A5833] flex items-center justify-between bg-[#E5ECD3]/30 p-2.5 rounded-xl border border-[#D5E0BD]/50">
                                  <div className="flex items-center gap-1">
                                      <i className="fa-solid fa-hand-holding-heart text-sm text-[#4A5833]"></i>
                                      <span>{selectedProduct.price}</span>
                                  </div>
                                  {/* 조회수 및 좋아요 표시 */}
                                  <div className="flex items-center gap-3 text-[10px] text-gray-500 font-semibold">
                                      <span className="flex items-center gap-1"><i className="fa-regular fa-eye"></i> {selectedProduct.views || 0}</span>
                                      <span className="flex items-center gap-1"><i className="fa-solid fa-heart text-red-500"></i> {selectedProduct.likes || 0}</span>
                                  </div>
                              </div>
                          </div>

                          {/* 판매자 및 만나는 위치 상세 메타정보 */}
                          <div className="bg-gray-50 rounded-xl p-3 space-y-2 border border-gray-100 text-xs">
                              <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 bg-[#C2CEAB] rounded-full flex items-center justify-center text-white text-[10px]">
                                      <i className="fa-solid fa-user"></i>
                                  </div>
                                  <div className="flex-1 flex justify-between items-center">
                                      <span className="font-bold text-gray-700">{selectedProduct.seller || '기숙사 메이트'}</span>
                                      <span className="text-[10px] text-gray-400">등록일: {selectedProduct.date || '2026-07-20'}</span>
                                  </div>
                              </div>
                              
                              <div className="border-t border-gray-200/50 pt-2 flex items-center gap-2 text-gray-600">
                                  <i className="fa-solid fa-location-dot text-[#4A5833] text-sm w-4 text-center"></i>
                                  <div className="flex-1 flex justify-between items-center">
                                      <span className="font-semibold text-gray-800">만나는 장소: <span className="text-[#4A5833] font-bold">{selectedProduct.location}</span></span>
                                      <span className="text-[10px] bg-[#4A5833]/10 text-[#4A5833] font-semibold px-2 py-0.5 rounded">직거래</span>
                                  </div>
                              </div>
                          </div>

                          {/* 태그 목록 (#) */}
                          {selectedProduct.tags && selectedProduct.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-0.5">
                                  {selectedProduct.tags.map((tag, idx) => (
                                      <button
                                          key={idx}
                                          type="button"
                                          onClick={() => {
                                              setActiveSearch(tag.replace(/^#+/, ''));
                                              setSelectedProduct(null);
                                          }}
                                          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#3E4C27] bg-[#F4F6F0] border border-[#DCE4CF] px-2.5 py-1 rounded-full hover:bg-[#EAF2DA] hover:border-[#4A5833] transition cursor-pointer"
                                          title={`'${tag}' 태그 검색`}
                                      >
                                          <span>{tag}</span>
                                      </button>
                                  ))}
                              </div>
                          )}

                          {/* 물품 설명 */}
                          <div className="space-y-1.5">
                              <h4 className="text-xs font-extrabold text-gray-800 flex items-center gap-1.5">
                                  💬 물품 상세 설명
                              </h4>
                              <p className="text-xs text-gray-600 leading-relaxed bg-gray-50/50 p-3 rounded-xl border border-gray-100/50 min-h-[70px] whitespace-pre-wrap">
                                  {selectedProduct.description || '상세한 설명이 등록되지 않은 물품입니다. 판매자에게 직접 대화로 여쭤보세요!'}
                              </p>
                          </div>

                          {/* 하단 액션 버튼 */}
                          <div className="flex gap-2.5 pt-1">
                              {isMyProduct(selectedProduct) ? (
                                  <div className="flex items-center gap-2 w-full">
                                      <button
                                          type="button"
                                          onClick={startEditingProduct}
                                          className="flex-1 bg-white border border-[#4A5833] text-[#4A5833] font-extrabold py-3 rounded-xl text-xs hover:bg-[#4A5833]/5 active:scale-[0.98] transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                                      >
                                          <i className="fa-solid fa-pen-to-square"></i> 정보 수정
                                      </button>
                                      <button
                                          type="button"
                                          onClick={() => handleDeleteProduct(selectedProduct)}
                                          className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-extrabold py-3 px-4 rounded-xl text-xs active:scale-[0.98] transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                                          title="물품 삭제"
                                      >
                                          <i className="fa-solid fa-trash-can"></i> 삭제하기
                                      </button>
                                  </div>
                              ) : (
                                  <button
                                      onClick={() => {
                                          if (selectedProduct) {
                                              const prod = selectedProduct;
                                              setSelectedProduct(null);
                                              startChatWithProductSeller(prod);
                                          }
                                      }}
                                      className="flex-1 bg-[#4A5833] text-white font-extrabold py-3 rounded-xl text-xs hover:bg-[#3E4C27] active:scale-[0.98] transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                                  >
                                      <i className="fa-regular fa-comments text-sm animate-bounce"></i> 대화로 나눔 받기
                                  </button>
                              )}
                          </div>
                      </div>
                          </>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* 1. 내 인적사항 & 프로필 수정 모달 */}
      {isEditProfileOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl border border-gray-100">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                      <h3 className="font-extrabold text-gray-900 text-base flex items-center gap-2">
                          <i className="fa-solid fa-user-pen text-[#4A5833]"></i>
                          내 인적사항 수정
                      </h3>
                      <button 
                          onClick={() => setIsEditProfileOpen(false)}
                          className="text-gray-400 hover:text-gray-600 p-1"
                      >
                          <i className="fa-solid fa-xmark text-lg"></i>
                      </button>
                  </div>

                  <form onSubmit={(e) => {
                      e.preventDefault();
                      if (!editName.trim()) {
                          alert('이름(닉네임)을 입력해주세요.');
                          return;
                      }
                      if (!editRoomNum.trim()) {
                          alert('호수를 입력해주세요.');
                          return;
                      }

                      const finalDormLocation = `제${editDormNum}기숙사 ${editBuildingName}동 ${editRoomNum.trim()}호`;

                      setUserInfo({
                          ...userInfo,
                          name: editName.trim(),
                          dormLocation: finalDormLocation,
                          role: editRole,
                          avatarUrl: editAvatarUrl,
                      });

                      if (currentUser) {
                          const updatedUser = {
                              ...currentUser,
                              name: editName.trim(),
                              location: finalDormLocation,
                              role: editRole,
                              avatarUrl: editAvatarUrl
                          };
                          setCurrentUser(updatedUser);
                          localStorage.setItem('yeongeun_current_user', JSON.stringify(updatedUser));

                          // 백엔드 영구 보관 API 호출
                          fetch('/api/user/profile', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                  username: currentUser.username,
                                  name: editName.trim(),
                                  location: finalDormLocation,
                                  role: editRole,
                                  avatarUrl: editAvatarUrl
                              })
                          }).catch(err => console.error('Profile backend update error:', err));
                      }

                      setIsEditProfileOpen(false);
                      alert('인적사항이 성공적으로 수정되었습니다!');
                  }} className="space-y-4">

                      {/* 프로필 사진 선택 */}
                      <div className="space-y-2">
                          <label className="block text-xs font-bold text-gray-700">프로필 사진 (카메라 촬영 또는 파일 첨부)</label>
                          <div className="flex items-center gap-3">
                              <img 
                                  src={editAvatarUrl} 
                                  alt="미리보기" 
                                  className="w-16 h-16 rounded-full object-cover border-2 border-[#4A5833] shadow shrink-0"
                                  referrerPolicy="no-referrer"
                              />
                              <div className="flex-1 space-y-2">
                                  <div className="grid grid-cols-2 gap-1.5">
                                      <button
                                          type="button"
                                          onClick={() => {
                                              setCameraTarget('editProfile');
                                              setCameraModalOpen(true);
                                          }}
                                          className="py-2 px-2 bg-[#4A5833] hover:bg-[#3E4C27] text-white font-bold rounded-xl text-[11px] transition cursor-pointer flex items-center justify-center gap-1 shadow-2xs active:scale-98"
                                      >
                                          <i className="fa-solid fa-camera text-xs"></i>
                                          <span>카메라 촬영</span>
                                      </button>

                                      <label className="py-2 px-2 bg-white border border-[#4A5833] text-[#4A5833] font-bold rounded-xl text-[11px] hover:bg-[#4A5833]/5 transition cursor-pointer flex items-center justify-center gap-1 shadow-2xs active:scale-98">
                                          <i className="fa-solid fa-image text-xs"></i>
                                          <span>앨범 선택</span>
                                          <input 
                                              type="file" 
                                              accept="image/*" 
                                              className="hidden" 
                                              onChange={async (e) => {
                                                  const file = e.target.files?.[0];
                                                  if (file) {
                                                      try {
                                                          const downloadUrl = await uploadImageToFirebaseStorage(file, "avatar");
                                                          setEditAvatarUrl(downloadUrl);
                                                      } catch (err) {
                                                          const reader = new FileReader();
                                                          reader.onload = (uploadEvent) => {
                                                              if (uploadEvent.target?.result) {
                                                                  setEditAvatarUrl(uploadEvent.target.result as string);
                                                              }
                                                          };
                                                          reader.readAsDataURL(file);
                                                      }
                                                  }
                                              }}
                                          />
                                      </label>
                                  </div>

                                  {/* 5종 샘플 프로필 선택 */}
                                  <div className="pt-2 border-t border-gray-100">
                                      <p className="text-[11px] font-bold text-[#4A5833] mb-1.5 flex items-center gap-1">
                                          <i className="fa-solid fa-wand-magic-sparkles text-[10px]"></i>
                                          <span>샘플 프로필 선택 (5종)</span>
                                      </p>
                                      <div className="flex items-center gap-2">
                                          {sampleAvatarsList.map((item) => (
                                              <button
                                                  key={item.id}
                                                  type="button"
                                                  onClick={() => setEditAvatarUrl(item.url)}
                                                  className={`w-10 h-10 rounded-full border-2 overflow-hidden bg-[#FAF7F2] p-0.5 transition-all active:scale-95 ${
                                                      editAvatarUrl === item.url 
                                                          ? 'border-[#4A5833] ring-2 ring-[#4A5833]/30 scale-105 shadow-sm' 
                                                          : 'border-gray-200 hover:border-[#4A5833]/50 opacity-85 hover:opacity-100'
                                                  }`}
                                                  title={item.name}
                                              >
                                                  <img 
                                                      src={item.url} 
                                                      alt={item.name} 
                                                      className="w-full h-full object-contain"
                                                      referrerPolicy="no-referrer"
                                                      onError={(e) => {
                                                          const target = e.currentTarget;
                                                          const localBackup = `/${item.file}`;
                                                          if (target.src !== localBackup && !target.src.endsWith(localBackup)) {
                                                              target.src = localBackup;
                                                          }
                                                      }}
                                                  />
                                              </button>
                                          ))}
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>

                      {/* 이름 / 닉네임 */}
                      <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-[#4A5833]">이름 (닉네임)</label>
                          <input 
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              placeholder="예: 연근마켓인25"
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#4A5833]/30 focus:bg-white transition font-bold"
                              required
                          />
                      </div>

                      {/* 기숙사 위치 및 동/호수 */}
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-2.5">
                          <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-[#4A5833] flex items-center gap-1">
                                  <i className="fa-solid fa-building text-xs"></i>
                                  <span>기숙사 위치 및 동/호수</span>
                              </label>
                              <span className="text-[10px] text-emerald-800 font-extrabold bg-emerald-100 px-2 py-0.5 rounded-full">
                                  1,2기숙사 / A~G동
                              </span>
                          </div>

                          <div className="flex items-center gap-1 bg-white p-1.5 rounded-xl border border-emerald-500/30 shadow-2xs text-xs">
                              <span className="text-[#4A5833] font-black shrink-0 pl-1">제</span>
                              <select 
                                  value={editDormNum} 
                                  onChange={(e) => {
                                      const newDorm = e.target.value;
                                      setEditDormNum(newDorm);
                                      if (newDorm === '1' && !['A', 'B', 'C'].includes(editBuildingName)) {
                                          setEditBuildingName('A');
                                      } else if (newDorm === '2' && !['D', 'E', 'F', 'G'].includes(editBuildingName)) {
                                          setEditBuildingName('D');
                                      }
                                  }}
                                  className="bg-gray-100 border border-gray-200 rounded-lg px-2 py-1 font-bold text-xs focus:outline-none text-[#4A5833] cursor-pointer"
                              >
                                  <option value="1">1</option>
                                  <option value="2">2</option>
                              </select>
                              <span className="text-[#4A5833] font-black shrink-0">기숙사</span>

                              <select 
                                  value={editBuildingName}
                                  onChange={(e) => setEditBuildingName(e.target.value)}
                                  className="bg-gray-100 border border-gray-200 rounded-lg px-2 py-1 font-bold text-xs focus:outline-none text-[#4A5833] cursor-pointer"
                              >
                                  {editDormNum === '1' ? (
                                      <>
                                          <option value="A">A</option>
                                          <option value="B">B</option>
                                          <option value="C">C</option>
                                      </>
                                  ) : (
                                      <>
                                          <option value="D">D</option>
                                          <option value="E">E</option>
                                          <option value="F">F</option>
                                          <option value="G">G</option>
                                      </>
                                  )}
                              </select>
                              <span className="text-[#4A5833] font-black shrink-0">동</span>

                              <input 
                                  type="text" 
                                  inputMode="numeric"
                                  value={editRoomNum}
                                  onChange={(e) => setEditRoomNum(e.target.value.replace(/[^0-9]/g, ''))}
                                  placeholder="302"
                                  maxLength={4}
                                  className="w-12 text-center bg-gray-100 border border-gray-200 rounded-lg px-1 py-1 font-bold text-xs focus:outline-none font-bold"
                              />
                              <span className="text-[#4A5833] font-black shrink-0 pr-1">호</span>
                          </div>

                          <div className="text-[10px] text-emerald-800 font-extrabold pl-1 flex items-center justify-between">
                              <span>완성 주소:</span>
                              <span className="text-white bg-[#4A5833] px-2 py-0.5 rounded-md font-black shadow-2xs">
                                  제{editDormNum}기숙사 {editBuildingName}동 {editRoomNum.trim() || '101'}호
                              </span>
                          </div>
                      </div>



                      <div className="flex gap-2 pt-2">
                          <button
                              type="button"
                              onClick={() => setIsEditProfileOpen(false)}
                              className="flex-1 bg-gray-100 text-gray-600 font-bold py-2.5 rounded-xl text-xs hover:bg-gray-200 transition"
                          >
                              취소
                          </button>
                          <button
                              type="submit"
                              className="flex-1 bg-[#4A5833] text-white font-extrabold py-2.5 rounded-xl text-xs hover:bg-[#3E4C27] transition shadow-sm"
                          >
                              저장하기
                          </button>
                      </div>

                  </form>
              </div>
          </div>
      )}

      {/* 2. 내 등록물품 모달 */}
      {showMyProductsModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-3xl p-5 w-full max-w-sm max-h-[80vh] flex flex-col shadow-2xl border border-gray-100">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
                      <h3 className="font-extrabold text-gray-900 text-base flex items-center gap-2">
                          <i className="fa-solid fa-box text-[#4A5833]"></i>
                          내가 등록한 물품
                      </h3>
                      <button onClick={() => setShowMyProductsModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                          <i className="fa-solid fa-xmark text-lg"></i>
                      </button>
                  </div>
                  <div className="overflow-y-auto space-y-2 flex-1 pr-1">
                      {(() => {
                          const myProducts = productList.filter(isMyProduct);
                          if (myProducts.length === 0) {
                              return <div className="py-8 text-center text-xs text-gray-400">등록한 물품이 없습니다.</div>;
                          }
                          return myProducts.map((product) => (
                              <div 
                                  key={product.id} 
                                  onClick={() => {
                                      setShowMyProductsModal(false);
                                      openProductDetail(product);
                                  }}
                                  className="p-3 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between hover:bg-gray-100 cursor-pointer transition group"
                              >
                                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-[#4A5833] border border-gray-100 overflow-hidden shrink-0">
                                          {product.image ? (
                                              <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                                          ) : (
                                              <i className={`${product.icon || 'fa-solid fa-box'} text-lg`}></i>
                                          )}
                                      </div>
                                      <div className="min-w-0 flex-1 pr-2">
                                          <p className="text-xs font-bold text-gray-800 truncate">{product.name}</p>
                                          <p className="text-[10px] text-gray-400">{product.price}</p>
                                      </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${product.status === '완료' ? 'bg-gray-200 text-gray-500' : 'bg-emerald-100 text-emerald-700'}`}>
                                          {product.status}
                                      </span>
                                      <button
                                          type="button"
                                          onClick={() => {
                                              setShowMyProductsModal(false);
                                              openProductDetail(product);
                                              setTimeout(() => {
                                                  startEditingProduct();
                                              }, 100);
                                          }}
                                          className="p-1.5 text-gray-400 hover:text-[#4A5833] hover:bg-white rounded-lg transition cursor-pointer"
                                          title="물품 수정"
                                      >
                                          <i className="fa-solid fa-pen-to-square text-xs"></i>
                                      </button>
                                      <button
                                          type="button"
                                          onClick={() => handleDeleteProduct(product)}
                                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                          title="물품 삭제"
                                      >
                                          <i className="fa-solid fa-trash-can text-xs"></i>
                                      </button>
                                  </div>
                              </div>
                          ));
                      })()}
                  </div>
                  <button 
                      onClick={() => {
                          setShowMyProductsModal(false);
                          handleRequireAuth('물품 등록 서비스를', () => {
                              setCurrentView('register');
                          });
                      }}
                      className="mt-3 w-full bg-[#4A5833] text-white font-bold py-2.5 rounded-xl text-xs hover:bg-[#3E4C27] transition"
                  >
                      + 새 물품 등록하러 가기
                  </button>
              </div>
          </div>
      )}

      {/* 4. 완료한 나눔/거래 모달 */}
      {showCompletedDealsModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-3xl p-5 w-full max-w-sm max-h-[80vh] flex flex-col shadow-2xl border border-gray-100">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
                      <h3 className="font-extrabold text-gray-900 text-base flex items-center gap-2">
                          <i className="fa-solid fa-[#4A5833] fa-circle-check text-orange-500"></i>
                          완료한 나눔/거래 목록
                      </h3>
                      <button onClick={() => setShowCompletedDealsModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                          <i className="fa-solid fa-xmark text-lg"></i>
                      </button>
                  </div>
                  <div className="overflow-y-auto space-y-2 flex-1 pr-1">
                      {productList.filter(p => p.status === '완료').length > 0 ? (
                          productList.filter(p => p.status === '완료').map((product) => (
                              <div key={product.id} className="p-3 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                                  <div className="flex items-center gap-2.5">
                                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-gray-400 border border-gray-100">
                                          <i className={`${product.icon} text-lg`}></i>
                                      </div>
                                      <div>
                                          <p className="text-xs font-bold text-gray-800 line-through">{product.name}</p>
                                          <p className="text-[10px] text-gray-400">{product.price}</p>
                                      </div>
                                  </div>
                                  <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-bold">
                                      나눔 완료
                                  </span>
                              </div>
                          ))
                      ) : (
                          <div className="py-8 text-center text-xs text-gray-400">완료된 거래 내역이 없습니다.</div>
                      )}
                  </div>
                  <button 
                      onClick={() => setShowCompletedDealsModal(false)}
                      className="mt-3 w-full bg-gray-100 text-gray-600 font-bold py-2.5 rounded-xl text-xs hover:bg-gray-200 transition"
                  >
                      닫기
                  </button>
              </div>
          </div>
      )}

      {/* 5. 카테고리 모달 */}
      {showCategoryModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-3xl p-5 w-full max-w-sm max-h-[80vh] flex flex-col shadow-2xl border border-gray-100">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
                      <h3 className="font-extrabold text-gray-900 text-base flex items-center gap-2">
                          <i className="fa-solid fa-border-all text-[#4A5833]"></i>
                          기숙사 카테고리
                      </h3>
                      <button onClick={() => setShowCategoryModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                          <i className="fa-solid fa-xmark text-lg"></i>
                      </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 overflow-y-auto p-1 max-h-[55vh]">
                      <button
                          onClick={() => {
                              setActiveSearch('');
                              setSearchQuery('');
                              setShowCategoryModal(false);
                              setCurrentView('home');
                          }}
                          className={`p-3 rounded-2xl text-left font-bold text-xs border transition flex items-center gap-2 ${
                              !activeSearch
                                  ? 'bg-[#4A5833] text-white border-[#4A5833]'
                                  : 'bg-gray-50 hover:bg-[#E5ECD3] hover:text-[#4A5833] border-gray-100 text-gray-800'
                          }`}
                      >
                          <i className="fa-solid fa-layer-group text-sm"></i>
                          <span className="truncate">전체보기</span>
                      </button>
                      {CATEGORY_OPTIONS.map((cat) => (
                          <button
                              key={cat}
                              onClick={() => {
                                  setActiveSearch(cat);
                                  setShowCategoryModal(false);
                                  setCurrentView('home');
                              }}
                              className={`p-3 rounded-2xl text-left font-bold text-xs border transition flex items-center gap-2 ${
                                  activeSearch === cat
                                      ? 'bg-[#4A5833] text-white border-[#4A5833]'
                                      : 'bg-gray-50 hover:bg-[#E5ECD3] hover:text-[#4A5833] border-gray-100 text-gray-800'
                              }`}
                          >
                              <i className={`${CATEGORY_ICON_MAP[cat] || 'fa-solid fa-box'} text-sm ${activeSearch === cat ? 'text-white' : 'text-[#4A5833]'}`}></i>
                              <span className="truncate">{cat}</span>
                          </button>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* 7. 최고 관리자 전용 대시보드 팝업 모달 */}
      {isAdminModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm animate-fade-in overflow-y-auto">
              <div className="bg-white rounded-3xl w-full max-w-xl sm:max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden my-auto">
                  
                  {/* (1) 상단 녹색 헤더 배너 (예시 팝업과 정확히 동일한 어두운 올리브 바) */}
                  <div className="bg-[#3E4C27] text-white p-4 sm:p-5 relative">
                      <div className="flex items-center justify-between">
                          <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                              <span>👑</span> 최고 관리자 전용 대시보드
                          </h2>
                          <button 
                              onClick={() => setIsAdminModalOpen(false)}
                              className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition"
                              title="팝업 닫기"
                          >
                              <i className="fa-solid fa-xmark text-lg"></i>
                          </button>
                      </div>
                      <p className="text-emerald-100/90 text-xs font-semibold mt-1">
                          실시간 백엔드 로그인 기록, 유저 데이터, 통합 로그 축적 현황
                      </p>
                  </div>

                  {/* (2) 5개 통계 요약 카드 (가입자, 물품, 거래완료, 대화방, 축적로그) */}
                  <div className="bg-gray-50/80 p-3 sm:p-4 border-b border-gray-100">
                      <div className="grid grid-cols-5 gap-1.5 sm:gap-2 text-center">
                          {/* 전체 가입자 */}
                          <div className="bg-white p-2 sm:p-3 rounded-2xl border border-gray-200/80 shadow-xs flex flex-col items-center justify-center min-h-[70px]">
                              <span className="text-[10px] sm:text-xs font-bold text-gray-500 mb-0.5 leading-tight">전체 가입자</span>
                              <span className="text-base sm:text-xl font-black text-gray-900">{adminStats.totalUsers || adminUsers.length}명</span>
                          </div>

                          {/* 등록된 물품 */}
                          <div className="bg-white p-2 sm:p-3 rounded-2xl border border-gray-200/80 shadow-xs flex flex-col items-center justify-center min-h-[70px]">
                              <span className="text-[10px] sm:text-xs font-bold text-gray-500 mb-0.5 leading-tight">등록된 물품</span>
                              <span className="text-base sm:text-xl font-black text-gray-900">{adminStats.totalProducts || productList.length}개</span>
                          </div>

                          {/* 거래 완료 */}
                          <div className="bg-white p-2 sm:p-3 rounded-2xl border border-gray-200/80 shadow-xs flex flex-col items-center justify-center min-h-[70px]">
                              <span className="text-[10px] sm:text-xs font-bold text-gray-500 mb-0.5 leading-tight">거래 완료</span>
                              <span className="text-base sm:text-xl font-black text-emerald-600">
                                  {adminStats.completedDeals || productList.filter(p => p.status === '완료').length}건
                              </span>
                          </div>

                          {/* 활성 대화 방 */}
                          <div className="bg-white p-2 sm:p-3 rounded-2xl border border-gray-200/80 shadow-xs flex flex-col items-center justify-center min-h-[70px]">
                              <span className="text-[10px] sm:text-xs font-bold text-gray-500 mb-0.5 leading-tight">활성 대화 방</span>
                              <span className="text-base sm:text-xl font-black text-blue-600">{adminStats.activeChatRooms}개</span>
                          </div>

                          {/* 축적된 로그 */}
                          <div className="bg-white p-2 sm:p-3 rounded-2xl border border-gray-200/80 shadow-xs flex flex-col items-center justify-center min-h-[70px]">
                              <span className="text-[10px] sm:text-xs font-bold text-gray-500 mb-0.5 leading-tight">축적된 로그</span>
                              <span className="text-base sm:text-xl font-black text-purple-600">{adminStats.totalLogs || adminLogs.length}건</span>
                          </div>
                      </div>
                  </div>

                  {/* (3) 네비게이션 탭 (백엔드 활동 축적 로그, 전체 회원 관리, 전체 물품 관리) */}
                  <div className="border-b border-gray-100 bg-white grid grid-cols-3 gap-1 p-2">
                      <button
                          onClick={() => setAdminActiveTab('logs')}
                          className={`py-2 px-1 text-center font-bold rounded-xl transition flex flex-col sm:flex-row items-center justify-center gap-1 ${
                              adminActiveTab === 'logs'
                                  ? 'bg-[#EAF2DA] text-[#4A5833] font-black border-b-2 border-[#4A5833]'
                                  : 'text-gray-500 hover:bg-gray-50'
                          }`}
                      >
                          <span className="text-sm">📜</span>
                          <span className="leading-tight text-[10px] sm:text-xs">백엔드 활동 축적 로그</span>
                      </button>

                      <button
                          onClick={() => setAdminActiveTab('users')}
                          className={`py-2 px-1 text-center font-bold rounded-xl transition flex flex-col sm:flex-row items-center justify-center gap-1 ${
                              adminActiveTab === 'users'
                                  ? 'bg-[#EAF2DA] text-[#4A5833] font-black border-b-2 border-[#4A5833]'
                                  : 'text-gray-500 hover:bg-gray-50'
                          }`}
                      >
                          <span className="text-sm">👥</span>
                          <span className="leading-tight text-[10px] sm:text-xs">전체 회원 관리</span>
                      </button>

                      <button
                          onClick={() => setAdminActiveTab('products')}
                          className={`py-2 px-1 text-center font-bold rounded-xl transition flex flex-col sm:flex-row items-center justify-center gap-1 ${
                              adminActiveTab === 'products'
                                  ? 'bg-[#EAF2DA] text-[#4A5833] font-black border-b-2 border-[#4A5833]'
                                  : 'text-gray-500 hover:bg-gray-50'
                          }`}
                      >
                          <span className="text-sm">📦</span>
                          <span className="leading-tight text-[10px] sm:text-xs">전체 물품 관리</span>
                      </button>
                  </div>

                  {/* (4) 탭별 화면 영역 */}
                  <div className="p-4 overflow-y-auto space-y-4 flex-1 max-h-[50vh] bg-gray-50/40">
                      
                      {/* [1] 백엔드 활동 축적 로그 */}
                      {adminActiveTab === 'logs' && (
                          <div className="space-y-3 animate-fade-in">
                              <div className="flex items-center justify-between px-1">
                                  <h3 className="text-xs font-black text-gray-800 flex items-center gap-1.5">
                                      <i className="fa-solid fa-clock-rotate-left text-[#4A5833]"></i>
                                      실시간 백엔드 축적 로그 ({adminLogs.length}건)
                                  </h3>
                                  <button
                                      onClick={() => {
                                          const newLog = {
                                              id: Date.now(),
                                              type: 'REALTIME',
                                              text: `@sys_admin 관리자 조작 실시간 로그 기록 생성됨`,
                                              time: new Date().toLocaleTimeString(),
                                              status: 'purple',
                                          };
                                          setAdminLogs(prev => [newLog, ...prev]);
                                      }}
                                      className="text-[10px] bg-[#4A5833] text-white px-2.5 py-1 rounded-lg font-bold hover:bg-[#3E4C27] transition shadow-xs"
                                  >
                                      + 실시간 로그 시뮬레이션
                                  </button>
                              </div>

                              <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs divide-y divide-gray-100 overflow-hidden text-xs">
                                  {adminLogs.map(log => (
                                      <div key={log.id} className="p-3 hover:bg-gray-50 transition flex items-start gap-2.5">
                                          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${
                                              log.type === 'DELETE' || log.type === 'PRODUCT_DELETE' || log.status === 'red' ? 'bg-red-100 text-red-800' :
                                              log.type === 'AUTH' ? 'bg-amber-100 text-amber-800' :
                                              log.type === 'DEAL' ? 'bg-emerald-100 text-emerald-800' :
                                              log.type === 'REALTIME' || log.status === 'purple' ? 'bg-purple-100 text-purple-800' :
                                              'bg-blue-100 text-blue-800'
                                          }`}>
                                              [{log.type}]
                                          </span>
                                          <div className="flex-1">
                                              <p className="font-semibold text-gray-800">{log.text}</p>
                                              <p className="text-[10px] text-gray-400 mt-0.5">{log.time}</p>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}

                      {/* [2] 전체 회원 관리 (예시 이미지와 완전히 동일) */}
                      {adminActiveTab === 'users' && (
                          <div className="space-y-3 animate-fade-in">
                              <div className="flex items-center justify-between px-1">
                                  <h3 className="text-xs font-black text-gray-800">
                                      등록된 유저 목록 ({adminUsers.length}명)
                                  </h3>
                                  <span className="text-[10px] text-gray-400 font-medium">
                                      * 관리자는 전체 유저 정보 조회 가능합니다.
                                  </span>
                              </div>

                              <div className="space-y-2.5">
                                  {adminUsers.map(u => (
                                      <div key={u.id} className="bg-white p-3.5 rounded-2xl border border-gray-200/80 shadow-xs flex items-center justify-between gap-3">
                                          <div className="flex items-center gap-3">
                                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${u.avatarBg} shrink-0`}>
                                                  {u.avatarIcon}
                                              </div>
                                              <div>
                                                  <div className="flex items-center gap-1.5 flex-wrap">
                                                      <span className="font-black text-xs text-gray-900">{u.name}</span>
                                                      <span className="text-[10px] text-gray-400 font-semibold">{u.handle}</span>
                                                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                                          u.role === '관리자' ? 'bg-[#FEF3C7] text-amber-800' : 'bg-gray-100 text-gray-600'
                                                      }`}>
                                                          {u.role}
                                                      </span>
                                                  </div>
                                                  <p className="text-[11px] text-gray-500 font-medium mt-1">
                                                      방: <span className="font-bold text-gray-700">{u.room}</span> &nbsp;최종 로그인: {u.lastLogin}
                                                  </p>
                                              </div>
                                          </div>
                                          <div className="flex items-center gap-1.5 shrink-0">
                                              <button
                                                  onClick={() => {
                                                      const nextRole = u.role === '관리자' ? '일반 유저' : '관리자';
                                                      const nextBg = u.role === '관리자' ? 'bg-[#D1FAE5] text-emerald-700' : 'bg-[#FEF3C7] text-amber-700';
                                                      const nextIcon = u.role === '관리자' ? '👤' : '👑';
                                                      setAdminUsers(prev => prev.map(item => item.id === u.id ? { ...item, role: nextRole, avatarBg: nextBg, avatarIcon: nextIcon } : item));
                                                      alert(`${u.name} 님의 권한이 '${nextRole}'(으)로 변경되었습니다.`);
                                                  }}
                                                  className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-2.5 py-1 rounded-lg transition shrink-0"
                                              >
                                                  권한 변경
                                              </button>
                                              <button
                                                  onClick={async () => {
                                                      try {
                                                          await fetch(`/api/users/${u.id}`, { method: 'DELETE' });
                                                      } catch (e) {
                                                          console.warn("Failed to delete user on server:", e);
                                                      }
                                                      setAdminUsers(prev => prev.filter(item => item.id !== u.id));
                                                      alert(`${u.name} 회원의 탈퇴 처리가 완료되었습니다.`);
                                                  }}
                                                  className="text-[10px] bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold px-2.5 py-1 rounded-lg transition shrink-0"
                                              >
                                                  회원 탈퇴
                                              </button>
                                          </div>
                                      </div>
                                  ))}
                              </div>

                              <button
                                  onClick={() => {
                                      const newId = `u${adminUsers.length + 1}`;
                                      const newUser = {
                                          id: newId,
                                          name: `기숙사신규생${adminUsers.length + 1}`,
                                          handle: `@dorm_user_${Math.floor(Math.random() * 8999 + 1000)}`,
                                          role: '일반 유저',
                                          room: `제 1 기숙사 B동 ${Math.floor(Math.random() * 400 + 100)}호`,
                                          lastLogin: '8. 1. 오전 12:40',
                                          avatarBg: 'bg-blue-100 text-blue-700',
                                          avatarIcon: '👤',
                                      };
                                      setAdminUsers(prev => [...prev, newUser]);
                                  }}
                                  className="w-full py-2.5 bg-white border border-dashed border-gray-300 text-gray-600 font-bold rounded-2xl text-xs hover:bg-gray-50 transition flex items-center justify-center gap-1.5"
                              >
                                  <i className="fa-solid fa-user-plus text-[#4A5833]"></i>
                                  <span>+ 신규 기숙사 회동 유저 등록 테스트</span>
                              </button>
                          </div>
                      )}

                      {/* [3] 전체 물품 관리 */}
                      {adminActiveTab === 'products' && (
                          <div className="space-y-3 animate-fade-in">
                              <div className="flex items-center justify-between px-1">
                                  <h3 className="text-xs font-black text-gray-800">
                                      전체 물품 관리 ({productList.length}개)
                                  </h3>
                                  <span className="text-[10px] text-gray-400">
                                      * 최고 관리자 권한으로 상태 관리 가능
                                  </span>
                              </div>

                              <div className="space-y-2">
                                  {productList.map(p => (
                                      <div key={p.id} className="bg-white p-3 rounded-2xl border border-gray-200/80 shadow-xs flex items-center justify-between gap-3">
                                          <div 
                                              onClick={() => openProductDetail(p)}
                                              className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition group flex-1"
                                              title="클릭하여 물품 상세 정보 보기"
                                          >
                                              <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-[#4A5833] border border-gray-100 shrink-0 overflow-hidden shadow-2xs">
                                                  {p.image ? (
                                                      <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                                  ) : (
                                                      <i className={`${p.icon} text-xl`}></i>
                                                  )}
                                              </div>
                                              <div>
                                                  <div className="flex items-center gap-1.5">
                                                      <h4 className="text-xs font-black text-gray-800 group-hover:text-[#4A5833] transition">{p.name}</h4>
                                                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                                          p.status === '완료' ? 'bg-gray-100 text-gray-400' : 'bg-emerald-50 text-emerald-600'
                                                      }`}>
                                                          {p.status || '나눔중'}
                                                      </span>
                                                  </div>
                                                  <p className="text-[10px] text-gray-400 mt-0.5">
                                                      {p.price} | {p.seller || '기숙사 메이트'} | {p.location}
                                                  </p>
                                              </div>
                                          </div>

                                          <div className="flex items-center gap-1.5 shrink-0">
                                              <button
                                                  onClick={async () => {
                                                      const next = p.status === '완료' ? '나눔중' : '완료';
                                                      await updateProductStatus(p.id, next as any);
                                                      setProductList(prev => prev.map(item => item.id === p.id ? { ...item, status: next as any } : item));
                                                  }}
                                                  className="text-[10px] bg-[#4A5833] text-white font-bold px-2.5 py-1 rounded-lg hover:bg-[#3E4C27] transition shrink-0"
                                              >
                                                  {p.status === '완료' ? '나눔중 변경' : '완료 처리'}
                                              </button>
                                              <button
                                                   onClick={() => handleDeleteProduct(p)}
                                                   className="text-[10px] bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold px-2.5 py-1 rounded-lg transition shrink-0 cursor-pointer"
                                               >
                                                   물품 삭제
                                               </button>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}

                  </div>

                  {/* (5) 팝업 푸터 */}
                  <div className="p-3 bg-white border-t border-gray-100 flex items-center justify-between text-xs">
                      <span className="text-[10px] text-gray-400 font-semibold">
                          연근마켓 백엔드 나눔 앱 최고 관리자 서비스
                      </span>
                      <button
                          onClick={() => setIsAdminModalOpen(false)}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-4 py-1.5 rounded-xl transition"
                      >
                          닫기
                      </button>
                  </div>

              </div>
          </div>
      )}

      {/* ========================================== */}
      {/* 🔔 실시간 알림 센터 모달 (팝업 창) */}
      {/* ========================================== */}
      {isNotificationOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[85vh] animate-scale-up">
                  
                  {/* (1) 모달 헤더 */}
                  <div className="bg-[#4A5833] text-white p-4 flex items-center justify-between shadow-xs">
                      <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center text-amber-300">
                              <i className="fa-solid fa-bell text-sm"></i>
                          </div>
                          <div>
                              <h2 className="text-sm font-black flex items-center gap-1.5">
                                  실시간 알림 센터
                                  {unreadNotifCount > 0 && (
                                      <span className="text-[10px] bg-red-500 text-white font-bold px-1.5 py-0.2 rounded-full">
                                          {unreadNotifCount}
                                      </span>
                                  )}
                              </h2>
                              <p className="text-[10px] text-white/80 font-medium">
                                  등록 물품 소식 & 관심 찜 랭킹 소식
                              </p>
                          </div>
                      </div>
                      <button 
                          onClick={() => setIsNotificationOpen(false)}
                          className="w-7 h-7 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white/90 transition"
                      >
                          <i className="fa-solid fa-xmark text-sm"></i>
                      </button>
                  </div>

                  {/* (2) 모달 서브 액션바 */}
                  <div className="bg-[#F8FAF5] px-4 py-2 border-b border-gray-100 flex items-center justify-between text-xs">
                      <span className="text-[11px] font-bold text-gray-500">
                          총 {notifications.length}개의 알림
                      </span>
                      {notifications.length > 0 && (
                          <div className="flex items-center gap-2">
                              {unreadNotifCount > 0 && (
                                  <button
                                      onClick={() => {
                                          setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
                                      }}
                                      className="text-[10px] font-bold text-[#4A5833] hover:underline"
                                  >
                                      모두 읽음
                                  </button>
                              )}
                              <button
                                  onClick={() => setNotifications([])}
                                  className="text-[10px] font-bold text-gray-400 hover:text-red-500 hover:underline"
                              >
                                  전체 지우기
                              </button>
                          </div>
                      )}
                  </div>

                  {/* (3) 알림 리스트 바디 */}
                  <div className="p-3 overflow-y-auto space-y-2 flex-1 bg-gray-50/50">
                      {notifications.length > 0 ? (
                          notifications.map((notif) => (
                              <div
                                  key={notif.id}
                                  onClick={() => {
                                      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, unread: false } : n));
                                      if (notif.type === 'chat') {
                                          setIsNotificationOpen(false);
                                          setCurrentView('chat');
                                      }
                                  }}
                                  className={`p-3 rounded-2xl border transition-all cursor-pointer relative flex gap-3 ${
                                      notif.unread
                                          ? 'bg-white border-[#C2CEAB] shadow-sm ring-1 ring-[#4A5833]/10'
                                          : 'bg-white/80 border-gray-100 opacity-80 hover:opacity-100'
                                  }`}
                              >
                                  {/* 아이콘 */}
                                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold shadow-xs ${notif.iconBg || 'bg-[#EAF2DA] text-[#4A5833]'}`}>
                                      <i className={notif.icon || 'fa-solid fa-bell'}></i>
                                  </div>

                                  {/* 정보 */}
                                  <div className="flex-1 min-w-0 pr-4">
                                      <div className="flex items-center justify-between mb-0.5">
                                          <h4 className="text-xs font-black text-gray-800 truncate flex items-center gap-1">
                                              {notif.title}
                                              {notif.unread && (
                                                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full inline-block"></span>
                                              )}
                                          </h4>
                                          <span className="text-[9px] font-bold text-gray-400 shrink-0">
                                              {notif.time}
                                          </span>
                                      </div>
                                      <p className="text-[11px] text-gray-600 font-medium leading-snug break-words">
                                          {notif.message}
                                      </p>
                                  </div>

                                  {/* 개별 삭제 버튼 */}
                                  <button
                                      onClick={(e) => {
                                          e.stopPropagation();
                                          setNotifications(prev => prev.filter(n => n.id !== notif.id));
                                      }}
                                      className="absolute top-2 right-2 text-gray-300 hover:text-gray-500 text-xs p-1"
                                      title="알림 삭제"
                                  >
                                      <i className="fa-solid fa-xmark"></i>
                                  </button>
                              </div>
                          ))
                      ) : (
                          <div className="py-12 text-center space-y-2">
                              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-300 mx-auto text-xl">
                                  <i className="fa-regular fa-bell-slash"></i>
                              </div>
                              <p className="text-xs font-bold text-gray-500">새로운 알림이 없습니다.</p>
                              <p className="text-[10px] text-gray-400">물품을 등록하거나 찜을 받으면 알림이 생성됩니다!</p>
                          </div>
                      )}
                  </div>

                  {/* (4) 모달 푸터 */}
                  <div className="p-3 bg-white border-t border-gray-100 flex items-center justify-between text-xs">
                      <span className="text-[10px] font-bold text-gray-400">
                          연근마켓 알림 서비스
                      </span>
                      <button
                          onClick={() => setIsNotificationOpen(false)}
                          className="bg-[#4A5833] hover:bg-[#3E4C27] text-white font-bold px-4 py-1.5 rounded-xl transition text-xs shadow-xs"
                      >
                          닫기
                      </button>
                  </div>

              </div>
          </div>
      )}

      {/* ========================================== */}
      {/* 🔑 백엔드 회원가입 및 로그인 모달 */}
      {/* ========================================== */}
      {isAuthModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[90vh] animate-scale-up">
                  {/* 모달 헤더 */}
                  <div className="bg-[#4A5833] text-white p-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                              <i className="fa-solid fa-user-lock text-white text-sm"></i>
                          </div>
                          <div>
                              <h2 className="text-sm font-black">
                                  {authMode === 'login' ? '연근마켓 로그인' : '신규 회원가입'}
                              </h2>
                              <p className="text-[10px] text-white/80">
                                  연근마켓 로그인 및 회원가입
                              </p>
                          </div>
                      </div>
                      <button 
                          onClick={() => setIsAuthModalOpen(false)}
                          className="w-7 h-7 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white/90"
                      >
                          <i className="fa-solid fa-xmark text-sm"></i>
                      </button>
                  </div>

                  {/* 탭 버튼 */}
                  <div className="flex border-b border-gray-100 bg-gray-50 text-xs font-bold">
                      <button
                          onClick={() => { setAuthMode('login'); setAuthError(''); }}
                          className={`flex-1 py-2.5 text-center transition border-b-2 ${
                              authMode === 'login'
                                  ? 'border-[#4A5833] text-[#4A5833] bg-white font-black'
                                  : 'border-transparent text-gray-400 hover:text-gray-600'
                          }`}
                      >
                          <i className="fa-solid fa-right-to-bracket mr-1"></i> 로그인
                      </button>
                      <button
                          onClick={() => { setAuthMode('register'); setAuthError(''); }}
                          className={`flex-1 py-2.5 text-center transition border-b-2 ${
                              authMode === 'register'
                                  ? 'border-[#4A5833] text-[#4A5833] bg-white font-black'
                                  : 'border-transparent text-gray-400 hover:text-gray-600'
                          }`}
                      >
                          <i className="fa-solid fa-user-plus mr-1"></i> 회원가입
                      </button>
                  </div>

                  {/* 바디 폼 */}
                  <div className="p-4 overflow-y-auto flex-1 space-y-3.5 text-xs">
                      {authError && (
                          <div className="bg-red-50 border border-red-200 text-red-600 p-2.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5">
                              <i className="fa-solid fa-[#4A5833] fa-circle-exclamation text-red-500"></i>
                              <span>{authError}</span>
                          </div>
                      )}

                      <form onSubmit={authMode === 'login' ? handleBackendLogin : handleBackendRegister} className="space-y-3">
                          {/* 아이디 입력 field */}
                          <div>
                              <label className="block text-[11px] font-extrabold text-gray-700 mb-1">
                                  아이디 (ID) <span className="text-red-500">*</span>
                              </label>
                              <div className="flex gap-1.5">
                                  <input 
                                      type="text" 
                                      value={authForm.username}
                                      onChange={(e) => {
                                          const cleanVal = e.target.value.replace(/\s/g, '');
                                          setAuthForm({ ...authForm, username: cleanVal });
                                          setUsernameCheckStatus('idle');
                                          setUsernameCheckMsg('');
                                      }}
                                      placeholder="아이디를 입력하세요 (공백 금지)"
                                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-[#4A5833]/30 text-xs font-bold"
                                  />
                                  {authMode === 'register' && (
                                      <button
                                          type="button"
                                          onClick={handleCheckUsername}
                                          disabled={usernameCheckStatus === 'checking' || !authForm.username}
                                          className="px-3 py-2 bg-[#4A5833] hover:bg-[#3E4C27] text-white font-extrabold text-[11px] rounded-xl transition shrink-0 active:scale-95 disabled:opacity-40"
                                      >
                                          {usernameCheckStatus === 'checking' ? (
                                              <i className="fa-solid fa-spinner animate-spin"></i>
                                          ) : (
                                              '중복 확인'
                                          )}
                                      </button>
                                  )}
                              </div>
                              {/* 아이디 안내 & 중복 확인 결과 피드백 */}
                              {authMode === 'register' && (
                                  <div className="mt-1 text-[10px] font-bold pl-1">
                                      {usernameCheckStatus === 'available' && (
                                          <span className="text-emerald-600">{usernameCheckMsg}</span>
                                      )}
                                      {usernameCheckStatus === 'taken' && (
                                          <span className="text-red-500">{usernameCheckMsg}</span>
                                      )}
                                      {usernameCheckStatus === 'idle' && (
                                          <span className="text-gray-400">※ 띄어쓰기 금지 / 아이디 중복 확인 필수</span>
                                      )}
                                  </div>
                              )}
                          </div>

                          {/* 비밀번호 입력 field */}
                          <div>
                              <label className="block text-[11px] font-extrabold text-gray-700 mb-1">
                                  비밀번호 (Password) <span className="text-red-500">*</span>
                              </label>
                              <input 
                                  type="password" 
                                  value={authForm.password}
                                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value.replace(/\s/g, '') })}
                                  placeholder="비밀번호를 입력하세요"
                                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-[#4A5833]/30 text-xs font-bold"
                              />
                              {authMode === 'register' && (
                                  <p className="text-[9.5px] text-amber-700 font-extrabold mt-1 pl-1 bg-amber-50 p-1.5 rounded-lg border border-amber-200/60">
                                      🔒 보안 조건: 9자 이상 + 영문 & 특수기호(!, @, #, $, % 등) 필수 포함 (공백 불가)
                                  </p>
                              )}
                          </div>

                          {authMode === 'register' && (
                              <>
                                  <div>
                                      <label className="block text-[11px] font-extrabold text-gray-700 mb-1">
                                          비밀번호 확인 <span className="text-red-500">*</span>
                                      </label>
                                      <input 
                                          type="password" 
                                          value={authForm.confirmPassword}
                                          onChange={(e) => setAuthForm({ ...authForm, confirmPassword: e.target.value.replace(/\s/g, '') })}
                                          placeholder="비밀번호를 한번 더 입력하세요"
                                          className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-[#4A5833]/30 text-xs font-bold"
                                      />
                                  </div>

                                  <div>
                                      <label className="block text-[11px] font-extrabold text-gray-700 mb-1">
                                          이름 / 닉네임 <span className="text-red-500">*</span>
                                      </label>
                                      <input 
                                          type="text" 
                                          value={authForm.name}
                                          onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                                          placeholder="예: 홍길동 (연근메이트)"
                                          className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-[#4A5833]/30 text-xs font-bold"
                                      />
                                  </div>

                                  {/* 규격화된 기숙사 장소 선택기 ("제 - 기숙사 -동 -호") */}
                                  <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-2.5 space-y-1.5">
                                      <label className="block text-[11px] font-extrabold text-emerald-900">
                                          기숙사 상세 위치 지정 <span className="text-red-500">*</span>
                                      </label>
                                      
                                      <div className="flex items-center justify-between gap-1 bg-white p-2 rounded-xl border border-emerald-200 text-xs font-black text-gray-800 shadow-2xs">
                                          <span className="text-[#4A5833] font-black shrink-0 pl-1">제</span>
                                          <select 
                                              value={dormNum} 
                                              onChange={(e) => {
                                                  const newDorm = e.target.value;
                                                  setDormNum(newDorm);
                                                  if (newDorm === '1' && !['A', 'B', 'C'].includes(buildingName)) {
                                                      setBuildingName('A');
                                                  } else if (newDorm === '2' && !['D', 'E', 'F', 'G'].includes(buildingName)) {
                                                      setBuildingName('D');
                                                  }
                                              }}
                                              className="bg-gray-100 border border-gray-200 rounded-lg px-2 py-1 font-bold text-xs focus:outline-none text-[#4A5833] cursor-pointer"
                                          >
                                              <option value="1">1</option>
                                              <option value="2">2</option>
                                          </select>
                                          <span className="text-[#4A5833] font-black shrink-0">기숙사</span>

                                          <select 
                                              value={buildingName}
                                              onChange={(e) => setBuildingName(e.target.value)}
                                              className="bg-gray-100 border border-gray-200 rounded-lg px-2 py-1 font-bold text-xs focus:outline-none text-[#4A5833] cursor-pointer"
                                          >
                                              {dormNum === '1' ? (
                                                  <>
                                                      <option value="A">A</option>
                                                      <option value="B">B</option>
                                                      <option value="C">C</option>
                                                  </>
                                              ) : (
                                                  <>
                                                      <option value="D">D</option>
                                                      <option value="E">E</option>
                                                      <option value="F">F</option>
                                                      <option value="G">G</option>
                                                  </>
                                              )}
                                          </select>
                                          <span className="text-[#4A5833] font-black shrink-0">동</span>

                                          <input 
                                              type="text" 
                                              inputMode="numeric"
                                              value={roomNum}
                                              onChange={(e) => setRoomNum(e.target.value.replace(/[^0-9]/g, ''))}
                                              placeholder="302"
                                              maxLength={4}
                                              className="w-12 text-center bg-gray-100 border border-gray-200 rounded-lg px-1 py-1 font-bold text-xs focus:outline-none"
                                          />
                                          <span className="text-[#4A5833] font-black shrink-0 pr-1">호</span>
                                      </div>

                                      <div className="text-[10px] text-emerald-800 font-extrabold pl-1 flex items-center justify-between">
                                          <span>완성 주소:</span>
                                          <span className="text-white bg-[#4A5833] px-2 py-0.5 rounded-md font-black shadow-2xs">
                                              제{dormNum}기숙사 {buildingName.trim().toUpperCase() || 'A'}동 {roomNum.trim() || '101'}호
                                          </span>
                                      </div>
                                  </div>
                              </>
                          )}

                          <button
                              type="submit"
                              disabled={authLoading}
                              className="w-full py-3 bg-[#4A5833] hover:bg-[#3E4C27] text-white font-extrabold rounded-xl transition shadow-md mt-2 flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
                          >
                              {authLoading ? (
                                  <i className="fa-solid fa-spinner animate-spin"></i>
                              ) : authMode === 'login' ? (
                                  <>
                                      <i className="fa-solid fa-right-to-bracket"></i>
                                      <span>로그인</span>
                                  </>
                              ) : (
                                  <>
                                      <i className="fa-solid fa-user-plus"></i>
                                      <span>회원가입 완료</span>
                                  </>
                              )}
                          </button>
                      </form>
                  </div>

                  {/* 푸터 */}
                  <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400 font-bold">
                      <span>환경을 지키는 따뜻한 거래</span>
                      <button 
                          onClick={() => setIsAuthModalOpen(false)}
                          className="hover:underline text-gray-500"
                      >
                          취소
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* ========================================== */}
      {/* 📜 백엔드 접속 & 활동 기록 로그 모달 */}
      {/* ========================================== */}
      {logsModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[85vh] animate-scale-up">
                  
                  {/* 모달 헤더 */}
                  <div className="bg-[#4A5833] text-white p-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center text-white">
                              <i className="fa-solid fa-clock-rotate-left text-sm"></i>
                          </div>
                          <div>
                              <h2 className="text-sm font-black flex items-center gap-1.5">
                                  백엔드 접속 & 활동 기록 로그
                                  <span className="text-[10px] bg-emerald-500 text-white px-1.5 py-0.2 rounded-full font-bold">
                                      실시간
                                  </span>
                              </h2>
                              <p className="text-[10px] text-white/80 font-medium">
                                  로그인, 회원가입 및 거래 데이터 축적 서버 기록
                              </p>
                          </div>
                      </div>
                      <button 
                          onClick={() => setLogsModalOpen(false)}
                          className="w-7 h-7 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white/90"
                      >
                          <i className="fa-solid fa-xmark text-sm"></i>
                      </button>
                  </div>

                  {/* 액션바 */}
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex items-center justify-between text-xs">
                      <span className="text-[11px] font-bold text-gray-600">
                          총 {fetchedLogs.length}건의 로그 기록
                      </span>
                      <button
                          onClick={fetchAccessLogs}
                          disabled={logsLoading}
                          className="text-[10px] font-bold text-[#4A5833] hover:underline flex items-center gap-1"
                      >
                          <i className={`fa-solid fa-rotate ${logsLoading ? 'animate-spin' : ''}`}></i>
                          새로고침
                      </button>
                  </div>

                  {/* 로그 타임라인 바디 */}
                  <div className="p-3 overflow-y-auto space-y-2 flex-1 bg-gray-50/50">
                      {fetchedLogs.length > 0 ? (
                          fetchedLogs.map((log) => {
                              const isLogin = log.action === 'LOGIN';
                              const isRegister = log.action === 'REGISTER';
                              const isAdmin = log.role === 'admin';

                              let badgeClass = "bg-blue-100 text-blue-800 border-blue-200";
                              if (isLogin) badgeClass = "bg-emerald-100 text-emerald-800 border-emerald-200";
                              if (isRegister) badgeClass = "bg-purple-100 text-purple-800 border-purple-200";
                              if (isAdmin) badgeClass = "bg-amber-100 text-amber-900 border-amber-300 font-black";

                              return (
                                  <div key={log.id} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-2xs space-y-1">
                                      <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-1.5">
                                              <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold border ${badgeClass}`}>
                                                  {log.action}
                                              </span>
                                              <span className="text-xs font-black text-gray-800">
                                                  {log.name} ({log.username})
                                              </span>
                                              {isAdmin && (
                                                  <span className="text-[9px] bg-amber-500 text-white font-bold px-1 rounded">
                                                      관리자
                                                  </span>
                                              )}
                                          </div>
                                          <span className="text-[9px] text-gray-400 font-mono">
                                              {new Date(log.timestamp).toLocaleString('ko-KR')}
                                          </span>
                                      </div>
                                      <p className="text-[11px] text-gray-600 font-semibold pl-1">
                                          {log.details}
                                      </p>
                                      <div className="text-[9px] text-gray-400 font-mono flex items-center gap-2 pl-1 pt-0.5 border-t border-gray-50">
                                          <span>IP: {log.ip || '127.0.0.1'}</span>
                                          <span>•</span>
                                          <span className="truncate max-w-[200px]">{log.userAgent}</span>
                                      </div>
                                  </div>
                              );
                          })
                      ) : (
                          <div className="py-12 text-center space-y-2">
                              <i className="fa-solid fa-[#4A5833] fa-clock-rotate-left text-2xl text-gray-300"></i>
                              <p className="text-xs font-bold text-gray-500">기록된 접속 로그가 없습니다.</p>
                          </div>
                      )}
                  </div>

                  {/* 모달 푸터 */}
                  <div className="p-3 bg-white border-t border-gray-100 flex items-center justify-between text-xs">
                      <span className="text-[10px] font-bold text-gray-400">
                          연근마켓 백엔드 로그 서버
                      </span>
                      <button
                          onClick={() => setLogsModalOpen(false)}
                          className="bg-[#4A5833] text-white font-bold px-4 py-1.5 rounded-xl transition text-xs shadow-xs"
                      >
                          닫기
                      </button>
                  </div>

              </div>
          </div>
      )}

      {/* 실시간 카메라 촬영 모달 */}
      <CameraCaptureModal 
        isOpen={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        onCapture={handleCameraCapture}
      />

      {/* 채팅 내 실시간 카메라 촬영 모달 */}
      <CameraCaptureModal 
        isOpen={isChatCameraOpen}
        onClose={() => setIsChatCameraOpen(false)}
        onCapture={(imageDataUrl) => {
          setChatImagePreview(imageDataUrl);
          setIsChatCameraOpen(false);
        }}
      />

      {/* 채팅 이미지 확대 모달 */}
      {chatImageModal && (
        <div 
          className="fixed inset-0 z-[120] bg-black/85 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in"
          onClick={() => setChatImageModal(null)}
        >
          <div className="relative max-w-2xl max-h-[85vh] p-2" onClick={(e) => e.stopPropagation()}>
            <img 
              src={chatImageModal} 
              alt="확대 사진" 
              className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-white/20"
            />
            <button
              type="button"
              onClick={() => setChatImageModal(null)}
              className="absolute -top-3 -right-3 bg-white/20 hover:bg-white/40 text-white w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md transition cursor-pointer"
            >
              <i className="fa-solid fa-xmark text-base"></i>
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
