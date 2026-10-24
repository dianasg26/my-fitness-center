import { norm } from "./util.js";

/* ---------------- muscles + exercises ---------------- */
export const MUSCLE_LABEL = {
  chest: "pecho", shoulders: "hombros", biceps: "bíceps", triceps: "tríceps", forearms: "antebrazo",
  core: "core", quads: "cuádriceps", glutes: "glúteos", hamstrings: "isquios", calves: "pantorrillas",
  back: "espalda", traps: "trapecio", lowback: "lumbar", cardio: "cardio",
};

// p = primary muscles, s = secondary
export const EXERCISES = [
  { n: "Press de banca", p: ["chest"], s: ["triceps", "shoulders"] },
  { n: "Press inclinado con mancuernas", p: ["chest"], s: ["shoulders", "triceps"] },
  { n: "Aperturas", p: ["chest"], s: ["shoulders"] },
  { n: "Fondos", p: ["chest", "triceps"], s: ["shoulders"] },
  { n: "Flexiones", p: ["chest"], s: ["triceps", "core"] },
  { n: "Sentadilla", p: ["quads", "glutes"], s: ["hamstrings", "core"] },
  { n: "Prensa de piernas", p: ["quads"], s: ["glutes"] },
  { n: "Zancadas", p: ["quads", "glutes"], s: ["hamstrings"] },
  { n: "Sentadilla búlgara", p: ["quads", "glutes"], s: ["hamstrings"] },
  { n: "Extensión de cuádriceps", p: ["quads"], s: [] },
  { n: "Peso muerto", p: ["hamstrings", "glutes", "lowback"], s: ["back", "traps"] },
  { n: "Peso muerto rumano", p: ["hamstrings", "glutes"], s: ["lowback"] },
  { n: "Curl femoral", p: ["hamstrings"], s: [] },
  { n: "Hip thrust", p: ["glutes"], s: ["hamstrings"] },
  { n: "Máquina de glúteos", p: ["glutes"], s: [] },
  { n: "Patada de glúteo", p: ["glutes"], s: [] },
  { n: "Abducción de cadera", p: ["glutes"], s: [] },
  { n: "Elevación de talones", p: ["calves"], s: [] },
  { n: "Remo con barra", p: ["back"], s: ["biceps", "lowback"] },
  { n: "Remo en polea", p: ["back"], s: ["biceps"] },
  { n: "Jalón al pecho", p: ["back"], s: ["biceps"] },
  { n: "Dominadas", p: ["back"], s: ["biceps", "forearms"] },
  { n: "Face pull", p: ["shoulders", "traps"], s: ["back"] },
  { n: "Encogimientos", p: ["traps"], s: ["forearms"] },
  { n: "Press militar", p: ["shoulders"], s: ["triceps", "traps"] },
  { n: "Elevaciones laterales", p: ["shoulders"], s: [] },
  { n: "Curl de bíceps", p: ["biceps"], s: ["forearms"] },
  { n: "Curl martillo", p: ["biceps", "forearms"], s: [] },
  { n: "Extensión de tríceps", p: ["triceps"], s: [] },
  { n: "Press francés", p: ["triceps"], s: [] },
  { n: "Plancha", p: ["core"], s: ["shoulders"] },
  { n: "Abdominales", p: ["core"], s: [] },
  { n: "Elevación de piernas", p: ["core"], s: ["quads"] },
  { n: "Hiperextensiones", p: ["lowback", "glutes"], s: ["hamstrings"] },
  { n: "Elíptica", p: ["cardio"], s: [] },
  { n: "Caminadora", p: ["cardio"], s: [] },
  { n: "Bicicleta estática", p: ["cardio"], s: ["quads"] },
];
export const EXERCISE_NAMES = EXERCISES.map((e) => e.n);

