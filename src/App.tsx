import { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { Ban, LogOut, Moon, Search, Sun } from 'lucide-react';
import { auth, BOOTSTRAPPED_OWNER_EMAIL, db, handleFirestoreError, OperationType } from './firebase';
import { CrestLogo } from './components/CrestLogo';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { LoginScreen } from './components/LoginScreen';
import { DesktopSidebar, getNavItemLabel, MobileBottomNav, NAV_ITEMS } from './components/Navigation';
import { NotificationCenter } from './components/NotificationCenter';
import { AdminMessagesView } from './components/views/AdminMessagesView';
import { AgendaView } from './components/views/AgendaView';
import { AnnouncementsView } from './components/views/AnnouncementsView';
import { AssignmentsView } from './components/views/AssignmentsView';
import { C6AAssistantView } from './components/views/C6AAssistantView';
import { ChatView } from './components/views/ChatView';
import { DashboardView } from './components/views/DashboardView';
import { GameCenterView } from './components/views/GameCenterView';
import { HelpCenterView } from './components/views/HelpCenterView';
import { OwnerPanelView } from './components/views/OwnerPanelView';
import { PicketScheduleView } from './components/views/PicketScheduleView';
import { ProfileView } from './components/views/ProfileView';
import { ScheduleView } from './components/views/ScheduleView';
import { SettingsView } from './components/views/SettingsView';
import { TreasuryView } from './components/views/TreasuryView';
import { WhatsAppGroupView } from './components/views/WhatsAppGroupView';
import {
  createOrUpdateUserProfile,
  fetchPublicProfile,
  initializeOfficial6DaySchedule,
  normalizeUserPublic,
  recordLoginAudit,
  saveReadNotifications,
  syncPrivateUserOnLogin,
  updateUserPresence,
} from './services/firestoreService';
import type {
  ActivityLog,
  AdminMessage,
  AgendaItem,
  Announcement,
  Assignment,
  BlockedUser,
  ChatMessage,
  ChatRoom,
  ClassSettings,
  ClientErrorLog,
  LoginHistoryEntry,
  NavTab,
  NotificationItem,
  NotificationState,
  PicketScheduleItem,
  ScheduleItem,
  TaskProgress,
  TaskProgressStatus,
  TreasuryEntry,
  UserPresence,
  UserPublic,
  UserReport,
} from './types';
import {
  canAccessNavTab,
  CLASS_ID,
  CLASS_TITLE,
  DEFAULT_CLASS_SETTINGS,
  getEffectiveSchedules,
  matchesOfficial6DaySchedule,
  SCHOOL_NAME,
  toMillis,
} from './utils/validation';
import type { C6AClassContextData } from './utils/c6aBot';

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserPublic | null>(null);
  const [pendingOnboardingUser, setPendingOnboardingUser] = useState<{
    uid: string;
    email: string;
    defaultName: string;
  } | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isProfileBusy, setIsProfileBusy] = useState(false);
  const [isInitializingSchedule, setIsInitializingSchedule] = useState(false);

  const [activeTab, setActiveTab] = useState<NavTab>('beranda');
  const [selectedChatRoomId, setSelectedChatRoomId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [compactMode, setCompactMode] = useState<boolean>(
    () => typeof localStorage !== 'undefined' && localStorage.getItem('kelas6a_compact') === '1'
  );
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('kelas6a_theme') === 'dark') {
      return 'dark';
    }
    return 'light';
  });

  // Apply Dark/Light theme class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('kelas6a_theme', theme);
  }, [theme]);

  // Real-time Firestore collections
  const [settings, setSettings] = useState<ClassSettings>({
    ...DEFAULT_CLASS_SETTINGS,
    updatedAt: null,
  });
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [taskProgressMap, setTaskProgressMap] = useState<Map<string, TaskProgressStatus>>(new Map());
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [schedulesLoaded, setSchedulesLoaded] = useState(false);
  const [picketSchedules, setPicketSchedules] = useState<PicketScheduleItem[]>([]);
  const [agendas, setAgendas] = useState<AgendaItem[]>([]);
  const [treasury, setTreasury] = useState<TreasuryEntry[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [publicRooms, setPublicRooms] = useState<ChatRoom[]>([]);
  const [dmRooms, setDmRooms] = useState<ChatRoom[]>([]);
  const [presenceList, setPresenceList] = useState<UserPresence[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [userReports, setUserReports] = useState<UserReport[]>([]);
  const [adminMessages, setAdminMessages] = useState<AdminMessage[]>([]);
  const [members, setMembers] = useState<UserPublic[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryEntry[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  // Real-time multi-type Notification state
  const [classNotifications, setClassNotifications] = useState<NotificationItem[]>([]);
  const [privateNotifications, setPrivateNotifications] = useState<NotificationItem[]>([]);
  const [readNotifIds, setReadNotifIds] = useState<Set<string>>(new Set());
  const [liveToast, setLiveToast] = useState<NotificationItem | null>(null);
  const [browserPushEnabled, setBrowserPushEnabled] = useState<boolean>(
    typeof Notification !== 'undefined' && Notification.permission === 'granted'
  );

  // Runtime error log capture for Owner diagnostics
  const [clientErrors, setClientErrors] = useState<ClientErrorLog[]>([]);

  const knownNotifIdsRef = useRef<Set<string>>(new Set());
  const notifsInitializedRef = useRef(false);
  const autoSeededScheduleRef = useRef(false);
  const preferredStudentRef = useRef<{ name: string; nickname: string; absen: number } | undefined>(
    undefined
  );

  useEffect(() => {
    const pushErr = (source: string, message: string) => {
      setClientErrors((prev) =>
        [
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            source,
            message: message.slice(0, 300),
            timestamp: new Date().toLocaleTimeString('id-ID'),
          },
          ...prev,
        ].slice(0, 50)
      );
    };

    const onError = (e: ErrorEvent) => pushErr('window.error', e.message || 'Kesalahan JavaScript');
    const onRejection = (e: PromiseRejectionEvent) =>
      pushErr(
        'unhandledrejection',
        e.reason instanceof Error ? e.reason.message : String(e.reason)
      );

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  // Keyboard shortcut Ctrl+K / Cmd+K for Global Search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Auth listener & persistent session hydration
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthError(null);
      setFirebaseUser(user);

      if (!user) {
        setProfile(null);
        setPendingOnboardingUser(null);
        setAuthReady(true);
        knownNotifIdsRef.current = new Set();
        notifsInitializedRef.current = false;
        return;
      }

      try {
        const existing = await fetchPublicProfile(user.uid);
        if (existing) {
          setProfile(existing);
          setPendingOnboardingUser(null);
          await syncPrivateUserOnLogin(user);

          const sessionFlag = `logged_login_${user.uid}`;
          if (!sessionStorage.getItem(sessionFlag)) {
            await recordLoginAudit(user, existing);
            sessionStorage.setItem(sessionFlag, '1');
          }
        } else if (user.email === BOOTSTRAPPED_OWNER_EMAIL) {
          const ownerProfile = await createOrUpdateUserProfile(
            user,
            user.displayName || 'Wali Kelas 6A',
            'Wali Kelas',
            0,
            true
          );
          sessionStorage.setItem(`logged_login_${user.uid}`, '1');
          setProfile(ownerProfile);
          setPendingOnboardingUser(null);
        } else if (preferredStudentRef.current) {
          const pref = preferredStudentRef.current;
          preferredStudentRef.current = undefined;
          const created = await createOrUpdateUserProfile(
            user,
            pref.name,
            pref.nickname,
            pref.absen,
            true
          );
          sessionStorage.setItem(`logged_login_${user.uid}`, '1');
          setProfile(created);
          setPendingOnboardingUser(null);
        } else {
          setProfile(null);
          setPendingOnboardingUser({
            uid: user.uid,
            email: user.email || '',
            defaultName: user.displayName || '',
          });
        }
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Gagal memuat profil pengguna.');
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsub();
  }, []);

  // Real-time presence heartbeat
  useEffect(() => {
    if (!authReady || !firebaseUser || !profile || profile.status === 'nonaktif') return;
    const uid = firebaseUser.uid;
    const hide = Boolean(profile.hideOnlineStatus);

    void updateUserPresence(uid, true, hide);

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void updateUserPresence(uid, true, hide);
      }
    }, 45000);

    const onVisChange = () => {
      void updateUserPresence(uid, document.visibilityState === 'visible', hide);
    };
    const onBeforeUnload = () => {
      void updateUserPresence(uid, false, hide);
    };

    document.addEventListener('visibilitychange', onVisChange);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisChange);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [authReady, firebaseUser, profile?.uid, profile?.status, profile?.hideOnlineStatus]);

  // Real-time Firestore subscriptions (only when authenticated, profiled, and status === 'aktif')
  useEffect(() => {
    if (!authReady || !firebaseUser || !profile || profile.status === 'nonaktif') return;

    const uid = firebaseUser.uid;
    const isStaff = profile.role === 'owner' || profile.role === 'admin';
    const unsubs: Array<() => void> = [];

    // 0. Class & App Settings
    unsubs.push(
      onSnapshot(
        doc(db, 'settings', 'class_config'),
        (snap) => {
          if (snap.exists()) {
            const raw = snap.data() as Partial<ClassSettings>;
            setSettings({
              ...DEFAULT_CLASS_SETTINGS,
              ...raw,
              classId: '6A',
              updatedAt: raw.updatedAt ?? null,
            });
          } else {
            setSettings({ ...DEFAULT_CLASS_SETTINGS, updatedAt: null });
          }
        },
        (error) => handleFirestoreError(error, OperationType.GET, 'settings/class_config')
      )
    );

    // 1. Announcements
    unsubs.push(
      onSnapshot(
        query(collection(db, 'announcements'), where('classId', '==', CLASS_ID)),
        (snap) => {
          const list = snap.docs
            .map((d) => {
              const raw = d.data() as Partial<Announcement>;
              return {
                id: d.id,
                classId: '6A' as const,
                title: raw.title || '',
                content: raw.content || '',
                category: raw.category || 'Umum',
                priority: raw.priority || 'normal',
                pinned: Boolean(raw.pinned),
                archived: Boolean(raw.archived),
                authorId: raw.authorId || '',
                authorName: raw.authorName || 'Pengurus',
                authorRole: raw.authorRole || 'admin',
                createdAt: raw.createdAt ?? null,
                updatedAt: raw.updatedAt ?? null,
              };
            })
            .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
          setAnnouncements(list);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'announcements')
      )
    );

    // 2. Assignments
    unsubs.push(
      onSnapshot(
        query(collection(db, 'assignments'), where('classId', '==', CLASS_ID)),
        (snap) => {
          const list = snap.docs
            .map((d) => {
              const raw = d.data() as Partial<Assignment>;
              return {
                id: d.id,
                classId: '6A' as const,
                subject: raw.subject || 'Umum',
                title: raw.title || '',
                description: raw.description || '',
                assignedDate: raw.assignedDate || raw.dueDate || '',
                dueDate: raw.dueDate || '',
                priority: raw.priority || 'sedang',
                authorId: raw.authorId || '',
                authorName: raw.authorName || 'Anggota 6A',
                authorRole: raw.authorRole || 'siswa',
                editHistory: Array.isArray(raw.editHistory) ? raw.editHistory : [],
                createdAt: raw.createdAt ?? null,
                updatedAt: raw.updatedAt ?? null,
              };
            })
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
          setAssignments(list);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'assignments')
      )
    );

    // 3. Student Task Progress
    unsubs.push(
      onSnapshot(
        collection(db, 'users_private', uid, 'task_progress'),
        (snap) => {
          const map = new Map<string, TaskProgressStatus>();
          snap.docs.forEach((d) => {
            const data = d.data() as Partial<TaskProgress>;
            const st: TaskProgressStatus = data.status
              ? data.status
              : data.completed
                ? 'selesai'
                : 'belum';
            if (data.taskId) map.set(data.taskId, st);
          });
          setTaskProgressMap(map);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, `users_private/${uid}/task_progress`)
      )
    );

    // 4. Schedules
    unsubs.push(
      onSnapshot(
        query(collection(db, 'schedules'), where('classId', '==', CLASS_ID)),
        (snap) => {
          const list = snap.docs.map((d) => {
            const raw = d.data() as Partial<ScheduleItem>;
            return {
              id: d.id,
              classId: '6A' as const,
              day: raw.day || 'Senin',
              order: typeof raw.order === 'number' ? raw.order : 1,
              startTime: raw.startTime || '',
              endTime: raw.endTime || '',
              subject: raw.subject || '',
              teacher: raw.teacher || '',
              room: raw.room || '',
              authorId: raw.authorId || '',
              updatedAt: raw.updatedAt ?? null,
            };
          });
          setSchedules(list);
          setSchedulesLoaded(true);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'schedules')
      )
    );

    // 4b. Picket Schedules
    unsubs.push(
      onSnapshot(
        query(collection(db, 'picket_schedules'), where('classId', '==', CLASS_ID)),
        (snap) => {
          const list = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<PicketScheduleItem, 'id'>),
          }));
          setPicketSchedules(list);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'picket_schedules')
      )
    );

    // 5. Agendas
    unsubs.push(
      onSnapshot(
        query(collection(db, 'agendas'), where('classId', '==', CLASS_ID)),
        (snap) => {
          const list = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<AgendaItem, 'id'>),
          }));
          setAgendas(list);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'agendas')
      )
    );

    // 6. Treasury
    unsubs.push(
      onSnapshot(
        query(collection(db, 'treasury'), where('classId', '==', CLASS_ID)),
        (snap) => {
          const list = snap.docs.map((d) => {
            const raw = d.data() as Partial<TreasuryEntry>;
            return {
              id: d.id,
              classId: '6A' as const,
              type: raw.type || 'pemasukan',
              amount: raw.amount || 0,
              description: raw.description || '',
              category: raw.category || 'Lainnya',
              studentName: raw.studentName || '',
              paymentStatus: raw.paymentStatus || (raw.type === 'pengeluaran' ? 'operasional' : 'lunas'),
              correctionNote: raw.correctionNote || '',
              date: raw.date || '',
              recordedById: raw.recordedById || '',
              recordedByName: raw.recordedByName || 'Pengurus',
              createdAt: raw.createdAt ?? null,
              updatedAt: raw.updatedAt ?? null,
            };
          });
          setTreasury(list);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'treasury')
      )
    );

    // 7. Legacy Chat Messages
    unsubs.push(
      onSnapshot(
        query(collection(db, 'chat_messages'), where('classId', '==', CLASS_ID)),
        (snap) => {
          const list = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<ChatMessage, 'id'>) }))
            .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
          setChatMessages(list);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'chat_messages')
      )
    );

    // 7b. Upgraded Chat Rooms (Public/Group/Game + Own DMs)
    unsubs.push(
      onSnapshot(
        query(collection(db, 'chat_rooms'), where('type', 'in', ['class', 'group', 'game'])),
        (snap) => {
          const list = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ChatRoom, 'id'>),
          }));
          setPublicRooms(list);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'chat_rooms_public')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'chat_rooms'), where('participantIds', 'array-contains', uid)),
        (snap) => {
          const list = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ChatRoom, 'id'>),
          }));
          setDmRooms(list);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'chat_rooms_dm')
      )
    );

    // 7c. Presence & Blocked Users
    unsubs.push(
      onSnapshot(
        collection(db, 'presence'),
        (snap) => {
          const list = snap.docs.map((d) => ({
            ...(d.data() as UserPresence),
            uid: d.id,
          }));
          setPresenceList(list);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'presence')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'users_private', uid, 'blocked_users'),
        (snap) => {
          const list = snap.docs.map((d) => d.data() as BlockedUser);
          setBlockedUsers(list);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, `users_private/${uid}/blocked_users`)
      )
    );

    // 8. Admin Messages
    const adminMsgQuery = isStaff
      ? query(collection(db, 'admin_messages'), where('classId', '==', CLASS_ID))
      : query(collection(db, 'admin_messages'), where('senderId', '==', uid));

    unsubs.push(
      onSnapshot(
        adminMsgQuery,
        (snap) => {
          const list = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<AdminMessage, 'id'>) }))
            .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
          setAdminMessages(list);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'admin_messages')
      )
    );

    // 8b. Moderation User Reports
    const reportsQuery = isStaff
      ? query(collection(db, 'user_reports'))
      : query(collection(db, 'user_reports'), where('reporterId', '==', uid));

    unsubs.push(
      onSnapshot(
        reportsQuery,
        (snap) => {
          const list = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<UserReport, 'id'>) }))
            .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
          setUserReports(list);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'user_reports')
      )
    );

    // 9. Public Members
    unsubs.push(
      onSnapshot(
        query(collection(db, 'users_public'), where('classId', '==', CLASS_ID)),
        (snap) => {
          const list = snap.docs
            .map((d) => normalizeUserPublic(d.data() as Partial<UserPublic> & { uid: string }))
            .sort((a, b) => a.absenNumber - b.absenNumber);
          setMembers(list);
          const selfUpdated = list.find((m) => m.uid === uid);
          if (selfUpdated) {
            setProfile((prev) =>
              prev &&
              prev.role === selfUpdated.role &&
              prev.status === selfUpdated.status &&
              prev.displayName === selfUpdated.displayName &&
              prev.nickname === selfUpdated.nickname &&
              prev.photoURL === selfUpdated.photoURL &&
              prev.bio === selfUpdated.bio &&
              prev.hideOnlineStatus === selfUpdated.hideOnlineStatus
                ? prev
                : selfUpdated
            );
          }
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'users_public')
      )
    );

    // 10. Notifications (Class-wide + Personal) + Read State
    unsubs.push(
      onSnapshot(
        query(collection(db, 'notifications'), where('targetUid', '==', 'ALL')),
        (snap) => {
          const list = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<NotificationItem, 'id'>),
          }));
          setClassNotifications(list);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'notifications_all')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'notifications'), where('targetUid', '==', uid)),
        (snap) => {
          const list = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<NotificationItem, 'id'>),
          }));
          setPrivateNotifications(list);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'notifications_user')
      )
    );

    unsubs.push(
      onSnapshot(
        doc(db, 'users_private', uid, 'notification_state', 'main'),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as Partial<NotificationState>;
            setReadNotifIds(new Set(Array.isArray(data.readIds) ? data.readIds : []));
          }
        },
        (error) =>
          handleFirestoreError(error, OperationType.GET, `users_private/${uid}/notification_state/main`)
      )
    );

    // 11. Activity Logs
    const activityQuery =
      profile.role === 'owner'
        ? query(collection(db, 'activity_logs'), orderBy('createdAt', 'desc'), limit(150))
        : query(collection(db, 'activity_logs'), where('actorId', '==', uid));

    unsubs.push(
      onSnapshot(
        activityQuery,
        (snap) => {
          const list = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<ActivityLog, 'id'>) }))
            .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
          setActivityLogs(list);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'activity_logs')
      )
    );

    // 12. Owner-only Login History
    if (profile.role === 'owner') {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'login_history'), orderBy('loggedInAt', 'desc'), limit(120)),
          (snap) => {
            const list = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<LoginHistoryEntry, 'id'>),
            }));
            setLoginHistory(list);
          },
          (error) => handleFirestoreError(error, OperationType.LIST, 'login_history')
        )
      );
    } else {
      setLoginHistory([]);
    }

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [authReady, firebaseUser, profile?.uid, profile?.role, profile?.status]);

  const combinedNotifications = useMemo(() => {
    const map = new Map<string, NotificationItem>();
    [...classNotifications, ...privateNotifications].forEach((n) => map.set(n.id, n));
    return Array.from(map.values()).sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
  }, [classNotifications, privateNotifications]);

  const chatRooms = useMemo(() => {
    const map = new Map<string, ChatRoom>();
    [...publicRooms, ...dmRooms].forEach((r) => map.set(r.roomId || r.id, { ...r, roomId: r.roomId || r.id }));
    return Array.from(map.values());
  }, [publicRooms, dmRooms]);

  const presenceMap = useMemo(() => {
    const map = new Map<string, UserPresence>();
    presenceList.forEach((p) => map.set(p.uid, p));
    return map;
  }, [presenceList]);

  const blockedUids = useMemo(
    () => new Set(blockedUsers.map((b) => b.targetUid)),
    [blockedUsers]
  );

  // Real-time Toast + Browser Notification trigger
  useEffect(() => {
    if (!firebaseUser || combinedNotifications.length === 0) return;

    if (!notifsInitializedRef.current) {
      knownNotifIdsRef.current = new Set(combinedNotifications.map((n) => n.id));
      notifsInitializedRef.current = true;
      return;
    }

    const newlyArrived = combinedNotifications.filter((n) => !knownNotifIdsRef.current.has(n.id));
    if (newlyArrived.length > 0) {
      const newest = newlyArrived[0];
      if (newest.actorId !== firebaseUser.uid) {
        setLiveToast(newest);
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            new Notification(`${newest.title} · ${CLASS_TITLE}`, {
              body: newest.body,
            });
          } catch {
            // Ignore restricted webview notification error
          }
        }
      }
      knownNotifIdsRef.current = new Set(combinedNotifications.map((n) => n.id));
    }
  }, [combinedNotifications, firebaseUser]);

  // Keep active tab valid if role changes
  useEffect(() => {
    if (profile && !canAccessNavTab(profile.role, activeTab)) {
      setActiveTab('beranda');
    }
  }, [profile, activeTab]);

  const handleCompleteOnboarding = async (
    displayName: string,
    nickname: string,
    absenNumber: number
  ) => {
    if (!firebaseUser) return;
    setIsProfileBusy(true);
    try {
      const created = await createOrUpdateUserProfile(
        firebaseUser,
        displayName,
        nickname,
        absenNumber,
        true
      );
      sessionStorage.setItem(`logged_login_${firebaseUser.uid}`, '1');
      setProfile(created);
      setPendingOnboardingUser(null);
    } finally {
      setIsProfileBusy(false);
    }
  };

  const handleLogout = async () => {
    if (firebaseUser) {
      await updateUserPresence(firebaseUser.uid, false, Boolean(profile?.hideOnlineStatus));
      sessionStorage.removeItem(`logged_login_${firebaseUser.uid}`);
    }
    await signOut(auth);
  };

  const handleMarkOneNotifRead = async (id: string) => {
    if (!firebaseUser) return;
    const next = new Set(readNotifIds);
    next.add(id);
    setReadNotifIds(next);
    await saveReadNotifications(firebaseUser.uid, Array.from(next));
  };

  const handleMarkAllNotifsRead = async () => {
    if (!firebaseUser) return;
    const allIds = combinedNotifications.map((n) => n.id);
    setReadNotifIds(new Set(allIds));
    await saveReadNotifications(firebaseUser.uid, allIds);
  };

  const handleEnableBrowserPush = async () => {
    if (typeof Notification === 'undefined') return;
    const res = await Notification.requestPermission();
    setBrowserPushEnabled(res === 'granted');
  };

  // Auto-populate Firestore schedules on Owner login if completely empty
  useEffect(() => {
    if (
      profile?.role === 'owner' &&
      schedulesLoaded &&
      schedules.length === 0 &&
      !autoSeededScheduleRef.current
    ) {
      autoSeededScheduleRef.current = true;
      initializeOfficial6DaySchedule(profile, []).catch((err) => {
        console.error('Auto-init schedule warning:', err);
      });
    }
  }, [profile, schedulesLoaded, schedules.length]);

  const effectiveSchedules = useMemo(() => getEffectiveSchedules(schedules), [schedules]);
  const needsOfficialScheduleSync =
    schedulesLoaded && !matchesOfficial6DaySchedule(schedules);

  const c6aContext = useMemo<C6AClassContextData>(
    () => ({
      settings,
      schedules: effectiveSchedules.items,
      assignments,
      taskProgressMap,
      announcements,
      agendas,
      treasury,
      members,
      adminMessages,
    }),
    [
      settings,
      effectiveSchedules.items,
      assignments,
      taskProgressMap,
      announcements,
      agendas,
      treasury,
      members,
      adminMessages,
    ]
  );

  const handleInitSchedule = async () => {
    if (!profile) return;
    setIsInitializingSchedule(true);
    try {
      await initializeOfficial6DaySchedule(
        profile,
        schedules.map((s) => s.id)
      );
    } finally {
      setIsInitializingSchedule(false);
    }
  };

  const handleToggleCompactMode = () => {
    setCompactMode((prev) => {
      const next = !prev;
      localStorage.setItem('kelas6a_compact', next ? '1' : '0');
      return next;
    });
  };

  const handleOpenChatRoom = (roomId: string) => {
    setSelectedChatRoomId(roomId);
    setActiveTab('chat');
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F4F9F5] dark:bg-[#08150E] text-[#0B2416] dark:text-emerald-50 flex flex-col items-center justify-center gap-4 p-6">
        <CrestLogo size="lg" />
        <div className="text-center space-y-1">
          <p className="text-base font-bold text-[#0B2416] dark:text-emerald-50">
            {CLASS_TITLE} · {SCHOOL_NAME}
          </p>
          <p className="text-xs text-[#52705E] dark:text-emerald-300/80">
            Memulihkan sesi kelas Anda...
          </p>
        </div>
      </div>
    );
  }

  if (!firebaseUser || !profile) {
    return (
      <LoginScreen
        pendingOnboardingUser={pendingOnboardingUser}
        onCompleteOnboarding={handleCompleteOnboarding}
        onGoogleLoginSuccess={(pref) => {
          preferredStudentRef.current = pref;
        }}
        authError={authError}
        isBusy={isProfileBusy}
      />
    );
  }

  if (profile.status === 'nonaktif') {
    return (
      <div className="min-h-screen bg-[#F4F9F5] dark:bg-[#08150E] text-[#0B2416] dark:text-emerald-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-[#0F2419] border border-rose-200 dark:border-rose-800 rounded-2xl p-6 text-center space-y-4 shadow-sm">
          <Ban className="w-10 h-10 text-rose-600 mx-auto" />
          <h1 className="text-lg font-bold text-[#0B2416] dark:text-emerald-50">
            Akun Sedang Dinonaktifkan
          </h1>
          <p className="text-xs text-[#2F4F3C] dark:text-emerald-200 leading-relaxed">
            Akun Anda ({profile.displayName}) saat ini berstatus nonaktif oleh Owner Kelas 6A. Silakan hubungi Wali Kelas untuk mengaktifkan kembali akses portal.
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar Akun</span>
          </button>
        </div>
      </div>
    );
  }

  const unreadNotificationsCount = combinedNotifications.filter((n) => !readNotifIds.has(n.id)).length;
  const unreadChatCount = chatRooms.filter(
    (r) => Boolean(r.lastMessageSenderId) && r.lastMessageSenderId !== profile.uid
  ).length;
  const activeNavItem = NAV_ITEMS.find((item) => item.id === activeTab);
  const currentNavLabel = activeNavItem ? getNavItemLabel(activeNavItem, profile.role) : 'Beranda';
  const myActivities = activityLogs.filter((l) => l.actorId === profile.uid);

  return (
    <div className="min-h-screen bg-[#F4F9F5] dark:bg-[#08150E] text-[#0B2416] dark:text-emerald-50 flex">
      <DesktopSidebar
        profile={profile}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onLogout={handleLogout}
        unreadNotificationsCount={unreadNotificationsCount}
        unreadChatCount={unreadChatCount}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-[56px] lg:h-16 bg-white/95 dark:bg-[#0B1B12]/95 backdrop-blur-md border-b border-[#D3E6D8] dark:border-emerald-900/60 px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="lg:hidden">
              <CrestLogo size="sm" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-[#0B2416] dark:text-emerald-50 truncate">
                {currentNavLabel}
              </h1>
              <p className="hidden sm:block text-[11px] text-[#52705E] dark:text-emerald-300/80 truncate">
                {CLASS_TITLE} · {SCHOOL_NAME}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
              aria-label={theme === 'dark' ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
              title={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
              className="min-h-[42px] min-w-[42px] px-2.5 rounded-xl bg-[#F0F7F2] dark:bg-[#132C1E] hover:bg-[#E2EFE6] dark:hover:bg-[#1A3927] border border-[#C6E0CE] dark:border-emerald-800 flex items-center justify-center text-[#0B6B3A] dark:text-emerald-300 cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Buka pencarian global"
              className="min-h-[42px] px-3 rounded-xl bg-[#F0F7F2] dark:bg-[#132C1E] hover:bg-[#E2EFE6] dark:hover:bg-[#1A3927] border border-[#C6E0CE] dark:border-emerald-800 flex items-center gap-2 text-xs font-semibold text-[#0B2416] dark:text-emerald-100 cursor-pointer"
            >
              <Search className="w-4 h-4 text-[#0B6B3A] dark:text-emerald-400" />
              <span className="hidden sm:inline">Cari</span>
            </button>

            <NotificationCenter
              notifications={combinedNotifications}
              readIds={readNotifIds}
              liveToast={liveToast}
              onDismissToast={() => setLiveToast(null)}
              onMarkOneRead={handleMarkOneNotifRead}
              onMarkAllRead={handleMarkAllNotifsRead}
              onNavigateTab={setActiveTab}
              onEnableBrowserPush={handleEnableBrowserPush}
              browserPushEnabled={browserPushEnabled}
            />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-10 max-w-6xl w-full mx-auto">
          {activeTab === 'beranda' && (
            <DashboardView
              profile={profile}
              settings={settings}
              announcements={announcements}
              assignments={assignments}
              taskProgressMap={taskProgressMap}
              schedules={effectiveSchedules.items}
              picketSchedules={picketSchedules}
              agendas={agendas}
              treasury={treasury}
              adminMessages={adminMessages}
              notifications={combinedNotifications}
              unreadNotificationsCount={unreadNotificationsCount}
              activityLogs={activityLogs}
              onNavigate={setActiveTab}
              onOpenSearch={() => setSearchOpen(true)}
              needsOfficialScheduleSync={needsOfficialScheduleSync}
              onInitSchedule={handleInitSchedule}
              isInitializingSchedule={isInitializingSchedule}
            />
          )}

          {activeTab === 'chat' && (
            <ChatView
              profile={profile}
              messages={chatMessages}
              botContext={c6aContext}
              onOpenC6AAssistant={() => setActiveTab('c6a-ai')}
              settings={settings}
              members={members}
              chatRooms={chatRooms}
              presenceMap={presenceMap}
              blockedUids={blockedUids}
              initialRoomId={selectedChatRoomId}
              onClearInitialRoomId={() => setSelectedChatRoomId(null)}
            />
          )}

          {activeTab === 'grup-kelas' && (
            <WhatsAppGroupView
              profile={profile}
              settings={settings}
              chatRooms={chatRooms}
              onOpenRoom={handleOpenChatRoom}
            />
          )}

          {activeTab === 'game-center' && (
            <GameCenterView
              profile={profile}
              settings={settings}
              members={members}
              chatRooms={chatRooms}
              presenceMap={presenceMap}
              blockedUids={blockedUids}
              botContext={c6aContext}
              onOpenChatRoom={handleOpenChatRoom}
              onOpenC6AAssistant={() => setActiveTab('c6a-ai')}
            />
          )}

          {activeTab === 'jadwal' && (
            <ScheduleView
              profile={profile}
              settings={settings}
              schedules={effectiveSchedules.items}
              rawSchedules={schedules}
              isUsingFallback={effectiveSchedules.isUsingFallback}
              needsOfficialSync={needsOfficialScheduleSync}
              onSyncOfficialSchedule={handleInitSchedule}
              isSyncingOfficial={isInitializingSchedule}
            />
          )}

          {activeTab === 'tugas' && (
            <AssignmentsView
              profile={profile}
              settings={settings}
              assignments={assignments}
              taskProgressMap={taskProgressMap}
              compactMode={compactMode}
            />
          )}

          {activeTab === 'pengumuman' && (
            <AnnouncementsView
              profile={profile}
              announcements={announcements}
              compactMode={compactMode}
            />
          )}

          {activeTab === 'agenda' && (
            <AgendaView
              profile={profile}
              settings={settings}
              agendas={agendas}
              compactMode={compactMode}
            />
          )}

          {activeTab === 'kas' && (
            <TreasuryView
              profile={profile}
              settings={settings}
              treasury={treasury}
              compactMode={compactMode}
            />
          )}

          {activeTab === 'piket' && (
            <PicketScheduleView
              profile={profile}
              picketSchedules={picketSchedules}
            />
          )}

          {activeTab === 'pesan-admin' && (
            <AdminMessagesView profile={profile} settings={settings} messages={adminMessages} />
          )}

          {activeTab === 'c6a-ai' && (
            <C6AAssistantView profile={profile} classContext={c6aContext} />
          )}

          {activeTab === 'profil' && (
            <ProfileView
              firebaseUser={firebaseUser}
              profile={profile}
              myActivities={myActivities}
              compactMode={compactMode}
              onToggleCompactMode={handleToggleCompactMode}
              onProfileUpdated={(updated) => setProfile(updated)}
              onLogout={handleLogout}
            />
          )}

          {activeTab === 'pengaturan' && (
            <SettingsView
              profile={profile}
              theme={theme}
              onChangeTheme={setTheme}
              compactMode={compactMode}
              onToggleCompactMode={handleToggleCompactMode}
              browserPushEnabled={browserPushEnabled}
              onEnableBrowserPush={handleEnableBrowserPush}
              blockedUsers={blockedUsers}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'bantuan' && (
            <HelpCenterView settings={settings} role={profile.role} onNavigate={setActiveTab} />
          )}

          {activeTab === 'owner-panel' && (
            <OwnerPanelView
              profile={profile}
              settings={settings}
              members={members}
              loginHistory={loginHistory}
              activityLogs={activityLogs}
              schedules={schedules}
              assignments={assignments}
              announcements={announcements}
              agendas={agendas}
              treasury={treasury}
              adminMessages={adminMessages}
              notifications={combinedNotifications}
              clientErrors={clientErrors}
              userReports={userReports}
              chatRooms={chatRooms}
              onClearClientErrors={() => setClientErrors([])}
              onNavigateTab={setActiveTab}
              onOpenChatRoom={handleOpenChatRoom}
              onSyncOfficialSchedule={handleInitSchedule}
            />
          )}
        </main>
      </div>

      <GlobalSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        profile={profile}
        assignments={assignments}
        announcements={announcements}
        agendas={agendas}
        schedules={effectiveSchedules.items}
        picketSchedules={picketSchedules}
        adminMessages={adminMessages}
        chatMessages={chatMessages}
        onNavigate={setActiveTab}
      />

      <MobileBottomNav
        profile={profile}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onLogout={handleLogout}
        unreadNotificationsCount={unreadNotificationsCount}
        unreadChatCount={unreadChatCount}
      />
    </div>
  );
}
