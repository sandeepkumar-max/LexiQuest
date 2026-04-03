import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { AdMob } from '@capacitor-community/admob';
import { App as CapApp } from '@capacitor/app';
import { Dialog } from '@capacitor/dialog';
import { Book, BookOpen, Search, Settings, Plus, Trash2, CheckCircle, AlertCircle, FileText, GraduationCap, PenTool, Lock, Unlock, Volume2, X, Sliders, Bell, Flame, Save, Download, Upload, Share2, Clock, ChevronLeft, Star, LogIn } from 'lucide-react';
import { COMMON_WORDS } from './lib/dictionary';
import { LEARN_WORDS } from './lib/learnWords';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import Auth from './components/Auth';
import { GoogleGenAI } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';

type Tab = 'learn' | 'test' | 'dictionary' | 'admin';

interface DictPhonetic { text?: string; audio?: string; }
interface DictDefinition { definition: string; example?: string; synonyms: string[]; antonyms: string[]; }
interface DictMeaning { partOfSpeech: string; definitions: DictDefinition[]; synonyms: string[]; antonyms: string[]; }
interface DictEntry { word: string; phonetic?: string; phonetics: DictPhonetic[]; meanings: DictMeaning[]; }

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('learn');
  const [customWords, setCustomWords] = useState<{ word: string, meaning: string, example: string }[]>([]);
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
  const [dailyWord, setDailyWord] = useState<{ word: string, meaning: string, example: string } | null>(null);
  const [dailyWordsLearned, setDailyWordsLearned] = useState(() => parseInt(localStorage.getItem('dailyWordsLearned') || '0'));
  const [lastDailyWordDate, setLastDailyWordDate] = useState(() => localStorage.getItem('lastDailyWordDate') || '');

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
  const allLearnWords = useMemo(() => [...LEARN_WORDS, ...customWords], [customWords]);
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

  // AI Story Generation State
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [aiStory, setAiStory] = useState('');
  const [storyModalOpen, setStoryModalOpen] = useState(false);
  const geminiApiKey = localStorage.getItem('GEMINI_API_KEY') || '';

  const generateAIStory = async (words: string[]) => {
    if (!geminiApiKey) {
      const { value } = await Dialog.prompt({
        title: 'Gemini API Key Required',
        message: 'Please enter your Google Gemini API Key to enable AI Story Mode. You can get one from Google AI Studio.',
      });
      if (value) {
        localStorage.setItem('GEMINI_API_KEY', value);
      } else {
        return;
      }
    }

    setIsGeneratingStory(true);
    try {
      const apiKey = localStorage.getItem('GEMINI_API_KEY') || '';
      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `Write a very short, quirky and funny 2-3 sentence story using these words: ${words.join(', ')}. Keep it simple and engaging for a vocabulary learner. Output ONLY the story.`;

      const result = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });
      setAiStory(result.text || 'No story generated.');
      setStoryModalOpen(true);
    } catch (error) {
      console.error('Gemini error:', error);
      setAlertMessage('Failed to generate AI story. Please check your API key.');
    } finally {
      setIsGeneratingStory(false);
    }
  };

  // Firebase Authentication State Listener
  useEffect(() => {
    const checkUser = async () => {
      try {
        const result = await FirebaseAuthentication.getCurrentUser();
        setUser(result.user);
      } catch (err) {
        console.error('Failed to get current user', err);
      } finally {
        setAuthLoading(false);
      }
    };

    checkUser();

    const listener = FirebaseAuthentication.addListener('authStateChange', (result) => {
      setUser(result.user);
    });

    return () => {
      listener.then(l => l.remove());
    };
  }, []);

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

  useEffect(() => {
    const today = new Date().toDateString();
    if (lastDailyWordDate !== today) {
      const randomIndex = Math.floor(Math.random() * LEARN_WORDS.length);
      setDailyWord(LEARN_WORDS[randomIndex]);
      setLastDailyWordDate(today);
      setDailyWordsLearned(0);
      localStorage.setItem('lastDailyWordDate', today);
      localStorage.setItem('dailyWordsLearned', '0');
    } else {
      // Find today's word from the same index if we wanted consistency, 
      // but for now just pick one and keep it for the session
      if (!dailyWord) {
        const seed = today.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const randomIndex = seed % LEARN_WORDS.length;
        setDailyWord(LEARN_WORDS[randomIndex]);
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
    if (!reminderEnabled) return;

    const checkReminder = async () => {
      const now = new Date();
      const currentHours = now.getHours().toString().padStart(2, '0');
      const currentMinutes = now.getMinutes().toString().padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMinutes}`;

      if (currentTimeStr === reminderTime) {
        const lastNotified = localStorage.getItem('lastNotifiedDate');
        const todayStr = now.toDateString();

        if (lastNotified !== todayStr) {
          if (Capacitor.isNativePlatform()) {
            await LocalNotifications.schedule({
              notifications: [
                {
                  title: 'LexiQuest Reminder',
                  body: "It's time for your daily spelling practice! Let's learn some new words.",
                  id: 1,
                  schedule: { at: new Date(Date.now() + 1000) },
                  sound: undefined,
                  attachments: undefined,
                  actionTypeId: "",
                  extra: null
                }
              ]
            });
          } else if (Notification.permission === 'granted') {
            new Notification('LexiQuest Reminder', {
              body: "It's time for your daily spelling practice! Let's learn some new words.",
              icon: '/favicon.ico'
            });
          }
          localStorage.setItem('lastNotifiedDate', todayStr);
        }
      }
    };

    // Check every minute
    const interval = setInterval(checkReminder, 60000);
    // Initial check
    checkReminder();

    return () => clearInterval(interval);
  }, [reminderTime, reminderEnabled]);

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
    if (pinInput === adminPin) {
      setIsAdminAuthenticated(true);
      setPinModalOpen(false);
      setPinInput('');
      setPinError('');
      setActiveTab('admin');
    } else {
      setPinError('Incorrect PIN');
    }
  };

  const handleAddCustomWordSubmit = (e: React.FormEvent) => {
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
      setCustomWords(prev => [...prev, ...newCustomWords]);
    }

    if (requiringConfirmation.length > 0) {
      setWordsToConfirm(requiringConfirmation);
      setConfirmModalOpen(true);
    } else {
      setBulkWords(Array.from({ length: 10 }, () => ({ word: '', meaning: '', example: '' })));
      if (duplicateCount > 0) {
        setAlertMessage(`${duplicateCount} word(s) were skipped because they are already in your custom dictionary.`);
      } else if (newCustomWords.length > 0) {
        setAlertMessage(`Successfully added ${newCustomWords.length} word(s).`);
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
      url: window.location.href,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        console.log('Share cancelled or failed:', error);
      }
    } else {
      // Fallback: copy link to clipboard
      try {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
        setAlertMessage('Link copied to clipboard! Share it with your friends.');
      } catch {
        setAlertMessage('Sharing is not supported on this device. Copy the URL from the address bar.');
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

  const handleSubscribe = () => {
    const options = {
      key: 'rzp_test_SYZJko9XAmhCGw',
      amount: 29900, // Amount is in currency subunits. Default currency is INR. Hence, 29900 refers to 29900 paise
      currency: 'INR',
      name: 'LexiQuest',
      description: 'Lifetime Premium Subscription',
      image: 'https://api.iconify.design/lucide:book.svg',
      handler: function (response: any) {
        // Payment successful
        if (response.razorpay_payment_id) {
          setIsPremium(true);
          localStorage.setItem('isPremium', 'true');
          setSubscriptionModalOpen(false);
          setAlertMessage('Congratulations! You are now a Premium member. Ads removed and all features unlocked.');
        }
      },
      prefill: {
        name: 'User',
        email: 'user@example.com',
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
          {user && (
            <button
              onClick={handleSignOut}
              className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Sign Out"
            >
              <LogIn className="w-5 h-5 rotate-180" />
            </button>
          )}
          <button
            onClick={handleShareApp}
            className="flex items-center gap-1 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors px-2.5 py-1.5 rounded-full border border-indigo-100"
            title="Share App"
          >
            <Share2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Share</span>
          </button>

          {/* Level & XP */}
          <div className="flex items-center gap-2 bg-purple-50 px-3 py-1.5 rounded-full border border-purple-100" title="Experience Level">
            <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
              L{level}
            </div>
            <div className="flex flex-col">
              <div className="w-16 h-1.5 bg-purple-200 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(xp / (level * 100 * level)) * 100}%` }}
                  className="h-full bg-purple-600"
                />
              </div>
              <span className="text-[8px] font-bold text-purple-600 self-end mt-0.5">{xp} XP</span>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-orange-50 px-2.5 py-1.5 rounded-full border border-orange-100" title="Daily Practice Streak">
            <Flame className={`w-3.5 h-3.5 ${streak > 0 ? 'text-orange-500' : 'text-gray-400'}`} />
            <span className={`text-sm font-bold ${streak > 0 ? 'text-orange-600' : 'text-gray-500'}`}>{streak}</span>
          </div>

          {/* Bell / Daily Reminder */}
          <div className="relative">
            <button
              ref={reminderBtnRef}
              onClick={() => { setDraftReminderTime(reminderTime); setReminderPopoverOpen(o => !o); }}
              className={`flex items-center gap-1 text-xs font-medium transition-colors px-2 py-1.5 rounded-lg ${reminderEnabled
                ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'
                }`}
              title="Daily Reminder"
            >
              <Bell className="w-4 h-4" />
            </button>

            {reminderPopoverOpen && (
              <div
                ref={reminderPopoverRef}
                className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 z-50"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  <p className="text-sm font-semibold text-gray-800">Daily Reminder</p>
                </div>
                <input
                  type="time"
                  value={draftReminderTime}
                  onChange={e => setDraftReminderTime(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 outline-none focus:border-indigo-400 mb-3"
                />
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-gray-600">
                    {reminderEnabled ? '🔔 Enabled (Daily)' : '🔕 Disabled'}
                  </span>
                  <button
                    onClick={toggleReminder}
                    className={`w-9 h-5 rounded-full relative transition-colors shadow-inner ${reminderEnabled ? 'bg-indigo-500' : 'bg-gray-300'
                      }`}
                    title={reminderEnabled ? 'Disable' : 'Enable'}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow ${reminderEnabled ? 'left-[18px]' : 'left-0.5'}`} />
                  </button>
                </div>
                <button
                  onClick={handleSaveReminder}
                  className="w-full py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  Save
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setSpeechSettingsOpen(true)}
            className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-indigo-600 transition-colors px-2 py-1.5 rounded-lg hover:bg-indigo-50"
            title="Speech Settings"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {!isAdminAuthenticated ? (
            <button
              onClick={() => setPinModalOpen(true)}
              className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors px-2 py-1.5 rounded-lg hover:bg-gray-100"
            >
              <Lock className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => {
                setIsAdminAuthenticated(false);
                if (activeTab === 'admin') setActiveTab('learn');
              }}
              className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-gray-800 transition-colors px-2 py-1.5 rounded-lg hover:bg-gray-100"
            >
              <Unlock className="w-3.5 h-3.5" />
            </button>
          )}
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

              {/* Daily Challenge Card */}
              {dailyWord && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-8 relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-[2rem] blur-xl opacity-20 group-hover:opacity-30 transition-opacity" />
                  <div className="relative bg-white border border-indigo-100 rounded-[2rem] p-6 shadow-xl flex flex-col md:flex-row items-center gap-6">
                    <div className="w-24 h-24 bg-indigo-600 rounded-3xl flex flex-col items-center justify-center text-white shadow-lg shadow-indigo-200 shrink-0">
                      <Clock className="w-8 h-8 mb-1" />
                      <span className="text-[10px] font-black uppercase tracking-tighter">DAILY</span>
                    </div>
                    <div className="flex-1 text-center md:text-left">
                      <div className="flex items-center gap-2 mb-1 justify-center md:justify-start">
                        <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest">Word of the Day</span>
                        {dailyWordsLearned >= 1 && <CheckCircle className="w-4 h-4 text-green-500" />}
                      </div>
                      <h3 className="text-2xl font-black text-gray-900 mb-2 capitalize">{dailyWord.word}</h3>
                      <p className="text-gray-600 text-sm mb-3 italic">"{dailyWord.meaning}"</p>
                      <div className="flex flex-wrap gap-2 justify-center md:justify-start mt-4">
                        <button 
                          onClick={() => playWord(dailyWord.word)}
                          className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-xs hover:bg-indigo-100 transition-colors"
                        >
                          <Volume2 className="w-4 h-4" /> Listen
                        </button>
                        <button 
                          onClick={() => {
                            if (dailyWordsLearned === 0) {
                              addXp(20);
                              setDailyWordsLearned(1);
                              localStorage.setItem('dailyWordsLearned', '1');
                              setAlertMessage('Great! You mastered the daily word. +20 XP');
                            }
                          }}
                          disabled={dailyWordsLearned >= 1}
                          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 transition-colors shadow-md disabled:bg-gray-400"
                        >
                          {dailyWordsLearned >= 1 ? 'Mastered!' : 'Mark as Mastered'}
                        </button>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 w-full md:w-64">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Example Sentence</p>
                      <p className="text-xs text-slate-700 leading-relaxed italic">{dailyWord.example}</p>
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
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
              </div>

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
                    <button
                      onClick={() => generateAIStory(testWords.slice(0, 5))}
                      disabled={isGeneratingStory}
                      className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-lg font-bold rounded-2xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg flex items-center justify-center gap-2 group"
                    >
                      {isGeneratingStory ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <PenTool className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                      )}
                      Generate Word Story
                    </button>
                  </div>
                </>
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
                  Manage your custom offline dictionary. Words added here will not be flagged as spelling errors.
                </p>
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
              <div className="relative h-48 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-8 pt-12 flex flex-col justify-end">
                <button
                  onClick={() => setSubscriptionModalOpen(false)}
                  className="absolute top-4 right-4 p-2 bg-black/10 hover:bg-black/20 text-white rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4">
                  <Star className="w-8 h-8 text-white fill-white" />
                </div>
                <h3 className="text-2xl font-bold text-white">LexiQuest Premium</h3>
              </div>

              <div className="p-8">
                <p className="text-gray-600 mb-6 font-medium">Unlock the full power of your vocabulary journey with exclusive features.</p>

                <div className="space-y-4 mb-8">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-green-50 rounded-full flex items-center justify-center shrink-0">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">No Advertisements</p>
                      <p className="text-sm text-gray-500">Enjoy a clean, distraction-free learning experience.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-purple-50 rounded-full flex items-center justify-center shrink-0">
                      <GraduationCap className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">Meaning & Context Tests</p>
                      <p className="text-sm text-gray-500">Master usage with advanced fill-in-the-blank challenges.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center shrink-0">
                      <BookOpen className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">Advanced Dictionary</p>
                      <p className="text-sm text-gray-500">Access synonyms, antonyms, and detailed word data.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-orange-50 rounded-full flex items-center justify-center shrink-0">
                      <Plus className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">Unlimited Custom Words</p>
                      <p className="text-sm text-gray-500">Add as many words as you need to your offline database.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-2xl p-5 mb-8 border border-gray-100 italic">
                  <p className="text-center text-gray-500 text-sm">"One-time payment for lifetime access to all future updates."</p>
                </div>

                <button
                  onClick={handleSubscribe}
                  className="w-full py-4 bg-gray-900 text-white font-bold text-lg rounded-2xl hover:bg-gray-800 shadow-lg hover:shadow-xl transition-all active:scale-95"
                >
                  Pay ₹299 (Lifetime Access)
                </button>
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

      {/* AI Story Modal */}
      <AnimatePresence>
        {storyModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl border border-indigo-100 relative overflow-hidden"
            >
               <div className="absolute top-0 right-0 p-4">
                <button onClick={() => setStoryModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white">
                  <PenTool className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">AI Word Story</h3>
                  <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">Powered by Gemini</p>
                </div>
              </div>
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 mb-6">
                <p className="text-slate-800 leading-relaxed font-serif italic text-lg whitespace-pre-wrap">"{aiStory}"</p>
              </div>
              <button 
                onClick={() => setStoryModalOpen(false)}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 active:scale-95"
              >
                Amazing!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      </main>
    </div>
  );
}

