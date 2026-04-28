const toKey = (value) => value.replaceAll(/[^a-zA-Z0-9]+/g, "_");
const normalizeLabel = (value) => String(value ?? "").replaceAll(/\s+/g, " ").trim().toLowerCase();

export const sprayOptions = [
  ["8Q", 0.18],
  ["8H", 0.34],
  ["8TQ", 0.54],
  ["8F", 0.68],
  ["10Q", 0.28],
  ["10H", 0.55],
  ["10TQ", 0.84],
  ["10F", 1.08],
  ["12Q", 0.39],
  ["12H", 0.79],
  ["12TQ", 1.19],
  ["12F", 1.59],
  ["15Q", 0.6],
  ["15H", 1.25],
  ["15TQ", 1.82],
  ["15F", 2.35],
  ["L/RCS", 0.34],
  ["4X30SST", 0.67],
].map(([label, gpm]) => ({ key: toKey(label), label, gpm }));

export const rotorOptions = [
  ["1000-90", 0.25],
  ["1000-180", 0.5],
  ["1000-270", 0.75],
  ["1000-360", 1],
  ["2000-90", 0.42],
  ["2000-180", 0.74],
  ["2000-270", 1.17],
  ["2000-360", 1.56],
  ["3000-90", 0.91],
  ["3000-180", 1.93],
  ["3000-270", 2.89],
  ["3000-360", 3.86],
].map(([label, gpm]) => ({ key: toKey(label), label, gpm }));

export const largeRotorOptions = [
  ["I-20 - 1.5", 1.5],
  ["I-20 - 2", 2],
  ["I-20 - 2.5", 2.5],
  ["I20 - 3", 3],
  ["I-20 - 4", 4],
].map(([label, gpm]) => ({ key: toKey(label), label, gpm }));

export const rainBirdRotorOptions = [
  ["RB3500- .75", 0.75],
  ["RB3500- 1.0", 1],
  ["RB3500- 1.5", 1.5],
  ["RB3500- 2.0", 2],
  ["RB3500- 3.0", 3],
].map(([label, gpm]) => ({ key: toKey(label), label, gpm }));

export const controllerGroups = [
  {
    key: "proC",
    label: "Pro-C",
    slots: [
      { key: "b", label: "4" },
      { key: "c", label: "7" },
      { key: "d", label: "10" },
      { key: "e", label: "13" },
      { key: "f", label: "16" },
      { key: "g", label: "23" },
      { key: "h", label: "2W-28max + 4" },
    ],
  },
  {
    key: "hpc",
    label: "HPC",
    slots: [
      { key: "b", label: "4" },
      { key: "c", label: "7" },
      { key: "d", label: "10" },
      { key: "e", label: "13" },
      { key: "f", label: "16" },
      { key: "g", label: "23" },
      { key: "h", label: "2W-28max + 4" },
    ],
  },
  {
    key: "icc2Plastic",
    label: "ICC2 Plastic",
    slots: [
      { key: "b", label: "8" },
      { key: "c", label: "16" },
      { key: "d", label: "24" },
      { key: "e", label: "32" },
      { key: "f", label: "38" },
      { key: "g", label: "54" },
    ],
  },
  {
    key: "hccPlastic",
    label: "HCC Plastic",
    slots: [
      { key: "b", label: "8" },
      { key: "c", label: "16" },
      { key: "d", label: "24" },
      { key: "e", label: "32" },
      { key: "f", label: "40" },
      { key: "g", label: "54" },
    ],
  },
  {
    key: "icc2Metal",
    label: "ICC2 Metal",
    slots: [
      { key: "b", label: "8" },
      { key: "c", label: "16" },
      { key: "d", label: "24" },
      { key: "e", label: "32" },
      { key: "f", label: "38" },
      { key: "g", label: "54" },
      { key: "h", label: "2W-54max" },
    ],
  },
  {
    key: "hccMetal",
    label: "HCC Metal",
    slots: [
      { key: "b", label: "8" },
      { key: "c", label: "16" },
      { key: "d", label: "24" },
      { key: "e", label: "32" },
      { key: "f", label: "40" },
      { key: "g", label: "54" },
      { key: "h", label: "2W-54max" },
    ],
  },
  {
    key: "hydroRain",
    label: "Hydro-Rain",
    slots: [
      { key: "b", label: "16" },
      { key: "c", label: "24" },
    ],
  },
  {
    key: "hydroRainHsc",
    label: "Hydro Rain HSC",
    slots: [
      { key: "b", label: "1" },
      { key: "c", label: "2" },
      { key: "d", label: "4" },
      { key: "e", label: "8" },
      { key: "f", label: "16" },
    ],
  },
  {
    key: "btNode",
    label: "BT Node",
    slots: [
      { key: "b", label: "1" },
      { key: "c", label: "2" },
      { key: "d", label: "4" },
    ],
  },
];

