export interface RfcInput {
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  fechaNacimiento: string; // YYYY-MM-DD
}

const PARTICLES = new Set([
  "DE",
  "DEL",
  "LA",
  "LAS",
  "LOS",
  "Y",
  "A",
  "MC",
  "MAC",
  "VON",
  "VAN",
]);

const COMPOUND_FIRST_NAMES = new Set(["JOSE", "MARIA", "MA", "J"]);

const FORBIDDEN_WORDS = new Set(
  (
    "BUEI BUEY CACA CACO CAGA CAGO CAKA CAKO COGE COJA COJE COJI COJO CULO " +
    "FETO GUEY JOTO KACA KACO KAGA KAGO KOGE KOJO KAKA KULO MAME MAMO MEAR " +
    "MEAS MEON MIAR MION MOCO MULA PEDA PEDO PENE PUTA PUTO QULO RATA RUIN"
  ).split(" "),
);

const NAME_VALUES: Record<string, string> = {
  " ": "00",
  "&": "10",
  A: "11",
  B: "12",
  C: "13",
  D: "14",
  E: "15",
  F: "16",
  G: "17",
  H: "18",
  I: "19",
  J: "21",
  K: "22",
  L: "23",
  M: "24",
  N: "25",
  O: "26",
  P: "27",
  Q: "28",
  R: "29",
  S: "32",
  T: "33",
  U: "34",
  V: "35",
  W: "36",
  X: "37",
  Y: "38",
  Z: "39",
  Ñ: "40",
};

const HOMOCLAVE_CHARS = "123456789ABCDEFGHIJKLMNPQRSTUVWXYZ";
const CHECK_CHARS = "0123456789ABCDEFGHIJKLMN&OPQRSTUVWXYZ Ñ";

function normalize(value: string) {
  return value
    .toUpperCase()
    .replace(/Ñ/g, "\u0001")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0001/g, "Ñ")
    .replace(/[^A-ZÑ& ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function significantWords(value: string) {
  const words = normalize(value).split(" ").filter(Boolean);
  const filtered = words.filter((word) => !PARTICLES.has(word));
  return filtered.length > 0 ? filtered : words;
}

function letterOrX(char: string | undefined) {
  return char && /[A-Z]/.test(char) ? char : "X";
}

function pickFirstName(nombres: string) {
  const words = significantWords(nombres);
  if (words.length > 1 && COMPOUND_FIRST_NAMES.has(words[0])) return words[1];
  return words[0] ?? "";
}

function computeHomoclave(fullName: string) {
  const digits =
    "0" + [...fullName].map((char) => NAME_VALUES[char] ?? "00").join("");
  let sum = 0;
  for (let i = 0; i < digits.length - 1; i++) {
    sum += Number(digits.slice(i, i + 2)) * Number(digits[i + 1]);
  }
  const lastThree = sum % 1000;
  return (
    HOMOCLAVE_CHARS[Math.floor(lastThree / 34)] +
    HOMOCLAVE_CHARS[lastThree % 34]
  );
}

function computeCheckDigit(first12: string) {
  const sum = [...first12].reduce(
    (acc, char, index) => acc + CHECK_CHARS.indexOf(char) * (13 - index),
    0,
  );
  const remainder = sum % 11;
  if (remainder === 0) return "0";
  const digit = 11 - remainder;
  return digit === 10 ? "A" : String(digit);
}

export function calculateRfc(input: RfcInput): string | null {
  const paterno = significantWords(input.apellidoPaterno)[0];
  const materno = significantWords(input.apellidoMaterno)[0];
  const nombre = pickFirstName(input.nombres);
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.fechaNacimiento);

  if (!paterno || !nombre || !dateMatch) return null;

  const firstVowel = paterno.slice(1).match(/[AEIOU]/)?.[0];
  let letters =
    letterOrX(paterno[0]) +
    letterOrX(firstVowel) +
    letterOrX(materno?.[0]) +
    letterOrX(nombre[0]);

  if (FORBIDDEN_WORDS.has(letters)) letters = letters.slice(0, 3) + "X";

  const [, year, month, day] = dateMatch;
  const base = `${letters}${year.slice(2)}${month}${day}`;

  const fullName = normalize(
    [input.apellidoPaterno, input.apellidoMaterno, input.nombres].join(" "),
  );
  const withHomoclave = base + computeHomoclave(fullName);

  return withHomoclave + computeCheckDigit(withHomoclave);
}
