import React, { useState } from 'react';
import clsx from 'clsx';
import { ApiService } from '../services/api';
import type { Emergency } from '../types';
import { useToast } from '../ui/UIProvider';
import { Alert, Badge, Button, Card, CardHeader, Field, IconTile, KV, Modal, PageHeader, Select } from '../ui/primitives';
import { severityTone, titleCase } from '../utils/format';
import { Activity, Bed, Building2, Car, CheckCircle2, Flame, HeartPulse, Radar, Send, ShieldCheck, Siren, Stethoscope, Users, Zap, TriangleAlert } from 'lucide-react';

interface Props {
  onEmergencyCreated: (emergency: Emergency) => void;
  onNavigateToCommand: () => void;
}

const LAGOS_LANDMARKS = [
  { name: 'Lekki-Epe Expressway / Admiralty Way', lat: 6.4474, lng: 3.4731 },
  { name: 'Ozumba Mbadiwe Way, Victoria Island', lat: 6.4281, lng: 3.4219 },
  { name: 'Third Mainland Bridge (Adeniji Axis)', lat: 6.4712, lng: 3.3982 },
  { name: 'Ikeja Along / Airport Road', lat: 6.5954, lng: 3.3515 },
  { name: 'Herbert Macaulay Way, Yaba', lat: 6.5158, lng: 3.3718 },
  { name: 'Ojuelegba Underbridge, Surulere', lat: 6.4969, lng: 3.3533 },
];

const PRESETS = [
  { title: 'Motorcycle trauma', category: 'Road accident', description: 'Motorcycle accident. Unconscious patient with severe head trauma, altered mental status, and active scalp hemorrhage.', locationIndex: 0, patientCount: 1, icon: Car, tag: 'Critical', symptoms: 'Unconscious, scalp laceration, suspected skull fracture' },
  { title: 'Acute chest pain / STEMI', category: 'Chest pain', description: '55yo male with crushing retrosternal pain radiating to left arm, diaphoresis, dyspnea, and cardiac distress.', locationIndex: 1, patientCount: 1, icon: HeartPulse, tag: 'Cardiology', symptoms: 'Crushing chest pain, shortness of breath, cold sweat' },
  { title: 'Highway multi-crash', category: 'Road accident', description: 'Multi-vehicle pileup with multiple trapped casualties requiring trauma resuscitation and emergency surgery.', locationIndex: 2, patientCount: 3, icon: Flame, tag: 'Mass casualty', symptoms: 'Multiple blunt trauma, arterial bleed, pelvic fractures' },
];

const CATEGORIES = ['Road accident', 'Severe bleeding', 'Head injury', 'Chest pain', 'Stroke symptoms', 'Burns', 'Fracture', 'Unconscious patient', 'Pregnancy emergency', 'Other'];

