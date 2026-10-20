// Tutorcat's curriculum list (tutorcat/data/regions.json). The English name is what's stored;
// the label is translated.
export const CURRICULA = [
  { value: "British (IGCSE/A-Level)", key: "curriculum.british" },
  { value: "American (AP/SAT)", key: "curriculum.american" },
  { value: "IB", key: "curriculum.ib" },
  { value: "Indian (CBSE/ICSE)", key: "curriculum.indian" },
  { value: "French", key: "curriculum.french" },
  { value: "National curriculum", key: "curriculum.national" },
  { value: "University", key: "curriculum.university" },
] as const;

export const curriculumKey = (value: string) => CURRICULA.find((item) => item.value === value)?.key;
