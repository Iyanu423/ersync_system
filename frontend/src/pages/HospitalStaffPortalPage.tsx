import React, { useEffect, useState } from 'react';
import { ApiService } from '../services/api';
import { HospitalStaffPortal } from '../components/HospitalStaffPortal';
import { Building2, Stethoscope } from 'lucide-react';

interface HospitalStaffPortalPageProps {
  onRoleChange: (role: string) => void;
}

export const HospitalStaffPortalPage: React.FC<HospitalStaffPortalPageProps> = ({ onRoleChange }) => {
  const hospitalId = ApiService['currentHospitalId'] || 'hosp_lagos_central';
  const [hospital, setHospital] = useState<any>(null);

  useEffect(() => {
    const loadHospital = async () => {
      try {
        const h = await ApiService.getHospital(hospitalId);
        if (!h || h.id === undefined) {
          setHospital({
            id: hospitalId,
            name: 'Lagos Central Trauma Centre',
            address: 'Lagos Island Medical District, Lagos',
            phone: '+234 1 234 5678',
            emergency_status: 'OPEN',
            overall_capacity: 75,
            accepting_emergencies: true,
            total_emergency_beds: 25,
            available_emergency_beds: 18,
            last_status_update: new Date().toISOString(),
            specialties: [],
            facilities: [],
            equipment: []
          });
        } else {
          setHospital(h);
        }
      } catch (e) {
        console.error('Failed to load hospital', e);
        setHospital({
          id: hospitalId,
          name: 'Lagos Central Trauma Centre',
          address: 'Lagos Island Medical District, Lagos',
          phone: '+234 1 234 5678',
          emergency_status: 'OPEN',
          overall_capacity: 75,
          accepting_emergencies: true,
          total_emergency_beds: 25,
          available_emergency_beds: 18,
          last_status_update: new Date().toISOString(),
          specialties: [],
          facilities: [],
          equipment: []
        });
      }
    };
    loadHospital();
  }, [hospitalId]);

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-6">
      <div className="pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2 mb-1">
          <span className="p-1 rounded-md bg-teal-100 text-teal-700">
            <Stethoscope className="w-4 h-4" />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-teal-700">Hospital Staff Operations</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Internal Emergency Department Console
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Direct operational console for hospital on-duty staff to adjust capacity, surgeon availability, and admission state.
        </p>
      </div>

      {hospital ? (
        <HospitalStaffPortal
          hospital={hospital}
          onEmergencyStatusChange={(status, accepting) => {
            ApiService.updateHospitalStatus(hospitalId, status, accepting);
          }}
          onAcceptanceChange={(accepting) => {
            setTimeout(() => {
              ApiService.updateHospitalStatus(hospitalId, hospital.emergency_status, accepting);
            }, 100);
          }}
          onBedCapacityChange={(total, occupied, reserved) => {
            ApiService.updateHospitalCapacity(hospitalId, total);
          }}
          onSpecialistUpdate={(specialist, count, status) => {
            ApiService.updateSpecialist(hospitalId, specialist, count, status);
          }}
          onFacilityUpdate={(facility, available, status) => {
            ApiService.updateFacility(hospitalId, facility, available, status);
          }}
          onEquipmentUpdate={(equipment, operational, status) => {
            ApiService.updateFacility(hospitalId, equipment, operational, status);
          }}
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 shadow-xs">
          Loading staff operational console...
        </div>
      )}
    </div>
  );
};