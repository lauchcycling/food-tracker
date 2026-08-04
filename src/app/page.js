"use client";

import React, { useState, useRef, useEffect } from 'react';
import { 
  Home, BarChart2, PlusCircle, Camera, ChevronLeft, 
  Flame, Droplets, Beef, Utensils, AlertCircle, Edit2, Check,
  Search, Plus, X, Sparkles, Coffee, Sun, Moon, Apple, Settings, Target, Activity, User, Loader2, Trash2
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

let app, auth, db;
if (firebaseConfig.apiKey) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

const getBasePath = (uid) => {
  return `users/${uid}`; 
};

const compressImage = (file, maxWidth = 800, quality = 0.7) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
    };
  });
};

const MEAL_TYPES = ['Frühstück', 'Mittagessen', 'Abendessen', 'Snack'];

const INITIAL_LOGS = [
  { id: 1, type: 'Frühstück', name: 'Haferbrei mit Beeren (150g)', calories: 450, macros: { p: 15, c: 70, f: 10 }, time: '07:30' },
  { id: 2, type: 'Snack', name: 'Banane & Espresso (120g)', calories: 120, macros: { p: 1, c: 27, f: 0 }, time: '10:15' },
];

const WEEKLY_DATA = [
  { day: 'Mo', cals: 2750 }, { day: 'Di', cals: 2820 }, { day: 'Mi', cals: 3100 }, 
  { day: 'Do', cals: 2600 }, { day: 'Fr', cals: 2900 }, { day: 'Sa', cals: 3500 }, { day: 'So', cals: 1850 }
];

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [logs, setLogs] = useState([]);
  const [user, setUser] = useState(null);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('food_tracker_theme');
      if (savedTheme) return savedTheme === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('food_tracker_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('food_tracker_theme', 'light');
    }
  }, [isDarkMode]);
  
  useEffect(() => {
    if (!auth) {
      setLogs(INITIAL_LOGS);
      return;
    }

    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;

    const logsRef = collection(db, getBasePath(user.uid), 'food_logs');
    const unsubLogs = onSnapshot(logsRef, (snapshot) => {
      const loadedLogs = [];
      snapshot.forEach(d => loadedLogs.push(d.data()));
      loadedLogs.sort((a, b) => a.id - b.id);
      setLogs(loadedLogs);
    }, (error) => console.error("Sync Error Logs:", error));

    const profileRef = collection(db, getBasePath(user.uid), 'profiles');
    const unsubProfile = onSnapshot(profileRef, (snapshot) => {
      let loadedProfile = null;
      snapshot.forEach(d => {
        if (d.id === 'default') loadedProfile = d.data();
      });
      if (loadedProfile) {
        setProfile(loadedProfile);
        setShowOnboarding(false);
      }
    }, (error) => console.error("Sync Error Profile:", error));

    return () => { unsubLogs(); unsubProfile(); };
  }, [user]);
  
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('food_tracker_onboarded') !== 'true';
    }
    return true;
  });

  const [profile, setProfile] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedProfile = localStorage.getItem('food_tracker_profile');
      if (savedProfile) {
        try { return JSON.parse(savedProfile); } catch (e) {}
      }
    }
    return {
      gender: 'male',
      age: 30,
      height: 180,
      weight: 75,
      activity: 1.55,
      goal: 0 
    };
  });

  const goals = React.useMemo(() => {
    let bmr = (10 * profile.weight) + (6.25 * profile.height) - (5 * profile.age);
    bmr += profile.gender === 'male' ? 5 : -161;
    
    const tdee = bmr * profile.activity;
    const targetCals = tdee + profile.goal;

    return {
      calories: Math.round(targetCals),
      protein: Math.round((targetCals * 0.3) / 4), 
      carbs: Math.round((targetCals * 0.4) / 4), 
      fat: Math.round((targetCals * 0.3) / 9) 
    };
  }, [profile]);

  const [selectedMeal, setSelectedMeal] = useState('Mittagessen');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [stagedItems, setStagedItems] = useState([]);
  const [suggestions, setSuggestions] = useState([]);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const newSuggestions = [];
    const stagedNames = stagedItems.map(i => i.name.toLowerCase());
    
    if (stagedNames.some(n => n.includes('hafer')) && !stagedNames.some(n => n.includes('hafermilch'))) {
      newSuggestions.push({ name: 'Hafermilch', per100g: { calories: 45, p: 1, c: 6, f: 1.5 }, amount: 200 });
      newSuggestions.push({ name: 'Blaubeeren', per100g: { calories: 56, p: 0.7, c: 14, f: 0.3 }, amount: 50 });
    }
    if (stagedNames.some(n => n.includes('nudeln') || n.includes('pasta')) && !stagedNames.some(n => n.includes('parmesan'))) {
      newSuggestions.push({ name: 'Parmesan', per100g: { calories: 400, p: 35, c: 0, f: 30 }, amount: 20 });
    }
    
    setSuggestions(newSuggestions);
  }, [stagedItems]);

  useEffect(() => {
    const searchFood = async () => {
      if (searchQuery.length < 3) {
        setSearchResults([]);
        return;
      }
      
      setIsSearching(true);
      try {
        const res = await fetch(`https://de.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(searchQuery)}&search_simple=1&action=process&json=1&page_size=8`);
        const data = await res.json();
        
        if (data.products) {
          const mappedResults = data.products
            .filter(p => p.product_name && p.nutriments && p.nutriments['energy-kcal_100g']) 
            .map(p => ({
              id: p._id,
              name: p.product_name,
              brand: p.brands ? p.brands.split(',')[0] : 'Generisch',
              per100g: {
                calories: Math.round(p.nutriments['energy-kcal_100g'] || 0),
                p: Math.round(p.nutriments.proteins_100g || 0),
                c: Math.round(p.nutriments.carbohydrates_100g || 0),
                f: Math.round(p.nutriments.fat_100g || 0)
              },
              amount: 100 
            }));
          setSearchResults(mappedResults);
        }
      } catch (err) {
        console.error("Fehler bei der API Suche:", err);
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(searchFood, 500);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const consumed = logs.reduce((acc, log) => ({
    cals: acc.cals + log.calories,
    p: acc.p + log.macros.p,
    c: acc.c + log.macros.c,
    f: acc.f + log.macros.f,
  }), { cals: 0, p: 0, c: 0, f: 0 });

  const remainingCals = goals.calories - consumed.cals;
  const calPercent = Math.min(100, (consumed.cals / goals.calories) * 100);

  const getItemCalories = (item) => Math.round((item.per100g.calories * item.amount) / 100);
  const getItemMacros = (item) => ({
    p: Math.round((item.per100g.p * item.amount) / 100),
    c: Math.round((item.per100g.c * item.amount) / 100),
    f: Math.round((item.per100g.f * item.amount) / 100),
  });

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsAnalyzing(true);
    const compressedBase64 = await compressImage(file, 800, 0.7);
    setPreviewImage(compressedBase64);

    setTimeout(() => {
      setStagedItems(prev => [...prev, {
        name: 'Pasta mit Hähnchen',
        per100g: { calories: 160, p: 12, c: 20, f: 3.5 },
        amount: 400
      }]);
      setIsAnalyzing(false);
      setPreviewImage(null);
      setSearchQuery('');
    }, 2000);
  };

  const addStagedItem = (item) => {
    const newItem = {
      ...item,
      amount: item.amount || 100,
      per100g: item.per100g || {
        calories: item.calories || 0,
        p: item.macros?.p || 0,
        c: item.macros?.c || 0,
        f: item.macros?.f || 0
      }
    };
    setStagedItems([...stagedItems, newItem]);
    setSearchQuery('');
  };

  const removeStagedItem = (index) => {
    setStagedItems(stagedItems.filter((_, i) => i !== index));
  };

  const handleSaveStagedItems = async () => {
    const newLogs = stagedItems.map((item, idx) => ({
      id: Date.now() + idx,
      type: selectedMeal,
      name: `${item.name} (${item.amount}g)`,
      calories: getItemCalories(item),
      macros: getItemMacros(item),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }));
    
    setLogs([...logs, ...newLogs]);

    if (user && db) {
      for (const log of newLogs) {
        await setDoc(doc(db, getBasePath(user.uid), 'food_logs', log.id.toString()), log);
      }
    }
    
    setStagedItems([]);
    setSearchQuery('');
    setCurrentView('dashboard');
  };

  const handleDeleteLog = async (logId) => {
    setLogs(logs.filter(l => l.id !== logId));

    if (user && db) {
      try {
        await deleteDoc(doc(db, getBasePath(user.uid), 'food_logs', logId.toString()));
      } catch (err) {
        console.error("Fehler beim Löschen aus der Cloud:", err);
      }
    }
  };

  const handleSaveProfile = async () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('food_tracker_onboarded', 'true');
      localStorage.setItem('food_tracker_profile', JSON.stringify(profile));
    }

    if (user && db) {
      try {
        await setDoc(doc(db, getBasePath(user.uid), 'profiles', 'default'), profile);
      } catch (err) {
        console.error("Cloud Profile Save Error:", err);
      }
    }
    setShowOnboarding(false);
    setCurrentView('dashboard');
  };

  const getMealIcon = (meal) => {
    switch(meal) {
      case 'Frühstück': return <Coffee size={18} />;
      case 'Mittagessen': return <Sun size={18} />;
      case 'Abendessen': return <Moon size={18} />;
      case 'Snack': return <Apple size={18} />;
      default: return <Utensils size={18} />;
    }
  };

  const renderDashboard = () => (
    <div className="p-4 space-y-6 pb-24 animate-in fade-in">
      <div className="flex justify-between items-center px-2">
        <h1 className="text-2xl font-black text-slate-800 dark:text-white transition-colors">Hallo! 👋</h1>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)} 
            className="p-2 bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300 transition-colors"
            title="Design wechseln"
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button onClick={() => setCurrentView('settings')} className="p-2 bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300 transition-colors">
            <Settings size={20} />
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
        <h2 className="text-slate-500 dark:text-slate-400 font-medium mb-4">Dein Tagesziel</h2>
        <div className="flex justify-between items-end mb-4">
          <div>
            <span className="text-5xl font-black tracking-tighter text-slate-800 dark:text-white">{consumed.cals}</span>
            <span className="text-slate-400 dark:text-slate-500 font-medium ml-2">/ {goals.calories} kcal</span>
          </div>
          <div className="text-right">
            <span className={`text-xl font-bold ${remainingCals < 0 ? 'text-red-500 dark:text-red-400' : 'text-fuchsia-500 dark:text-fuchsia-400'}`}>
              {remainingCals > 0 ? `${remainingCals} übrig` : `${Math.abs(remainingCals)} drüber`}
            </span>
          </div>
        </div>
        
        <div className="h-4 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-1000 ${calPercent > 100 ? 'bg-red-500' : 'bg-fuchsia-500'}`} 
            style={{ width: `${calPercent}%` }}
          />
        </div>

        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-slate-700">
          <MacroBar label="Protein" current={consumed.p} target={goals.protein} color="bg-rose-500" icon={<Beef size={14}/>} />
          <MacroBar label="Carbs" current={consumed.c} target={goals.carbs} color="bg-blue-500" icon={<Flame size={14}/>} />
          <MacroBar label="Fett" current={consumed.f} target={goals.fat} color="bg-amber-500" icon={<Droplets size={14}/>} />
        </div>
      </div>

      <div className="space-y-4">
        {MEAL_TYPES.map(meal => {
          const mealLogs = logs.filter(l => l.type === meal);
          const mealCals = mealLogs.reduce((sum, l) => sum + l.calories, 0);
          
          if (mealLogs.length === 0) {
            return (
              <div 
                key={meal} 
                onClick={() => { setSelectedMeal(meal); setCurrentView('add'); }}
                className="bg-white dark:bg-slate-800 px-4 py-3.5 rounded-2xl border-2 border-slate-100 dark:border-slate-700 border-dashed flex justify-between items-center cursor-pointer hover:border-fuchsia-300 dark:hover:border-fuchsia-500 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-900/20 transition-all group shadow-sm"
              >
                <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2 group-hover:text-fuchsia-700 dark:group-hover:text-fuchsia-300">
                  <span className="text-slate-400 dark:text-slate-500 group-hover:text-fuchsia-500">{getMealIcon(meal)}</span>
                  {meal}
                </h3>
                <div className="flex items-center gap-1.5 text-fuchsia-600 dark:text-fuchsia-400 text-sm font-bold bg-fuchsia-50 dark:bg-fuchsia-900/30 px-3 py-1.5 rounded-full group-hover:bg-fuchsia-100 dark:group-hover:bg-fuchsia-900/50 transition-colors">
                  <Plus size={14} strokeWidth={3} />
                  <span>Hinzufügen</span>
                </div>
              </div>
            );
          }

          return (
            <div key={meal} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <span className="p-2 bg-slate-50 dark:bg-slate-700 rounded-lg text-fuchsia-600 dark:text-fuchsia-400 transition-colors">{getMealIcon(meal)}</span>
                  {meal}
                </h3>
                <span className="font-black text-slate-400 dark:text-slate-500">{mealCals} kcal</span>
              </div>
              
              <div className="space-y-3">
                {mealLogs.map(log => (
                  <div key={log.id} className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-700 last:border-0 transition-colors group">
                    <div>
                      <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">{log.name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        {log.macros.p}g P / {log.macros.c}g C / {log.macros.f}g F
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-700 dark:text-slate-300">{log.calories} <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">kcal</span></span>
                      <button 
                        onClick={() => handleDeleteLog(log.id)}
                        className="text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 p-1.5 rounded-lg transition-colors"
                        title="Eintrag löschen"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              <button 
                 onClick={() => { setSelectedMeal(meal); setCurrentView('add'); }}
                 className="w-full mt-3 py-2.5 flex items-center justify-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-fuchsia-600 dark:hover:text-fuchsia-400 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-900/20 rounded-xl transition-colors border border-transparent hover:border-fuchsia-100 dark:hover:border-fuchsia-800"
              >
                <Plus size={14} />
                Mehr zu {meal} hinzufügen
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderAddFood = () => (
    <div className="h-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 animate-in slide-in-from-bottom-8 flex flex-col min-h-screen transition-colors">
      <div className="p-4 bg-white dark:bg-slate-800 flex items-center justify-between border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 shadow-sm transition-colors">
        <button onClick={() => setCurrentView('dashboard')} className="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full text-slate-600 dark:text-slate-300 transition-colors">
          <ChevronLeft size={20} />
        </button>
        <h2 className="font-bold text-lg">Essen tracken</h2>
        <div className="w-10"></div>
      </div>

      <div className="p-4 flex-1">
        <div className="flex overflow-x-auto gap-2 pb-2 mb-4 hide-scrollbar">
          {MEAL_TYPES.map(m => (
             <button 
               key={m} 
               onClick={() => setSelectedMeal(m)} 
               className={`px-5 py-2.5 rounded-full whitespace-nowrap font-bold text-sm transition-all flex items-center gap-2
                 ${selectedMeal === m ? 'bg-fuchsia-500 text-white shadow-md shadow-fuchsia-500/20' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
             >
               {getMealIcon(m)} {m}
             </button>
          ))}
        </div>

        <div className="relative flex items-center group">
           <Search className="absolute left-4 text-slate-400 dark:text-slate-500 group-focus-within:text-fuchsia-500 transition-colors" size={20} />
           <input 
             type="text" 
             placeholder="Lebensmittel suchen (z.B. Hanuta)..." 
             className="w-full pl-12 pr-14 py-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm focus:ring-2 focus:ring-fuchsia-500 outline-none text-slate-800 dark:text-slate-100 font-medium placeholder:font-normal transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500" 
             value={searchQuery} 
             onChange={(e) => setSearchQuery(e.target.value)} 
           />
           
           <input 
              type="file" 
              accept="image/*" 
              capture="environment"
              className="hidden" 
              ref={fileInputRef} 
              onChange={handlePhotoUpload} 
            />
           <button 
             onClick={() => fileInputRef.current.click()} 
             className="absolute right-2 p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-fuchsia-100 dark:hover:bg-fuchsia-900/50 hover:text-fuchsia-600 dark:hover:text-fuchsia-400 rounded-xl transition-colors"
             title="KI Foto-Scan"
           >
             <Camera size={20} />
           </button>
        </div>

        {isAnalyzing && (
          <div className="mt-8 text-center space-y-4 animate-in fade-in">
            <div className="w-12 h-12 border-4 border-fuchsia-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="font-medium animate-pulse text-fuchsia-600 dark:text-fuchsia-400">Gemini analysiert Foto...</p>
          </div>
        )}

        {searchQuery.length >= 3 && !isAnalyzing && (
           <div className="mt-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-top-2 transition-colors">
             {isSearching ? (
               <div className="p-6 text-center text-slate-500 dark:text-slate-400 flex justify-center items-center gap-2">
                 <Loader2 className="animate-spin" size={20} /> Suche in globaler Datenbank...
               </div>
             ) : searchResults.length > 0 ? (
               <div className="max-h-64 overflow-y-auto">
                 {searchResults.map((item, idx) => (
                   <button 
                     key={item.id || idx} 
                     onClick={() => addStagedItem(item)} 
                     className="w-full p-4 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-b border-slate-50 dark:border-slate-700 last:border-0"
                   >
                      <div className="text-left pr-4">
                        <p className="font-bold text-slate-800 dark:text-slate-200 line-clamp-1">{item.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {item.brand} • {item.per100g.calories} kcal / 100g
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <PlusCircle className="text-fuchsia-500" size={24} />
                      </div>
                   </button>
                 ))}
               </div>
             ) : (
               <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-sm">
                 Keine Lebensmittel für "{searchQuery}" gefunden.
               </div>
             )}
           </div>
        )}

        {stagedItems.length > 0 && suggestions.length > 0 && !isAnalyzing && (
           <div className="mt-8 bg-gradient-to-br from-fuchsia-50 to-purple-50 dark:from-fuchsia-900/20 dark:to-purple-900/20 border border-fuchsia-100 dark:border-fuchsia-800 rounded-2xl p-5 relative overflow-hidden animate-in fade-in transition-colors">
             <div className="absolute -top-4 -right-4 p-2 opacity-10"><Sparkles size={80} className="text-fuchsia-600 dark:text-fuchsia-400" /></div>
             <h4 className="text-sm font-bold text-fuchsia-900 dark:text-fuchsia-200 mb-3 flex items-center gap-1.5 z-10 relative">
               <Sparkles size={16} className="text-fuchsia-500 dark:text-fuchsia-400"/> Oft zusammen gegessen
             </h4>
             <div className="flex gap-3 overflow-x-auto hide-scrollbar relative z-10 pb-2">
               {suggestions.map((sug, idx) => (
                 <button 
                   key={idx} 
                   onClick={() => addStagedItem(sug)} 
                   className="flex-shrink-0 flex items-center gap-3 bg-white dark:bg-slate-800 pl-4 pr-3 py-3 rounded-xl shadow-sm border border-fuchsia-100 dark:border-fuchsia-800 hover:border-fuchsia-300 dark:hover:border-fuchsia-500 hover:shadow-md transition-all group"
                 >
                   <div className="text-left">
                     <p className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-fuchsia-700 dark:group-hover:text-fuchsia-400">{sug.name}</p>
                     <p className="text-xs text-slate-500 dark:text-slate-400">{Math.round((sug.per100g.calories * sug.amount) / 100)} kcal ({sug.amount}g)</p>
                   </div>
                   <div className="p-1.5 bg-fuchsia-50 dark:bg-fuchsia-900/30 rounded-lg group-hover:bg-fuchsia-100 dark:group-hover:bg-fuchsia-900/50">
                     <Plus size={16} className="text-fuchsia-600 dark:text-fuchsia-400" />
                   </div>
                 </button>
               ))}
             </div>
           </div>
        )}

        {stagedItems.length > 0 && !isAnalyzing && (
           <div className="mt-8 animate-in slide-in-from-bottom-4">
             <div className="flex justify-between items-end mb-3">
               <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                 {getMealIcon(selectedMeal)} Ausgewählt für {selectedMeal}
               </h4>
             </div>
             
             <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden mb-6 transition-colors">
               {stagedItems.map((item, idx) => {
                 const currentCals = getItemCalories(item);
                 const currentMacros = getItemMacros(item);
                 return (
                   <div key={idx} className="p-4 border-b border-slate-100 dark:border-slate-700 last:border-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-slate-800 group transition-colors">
                     <div className="flex-1">
                       <p className="font-bold text-slate-800 dark:text-slate-200">{item.name}</p>
                       <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                         {currentMacros.p}g P / {currentMacros.c}g C / {currentMacros.f}g F
                       </p>
                     </div>
                     <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                       <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-600">
                         <input 
                           type="number" 
                           min="1" 
                           value={item.amount} 
                           onChange={(e) => {
                             const val = Math.max(1, Number(e.target.value));
                             setStagedItems(stagedItems.map((it, i) => i === idx ? {...it, amount: val} : it));
                           }}
                           className="w-14 bg-transparent font-bold text-slate-800 dark:text-slate-100 outline-none text-right"
                         />
                         <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">g</span>
                       </div>
                       <div className="text-right min-w-[70px]">
                         <span className="font-black text-slate-700 dark:text-slate-300">{currentCals}</span>
                         <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500 block">kcal</span>
                       </div>
                       <button 
                         onClick={() => removeStagedItem(idx)} 
                         className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                       >
                         <X size={18}/>
                       </button>
                     </div>
                   </div>
                 );
               })}
               
               <div className="bg-slate-50 dark:bg-slate-700/50 p-4 flex justify-between items-center border-t border-slate-200 dark:border-slate-700 transition-colors">
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Summe</span>
                  <span className="font-black text-fuchsia-600 dark:text-fuchsia-400 text-lg">
                    {stagedItems.reduce((acc, i) => acc + getItemCalories(i), 0)} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">kcal</span>
                  </span>
               </div>
             </div>
             
             <button 
               onClick={handleSaveStagedItems} 
               className="w-full bg-fuchsia-500 hover:bg-fuchsia-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-fuchsia-500/30 transition-colors flex items-center justify-center gap-2"
             >
               <Check size={20} />
               {stagedItems.length} Element{stagedItems.length > 1 ? 'e' : ''} speichern
             </button>
           </div>
        )}
        
        {stagedItems.length === 0 && searchQuery === '' && !isAnalyzing && (
          <div className="mt-12 text-center text-slate-400 dark:text-slate-500">
            <div className="bg-slate-100 dark:bg-slate-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors">
              <Search size={24} className="text-slate-300 dark:text-slate-600" />
            </div>
            <p className="text-sm">Suche nach Lebensmitteln (z.B. Hanuta)<br/>und passe die Gramm-Menge an.</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderSettings = () => {
    const handleProfileChange = (e) => {
      const { name, value } = e.target;
      setProfile(prev => ({ ...prev, [name]: name === 'gender' ? value : Number(value) }));
    };

    return (
      <div className="h-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 animate-in slide-in-from-bottom-8 flex flex-col min-h-screen transition-colors">
        <div className="p-4 bg-white dark:bg-slate-800 flex items-center justify-between border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 shadow-sm transition-colors">
          {!showOnboarding ? (
            <button onClick={() => setCurrentView('dashboard')} className="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full text-slate-600 dark:text-slate-300 transition-colors">
              <ChevronLeft size={20} />
            </button>
          ) : <div className="w-10"></div>}
          <h2 className="font-bold text-lg">{showOnboarding ? 'Willkommen beim Food Tracker' : 'Profil & Ziele'}</h2>
          
          {!showOnboarding ? (
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full text-slate-600 dark:text-slate-300 transition-colors">
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          ) : <div className="w-10"></div>}
        </div>

        <div className="p-6 flex-1 space-y-6 pb-24 overflow-y-auto">
          {showOnboarding && (
            <div className="text-center space-y-2 mb-8 animate-in fade-in zoom-in-95">
              <div className="w-16 h-16 bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-600 dark:text-fuchsia-400 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm transition-colors">
                <Target size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Lass uns deine Ziele berechnen!</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Gib deine Daten ein, damit wir deinen exakten Kalorienbedarf ermitteln können.</p>
            </div>
          )}

          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-6 transition-colors">
            <div>
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-2"><User size={16}/> Geschlecht</label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setProfile({...profile, gender: 'male'})} className={`py-3 rounded-xl font-bold text-sm border transition-colors ${profile.gender === 'male' ? 'bg-fuchsia-50 dark:bg-fuchsia-900/20 border-fuchsia-500 text-fuchsia-700 dark:text-fuchsia-400 shadow-inner' : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'}`}>Männlich</button>
                <button onClick={() => setProfile({...profile, gender: 'female'})} className={`py-3 rounded-xl font-bold text-sm border transition-colors ${profile.gender === 'female' ? 'bg-fuchsia-50 dark:bg-fuchsia-900/20 border-fuchsia-500 text-fuchsia-700 dark:text-fuchsia-400 shadow-inner' : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'}`}>Weiblich</button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Alter</label>
                <input type="number" name="age" value={profile.age} onChange={handleProfileChange} className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 p-3 rounded-xl font-bold text-slate-800 dark:text-slate-100 text-center focus:ring-2 focus:ring-fuchsia-500 outline-none transition-colors" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Gewicht (kg)</label>
                <input type="number" name="weight" value={profile.weight} onChange={handleProfileChange} className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 p-3 rounded-xl font-bold text-slate-800 dark:text-slate-100 text-center focus:ring-2 focus:ring-fuchsia-500 outline-none transition-colors" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Größe (cm)</label>
                <input type="number" name="height" value={profile.height} onChange={handleProfileChange} className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 p-3 rounded-xl font-bold text-slate-800 dark:text-slate-100 text-center focus:ring-2 focus:ring-fuchsia-500 outline-none transition-colors" />
              </div>
            </div>

            <div className="pt-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-2"><Activity size={16}/> Aktivitätslevel</label>
              <select name="activity" value={profile.activity} onChange={handleProfileChange} className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 p-3.5 rounded-xl font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-fuchsia-500 transition-colors">
                <option value={1.2}>Wenig (Bürojob, kein Sport)</option>
                <option value={1.375}>Leicht (1-3x Sport/Woche)</option>
                <option value={1.55}>Moderat (3-5x Sport/Woche)</option>
                <option value={1.725}>Aktiv (6-7x Sport/Woche)</option>
                <option value={1.9}>Sehr Aktiv (Körperlicher Job + Sport)</option>
              </select>
            </div>

            <div className="pt-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-2"><Target size={16}/> Dein Ziel</label>
              <select name="goal" value={profile.goal} onChange={handleProfileChange} className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 p-3.5 rounded-xl font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-fuchsia-500 transition-colors">
                <option value={-500}>Abnehmen (-500 kcal)</option>
                <option value={0}>Gewicht halten</option>
                <option value={500}>Muskelaufbau (+500 kcal)</option>
              </select>
            </div>
          </div>

          <div className="bg-fuchsia-50 dark:bg-fuchsia-900/20 p-5 rounded-2xl border border-fuchsia-100 dark:border-fuchsia-800 flex justify-between items-center shadow-sm transition-colors">
            <div>
              <p className="text-fuchsia-800 dark:text-fuchsia-300 font-bold text-sm">Dein Tagesbedarf</p>
              <p className="text-xs text-fuchsia-600 dark:text-fuchsia-500 mt-0.5">Mifflin-St. Jeor Formel</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-fuchsia-600 dark:text-fuchsia-400">{goals.calories}</span>
              <span className="text-fuchsia-700/70 dark:text-fuchsia-400/70 font-medium ml-1 text-sm">kcal</span>
            </div>
          </div>

          <button 
            onClick={handleSaveProfile} 
            className="w-full bg-fuchsia-500 hover:bg-fuchsia-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-fuchsia-500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Check size={20} />
            {showOnboarding ? 'Loslegen!' : 'Änderungen speichern'}
          </button>
        </div>
      </div>
    );
  };

  const renderWeekly = () => (
    <div className="p-4 space-y-6 pb-24 animate-in fade-in">
      <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-6 transition-colors">Wochenrückblick</h2>
      
      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
        <div className="flex items-end justify-between h-48 mb-4 gap-2">
          {WEEKLY_DATA.map((data, i) => {
            const heightPercent = (data.cals / 4000) * 100;
            const isOver = data.cals > goals.calories;
            
            return (
              <div key={i} className="flex flex-col items-center flex-1 group">
                <div className="w-full relative h-full flex items-end justify-center">
                  <div className="absolute w-full border-t border-dashed border-slate-300 dark:border-slate-600 z-0" style={{ bottom: `${(goals.calories / 4000) * 100}%` }}></div>
                  
                  <div className="absolute -top-8 bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 font-bold shadow-md">
                    {data.cals}
                  </div>

                  <div 
                    className={`w-full rounded-t-lg z-10 transition-all duration-500 ${isOver ? 'bg-amber-400 dark:bg-amber-500' : 'bg-fuchsia-500 dark:bg-fuchsia-400'}`}
                    style={{ height: `${heightPercent}%` }}
                  ></div>
                </div>
                <span className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-2">{data.day}</span>
              </div>
            )
          })}
        </div>
        
        <div className="flex justify-between text-sm pt-4 border-t border-slate-100 dark:border-slate-700 transition-colors">
          <div className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <div className="w-3 h-3 bg-fuchsia-500 dark:bg-fuchsia-400 rounded-full"></div> Im Ziel
          </div>
          <div className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <div className="w-3 h-3 bg-amber-400 dark:bg-amber-500 rounded-full"></div> Überschritten
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 dark:bg-slate-950 font-sans relative overflow-hidden text-slate-900 dark:text-slate-100 shadow-2xl transition-colors">
      {currentView === 'dashboard' && !showOnboarding && renderDashboard()}
      {currentView === 'add' && !showOnboarding && renderAddFood()}
      {currentView === 'weekly' && !showOnboarding && renderWeekly()}
      {showOnboarding && renderSettings()}
      {currentView === 'settings' && !showOnboarding && renderSettings()}

      {currentView !== 'add' && currentView !== 'settings' && !showOnboarding && (
        <div className="absolute bottom-0 w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 py-4 pb-8 flex justify-between items-center z-50 transition-colors">
          <button 
            onClick={() => setCurrentView('dashboard')}
            className={`flex flex-col items-center gap-1 transition-colors ${currentView === 'dashboard' ? 'text-fuchsia-600 dark:text-fuchsia-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
          >
            <Home size={24} />
            <span className="text-[10px] font-bold">Heute</span>
          </button>
          
          <button 
            onClick={() => { setSelectedMeal('Mittagessen'); setCurrentView('add'); }}
            className="bg-fuchsia-500 text-white p-4 rounded-full shadow-lg shadow-fuchsia-500/30 transform -translate-y-4 hover:scale-105 transition-transform"
          >
            <PlusCircle size={28} />
          </button>
          
          <button 
            onClick={() => setCurrentView('weekly')}
            className={`flex flex-col items-center gap-1 transition-colors ${currentView === 'weekly' ? 'text-fuchsia-600 dark:text-fuchsia-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
          >
            <BarChart2 size={24} />
            <span className="text-[10px] font-bold">Woche</span>
          </button>
        </div>
      )}
    </div>
  );
}

function MacroBar({ label, current, target, color, icon }) {
  const percent = Math.min(100, (current / target) * 100);
  return (
    <div>
      <div className="flex justify-between items-end mb-1 text-xs">
        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">{icon} {label}</span>
        <span className="font-bold text-slate-800 dark:text-slate-200">{current} <span className="text-slate-400 dark:text-slate-500 font-normal">/ {target}g</span></span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden transition-colors">
        <div className={`h-full ${color}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}