import React, { useState } from 'react';
import { ApiService } from '../services/api';
import type { Emergency } from '../types';
import { 
  Send, 
  MapPin, 
  Activity, 
  Car, 
  HeartPulse, 
  Flame, 
  AlertCircle,
  Phone,
  User,
  Clock,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

interface EmergencyIntakePageProps {
  onEmergencyCreated: (emergency: Emergency) => void;
  onNavigateToCommand: () => void;
  onNavigateToPatient: () => void;
}

const LAGOS_LANDMARKS = [
  { name: "Lekki-Epe Expressway / Admiralty Way", lat: 6.4474, lng: 3.4731 },
  { name: "Ozumba Mbadiwe Way, Victoria Island", lat: 6.4281, lng: 3.4219 },
  { name: "Third Mainland Bridge (Adeniji Axis)", lat: 6.4712, lng: 3.3982 },
  { name: "Ikeja Along / Airport Road", lat: 6.5954, lng: 3.3515 },
  { name: "Herbert Macaulay Way, Yaba", lat: 6.5158, lng: 3.3718 },
  { name: "Ojuelegba Underbridge, Surulere", lat: 6.4969, lng: 3.3533 },
];

const PRESETS = [
  {
    title: "Motorcycle Trauma",
    category: "Road accident",
    description: "Motorcycle accident. Unconscious patient with severe head trauma, altered mental status, and active scalp hemorrhage.",
    locationIndex: 0,
    patientCount: 1,
    icon: Car,
    tag: "Critical",
    symptoms: "Unconscious, scalp laceration, suspected skull fracture"
  },
  {
    title: "Acute Chest Pain / STEMI",
    category: "Chest pain",
    description: "55yo male with crushing retrosternal pain radiating to left arm, diaphoresis, dyspnea, and cardiac distress.",
    locationIndex: 1,
    patientCount: 1,
    icon: HeartPulse,
    tag: "Cardiology",
    symptoms: "Crushing chest pain, shortness of breath, cold sweat"
  },
  {
    title: "Highway Multi-Crash",
    category: "Road accident",
    description: "Multi-vehicle pileup with multiple trapped casualties requiring trauma resuscitation and emergency surgery.",
    locationIndex: 2,
    patientCount: 3,
    icon: Flame,
    tag: "Mass Casualty",
    symptoms: "Multiple blunt trauma, arterial bleed, pelvic fractures"
  }
];

export const EmergencyIntakePage: React.FC<EmergencyIntakePageProps> = ({
  onEmergencyCreated
}) => {
  const [category, setCategory] = useState("Road accident");
  const [description, setDescription] = useState(PRESETS[0].description);
  const [selectedLandmark, setSelectedLandmark] = useState(0);
  const [patientCount, setPatientCount] = useState(1);
  const [callerPhone, setCallerPhone] = useState("+234 802 345 6789");
  const [symptoms, setSymptoms] = useState(PRESETS[0].symptoms);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = [
    "Road accident",
    "Severe bleeding",
    "Head injury",
    "Chest pain",
    "Stroke symptoms",
    "Burns",
    "Fracture",
    "Unconscious patient",
    "Pregnancy emergency",
    "Other"
  ];

  const applyPreset = (p: typeof PRESETS[0]) => {
    setCategory(p.category);
    setDescription(p.description);
    setSelectedLandmark(p.locationIndex);
    setPatientCount(p.patientCount);
    setSymptoms(p.symptoms);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError("Please describe the incident clinical assessment.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const loc = LAGOS_LANDMARKS[selectedLandmark];
      const newEmergency = await ApiService.createEmergency({
        latitude: loc.lat,
        longitude: loc.lng,
        location_name: loc.name,
        description,
        category,
        patient_count: Number(patientCount),
        caller_phone: callerPhone,
        symptoms: symptoms.trim()
      });

      onEmergencyCreated(newEmergency);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to submit emergency.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Emergency Intake &amp; Triage</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Submit incident report for automated clinical evaluation and nearest optimal hospital dispatch</p>
        </div>
      </div>

      {/* Quick Presets Grid */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quick Demo Presets</span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PRESETS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => applyPreset(p)}
              className="p-4 bg-white hover:bg-blue-50/40 border border-slate-200/80 hover:border-blue-300 rounded-2xl text-left transition shadow-xs group cursor-pointer space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="p-2 bg-slate-50 group-hover:bg-blue-100 rounded-xl text-slate-700 group-hover:text-blue-700 transition">
                  <p.icon className="w-4 h-4 stroke-[2.5]" />
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {p.tag}
                </span>
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-900 group-hover:text-blue-700">{p.title}</h3>
                <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">{p.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Intake Form */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Row 1: Category, Casualties, Location */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1.5 uppercase tracking-wide">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 mb-1.5 uppercase tracking-wide">Casualties</label>
              <input
                type="number"
                min="1"
                max="50"
                value={patientCount}
                onChange={(e) => setPatientCount(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 mb-1.5 uppercase tracking-wide">Lagos Landmark</label>
              <select
                value={selectedLandmark}
                onChange={(e) => setSelectedLandmark(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 outline-none truncate cursor-pointer"
              >
                {LAGOS_LANDMARKS.map((lm, idx) => (
                  <option key={idx} value={idx}>{lm.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-black text-slate-700 mb-1.5 uppercase tracking-wide">Incident Assessment &amp; Clinical Notes</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe injuries, patient consciousness, trauma severity, and required resources..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed"
            />
          </div>

          {/* Symptoms & Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-black text-slate-700 mb-1.5 uppercase tracking-wide">Identified Symptoms</label>
              <input
                type="text"
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="Comma separated symptoms"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 mb-1.5 uppercase tracking-wide">Responder Phone</label>
              <input
                type="text"
                value={callerPhone}
                onChange={(e) => setCallerPhone(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md shadow-rose-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Activity className="w-4 h-4 animate-spin" />
                  <span>Evaluating Clinical Triage &amp; Finding Hospital...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit Incident &amp; Match Hospital</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
