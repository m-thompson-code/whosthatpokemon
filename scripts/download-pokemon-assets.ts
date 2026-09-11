import { mkdir, open, rename, rm, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const DEFAULT_START_ID = 1;
const DEFAULT_END_ID = 1025;
const DEFAULT_CONCURRENCY = 6;
const MAX_ATTEMPTS = 3;
const SOURCE_BASE_URL =
  "https://www.pokemon.com/static-assets/content-assets/cms2/img/pokedex/full";
const OUTPUT_DIRECTORY = resolve("public/assets/pokemon");
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

type Options = {
  start: number;
  end: number;
  concurrency: number;
  force: boolean;
};

type DownloadResult = "downloaded" | "skipped";

const readNumberFlag = (argumentsList: string[], flag: string, fallback: number) => {
  const index = argumentsList.indexOf(flag);
  if (index === -1) return fallback;

  const value = Number(argumentsList[index + 1]);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${flag} must be a positive integer.`);
  }

  return value;
};

const parseOptions = (): Options => {
  const argumentsList = process.argv.slice(2);
  const options = {
    start: readNumberFlag(argumentsList, "--start", DEFAULT_START_ID),
    end: readNumberFlag(argumentsList, "--end", DEFAULT_END_ID),
    concurrency: readNumberFlag(
      argumentsList,
      "--concurrency",
      DEFAULT_CONCURRENCY,
    ),
    force: argumentsList.includes("--force"),
  };

  if (options.end < options.start) {
    throw new Error("--end must be greater than or equal to --start.");
  }

  if (options.concurrency > 20) {
    throw new Error("--concurrency cannot exceed 20.");
  }

  return options;
};

const formatId = (id: number) => id.toString().padStart(3, "0");

const hasPngSignature = (buffer: Uint8Array) =>
  buffer.length >= PNG_SIGNATURE.length &&
  PNG_SIGNATURE.every((byte, index) => buffer[index] === byte);

const isValidExistingPng = async (path: string) => {
  try {
    const fileStats = await stat(path);
    if (fileStats.size <= PNG_SIGNATURE.length) return false;

    const file = await open(path, "r");
    try {
      const signature = Buffer.alloc(PNG_SIGNATURE.length);
      await file.read(signature, 0, signature.length, 0);
      return hasPngSignature(signature);
    } finally {
      await file.close();
    }
  } catch {
    return false;
  }
};

const wait = (milliseconds: number) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

const downloadPokemon = async (id: number, force: boolean): Promise<DownloadResult> => {
  const fileName = `${formatId(id)}.png`;
  const outputPath = resolve(OUTPUT_DIRECTORY, fileName);
  const temporaryPath = `${outputPath}.part`;

  if (!force && await isValidExistingPng(outputPath)) {
    return "skipped";
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`${SOURCE_BASE_URL}/${fileName}`, {
        headers: { "User-Agent": "whosthatpokemon-asset-importer/1.0" },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!hasPngSignature(bytes)) {
        throw new Error("response was not a PNG image");
      }

      await writeFile(temporaryPath, bytes);
      await rename(temporaryPath, outputPath);
      return "downloaded";
    } catch (error) {
      await rm(temporaryPath, { force: true });
      if (attempt === MAX_ATTEMPTS) throw error;
      await wait(attempt * 500);
    }
  }

  throw new Error("download attempts exhausted");
};

const main = async () => {
  const options = parseOptions();
  const ids = Array.from(
    { length: options.end - options.start + 1 },
    (_, index) => options.start + index,
  );
  const failures: Array<{ id: number; message: string }> = [];
  let cursor = 0;
  let downloaded = 0;
  let skipped = 0;

  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  console.log(
    `Downloading Pokemon ${formatId(options.start)}-${formatId(options.end)} to ${OUTPUT_DIRECTORY}`,
  );

  const worker = async () => {
    while (cursor < ids.length) {
      const id = ids[cursor];
      cursor += 1;

      try {
        const result = await downloadPokemon(id, options.force);
        if (result === "downloaded") downloaded += 1;
        else skipped += 1;
      } catch (error) {
        failures.push({
          id,
          message: error instanceof Error ? error.message : String(error),
        });
      }

      const completed = downloaded + skipped + failures.length;
      if (completed % 25 === 0 || completed === ids.length) {
        console.log(
          `${completed}/${ids.length} complete (${downloaded} downloaded, ${skipped} skipped, ${failures.length} failed)`,
        );
      }
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(options.concurrency, ids.length) },
      () => worker(),
    ),
  );

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`${formatId(failure.id)}.png: ${failure.message}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Finished: ${downloaded} downloaded, ${skipped} already present.`);
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});