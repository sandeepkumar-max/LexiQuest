import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Share } from '@capacitor/share';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { AdMob } from '@capacitor-community/admob';
import { App as CapApp } from '@capacitor/app';
import { Dialog } from '@capacitor/dialog';
import { Book, BookOpen, Search, Settings, Plus, Trash2, CheckCircle, AlertCircle, FileText, GraduationCap, PenTool, Lock, Unlock, Volume2, X, Sliders, Bell, Flame, Save, Download, Upload, Share2, Clock, ChevronLeft, Star, LogIn, UserPlus, Target } from 'lucide-react';
import { COMMON_WORDS } from './lib/dictionary';
import { LEARN_WORDS } from './lib/learnWords';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { FirebaseFirestore } from '@capacitor-firebase/firestore';
import Auth from './components/Auth';
import { motion, AnimatePresence } from 'motion/react';

type Tab = 'learn' | 'test' | 'dictionary' | 'admin' | 'profile';

interface DictPhonetic { text?: string; audio?: string; }
interface DictDefinition { definition: string; example?: string; synonyms: string[]; antonyms: string[]; }
interface DictMeaning { partOfSpeech: string; definitions: DictDefinition[]; synonyms: string[]; antonyms: string[]; }
interface DictEntry { word: string; phonetic?: string; phonetics: DictPhonetic[]; meanings: DictMeaning[]; }

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('learn');
  const [customWords, setCustomWords] = useState<{ word: string, meaning: string, example: string }[]>([]);
  const [sharedWords, setSharedWords] = useState<{ word: string, meaning: string, example: string }[]>([]);
  const [bulkWords, setBulkWords] = useState(Array.from({ length: 2 }, () => ({ word: '', meaning: '', example: '' })));

  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [adminPin, setAdminPin] = useState(() => localStorage.getItem('adminPin') || '1234');
  const [newAdminPin, setNewAdminPin] = useState('');
  const [pinChangeMessage, setPinChangeMessage] = useState('');

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [displayName, setDisplayName] = useState(() => user?.displayName || localStorage.getItem('userName') || 'Adventurer');
  const [profileImage, setProfileImage] = useState(() => localStorage.getItem('profileImage') || '');
  const [adminEmails, setAdminEmails] = useState<string[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');

  // AdMob State
  const [adInitialized, setAdInitialized] = useState(false);
  const [isPremium, setIsPremium] = useState(() => localStorage.getItem('isPremium') === 'true');
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);

  const ADMOB_INTERSTITIAL_ID = 'ca-app-pub-3271133689051975/5794528015';

  // Test State
  const [testState, setTestState] = useState<'start' | 'testing' | 'results'>('start');
  const [testMode, setTestMode] = useState<'listen-mcq' | 'listen-type' | 'visual-mcq' | 'meaning-mcq'>('listen-mcq');
  const [currentTestWordIndex, setCurrentTestWordIndex] = useState(0);
  const [testWords, setTestWords] = useState<string[]>([]);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [mcqOptions, setMcqOptions] = useState<string[][]>([]);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [feedbackState, setFeedbackState] = useState<'none' | 'correct' | 'incorrect'>('none');

  // Streak State
  const [streak, setStreak] = useState(() => parseInt(localStorage.getItem('streak') || '0'));
  const [lastPracticeDate, setLastPracticeDate] = useState(() => localStorage.getItem('lastPracticeDate') || '');

  // Test Stats
  const [totalTestsTaken, setTotalTestsTaken] = useState(() => parseInt(localStorage.getItem('totalTestsTaken') || '0'));
  const [averageScore, setAverageScore] = useState(() => parseFloat(localStorage.getItem('averageScore') || '0'));

  // Gamification State
  const [xp, setXp] = useState(() => parseInt(localStorage.getItem('xp') || '0'));
  const [level, setLevel] = useState(() => parseInt(localStorage.getItem('level') || '1'));
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [dailyWords, setDailyWords] = useState<{ word: string, meaning: string, example: string }[]>(() => {
    const saved = localStorage.getItem('dailyWords');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentDailyIndex, setCurrentDailyIndex] = useState(0);
  const [dailyWordsLearned, setDailyWordsLearned] = useState(() => parseInt(localStorage.getItem('dailyWordsLearned') || '0'));
  const [lastDailyWordDate, setLastDailyWordDate] = useState(() => localStorage.getItem('lastDailyWordDate') || '');

  // Daily Missions
  const [missions, setMissions] = useState(() => {
    const saved = localStorage.getItem('dailyMissions');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'correct-10', title: 'Word Wizard', desc: 'Get 10 correct answers', goal: 10, current: 0, reward: 50, completed: false },
      { id: 'test-2', title: 'Test Taker', desc: 'Complete 2 full tests', goal: 2, current: 0, reward: 100, completed: false },
      { id: 'dict-3', title: 'Researcher', desc: 'Search 3 words in Dict', goal: 3, current: 0, reward: 30, completed: false }
    ];
  });

  // Achievements
  const [badges, setBadges] = useState(() => {
    const saved = localStorage.getItem('badges');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'streak-7', title: '7-Day Streak', icon: '🔥', earned: false },
      { id: 'words-50', title: '50 Words Mastered', icon: '📚', earned: false },
      { id: 'level-5', title: 'Level 5 Reached', icon: '⭐', earned: false }
    ];
  });

  // Streak Shield
  const [streakShields, setStreakShields] = useState(() => parseInt(localStorage.getItem('streakShields') || '0'));

  // Speech State
  const [speechRate, setSpeechRate] = useState(1);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speechSettingsOpen, setSpeechSettingsOpen] = useState(false);

  // Custom Alert/Confirm Modals
  const [alertMessage, setAlertMessage] = useState('');
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [wordsToConfirm, setWordsToConfirm] = useState<{ word: string, meaning: string, example: string }[]>([]);
  const [clearConfirmModalOpen, setClearConfirmModalOpen] = useState(false);

  // Learn State
  const [learnPage, setLearnPage] = useState(0);
  const wordsPerPage = 30;
  const [learnSearchQuery, setLearnSearchQuery] = useState('');
  const allLearnWords = useMemo(() => {
    const combined = [...LEARN_WORDS, ...customWords, ...sharedWords];
    if (!learnSearchQuery.trim()) return combined;
    return combined.filter(w => 
      w.word.toLowerCase().includes(learnSearchQuery.toLowerCase()) || 
      w.meaning.toLowerCase().includes(learnSearchQuery.toLowerCase())
    );
  }, [customWords, sharedWords, learnSearchQuery]);
  const totalLearnPages = Math.ceil(allLearnWords.length / wordsPerPage);
  const currentLearnWords = allLearnWords.slice(learnPage * wordsPerPage, (learnPage + 1) * wordsPerPage);
  const [expandedWord, setExpandedWord] = useState<string | null>(null);

  // Dictionary State
  const [dictQuery, setDictQuery] = useState('');
  const [dictResult, setDictResult] = useState<DictEntry | null>(null);
  const [dictLoading, setDictLoading] = useState(false);
  const [dictError, setDictError] = useState('');
  const [dictAudio, setDictAudio] = useState<HTMLAudioElement | null>(null);

  // Reminder State
  const [reminderTime, setReminderTime] = useState(() => localStorage.getItem('reminderTime') || '10:00');
  const [reminderEnabled, setReminderEnabled] = useState(() => localStorage.getItem('reminderEnabled') === 'true');
  const [reminderEverSet, setReminderEverSet] = useState(() => localStorage.getItem('reminderEverSet') === 'true');
  const [reminderPopoverOpen, setReminderPopoverOpen] = useState(false);
  const [draftReminderTime, setDraftReminderTime] = useState(() => localStorage.getItem('reminderTime') || '10:00');
  const reminderPopoverRef = useRef<HTMLDivElement>(null);
  const reminderBtnRef = useRef<HTMLButtonElement>(null);

  // Initialize AdMob and setup periodic interstitial
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || isPremium || isAdminAuthenticated) {
      return;
    }

    let adInterval: any;

    const setupAds = async () => {
      try {
        await AdMob.initialize();
        setAdInitialized(true);

        // Prepare first ad
        await AdMob.prepareInterstitial({ adId: ADMOB_INTERSTITIAL_ID, isTesting: false }).catch(() => { });

        // Setup 120 second interval (2 minutes)
        adInterval = setInterval(async () => {
          try {
            await AdMob.showInterstitial();
            // Prepare next ad immediately after show
            await AdMob.prepareInterstitial({ adId: ADMOB_INTERSTITIAL_ID, isTesting: false }).catch(() => { });
          } catch (e) {
            console.error('Interstitial show/prepare error:', e);
            // Re-prepare on error to try again next time
            await AdMob.prepareInterstitial({ adId: ADMOB_INTERSTITIAL_ID, isTesting: false }).catch(() => { });
          }
        }, 120000); // 120 seconds
      } catch (err) {
        console.error('AdMob setup error:', err);
      }
    };

    setupAds();

    return () => {
      if (adInterval) clearInterval(adInterval);
    };
  }, [isPremium, isAdminAuthenticated]);

  // AdMob and setup periodic interstitial


  // Firebase Authentication State Listener
  useEffect(() => {
    const checkUser = async () => {
      try {
        const result = await FirebaseAuthentication.getCurrentUser();
        if (result.user) {
          setUser(result.user);
          
          // 1. Fetch authorized admin emails
          const adminDoc = await FirebaseFirestore.getDocument({ reference: 'config/admins' });
          let authorizedEmails: string[] = [];
          if (adminDoc.snapshot && (adminDoc.snapshot.data as any)?.emails) {
            authorizedEmails = (adminDoc.snapshot.data as any).emails;
            setAdminEmails(authorizedEmails);
          }

          // 2. Fetch role from Firestore
          const doc = await FirebaseFirestore.getDocument({ reference: 'users/' + result.user.uid });
          const role = (doc.snapshot?.data as any)?.role;
          const isEmailAdmin = authorizedEmails.includes(result.user.email?.toLowerCase() || '') || result.user.email === 'sandeepfalse456@gmail.com';

          if (role === 'admin' || isEmailAdmin) {
            setIsAdminAuthenticated(true);
            setIsPremium(true);
            
            // Sync role to Firestore if not already set but is in email list
            if (role !== 'admin' && isEmailAdmin) {
              await FirebaseFirestore.setDocument({
                reference: 'users/' + result.user.uid,
                data: { role: 'admin' },
                merge: true
              });
            }
          }
        }
      } catch (err) {
        console.error('Failed to get current user/role', err);
      } finally {
        setAuthLoading(false);
      }
    };

    checkUser();

    const listener = FirebaseAuthentication.addListener('authStateChange', async (result) => {
      setUser(result.user);
      if (result.user) {
        const adminDoc = await FirebaseFirestore.getDocument({ reference: 'config/admins' });
        const authorizedEmails = (adminDoc.snapshot?.data as any)?.emails || [];
        
        const doc = await FirebaseFirestore.getDocument({ reference: 'users/' + result.user.uid });
        const role = (doc.snapshot?.data as any)?.role;
        const isEmailAdmin = authorizedEmails.includes(result.user.email?.toLowerCase() || '') || result.user.email === 'sandeepfalse456@gmail.com';

        if (role === 'admin' || isEmailAdmin) {
          setIsAdminAuthenticated(true);
          setIsPremium(true);
        }
      } else {
        setIsAdminAuthenticated(false);
      }
    });

    return () => {
      listener.then(l => l.remove());
    };
  }, []);

  // Fetch Shared Words from Firestore
  useEffect(() => {
    const fetchSharedWords = async () => {
      try {
        const { snapshots } = await FirebaseFirestore.getCollection({ reference: 'shared_words' });
        if (snapshots) {
          const words = snapshots.map(s => s.data as { word: string, meaning: string, example: string });
          setSharedWords(words);
        }
      } catch (err) {
        console.error('Failed to fetch shared words:', err);
      }
    };
    fetchSharedWords();
  }, [user]); // Re-fetch on login

  const handleSignOut = async () => {
    const { value } = await Dialog.confirm({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out?',
      okButtonTitle: 'Sign Out',
      cancelButtonTitle: 'Cancel',
    });

    if (value) {
      try {
        await FirebaseAuthentication.signOut();
      } catch (err) {
        console.error('Sign out error', err);
      }
    }
  };

  const handleDeleteAccount = async () => {
    const { value } = await Dialog.confirm({
      title: 'Delete Account',
      message: 'Are you sure? This will permanently delete your account and all your progress. This action cannot be undone.',
      okButtonTitle: 'Delete Forever',
      cancelButtonTitle: 'Cancel',
    });

    if (value) {
      try {
        setAuthLoading(true);
        // Delete user's document from Firestore if it exists
        if (user?.uid) {
          await FirebaseFirestore.deleteDocument({ reference: 'users/' + user.uid }).catch(() => {});
        }
        
        // Delete the user from Firebase Auth
        await FirebaseAuthentication.deleteUser();
        
        // Clear local storage
        localStorage.clear();
        setUser(null);
        setAlertMessage("Your account has been deleted. We're sorry to see you go! ✨");
      } catch (err: any) {
        console.error('Delete account error', err);
        if (err.message?.includes('recent-login')) {
          setAlertMessage('For security, please sign out and sign in again before deleting your account.');
        } else {
          setAlertMessage('Could not delete account. Please try again or contact support at sandeepkumarspj290@gmail.com.');
        }
      } finally {
        setAuthLoading(false);
      }
    }
  };

  // Exit Confirmation & Back Button Logic
  useEffect(() => {
    const setupBackButton = async () => {
      const listener = await CapApp.addListener('backButton', async () => {
        if (subscriptionModalOpen) {
          setSubscriptionModalOpen(false);
        } else if (pinModalOpen) {
          setPinModalOpen(false);
        } else if (testState === 'testing') {
          const { value } = await Dialog.confirm({
            title: 'Exit Test',
            message: 'Are you sure you want to stop this test?',
            okButtonTitle: 'Exit',
            cancelButtonTitle: 'Stay'
          });
          if (value) setTestState('start');
        } else if (activeTab !== 'learn') {
          setActiveTab('learn');
        } else {
          const { value } = await Dialog.confirm({
            title: 'Exit LexiQuest',
            message: 'Are you sure you want to exit?',
            okButtonTitle: 'Exit',
            cancelButtonTitle: 'Cancel'
          });
          if (value) {
            CapApp.exitApp();
          }
        }
      });
      return listener;
    };

    const listenerPromise = setupBackButton();

    return () => {
      listenerPromise.then(l => l.remove());
    };
  }, [subscriptionModalOpen, pinModalOpen, testState, activeTab]);


  useEffect(() => {
    if (lastPracticeDate) {
      const today = new Date().toDateString();
      if (today !== lastPracticeDate) {
        const lastDate = new Date(lastPracticeDate);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toDateString();

        // If last practice was NOT today and NOT yesterday, streak is broken
        if (lastPracticeDate !== yesterdayStr) {
          setStreak(0);
          localStorage.setItem('streak', '0');
        }
      }
    }
  }, [lastPracticeDate]);

  const addXp = (amount: number) => {
    setXp(prev => {
      const newXp = prev + amount;
      localStorage.setItem('xp', newXp.toString());
      
      // Level logic: level 1 is 0-100, level 2 is 100-300, level 3 is 300-600 (quadratic)
      const nextLevelThreshold = level * 100 * level;
      if (newXp >= nextLevelThreshold) {
        setLevel(l => {
          const newLevel = l + 1;
          localStorage.setItem('level', newLevel.toString());
          setShowLevelUp(true);
          return newLevel;
        });
      }
      return newXp;
    });
  };

  const updateMission = (id: string, amount: number = 1) => {
    setMissions(prev => {
      const newMissions = prev.map(m => {
        if (m.id === id && !m.completed) {
          const newCurrent = m.current + amount;
          const completed = newCurrent >= m.goal;
          if (completed) {
            addXp(m.reward);
            setAlertMessage(`Mission Complete: ${m.title}! +${m.reward} XP`);
          }
          return { ...m, current: newCurrent, completed };
        }
        return m;
      });
      localStorage.setItem('dailyMissions', JSON.stringify(newMissions));
      return newMissions;
    });
  };

  const checkBadges = () => {
    setBadges(prev => {
      let changed = false;
      const newBadges = prev.map(b => {
        if (b.earned) return b;
        let earned = false;
        if (b.id === 'streak-7' && streak >= 7) earned = true;
        if (b.id === 'words-50' && totalTestsTaken >= 5) earned = true; // Simulating word master
        if (b.id === 'level-5' && level >= 5) earned = true;

        if (earned) {
          changed = true;
          setAlertMessage(`Achievement Unlocked: ${b.title}! ${b.icon}`);
        }
        return { ...b, earned };
      });
      if (changed) localStorage.setItem('badges', JSON.stringify(newBadges));
      return changed ? newBadges : prev;
    });
  };

  useEffect(() => {
    checkBadges();
  }, [streak, level, totalTestsTaken]);

  useEffect(() => {
    const today = new Date().toDateString();
    if (lastDailyWordDate !== today) {
      // Pick 5 random unique words
      const shuffled = [...LEARN_WORDS].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 5);
      setDailyWords(selected);
      setLastDailyWordDate(today);
      setDailyWordsLearned(0);
      setCurrentDailyIndex(0);
      localStorage.setItem('dailyWords', JSON.stringify(selected));
      localStorage.setItem('lastDailyWordDate', today);
      localStorage.setItem('dailyWordsLearned', '0');
    } else {
      if (dailyWords.length === 0) {
        const shuffled = [...LEARN_WORDS].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 5);
        setDailyWords(selected);
        localStorage.setItem('dailyWords', JSON.stringify(selected));
      }
    }
  }, [lastDailyWordDate]);

  const recordPractice = () => {
    const today = new Date().toDateString();
    if (lastPracticeDate !== today) {
      let newStreak = 1; // Default to 1 for the first time or if streak is broken

      if (lastPracticeDate) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toDateString();

        if (lastPracticeDate === yesterdayStr) {
          // If last practice was exactly yesterday, increment the streak
          newStreak = streak + 1;
        }
      }

      setStreak(newStreak);
      setLastPracticeDate(today);
      localStorage.setItem('streak', newStreak.toString());
      localStorage.setItem('lastPracticeDate', today);
    }
  };


  // Load custom words from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('customDictionary');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Handle migration from old Set<string> format
          const migrated = parsed.map(item => {
            if (typeof item === 'string') {
              return { word: item.toLowerCase(), meaning: 'Meaning not provided', example: 'Example not provided' };
            }
            return item;
          });
          setCustomWords(migrated);
        }
      } catch (e) {
        console.error('Failed to parse custom dictionary', e);
      }
    }
  }, []);

  // Save custom words to local storage whenever it changes
  useEffect(() => {
    localStorage.setItem('customDictionary', JSON.stringify(customWords));
  }, [customWords]);

  useEffect(() => {
    localStorage.setItem('adminPin', adminPin);
  }, [adminPin]);

  useEffect(() => {
    localStorage.setItem('reminderTime', reminderTime);
    localStorage.setItem('reminderEnabled', String(reminderEnabled));
  }, [reminderTime, reminderEnabled]);

  useEffect(() => {
    const scheduleReminder = async () => {
      if (!Capacitor.isNativePlatform()) return;

      try {
        // Cancel existing notification with id 1 before rescheduling
        await LocalNotifications.cancel({ notifications: [{ id: 1 }] });

        if (reminderEnabled) {
          const [hours, minutes] = reminderTime.split(':').map(Number);
          
          await LocalNotifications.schedule({
            notifications: [
              {
                title: "LexiQuest Practice Time! 📚",
                body: "Ready for your daily 5 words? Let's grow your vocabulary! ✨",
                id: 1,
                schedule: {
                  on: {
                    hour: hours,
                    minute: minutes
                  },
                  repeats: true,
                  allowWhileIdle: true
                },
                extra: {
                  data: 'reminder'
                }
              }
            ]
          });
          console.log(`Daily reminder scheduled for ${hours}:${minutes}`);
        }
      } catch (err) {
        console.error('Failed to schedule reminder:', err);
      }
    };

    scheduleReminder();
  }, [reminderEnabled, reminderTime]);

  const requestAndEnableReminder = async (): Promise<boolean> => {
    if (Capacitor.isNativePlatform()) {
      const permission = await LocalNotifications.requestPermissions();
      if (permission.display === 'granted') {
        setReminderEnabled(true);
        localStorage.setItem('reminderEnabled', 'true');
        return true;
      } else {
        setAlertMessage('Notification permission denied. Cannot enable reminders.');
        return false;
      }
    } else {
      if (!('Notification' in window)) {
        setAlertMessage('This browser does not support desktop notifications.');
        return false;
      }
      if (Notification.permission === 'granted') {
        setReminderEnabled(true);
        localStorage.setItem('reminderEnabled', 'true');
        return true;
      } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          setReminderEnabled(true);
          localStorage.setItem('reminderEnabled', 'true');
          return true;
        } else {
          setAlertMessage('Notification permission denied. Cannot enable reminders.');
          return false;
        }
      } else {
        setAlertMessage('Notification permission is blocked. Please enable it in your browser/device settings.');
        return false;
      }
    }
  };

  const toggleReminder = async () => {
    if (!reminderEnabled) {
      await requestAndEnableReminder();
    } else {
      setReminderEnabled(false);
      localStorage.setItem('reminderEnabled', 'false');
    }
  };

  const handleSaveReminder = async () => {
    // Persist the draft time
    setReminderTime(draftReminderTime);
    localStorage.setItem('reminderTime', draftReminderTime);

    // First-time setup: auto-enable daily reminder
    if (!reminderEverSet) {
      const enabled = await requestAndEnableReminder();
      if (enabled) {
        setReminderEverSet(true);
        localStorage.setItem('reminderEverSet', 'true');
      }
    }
    setReminderPopoverOpen(false);
  };

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        reminderPopoverRef.current &&
        !reminderPopoverRef.current.contains(e.target as Node) &&
        reminderBtnRef.current &&
        !reminderBtnRef.current.contains(e.target as Node)
      ) {
        setReminderPopoverOpen(false);
      }
    };
    if (reminderPopoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [reminderPopoverOpen]);

  useEffect(() => {
    // Only load web voices when NOT on a native platform
    if (Capacitor.isNativePlatform()) return;
    const loadVoices = () => {
      if (!window.speechSynthesis) return;
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) return;
      setAvailableVoices(voices);
      setSelectedVoiceURI(prev => {
        if (prev) return prev;
        const defaultVoice =
          voices.find(v => v.lang.startsWith('en-') && v.name.toLowerCase().includes('female')) ||
          voices.find(v => v.lang.startsWith('en-')) ||
          voices[0];
        return defaultVoice ? defaultVoice.voiceURI : prev;
      });
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === adminPin || (user?.email === 'sandeepfalse456@gmail.com')) {
      setIsAdminAuthenticated(true);
      setPinModalOpen(false);
      setPinInput('');
      setPinError('');
      setActiveTab('admin');
    } else {
      setPinError('Incorrect PIN');
    }
  };

  const handleAddCustomWordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validWords = bulkWords.filter(w => w.word.trim() && w.meaning.trim() && w.example.trim());

    if (validWords.length === 0) {
      setAlertMessage("Please fill in all fields (Word, Meaning, Example) for at least one word.");
      return;
    }

    const newCustomWords: { word: string, meaning: string, example: string }[] = [];
    const requiringConfirmation: { word: string, meaning: string, example: string }[] = [];
    let duplicateCount = 0;

    for (const item of validWords) {
      const cleanWord = item.word.trim().toLowerCase();

      if (customWords.some(w => w.word === cleanWord) || newCustomWords.some(w => w.word === cleanWord)) {
        duplicateCount++;
        continue;
      }

      if (COMMON_WORDS.has(cleanWord)) {
        requiringConfirmation.push({ word: cleanWord, meaning: item.meaning.trim(), example: item.example.trim() });
      } else {
        newCustomWords.push({ word: cleanWord, meaning: item.meaning.trim(), example: item.example.trim() });
      }
    }

    if (newCustomWords.length > 0) {
      if (isAdminAuthenticated) {
        // Admins save to Firestore shared_words
        const savePromises = newCustomWords.map(w => 
          FirebaseFirestore.setDocument({
            reference: 'shared_words/' + w.word.replace(/\s+/g, '_'),
            data: w
          })
        );
        await Promise.all(savePromises);
        setSharedWords(prev => [...prev, ...newCustomWords]);
      } else {
        // Regular users (if they somehow access this) save to localStorage
        setCustomWords(prev => [...prev, ...newCustomWords]);
      }
    }

    if (requiringConfirmation.length > 0) {
      setWordsToConfirm(requiringConfirmation);
      setConfirmModalOpen(true);
    } else {
      setBulkWords(Array.from({ length: 2 }, () => ({ word: '', meaning: '', example: '' })));
      if (duplicateCount > 0) {
        setAlertMessage(`${duplicateCount} word(s) were skipped because they are already recognized.`);
      } else if (newCustomWords.length > 0) {
        setAlertMessage(`Successfully added ${newCustomWords.length} word(s) ${isAdminAuthenticated ? 'to Global Dictionary' : 'to your dictionary'}.`);
      }
    }
  };

  const confirmAddWord = () => {
    setCustomWords(prev => [...prev, ...wordsToConfirm]);
    setConfirmModalOpen(false);
    setWordsToConfirm([]);
    setBulkWords(Array.from({ length: 10 }, () => ({ word: '', meaning: '', example: '' })));
    setAlertMessage(`Successfully added words.`);
  };

  const addBulkWordRow = () => {
    if (bulkWords.length < 10) {
      setBulkWords(prev => [...prev, { word: '', meaning: '', example: '' }]);
    }
  };

  const removeBulkWordRow = (index: number) => {
    setBulkWords(prev => prev.filter((_, i) => i !== index));
  };

  const updateBulkWord = (index: number, field: 'word' | 'meaning' | 'example', value: string) => {
    setBulkWords(prev => {
      const newBulk = [...prev];
      newBulk[index] = { ...newBulk[index], [field]: value };
      return newBulk;
    });
  };

  const removeCustomWord = (word: string) => {
    setCustomWords(prev => prev.filter(w => w.word !== word));
  };

  const handleShareApp = async () => {
    const shareData = {
      title: 'LexiQuest - Vocabulary Builder',
      text: 'Improve your English vocabulary and spelling with LexiQuest! Try it out.',
      url: 'https://play.google.com/store/apps/details?id=com.lexiquest.app', // Placeholder URL
      dialogTitle: 'Share LexiQuest',
    };

    if (Capacitor.isNativePlatform()) {
      try {
        await Share.share({
          title: shareData.title,
          text: shareData.text,
          url: shareData.url,
          dialogTitle: shareData.dialogTitle,
        });
      } catch (error) {
        console.log('Native share failed:', error);
      }
    } else if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        console.log('Web share failed:', error);
      }
    } else {
      // Fallback: copy link to clipboard
      try {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
        setAlertMessage('Link copied to clipboard! Share it with your friends.');
      } catch {
        setAlertMessage('Sharing is not supported on this device.');
      }
    }
  };

  const handleExportDictionary = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(customWords));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "lexiquest_dictionary.json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportDictionary = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        if (Array.isArray(importedData)) {
          // Validate structure
          const validWords = importedData.filter(item =>
            item && typeof item.word === 'string' &&
            typeof item.meaning === 'string' &&
            typeof item.example === 'string'
          );

          if (validWords.length > 0) {
            setCustomWords(prev => {
              const newWords = [...prev];
              validWords.forEach(vw => {
                if (!newWords.some(w => w.word === vw.word)) {
                  newWords.push(vw);
                }
              });
              return newWords;
            });
            setAlertMessage(`Successfully imported ${validWords.length} words.`);
          } else {
            setAlertMessage("No valid words found in the file.");
          }
        } else {
          setAlertMessage("Invalid file format. Expected an array of words.");
        }
      } catch (error) {
        setAlertMessage("Error parsing the file. Please ensure it's a valid JSON.");
      }
    };
    reader.readAsText(file);
    // Reset file input
    e.target.value = '';
  };

  // Test Functions
  const generateFakeWords = (word: string) => {
    const fakes = new Set<string>();
    const vowels = ['a', 'e', 'i', 'o', 'u'];
    let attempts = 0;
    while (fakes.size < 3 && attempts < 50) {
      attempts++;
      let fake = word;
      const type = Math.floor(Math.random() * 4);
      const idx = Math.floor(Math.random() * word.length);
      if (type === 0 && word.length > 2) { // swap
        const idx2 = idx < word.length - 1 ? idx + 1 : idx - 1;
        if (idx >= 0 && idx2 >= 0 && idx < word.length && idx2 < word.length) {
          const arr = fake.split('');
          const temp = arr[idx];
          arr[idx] = arr[idx2];
          arr[idx2] = temp;
          fake = arr.join('');
        }
      } else if (type === 1) { // double
        fake = fake.slice(0, idx) + fake[idx] + fake.slice(idx);
      } else if (type === 2 && word.length > 3) { // remove
        fake = fake.slice(0, idx) + fake.slice(idx + 1);
      } else { // replace vowel
        const vIdx = word.split('').findIndex(c => vowels.includes(c));
        if (vIdx !== -1) {
          const newVowel = vowels[Math.floor(Math.random() * vowels.length)];
          fake = fake.slice(0, vIdx) + newVowel + fake.slice(vIdx + 1);
        } else {
          fake = fake + (Math.random() > 0.5 ? 's' : 'es');
        }
      }
      if (fake !== word && fake.length > 0) fakes.add(fake);
    }

    const fakeArr = Array.from(fakes);
    while (fakeArr.length < 3) {
      fakeArr.push(word + fakeArr.length);
    }
    return fakeArr.slice(0, 3);
  };

  const startTest = (mode: 'listen-mcq' | 'listen-type' | 'visual-mcq' | 'meaning-mcq') => {
    setTestMode(mode);
    const allWords = [...LEARN_WORDS, ...customWords];
    const shuffled = allWords.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 10).map(item => item.word);
    setTestWords(selected);

    const options = selected.map(word => {
      const fakes = generateFakeWords(word);
      return [...fakes, word].sort(() => 0.5 - Math.random());
    });
    setMcqOptions(options);

    setUserAnswers([]);
    setCurrentTestWordIndex(0);
    setTestState('testing');
    setTypedAnswer('');
    setFeedbackState('none');
    if (mode === 'listen-mcq' || mode === 'listen-type') {
      playWord(selected[0]);
    }
  };

  const playWord = async (word: string) => {
    if (!word) return;
    try {
      if (Capacitor.isNativePlatform()) {
        // Native Android / iOS — uses device TTS engine, works for ALL words
        await TextToSpeech.stop(); // stop any ongoing speech first
        await TextToSpeech.speak({
          text: word,
          lang: 'en-US',
          rate: speechRate,
          pitch: 1.0,
          volume: 1.0,
          category: 'ambient',
        });
      } else {
        // Web browser fallback
        if (!window.speechSynthesis) {
          console.warn('Speech synthesis not supported in this browser');
          return;
        }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US';
        utterance.rate = speechRate;
        if (selectedVoiceURI) {
          const voice = availableVoices.find(v => v.voiceURI === selectedVoiceURI);
          if (voice) utterance.voice = voice;
        }
        utterance.onerror = (event) => {
          console.error('Web speech synthesis error:', event);
        };
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      console.error('TTS error:', err);
    }
  };

  const handleAnswerSubmit = (answer: string) => {
    const newAnswers = [...userAnswers, answer.toLowerCase()];
    setUserAnswers(newAnswers);

    const isCorrect = answer.toLowerCase() === testWords[currentTestWordIndex].toLowerCase();

    if (isCorrect) {
      setFeedbackState('correct');
      addXp(10); // Reward for correct answer
      updateMission('correct-10', 1);
      setTimeout(() => {
        handleNextQuestion(currentTestWordIndex);
      }, 1000);
    } else {
      setFeedbackState('incorrect');
    }
  };

  useEffect(() => {
    if (testState === 'results' && userAnswers.length > 0 && testWords.length > 0) {
      const correctCount = userAnswers.filter((ans, i) => ans === testWords[i]?.toLowerCase()).length;
      const score = (correctCount / testWords.length) * 100;

      setTotalTestsTaken(prev => {
        const newTotal = prev + 1;
        localStorage.setItem('totalTestsTaken', newTotal.toString());

        setAverageScore(prevAvg => {
          const newAvg = ((prevAvg * prev) + score) / newTotal;
          localStorage.setItem('averageScore', newAvg.toString());
          return newAvg;
        });

        return newTotal;
      });

      addXp(50); // Reward for completing a test
      updateMission('test-2', 1);
    }
  }, [testState]);

  const handleNextQuestion = (index: number) => {
    setFeedbackState('none');
    setTypedAnswer('');

    if (index + 1 < testWords.length) {
      setCurrentTestWordIndex(index + 1);
      if (testMode !== 'visual-mcq' && testMode !== 'meaning-mcq') {
        playWord(testWords[index + 1]);
      }
    } else {
      recordPractice();
      setTestState('results');
    }
  };

  const searchDictionary = async (queryOverride?: string) => {
    const query = (queryOverride ?? dictQuery).trim().toLowerCase();
    if (!query) return;
    setDictLoading(true);
    setDictError('');
    setDictResult(null);
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(query)}`);
      if (!res.ok) {
        setDictError(`"${query}" not found. Please check your spelling and try again.`);
        return;
      }
      const data: DictEntry[] = await res.json();
      const entry = data[0];
      setDictResult(entry);
      updateMission('dict-3', 1);
      // find best audio
      const audioUrl = entry.phonetics.find(p => p.audio)?.audio || '';
      if (audioUrl) {
        const audio = new Audio(audioUrl.startsWith('//') ? 'https:' + audioUrl : audioUrl);
        setDictAudio(audio);
      } else {
        setDictAudio(null);
      }
    } catch {
      setDictError('Network error. Please check your internet connection.');
    } finally {
      setDictLoading(false);
    }
  };

  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newAdminPin.length < 4) {
      setPinChangeMessage('PIN must be at least 4 characters.');
      return;
    }
    setAdminPin(newAdminPin);
    setNewAdminPin('');
    setPinChangeMessage('PIN successfully changed!');
    setTimeout(() => setPinChangeMessage(''), 3000);
  };

  const handleSubscribe = (type: 'monthly' | 'yearly') => {
    const amount = type === 'monthly' ? 19900 : 59900;
    const desc = type === 'monthly' ? 'Monthly Premium Subscription' : 'Yearly Premium Subscription';

    const options = {
      key: 'rzp_test_SYZJko9XAmhCGw',
      amount,
      currency: 'INR',
      name: 'LexiQuest',
      description: desc,
      image: 'https://api.iconify.design/lucide:book.svg',
      handler: function (response: any) {
        if (response.razorpay_payment_id) {
          setIsPremium(true);
          localStorage.setItem('isPremium', 'true');
          setSubscriptionModalOpen(false);
          setAlertMessage(`Welcome to Premium! Your ${type} plan is now active. ✨`);
        }
      },
      prefill: {
        name: displayName,
        email: user?.email || 'user@example.com',
        contact: '9999999999'
      },
      theme: {
        color: '#4f46e5'
      }
    };
    const rzp = new (window as any).Razorpay(options);
    rzp.open();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Auth onSuccess={(u) => setUser(u)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900 pb-16">
      {/* Top Header */}
      <header className="fixed top-0 w-full bg-white border-b border-gray-200 z-40 px-4 py-2.5 flex justify-between items-center shadow-sm">
        <h1 className="text-lg font-bold flex items-center gap-2 text-indigo-600">
          <GraduationCap className="w-5 h-5" />
          LexiQuest
        </h1>
        <div className="flex items-center gap-2">
          {!isPremium && !isAdminAuthenticated && (
            <button
              onClick={() => setSubscriptionModalOpen(true)}
              className="flex items-center gap-1 text-[10px] font-black text-amber-600 bg-amber-50 px-2.5 py-1.5 rounded-full border border-amber-200 uppercase tracking-tighter"
            >
              <Star className="w-3 h-3 fill-amber-500" /> PRO
            </button>
          )}
          <button 
            onClick={() => setActiveTab('profile')}
            className={`w-8 h-8 rounded-full flex items-center justify-center border transition-colors ${activeTab === 'profile' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}
          >
            <UserPlus className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full bg-white border-t border-gray-200 z-50 flex justify-around items-center pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <button
          onClick={() => setActiveTab('learn')}
          className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${activeTab === 'learn'
            ? 'text-indigo-600'
            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            }`}
        >
          <Book className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Learn</span>
        </button>
        <button
          onClick={() => setActiveTab('test')}
          className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${activeTab === 'test'
            ? 'text-indigo-600'
            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            }`}
        >
          <CheckCircle className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Test</span>
        </button>
        <button
          onClick={() => setActiveTab('dictionary')}
          className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${activeTab === 'dictionary'
            ? 'text-indigo-600'
            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            }`}
        >
          <BookOpen className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Dict</span>
          {!isPremium && !isAdminAuthenticated && (
            <Lock className="w-2.5 h-2.5 absolute top-2 right-1/2 translate-x-4 text-indigo-300" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${activeTab === 'profile'
            ? 'text-indigo-600'
            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            }`}
        >
          <UserPlus className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Profile</span>
        </button>
        {isAdminAuthenticated && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${activeTab === 'admin'
              ? 'text-indigo-600'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}
          >
            <Settings className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Admin</span>
          </button>
        )}
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 pt-14 pb-safe overflow-y-auto flex flex-col">

        {activeTab === 'learn' && (
          <div className="flex-1 p-6 lg:p-10 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                  <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
                    <Book className="w-8 h-8 text-indigo-600" />
                    Learn New Words
                  </h2>
                  <p className="text-gray-600">
                    Expand your vocabulary with these commonly misspelled words and your custom dictionary.
                  </p>
                  {!isPremium && !isAdminAuthenticated && (
                    <button
                      onClick={() => setSubscriptionModalOpen(true)}
                      className="mt-4 flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                    >
                      <Star className="w-4 h-4 fill-white" />
                      Get Premium - Remove Ads
                    </button>
                  )}
                </div>
                  <div className="flex flex-col items-start sm:items-end gap-3 w-full sm:w-auto">
                    <div className="flex items-center justify-between sm:justify-start gap-3 bg-indigo-50 px-4 py-2.5 rounded-xl border border-indigo-100 w-full sm:w-auto">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-indigo-600" />
                        <span className="text-sm font-semibold text-indigo-900">Avg Score: {averageScore.toFixed(1)}%</span>
                      </div>
                      <div className="w-px h-4 bg-indigo-200 mx-1"></div>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-600" />
                        <span className="text-sm font-semibold text-indigo-900">Tests: {totalTestsTaken}</span>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 font-medium whitespace-nowrap self-end">
                      Page {learnPage + 1} of {totalLearnPages}
                    </div>
                  </div>
                </div>

                {/* Search Box */}
                <div className="mb-8 relative group">
                  <div className="relative">
                    <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${isPremium || isAdminAuthenticated ? 'text-gray-400' : 'text-indigo-300'}`} />
                    <input
                      type="text"
                      value={learnSearchQuery}
                      onChange={(e) => {
                        if (isPremium || isAdminAuthenticated) {
                          setLearnSearchQuery(e.target.value);
                        } else {
                          setSubscriptionModalOpen(true);
                        }
                      }}
                      placeholder={isPremium || isAdminAuthenticated ? "Search words or meanings..." : "Unlock Search with Premium"}
                      readOnly={!isPremium && !isAdminAuthenticated}
                      className={`w-full pl-12 pr-4 py-4 bg-white border rounded-2xl shadow-sm outline-none transition-all ${
                        isPremium || isAdminAuthenticated 
                          ? 'border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10' 
                          : 'border-indigo-100 bg-indigo-50/30 cursor-pointer placeholder-indigo-300'
                      }`}
                      onClick={() => {
                        if (!isPremium && !isAdminAuthenticated) {
                          setSubscriptionModalOpen(true);
                        }
                      }}
                    />
                    {(!isPremium && !isAdminAuthenticated) && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <Lock className="w-5 h-5 text-indigo-400" />
                      </div>
                    )}
                    {learnSearchQuery && (
                      <button
                        onClick={() => setLearnSearchQuery('')}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors"
                      >
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    )}
                  </div>
                  {!isPremium && !isAdminAuthenticated && (
                    <p className="mt-2 text-[10px] font-bold text-indigo-400 uppercase tracking-widest ml-1">
                      ✨ Subscribe once to unlock search forever
                    </p>
                  )}
                </div>

              {/* Daily Challenge Card */}
              {dailyWords.length > 0 && (
                <div className="mb-10 relative">
                  <div className="flex items-center justify-between mb-4 px-2">
                    <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                      <Target className="w-6 h-6 text-indigo-600" /> Daily 5 Challenge
                    </h3>
                    <span className="text-xs font-black bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full uppercase tracking-tighter">
                      {dailyWordsLearned} / 5 Mastered
                    </span>
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.div 
                      key={currentDailyIndex}
                      drag="x"
                      dragConstraints={{ left: 0, right: 0 }}
                      onDragEnd={(_, info) => {
                        const threshold = 50;
                        if (info.offset.x < -threshold) {
                          // Swiped left -> next
                          if (currentDailyIndex < dailyWords.length - 1) {
                            setCurrentDailyIndex(prev => prev + 1);
                          }
                        } else if (info.offset.x > threshold) {
                          // Swiped right -> prev
                          if (currentDailyIndex > 0) {
                            setCurrentDailyIndex(prev => prev - 1);
                          }
                        }
                      }}
                      initial={{ opacity: 0, scale: 0.95, x: 20 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95, x: -20 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="relative cursor-grab active:cursor-grabbing"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-[2.5rem] blur-2xl" />
                      <div className="relative bg-white border border-indigo-100 rounded-[2.5rem] p-8 shadow-2xl shadow-indigo-100/50 flex flex-col items-center text-center overflow-hidden">
                        {/* Decorative Background Icon */}
                        <div className="absolute -right-8 -top-8 w-32 h-32 bg-indigo-50 rounded-full flex items-center justify-center opacity-50">
                          <BookOpen className="w-16 h-16 text-indigo-100" />
                        </div>

                        <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 mb-6 z-10">
                          <Clock className="w-8 h-8" />
                        </div>

                        <div className="z-10 mb-8 max-w-sm">
                          <h4 className="text-4xl font-black text-slate-900 mb-2 capitalize tracking-tight">
                            {dailyWords[currentDailyIndex].word}
                          </h4>
                          <p className="text-lg text-slate-600 font-medium leading-relaxed italic">
                            "{dailyWords[currentDailyIndex].meaning}"
                          </p>
                        </div>

                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 w-full mb-8 text-left z-10">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                            <FileText className="w-3 h-3" /> Usage Example
                          </p>
                          <p className="text-slate-700 font-medium italic">
                            {dailyWords[currentDailyIndex].example}
                          </p>
                        </div>

                        <div className="flex flex-col w-full gap-4 z-10">
                          <div className="flex gap-4">
                            <button 
                              onClick={() => playWord(dailyWords[currentDailyIndex].word)}
                              className="flex-1 py-4 bg-indigo-50 text-indigo-600 rounded-2xl font-black text-sm hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"
                            >
                              <Volume2 className="w-5 h-5" /> Speak
                            </button>
                            <button 
                              onClick={() => {
                                // Simple mastery logic for local words
                                if (dailyWordsLearned < 5) {
                                  const newLearned = dailyWordsLearned + 1;
                                  setDailyWordsLearned(newLearned);
                                  localStorage.setItem('dailyWordsLearned', newLearned.toString());
                                  addXp(20);
                                  
                                  if (newLearned === 5) {
                                    addXp(100);
                                    setAlertMessage("🏆 Challenge Complete! You mastered the Daily 5 and earned a +100 XP Bonus!");
                                  } else {
                                    setAlertMessage(`Progress: ${newLearned}/5. Keep going! 🔥`);
                                  }
                                }
                              }}
                              disabled={dailyWordsLearned >= 5 || (currentDailyIndex < dailyWordsLearned)} // Example logic
                              className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:shadow-none"
                            >
                              <CheckCircle className="w-5 h-5" /> {dailyWordsLearned > currentDailyIndex ? 'Mastered' : 'Mark as Mastered'}
                            </button>
                          </div>

                          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                            <button 
                              onClick={() => setCurrentDailyIndex(prev => Math.max(0, prev - 1))}
                              disabled={currentDailyIndex === 0}
                              className="p-4 text-slate-400 hover:text-indigo-600 disabled:opacity-30 transition-colors"
                            >
                              <ChevronLeft className="w-8 h-8" />
                            </button>
                            <div className="flex gap-2">
                              {dailyWords.map((_, idx) => (
                                <div 
                                  key={idx} 
                                  className={`w-2 h-2 rounded-full transition-all ${idx === currentDailyIndex ? 'w-6 bg-indigo-600' : 'bg-slate-200'}`} 
                                />
                              ))}
                            </div>
                            <button 
                              onClick={() => setCurrentDailyIndex(prev => Math.min(dailyWords.length - 1, prev + 1))}
                              disabled={currentDailyIndex === dailyWords.length - 1}
                              className="p-4 text-slate-400 hover:text-indigo-600 disabled:opacity-30 transition-colors"
                            >
                              <ChevronLeft className="w-8 h-8 rotate-180" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              )}

              <motion.div 
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 cursor-grab active:cursor-grabbing"
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                onDragEnd={(_, info) => {
                  const threshold = 50;
                  if (info.offset.x < -threshold) { // Swipe left -> next page
                    if (learnPage < totalLearnPages - 1) {
                      setLearnPage(p => p + 1);
                    }
                  } else if (info.offset.x > threshold) { // Swipe right -> prev page
                    if (learnPage > 0) {
                      setLearnPage(p => p - 1);
                    }
                  }
                }}
              >
                {currentLearnWords.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col group hover:border-indigo-300 transition-colors cursor-pointer"
                    onClick={() => setExpandedWord(expandedWord === item.word ? null : item.word)}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="font-medium text-lg">{item.word}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); playWord(item.word); }}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Listen to pronunciation"
                      >
                        <Volume2 className="w-5 h-5" />
                      </button>
                    </div>
                    {expandedWord === item.word && (
                      <div className="mt-3 pt-3 border-t border-gray-100 text-sm">
                        <p className="text-gray-700 mb-1"><span className="font-semibold text-indigo-600">Meaning:</span> {item.meaning}</p>
                        <p className="text-gray-600 italic"><span className="font-semibold text-indigo-600 not-italic">Example:</span> "{item.example}"</p>
                      </div>
                    )}
                  </div>
                ))}
              </motion.div>

              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <button
                  onClick={() => setLearnPage(p => Math.max(0, p - 1))}
                  disabled={learnPage === 0}
                  className="w-full sm:w-auto px-4 py-2 bg-gray-100 text-gray-700 rounded-lg disabled:opacity-50 hover:bg-gray-200 transition-colors font-medium"
                >
                  Previous
                </button>
                <span className="text-gray-600 font-medium text-center text-sm sm:text-base">
                  Showing {learnPage * wordsPerPage + 1} - {Math.min((learnPage + 1) * wordsPerPage, allLearnWords.length)} of {allLearnWords.length}
                </span>
                <button
                  onClick={() => setLearnPage(p => Math.min(totalLearnPages - 1, p + 1))}
                  disabled={learnPage === totalLearnPages - 1}
                  className="w-full sm:w-auto px-4 py-2 bg-gray-100 text-gray-700 rounded-lg disabled:opacity-50 hover:bg-gray-200 transition-colors font-medium"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'test' && (
          <div className="flex-1 p-6 lg:p-10 overflow-y-auto flex flex-col items-center justify-center">
            <div className="max-w-2xl w-full bg-white p-8 rounded-3xl shadow-sm border border-gray-200 text-center">
              {testState === 'start' && (
                <>
                  <GraduationCap className="w-20 h-20 text-indigo-600 mx-auto mb-6" />
                  <h2 className="text-3xl font-bold mb-4">Spelling Test</h2>
                  <p className="text-gray-600 mb-8 text-lg">
                    Choose a test mode to practice your spelling skills. You will be tested on 10 random words.
                  </p>

                  <div className="flex flex-col gap-4 max-w-sm mx-auto">
                    <button
                      onClick={() => startTest('listen-mcq')}
                      className="px-6 py-4 bg-indigo-600 text-white text-lg font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-md hover:shadow-lg flex items-center justify-center gap-3"
                    >
                      <Volume2 className="w-6 h-6" />
                      Listen & Choose
                    </button>
                    <button
                      onClick={() => startTest('listen-type')}
                      className="px-6 py-4 bg-indigo-600 text-white text-lg font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-md hover:shadow-lg flex items-center justify-center gap-3"
                    >
                      <PenTool className="w-6 h-6" />
                      Listen & Type
                    </button>
                    <button
                      onClick={() => startTest('visual-mcq')}
                      className="px-6 py-4 bg-indigo-600 text-white text-lg font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-md hover:shadow-lg flex items-center justify-center gap-3"
                    >
                      <Book className="w-6 h-6" />
                      Visual MCQ
                    </button>

                    {/* Premium Locked Test Mode */}
                    <button
                      onClick={() => {
                        if (isPremium || isAdminAuthenticated) {
                          startTest('meaning-mcq');
                        } else {
                          setSubscriptionModalOpen(true);
                        }
                      }}
                      className={`px-6 py-4 border-2 font-bold rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-3 relative ${isPremium || isAdminAuthenticated
                        ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700'
                        : 'bg-white border-indigo-100 text-indigo-400 hover:border-indigo-200'
                        }`}
                    >
                      <GraduationCap className="w-6 h-6" />
                      Meaning & Context
                      {(!isPremium && !isAdminAuthenticated) && (
                        <Lock className="w-4 h-4 absolute top-2 right-2 text-indigo-300" />
                      )}
                    </button>
                  </div>
                </>
              )}

              {testState === 'testing' && (
                <>
                  <div className="flex justify-between items-center mb-8 text-sm font-medium text-gray-500">
                    <button
                      onClick={() => {
                        window.speechSynthesis?.cancel();
                        TextToSpeech.stop().catch(() => { });
                        setTestState('start');
                        setFeedbackState('none');
                        setTypedAnswer('');
                        setUserAnswers([]);
                      }}
                      className="flex items-center gap-1 text-gray-400 hover:text-red-500 transition-colors"
                      title="Exit Test"
                    >
                      <ChevronLeft className="w-5 h-5" />
                      <span className="text-xs font-medium">Exit</span>
                    </button>
                    <span>Word {currentTestWordIndex + 1} of {testWords.length}</span>
                    <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full capitalize">
                      {testMode.replace('-', ' ')}
                    </span>
                  </div>

                  {testMode !== 'visual-mcq' && (
                    <button
                      onClick={() => playWord(testWords[currentTestWordIndex])}
                      className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-8 hover:bg-indigo-100 transition-colors shadow-sm"
                      title="Play Word Again"
                    >
                      <Volume2 className="w-10 h-10" />
                    </button>
                  )}

                  {testMode === 'visual-mcq' && (
                    <h3 className="text-xl font-medium mb-8 text-gray-800">Select the correctly spelled word:</h3>
                  )}

                  {testMode === 'meaning-mcq' && (
                    <div className="mb-8 max-w-lg mx-auto bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm animate-in fade-in zoom-in duration-300">
                      {(() => {
                        const currentWord = testWords[currentTestWordIndex]?.toLowerCase();
                        const wordObj = allLearnWords.find(w => w.word.toLowerCase() === currentWord);
                        if (!wordObj) return <p className="text-gray-400 italic">Context loading...</p>;

                        // Replace the word in the example sentence with "____"
                        const displayExample = wordObj.example.replace(new RegExp(wordObj.word, 'gi'), '__________');

                        return (
                          <div className="space-y-4">
                            <div className="flex flex-col items-center">
                              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em] mb-1">Hindi Meaning</span>
                              <p className="text-3xl font-bold text-gray-900 mb-2">{wordObj.meaning}</p>
                            </div>
                            <div className="h-px bg-gray-100 w-1/4 mx-auto"></div>
                            <div className="flex flex-col items-center">
                              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em] mb-1">Fill in the blank</span>
                              <p className="text-lg text-gray-700 italic text-center">"{displayExample}"</p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {testMode === 'listen-type' ? (
                    <div className="flex flex-col items-center max-w-sm mx-auto">
                      <input
                        type="text"
                        value={typedAnswer}
                        onChange={e => setTypedAnswer(e.target.value)}
                        className={`border-2 rounded-xl p-4 text-xl text-center w-full mb-4 outline-none transition-all ${feedbackState === 'correct' ? 'border-green-500 bg-green-50 text-green-900' :
                          feedbackState === 'incorrect' ? 'border-red-500 bg-red-50 text-red-900' :
                            'border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-gray-900'
                          }`}
                        placeholder="Type the word here..."
                        autoFocus
                        disabled={feedbackState !== 'none'}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && typedAnswer.trim() && feedbackState === 'none') {
                            handleAnswerSubmit(typedAnswer.trim());
                          }
                        }}
                      />
                      {feedbackState === 'none' && (
                        <button
                          onClick={() => {
                            if (typedAnswer.trim()) {
                              handleAnswerSubmit(typedAnswer.trim());
                            }
                          }}
                          disabled={!typedAnswer.trim()}
                          className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                          Submit Answer
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="max-w-md mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {mcqOptions[currentTestWordIndex]?.map((option, idx) => {
                        let btnClass = "w-full py-4 px-6 bg-white border-2 border-gray-200 text-gray-800 text-lg font-medium rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all text-center";
                        if (feedbackState !== 'none') {
                          const isCorrectOption = option.toLowerCase() === testWords[currentTestWordIndex].toLowerCase();
                          const isSelectedOption = option.toLowerCase() === userAnswers[currentTestWordIndex]?.toLowerCase();
                          if (isCorrectOption) {
                            btnClass = "w-full py-4 px-6 bg-green-50 border-2 border-green-500 text-green-800 text-lg font-medium rounded-xl transition-all text-center";
                          } else if (isSelectedOption) {
                            btnClass = "w-full py-4 px-6 bg-red-50 border-2 border-red-500 text-red-800 text-lg font-medium rounded-xl transition-all text-center";
                          } else {
                            btnClass = "w-full py-4 px-6 bg-gray-50 border-2 border-gray-200 text-gray-400 text-lg font-medium rounded-xl transition-all text-center opacity-50";
                          }
                        }
                        return (
                          <button
                            key={idx}
                            onClick={() => feedbackState === 'none' && handleAnswerSubmit(option)}
                            disabled={feedbackState !== 'none'}
                            className={btnClass}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {feedbackState === 'incorrect' && (
                    <div className="mt-8 max-w-md mx-auto bg-red-50 border border-red-200 rounded-2xl p-6 text-left animate-in fade-in slide-in-from-bottom-4">
                      <div className="flex items-center gap-2 text-red-600 mb-4">
                        <X className="w-6 h-6" />
                        <h3 className="text-xl font-bold">Incorrect</h3>
                      </div>
                      <div className="mb-4">
                        <p className="text-sm text-gray-500 uppercase tracking-wider font-bold mb-1">Correct Word</p>
                        <p className="text-2xl font-bold text-gray-900">{testWords[currentTestWordIndex]}</p>
                      </div>
                      {(() => {
                        const currentWordObj = allLearnWords.find(w => w.word.toLowerCase() === testWords[currentTestWordIndex].toLowerCase());
                        if (currentWordObj) {
                          return (
                            <div className="space-y-3">
                              <div>
                                <p className="text-sm text-gray-500 uppercase tracking-wider font-bold mb-1">Meaning</p>
                                <p className="text-gray-800">{currentWordObj.meaning}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-500 uppercase tracking-wider font-bold mb-1">Example</p>
                                <p className="text-gray-800 italic">"{currentWordObj.example}"</p>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      <button
                        onClick={() => handleNextQuestion(currentTestWordIndex)}
                        className="mt-6 w-full py-3 bg-red-600 text-white rounded-xl font-bold text-lg hover:bg-red-700 transition-colors"
                      >
                        Next Word
                      </button>
                    </div>
                  )}

                  {feedbackState === 'correct' && (
                    <div className="mt-8 max-w-md mx-auto bg-green-50 border border-green-200 rounded-2xl p-4 text-center animate-in fade-in slide-in-from-bottom-4">
                      <div className="flex items-center justify-center gap-2 text-green-600">
                        <CheckCircle className="w-6 h-6" />
                        <h3 className="text-xl font-bold">Correct!</h3>
                      </div>
                    </div>
                  )}
                </>
              )}

              {testState === 'results' && (
                <>
                  <h2 className="text-3xl font-bold mb-8">Test Results</h2>
                  <div className="space-y-4 mb-8 text-left">
                    {testWords.map((word, idx) => {
                      const isCorrect = word.toLowerCase() === userAnswers[idx];
                      return (
                        <div key={idx} className={`p-4 rounded-xl border flex items-center justify-between ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                          <div className="flex items-center gap-3">
                            {isCorrect ? <CheckCircle className="text-green-600 w-6 h-6" /> : <X className="text-red-600 w-6 h-6" />}
                            <div>
                              <p className="font-medium text-gray-900">Your answer: <span className={isCorrect ? 'text-green-700' : 'text-red-700 line-through'}>{userAnswers[idx] || '(blank)'}</span></p>
                              {!isCorrect && <p className="text-sm text-green-700 font-medium mt-1">Correct: {word}</p>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="text-2xl font-bold mb-8">
                    Score: {userAnswers.filter((ans, i) => ans === testWords[i].toLowerCase()).length} / {testWords.length}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                      onClick={() => setTestState('start')}
                      className="px-8 py-4 bg-gray-900 text-white text-lg font-bold rounded-2xl hover:bg-gray-800 transition-colors shadow-lg"
                    >
                      Take Another Test
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="flex-1 p-6 lg:p-10 overflow-y-auto bg-slate-50">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center gap-6 mb-10">
                <div className="relative">
                  <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2rem] flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-indigo-200 overflow-hidden">
                    {profileImage ? (
                      <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      user?.displayName?.[0] || displayName?.[0] || user?.email?.[0]?.toUpperCase() || 'U'
                    )}
                  </div>
                  <button 
                    onClick={async () => {
                      if (Capacitor.isNativePlatform()) {
                        try {
                          const image = await (window as any).Capacitor.Plugins.Camera.getPhoto({
                            quality: 90,
                            allowEditing: true,
                            resultType: 'dataUrl',
                            source: 'photos'
                          });
                          if (image.dataUrl) {
                            setProfileImage(image.dataUrl);
                            localStorage.setItem('profileImage', image.dataUrl);
                          }
                        } catch (e) { console.error(e); }
                      } else {
                        setAlertMessage("Image picking is only available on Android/iOS.");
                      }
                    }}
                    className="absolute -bottom-2 -right-2 p-2 bg-white rounded-full shadow-lg border border-slate-100 text-indigo-600 hover:scale-110 transition-transform"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1">
                  {isEditingProfile ? (
                    <div className="flex flex-col gap-2">
                       <input 
                        type="text" 
                        value={displayName} 
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="text-xl font-black text-slate-900 bg-slate-100 px-3 py-2 rounded-xl outline-none border border-indigo-200 focus:border-indigo-600 transition-colors"
                        autoFocus
                       />
                       <button 
                        onClick={() => { 
                          setIsEditingProfile(false); 
                          localStorage.setItem('userName', displayName);
                          setAlertMessage("Profile updated! ✨");
                        }}
                        className="bg-indigo-600 text-white text-[10px] font-black py-1.5 rounded-lg uppercase w-fit px-4"
                       > Save Changes </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <h2 className="text-3xl font-black text-slate-900 mb-1">{displayName}</h2>
                        <button onClick={() => setIsEditingProfile(true)} className="p-1 text-slate-400 hover:text-indigo-600"><Sliders className="w-4 h-4" /></button>
                      </div>
                      <p className="text-slate-500 font-medium flex items-center gap-2">
                        <Star className={`w-4 h-4 ${isPremium ? 'text-amber-500 fill-amber-500' : 'text-slate-300'}`} />
                        {isPremium ? 'Premium Member' : 'Free Explorer'}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 text-indigo-600 mb-2">
                    <GraduationCap className="w-5 h-5" />
                    <span className="text-xs font-bold uppercase tracking-widest">Experience</span>
                  </div>
                  <p className="text-2xl font-black text-slate-900">Level {level}</p>
                  <div className="mt-2 w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(xp / (level * 100 * level)) * 100}%` }}
                      className="h-full bg-indigo-600"
                    />
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 mt-2">{xp} / {level * 100 * level} XP</p>
                </div>
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 text-orange-500 mb-2">
                    <Flame className="w-5 h-5" />
                    <span className="text-xs font-bold uppercase tracking-widest">Streak</span>
                  </div>
                  <p className="text-2xl font-black text-slate-900">{streak} Days</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-2 whitespace-nowrap">Don't break the chain!</p>
                </div>
              </div>

              {/* Streak Shield Section */}
              <div className="mb-8 p-5 bg-gradient-to-r from-orange-500 to-amber-500 rounded-3xl text-white shadow-lg shadow-orange-100 flex items-center justify-between">
                <div>
                  <h4 className="font-black flex items-center gap-2">
                    <Star className="w-5 h-5 fill-white" /> Streak Shield
                  </h4>
                  <p className="text-[10px] font-bold opacity-80 uppercase tracking-wider">Protects your streak if you miss a day</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black">{streakShields} Available</p>
                  {!isPremium ? (
                    <button 
                      onClick={() => setSubscriptionModalOpen(true)}
                      className="text-[10px] font-black bg-white/20 px-3 py-1 rounded-full uppercase hover:bg-white/30 transition-colors"
                    >
                      Premium Only
                    </button>
                  ) : (
                     <p className="text-[10px] font-bold opacity-80">Refills Weekly</p>
                  )}
                </div>
              </div>

              {/* Daily Missions Section */}
              <div className="mb-8">
                <h3 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
                   <Target className="w-6 h-6 text-indigo-600" /> Daily Missions
                </h3>
                <div className="space-y-3">
                  {missions.map(m => (
                    <div key={m.id} className={`p-4 rounded-2xl border transition-all ${m.completed ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold text-slate-900">{m.title}</p>
                          <p className="text-xs text-slate-500">{m.desc}</p>
                        </div>
                        {m.completed && <CheckCircle className="w-5 h-5 text-green-500" />}
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ${m.completed ? 'bg-green-500' : 'bg-indigo-600'}`}
                          style={{ width: `${Math.min(100, (m.current / m.goal) * 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-2">
                        <span className="text-[10px] font-bold text-slate-400">{m.current}/{m.goal}</span>
                        <span className="text-[10px] font-bold text-indigo-600">+{m.reward} XP</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Badges Section */}
              <div className="mb-10">
                <h3 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
                  <Star className="w-6 h-6 text-amber-500" /> Achievement Badges
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  {badges.map(b => (
                    <div key={b.id} className={`aspect-square rounded-3xl flex flex-col items-center justify-center p-2 text-center transition-all ${b.earned ? 'bg-amber-50 border border-amber-200 shadow-sm' : 'bg-slate-100 opacity-50 grayscale'}`}>
                      <span className="text-3xl mb-2">{b.icon}</span>
                      <span className="text-[10px] font-bold text-slate-700 leading-tight">{b.title}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Other Options */}
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden mb-10">
                <button 
                  onClick={handleShareApp}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors border-b border-slate-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                      <Share2 className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-slate-800">Share App</span>
                  </div>
                  <ChevronLeft className="w-5 h-5 text-slate-300 rotate-180" />
                </button>
                <button 
                  onClick={() => setSpeechSettingsOpen(true)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors border-b border-slate-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
                      <Sliders className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-slate-800">Speech Settings</span>
                  </div>
                  <ChevronLeft className="w-5 h-5 text-slate-300 rotate-180" />
                </button>
                <button 
                  onClick={() => { setDraftReminderTime(reminderTime); setReminderPopoverOpen(o => !o); }}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors border-b border-slate-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600">
                      <Bell className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-slate-800">Daily Reminder</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400">{reminderTime}</span>
                    <ChevronLeft className="w-5 h-5 text-slate-300 rotate-180" />
                  </div>
                </button>
                <button 
                  onClick={handleSignOut}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-red-50 transition-colors border-b border-slate-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-600">
                      <LogIn className="w-5 h-5 rotate-180" />
                    </div>
                    <span className="font-bold text-red-600">Sign Out</span>
                  </div>
                </button>
                <button 
                  onClick={handleDeleteAccount}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-rose-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center text-rose-600">
                      <Trash2 className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-rose-600">Delete Account</span>
                  </div>
                </button>
              </div>

               {!isAdminAuthenticated && (
                <button 
                  onClick={() => setPinModalOpen(true)}
                  className="w-full py-4 text-slate-400 text-xs font-bold uppercase tracking-widest hover:text-indigo-600 transition-colors mb-10"
                >
                  Admin Access
                </button>
               )}
            </div>
          </div>
        )}

        {activeTab === 'dictionary' && (
          <div className="flex-1 p-4 lg:p-8 overflow-y-auto">
            <div className="max-w-2xl mx-auto">
              {/* Header */}
              <div className="mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2 mb-1">
                  <BookOpen className="w-7 h-7 text-indigo-600" />
                  Dictionary
                </h2>
                <p className="text-gray-500 text-sm">Search any English word for its meaning, synonyms & antonyms.</p>
              </div>

              {!isPremium && !isAdminAuthenticated ? (
                <div className="bg-indigo-50 rounded-[2.5rem] p-10 text-center border border-indigo-100 shadow-sm relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-400 to-transparent opacity-50" />
                   <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg text-indigo-600">
                     <Lock className="w-10 h-10" />
                   </div>
                   <h3 className="text-2xl font-black text-slate-900 mb-3">Premium Feature</h3>
                   <p className="text-slate-600 mb-8 max-w-xs mx-auto">Access the full English dictionary with synonyms, antonyms and pronunciations.</p>
                   <button 
                    onClick={() => setSubscriptionModalOpen(true)}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                   >
                     <Star className="w-5 h-5 fill-white" /> Unlock with Premium
                   </button>
                </div>
              ) : (
                <>
                  {/* Search Box */}
                  <div className="flex gap-2 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={dictQuery}
                    onChange={e => setDictQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') searchDictionary(); }}
                    placeholder="Type a word and press Enter..."
                    className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none bg-white text-gray-800 shadow-sm"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>
                <button
                  onClick={() => searchDictionary()}
                  disabled={dictLoading || !dictQuery.trim()}
                  className="px-5 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
                >
                  {dictLoading ? (
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4A8 8 0 0012 4z" />
                    </svg>
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  Search
                </button>
              </div>
            </>
          )}

              {/* Error State */}
              {dictError && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
                  <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-2" />
                  <p className="text-red-700 font-medium">{dictError}</p>
                </div>
              )}

              {/* Result Card */}
              {dictResult && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  {/* Word Header */}
                  <div className="bg-indigo-600 p-5 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-2xl font-bold capitalize">{dictResult.word}</h3>
                        {dictResult.phonetic && (
                          <p className="text-indigo-200 text-sm mt-0.5">{dictResult.phonetic}</p>
                        )}
                      </div>
                      {dictAudio && (
                        <button
                          onClick={() => dictAudio.play()}
                          className="p-3 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                          title="Play pronunciation"
                        >
                          <Volume2 className="w-6 h-6" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-5 space-y-6">
                    {dictResult.meanings.map((meaning, mIdx) => {
                      // collect all synonyms & antonyms from this meaning
                      const allSynonyms = Array.from(new Set([
                        ...meaning.synonyms,
                        ...meaning.definitions.flatMap(d => d.synonyms)
                      ])).slice(0, 8);
                      const allAntonyms = Array.from(new Set([
                        ...meaning.antonyms,
                        ...meaning.definitions.flatMap(d => d.antonyms)
                      ])).slice(0, 8);

                      return (
                        <div key={mIdx}>
                          {/* Part of speech badge */}
                          <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full uppercase tracking-wider mb-3">
                            {meaning.partOfSpeech}
                          </span>

                          {/* Definitions */}
                          <ol className="space-y-3 mb-4">
                            {meaning.definitions.slice(0, 3).map((def, dIdx) => (
                              <li key={dIdx} className="flex gap-3">
                                <span className="flex-shrink-0 w-6 h-6 bg-gray-100 text-gray-600 text-xs font-bold rounded-full flex items-center justify-center mt-0.5">{dIdx + 1}</span>
                                <div>
                                  <p className="text-gray-800 text-sm leading-relaxed">{def.definition}</p>
                                  {def.example && (
                                    <p className="text-gray-500 text-xs italic mt-1 pl-2 border-l-2 border-gray-200">"{def.example}"</p>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ol>

                          {/* Synonyms & Antonyms (Premium/Admin Feature) */}
                          {(!isPremium && !isAdminAuthenticated) ? (
                            <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex flex-col items-center text-center">
                              <Lock className="w-5 h-5 text-indigo-400 mb-2" />
                              <p className="text-xs font-bold text-indigo-900 mb-1">Unlock Synonyms & Antonyms</p>
                              <p className="text-[10px] text-indigo-600 mb-3">Get full dictionary access and remove all ads.</p>
                              <button
                                onClick={() => setSubscriptionModalOpen(true)}
                                className="px-4 py-1.5 bg-indigo-600 text-white text-[10px] font-bold rounded-full hover:bg-indigo-700 transition-colors shadow-sm"
                              >
                                Upgrade to Premium
                              </button>
                            </div>
                          ) : (
                            <>
                              {/* Synonyms */}
                              {allSynonyms.length > 0 && (
                                <div className="mb-3">
                                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                    <Star className="w-3 h-3 text-emerald-500" /> Synonyms
                                  </p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {allSynonyms.map((syn, sIdx) => (
                                      <button
                                        key={sIdx}
                                        onClick={() => { setDictQuery(syn); searchDictionary(syn); }}
                                        className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full border border-emerald-200 hover:bg-emerald-100 transition-colors"
                                      >
                                        {syn}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Antonyms */}
                              {allAntonyms.length > 0 && (
                                <div>
                                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                    <X className="w-3 h-3 text-rose-500" /> Antonyms
                                  </p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {allAntonyms.map((ant, aIdx) => (
                                      <button
                                        key={aIdx}
                                        onClick={() => { setDictQuery(ant); searchDictionary(ant); }}
                                        className="px-3 py-1 bg-rose-50 text-rose-700 text-xs font-medium rounded-full border border-rose-200 hover:bg-rose-100 transition-colors"
                                      >
                                        {ant}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          )}

                          {mIdx < dictResult.meanings.length - 1 && (
                            <hr className="mt-4 border-gray-100" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer note */}
                  <div className="px-5 pb-4">
                    <p className="text-[10px] text-gray-400 text-center">Powered by Free Dictionary API &bull; dictionaryapi.dev</p>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!dictResult && !dictError && !dictLoading && (
                <div className="text-center py-16 text-gray-400">
                  <BookOpen className="w-14 h-14 mx-auto text-gray-200 mb-4" />
                  <p className="font-medium text-gray-500">Search for any English word</p>
                  <p className="text-sm mt-1">Definitions, examples, synonyms &amp; antonyms</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'admin' && isAdminAuthenticated && (
          <div className="flex-1 p-6 lg:p-10 overflow-y-auto">
            <div className="max-w-3xl mx-auto">
              <div className="mb-8">
                <h2 className="text-3xl font-bold mb-2">Dictionary Admin Panel</h2>
                <p className="text-gray-600">
                  Manage global dictionary and authorized administrators.
                </p>
              </div>

              {/* Admin Management Section */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-8">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-indigo-600" />
                  Manage Administrators
                </h3>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newAdminEmail.trim() || !newAdminEmail.includes('@')) return;
                    
                    const updatedAdmins = [...adminEmails, newAdminEmail.trim().toLowerCase()];
                    try {
                      await FirebaseFirestore.setDocument({
                        reference: 'config/admins',
                        data: { emails: updatedAdmins },
                        merge: true
                      });
                      setAdminEmails(updatedAdmins);
                      setNewAdminEmail('');
                      setAlertMessage(`Successfully added ${newAdminEmail} as Admin.`);
                    } catch (err) {
                      console.error('Failed to update admins:', err);
                    }
                  }}
                  className="flex flex-col sm:flex-row gap-3 mb-6"
                >
                  <input
                    type="email"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    placeholder="Friend's email address"
                    className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!newAdminEmail.trim()}
                    className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    Add Admin
                  </button>
                </form>

                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Current Admins</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-purple-50 text-purple-700 text-xs font-bold rounded-full border border-purple-200">sandeepfalse456@gmail.com (Super)</span>
                    {adminEmails.map(email => (
                      <div key={email} className="flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full border border-indigo-200">
                        <span>{email}</span>
                        <button 
                          onClick={async () => {
                            const updated = adminEmails.filter(e => e !== email);
                            await FirebaseFirestore.setDocument({
                              reference: 'config/admins',
                              data: { emails: updated },
                              merge: true
                            });
                            setAdminEmails(updated);
                          }}
                          className="hover:text-red-500 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Change PIN Form */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-8">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-indigo-600" />
                  Change Admin PIN
                </h3>
                <form
                  onSubmit={handleChangePin}
                  className="flex flex-col sm:flex-row gap-3"
                >
                  <input
                    type="password"
                    value={newAdminPin}
                    onChange={(e) => setNewAdminPin(e.target.value)}
                    placeholder="Enter new PIN"
                    className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!newAdminPin.trim()}
                    className="px-6 py-3 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                  >
                    Update PIN
                  </button>
                </form>
                {pinChangeMessage && (
                  <p className={`mt-3 text-sm font-medium ${pinChangeMessage.includes('successfully') ? 'text-green-600' : 'text-red-600'}`}>
                    {pinChangeMessage}
                  </p>
                )}
              </div>


              {/* Add Word Form */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Bulk Add Words (Up to 2)</h3>
                </div>
                <form
                  onSubmit={handleAddCustomWordSubmit}
                  className="flex flex-col gap-4"
                >
                  <div className="space-y-4">
                    {bulkWords.map((item, index) => (
                      <div key={index} className="flex flex-col md:flex-row gap-3 p-4 bg-gray-50 border border-gray-200 rounded-xl relative items-start md:items-center">
                        <div className="flex items-center justify-between w-full md:w-auto md:min-w-[80px]">
                          <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Word {index + 1}</span>
                          {bulkWords.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeBulkWordRow(index)}
                              className="md:hidden p-1 text-gray-400 hover:text-red-500 transition-colors"
                              title="Remove Word"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full flex-1">
                          <input
                            type="text"
                            value={item.word}
                            onChange={(e) => updateBulkWord(index, 'word', e.target.value)}
                            placeholder="Word"
                            className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                          />
                          <input
                            type="text"
                            value={item.meaning}
                            onChange={(e) => updateBulkWord(index, 'meaning', e.target.value)}
                            placeholder="Hindi Meaning"
                            className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                          />
                          <input
                            type="text"
                            value={item.example}
                            onChange={(e) => updateBulkWord(index, 'example', e.target.value)}
                            placeholder="English Example"
                            className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                          />
                        </div>
                        {bulkWords.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeBulkWordRow(index)}
                            className="hidden md:block p-2 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                            title="Remove Word"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-2">
                    <button
                      type="button"
                      onClick={addBulkWordRow}
                      disabled={bulkWords.length >= 2}
                      className="w-full sm:w-auto px-4 py-3 text-indigo-600 font-medium bg-indigo-50 rounded-xl hover:bg-indigo-100 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="w-5 h-5" />
                      Add Another Word
                    </button>

                    <button
                      type="submit"
                      disabled={!bulkWords.some(w => w.word.trim() && w.meaning.trim() && w.example.trim())}
                      className="w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      <Save className="w-5 h-5" />
                      Save Words
                    </button>
                  </div>
                </form>
              </div>

              {/* Custom Words List */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Book className="w-5 h-5 text-indigo-600" />
                    Custom Dictionary ({customWords.length})
                  </h3>
                  {customWords.length > 0 && (
                    <button
                      onClick={() => setClearConfirmModalOpen(true)}
                      className="text-sm text-red-600 hover:text-red-700 font-medium whitespace-nowrap"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {customWords.length === 0 ? (
                  <div className="p-12 text-center text-gray-500">
                    <Book className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p>Your custom dictionary is empty.</p>
                    <p className="text-sm mt-1">Add words above.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                    {[...customWords].sort((a, b) => a.word.localeCompare(b.word)).map(item => (
                      <li key={item.word} className="p-4 flex justify-between items-start hover:bg-gray-50 transition-colors">
                        <div>
                          <span className="font-mono text-gray-800 font-bold text-lg">{item.word}</span>
                          <p className="text-sm text-gray-600 mt-1"><span className="font-semibold text-indigo-600">Meaning:</span> {item.meaning}</p>
                          <p className="text-sm text-gray-500 italic mt-0.5"><span className="font-semibold text-indigo-600 not-italic">Example:</span> "{item.example}"</p>
                        </div>
                        <button
                          onClick={() => removeCustomWord(item.word)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-4"
                          title="Remove word"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modals Overlay */}
        {(pinModalOpen || alertMessage || confirmModalOpen || clearConfirmModalOpen) && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">

            {/* PIN Modal */}
            {pinModalOpen && (
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Lock className="w-5 h-5 text-indigo-600" />
                    Admin Access
                  </h3>
                  <button onClick={() => { setPinModalOpen(false); setPinError(''); setPinInput(''); }} className="text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handlePinSubmit}>
                  <p className="text-sm text-gray-600 mb-4">Enter the PIN to access the admin panel.</p>
                  <input
                    type="password"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    placeholder="Enter PIN (1234)"
                    autoFocus
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none mb-2 text-center tracking-widest text-lg"
                  />
                  {pinError && <p className="text-red-500 text-sm mb-4">{pinError}</p>}
                  <button type="submit" className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors mt-4">
                    Unlock
                  </button>
                </form>
              </div>
            )}

            {/* Alert Modal */}
            {alertMessage && (
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl text-center">
                <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                <p className="text-gray-800 mb-6">{alertMessage}</p>
                <button
                  onClick={() => setAlertMessage('')}
                  className="w-full py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors"
                >
                  Okay
                </button>
              </div>
            )}

            {/* Confirm Modal */}
            {confirmModalOpen && (
              <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl text-center">
                <AlertCircle className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Words Already Recognized</h3>
                <p className="text-gray-600 mb-6">
                  {wordsToConfirm.length} word(s) are already common words recognized by the spell checker. Do you still want to add them to your custom dictionary?
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => { setConfirmModalOpen(false); setWordsToConfirm([]); }}
                    className="flex-1 py-3 bg-gray-100 text-gray-800 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmAddWord}
                    className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors"
                  >
                    Add Anyway
                  </button>
                </div>
              </div>
            )}

            {/* Clear Confirm Modal */}
            {clearConfirmModalOpen && (
              <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Clear Custom Dictionary</h3>
                <p className="text-gray-600 mb-6">
                  Are you sure you want to delete all {customWords.length} words from your custom dictionary? This action cannot be undone.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => setClearConfirmModalOpen(false)}
                    className="flex-1 py-3 bg-gray-100 text-gray-800 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setCustomWords([]);
                      setClearConfirmModalOpen(false);
                    }}
                    className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

        {/* Speech Settings Modal */}
        {speechSettingsOpen && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2 text-indigo-900">
                  <Sliders className="w-6 h-6 text-indigo-600" />
                  Speech Settings
                </h3>
                <button
                  onClick={() => setSpeechSettingsOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Voice Selection</label>
                  <select
                    value={selectedVoiceURI}
                    onChange={(e) => setSelectedVoiceURI(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all appearance-none bg-gray-50 text-gray-800"
                  >
                    {availableVoices.filter(v => v.lang.startsWith('en')).map(voice => (
                      <option key={voice.voiceURI} value={voice.voiceURI}>
                        {voice.name} ({voice.lang})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-semibold text-gray-700">Speech Rate (Speed)</label>
                    <span className="text-sm font-bold text-indigo-600">{speechRate.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={speechRate}
                    onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>Slower</span>
                    <span>Normal</span>
                    <span>Faster</span>
                  </div>
                </div>

                <button
                  onClick={() => playWord("Pronunciation test")}
                  className="w-full py-3 bg-indigo-50 text-indigo-600 font-bold rounded-xl hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2"
                >
                  <Volume2 className="w-5 h-5" />
                  Test Voice
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Subscription Modal */}
        {subscriptionModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-md">
            <div className="bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-300">
              <div className="relative h-40 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-8 flex flex-col justify-end">
                <button
                  onClick={() => setSubscriptionModalOpen(false)}
                  className="absolute top-4 right-4 p-2 bg-black/10 hover:bg-black/20 text-white rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <h3 className="text-2xl font-black text-white">Upgrade to Premium</h3>
                <p className="text-white/80 text-xs font-bold uppercase tracking-widest">Unlock your full potential</p>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <button 
                    onClick={() => handleSubscribe('monthly')}
                    className="p-5 rounded-3xl border-2 border-slate-100 hover:border-indigo-600 transition-all text-left group bg-slate-50 hover:bg-white"
                  >
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Monthly</p>
                    <p className="text-2xl font-black text-slate-900">₹199</p>
                    <p className="text-[10px] font-bold text-indigo-600 mt-2 group-hover:scale-105 transition-transform">Get Started →</p>
                  </button>
                  <button 
                    onClick={() => handleSubscribe('yearly')}
                    className="p-5 rounded-3xl border-2 border-indigo-600 bg-indigo-50/50 text-left relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[8px] font-black px-2 py-1 rounded-bl-lg uppercase">Best Value</div>
                    <p className="text-[10px] font-black text-indigo-600 uppercase mb-1">Yearly</p>
                    <p className="text-2xl font-black text-slate-900">₹599</p>
                    <p className="text-[10px] font-bold text-indigo-600 mt-2">Save 75% →</p>
                  </button>
                </div>

                <div className="space-y-3 mb-6">
                  {[
                    { icon: <CheckCircle className="w-4 h-4 text-green-500" />, text: "No Advertisements" },
                    { icon: <GraduationCap className="w-4 h-4 text-purple-500" />, text: "Adv. Meaning Tests" },
                    { icon: <BookOpen className="w-4 h-4 text-indigo-500" />, text: "Advanced Dictionary" },
                    { icon: <Plus className="w-4 h-4 text-orange-500" />, text: "Unlimited Custom Words" }
                  ].map((f, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm font-medium text-slate-600">
                      {f.icon} {f.text}
                    </div>
                  ))}
                </div>

                <p className="text-center text-[10px] text-gray-400 mt-4 px-4 uppercase tracking-widest font-bold">Secure Payment powered by Razorpay</p>
              </div>
            </div>
          </div>
        )}

      {/* Level-Up Celebration Modal */}
      <AnimatePresence>
        {showLevelUp && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full text-center shadow-2xl border border-purple-100"
            >
              <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-purple-200">
                <Star className="w-12 h-12 text-white animate-pulse" />
              </div>
              <h2 className="text-3xl font-black text-slate-900 mb-2">LEVEL UP!</h2>
              <p className="text-slate-500 mb-6 font-medium">You've reached <span className="text-purple-600 font-bold">Level {level}</span>. Your vocabulary is growing fast!</p>
              <button 
                onClick={() => setShowLevelUp(false)}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-colors shadow-lg active:scale-95"
              >
                Keep Learning
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      </main>
    </div>
  );
}

