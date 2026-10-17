import { inventoryTests } from "./inventory.js";

inventoryTests([1280, 1440, 768, 390, 320].map((width) => ({ kind: "viewport", width })));