const backflowKeys = [
  "febco850_34",
  "febco850_1",
  "febco765_34",
  "febco765_1",
  "febco825_34",
  "febco825_1",
];

function zeroMap(options) {
  return Object.fromEntries(options.map((option) => [option.key, 0]));
}

export function defaultEstimateInput() {
  return {
    title: "",
    proposalNumber: "",
    clientName: "",
    address1: "",
    city: "",
    state: "",
    postalCode: "",
    phone: "",
    email: "",
    workingGpm: 8,
    laborRate: 70,
    taxRate: 0.0625,
    profitMargin: 0.25,
    electricianFee: 0,
    plumberFee: 0,
    additionalLaborHours: 0,
    dripAreaSqFt: 0,
    dripZoneCount: 0,
    treeRingCount: 0,
    spray12Tall: 0,
    spray6Tall: 0,
    stream12Tall: 0,
    stream6Tall: 0,
    largeRotorTall: 0,
    yardFaucetCount: 0,
    rainSwitchCount: 0,
    filterRequiredCount: 0,
    boosterPumpCount: 0,
    spray: zeroMap(sprayOptions),
    rotor: zeroMap(rotorOptions),
    largeRotor: zeroMap(largeRotorOptions),
    rainBirdRotor: zeroMap(rainBirdRotorOptions),
    dripLengths: { level1: 0, level2: 0, level3: 0, level4: 0 },
    mainlineFeet: { one: 0, oneQuarter: 0, oneHalf: 0 },
    backflow: Object.fromEntries(backflowKeys.map((key) => [key, 0])),
    wireFeet: {
      wire18_13: 0,
      wire18_9: 0,
      wire18_7: 0,
      wire18_5: 0,
      wire18_3: 0,
      decoder: 0,
    },
    controllers: Object.fromEntries(
      controllerGroups.map((group) => [
        group.key,
        Object.fromEntries(group.slots.map((slot) => [slot.key, 0])),
      ]),
    ),
  };
}

function toNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number.parseFloat(String(value));
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function parseEstimateInput(form) {
  const input = defaultEstimateInput();

  for (const field of [
    "title",
    "proposalNumber",
    "clientName",
    "address1",
    "city",
    "state",
    "postalCode",
    "phone",
    "email",
  ]) {
    input[field] = String(form[field] ?? "").trim();
  }

  for (const field of [
    "workingGpm",
    "laborRate",
    "taxRate",
    "profitMargin",
    "electricianFee",
    "plumberFee",
    "additionalLaborHours",
    "dripAreaSqFt",
    "dripZoneCount",
    "treeRingCount",
    "spray12Tall",
    "spray6Tall",
    "stream12Tall",
    "stream6Tall",
    "largeRotorTall",
    "yardFaucetCount",
    "rainSwitchCount",
    "filterRequiredCount",
    "boosterPumpCount",
  ]) {
    input[field] = toNumber(form[field]);
  }

  for (const option of sprayOptions) {
    input.spray[option.key] = toNumber(form[`spray_${option.key}`]);
  }

  for (const option of rotorOptions) {
    input.rotor[option.key] = toNumber(form[`rotor_${option.key}`]);
  }

  for (const option of largeRotorOptions) {
    input.largeRotor[option.key] = toNumber(form[`large_rotor_${option.key}`]);
  }

  for (const option of rainBirdRotorOptions) {
    input.rainBirdRotor[option.key] = toNumber(form[`rainbird_rotor_${option.key}`]);
  }

  for (const level of ["level1", "level2", "level3", "level4"]) {
    input.dripLengths[level] = toNumber(form[`drip_${level}`]);
  }

  input.mainlineFeet.one = toNumber(form.mainline_one);
  input.mainlineFeet.oneQuarter = toNumber(form.mainline_one_quarter);
  input.mainlineFeet.oneHalf = toNumber(form.mainline_one_half);

  for (const key of backflowKeys) {
    input.backflow[key] = toNumber(form[`backflow_${key}`]);
  }

  for (const key of Object.keys(input.wireFeet)) {
    input.wireFeet[key] = toNumber(form[`wire_${key}`]);
  }

  for (const group of controllerGroups) {
    for (const slot of group.slots) {
      input.controllers[group.key][slot.key] = toNumber(
        form[`controller_${group.key}_${slot.key}`],
      );
    }
  }

  return input;
}

