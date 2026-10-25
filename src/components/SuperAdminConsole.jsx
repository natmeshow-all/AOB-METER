import React, { useState } from 'react';
import {
  Building2,
  Users,
  PlusCircle,
  Cpu,
  Zap,
  ShieldCheck,
  Search,
  Eye,
  EyeOff,
  Copy,
  CheckCircle2,
  Trash2,
  Key,
  Server,
  Activity,
  ArrowUpRight,
  Sliders,
  RefreshCw,
  Database,
  Check,
  MapPin,
  Layers,
  UserPlus,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { TENANT_COMPANIES } from '../data/tenantData';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection
} from '../services/supabaseClient';

export const SuperAdminConsole = ({ onInspectClientDashboard }) => {
  const {
    allOrganizations,
    allAccounts,
    activeOrgId,
    switchOrganization,
    onboardNewClient,
    createClientAccount,
    updateClientAccount,
    deleteClientAccount,
    addMeterToOrganization,
    removeMeterFromOrganization,
    removeOrganization
  } = useAuth();

  const [activeSubTab, setActiveSubTab] = useState('clients'); // 'clients' | 'onboard' | 'accounts' | 'cloud'
  const [searchQuery, setSearchQuery] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [copiedId, setCopiedId] = useState(null);

  // Modal states for managing meters or adding user to specific company
  const [managingMetersOrgId, setManagingMetersOrgId] = useState(null);
  const [newMeterForm, setNewMeterForm] = useState({
    tag: 'MDB-NEW',
    panel: 'Main Panel',
    name: '',
    baseKW: 55,
    model: 'Schneider PM2200'
  });

  const [addingUserOrgId, setAddingUserOrgId] = useState(null);
  const [newUserForm, setNewUserForm] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    role: 'PLANT_MANAGER'
  });

  // Editing password inline state
  const [editingPasswordAccId, setEditingPasswordAccId] = useState(null);
  const [tempPassword, setTempPassword] = useState('');

  // Onboarding New Client Wizard State
  const [onboardForm, setOnboardForm] = useState({
    companyName: '',
    companyCode: '',
    industry: 'โรงงานผลิตอาหารและแปรรูปอุตสาหกรรม',
    location: '',
    transformerKVA: 1600,
    rateKWh: 4.20,
    gatewayModel: 'Waveshare RS485 to Ethernet PoE (Industrial)',
    gatewaySerial: '',
    gatewayIp: '192.168.1.200',
    defaultMeterModel: 'Schneider PM2200',
    contactName: '',
    username: '',
    email: '',
    password: '',
    role: 'PLANT_MANAGER',
    electricityMeters: [
      { tag: 'MDB-01', panel: 'Main Incoming', name: 'เมนเบรกเกอร์หลัก (Main Incoming)', baseKW: 160, model: 'Schneider PM2200' },
      { tag: 'MDB-02', panel: 'Production Line 1', name: 'สายการผลิตหลัก 1 (Production Line 1)', baseKW: 110, model: 'Schneider PM2200' },
      { tag: 'MDB-03', panel: 'Chiller & Utility', name: 'ระบบทำความเย็นและปั๊มลม (Chiller & Compressor)', baseKW: 135, model: 'Schneider PM2200' },
      { tag: 'MDB-04', panel: 'Office & Lighting', name: 'อาคารสำนักงานและแสงสว่าง', baseKW: 45, model: 'Schneider PM2200' }
    ]
  });

  const [createdHandover, setCreatedHandover] = useState(null);

  // Cloud Config State
  const initialCloud = getSupabaseConfig();
  const [supabaseUrl, setSupabaseUrl] = useState(initialCloud.url);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(initialCloud.anonKey);
  const [cloudTestResult, setCloudTestResult] = useState(null);
  const [isTestingCloud, setIsTestingCloud] = useState(false);
  const [cloudSaved, setCloudSaved] = useState(false);

  // Fleet KPIs calculation
  const totalClients = allOrganizations.length;
  const totalMeters = allOrganizations.reduce((sum, o) => sum + (o.meterCount || 0), 0);
  const totalTransformerKVA = allOrganizations.reduce((sum, o) => sum + (o.transformerKVA || 0), 0);
  const totalClientAccounts = allAccounts.filter((a) => a.role !== 'SUPER_ADMIN').length;

  const togglePasswordVisibility = (id) => {
    setVisiblePasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyCredentials = (text, id) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let pass = '';
    for (let i = 0; i < 8; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  };

  // Add meter row in Onboarding form
  const handleAddOnboardMeterRow = () => {
    const nextNum = onboardForm.electricityMeters.length + 1;
    setOnboardForm((prev) => ({
      ...prev,
      electricityMeters: [
        ...prev.electricityMeters,
        {
          tag: `MDB-${String(nextNum).padStart(2, '0')}`,
          panel: 'Sub Panel',
          name: `จุดวัดไฟฟ้าจุดที่ ${nextNum}`,
          baseKW: 50,
          model: prev.defaultMeterModel
        }
      ]
    }));
  };

  const handleRemoveOnboardMeterRow = (idx) => {
    setOnboardForm((prev) => ({
      ...prev,
      electricityMeters: prev.electricityMeters.filter((_, i) => i !== idx)
    }));
  };

  const handleUpdateOnboardMeterRow = (idx, field, val) => {
    setOnboardForm((prev) => ({
      ...prev,
      electricityMeters: prev.electricityMeters.map((m, i) =>
        i === idx ? { ...m, [field]: val } : m
      )
    }));
  };

  const handleOnboardSubmit = async (e) => {
    e.preventDefault();
    if (!onboardForm.companyName.trim() || !onboardForm.username.trim() || !onboardForm.password.trim()) {
      alert('กรุณากรอกชื่อบริษัท, ชื่อผู้ใช้ (Login ID) และรหัสผ่านสำหรับลูกค้าให้ครบถ้วน');
      return;
    }

    const result = await onboardNewClient(onboardForm);
    setCreatedHandover(result);

    // Reset form for next client
    setOnboardForm((prev) => ({
      ...prev,
      companyName: '',
      companyCode: '',
      location: '',
      gatewaySerial: '',
      contactName: '',
      username: '',
      email: '',
      password: ''
    }));
  };

  const handleCreateUserSubmit = (e) => {
    e.preventDefault();
    if (!addingUserOrgId || !newUserForm.username.trim() || !newUserForm.password.trim()) return;
    createClientAccount({
      ...newUserForm,
      orgId: addingUserOrgId
    });
    setAddingUserOrgId(null);
    setNewUserForm({
      fullName: '',
      username: '',
      email: '',
      password: '',
      role: 'PLANT_MANAGER'
    });
  };

  const handleAddMeterSubmit = (e) => {
    e.preventDefault();
    if (!managingMetersOrgId || !newMeterForm.name.trim()) return;
    addMeterToOrganization(managingMetersOrgId, newMeterForm);
    setNewMeterForm({
      tag: `MDB-0${(TENANT_COMPANIES[managingMetersOrgId]?.electricityMeters?.length || 0) + 2}`,
      panel: 'Main Panel',
      name: '',
      baseKW: 55,
      model: 'Schneider PM2200'
    });
  };

  const filteredOrgs = allOrganizations.filter(
    (org) =>
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (org.industry && org.industry.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 pb-10">
      {/* Super Admin Executive Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-indigo-500/30 rounded-2xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20 shrink-0">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                  SUPER ADMIN PORTAL
                </span>
                <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  ระบบควบคุมส่วนกลางออนไลน์
                </span>
              </div>
              <h2 className="text-lg sm:text-2xl font-bold text-white mt-1">
                ศูนย์บริหารจัดการบริษัทลูกค้า อุปกรณ์ IoT และสิทธิ์ผู้ใช้งาน
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                จัดการข้อมูลโรงงานลูกค้าทั้งหมด สร้างรหัสเข้าใช้งานใหม่หลังติดตั้งพาวเวอร์มิเตอร์ และตรวจสอบแดชบอร์ดรายโรงงาน
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => {
                setCreatedHandover(null);
                setActiveSubTab('onboard');
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-blue-600/25 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ ลงทะเบียนบริษัทลูกค้าใหม่</span>
            </button>
          </div>
        </div>

        {/* Fleet KPI Summary Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>บริษัทลูกค้าที่เชื่อมต่อ</span>
              <Building2 className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white mt-1 font-mono">
              {totalClients} <span className="text-xs font-sans font-normal text-slate-400">บริษัท</span>
            </div>
            <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> ออนไลน์ครบทุกไซต์งาน
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>จุดวัดมิเตอร์ออนไลน์รวม</span>
              <Cpu className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white mt-1 font-mono">
              {totalMeters} <span className="text-xs font-sans font-normal text-slate-400">จุดวัด (RS485)</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              ส่งข้อมูลเรียลไทม์ทุก 5 วินาที
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>พิกัดหม้อแปลงรวมภายใต้ระบบ</span>
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-amber-300 mt-1 font-mono">
              {totalTransformerKVA.toLocaleString()} <span className="text-xs font-sans font-normal text-slate-400">kVA</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              วิเคราะห์โหลดและค่าไฟอัตโนมัติ
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>บัญชีผู้ใช้งานลูกค้า (Accounts)</span>
              <Users className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white mt-1 font-mono">
              {totalClientAccounts} <span className="text-xs font-sans font-normal text-slate-400">บัญชี</span>
            </div>
            <div className="text-[11px] text-indigo-300 mt-1">
              ล็อกสิทธิ์แยกบริษัท 100%
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveSubTab('clients')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'clients'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>รายชื่อบริษัทลูกค้า ({totalClients})</span>
          </button>

          <button
            onClick={() => {
              setCreatedHandover(null);
              setActiveSubTab('onboard');
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'onboard'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>สร้างบริษัท & รหัสผู้ใช้งานใหม่ (หลังติดตั้ง)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('accounts')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'accounts'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>จัดการรหัสผ่าน & ผู้ใช้งาน ({allAccounts.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('cloud')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'cloud'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>ตั้งค่าเชื่อมต่อ Supabase Cloud</span>
          </button>
        </div>

        {activeSubTab === 'clients' && (
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อบริษัท หรือ รหัสย่อ..."
              className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 outline-none"
            />
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: CLIENT SITES & GATEWAY FLEET MANAGEMENT                        */}
      {/* ===================================================================== */}
      {activeSubTab === 'clients' && (
        <div className="grid grid-cols-1 gap-4">
          {filteredOrgs.map((org) => {
            const orgAccounts = allAccounts.filter(
              (a) => a.orgId === org.id && a.role !== 'SUPER_ADMIN'
            );
            const isPreset = ['ORG-AOB', 'ORG-GRAND', 'ORG-SIAMCOLD'].includes(org.id);

            return (
              <div
                key={org.id}
                className={`bg-slate-900/90 border rounded-2xl p-5 transition-all shadow-lg ${
                  activeOrgId === org.id
                    ? 'border-blue-500/60 ring-1 ring-blue-500/20'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/30 flex items-center justify-center font-mono font-bold text-blue-300 text-sm shrink-0">
                      {org.code}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base sm:text-lg font-bold text-white">
                          {org.name}
                        </h3>
                        <span className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          GATEWAY ONLINE
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-1">
                        <span>🏭 {org.industry}</span>
                        {org.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-500" />
                            {org.location}
                          </span>
                        )}
                        <span className="font-mono text-slate-500">ID: {org.id}</span>
                      </div>
                    </div>
                  </div>

                  {/* Primary Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        switchOrganization(org.id);
                        if (onInspectClientDashboard) {
                          onInspectClientDashboard(org.id);
                        }
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-950/50 transition-all cursor-pointer"
                    >
                      <Activity className="w-4 h-4" />
                      <span>เปิดดูแดชบอร์ดลูกค้า</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setManagingMetersOrgId(org.id)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5 text-amber-400" />
                      <span>จัดการมิเตอร์ ({org.elecMeterCount})</span>
                    </button>

                    <button
                      onClick={() => {
                        setAddingUserOrgId(org.id);
                        setNewUserForm({
                          fullName: `ผู้จัดการโรงงาน (${org.code})`,
                          username: `${org.code.toLowerCase()}_user`,
                          email: `user@${org.code.toLowerCase()}.com`,
                          password: generateRandomPassword(),
                          role: 'PLANT_MANAGER'
                        });
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-blue-400" />
                      <span>+ เพิ่มผู้ใช้</span>
                    </button>

                    {!isPreset && (
                      <button
                        onClick={() => {
                          if (window.confirm(`ยืนยันการลบบริษัท ${org.name} ออกจากระบบ?`)) {
                            removeOrganization(org.id);
                          }
                        }}
                        className="p-2 text-rose-400 hover:bg-rose-950/60 border border-rose-800/40 rounded-xl transition-all cursor-pointer"
                        title="ลบบริษัทนี้"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Hardware & Credentials Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 text-xs">
                  {/* Box 1: Electrical & Transformer Specs */}
                  <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      ข้อมูลทางวิศวกรรมไฟฟ้า
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">พิกัดหม้อแปลง:</span>
                      <span className="font-mono font-bold text-amber-300">
                        {org.transformerKVA.toLocaleString()} kVA
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">พิกัดโหลดปลอดภัย (85%):</span>
                      <span className="font-mono text-white">
                        {Math.round(org.transformerKVA * 0.85).toLocaleString()} kW
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">จำนวนพาวเวอร์มิเตอร์:</span>
                      <span className="font-mono font-bold text-emerald-300">
                        {org.elecMeterCount} จุดวัดออนไลน์
                      </span>
                    </div>
                  </div>

                  {/* Box 2: IoT Gateway Connection */}
                  <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-blue-400" />
                      อุปกรณ์ IoT Gateway ที่ติดตั้ง
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">รุ่น Gateway:</span>
                      <span className="text-white truncate max-w-[170px] font-medium">
                        {org.gatewayModel}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Serial / IP:</span>
                      <span className="font-mono text-blue-300">
                        {org.gatewaySerial} ({org.gatewayIp})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">วันที่ติดตั้งระบบ:</span>
                      <span className="font-mono text-slate-300">{org.installedDate}</span>
                    </div>
                  </div>

                  {/* Box 3: Client Login Accounts for this company */}
                  <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
                    <div className="text-[11px] font-bold text-slate-400 uppercase flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-indigo-400" />
                        รหัสล็อกอินของลูกค้า ({orgAccounts.length})
                      </span>
                    </div>

                    {orgAccounts.length === 0 ? (
                      <div className="text-slate-500 text-xs py-2">
                        ยังไม่มีบัญชีผู้ใช้งาน กด &ldquo;+ เพิ่มผู้ใช้&rdquo; ด้านบน
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-28 overflow-y-auto pr-1">
                        {orgAccounts.map((acc) => {
                          const isShown = visiblePasswords[acc.id];
                          const copyPayload = `ระบบตรวจสอบพลังงาน PowerView IoT\nบริษัท: ${org.name}\nชื่อผู้ใช้งาน (Login): ${acc.username}\nอีเมล: ${acc.email}\nรหัสผ่าน (Password): ${acc.password}`;
                          return (
                            <div
                              key={acc.id}
                              className="flex items-center justify-between bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800 text-[11px]"
                            >
                              <div className="truncate pr-2">
                                <span className="text-slate-400">Login: </span>
                                <span className="font-mono font-bold text-white">
                                  {acc.username}
                                </span>
                                <span className="mx-1.5 text-slate-600">|</span>
                                <span className="text-slate-400">Pass: </span>
                                <span className="font-mono text-amber-300">
                                  {isShown ? acc.password : '••••••'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => togglePasswordVisibility(acc.id)}
                                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                                  title="ดูรหัสผ่าน"
                                >
                                  {isShown ? (
                                    <EyeOff className="w-3.5 h-3.5" />
                                  ) : (
                                    <Eye className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCopyCredentials(copyPayload, acc.id)}
                                  className="p-1 text-blue-400 hover:text-blue-300 cursor-pointer"
                                  title="คัดลอกข้อมูลล็อกอินส่งให้ลูกค้า"
                                >
                                  {copiedId === acc.id ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: ONBOARD NEW CLIENT COMPANY & CREATE LOGIN CREDENTIALS          */}
      {/* ===================================================================== */}
      {activeSubTab === 'onboard' && (
        <div className="max-w-4xl mx-auto">
          {createdHandover ? (
            <div className="bg-slate-900 border-2 border-emerald-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-fadeIn">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <span className="text-xs font-mono uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                    PROVISIONING COMPLETED
                  </span>
                  <h3 className="text-xl font-bold text-white mt-1">
                    สร้างบริษัทลูกค้าและเปิดสิทธิ์ผู้ใช้งานสำเร็จ!
                  </h3>
                  <p className="text-xs text-slate-400">
                    ระบบสร้างแดชบอร์ดเฉพาะสำหรับบริษัทนี้ พร้อมผูกจุดวัดมิเตอร์และรหัสเข้าสู่ระบบเรียบร้อยแล้ว
                  </p>
                </div>
              </div>

              {/* Handover Credential Card */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-xs font-bold text-amber-300">
                    📋 ข้อมูลสำหรับส่งมอบลูกค้า (Client Login Credentials)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const text = `⚡ ระบบบริหารจัดการพลังงานอัจฉริยะ PowerView Cloud\n----------------------------------\n🏢 บริษัท: ${createdHandover.organization.name}\n🔗 เว็บไซต์เข้าใช้งาน: ${window.location.origin}\n👤 ชื่อผู้ใช้งาน (Login ID): ${createdHandover.account.username}\n📧 อีเมล: ${createdHandover.account.email}\n🔑 รหัสผ่าน (Password): ${createdHandover.account.password}\n----------------------------------\nเชื่อมต่อพาวเวอร์มิเตอร์แล้วจำนวน ${createdHandover.organization.electricityMeters.length} จุดวัด`;
                      handleCopyCredentials(text, 'handover-card');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg cursor-pointer transition-all"
                  >
                    {copiedId === 'handover-card' ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>คัดลอกข้อความแล้ว!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>คัดลอกส่งทาง LINE / Email</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block">ชื่อบริษัทลูกค้า:</span>
                    <span className="font-bold text-white text-sm">
                      {createdHandover.organization.name} ({createdHandover.organization.code})
                    </span>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block">ผู้รับผิดชอบ / ผู้จัดการ:</span>
                    <span className="font-bold text-white text-sm">
                      {createdHandover.account.fullName}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-xl border border-blue-500/30">
                    <span className="text-slate-400 block">ชื่อผู้ใช้งาน (Login / Username):</span>
                    <span className="font-mono font-bold text-blue-300 text-base">
                      {createdHandover.account.username}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-xl border border-amber-500/30">
                    <span className="text-slate-400 block">รหัสผ่าน (Password):</span>
                    <span className="font-mono font-bold text-amber-300 text-base">
                      {createdHandover.account.password}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setCreatedHandover(null);
                    setActiveSubTab('clients');
                  }}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  กลับหน้ารายชื่อลูกค้าทั้งหมด
                </button>

                <button
                  type="button"
                  onClick={() => {
                    switchOrganization(createdHandover.organization.id);
                    if (onInspectClientDashboard) {
                      onInspectClientDashboard(createdHandover.organization.id);
                    }
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg cursor-pointer"
                >
                  <Activity className="w-4 h-4" />
                  <span>เปิดดูแดชบอร์ดของลูกค้าเจ้านี้ทันที</span>
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleOnboardSubmit}
              className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-8 shadow-xl space-y-7"
            >
              <div className="border-b border-slate-800 pb-4">
                <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-blue-400" />
                  <span>ลงทะเบียนบริษัทลูกค้าใหม่ & สร้างรหัสผู้ใช้งาน (หลังติดตั้งอุปกรณ์เสร็จ)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  เมื่อช่างติดตั้งพาวเวอร์มิเตอร์และเชื่อมสาย RS485 เข้า Gateway เสร็จแล้ว ให้กรอกแบบฟอร์มนี้เพื่อเปิดระบบแดชบอร์ดและออกรหัส Login ให้ลูกค้า
                </p>
              </div>

              {/* SECTION 1: COMPANY & TRANSFORMER PROFILE */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-wider">
                  <span className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center">
                    1
                  </span>
                  <span>ข้อมูลบริษัทลูกค้าและพิกัดหม้อแปลงไฟฟ้า</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-slate-300 font-medium mb-1">
                      ชื่อบริษัทลูกค้า (Company Name) *
                    </label>
                    <input
                      type="text"
                      required
                      value={onboardForm.companyName}
                      onChange={(e) =>
                        setOnboardForm({ ...onboardForm, companyName: e.target.value })
                      }
                      placeholder="เช่น บริษัท ไทยเบฟเวอเรจ แพ็คเกจจิ้ง จำกัด"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1">
                      รหัสย่อบริษัท (Code 3-6 ตัวอักษร) *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={8}
                      value={onboardForm.companyCode}
                      onChange={(e) => {
                        const code = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                        setOnboardForm({
                          ...onboardForm,
                          companyCode: code,
                          username: prevUsernameOrAuto(onboardForm.username, code),
                          gatewaySerial: `GW-${code}-01`
                        });
                      }}
                      placeholder="เช่น TBP, CPF, TUF"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs font-mono uppercase text-amber-300 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1">
                      ประเภทอุตสาหกรรม / ลักษณะโรงงาน
                    </label>
                    <input
                      type="text"
                      value={onboardForm.industry}
                      onChange={(e) =>
                        setOnboardForm({ ...onboardForm, industry: e.target.value })
                      }
                      placeholder="เช่น โรงงานแปรรูปอาหารแช่แข็งและห้องเย็น"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1">
                      สถานที่ตั้งโรงงาน / นิคมอุตสาหกรรม
                    </label>
                    <input
                      type="text"
                      value={onboardForm.location}
                      onChange={(e) =>
                        setOnboardForm({ ...onboardForm, location: e.target.value })
                      }
                      placeholder="เช่น นิคมอุตสาหกรรมบางปู สมุทรปราการ"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1">
                      ขนาดหม้อแปลง (kVA)
                    </label>
                    <input
                      type="number"
                      value={onboardForm.transformerKVA}
                      onChange={(e) =>
                        setOnboardForm({ ...onboardForm, transformerKVA: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: IOT GATEWAY & CONNECTED POWER METERS */}
              <div className="space-y-4 pt-4 border-t border-slate-800/80">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                      2
                    </span>
                    <span>ตั้งค่าการเชื่อมต่ออุปกรณ์ IoT Gateway & จุดมิเตอร์ไฟฟ้า</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1">
                      รุ่น IoT Gateway ที่ติดตั้ง
                    </label>
                    <select
                      value={onboardForm.gatewayModel}
                      onChange={(e) =>
                        setOnboardForm({ ...onboardForm, gatewayModel: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none"
                    >
                      <option value="Waveshare RS485 to Ethernet PoE (Industrial)">
                        Waveshare RS485 to Ethernet PoE
                      </option>
                      <option value="USR-TCP232-410s Industrial RS485 Server">
                        USR-TCP232-410s Dual Serial
                      </option>
                      <option value="ESP32 Industrial Modbus WiFi/4G Gateway">
                        ESP32 Industrial Modbus 4G/WiFi
                      </option>
                      <option value="Schneider EcoStruxure Panel Server PAS600">
                        Schneider Panel Server PAS600
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1">
                      หมายเลข Gateway Serial / IP
                    </label>
                    <input
                      type="text"
                      value={onboardForm.gatewaySerial}
                      onChange={(e) =>
                        setOnboardForm({ ...onboardForm, gatewaySerial: e.target.value })
                      }
                      placeholder="เช่น GW-CLIENT-01"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1">
                      รุ่นพาวเวอร์มิเตอร์หลัก
                    </label>
                    <select
                      value={onboardForm.defaultMeterModel}
                      onChange={(e) =>
                        setOnboardForm({ ...onboardForm, defaultMeterModel: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none"
                    >
                      <option value="Schneider PM2200">Schneider EasyLogic PM2200</option>
                      <option value="Schneider PM5350">Schneider PowerLogic PM5350</option>
                      <option value="ABB M4M 20">ABB M4M 20 Network Analyzer</option>
                      <option value="Chint DTSU666">Chint DTSU666 RS485</option>
                    </select>
                  </div>
                </div>

                {/* Configurable Meter Points */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">
                      รายการจุดวัดพาวเวอร์มิเตอร์ ({onboardForm.electricityMeters.length} จุด)
                    </span>
                    <button
                      type="button"
                      onClick={handleAddOnboardMeterRow}
                      className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>+ เพิ่มจุดวัดมิเตอร์</span>
                    </button>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {onboardForm.electricityMeters.map((m, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-12 gap-2 items-center bg-slate-900 p-2 rounded-xl border border-slate-800 text-xs"
                      >
                        <div className="col-span-3 sm:col-span-2">
                          <input
                            type="text"
                            value={m.tag}
                            onChange={(e) =>
                              handleUpdateOnboardMeterRow(idx, 'tag', e.target.value)
                            }
                            placeholder="Tag"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 font-mono text-amber-300 text-xs"
                          />
                        </div>
                        <div className="col-span-5 sm:col-span-6">
                          <input
                            type="text"
                            value={m.name}
                            onChange={(e) =>
                              handleUpdateOnboardMeterRow(idx, 'name', e.target.value)
                            }
                            placeholder="ชื่อสายการผลิต / เครื่องจักร"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white text-xs"
                          />
                        </div>
                        <div className="col-span-3 sm:col-span-3 flex items-center gap-1">
                          <input
                            type="number"
                            value={m.baseKW}
                            onChange={(e) =>
                              handleUpdateOnboardMeterRow(idx, 'baseKW', e.target.value)
                            }
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 font-mono text-emerald-300 text-xs"
                          />
                          <span className="text-[10px] text-slate-500">kW</span>
                        </div>
                        <div className="col-span-1 text-right">
                          {onboardForm.electricityMeters.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveOnboardMeterRow(idx)}
                              className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* SECTION 3: CREATE CLIENT LOGIN ACCOUNT */}
              <div className="space-y-4 pt-4 border-t border-slate-800/80">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                  <span className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                    3
                  </span>
                  <span>สร้างชื่อผู้ใช้งาน (Login ID) และรหัสผ่านสำหรับส่งมอบลูกค้า</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1">
                      ชื่อผู้รับผิดชอบฝั่งลูกค้า (Full Name) *
                    </label>
                    <input
                      type="text"
                      required
                      value={onboardForm.contactName}
                      onChange={(e) =>
                        setOnboardForm({ ...onboardForm, contactName: e.target.value })
                      }
                      placeholder="เช่น คุณสมเกียรติ (ผู้จัดการฝ่ายวิศวกรรม)"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1">
                      อีเมลลูกค้า (Email)
                    </label>
                    <input
                      type="email"
                      value={onboardForm.email}
                      onChange={(e) => setOnboardForm({ ...onboardForm, email: e.target.value })}
                      placeholder="เช่น engineering@clientcompany.com"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-blue-300 font-bold mb-1">
                      ชื่อผู้ใช้งานสำหรับล็อกอิน (Login ID / Username) *
                    </label>
                    <input
                      type="text"
                      required
                      value={onboardForm.username}
                      onChange={(e) =>
                        setOnboardForm({ ...onboardForm, username: e.target.value.trim() })
                      }
                      placeholder="เช่น tbp_admin หรือรหัสย่อบริษัท"
                      className="w-full bg-slate-950 border border-blue-500/50 focus:border-blue-400 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-blue-300 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-amber-300 font-bold mb-1">
                      รหัสผ่าน (Password) *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={onboardForm.password}
                        onChange={(e) =>
                          setOnboardForm({ ...onboardForm, password: e.target.value })
                        }
                        placeholder="กำหนดรหัสผ่านให้ลูกค้า"
                        className="w-full bg-slate-950 border border-amber-500/50 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-amber-300 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setOnboardForm({
                            ...onboardForm,
                            password: generateRandomPassword()
                          })
                        }
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 rounded-xl border border-slate-700 shrink-0 cursor-pointer"
                      >
                        สุ่มรหัส
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="submit"
                  className="px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/30 transition-all cursor-pointer flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>บันทึกและเปิดใช้งานระบบลูกค้าทันที</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: USER ACCOUNTS & CREDENTIALS DIRECTORY                          */}
      {/* ===================================================================== */}
      {activeSubTab === 'accounts' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                <span>บัญชีผู้ใช้งานและรหัสผ่านทั้งหมดในระบบ ({allAccounts.length} บัญชี)</span>
              </h3>
              <p className="text-xs text-slate-400">
                สามารถดูรหัสผ่าน เปลี่ยนรหัสผ่านใหม่ หรือคัดลอกข้อมูลส่งให้ลูกค้าได้ทันที
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase text-[11px]">
                  <th className="py-3.5 px-4">ชื่อผู้ใช้งาน (Login ID)</th>
                  <th className="py-3.5 px-4">รหัสผ่าน (Password)</th>
                  <th className="py-3.5 px-4">ชื่อ-นามสกุล / ตำแหน่ง</th>
                  <th className="py-3.5 px-4">บริษัทที่สังกัด</th>
                  <th className="py-3.5 px-4">ระดับสิทธิ์</th>
                  <th className="py-3.5 px-4 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {allAccounts.map((acc) => {
                  const isSuper = acc.role === 'SUPER_ADMIN';
                  const isShown = visiblePasswords[acc.id];
                  const isEditingPass = editingPasswordAccId === acc.id;

                  return (
                    <tr key={acc.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-white text-sm">
                          {acc.username || acc.email}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">{acc.email}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        {isEditingPass ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={tempPassword}
                              onChange={(e) => setTempPassword(e.target.value)}
                              className="w-28 bg-slate-950 border border-amber-500 rounded px-2 py-1 font-mono text-amber-300 text-xs"
                            />
                            <button
                              onClick={() => {
                                if (tempPassword.trim()) {
                                  updateClientAccount(acc.id, { password: tempPassword.trim() });
                                }
                                setEditingPasswordAccId(null);
                              }}
                              className="px-2 py-1 bg-emerald-600 text-white rounded text-[11px] font-bold cursor-pointer"
                            >
                              บันทึก
                            </button>
                            <button
                              onClick={() => setEditingPasswordAccId(null)}
                              className="px-1.5 py-1 bg-slate-800 text-slate-400 rounded text-[11px] cursor-pointer"
                            >
                              ยกเลิก
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-amber-300">
                              {isShown ? acc.password : '••••••••'}
                            </span>
                            <button
                              onClick={() => togglePasswordVisibility(acc.id)}
                              className="text-slate-400 hover:text-white cursor-pointer"
                              title="แสดง/ซ่อนรหัสผ่าน"
                            >
                              {isShown ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setEditingPasswordAccId(acc.id);
                                setTempPassword(acc.password || '');
                              }}
                              className="text-[10px] text-blue-400 hover:underline cursor-pointer"
                            >
                              เปลี่ยนรหัส
                            </button>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-medium text-slate-200">{acc.fullName}</td>

                      <td className="py-3.5 px-4">
                        <span className="text-slate-300">{acc.companyName}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        {isSuper ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            👑 SUPER_ADMIN
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-blue-500/15 text-blue-300 border border-blue-500/30">
                            {acc.role}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              const text = `ข้อมูลเข้าใช้งานระบบ PowerView IoT\nบริษัท: ${acc.companyName}\nLogin ID: ${acc.username || acc.email}\nPassword: ${acc.password}`;
                              handleCopyCredentials(text, `table-${acc.id}`);
                            }}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 flex items-center gap-1 cursor-pointer"
                          >
                            {copiedId === `table-${acc.id}` ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400">คัดลอกแล้ว</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>คัดลอก</span>
                              </>
                            )}
                          </button>

                          {!isSuper && (
                            <button
                              onClick={() => {
                                if (window.confirm(`ยืนยันการลบบัญชี ${acc.username}?`)) {
                                  deleteClientAccount(acc.id);
                                }
                              }}
                              className="p-1.5 text-rose-400 hover:bg-rose-950/60 rounded-lg cursor-pointer"
                              title="ลบบัญชีนี้"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: SUPABASE CLOUD DATABASE CONFIGURATION                          */}
      {/* ===================================================================== */}
      {activeSubTab === 'cloud' && (
        <div className="max-w-2xl mx-auto bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                ตั้งค่าการเชื่อมต่อฐานข้อมูลคลาวด์ Supabase
              </h3>
              <p className="text-xs text-slate-400">
                เชื่อมต่อฐานข้อมูล PostgreSQL & Row Level Security (RLS) สำหรับซิงค์ข้อมูลระยะไกล
              </p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Supabase Project URL
              </label>
              <input
                type="url"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                placeholder="https://xxxxxxxxxxxx.supabase.co"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 font-mono text-white outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Supabase Anon Public Key
              </label>
              <input
                type="password"
                value={supabaseAnonKey}
                onChange={(e) => setSupabaseAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 font-mono text-white outline-none focus:border-emerald-500"
              />
            </div>

            {cloudTestResult && (
              <div
                className={`p-3 rounded-xl border ${
                  cloudTestResult.success
                    ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                    : 'bg-rose-950/50 border-rose-500/40 text-rose-200'
                }`}
              >
                {cloudTestResult.message}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={async () => {
                  setIsTestingCloud(true);
                  const res = await testSupabaseConnection(supabaseUrl, supabaseAnonKey);
                  setCloudTestResult(res);
                  setIsTestingCloud(false);
                }}
                disabled={isTestingCloud}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl border border-slate-700 cursor-pointer flex items-center gap-2"
              >
                {isTestingCloud && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>ทดสอบการเชื่อมต่อ</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (saveSupabaseConfig(supabaseUrl, supabaseAnonKey)) {
                    setCloudSaved(true);
                    setTimeout(() => setCloudSaved(false), 3000);
                  }
                }}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl cursor-pointer"
              >
                {cloudSaved ? '✓ บันทึกสำเร็จ' : 'บันทึกการตั้งค่า'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: MANAGE METERS FOR A SPECIFIC CLIENT                            */}
      {/* ===================================================================== */}
      {managingMetersOrgId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-white text-sm sm:text-base">
                  ⚡ จัดการจุดวัดพาวเวอร์มิเตอร์: {TENANT_COMPANIES[managingMetersOrgId]?.name}
                </h4>
                <p className="text-xs text-slate-400">
                  เพิ่มหรือลบรายการมิเตอร์ไฟฟ้าที่เชื่อมต่อผ่าน RS485 Gateway
                </p>
              </div>
              <button
                onClick={() => setManagingMetersOrgId(null)}
                className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* Add new meter form */}
              <form
                onSubmit={handleAddMeterSubmit}
                className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-3"
              >
                <div className="font-bold text-emerald-400">
                  + เพิ่มจุดวัดพาวเวอร์มิเตอร์ใหม่เข้าโรงงานนี้
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <input
                    type="text"
                    required
                    value={newMeterForm.tag}
                    onChange={(e) => setNewMeterForm({ ...newMeterForm, tag: e.target.value })}
                    placeholder="รหัส Tag (เช่น MDB-05)"
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-amber-300 font-mono"
                  />
                  <input
                    type="text"
                    required
                    value={newMeterForm.name}
                    onChange={(e) => setNewMeterForm({ ...newMeterForm, name: e.target.value })}
                    placeholder="ชื่อเครื่องจักร / สายการผลิต"
                    className="sm:col-span-2 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-white"
                  />
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      required
                      value={newMeterForm.baseKW}
                      onChange={(e) =>
                        setNewMeterForm({ ...newMeterForm, baseKW: e.target.value })
                      }
                      placeholder="kW"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-2 text-emerald-300 font-mono"
                    />
                    <button
                      type="submit"
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shrink-0 cursor-pointer"
                    >
                      เพิ่ม
                    </button>
                  </div>
                </div>
              </form>

              {/* Current Meters List */}
              <div className="space-y-2">
                {(TENANT_COMPANIES[managingMetersOrgId]?.electricityMeters || []).map(
                  (m, index) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between bg-slate-800/60 border border-slate-700/70 rounded-xl px-3.5 py-2.5"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-lg bg-slate-900 text-slate-400 font-mono flex items-center justify-center text-[11px]">
                          #{index + 1}
                        </span>
                        <div>
                          <div className="font-bold text-white">
                            <span className="text-amber-300 font-mono mr-2">[{m.tag}]</span>
                            {m.name}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            ตู้: {m.panel} • รุ่น: {m.model} • โหลดปกติ: {m.baseKW} kW
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => removeMeterFromOrganization(managingMetersOrgId, m.id)}
                        className="p-1.5 text-rose-400 hover:bg-rose-950/60 rounded-lg cursor-pointer"
                        title="ลบจุดวัดนี้"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: ADD USER ACCOUNT FOR SPECIFIC CLIENT                           */}
      {/* ===================================================================== */}
      {addingUserOrgId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h4 className="font-bold text-white text-sm">
                👤 เพิ่มบัญชีผู้ใช้งานให้: {TENANT_COMPANIES[addingUserOrgId]?.name}
              </h4>
              <button
                onClick={() => setAddingUserOrgId(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUserSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">ชื่อ-นามสกุล / ตำแหน่ง</label>
                <input
                  type="text"
                  required
                  value={newUserForm.fullName}
                  onChange={(e) => setNewUserForm({ ...newUserForm, fullName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-blue-300 font-bold mb-1">
                  ชื่อผู้ใช้งานสำหรับล็อกอิน (Login ID / Username) *
                </label>
                <input
                  type="text"
                  required
                  value={newUserForm.username}
                  onChange={(e) =>
                    setNewUserForm({ ...newUserForm, username: e.target.value.trim() })
                  }
                  className="w-full bg-slate-950 border border-blue-500/50 rounded-xl px-3 py-2.5 font-mono font-bold text-blue-300"
                />
              </div>

              <div>
                <label className="block text-amber-300 font-bold mb-1">
                  รหัสผ่าน (Password) *
                </label>
                <input
                  type="text"
                  required
                  value={newUserForm.password}
                  onChange={(e) =>
                    setNewUserForm({ ...newUserForm, password: e.target.value.trim() })
                  }
                  className="w-full bg-slate-950 border border-amber-500/50 rounded-xl px-3 py-2.5 font-mono font-bold text-amber-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddingUserOrgId(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl cursor-pointer"
                >
                  สร้างรหัสผู้ใช้งาน
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

function prevUsernameOrAuto(currentUsername, code) {
  if (!code) return currentUsername;
  if (!currentUsername || currentUsername.length <= 4) {
    return code.toLowerCase();
  }
  return currentUsername;
}
