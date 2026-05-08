export const WORD_LIST: string[] = [
  "حديقة","مدرسة","طاولة","نافذة","رياضة","قيادة","نهاية","زيارة","كتابة","قصيدة",
  "صحراء","حلاوة","سيارة","حمامة","فاكهة","معلمة","عائلة","حقيبة","قلادة","بضاعة",
  "خارطة","طبيعة","شراعة","وثيقة","مناعة","فراشة","دجاجة","خيانة","ولاية","عمارة",
  "حرارة","تجارة","رفاهة","ذاكرة","جرامة","نجاحة","بلاغة","شجاعة","طفولة","رسالة",
  "بداية","حضارة","مثابة","غيابة","نظافة","شهادة","ضيافة","قضاءة","لياقة","كفاءة",
];

export function pickWord(): string {
  return WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
}

export function normalize(s: string): string {
  return s
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .trim();
}

export function getLetters(word: string): string[] {
  return normalize(word).split("");
}
