import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = "/Users/macbookair/lms-hipmi";
const skillDir = "/Users/macbookair/.codex/plugins/cache/openai-primary-runtime/presentations/26.909.12148/skills/presentations";
const runtimePython = "/Users/macbookair/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
const stagingRoot = path.join(workspaceDir, ".codex-presentations");
const outputDir = path.join(workspaceDir, "apps/web/private/materials");
const modules = JSON.parse(await fs.readFile(path.join(workspaceDir, "prisma/learning-modules.json"), "utf8"));
const { resolvePresentationFont, finalizePresentation } = await import(
  pathToFileURL(path.join(skillDir, "container_tools/artifact_tool_utils.mjs")).href,
);

await fs.mkdir(stagingRoot, { recursive: true });
await fs.mkdir(outputDir, { recursive: true });
const fontFamily = resolvePresentationFont();

const palette = {
  navy: "#0B1F3A",
  orange: "#F97316",
  amber: "#FBBF24",
  cream: "#FFF9F0",
  paper: "#FFFFFF",
  ink: "#172033",
  muted: "#5B667A",
  line: "#E8DCCB",
};

function addText(slide, text, position, style = {}) {
  const box = slide.shapes.add({
    geometry: "textbox",
    position,
    fill: "none",
    line: { fill: "none", width: 0 },
  });
  box.text = text;
  box.text.style = {
    typeface: fontFamily,
    fontSize: style.fontSize ?? 24,
    bold: style.bold ?? false,
    color: style.color ?? palette.ink,
    autoFit: "shrinkText",
    verticalAlignment: style.verticalAlignment ?? "middle",
    alignment: style.alignment ?? "left",
    ...style,
  };
  return box;
}

function addBand(slide, color, top, height) {
  return slide.shapes.add({
    geometry: "rect",
    position: { left: 0, top, width: 1280, height },
    fill: color,
    line: { fill: "none", width: 0 },
  });
}

function addHeader(slide, module, section, inverted = false) {
  addText(
    slide,
    `SUNRISE ACADEMY   /   MODUL ${String(module.position).padStart(2, "0")}`,
    { left: 72, top: 34, width: 720, height: 34 },
    { fontSize: 14, bold: true, color: inverted ? "#FFD7B5" : palette.orange, letterSpacing: 1.6 },
  );
  addText(slide, section, { left: 930, top: 34, width: 278, height: 34 }, {
    fontSize: 14,
    bold: true,
    color: inverted ? "#FFFFFF" : palette.muted,
    alignment: "right",
  });
}

function addFooter(slide, module, inverted = false) {
  addText(slide, "Digital Marketing & Affiliate", { left: 72, top: 674, width: 430, height: 24 }, {
    fontSize: 12,
    color: inverted ? "#B8C4D8" : palette.muted,
  });
  addText(slide, `${module.position} / 12`, { left: 1070, top: 674, width: 138, height: 24 }, {
    fontSize: 12,
    bold: true,
    color: inverted ? "#FFFFFF" : palette.navy,
    alignment: "right",
  });
}

