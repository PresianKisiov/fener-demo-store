/**
 * Deletes the local database. The next `npm run dev` creates the tables
 * again and fills them with the demo data.
 */
import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), ".data");
fs.rmSync(dir, { recursive: true, force: true });
console.log("Базата е изтрита. Пусни `npm run dev`, за да се създаде наново с демо данните.");
