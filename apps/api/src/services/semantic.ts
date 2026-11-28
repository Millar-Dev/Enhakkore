/**
 * Meaning-aware search without an outside AI service.
 *
 * A search is expanded with related terms from a concept map (so "human heart"
 * also finds "cardiology", "cardiovascular", "cardiac anatomy"), words are
 * reduced to simple stems ("studying" ≈ "study"), and near-misses of one
 * letter are tolerated. Results are ranked by where the match was found.
 *
 * This is a built-in synonym map, not a language model. It covers common
 * school and university subjects and can be extended here.
 */

const CONCEPTS: string[][] = [
  ['heart', 'cardiac', 'cardiology', 'cardiovascular', 'cardio', 'circulation', 'circulatory', 'coronary', 'ventricle', 'atrium', 'ecg'],
  ['human body', 'anatomy', 'physiology', 'organ', 'organs', 'body systems'],
  ['brain', 'neuro', 'neurology', 'neuroscience', 'nervous system', 'neuron', 'cognitive'],
  ['lung', 'lungs', 'respiratory', 'pulmonary', 'breathing', 'pulmonology'],
  ['kidney', 'renal', 'nephrology', 'urinary'],
  ['blood', 'haematology', 'hematology', 'anaemia', 'anemia'],
  ['medicine', 'medical', 'clinical', 'doctor', 'mbbs', 'md', 'health sciences', 'pathology', 'pharmacology', 'nursing'],
  ['pregnancy', 'obstetrics', 'gynaecology', 'gynecology', 'midwifery', 'maternal'],
  ['child health', 'paediatrics', 'pediatrics'],
  ['surgery', 'surgical', 'operative'],
  ['germs', 'microbiology', 'bacteria', 'virus', 'virology', 'infection', 'infectious'],
  ['genes', 'genetics', 'dna', 'heredity', 'genomics'],
  ['cells', 'cell biology', 'cytology', 'biology', 'life sciences'],
  ['plants', 'botany', 'agriculture', 'crops', 'agronomy'],
  ['animals', 'zoology', 'veterinary', 'vet'],
  ['chemistry', 'chemical', 'organic chemistry', 'inorganic', 'biochemistry', 'molecules', 'reactions'],
  ['physics', 'mechanics', 'electricity', 'magnetism', 'thermodynamics', 'optics', 'quantum'],
  ['maths', 'math', 'mathematics', 'algebra', 'calculus', 'geometry', 'trigonometry', 'statistics', 'probability'],
  ['money', 'finance', 'accounting', 'bookkeeping', 'economics', 'investment', 'banking', 'cpa', 'acca'],
  ['business', 'management', 'entrepreneurship', 'marketing', 'mba', 'commerce'],
  ['law', 'legal', 'llb', 'jurisprudence', 'constitution', 'contract law', 'criminal law'],
  ['coding', 'programming', 'software', 'computer science', 'developer', 'javascript', 'python', 'java', 'web development', 'it', 'ict'],
  ['data', 'data science', 'machine learning', 'ai', 'artificial intelligence', 'analytics'],
  ['engineering', 'civil engineering', 'mechanical engineering', 'electrical engineering', 'structures'],
  ['building', 'architecture', 'construction', 'design'],
  ['history', 'historical', 'heritage', 'past'],
  ['geography', 'maps', 'environment', 'climate', 'earth science'],
  ['politics', 'political science', 'government', 'international relations'],
  ['mind', 'psychology', 'mental health', 'behaviour', 'behavior', 'counselling', 'counseling'],
  ['society', 'sociology', 'social work', 'community development'],
  ['teaching', 'education', 'pedagogy', 'teacher training'],
  ['english', 'english language', 'ielts', 'toefl', 'grammar', 'writing', 'literature'],
  ['swahili', 'kiswahili'],
  ['french', 'français', 'francais', 'delf'],
  ['spanish', 'español', 'espanol', 'dele'],
  ['german', 'deutsch', 'goethe'],
  ['chinese', 'mandarin', 'hsk'],
  ['arabic', 'quran', 'quranic'],
  ['exam', 'exams', 'revision', 'past papers', 'necta', 'csee', 'acsee', 'form four', 'form six', 'finals'],
  ['art', 'drawing', 'painting', 'illustration', 'fine art'],
  ['music', 'music theory', 'singing', 'instrument', 'piano', 'guitar'],
  ['tourism', 'hospitality', 'travel', 'hotel management'],
  ['nutrition', 'diet', 'food science', 'dietetics'],
  ['fitness', 'sports science', 'exercise', 'physiotherapy', 'physio'],
];

function stem(word: string) {
  return word
    .toLowerCase()
    .replace(/(ies)$/, 'y')
    .replace(/(ing|ers|er|ed|es|s)$/, '')
    .replace(/[^a-z0-9]/g, '');
}

function words(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9àâçéèêëîïôûùüÿñæœ]+/i)
    .filter((word) => word.length > 1);
}

/** One edit apart (insert, delete or substitute) — for typos in longer words. */
function closeEnough(a: string, b: string) {
  if (a === b) return true;
  if (a.length < 5 || b.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

export interface ExpandedQuery {
  /** The searcher's own words (stemmed). */
  direct: string[];
  /** Related terms from the concept map (phrases kept whole). */
  related: string[];
}

export function expandQuery(query: string): ExpandedQuery {
  const lower = query.toLowerCase().trim();
  const direct = [...new Set(words(lower).map(stem).filter((word) => word.length > 1))];
  const related = new Set<string>();
  for (const group of CONCEPTS) {
    const hit = group.some((term) => {
      if (term.includes(' ')) return lower.includes(term);
      const termStem = stem(term);
      return direct.some((word) => word === termStem || (word.length > 4 && closeEnough(word, termStem)));
    });
    if (hit) for (const term of group) related.add(term);
  }
  return { direct, related: [...related] };
}

/**
 * Scores one text field. Direct words count more than related terms; every
 * direct word found is better than one found many times.
 */
export function scoreText(text: string | null | undefined, query: ExpandedQuery, weight: number) {
  if (!text) return 0;
  const lower = text.toLowerCase();
  const stems = new Set(words(lower).map(stem));
  let score = 0;
  for (const word of query.direct) {
    if (stems.has(word) || [...stems].some((candidate) => candidate.startsWith(word) && word.length >= 4) || [...stems].some((candidate) => closeEnough(candidate, word))) score += 2;
  }
  for (const term of query.related) {
    if (term.includes(' ') ? lower.includes(term) : stems.has(stem(term))) score += 1;
  }
  return score * weight;
}
