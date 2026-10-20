// Gulf countries and cities, copied from Tutorcat (tutorcat/data/regions.json) so the sign-up form
// offers the same choices as Tutorcat's own. The English name is what's sent; the label is translated.
export interface Place {
  name: string;
  ar: string;
}
export interface Country extends Place {
  cities: Place[];
}

export const COUNTRIES: Country[] = [
  {
    name: "United Arab Emirates",
    ar: "الإمارات العربية المتحدة",
    cities: [
      { name: "Abu Dhabi", ar: "أبوظبي" },
      { name: "Dubai", ar: "دبي" },
      { name: "Sharjah", ar: "الشارقة" },
      { name: "Ajman", ar: "عجمان" },
      { name: "Umm Al Quwain", ar: "أم القيوين" },
      { name: "Ras Al Khaimah", ar: "رأس الخيمة" },
      { name: "Fujairah", ar: "الفجيرة" },
      { name: "Al Ain", ar: "العين" },
    ],
  },
  {
    name: "Saudi Arabia",
    ar: "المملكة العربية السعودية",
    cities: [
      { name: "Riyadh", ar: "الرياض" },
      { name: "Jeddah", ar: "جدة" },
      { name: "Mecca", ar: "مكة المكرمة" },
      { name: "Medina", ar: "المدينة المنورة" },
      { name: "Dammam", ar: "الدمام" },
      { name: "Khobar", ar: "الخبر" },
      { name: "Dhahran", ar: "الظهران" },
    ],
  },
  {
    name: "Qatar",
    ar: "قطر",
    cities: [
      { name: "Doha", ar: "الدوحة" },
      { name: "Al Rayyan", ar: "الريان" },
      { name: "Al Wakrah", ar: "الوكرة" },
      { name: "Lusail", ar: "لوسيل" },
    ],
  },
  {
    name: "Kuwait",
    ar: "الكويت",
    cities: [
      { name: "Kuwait City", ar: "مدينة الكويت" },
      { name: "Hawalli", ar: "حولي" },
      { name: "Salmiya", ar: "السالمية" },
      { name: "Al Ahmadi", ar: "الأحمدي" },
      { name: "Jahra", ar: "الجهراء" },
    ],
  },
  {
    name: "Bahrain",
    ar: "البحرين",
    cities: [
      { name: "Manama", ar: "المنامة" },
      { name: "Muharraq", ar: "المحرق" },
      { name: "Riffa", ar: "الرفاع" },
      { name: "Isa Town", ar: "مدينة عيسى" },
    ],
  },
  {
    name: "Oman",
    ar: "سلطنة عُمان",
    cities: [
      { name: "Muscat", ar: "مسقط" },
      { name: "Salalah", ar: "صلالة" },
      { name: "Sohar", ar: "صحار" },
      { name: "Nizwa", ar: "نزوى" },
      { name: "Sur", ar: "صور" },
    ],
  },
];

export const placeLabel = (place: Place, lang: "en" | "ar") => (lang === "ar" ? place.ar : place.name);