const RULES = [
  [/press.*(banca|pecho|inclin|declin)|aperturas|pec deck|cruce.*polea|flexion/, ["chest"], ["triceps", "shoulders"]],
  [/sentadilla|prensa|zancada|desplante|extension.*cuad|hack/, ["quads", "glutes"], ["hamstrings"]],
  [/peso muerto rumano|femoral|isquio/, ["hamstrings", "glutes"], ["lowback"]],
  [/peso muerto/, ["hamstrings", "glutes", "lowback"], ["back"]],
  [/hip thrust|gluteo|patada|abduccion/, ["glutes"], ["hamstrings"]],
  [/talon|gemelo|pantorrilla/, ["calves"], []],
  [/remo|jalon|dominada|pulldown|lat/, ["back"], ["biceps"]],
  [/trapecio|encogimiento|face pull/, ["traps", "shoulders"], []],
  [/militar|hombro|lateral|arnold|elevacion.*frontal|press.*hombro/, ["shoulders"], ["triceps"]],
  [/martillo/, ["biceps", "forearms"], []],
  [/curl|bicep/, ["biceps"], ["forearms"]],
  [/tricep|frances|fondos|patada.*tricep|copa/, ["triceps"], []],
  [/plancha|abdominal|crunch|core|abdomen|oblicu|elevacion.*piernas|ab wheel/, ["core"], []],
  [/lumbar|hiperextension|buenos dias/, ["lowback", "glutes"], []],
  [/eliptica|caminadora|bicicleta|correr|trote|cardio|remo.*ergo|escaladora|saltar/, ["cardio"], []],
];
export function muscleFor(name) {
  const n = norm(name || "");
  const hit = EXERCISES.find((e) => norm(e.n) === n);
  if (hit) return { p: hit.p, s: hit.s };
  for (const [re, p, s] of RULES) if (re.test(n)) return { p, s };
  return { p: [], s: [] };
}

export const TAGS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo", "Pierna", "Glúteo", "Espalda", "Pecho", "Hombro", "Brazo", "Core", "Full Body", "Cardio"];
export const WEEKDAY_TAGS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/* ---------------- phrases ---------------- */
export const PHRASES = {
  menstrual: [
    "Descansar hoy también es construir el hábito. No te detienes, te cuidas.",
    "Tu cuerpo hace trabajo invisible. Ve con calma y sigue presente.",
    "Baja el ritmo, no el compromiso. Mañana sigues sumando.",
  ],
  folicular: [
    "Tu energía está despertando. Buen día para subirle un poco al peso.",
    "Momento de construir: prueba algo nuevo en tu rutina hoy.",
    "Vas de subida. Suma un hábito extra hoy.",
  ],
  ovulatoria: [
    "Estás en tu pico. Hoy es día de romper un récord personal.",
    "Fuerza al máximo. Métele con todo, tu cuerpo está listo.",
    "Pocas veces tienes tanta energía disponible. Úsala.",
  ],
  lutea: [
    "Menos energía no es menos disciplina. Presente aunque sea con menos peso.",
    "Hoy toca sostener el hábito, no romper récords. Eso también cuenta.",
    "Constancia por encima de intensidad. Sigue apareciendo.",
  ],
  general: [
    "No se trata de un día perfecto, se trata de no soltar el hábito.",
    "Cada registro es un commit de la versión que estás construyendo.",
    "Disciplina es hacerlo aunque no tengas ganas. Hoy cuenta también.",
    "No compitas con ayer, compite con la que eras hace un mes.",
    "Pequeño y constante le gana a intenso y ocasional.",
    "Tu meta no se mueve. Tú sí, un poco cada día.",
  ],
};
export function pickPhrase(list, seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return list[h % list.length];
}

