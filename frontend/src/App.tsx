import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Hospital, Emergency, OneClickDemoResult } from './types';
import { ApiService } from './services/api';
import { Sidebar } from './components/Sidebar';
import { TopNavbar } from './components/TopNavbar';
import { BottomNav } from './components/BottomNav';
import { WorkspaceGate } from './components/WorkspaceGate';
import { ExplainModal } from './components/ExplainModal';
import { EmergencyIntakePage } from './pages/EmergencyIntakePage';
import { GovernorCommandPage } from './pages/GovernorCommandPage';
import { HospitalDashboardPage } from './pages/HospitalDashboardPage';
import { ReferralsPage } from './pages/ReferralsPage';
import { NetworkMapPage } from './pages/NetworkMapPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { DemoPage } from './pages/DemoPage';
import { WorkspaceContext } from './ui/WorkspaceContext';
import { useConfirm, useToast } from './ui/UIProvider';
import { Alert } from './ui/primitives';
import { WifiOff, RotateCcw } from 'lucide-react';
import { canAccess, defaultTab, readWorkspace, saveWorkspace, ROLE_META, type TabId, type Workspace } from './config/workspace';
import { cleanName } from './utils/format';

const DEFAULT_HOSPITAL = 'hosp_lagos_central';

function App() {
  const toast = useToast();
  const confirm = useConfirm();

  // Workspace (role + hospital) — restored from storage, otherwise the gate asks.
  const [workspace, setWorkspace] = useState<Workspace | null>(() => {
    const ws = readWorkspace();
    ApiService.setRole(ws?.role ?? 'ADMIN', ws?.hospitalId ?? DEFAULT_HOSPITAL);
    return ws;
  });
  const [gateOpen, setGateOpen] = useState<boolean>(() => readWorkspace() === null);

  const role = workspace?.role ?? 'ADMIN';
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>(workspace?.hospitalId ?? DEFAULT_HOSPITAL);
  const [activeTab, setActiveTab] = useState<TabId>(() => defaultTab(workspace?.role ?? 'ADMIN'));

  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [activeEmergency, setActiveEmergency] = useState<Emergency | null>(null);
  const [demoResult, setDemoResult] = useState<OneClickDemoResult | null>(null);
  const [isDemoRunning, setIsDemoRunning] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);
  const [explanationData, setExplanationData] = useState<any>(null);
  const [online, setOnline] = useState(true);
  const [pendingReferrals, setPendingReferrals] = useState(0);
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  const mainRef = useRef<HTMLElement>(null);
  const roleRef = useRef(role);
  const hospitalRef = useRef(selectedHospitalId);
  const prevPending = useRef<number | null>(null);
  roleRef.current = role;
  hospitalRef.current = selectedHospitalId;

  /* ── data loading ── */
  const loadHospitals = useCallback(async () => {
    try {
      const h = await ApiService.getHospitals();
      setOnline(true);
      if (h && h.length > 0) {
        setHospitals(h);
        setSelectedHospitalId((prev) => (h.some((x) => x.id === prev) ? prev : h[0].id));
      }
    } catch (e) {
      console.error('Failed to load hospitals', e);
      setOnline(false);
    }
  }, []);

  const refreshBadges = useCallback(async () => {
    const staffHospital = roleRef.current === 'HOSPITAL_STAFF' ? hospitalRef.current : undefined;
    const [pending, alerts] = await Promise.all([
      ApiService.getReferrals('REQUESTED', staffHospital).catch(() => null),
      ApiService.getNotifications(50).catch(() => null),
    ]);
    if (pending) {
      const count = pending.length;
      if (roleRef.current === 'HOSPITAL_STAFF' && prevPending.current !== null && count > prevPending.current) {
        toast.info('New referral request', {
          message: 'A patient is waiting for your response.',
          action: { label: 'Review now', onClick: () => setActiveTab('referrals') },
          duration: 8000,
        });
      }
      prevPending.current = count;
      setPendingReferrals(count);
    }
    if (alerts) setUnreadAlerts(alerts.filter((n) => n.status !== 'READ').length);
  }, [toast]);

  useEffect(() => {
    loadHospitals();
    const interval = setInterval(loadHospitals, 10000);
    return () => clearInterval(interval);
  }, [loadHospitals]);

  useEffect(() => {
    prevPending.current = null;
    refreshBadges();
    const interval = setInterval(refreshBadges, 6000);
    return () => clearInterval(interval);
  }, [refreshBadges, workspace?.role, workspace?.hospitalId]);

  /* ── navigation ── */
  const navigate = useCallback((tab: TabId) => {
    if (!canAccess(roleRef.current, tab)) return;
    setActiveTab(tab);
    mainRef.current?.scrollTo({ top: 0 });
  }, []);

  // If the active page isn't allowed for the role, fall back to the role's home.
  useEffect(() => {
    if (!canAccess(role, activeTab)) setActiveTab(defaultTab(role));
  }, [role, activeTab]);

  /* ── workspace switching ── */
  const handleSelectWorkspace = (ws: Workspace) => {
    ApiService.setRole(ws.role, ws.hospitalId);
    saveWorkspace(ws);
    setWorkspace(ws);
    setSelectedHospitalId(ws.hospitalId);
    setGateOpen(false);
    setActiveEmergency(null);
    setActiveTab(defaultTab(ws.role));
    setPendingReferrals(0);
    setUnreadAlerts(0);
    loadHospitals();
    const name = ws.role === 'HOSPITAL_STAFF'
      ? cleanName(hospitals.find((h) => h.id === ws.hospitalId)?.name) || 'your hospital'
      : ROLE_META[ws.role].label;
    toast.success(`Switched to ${name}`, { message: ROLE_META[ws.role].tagline });
  };

  const handleSelectHospital = (id: string) => {
    setSelectedHospitalId(id);
    ApiService.setRole(role, id);
    if (role === 'HOSPITAL_STAFF') {
      const ws = { role, hospitalId: id };
      saveWorkspace(ws);
      setWorkspace(ws);
    }
  };

  /* ── actions ── */
  const handleEmergencyCreated = (emergency: Emergency) => {
    setActiveEmergency(emergency);
    refreshBadges();
    loadHospitals();
  };

  const handleRunDemo = async () => {
    if (isDemoRunning) return;
    setIsDemoRunning(true);
    try {
      const result = await ApiService.runOneClickDemo();
      setDemoResult(result);
      const emergency = await ApiService.getEmergency(result.emergency_id);
      setActiveEmergency(emergency);
      await loadHospitals();
      refreshBadges();
      toast.success('Failover scenario complete', {
        message: `Re-routed from ${cleanName(result.first_hospital_attempted.name)} to ${cleanName(result.second_hospital_attempted.name)}.`,
        action: { label: 'Open command center', onClick: () => navigate('command') },
      });
    } catch (e: any) {
      console.error('Demo scenario failed', e);
      toast.error('Failover scenario failed', { message: e?.message || 'Unknown error' });
    } finally {
      setIsDemoRunning(false);
    }
  };

  const handleOpenExplain = async (emergencyId: string) => {
    try {
      const data = await ApiService.getExplanations(emergencyId);
      setExplanationData(data);
      setExplainOpen(true);
    } catch (e: any) {
      console.error('Failed to load explanations', e);
      toast.error('Could not load the decision audit', { message: e?.message });
    }
  };

  const handleResetSimulation = async () => {
    const ok = await confirm({
      title: 'Reset demo data?',
      message: 'This restores every hospital to its seed state and clears simulated cases from the command center. Audit history is preserved.',
      confirmLabel: 'Reset data',
      tone: 'danger',
      icon: RotateCcw,
    });
    if (!ok) return;
    try {
      await ApiService.resetSimulation();
      setActiveEmergency(null);
      setDemoResult(null);
      await loadHospitals();
      refreshBadges();
      toast.success('Demo data reset', { message: 'All hospitals are back to their starting state.' });
      navigate('command');
    } catch (e: any) {
      console.error('Failed to reset simulation', e);
      toast.error('Reset failed', { message: e?.message || 'Unknown error' });
    }
  };

  /* ── derived ── */
  const workspaceHospital = hospitals.find((h) => h.id === (workspace?.hospitalId ?? selectedHospitalId));
  const workspaceName = cleanName(workspaceHospital?.name) || 'Your hospital';
  const badges = useMemo(() => ({ referrals: pendingReferrals, notifications: unreadAlerts }), [pendingReferrals, unreadAlerts]);
  const ctx = useMemo(() => ({ role, hospitalId: selectedHospitalId }), [role, selectedHospitalId]);

  return (
    <WorkspaceContext.Provider value={ctx}>
      <div className="flex h-dvh overflow-hidden bg-canvas text-ink-900">
        <Sidebar
          role={role}
          workspaceName={workspaceName}
          activeTab={activeTab}
          onNavigate={navigate}
          onSwitchWorkspace={() => setGateOpen(true)}
          onResetSimulation={handleResetSimulation}
          badges={badges}
          online={online}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopNavbar
            role={role}
            workspaceName={workspaceName}
            activeTab={activeTab}
            onNavigate={navigate}
            onSwitchWorkspace={() => setGateOpen(true)}
            unreadCount={unreadAlerts}
            online={online}
            canReport={canAccess(role, 'intake')}
          />

          <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom)+90px)] lg:pb-0">
            <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
              {!online && (
                <Alert tone="alert" icon={WifiOff} title="Can't reach the ER-Sync backend" className="mb-6">
                  Figures may be out of date. Start the API server — this page reconnects automatically.
                </Alert>
              )}

              <div key={activeTab} className="animate-rise">
                {activeTab === 'command' && (
                  <GovernorCommandPage
                    hospitals={hospitals}
                    onRefreshHospitals={loadHospitals}
                    activeEmergency={activeEmergency}
                    onOpenExplain={handleOpenExplain}
                    onNavigate={navigate}
                    onEmergencyTriggered={handleEmergencyCreated}
                    currentRole={role}
                  />
                )}

                {activeTab === 'intake' && (
                  <EmergencyIntakePage
                    onEmergencyCreated={handleEmergencyCreated}
                    onNavigateToCommand={() => navigate('command')}
                  />
                )}

                {activeTab === 'hospital' && (
                  <HospitalDashboardPage
                    hospitals={hospitals}
                    selectedHospitalId={selectedHospitalId}
                    onSelectHospitalId={handleSelectHospital}
                    onRefreshHospitals={loadHospitals}
                  />
                )}

                {activeTab === 'referrals' && (
                  <ReferralsPage
                    role={role}
                    hospitalId={selectedHospitalId}
                    hospitals={hospitals}
                    onChanged={() => { loadHospitals(); refreshBadges(); }}
                  />
                )}

                {activeTab === 'network' && (
                  <NetworkMapPage
                    hospitals={hospitals}
                    activeEmergency={activeEmergency}
                    demoResult={demoResult}
                    onRefresh={loadHospitals}
                    role={role}
                  />
                )}

                {activeTab === 'analytics' && <AnalyticsPage />}

                {activeTab === 'notifications' && <NotificationsPage onChanged={refreshBadges} />}

                {activeTab === 'audit' && <AuditLogPage />}

                {activeTab === 'demo' && (
                  <DemoPage
                    onRunDemo={handleRunDemo}
                    isDemoRunning={isDemoRunning}
                    demoResult={demoResult}
                    onViewExplanations={handleOpenExplain}
                    onViewCommand={() => navigate('command')}
                  />
                )}
              </div>
            </div>
          </main>
        </div>

        <BottomNav
          role={role}
          activeTab={activeTab}
          onNavigate={navigate}
          onSwitchWorkspace={() => setGateOpen(true)}
          onResetSimulation={handleResetSimulation}
          badges={badges}
        />

        <ExplainModal isOpen={explainOpen} onClose={() => setExplainOpen(false)} data={explanationData} />

        <WorkspaceGate
          open={gateOpen}
          required={workspace === null}
          current={workspace}
          hospitals={hospitals}
          onSelect={handleSelectWorkspace}
          onClose={() => setGateOpen(false)}
        />
      </div>
    </WorkspaceContext.Provider>
  );
}

export default App;