function sumValues(object) {
  return Object.values(object).reduce((total, value) => total + value, 0);
}

function roundUp(value) {
  return Math.ceil(value);
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function workbookFactors(workbook, group) {
  return (workbook.estimatingFactors ?? []).filter((factor) => factor.factor_group === group);
}

function workbookFactorMatch(workbook, group, pattern) {
  return workbookFactors(workbook, group).find(
    (factor) =>
      factor.numeric_value !== null &&
      factor.numeric_value !== undefined &&
      pattern.test(factor.label ?? ""),
  );
}

function workbookFactorValue(workbook, group, pattern, fallback) {
  const match = workbookFactorMatch(workbook, group, pattern);

  return match ? Number(match.numeric_value) : fallback;
}

function workbookNozzleRate(workbook, label, fallback) {
  const normalized = normalizeLabel(label);
  const match = workbookFactors(workbook, "nozzle_rates").find(
    (factor) =>
      factor.numeric_value !== null &&
      factor.numeric_value !== undefined &&
      normalizeLabel(factor.label) === normalized,
  );

  return match ? Number(match.numeric_value) : fallback;
}

export function optionsWithWorkbookRates(options, workbook) {
  return options.map((option) => ({
    ...option,
    gpm: workbookNozzleRate(workbook, option.label, option.gpm),
  }));
}

function quantityFor(input, workbook) {
  const quantities = {};
  const controller = (groupKey, slotKey) => input.controllers[groupKey]?.[slotKey] ?? 0;
  const ratedSprayOptions = optionsWithWorkbookRates(sprayOptions, workbook);
  const ratedRotorOptions = optionsWithWorkbookRates(rotorOptions, workbook);
  const ratedLargeRotorOptions = optionsWithWorkbookRates(largeRotorOptions, workbook);
  const ratedRainBirdRotorOptions = optionsWithWorkbookRates(rainBirdRotorOptions, workbook);
  const sprayTotal = sumValues(input.spray);
  const sprayGpm = ratedSprayOptions.reduce(
    (sum, option) => sum + input.spray[option.key] * option.gpm,
    0,
  );
  const mpRotorTotal = sumValues(input.rotor);
  const mpRotorGpm = ratedRotorOptions.reduce(
    (sum, option) => sum + input.rotor[option.key] * option.gpm,
    0,
  );
  const largeRotorTotal = sumValues(input.largeRotor);
  const largeRotorGpm = ratedLargeRotorOptions.reduce(
    (sum, option) => sum + input.largeRotor[option.key] * option.gpm,
    0,
  );
  const rainBirdTotal = sumValues(input.rainBirdRotor);
  const rainBirdGpm = ratedRainBirdRotorOptions.reduce(
    (sum, option) => sum + input.rainBirdRotor[option.key] * option.gpm,
    0,
  );
  const totalRotorGpm = mpRotorGpm + largeRotorGpm + rainBirdGpm;
  const totalRotorCount = mpRotorTotal + largeRotorTotal + rainBirdTotal;
  const totalZones =
    roundUp(sprayGpm / Math.max(input.workingGpm, 1)) +
    roundUp(totalRotorGpm / Math.max(input.workingGpm, 1)) +
    input.dripZoneCount;
  const decoderDrivenControllers =
    controller("proC", "h") +
    controller("hpc", "h") +
    controller("icc2Plastic", "g") +
    controller("hccPlastic", "g") +
    controller("icc2Metal", "h") +
    controller("hccMetal", "h");
  const driplineTotalFeet =
    input.dripLengths.level1 +
    input.dripLengths.level2 +
    input.dripLengths.level3 +
    input.dripLengths.level4;
  const driplineAreaFeet = input.dripAreaSqFt * 0.7;
  const smallControllerBaseCount =
    controller("proC", "b") +
    controller("proC", "c") +
    controller("proC", "d") +
    controller("proC", "e") +
    controller("proC", "f") +
    controller("hpc", "b") +
    controller("hpc", "c") +
    controller("hpc", "d") +
    controller("hpc", "e") +
    controller("hpc", "f") +
    controller("hydroRain", "b") +
    controller("hydroRain", "c");
  const largeControllerBaseCount =
    controller("proC", "g") +
    controller("proC", "h") +
    controller("hpc", "g") +
    controller("hpc", "h") +
    controller("icc2Plastic", "b") +
    controller("icc2Plastic", "c") +
    controller("icc2Plastic", "d") +
    controller("icc2Plastic", "e") +
    controller("icc2Plastic", "f") +
    controller("icc2Plastic", "g") +
    controller("hccPlastic", "b") +
    controller("hccPlastic", "c") +
    controller("hccPlastic", "d") +
    controller("hccPlastic", "e") +
    controller("hccPlastic", "f") +
    controller("hccPlastic", "g") +
    controller("icc2Metal", "b") +
    controller("icc2Metal", "c") +
    controller("icc2Metal", "d") +
    controller("icc2Metal", "e") +
    controller("icc2Metal", "f") +
    controller("icc2Metal", "g") +
    controller("icc2Metal", "h") +
    controller("hccMetal", "b") +
    controller("hccMetal", "c") +
    controller("hccMetal", "d") +
    controller("hccMetal", "e") +
    controller("hccMetal", "f") +
    controller("hccMetal", "g") +
    controller("hccMetal", "h") +
    controller("hydroRainHsc", "b") +
    controller("hydroRainHsc", "c") +
    controller("hydroRainHsc", "d") +
    controller("hydroRainHsc", "e") +
    controller("hydroRainHsc", "f");
  const valveCount = totalZones;

  quantities[4] = rainBirdTotal;
  quantities[5] = Math.max(largeRotorTotal - input.largeRotorTall, 0);
  quantities[6] = input.largeRotorTall;
  quantities[7] = Math.max(
    sprayTotal + mpRotorTotal - input.spray12Tall - input.stream12Tall - input.spray6Tall - input.stream6Tall,
    0,
  );
  quantities[8] = input.spray6Tall + input.stream6Tall;
  quantities[9] = input.spray12Tall + input.stream12Tall;
  quantities[10] = sprayTotal;
  quantities[11] = mpRotorTotal;
  quantities[14] = sumValues(input.controllers.proC);
  quantities[15] = sumValues(input.controllers.hpc);
  quantities[16] = sumValues(input.controllers.hccPlastic);
  quantities[17] = sumValues(input.controllers.icc2Plastic);
  quantities[18] = sumValues(input.controllers.hccMetal);
  quantities[19] = sumValues(input.controllers.icc2Metal);
  quantities[21] =
    controller("icc2Plastic", "c") +
    controller("hccPlastic", "c") +
    controller("icc2Metal", "c") +
    controller("hccMetal", "c") +
    2 *
      (controller("icc2Plastic", "d") +
        controller("hccPlastic", "d") +
        controller("icc2Metal", "d") +
        controller("hccMetal", "d")) +
    3 *
      (controller("icc2Plastic", "e") +
        controller("hccPlastic", "e") +
        controller("icc2Metal", "e") +
        controller("hccMetal", "e")) +
    controller("icc2Plastic", "f") +
    controller("hccPlastic", "f") +
    4 * (controller("icc2Metal", "f") + controller("hccMetal", "f")) +
    3 * (controller("icc2Metal", "g") + controller("hccMetal", "g"));
  quantities[22] =
    controller("icc2Plastic", "f") +
    controller("hccPlastic", "f") +
    controller("icc2Metal", "g") +
    controller("hccMetal", "g");
  quantities[23] =
    controller("icc2Plastic", "g") +
    controller("hccPlastic", "g") +
    controller("icc2Metal", "h") +
    controller("hccMetal", "h");
  quantities[24] = decoderDrivenControllers * totalZones;
  quantities[25] =
    controller("proC", "c") +
    controller("hpc", "c") +
    2 * (controller("proC", "d") + controller("hpc", "d")) +
    3 * (controller("proC", "e") + controller("hpc", "e")) +
    controller("proC", "g") +
    controller("hpc", "g");
  quantities[26] = controller("proC", "f") + controller("hpc", "f");
  quantities[27] = controller("proC", "g") + controller("hpc", "g");
  quantities[28] = controller("proC", "h") + controller("hpc", "h");
  quantities[29] = controller("hydroRain", "b");
  quantities[30] = controller("hydroRain", "c");
  quantities[31] = sumValues(input.controllers.hydroRainHsc);
  quantities[32] =
    controller("hydroRainHsc", "c") +
    2 * controller("hydroRainHsc", "d") +
    3 * controller("hydroRainHsc", "e") +
    4 * controller("hydroRainHsc", "f");
  quantities[33] = controller("btNode", "b");
  quantities[34] = controller("btNode", "c");
  quantities[35] = controller("btNode", "d");
  quantities[37] = input.rainSwitchCount;
  quantities[41] = input.backflow.febco850_34;
  quantities[42] = input.backflow.febco850_1;
  quantities[43] = input.backflow.febco765_34;
  quantities[44] = input.backflow.febco765_1;
  quantities[45] = input.backflow.febco825_34;
  quantities[46] = input.backflow.febco825_1;
  quantities[48] = input.yardFaucetCount;
  quantities[49] = input.yardFaucetCount * 3;
  quantities[50] = input.yardFaucetCount;
  quantities[51] = input.yardFaucetCount;
  quantities[52] = input.yardFaucetCount;
  quantities[58] = totalZones * 0.5;
  quantities[62] = driplineTotalFeet;
  quantities[63] = input.dripZoneCount;
  quantities[64] = driplineTotalFeet / 25;
  quantities[65] = driplineTotalFeet / 20;
  quantities[66] = driplineTotalFeet / 50;
  quantities[69] = roundUp(driplineTotalFeet / 3);
  quantities[71] = roundUp(driplineTotalFeet / 500);
  quantities[75] = totalZones;
  quantities[76] = totalZones;
  quantities[77] = roundUp(totalZones / 3);
  quantities[78] = totalZones / 2;
  quantities[79] = input.backflow.febco825_1 * 2;
  quantities[80] = totalZones / 2 + input.backflow.febco825_1 * 2;
  quantities[83] = totalZones + totalZones * 0.5;
  quantities[84] = input.backflow.febco825_34 + input.backflow.febco825_1;
  quantities[85] = input.backflow.febco825_34 + input.backflow.febco825_1;
  quantities[89] = input.backflow.febco825_1 * 2;
  quantities[91] = totalZones / 20;
  quantities[92] = totalZones / 20;
  quantities[95] = totalZones * 2;
  quantities[98] = input.dripZoneCount;
  quantities[99] = totalZones;
  quantities[100] = totalZones;
  quantities[101] = roundUp(totalZones / 2);
  quantities[105] = totalZones / 2;
  quantities[106] = totalZones / 3;
  quantities[107] = totalZones / 4;
  quantities[108] = totalZones / 2;
  quantities[109] = input.backflow.febco825_34 + input.backflow.febco825_1;
  quantities[110] = input.backflow.febco765_34 + input.backflow.febco765_1;
  quantities[111] = input.backflow.febco850_34 + input.backflow.febco850_1;
  quantities[112] = input.rainSwitchCount;
  quantities[113] = input.filterRequiredCount;
  quantities[114] = input.yardFaucetCount;
  quantities[115] = input.boosterPumpCount;
  quantities[117] = input.boosterPumpCount;
  quantities[118] = Math.max(totalZones - input.dripZoneCount, 0);
  quantities[122] =
    (quantities[95] ?? 0) * 2 +
    (quantities[96] ?? 0) * 2 +
    (quantities[97] ?? 0) * 2 +
    (quantities[98] ?? 0) * 2 +
    (quantities[99] ?? 0) * 4 +
    (quantities[100] ?? 0) * 6 +
    (quantities[101] ?? 0) * 4 +
    (quantities[102] ?? 0) * 2 +
    (quantities[103] ?? 0) * 2 +
    (quantities[105] ?? 0) * 2 +
    (quantities[109] ?? 0) * 2 +
    (quantities[110] ?? 0) * 4;
  quantities[124] =
    (quantities[105] ?? 0) * 2 +
    (quantities[106] ?? 0) * 4 +
    (quantities[107] ?? 0) * 6 +
    (quantities[108] ?? 0) * 4 +
    (quantities[109] ?? 0) * 4 +
    (quantities[110] ?? 0) * 2 +
    (quantities[111] ?? 0) * 2 +
    (quantities[112] ?? 0) * 2 +
    (quantities[115] ?? 0) * 2;
  quantities[125] =
    quantities[112] * 4 +
    quantities[113] * 4 +
    quantities[114] * 2 +
    quantities[115] * 2;
  quantities[127] = input.filterRequiredCount;
  quantities[138] = totalZones * 2;
  quantities[139] = (quantities[5] + quantities[6] + quantities[7] + quantities[8] + quantities[9]) * 3 + (driplineTotalFeet / 100) * 5;
  quantities[140] = input.boosterPumpCount;
  quantities[141] = input.boosterPumpCount;
  quantities[144] = input.boosterPumpCount;
  quantities[146] = mpRotorTotal + largeRotorTotal + rainBirdTotal + driplineTotalFeet / 50;
  quantities[147] = quantities[4] + quantities[7] + quantities[8] + quantities[9];
  quantities[148] = quantities[5] + quantities[6];
  quantities[151] = input.filterRequiredCount * 5;
  quantities[152] = input.mainlineFeet.one + valveCount;
  quantities[153] = input.mainlineFeet.oneQuarter;
  quantities[154] = input.mainlineFeet.oneHalf;
  quantities[156] = input.wireFeet.wire18_13;
  quantities[157] = input.wireFeet.wire18_13;
  quantities[158] = input.wireFeet.wire18_9;
  quantities[159] = input.wireFeet.wire18_7;
  quantities[160] = input.wireFeet.wire18_5;
  quantities[161] = input.wireFeet.wire18_3;
  quantities[162] = input.wireFeet.decoder;

  const lineItems = workbook.inventoryRows
    .map((row) => {
      const quantity = quantities[row.row_number] ?? 0;
      const lineTotal = quantity * Number(row.unit_price ?? 0);

      return {
        rowNumber: row.row_number,
        category: row.category,
        sku: row.sku,
        description: row.description,
        quantity: roundMoney(quantity),
        unitPrice: Number(row.unit_price ?? 0),
        lineTotal: roundMoney(lineTotal),
      };
    })
    .filter((item) => item.quantity > 0);

  const materialsSubtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
  let laborRatesFromWorkbook = 0;
  const laborRate = (pattern, fallback) => {
    const match = workbookFactorMatch(workbook, "background_metrics", pattern);

    if (match) {
      laborRatesFromWorkbook += 1;
      return Number(match.numeric_value);
    }

    return fallback;
  };
  const laborRates = {
    spray4: laborRate(/4"\s*Spray Heads/i, 0.5),
    spray6: laborRate(/6"\s*Spray Heads/i, 0.6),
    spray12: laborRate(/12"\s*Spray Heads/i, 0.8),
    stream4: laborRate(/4"\s*Stream Rotor/i, 0.6),
    stream6: laborRate(/6"\s*Stream Rotor/i, 0.6),
    stream12: laborRate(/12"\s*Stream Rotor/i, 0.8),
    miniRotary: laborRate(/5".*Mini Rotary Sprinklers/i, 0.6),
    rotary12: laborRate(/12"\s*Rotary Sprinklers/i, 1),
    drip1: laborRate(/Dripline 1 per 100'/i, 1),
    drip2: laborRate(/Dripline 2 per 100'/i, 1.2),
    drip3: laborRate(/Dripline 3 per 100'/i, 1.4),
    drip4: laborRate(/Dripline 4 per 100'/i, 0.1),
    treeRing: laborRate(/Dripline per Tree Ring/i, 0.5),
    zoneValve: laborRate(/1"\s*zone valves/i, 1),
    smallControllerBase: laborRate(/Small Controllerbase/i, 0.5),
    largeControllerBase: laborRate(/Large Controller Base/i, 1),
    controllerPerZone: laborRate(/Controller, per zone/i, 0.2),
    mainlineOne: laborRate(/1"\s*Mainline.*ft/i, 0.02),
    mainlineOneQuarter: laborRate(/1 1\/4"\s*Mainline.*ft/i, 0.025),
    mainlineOneHalf: laborRate(/1 1\/2"\s*Mainline.*ft/i, 0.03),
    yardFaucet: laborRate(/Install Yard Faucets/i, 1),
  };
  const spray4Count = Math.max(sprayTotal - input.spray12Tall - input.spray6Tall, 0);
  const stream4Count = Math.max(mpRotorTotal - input.stream12Tall - input.stream6Tall, 0);
  const miniRotaryCount = Math.max(largeRotorTotal - input.largeRotorTall, 0) + rainBirdTotal;
  const laborComponents = {
    sprayHeads:
      spray4Count * laborRates.spray4 +
      input.spray6Tall * laborRates.spray6 +
      input.spray12Tall * laborRates.spray12,
    streamRotors:
      stream4Count * laborRates.stream4 +
      input.stream6Tall * laborRates.stream6 +
      input.stream12Tall * laborRates.stream12,
    rotarySprinklers:
      miniRotaryCount * laborRates.miniRotary + input.largeRotorTall * laborRates.rotary12,
    dripline:
      (input.dripLengths.level1 / 100) * laborRates.drip1 +
      (input.dripLengths.level2 / 100) * laborRates.drip2 +
      (input.dripLengths.level3 / 100) * laborRates.drip3 +
      (input.dripLengths.level4 / 100) * laborRates.drip4 +
      driplineAreaFeet / 100 +
      input.treeRingCount * laborRates.treeRing,
    valvesAndControllers:
      totalZones * laborRates.zoneValve +
      smallControllerBaseCount * laborRates.smallControllerBase +
      largeControllerBaseCount * laborRates.largeControllerBase +
      totalZones * laborRates.controllerPerZone,
    mainline:
      input.mainlineFeet.one * laborRates.mainlineOne +
      input.mainlineFeet.oneQuarter * laborRates.mainlineOneQuarter +
      input.mainlineFeet.oneHalf * laborRates.mainlineOneHalf,
    yardFaucets: input.yardFaucetCount * laborRates.yardFaucet,
    additional: input.additionalLaborHours,
  };
  const laborHours = Object.values(laborComponents).reduce((sum, value) => sum + value, 0);
  const laborCost = roundMoney(laborHours * input.laborRate);
  const tax = roundMoney(materialsSubtotal * input.taxRate);
  const subcontractors = roundMoney((input.electricianFee + input.plumberFee) / 0.9);
  const baseCost = materialsSubtotal + laborCost;
  const profitAmount = roundMoney(
    input.profitMargin >= 1 ? 0 : (baseCost * input.profitMargin) / (1 - input.profitMargin),
  );
  const total = roundMoney(materialsSubtotal + laborCost + tax + subcontractors + profitAmount);

  return {
    workbookId: workbook.workbookId,
    title:
      input.title ||
      (input.clientName
        ? `${input.clientName} irrigation estimate`
        : "Workbook-driven irrigation estimate"),
    proposalNumber: input.proposalNumber,
    lineItems,
    derived: {
      sprayTotal,
      sprayGpm: roundMoney(sprayGpm),
      mpRotorTotal,
      largeRotorTotal,
      rainBirdTotal,
      totalZones,
      driplineTotalFeet: roundMoney(driplineTotalFeet),
      driplineAreaFeet: roundMoney(driplineAreaFeet),
      decoderDrivenControllers,
      laborComponents: Object.fromEntries(
        Object.entries(laborComponents).map(([key, value]) => [key, roundMoney(value)]),
      ),
      formulaAudit: {
        inventoryRows: workbook.inventoryRows.length,
        pricedLineItems: lineItems.length,
        nozzleRatesFromWorkbook: workbookFactors(workbook, "nozzle_rates").filter(
          (factor) => factor.numeric_value !== null && factor.numeric_value !== undefined,
        ).length,
        laborRatesFromWorkbook,
      },
    },
    summary: {
      materialsSubtotal: roundMoney(materialsSubtotal),
      laborHours: roundMoney(laborHours),
      laborCost,
      tax,
      subcontractors,
      profitAmount,
      total,
    },
    noteTemplates: (workbook.noteTemplates ?? []).slice(0, 8),
  };
}

export function calculateEstimate(input, workbook) {
  return quantityFor(input, workbook);
}