/* ---------------- foods (approximate values) ---------------- */
const v = (label, kcal, p, c, f) => ({ label, kcal, p, c, f });
export const FOOD_DB = [
  { name: "Huevo", unit: "1 pieza (50g)", variants: [v("Cocido", 78, 6.3, 0.6, 5.3), v("Frito", 90, 6.3, 0.4, 7), v("Revuelto", 91, 6.1, 1.6, 6.7), v("Estrellado", 92, 6.3, 0.5, 7)] },
  { name: "Clara de huevo", unit: "1 pieza (33g)", variants: [v("Cocida", 17, 3.6, 0.2, 0.1)] },
  { name: "Pechuga de pollo", unit: "100g", variants: [v("Asada", 165, 31, 0, 3.6), v("Hervida", 150, 29, 0, 3), v("Frita", 220, 19, 8, 13), v("Empanizada", 250, 18, 14, 14)] },
  { name: "Arroz blanco", unit: "100g cocido", variants: [v("Solo", 130, 2.7, 28, 0.3), v("Frito", 165, 3, 29, 4)] },
  { name: "Pasta", unit: "100g cocida", variants: [v("Sola", 158, 5.8, 31, 0.9), v("Con salsa de tomate", 130, 4.5, 24, 2)] },
  { name: "Frijoles", unit: "100g cocidos", variants: [v("De la olla", 132, 8.7, 23.7, 0.5), v("Refritos", 145, 8, 20, 4)] },
  { name: "Tortilla de maíz", unit: "1 pieza (25g)", variants: [v("Normal", 52, 1.4, 11, 0.5)] },
  { name: "Tortilla de harina", unit: "1 pieza (30g)", variants: [v("Normal", 90, 2.5, 15, 2)] },
  { name: "Tostada", unit: "1 pieza", variants: [v("Horneada", 60, 1.5, 10, 1.5), v("Frita", 90, 1.5, 11, 4.5)] },
  { name: "Quesadilla", unit: "1 pieza", variants: [v("De queso", 220, 10, 20, 11), v("De queso (tortilla de harina)", 300, 12, 27, 16)] },
  { name: "Aguacate", unit: "medio (100g)", variants: [v("Natural", 160, 2, 8.5, 14.7)] },
  { name: "Manzana", unit: "1 pieza (180g)", variants: [v("Con cáscara", 95, 0.5, 25, 0.3)] },
  { name: "Plátano", unit: "1 pieza (120g)", variants: [v("Natural", 105, 1.3, 27, 0.4)] },
  { name: "Mango", unit: "1 taza (165g)", variants: [v("Natural", 99, 1.4, 25, 0.6)] },
  { name: "Naranja", unit: "1 pieza (130g)", variants: [v("Natural", 62, 1.2, 15, 0.2), v("Jugo (1 vaso)", 112, 1.7, 26, 0.5)] },
  { name: "Uvas", unit: "1 taza (150g)", variants: [v("Naturales", 104, 1, 27, 0.2)] },
  { name: "Sandía", unit: "1 taza (150g)", variants: [v("Natural", 45, 1, 11, 0.2)] },
  { name: "Fresas", unit: "1 taza (150g)", variants: [v("Naturales", 48, 1, 11, 0.5)] },
  { name: "Pan blanco", unit: "1 rebanada (30g)", variants: [v("Normal", 80, 2.7, 15, 1)] },
  { name: "Pan integral", unit: "1 rebanada (30g)", variants: [v("Normal", 70, 3, 13, 1)] },
  { name: "Cereal de caja", unit: "1 taza (40g)", variants: [v("Azucarado", 150, 2, 34, 1), v("Integral/avena", 140, 4, 30, 1.5)] },
  { name: "Leche", unit: "1 taza (240ml)", variants: [v("Entera", 150, 8, 12, 8), v("Descremada", 90, 9, 12, 0.5), v("Deslactosada", 145, 8, 11, 8), v("De almendra", 40, 1, 2, 3)] },
  { name: "Yogur", unit: "1 taza (240g)", variants: [v("Natural", 100, 8, 12, 2.5), v("Griego", 130, 15, 6, 5), v("Con fruta", 150, 6, 24, 3)] },
  { name: "Queso", unit: "30g", variants: [v("Panela", 80, 6, 1, 6), v("Oaxaca", 100, 7, 1, 8), v("Manchego", 110, 7, 1, 9), v("Cottage (¼ taza)", 45, 6, 2, 1)] },
  { name: "Jamón de pavo", unit: "2 rebanadas (50g)", variants: [v("Normal", 55, 9, 2, 1.5)] },
  { name: "Atún", unit: "lata escurrida (140g)", variants: [v("En agua", 130, 28, 0, 1), v("En aceite", 220, 25, 0, 13)] },
  { name: "Salmón", unit: "100g", variants: [v("Asado", 210, 22, 0, 13)] },
  { name: "Carne de res molida", unit: "100g cocida", variants: [v("Magra", 215, 26, 0, 12), v("Regular", 250, 24, 0, 17)] },
  { name: "Carne de res", unit: "100g", variants: [v("Asada", 220, 26, 0, 12)] },
  { name: "Proteína en polvo (whey)", unit: "1 scoop (30g)", variants: [v("Con agua", 120, 24, 3, 1.5), v("Con leche entera", 270, 32, 15, 9.5)] },
  { name: "Avena", unit: "1 taza cocida (240g)", variants: [v("Con agua", 150, 5, 27, 3), v("Con leche", 220, 9, 31, 6)] },
  { name: "Papa", unit: "100g", variants: [v("Cocida", 87, 2, 20, 0.1), v("Al horno", 93, 2.5, 21, 0.1), v("Frita", 310, 3.5, 41, 15)] },
  { name: "Elote", unit: "1 pieza (150g)", variants: [v("Cocido", 96, 3.4, 21, 1.5), v("Asado con mayonesa y queso", 250, 6, 28, 13)] },
  { name: "Nueces y semillas", unit: "30g (puñado)", variants: [v("Nuez", 196, 4.6, 4, 19.5), v("Almendra", 170, 6, 6, 15), v("Cacahuate", 165, 7, 6, 14)] },
  { name: "Crema de cacahuate", unit: "1 cda (16g)", variants: [v("Normal", 95, 4, 3, 8)] },
  { name: "Chocolate amargo", unit: "30g", variants: [v("70% cacao", 170, 2, 13, 12)] },
  { name: "Refresco de cola", unit: "lata (355ml)", variants: [v("Normal", 140, 0, 39, 0), v("Light/cero", 1, 0, 0.3, 0)] },
  { name: "Café", unit: "1 taza (240ml)", variants: [v("Negro", 2, 0.3, 0, 0), v("Con leche", 60, 3, 5, 3), v("Con leche y azúcar", 90, 3, 13, 3)] },
  { name: "Pizza", unit: "1 rebanada (110g)", variants: [v("Queso", 285, 12, 36, 10), v("Pepperoni", 320, 13, 35, 14)] },
  { name: "Hamburguesa", unit: "1 pieza", variants: [v("Sencilla", 295, 17, 28, 13), v("Con queso", 350, 19, 29, 17)] },
  { name: "Tacos", unit: "1 pieza", variants: [v("De canasta", 130, 6, 15, 5), v("Al pastor", 100, 8, 9, 4), v("De bistec", 140, 9, 11, 7)] },
  { name: "Tamal", unit: "1 pieza (120g)", variants: [v("De pollo", 230, 9, 25, 10), v("De rajas con queso", 260, 8, 26, 14)] },
  { name: "Brócoli", unit: "1 taza (150g)", variants: [v("Cocido", 55, 3.7, 11, 0.6), v("Crudo", 30, 2.5, 6, 0.3)] },
  { name: "Espinaca", unit: "1 taza", variants: [v("Cruda (30g)", 7, 1, 1, 0.1), v("Cocida (180g)", 40, 5, 7, 0.5)] },
  { name: "Pepino", unit: "1 taza (120g)", variants: [v("Crudo", 16, 0.7, 4, 0.1)] },
  { name: "Lentejas", unit: "1 taza cocida (200g)", variants: [v("Cocidas", 230, 18, 40, 0.8)] },
  { name: "Ensalada verde sin aderezo", unit: "1 taza (60g)", variants: [v("Sola", 15, 1, 3, 0.2)] },
];
