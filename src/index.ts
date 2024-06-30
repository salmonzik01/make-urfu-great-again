import { appendFileSync, writeFileSync, access, readdirSync, constants as fsconstants, mkdirSync } from "node:fs";
import { rimraf } from "rimraf";
import { resolve } from "node:path";

const BASE_API_URL = "https://urfu.ru/api/entrant/"
const TEMP_PATH = resolve(__dirname, "..", "temp");

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getEntrantList(page: number, size: number) {
  let raw;
  try {
    raw = await fetch(`${BASE_API_URL}?page=${page}&size=${size}`);
  } catch (err) {
    console.log(err)
  }

  return raw!.json();
}

async function writeToEntrants(list: any) {
  if (!list.page || !list.size) {
    console.log('Неизвестная ошибка!')
    console.log(list)
    process.exit(1)
  }

  for (let entrant of list.items) {
    for (let application of entrant.applications) {
      // Защита от недопустимых символов в названии программ
      const programName = application.program.replace(/[\/\\\?\%\*\:\|\"\'><]/g, '');
      let programPath = resolve(TEMP_PATH, programName);
      // Защита от слишком длинных названий программ
      if (programPath.length > 120) {
        programPath = programPath.slice(0, 120);
      }
      programPath += '.json';

      const entrantInfo = JSON.stringify({
        regnum: entrant.regnum,
        snils: entrant.snils,
        total_mark: application.total_mark,
        original: application.edu_doc_original,
        priority: application.priority,
        status: application.status,
        competition: application.competition,
        compensation: application.compensation
      });

      access(programPath, fsconstants.F_OK, (err) => {
        if (err) writeFileSync(programPath, '[' + entrantInfo);
        else appendFileSync(programPath, "," + entrantInfo);
      });
    }
  }
  console.log("Обработана одна страница!")
}

async function main() {
  // Подготовка к записи файлов
  await rimraf(TEMP_PATH);
  mkdirSync(TEMP_PATH, { recursive: true });

  let entrantsAmount = await getEntrantList(1, 5);

  if (!entrantsAmount.count) throw "Unknown error";

  entrantsAmount = entrantsAmount.count;
  const pagesNumber = Math.ceil(entrantsAmount / 100)

  for (let i = 1; i < pagesNumber+1; i++) {
    await sleep(1000);

    await writeToEntrants(await getEntrantList(i, 100));
  }

  // Закрываем JSONы
  const tempFiles = readdirSync(TEMP_PATH);
  for (let file of tempFiles) {
    appendFileSync(resolve(TEMP_PATH, file), ']')
  }
}

main()