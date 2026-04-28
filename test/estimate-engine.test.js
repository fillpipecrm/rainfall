import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateEstimate,
  defaultEstimateInput,
  largeRotorOptions,
  optionsWithWorkbookRates,
  sprayOptions,
} from "../src/estimate-engine.js";

function workbook(overrides = {}) {
  return {
    workbookId: "test-workbook",
    inventoryRows: [],
    noteTemplates: [],
    estimatingFactors: [],
    ...overrides,
  };
}

test("uses workbook nozzle factors over fallback option rates", () => {
  const input = defaultEstimateInput();
  const spray = sprayOptions.find((option) => option.label === "8Q");

  input.spray[spray.key] = 10;

  const rateWorkbook = workbook({
    estimatingFactors: [
      {
        factor_group: "nozzle_rates",
        label: "8Q",
        numeric_value: 1,
      },
    ],
  });
  const estimate = calculateEstimate(
    input,
    rateWorkbook,
  );

  assert.equal(optionsWithWorkbookRates([spray], rateWorkbook).at(0)?.gpm, 1);
  assert.equal(estimate.derived.sprayGpm, 10);
  assert.equal(estimate.derived.totalZones, 2);
});

test("maps tall large rotors to the 12 inch I-20 inventory row", () => {
  const input = defaultEstimateInput();
  const largeRotor = largeRotorOptions.find((option) => option.label === "I-20 - 1.5");

  input.largeRotor[largeRotor.key] = 2;
  input.largeRotorTall = 1;

  const estimate = calculateEstimate(
    input,
    workbook({
      inventoryRows: [
        {
          row_number: 5,
          category: "Sprinklers",
          sku: "I-20-04",
          description: "Hunter I-20 Rotary Sprinkler",
          unit_price: 14.54,
        },
        {
          row_number: 6,
          category: "Sprinklers",
          sku: "I-20-12",
          description: 'Hunter I-20 12" High Rotary Sprinklers',
          unit_price: 33.44,
        },
      ],
    }),
  );

  assert.equal(estimate.lineItems.find((item) => item.rowNumber === 5)?.quantity, 1);
  assert.equal(estimate.lineItems.find((item) => item.rowNumber === 6)?.quantity, 1);
  assert.equal(estimate.derived.laborComponents.rotarySprinklers, 1.6);
});