function createDeck(module) {
  const deck = Presentation.create({ slideSize: { width: 1280, height: 720 } });

  {
    const slide = deck.slides.add();
    slide.background.fill = palette.navy;
    addBand(slide, palette.orange, 0, 12);
    addHeader(slide, module, module.minimumPlan, true);
    addText(slide, String(module.position).padStart(2, "0"), { left: 72, top: 118, width: 255, height: 210 }, {
      fontSize: 124,
      bold: true,
      color: palette.amber,
      verticalAlignment: "top",
    });
    addText(slide, module.title, { left: 350, top: 142, width: 810, height: 170 }, {
      fontSize: 47,
      bold: true,
      color: "#FFFFFF",
      verticalAlignment: "top",
    });
    addText(slide, module.description, { left: 354, top: 334, width: 750, height: 115 }, {
      fontSize: 24,
      color: "#D7DEEA",
      verticalAlignment: "top",
    });
    addText(slide, `${module.minutes} menit`, { left: 354, top: 505, width: 220, height: 42 }, {
      fontSize: 18,
      bold: true,
      color: palette.amber,
    });
    addFooter(slide, module, true);
  }

  {
    const slide = deck.slides.add();
    slide.background.fill = palette.cream;
    addHeader(slide, module, "HASIL BELAJAR");
    addText(slide, "Setelah modul ini", { left: 72, top: 98, width: 760, height: 70 }, {
      fontSize: 40,
      bold: true,
      color: palette.navy,
    });
    module.objectives.forEach((objective, index) => {
      addText(slide, String(index + 1).padStart(2, "0"), { left: 78, top: 205 + index * 126, width: 92, height: 72 }, {
        fontSize: 26,
        bold: true,
        color: palette.orange,
        verticalAlignment: "top",
      });
      addText(slide, objective, { left: 186, top: 200 + index * 126, width: 930, height: 82 }, {
        fontSize: 25,
        bold: index === 0,
        color: palette.ink,
        verticalAlignment: "top",
      });
    });
    addFooter(slide, module);
  }

  {
    const slide = deck.slides.add();
    slide.background.fill = palette.paper;
    addHeader(slide, module, "KONSEP INTI");
    addText(slide, module.lessonTitle, { left: 72, top: 90, width: 1040, height: 72 }, {
      fontSize: 38,
      bold: true,
      color: palette.navy,
    });
    module.concepts.forEach((concept, index) => {
      const top = 198 + index * 136;
      addText(slide, concept.title, { left: 74, top, width: 260, height: 58 }, {
        fontSize: 24,
        bold: true,
        color: index === 1 ? palette.orange : palette.navy,
        verticalAlignment: "top",
      });
      addText(slide, concept.body, { left: 360, top: top - 2, width: 780, height: 84 }, {
        fontSize: 21,
        color: palette.muted,
        verticalAlignment: "top",
      });
    });
    addFooter(slide, module);
  }

  {
    const slide = deck.slides.add();
    slide.background.fill = palette.cream;
    addBand(slide, palette.orange, 0, 12);
    addHeader(slide, module, "PRAKTIK KELAS");
    addText(slide, module.practiceTitle, { left: 72, top: 96, width: 1050, height: 72 }, {
      fontSize: 39,
      bold: true,
      color: palette.navy,
    });
    module.practiceSteps.forEach((step, index) => {
      const top = 190 + index * 102;
      addText(slide, String(index + 1), { left: 76, top, width: 58, height: 58 }, {
        fontSize: 24,
        bold: true,
        color: palette.orange,
        alignment: "center",
      });
      addText(slide, step, { left: 160, top: top - 4, width: 970, height: 70 }, {
        fontSize: 22,
        color: palette.ink,
        verticalAlignment: "top",
      });
    });
    addFooter(slide, module);
  }

  {
    const slide = deck.slides.add();
    slide.background.fill = palette.navy;
    addHeader(slide, module, "CEK PEMAHAMAN", true);
    addText(slide, "Tiga pertanyaan sebelum lanjut", { left: 72, top: 94, width: 980, height: 68 }, {
      fontSize: 38,
      bold: true,
      color: "#FFFFFF",
    });
    module.questions.forEach((question, index) => {
      addText(slide, `${index + 1}.`, { left: 76, top: 194 + index * 103, width: 54, height: 52 }, {
        fontSize: 23,
        bold: true,
        color: palette.amber,
        verticalAlignment: "top",
      });
      addText(slide, question, { left: 150, top: 188 + index * 103, width: 980, height: 66 }, {
        fontSize: 22,
        color: "#ECF1F8",
        verticalAlignment: "top",
      });
    });
    addText(slide, module.takeaway, { left: 72, top: 525, width: 1050, height: 86 }, {
      fontSize: 23,
      bold: true,
      color: palette.orange,
      verticalAlignment: "top",
    });
    addFooter(slide, module, true);
  }

  return deck;
}

for (const module of modules) {
  const deck = createDeck(module);
  const fileName = `modul-${String(module.position).padStart(2, "0")}-${module.slug}-v1.pptx`;
  const moduleStaging = path.join(stagingRoot, module.slug);
  const candidatePath = path.join(moduleStaging, "candidate.pptx");
  const finalPath = path.join(outputDir, fileName);
  const previewDir = path.join(outputDir, "previews", path.basename(fileName, ".pptx"));
  await fs.mkdir(moduleStaging, { recursive: true });
  await fs.mkdir(previewDir, { recursive: true });
  await (await PresentationFile.exportPptx(deck)).save(candidatePath);
  await finalizePresentation({
    explicitTotalSlideCount: 5,
    requiredNativeTableOwnerSlides: [],
    requiredNativeChartOwnerSlides: [],
    workspaceDir,
    candidatePath,
    finalPath,
    pythonExecutable: runtimePython,
    integrityValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_package_integrity.py"),
    layoutValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_layout_geometry.py"),
    layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-heading-fit"],
    fontPolicy: { basis: "design", families: [fontFamily] },
    verifyArtifactToolImport: true,
    receiptPath: path.join(moduleStaging, `${fileName}.validation.json`),
  });
  for (let index = 0; index < deck.slides.items.length; index += 1) {
    const preview = await deck.export({ slide: deck.slides.items[index], format: "png", scale: 1 });
    await fs.writeFile(
      path.join(previewDir, `slide-${index + 1}.png`),
      new Uint8Array(await preview.arrayBuffer()),
    );
  }
  process.stdout.write(`${fileName}\n`);
}
