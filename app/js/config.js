// js/config.js — constants shared by every module.

const MAX_SIDE = 1600;
const LET = "ABCD";
const STORE = "sagotscan-v1";
const SIZES = [30, 50, 60];   // printed answer sheets the reader understands
const MAX_ITEMS = 60;         // most items a test can have
// The printed sheet a test of n items is answered on (the smallest one that fits), e.g. 40 items -> the 50-item sheet.
const sheetSizeFor = (n) => SIZES.find((s) => s >= n) || null;
const DEFAULT_TARGET = 75;   // target MPS (%), DepEd default; the teacher can change it
const MAX_SECTION_LEN = 40;
const isTestSize = (n) => Number.isInteger(n) && n >= 1 && n <= MAX_ITEMS;
