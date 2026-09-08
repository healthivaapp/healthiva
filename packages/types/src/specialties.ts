// ====================================================================
// HEALTHIVA SHARED MEDICAL SPECIALTIES DATASET
// Used across Web and Mobile for clinic onboarding and specialization
// ====================================================================

export interface MedicalSpecialty {
  id: string;
  name: string;
  category: string;
  icon?: string;
  defaultFeePaise?: number; // e.g. 30000 = ₹300
}

export const HEALTHIVA_SPECIALTIES: MedicalSpecialty[] = [
  {
    id: 'eye_ophthalmology',
    name: 'Eye / Ophthalmology',
    category: 'Specialist',
    defaultFeePaise: 35000,
  },
  {
    id: 'general_opd',
    name: 'General OPD / Family Physician',
    category: 'General',
    defaultFeePaise: 30000,
  },
  {
    id: 'dental',
    name: 'Dental / Dentistry',
    category: 'Dental',
    defaultFeePaise: 40000,
  },
  {
    id: 'ent',
    name: 'ENT (Ear, Nose, Throat)',
    category: 'Specialist',
    defaultFeePaise: 35000,
  },
  {
    id: 'orthopedic',
    name: 'Orthopedic',
    category: 'Surgery & Bones',
    defaultFeePaise: 45000,
  },
  {
    id: 'pediatrics',
    name: 'Pediatrics / Child Health',
    category: 'Children',
    defaultFeePaise: 35000,
  },
  {
    id: 'dermatology',
    name: 'Dermatology / Skin & Hair',
    category: 'Specialist',
    defaultFeePaise: 40000,
  },
  {
    id: 'gynecology',
    name: 'Gynecology & Obstetrics',
    category: 'Women Health',
    defaultFeePaise: 45000,
  },
  {
    id: 'cardiology',
    name: 'Cardiology / Heart',
    category: 'Specialist',
    defaultFeePaise: 50000,
  },
  {
    id: 'other',
    name: 'Other (Specify Custom Specialty)',
    category: 'Custom',
    defaultFeePaise: 30000,
  },
];
