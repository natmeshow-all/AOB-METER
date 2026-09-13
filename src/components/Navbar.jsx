import React from 'react';
import { 
  Building2, 
  Droplet, 
  Zap, 
  Sun, 
  Camera, 
  Bell, 
  Settings, 
  FileSpreadsheet, 
  Calendar,
  CheckCircle2
} from 'lucide-react';
import { COMPANY_INFO } from '../data/mockData';

export const Navbar = ({ 
  activeTab, 
  setActiveTab, 
  timeframe, 
  setTimeframe, 
  onOpenScanner, 
  onOpenLineSimulator, 
  onOpenSettings,
  currentDate,
  setCurrentDate
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-3 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-2.5 rounded-xl shadow-lg shadow-orange-950/40">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  {COMPANY_INFO.name}
                </h1>
                <span className="px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Live Synced
                </span>
              </div>
              <p className="text-xs text-slate-400">
                ระบบบันทึกค่าน้ำ-ค่าไฟ-โซลาร์เซลล์ประจำวัน | รหัสแบบฟอร์ม: <span className="text-slate-300 font-mono">{COMPANY_INFO.formCode}</span>
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <button
              onClick={onOpenScanner}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-medium rounded-lg shadow-md transition-all cursor-pointer"
              title="ทดสอบอ่านรูปมิเตอร์ด้วย AI"
            >
              <Camera className="w-4 h-4 text-yellow-300" />
              <span className="hidden sm:inline">สแกนรูปมิเตอร์ (AI)</span>
              <span className="sm:hidden">สแกน AI</span>
            </button>

            <button
              onClick={onOpenLineSimulator}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs sm:text-sm font-medium rounded-lg transition-all cursor-pointer"
              title="ทดสอบระบบเตือน 06:30 น. และส่งรายงาน 08:00 น."
            >
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">LINE Bot & เตือน 06:30 น.</span>
              <span className="sm:hidden">LINE Bot</span>
            </button>

            <button
              onClick={onOpenSettings}
              className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-lg border border-slate-700/60 transition-all cursor-pointer"
              title="ตั้งค่า Google Sheet & LINE Token"
            >
              <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs & Period Selector */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between py-2 gap-2 sm:gap-4">
          {/* Main Category Tabs */}
          <nav className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
            <button
              onClick={() => setActiveTab('water')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'water'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Droplet className="w-4 h-4 text-blue-400 shrink-0" />
              <span><span className="hidden sm:inline">มิเตอร์</span>น้ำ (3)</span>
            </button>

            <button
              onClick={() => setActiveTab('electricity')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'electricity'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Zap className="w-4 h-4 text-amber-400 shrink-0" />
              <span><span className="hidden sm:inline">มิเตอร์</span>ไฟฟ้า (14)</span>
            </button>

            <button
              onClick={() => setActiveTab('solar')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'solar'
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Sun className="w-4 h-4 text-yellow-400 shrink-0" />
              <span>โซลาร์</span>
            </button>

            <button
              onClick={() => setActiveTab('monthly-sheet')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'monthly-sheet'
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-indigo-400 shrink-0" />
              <span><span className="hidden sm:inline">ตารางรวม </span>1-31 วัน</span>
            </button>
          </nav>

          {/* Timeframe Selector & Date Controls */}
          <div className="flex items-center gap-3">
            {activeTab !== 'monthly-sheet' && (
              <div className="flex items-center bg-slate-800/90 p-1 rounded-lg border border-slate-700/60">
                <button
                  onClick={() => setTimeframe('daily')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                    timeframe === 'daily'
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  รายวัน
                </button>
                <button
                  onClick={() => setTimeframe('monthly')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                    timeframe === 'monthly'
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  รายเดือน
                </button>
                <button
                  onClick={() => setTimeframe('yearly')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                    timeframe === 'yearly'
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  รายปี
                </button>
              </div>
            )}

            {timeframe === 'daily' && activeTab !== 'monthly-sheet' && (
              <div className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700/60">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>วันที่:</span>
                <select
                  value={currentDate}
                  onChange={(e) => setCurrentDate(e.target.value)}
                  className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
                >
                  <option value="2026-09-01" className="bg-slate-800">1 ก.ย. 2569 (บันทึกเมื่อวาน)</option>
                  <option value="2026-09-02" className="bg-slate-800">2 ก.ย. 2569</option>
                  <option value="2026-09-03" className="bg-slate-800">3 ก.ย. 2569 (วันนี้)</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
