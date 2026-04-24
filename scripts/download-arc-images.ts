import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DATA } from "../src/data/data.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "../assets/images");

function extFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const base = path.basename(pathname);
    const m = base.match(/\.(jpe?g|png|gif|webp|avif)$/i);
    return m ? m[1].toLowerCase().replace("jpeg", "jpg") : null;
  } catch {
    return null;
  }
}

function extFromContentType(ct: string | null): string {
  if (!ct) return "bin";
  const t = ct.split(";")[0]?.trim().toLowerCase() ?? "";
  if (t === "image/jpeg") return "jpg";
  if (t === "image/jpg") return "jpg";
  if (t === "image/png") return "png";
  if (t === "image/webp") return "webp";
  if (t === "image/gif") return "gif";
  if (t === "image/avif") return "avif";
  return "bin";
}

async function downloadToFile(
  url: string,
  destPathWithoutExt: string,
): Promise<void> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "onepace-arc-image-sync/1.0 (+https://github.com/local-dev-script)",
    },
  });
  if (!res.ok) {
    throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
  }
  const ext =
    extFromUrl(url) ?? extFromContentType(res.headers.get("content-type"));
  const suffix = ext === "bin" ? "bin" : ext;
  const finalPath = `${destPathWithoutExt}.${suffix}`;

  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(finalPath, buf);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const arcs = DATA.arcs;
  const errors: { arcId: number; label: string; error: string }[] = [];

  for (const arc of arcs) {
    const base = path.join(OUT_DIR, `arc-${arc.id}`);
    const tasks: Promise<void>[] = [];

    if (typeof arc.image === "string" && arc.image.length > 0) {
      tasks.push(
        downloadToFile(arc.image, `${base}-image`).catch((e: unknown) => {
          errors.push({
            arcId: arc.id,
            label: "image",
            error: e instanceof Error ? e.message : String(e),
          });
        }),
      );
    }

    if (typeof arc.altImage === "string" && arc.altImage.length > 0) {
      tasks.push(
        downloadToFile(arc.altImage, `${base}-alt`).catch((e: unknown) => {
          errors.push({
            arcId: arc.id,
            label: "altImage",
            error: e instanceof Error ? e.message : String(e),
          });
        }),
      );
    }

    await Promise.all(tasks);
  }

  console.log(
    `Wrote images under ${path.relative(process.cwd(), OUT_DIR) || "."}`,
  );
  console.log(`Processed ${arcs.length} arc(s).`);

  if (errors.length) {
    console.error("Failures:");
    for (const e of errors) {
      console.error(`  arc ${e.arcId} (${e.label}): ${e.error}`);
    }
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