export const EmergencyIntakePage: React.FC<Props> = ({ onEmergencyCreated, onNavigateToCommand }) => {
  const toast = useToast();
  const [category, setCategory] = useState(PRESETS[0].category);
  const [description, setDescription] = useState(PRESETS[0].description);
  const [selectedLandmark, setSelectedLandmark] = useState(0);
  const [patientCount, setPatientCount] = useState(1);
  const [callerPhone, setCallerPhone] = useState('+234 802 345 6789');
  const [symptoms, setSymptoms] = useState(PRESETS[0].symptoms);
  const [activePreset, setActivePreset] = useState<number | null>(0);
  const [errors, setErrors] = useState<{ description?: string; phone?: string; count?: string }>({});
  const [reviewOpen, setReviewOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [created, setCreated] = useState<Emergency | null>(null);

  const applyPreset = (p: typeof PRESETS[0], idx: number) => {
    setCategory(p.category); setDescription(p.description); setSelectedLandmark(p.locationIndex);
    setPatientCount(p.patientCount); setSymptoms(p.symptoms); setActivePreset(idx); setErrors({});
    toast.info(`Loaded “${p.title}”`, { message: 'Review the details, then submit.', duration: 2200 });
  };

  const markEdited = () => setActivePreset(null);

  const validate = () => {
    const next: typeof errors = {};
    if (description.trim().length < 10) next.description = 'Describe the incident in at least a few words so triage can classify it.';
    if (callerPhone.trim() && !/^[+\d][\d\s()-]{6,}$/.test(callerPhone.trim())) next.phone = 'Enter a valid phone number, e.g. +234 802 345 6789.';
    if (!Number.isFinite(patientCount) || patientCount < 1 || patientCount > 50) next.count = 'Enter between 1 and 50 casualties.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const openReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.warning('Please fix the highlighted fields');
      return;
    }
    setReviewOpen(true);
  };

  const submit = async () => {
    setIsSubmitting(true);
    try {
      const loc = LAGOS_LANDMARKS[selectedLandmark];
      const em = await ApiService.createEmergency({
        latitude: loc.lat, longitude: loc.lng, location_name: loc.name, description: description.trim(), category,
        patient_count: Number(patientCount), caller_phone: callerPhone.trim(), symptoms: symptoms.trim(),
      });
      setReviewOpen(false);
      setCreated(em);
      onEmergencyCreated(em);
      toast.success('Emergency dispatched', { message: `${em.incident_reference} is being matched to a hospital.` });
    } catch (err: any) {
      console.error(err);
      toast.error('Could not submit the emergency', { message: err?.message || 'Please check your connection and try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const reset = () => {
    setCreated(null); setErrors({}); setActivePreset(null);
    setCategory(CATEGORIES[0]); setDescription(''); setSymptoms(''); setPatientCount(1); setSelectedLandmark(0);
  };

  const loc = LAGOS_LANDMARKS[selectedLandmark];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        icon={Siren}
        tone="alert"
        eyebrow="Intake & triage"
        title="Report an emergency"
        description="Tell us what happened. ER-Sync classifies severity, finds hospitals that can actually treat the patient, and reserves a bed — in seconds."
      />

      {/* How it works */}
      <div className="hidden grid-cols-1 gap-3 sm:grid sm:grid-cols-3">
        {[
          { icon: Stethoscope, t: '1 · AI triage', d: 'Severity and clinical needs are extracted from your description.' },
          { icon: ShieldCheck, t: '2 · Safety filters', d: 'Hospitals without a bed, specialist or equipment are excluded.' },
          { icon: Building2, t: '3 · Bed reserved', d: 'The best hospital is asked to accept. If not, we fail over instantly.' },
        ].map((s) => (
          <div key={s.t} className="flex items-start gap-3 rounded-2xl border border-ink-100 bg-white p-4">
            <IconTile icon={s.icon} tone="signal" size="sm" />
            <div><p className="text-[13px] font-bold text-ink-900">{s.t}</p><p className="mt-0.5 text-[12px] font-medium leading-relaxed text-ink-500">{s.d}</p></div>
          </div>
        ))}
      </div>

      {/* Presets */}
      <div>
        <p className="eyebrow mb-2.5">Quick scenarios</p>
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
          {PRESETS.map((p, idx) => (
            <button key={p.title} type="button" onClick={() => applyPreset(p, idx)}
              className={clsx('card min-w-[250px] shrink-0 space-y-2.5 p-4 text-left transition active:scale-[.98] sm:min-w-0', activePreset === idx ? 'border-signal-300 ring-4 ring-signal-100' : 'card-interactive')}>
              <div className="flex items-center justify-between">
                <IconTile icon={p.icon} tone={activePreset === idx ? 'signal' : 'neutral'} size="sm" />
                <Badge tone={activePreset === idx ? 'signal' : 'neutral'} small>{p.tag}</Badge>
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-ink-900">{p.title}</h3>
                <p className="mt-1 line-clamp-2 text-[12px] font-medium leading-relaxed text-ink-500">{p.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader icon={Activity} tone="alert" title="Incident details" subtitle="The more specific, the better the match" />
        <form onSubmit={openReview} className="space-y-5" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Category">
              <Select title="Category" value={category} onChange={(v) => { setCategory(v); markEdited(); }} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
            </Field>
            <Field label="Casualties" error={errors.count}>
              <input type="number" inputMode="numeric" min={1} max={50} className={clsx('input', errors.count && 'input-error')} value={patientCount} onChange={(e) => { setPatientCount(Number(e.target.value)); markEdited(); }} />
            </Field>
            <Field label="Location (Lagos)">
              <Select title="Incident location" value={String(selectedLandmark)} onChange={(v) => { setSelectedLandmark(Number(v)); markEdited(); }} options={LAGOS_LANDMARKS.map((l, i) => ({ value: String(i), label: l.name }))} />
            </Field>
          </div>

          <Field label="What happened?" error={errors.description} hint="Include consciousness, bleeding, breathing, and any resources needed.">
            <textarea rows={4} className={clsx('input', errors.description && 'input-error')} value={description}
              onChange={(e) => { setDescription(e.target.value); markEdited(); if (errors.description) setErrors((x) => ({ ...x, description: undefined })); }}
              placeholder="e.g. Motorcycle collision, rider unconscious with heavy bleeding from the head…" />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Symptoms" className="sm:col-span-2" hint="Comma separated">
              <input className="input" value={symptoms} onChange={(e) => { setSymptoms(e.target.value); markEdited(); }} placeholder="Unconscious, bleeding, difficulty breathing" />
            </Field>
            <Field label="Responder phone" error={errors.phone}>
              <input type="tel" inputMode="tel" className={clsx('input', errors.phone && 'input-error')} value={callerPhone} onChange={(e) => { setCallerPhone(e.target.value); if (errors.phone) setErrors((x) => ({ ...x, phone: undefined })); }} />
            </Field>
          </div>

          <div className="sticky bottom-[-14px] z-20 -mx-1 mt-2 flex flex-col gap-3 rounded-2xl border border-ink-100 bg-white/90 p-2.5 shadow-[var(--shadow-lift)] backdrop-blur-xl sm:static sm:mx-0 sm:mt-0 sm:flex-row sm:items-center sm:justify-between sm:rounded-none sm:border-0 sm:border-t sm:bg-transparent sm:p-0 sm:pt-5 sm:shadow-none sm:backdrop-blur-none">
            <p className="hidden items-center gap-2 text-[12.5px] font-medium text-ink-400 sm:flex"><TriangleAlert className="size-4" />For a real emergency, also call your local emergency line.</p>
            <Button type="submit" variant="danger" size="lg" icon={Send} className="w-full sm:w-auto">Review & dispatch</Button>
          </div>
        </form>
      </Card>

      {/* Review modal */}
      <Modal open={reviewOpen} onClose={() => !isSubmitting && setReviewOpen(false)} dismissible={!isSubmitting} size="md" icon={Siren} tone="alert" title="Dispatch this emergency?" subtitle="Check the details before ER-Sync contacts hospitals."
        footer={<>
          <Button variant="secondary" onClick={() => setReviewOpen(false)} disabled={isSubmitting}>Edit details</Button>
          <Button variant="danger" icon={Send} loading={isSubmitting} onClick={submit}>{isSubmitting ? 'Matching hospital…' : 'Dispatch now'}</Button>
        </>}>
        <div className="space-y-4">
          <div className="rounded-2xl border border-ink-100 bg-ink-25 p-4">
            <p className="text-[15px] font-bold text-ink-900">{category} · {patientCount} patient{patientCount === 1 ? '' : 's'}</p>
            <p className="mt-1 text-[13px] font-medium leading-relaxed text-ink-600">{description}</p>
          </div>
          <div className="divide-y divide-ink-100">
            <KV label="Location">{loc.name}</KV>
            {symptoms.trim() && <KV label="Symptoms">{symptoms}</KV>}
            {callerPhone.trim() && <KV label="Responder">{callerPhone}</KV>}
          </div>
        </div>
      </Modal>

      {/* Success modal */}
      <Modal open={!!created} onClose={reset} size="md" icon={CheckCircle2} tone="signal" title="Emergency dispatched" subtitle={created ? `Incident ${created.incident_reference}` : undefined}
        footer={<>
          <Button variant="secondary" onClick={reset}>Report another</Button>
          <Button variant="primary" icon={Radar} onClick={() => { reset(); onNavigateToCommand(); }}>Track in Command Center</Button>
        </>}>
        {created && (
          <div className="space-y-4">
            {created.status === 'NO_MATCH' ? (
              <Alert tone="warn" icon={TriangleAlert} title="No hospital meets every requirement yet">The case is logged. Open the Command Center to review the decision audit and retry dispatch as hospitals update their status.</Alert>
            ) : (
              <Alert tone="signal" icon={Zap} title="Matching in progress">ER-Sync is ranking hospitals and requesting a bed. You can follow every step live in the Command Center.</Alert>
            )}
            <div className="flex flex-wrap gap-2">
              <Badge tone={severityTone(created.severity)} dot pulse={created.severity === 'CRITICAL'}>{titleCase(created.severity)} severity</Badge>
              <Badge tone="neutral"><Users className="size-3" />{created.patient_count} patient(s)</Badge>
              <Badge tone="info">{titleCase(created.status)}</Badge>
            </div>
            {created.requirements?.length > 0 && (
              <div>
                <p className="eyebrow mb-2">Triage identified</p>
                <div className="flex flex-wrap gap-2">
                  {created.requirements.map((r, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 rounded-lg border border-ink-100 bg-ink-25 px-2 py-1 text-[12px] font-semibold text-ink-700">
                      {r.requirement_type === 'SPECIALTY' ? <Stethoscope className="size-3.5 text-info-600" /> : r.requirement_type === 'FACILITY' ? <Building2 className="size-3.5 text-plum-600" /> : <Bed className="size-3.5 text-signal-600" />}
                      {r.requirement_name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
