/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings, 
  Gamepad2, 
  Users, 
  ShieldCheck, 
  LayoutDashboard, 
  MessageSquare, 
  Save,
  ChevronRight,
  Search,
  Bell,
  Menu,
  X,
  Github,
  Terminal,
  Activity,
  Cpu,
  Globe
} from 'lucide-react';

interface GameSetting {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: string;
}

const INITIAL_GAMES: GameSetting[] = [
  { id: 'imposter', name: 'Imposter', description: 'لعبة المحقق والمجرم - ابحث عن الجاني', enabled: true, category: 'Logic' },
  { id: 'scramble', name: 'Scramble', description: 'ترتيب الكلمات المبعثرة بسرعة', enabled: true, category: 'Speed' },
  { id: 'roulette', name: 'Roulette', description: 'لعبة الروليت - مخاطرة ومكافأة', enabled: true, category: 'Chance' },
  { id: 'hotxo', name: 'HotXO', description: 'لعبة إكس أو سريعة الوتيرة', enabled: true, category: 'Strategy' },
  { id: 'search', name: 'Search', description: 'البحث عن كلمات أو أشياء محددة', enabled: true, category: 'Logic' },
  { id: 'vote', name: 'Vote Game', description: 'تحديات تصويت جماعية', enabled: true, category: 'Social' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'games' | 'permissions' | 'appearance'>('overview');
  const [games, setGames] = useState<GameSetting[]>(INITIAL_GAMES);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [prefix, setPrefix] = useState('$');
  const [repoStatus, setRepoStatus] = useState('Connected to hisaki22/nova-games-bot');

  const navItems = [
    { id: 'overview', name: 'نظرة عامة', icon: LayoutDashboard },
    { id: 'games', name: 'الألعاب المتاحة', icon: Gamepad2 },
    { id: 'permissions', name: 'الصلاحيات', icon: ShieldCheck },
    { id: 'appearance', name: 'الواجهة والرسائل', icon: MessageSquare },
  ];

  const handleToggleGame = (id: string) => {
    setGames(prev => prev.map(g => g.id === id ? { ...g, enabled: !g.enabled } : g));
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => setIsSaving(false), 1500);
  };

  const handleGitHubPush = async () => {
    setIsPushing(true);
    try {
      const response = await fetch('/api/github/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: 'hisaki22',
          repo: 'nova-games-bot',
          message: 'Update Nova Dashboard UI'
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to push');
      
      alert('✅ تم رفع لوحة التحكم بنجاح إلى GitHub!');
    } catch (err: any) {
      alert(`❌ خطأ: ${err.message}`);
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050507] text-slate-200 font-sans flex overflow-hidden">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[0%] -right-[10%] w-[35%] h-[35%] bg-purple-500/5 rounded-full blur-[120px]" />
      </div>

      {/* Sidebar */}
      <aside 
        className={`${
          isSidebarOpen ? 'w-64' : 'w-20'
        } shrink-0 bg-[#0c0c10] border-r border-white/5 transition-all duration-300 flex flex-col z-20 relative`}
      >
        <div className="p-6 flex items-center gap-3 h-24 border-b border-white/5">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-600/20">
            <Settings className="w-6 h-6 text-white" />
          </div>
          {isSidebarOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col">
              <span className="font-bold text-lg tracking-tight leading-none mb-1">Nova Panel</span>
              <span className="text-[10px] text-emerald-500 font-bold tracking-widest uppercase">Admin Mode</span>
            </motion.div>
          )}
        </div>

        <nav className="flex-grow px-3 py-6 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`w-full flex items-center gap-3 px-3 py-3.5 rounded-xl transition-all relative group ${
                activeTab === item.id 
                  ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/10 shadow-inner shadow-black/20' 
                  : 'text-slate-500 hover:bg-white/[0.02] hover:text-slate-300'
              }`}
            >
              <item.icon className={`w-5 h-5 shrink-0 ${activeTab === item.id ? 'text-indigo-400' : 'group-hover:text-slate-300'}`} />
              {isSidebarOpen && <span className="text-sm font-medium">{item.name}</span>}
              {activeTab === item.id && (
                <motion.div layoutId="nav-glow" className="absolute left-0 w-1 h-6 bg-indigo-500 rounded-full" />
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 bg-black/20 m-3 rounded-2xl border border-white/5">
          {isSidebarOpen ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                <span>System Health</span>
                <span className="text-emerald-500">99.9%</span>
              </div>
              <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 w-[99.9%]" />
              </div>
            </div>
          ) : (
            <Activity className="w-5 h-5 text-emerald-500 mx-auto" />
          )}
        </div>

        <div className="p-4 border-t border-white/5">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-full h-10 rounded-lg flex items-center justify-center hover:bg-white/5 text-slate-500 transition-colors"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow relative h-screen overflow-y-auto flex flex-col">
        {/* Header */}
        <header className="sticky top-0 h-24 bg-[#050507]/60 backdrop-blur-xl border-b border-white/5 px-8 flex items-center justify-between z-30">
          <div className="flex items-center gap-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white mb-0.5">
                {navItems.find(n => n.id === activeTab)?.name}
              </h2>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{repoStatus}</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="hidden xl:flex items-center gap-4 text-xs font-mono text-slate-500 pr-6 border-r border-white/5">
              <div className="flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5" />
                <span>CPU: 4%</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5" />
                <span>Latency: 24ms</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="p-2.5 rounded-xl hover:bg-white/5 text-slate-400 relative transition-colors border border-transparent hover:border-white/5">
                <Bell className="w-5 h-5" />
                <div className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-[#050507]" />
              </button>
              <div className="h-10 w-[1px] bg-white/5 mx-1" />
              <div className="flex items-center gap-3 pl-1">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-white leading-none mb-0.5">Admin User</p>
                  <p className="text-[10px] text-slate-500 font-mono">ID: 311275994</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-slate-800 border border-white/10 ring-4 ring-black shadow-inner" />
              </div>
            </div>
          </div>
        </header>

        <div className="p-8 pb-20 max-w-7xl mx-auto w-full">
          <AnimatePresence mode="wait">
            {activeTab === 'games' && (
              <motion.div 
                key="games"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">وحدات الألعاب (Game Modules)</h3>
                    <p className="text-sm text-slate-500">قم بتفعيل أو تعطيل الألعاب المتاحة في سيرفرك وتخصيص إعداداتها.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button className="px-4 h-11 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-sm font-semibold transition-all">
                      Export Config
                    </button>
                    <button 
                      onClick={handleSave}
                      className="bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 text-white px-6 h-11 rounded-xl flex items-center gap-2 text-sm font-bold transition-all shrink-0"
                    >
                      {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {games.map((game) => (
                    <div 
                      key={game.id}
                      className={`group p-6 rounded-3xl border transition-all duration-500 relative overflow-hidden ${
                        game.enabled 
                          ? 'bg-slate-900/40 border-indigo-500/20 shadow-xl shadow-black/40' 
                          : 'bg-[#08080a] border-white/5 opacity-60 grayscale-[0.5]'
                      }`}
                    >
                      {game.enabled && (
                        <div className="absolute -top-12 -right-12 w-24 h-24 bg-indigo-600/10 rounded-full blur-[40px]" />
                      )}

                      <div className="flex items-start justify-between mb-6 relative z-10">
                        <div className={`p-3 rounded-2xl transition-colors duration-500 ${
                          game.enabled ? 'bg-indigo-600/20 text-indigo-400' : 'bg-slate-800 text-slate-500'
                        }`}>
                          <Gamepad2 className="w-6 h-6" />
                        </div>
                        <button 
                          onClick={() => handleToggleGame(game.id)}
                          className={`w-14 h-7 rounded-full relative transition-all duration-500 shadow-inner ${
                            game.enabled ? 'bg-indigo-600' : 'bg-slate-700'
                          }`}
                        >
                          <motion.div 
                            animate={{ x: game.enabled ? 28 : 4 }}
                            className="absolute top-1.5 w-4 h-4 bg-white rounded-full shadow-lg" 
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          />
                        </button>
                      </div>

                      <div className="relative z-10">
                        <h4 className="text-lg font-bold text-white mb-2 group-hover:text-indigo-300 transition-colors">{game.name}</h4>
                        <p className="text-sm text-slate-400 leading-relaxed min-h-[40px] mb-6">{game.description}</p>
                        
                        <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-lg bg-white/5 text-slate-500 border border-white/5">
                            {game.category}
                          </span>
                          <button className="text-xs font-bold text-indigo-400 hover:text-white transition-colors flex items-center gap-1 group/btn">
                            Configure
                            <ChevronRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'overview' && (
               <motion.div 
                 key="overview"
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, y: -10 }}
                 className="grid grid-cols-1 lg:grid-cols-12 gap-8"
               >
                  <div className="lg:col-span-8 space-y-8">
                    {/* Hero Card */}
                    <div className="p-10 rounded-[2.5rem] bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 text-white overflow-hidden relative shadow-2xl shadow-indigo-900/20 group">
                      <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:scale-110 transition-transform duration-1000 rotate-12">
                        <Github className="w-64 h-64" />
                      </div>
                      <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-white/10 rounded-full blur-[80px]" />
                      
                      <div className="relative z-10 flex flex-col h-full">
                        <div className="flex items-center gap-3 mb-6">
                           <div className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-bold tracking-widest uppercase">
                             Live Status
                           </div>
                           <div className="text-indigo-200 text-xs font-medium">Last deploy: 2h ago</div>
                        </div>
                        <h2 className="text-4xl font-extrabold mb-4 leading-tight">Nova Bot Center</h2>
                        <p className="text-indigo-100 text-lg opacity-80 mb-8 max-w-md leading-relaxed">
                          نظام التحكم المتكامل في بوت الألعاب الجماعية. قم بإدارة سيرفرك، تتبع الإحصائيات، وتخصيص تجربة اللاعبين.
                        </p>
                        <div className="flex items-center gap-4">
                          <button 
                            onClick={handleGitHubPush}
                            disabled={isPushing}
                            className="bg-white text-indigo-600 px-8 py-3.5 rounded-2xl font-bold text-sm hover:scale-105 active:scale-95 disabled:opacity-50 transition-all shadow-xl shadow-black/20 flex items-center gap-2"
                          >
                            {isPushing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Github className="w-4 h-4" />}
                            {isPushing ? 'جاري الرفع...' : 'رفع التعديلات لـ GitHub'}
                          </button>
                          <button className="bg-black/20 backdrop-blur-md border border-white/10 text-white px-8 py-3.5 rounded-2xl font-bold text-sm hover:bg-white/10 transition-all">عرض التقارير</button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="p-8 rounded-[2rem] bg-[#0c0c10] border border-white/5 hover:border-indigo-500/30 transition-colors group">
                        <div className="flex items-center justify-between mb-6">
                          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl">
                             <Terminal className="w-6 h-6" />
                          </div>
                          <span className="text-[10px] font-mono text-slate-600 uppercase tracking-widest font-bold">GitHub Connection</span>
                        </div>
                        <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-2">Personal Access Token</p>
                        <div className="space-y-3">
                          <div className="relative">
                            <input 
                              type="password"
                              value={localStorage.getItem('nova_github_token') || ''}
                              onChange={(e) => {
                                localStorage.setItem('nova_github_token', e.target.value);
                                setRepoStatus(e.target.value ? 'Authenticated' : 'Connected to hisaki22/nova-games-bot');
                              }}
                              placeholder="ghp_********************"
                              className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-4 text-xs font-mono text-indigo-300 focus:outline-none focus:border-indigo-500/50 transition-all"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                             <span className="text-[10px] text-slate-500 font-medium">Token is stored locally in your browser</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-8 rounded-[2rem] bg-[#0c0c10] border border-white/5 hover:border-emerald-500/30 transition-colors group">
                        <div className="flex items-center justify-between mb-6">
                          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl">
                             <Activity className="w-6 h-6" />
                          </div>
                          <span className="text-[10px] font-mono text-slate-600 uppercase tracking-widest font-bold">Bot Instance</span>
                        </div>
                        <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-2">الحالة الراهنة (Status)</p>
                        <div className="flex items-center justify-between">
                          <span className="text-3xl font-black text-emerald-400 tracking-tighter">ONLINE</span>
                          <div className="w-3 h-3 bg-emerald-500 rounded-full animate-ping opacity-60" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-4 space-y-8">
                    {/* Stats Widget */}
                    <section className="p-8 rounded-[2rem] bg-[#0c0c10] border border-white/5 flex flex-col h-full">
                      <div className="flex items-center justify-between mb-8">
                        <h4 className="font-bold text-white flex items-center gap-2">
                           <Users className="w-5 h-5 text-indigo-400" /> أفضل اللاعبين
                        </h4>
                        <button className="text-[10px] font-bold text-slate-500 hover:text-white uppercase tracking-wider">الكل</button>
                      </div>
                      
                      <div className="space-y-6 flex-grow">
                        {[
                          { name: 'Sultan_GX', score: '12,450', game: 'Imposter' },
                          { name: 'Yousif_X', score: '9,820', game: 'Roulette' },
                          { name: 'DarkLord', score: '8,500', game: 'Scramble' },
                          { name: 'M_Ahmed', score: '7,210', game: 'HotXO' },
                          { name: 'King42', score: '6,400', game: 'Search' },
                        ].map((user, i) => (
                          <div key={i} className="flex items-center gap-4 group/item">
                            <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-white/5 flex items-center justify-center font-bold text-slate-500 group-hover/item:border-indigo-500/40 transition-colors relative">
                               {i + 1}
                               {i === 0 && <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full" />}
                            </div>
                            <div className="flex-grow min-w-0">
                              <p className="text-sm font-bold text-white truncate">{user.name}</p>
                              <p className="text-[11px] text-slate-500 uppercase tracking-tighter font-medium">{user.game}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-indigo-400">{user.score}</p>
                              <p className="text-[10px] text-slate-600 font-bold uppercase">PTS</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-10 p-6 rounded-2xl bg-indigo-600/5 border border-indigo-500/10">
                         <div className="flex items-center gap-3 mb-2">
                           <ShieldCheck className="w-4 h-4 text-indigo-400" />
                           <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Admin Tip</span>
                         </div>
                         <p className="text-[11px] text-indigo-200 leading-relaxed opacity-70">
                           تفعيل خاصية "Auto-Kick" في لعبة الروليت يزيد من تفاعل اللاعبين وحماس الجولات.
                         </p>
                      </div>
                    </section>
                  </div>
               </motion.div>
            )}

            {activeTab === 'permissions' && (
               <motion.div 
                 key="permissions"
                 initial={{ opacity: 0, scale: 0.95 }}
                 animate={{ opacity: 1, scale: 1 }}
                 className="p-20 text-center border border-white/5 bg-white/[0.01] rounded-[3rem]"
               >
                  <div className="w-24 h-24 bg-rose-500/10 rounded-full border border-rose-500/20 flex items-center justify-center mx-auto mb-8">
                    <ShieldCheck className="w-10 h-10 text-rose-500" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">قسم الصلاحيات المتقدمة</h3>
                  <p className="text-slate-500 max-w-sm mx-auto mb-10 leading-relaxed">
                    هذا القسم يتطلب ربطاً مباشراً ببروتوكول Discord API لإدارة الرتب ومنح صلاحيات المدير لبعض المستخدمين داخل البوت.
                  </p>
                  <button className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-bold text-sm transition-all">
                    تفعيل الربط البرمجي
                  </button>
               </motion.div>
            )}

            {activeTab === 'appearance' && (
               <motion.div 
                 key="appearance"
                 initial={{ opacity: 0, x: -20 }}
                 animate={{ opacity: 1, x: 0 }}
                 className="max-w-3xl space-y-10"
               >
                  <section className="space-y-6">
                    <h3 className="text-xl font-bold text-white">إعدادات الرسائل والواجهة</h3>
                    
                    <div className="space-y-6 p-8 rounded-[2rem] bg-[#0c0c10] border border-white/5">
                      <div className="space-y-3">
                        <label className="text-sm font-bold text-slate-300">رسالة الترحيب بالألعاب</label>
                        <textarea 
                          className="w-full h-32 bg-black/40 border border-white/5 rounded-2xl p-4 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all resize-none"
                          placeholder="مرحباً بكم في عالم ألعاب نوفا..."
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 bg-white/[0.02] rounded-2xl border border-white/5">
                        <div className="flex items-center gap-4">
                           <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl">
                              <Volume2 className="w-5 h-5" />
                           </div>
                           <div>
                             <p className="text-sm font-bold text-white">التأثيرات الصوتية (Slash Commands)</p>
                             <p className="text-xs text-slate-500 tracking-tight">تفعيل الردود الصوتية في القنوات الصوتية المدعومة.</p>
                           </div>
                        </div>
                        <button className="w-12 h-6 rounded-full bg-indigo-600 relative">
                           <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                        </button>
                      </div>

                      <button 
                        onClick={handleSave}
                        className="w-full h-14 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold transition-all shadow-xl shadow-indigo-600/10"
                      >
                        {isSaving ? 'جاري الحفظ...' : 'حفظ الإعدادات الفنية'}
                      </button>
                    </div>
                  </section>
               </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

const RefreshCw = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
    <path d="M21 3v5h-5"/>
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
    <path d="M8 16H3v5"/>
  </svg>
);


