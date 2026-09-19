import React, { useState, useEffect, useCallback } from 'react';
import type { Hospital, Emergency, UserRole, OneClickDemoResult } from './types';
import { ApiService } from './services/api';
import { Sidebar } from './components/Sidebar';
import { TopNavbar } from './components/TopNavbar';
import { ExplainModal } from './components/ExplainModal';
import { EmergencyIntakePage } from './pages/EmergencyIntakePage';
import { GovernorCommandPage } from './pages/GovernorCommandPage';
import { HospitalDashboardPage } from './pages/HospitalDashboardPage';
import { NetworkMapPage } from './pages/NetworkMapPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { DemoPage } from './pages/DemoPage';

function App() {
  const [activeTab, setActiveTab] = useState<string>('command');
  const [currentRole, setCurrentRole] = useState<UserRole>('ADMIN');
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>('hosp_lagos_central');
  const [activeEmergency, setActiveEmergency] = useState<Emergency | null>(null);
  const [demoResult, setDemoResult] = useState<OneClickDemoResult | null>(null);
  const [isDemoRunning, setIsDemoRunning] = useState(false);
  const [explainModalOpen, setExplainModalOpen] = useState(false);
  const [explanationData, setExplanationData] = useState<any>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const loadHospitals = useCallback(async () => {
    try {
      const h = await ApiService.getHospitals();
      if (h && h.length > 0) {
        setHospitals(h);
        if (!selectedHospitalId) {
          setSelectedHospitalId(h[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to load hospitals', e);
    }
  }, [selectedHospitalId]);

  useEffect(() => {
    loadHospitals();
    const interval = setInterval(loadHospitals, 15000);
    return () => clearInterval(interval);
  }, [loadHospitals]);

  const handleEmergencyCreated = (emergency: Emergency) => {
    setActiveEmergency(emergency);
    setActiveTab('command');
  };

  const handleRunDemo = async () => {
    setIsDemoRunning(true);
    try {
      const result = await ApiService.runOneClickDemo();
      setDemoResult(result);
      const emergency = await ApiService.getEmergency(result.emergency_id);
      setActiveEmergency(emergency);
      await loadHospitals();
      setActiveTab('command');
    } catch (e: any) {
      console.error('Demo scenario failed', e);
      alert('Demo scenario failed: ' + (e.message || 'Unknown error'));
    } finally {
      setIsDemoRunning(false);
    }
  };

  const handleOpenExplain = async (emergencyId: string) => {
    try {
      const data = await ApiService.getExplanations(emergencyId);
      setExplanationData(data);
      setExplainModalOpen(true);
    } catch (e) {
      console.error('Failed to load explanations', e);
    }
  };

  const handleResetSimulation = async () => {
    try {
      await ApiService.resetSimulation();
      setActiveEmergency(null);
      setDemoResult(null);
      await loadHospitals();
      setActiveTab('command');
    } catch (e: any) {
      console.error('Failed to reset simulation', e);
      alert('Reset failed: ' + (e.message || 'Unknown error'));
    }
  };

  const handleSelectHospital = (id: string) => {
    setSelectedHospitalId(id);
    ApiService.setRole(currentRole, id);
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Sleek Sidebar Navigation with Mobile Support */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onResetSimulation={handleResetSimulation}
        isOpenMobile={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        {/* Top Navbar */}
        <TopNavbar
          activeTab={activeTab}
          currentRole={currentRole}
          setCurrentRole={setCurrentRole}
          hospitals={hospitals}
          selectedHospitalId={selectedHospitalId}
          onSelectHospitalId={handleSelectHospital}
          onRunDemo={handleRunDemo}
          isDemoRunning={isDemoRunning}
          onOpenMobileMenu={() => setMobileSidebarOpen(true)}
          onNavigateToIntake={() => setActiveTab('intake')}
        />

        {/* Scrollable View Container */}
        <main className="flex-1 overflow-y-auto">
          {activeTab === 'command' && (
            <GovernorCommandPage
              hospitals={hospitals}
              onRefreshHospitals={loadHospitals}
              activeEmergency={activeEmergency}
              onOpenExplain={handleOpenExplain}
              onNavigateToHospital={() => setActiveTab('hospital')}
              onEmergencyTriggered={(em) => setActiveEmergency(em)}
              currentRole={currentRole}
            />
          )}

          {activeTab === 'intake' && (
            <EmergencyIntakePage
              onEmergencyCreated={handleEmergencyCreated}
              onNavigateToCommand={() => setActiveTab('command')}
              onNavigateToPatient={() => setActiveTab('command')}
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

          {activeTab === 'network' && (
            <NetworkMapPage
              hospitals={hospitals}
              activeEmergency={activeEmergency}
              demoResult={demoResult}
              onRefresh={loadHospitals}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsPage />
          )}

          {activeTab === 'demo' && (
            <DemoPage
              onRunDemo={handleRunDemo}
              isDemoRunning={isDemoRunning}
              demoResult={demoResult}
              onViewExplanations={handleOpenExplain}
              onViewCommand={() => setActiveTab('command')}
            />
          )}
        </main>
      </div>

      {/* Decision Explainability Modal */}
      <ExplainModal
        isOpen={explainModalOpen}
        onClose={() => setExplainModalOpen(false)}
        data={explanationData}
      />
    </div>
  );
}

export default App;