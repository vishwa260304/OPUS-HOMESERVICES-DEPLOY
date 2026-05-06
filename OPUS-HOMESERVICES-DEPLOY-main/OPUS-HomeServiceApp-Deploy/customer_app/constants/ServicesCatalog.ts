export const SERVICES_CATALOG = [
  // Main categories
  "Healthcare",
  "Automobile",
  "Appliances",
  "Home",

  // Healthcare sections
  "Diagnostics Tests",
  "Comprehensive Health Checkups",
  "Advanced Diagnosis",
  "Physiotherapy",

  // Home services sections
  "Electrical Services",
  "Plumbing Services",
  "Carpentry Services",
  "Painting & Renovation",
  "Cleaning & Pest Control",

  // Automobile sections (Car/Bike)
  "General Maintenance & Repairs",
  "Engine & Electronic Services",
  "Tires & Wheels",
  "Detailing & Cleaning",
  "Acting Drivers",
  
] as const;

export type ServiceCatalogName = typeof SERVICES_CATALOG[number];


