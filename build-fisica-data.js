const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUTPUT_FILE = path.join(ROOT, 'fisica-data.js');

const GUIDE_FILES = [
  { id: 'guia-1', name: 'Guía 1', filePattern: /gu[ií]a\s*1/i },
  { id: 'guia-2', name: 'Guía 2', filePattern: /gu[ií]a\s*2/i }
];

const SECTION_LABELS = [
  'tematica del ejercicio',
  'reactivo',
  'fuente',
  'planteamiento del problema',
  'opciones',
  'que pide resolver el ejercicio',
  'desarrollo y descarte de opciones',
  'opcion correcta',
  'argumento',
  'pista'
];

const REACTIVE_OVERRIDES = {
  'guia-1-106': {
    reactiveType: 'table-and-option-graphs',
    visualSpec: {
      type: 'table-and-option-graphs',
      title: 'Tabla y opciones gráficas',
      promptNote: 'El enunciado original no se ve completo en la fuente. Solo se conserva la información visible.',
      table: {
        columns: ['Tiempo (s)', 'Posición (m)'],
        rows: [
          [0, 0],
          [1, 1],
          [2, 4],
          [3, 9]
        ]
      },
      options: [
        {
          label: 'A',
          chartType: 'polyline',
          xLabel: 'Tiempo (h)',
          yLabel: 'Posición (km)',
          points: [
            [0, 0],
            [2, 3],
            [6, 18]
          ]
        },
        {
          label: 'B',
          chartType: 'polyline',
          xLabel: 'Posición (km)',
          yLabel: 'Tiempo (h)',
          points: [
            [0, 0],
            [6, 2],
            [18, 6]
          ]
        },
        {
          label: 'C',
          chartType: 'polyline',
          xLabel: 'Tiempo (s)',
          yLabel: 'Posición (m)',
          points: [
            [0, 0],
            [1, 1],
            [2, 4],
            [3, 9]
          ]
        },
        {
          label: 'D',
          chartType: 'curve',
          xLabel: 'Tiempo (s)',
          yLabel: 'Posición (m)',
          points: [
            [0, 80],
            [1, 64],
            [2, 42],
            [3, 18],
            [4, 0]
          ]
        }
      ]
    },
    sourceNotes: [
      'El enunciado original no se ve completo en la fuente; la reconstrucción se limita a la información visible del txt.'
    ]
  },
  'guia-1-107': {
    reactiveType: 'velocity-time-graph',
    visualSpec: {
      type: 'velocity-time-graph',
      title: 'Gráfica velocidad-tiempo',
      xLabel: 'Tiempo (h)',
      yLabel: 'Velocidad (km/h)',
      points: [
        [0, 0],
        [1, 60],
        [3, 60],
        [4, 0]
      ]
    }
  },
  'guia-2-105': {
    reactiveType: 'position-time-graph',
    visualSpec: {
      type: 'position-time-graph',
      title: 'Gráfica posición-tiempo',
      approximate: true,
      xLabel: 'Tiempo (s)',
      yLabel: 'Distancia (m)',
      points: [
        [0, 0],
        [5, 20],
        [10, 40],
        [15, 60],
        [20, 80]
      ]
    },
    sourceNotes: [
      'Los puntos de la gráfica se describen como aproximados en la fuente.'
    ]
  },
  'guia-2-106': {
    reactiveType: 'motion-family-graphs',
    visualSpec: {
      type: 'motion-family-graphs',
      title: 'Relación entre movimiento y forma de la gráfica',
      charts: [
        { id: 'a', chartType: 'curve', fromOrigin: false, label: 'a' },
        { id: 'b', chartType: 'curve', fromOrigin: true, label: 'b' },
        { id: 'c', chartType: 'line', fromOrigin: false, label: 'c' },
        { id: 'd', chartType: 'line', fromOrigin: true, label: 'd' }
      ]
    }
  }
};

function toMexicoTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
}

function stripReferences(text) {
  return String(text || '')
    .replace(/\uFEFF/g, '')
    .replace(/:contentReference\[[^\]]+\]\{[^}]+\}/g, '')
    .replace(/[ \t]+$/gm, '');
}

function normalizeLabel(text) {
  return stripReferences(text)
    .replace(/\r/g, '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/:+$/, '')
    .replace(/\s+/g, ' ');
}

function normalizeMath(text) {
  return String(text || '')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\\(/g, '')
    .replace(/\\\)/g, '')
    .replace(/\\,/g, ' ')
    .replace(/\\cdot/g, '·')
    .replace(/\\times/g, '×')
    .replace(/\\+/g, '')
    .replace(/\s{2,}/g, ' ');
}

function cleanInline(text) {
  return normalizeMath(stripReferences(String(text || '').replace(/\r/g, ''))).trim();
}

function trimBlankLines(lines) {
  let start = 0;
  let end = lines.length;

  while (start < end && !String(lines[start] || '').trim()) start += 1;
  while (end > start && !String(lines[end - 1] || '').trim()) end -= 1;

  return lines.slice(start, end);
}

function joinLines(lines) {
  return trimBlankLines(lines)
    .map((line) => cleanInline(line))
    .filter((line) => line && line !== '---')
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function slugify(text) {
  return cleanInline(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function normalizeForToken(text) {
  return cleanInline(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function buildTags(topic) {
  const tokens = normalizeForToken(topic)
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => token.length > 2)
    .slice(0, 5);

  return Array.from(new Set([slugify(topic), ...tokens]));
}

function findGuideFile(pattern) {
  const entry = fs
    .readdirSync(ROOT)
    .find((name) => pattern.test(name) && name.toLowerCase().endsWith('.txt'));

  if (!entry) {
    throw new Error(`No se encontró un archivo .txt para el patrón ${pattern}.`);
  }

  return path.join(ROOT, entry);
}

function splitExerciseBlocks(rawText) {
  const lines = stripReferences(rawText).replace(/\r\n/g, '\n').split('\n');
  const starts = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (normalizeLabel(lines[index]).startsWith('tematica del ejercicio')) {
      starts.push(index);
    }
  }

  return starts
    .map((startIndex, index) => {
      const endIndex = index + 1 < starts.length ? starts[index + 1] : lines.length;
      return lines.slice(startIndex, endIndex);
    })
    .filter((block) => block.some((line) => normalizeLabel(line).startsWith('reactivo')));
}

function findSectionIndex(lines, label) {
  return lines.findIndex((line) => normalizeLabel(line).startsWith(label));
}

function extractSection(lines, startLabel, endLabels) {
  const startIndex = findSectionIndex(lines, startLabel);
  if (startIndex === -1) return [];

  let endIndex = lines.length;
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const normalized = normalizeLabel(lines[index]);
    if (endLabels.some((label) => normalized.startsWith(label))) {
      endIndex = index;
      break;
    }
  }

  const collected = [];
  const startLine = stripReferences(String(lines[startIndex] || '')).replace(/\r/g, '');
  const separatorIndex = startLine.indexOf(':');
  if (separatorIndex >= 0) {
    const inline = cleanInline(startLine.slice(separatorIndex + 1));
    if (inline) collected.push(inline);
  }

  for (let index = startIndex + 1; index < endIndex; index += 1) {
    collected.push(String(lines[index] || ''));
  }

  return trimBlankLines(collected).filter((line) => cleanInline(line) !== '---');
}

function parseOptions(lines) {
  const options = [];
  let current = null;

  for (const rawLine of trimBlankLines(lines)) {
    const line = cleanInline(rawLine);
    if (!line || line === '---') continue;

    const match = line.match(/^([A-E])\)\s*(.*)$/);
    if (match) {
      if (current) options.push(current);
      current = {
        label: match[1],
        text: cleanInline(match[2])
      };
      continue;
    }

    if (current) {
      current.text = cleanInline(`${current.text} ${line}`);
    }
  }

  if (current) options.push(current);
  return options;
}

function parseOptionsAnalysis(lines, optionMap) {
  const items = [];
  let current = null;

  for (const rawLine of trimBlankLines(lines)) {
    const line = cleanInline(rawLine);
    if (line === '---') continue;

    if (!line) {
      if (current && current.lines[current.lines.length - 1] !== '') {
        current.lines.push('');
      }
      continue;
    }

    const match = line.match(/^([A-E])\)\s*(.*)$/);
    if (match) {
      if (current) items.push(current);
      current = {
        label: match[1],
        option: optionMap.get(match[1]) || cleanInline(match[2]),
        lines: []
      };
      continue;
    }

    if (current) current.lines.push(line);
  }

  if (current) items.push(current);

  return items.map((item) => ({
    label: item.label,
    option: item.option,
    text: joinLines(item.lines)
  }));
}

function parseCorrectOption(lines, optionMap) {
  const firstLine = trimBlankLines(lines)
    .map((line) => cleanInline(line))
    .find(Boolean);

  if (!firstLine) {
    throw new Error('No se encontró una opción correcta visible en el bloque.');
  }

  const match = firstLine.match(/^([A-E])\)\s*(.*)$/);
  if (!match) {
    throw new Error(`No se pudo interpretar la opción correcta: "${firstLine}".`);
  }

  const label = match[1];
  return {
    label,
    text: optionMap.get(label) || cleanInline(match[2])
  };
}

function guessReactiveType(guideId, number, topic, visualSpec) {
  if (visualSpec?.type) return visualSpec.type;

  const key = `${guideId}-${number}`;
  const normalizedTopic = normalizeForToken(topic);

  if (/f = ma|segunda ley|aceleracion|fuerza/.test(normalizedTopic)) return 'formula';
  if (/espejo|luz visible|ondas|frecuencia|brujula|campo magnetico/.test(normalizedTopic)) return 'concept-check';
  if (/presion|calor|temperatura|energia/.test(normalizedTopic)) return 'concept-check';

  return key.startsWith('guia-2-') ? 'multiple-choice-5' : 'multiple-choice-4';
}

function buildOverride(guideId, number) {
  return REACTIVE_OVERRIDES[`${guideId}-${number}`] || {};
}

function validateBlock(blockLines, guideName) {
  for (const label of SECTION_LABELS) {
    if (!blockLines.some((line) => normalizeLabel(line).startsWith(label))) {
      throw new Error(`Falta la sección "${label}" en un bloque de ${guideName}.`);
    }
  }
}

function parseExercise(blockLines, guide, order) {
  validateBlock(blockLines, guide.name);

  const topic = joinLines(extractSection(blockLines, 'tematica del ejercicio', ['reactivo']));
  const numberText = joinLines(extractSection(blockLines, 'reactivo', ['fuente']));
  const number = Number(numberText);

  if (!Number.isFinite(number)) {
    throw new Error(`No se pudo leer el número de reactivo para ${guide.name}.`);
  }

  const sourceSection = extractSection(blockLines, 'fuente', ['planteamiento del problema']);
  const source = cleanInline(sourceSection[0] || '');
  const parsedSourceNotes = sourceSection.slice(1).map((line) => cleanInline(line)).filter(Boolean);

  const questionLines = trimBlankLines(
    extractSection(blockLines, 'planteamiento del problema', ['opciones'])
  )
    .map((line) => cleanInline(line))
    .filter((line) => line && line !== '---');

  const options = parseOptions(extractSection(blockLines, 'opciones', ['que pide resolver el ejercicio']));
  const optionMap = new Map(options.map((option) => [option.label, option.text]));

  const whatToSolve = joinLines(
    extractSection(blockLines, 'que pide resolver el ejercicio', ['desarrollo y descarte de opciones'])
  );
  const optionsAnalysis = parseOptionsAnalysis(
    extractSection(blockLines, 'desarrollo y descarte de opciones', ['opcion correcta']),
    optionMap
  );
  const correctOption = parseCorrectOption(extractSection(blockLines, 'opcion correcta', ['argumento']), optionMap);
  const argument = joinLines(extractSection(blockLines, 'argumento', ['pista']));
  const hint = joinLines(extractSection(blockLines, 'pista', []));

  const override = buildOverride(guide.id, number);
  const sourceNotes = [...parsedSourceNotes, ...(override.sourceNotes || [])];
  const visualSpec = override.visualSpec || null;
  const reactiveType = override.reactiveType || guessReactiveType(guide.id, number, topic, visualSpec);

  return {
    id: `${guide.id.replace('guia-', 'g')}-r${number}`,
    guideId: guide.id,
    guideName: guide.name,
    number,
    order,
    sourceOrder: order,
    source,
    sourceNotes,
    topic,
    topicId: slugify(topic),
    question: questionLines.join('\n'),
    questionLines,
    options,
    correctOption,
    whatToSolve,
    optionsAnalysis,
    argument,
    hint,
    reactiveType,
    visualSpec,
    tags: buildTags(topic)
  };
}

function buildGuideData(guide) {
  const sourceFile = findGuideFile(guide.filePattern);
  const rawText = fs.readFileSync(sourceFile, 'utf8');
  const blocks = splitExerciseBlocks(rawText);
  const exercises = blocks.map((block, index) => parseExercise(block, guide, index + 1));

  if (exercises.length !== 12) {
    throw new Error(`${guide.name} debe contener 12 reactivos y se detectaron ${exercises.length}.`);
  }

  const expectedNumbers = Array.from({ length: 12 }, (_, index) => 105 + index);
  const actualNumbers = exercises.map((exercise) => exercise.number);

  if (expectedNumbers.join(',') !== actualNumbers.join(',')) {
    throw new Error(
      `${guide.name} no conserva el orden esperado 105-116. Obtenido: ${actualNumbers.join(', ')}`
    );
  }

  return {
    id: guide.id,
    name: guide.name,
    exerciseCount: exercises.length,
    exercises
  };
}

function buildTopics(guides) {
  const topicMap = new Map();

  for (const guide of guides) {
    for (const exercise of guide.exercises) {
      if (!topicMap.has(exercise.topicId)) {
        topicMap.set(exercise.topicId, {
          id: exercise.topicId,
          name: exercise.topic,
          exerciseCount: 0,
          guides: new Set()
        });
      }

      const entry = topicMap.get(exercise.topicId);
      entry.exerciseCount += 1;
      entry.guides.add(guide.id);
    }
  }

  return Array.from(topicMap.values())
    .map((topic) => ({
      id: topic.id,
      name: topic.name,
      exerciseCount: topic.exerciseCount,
      guides: Array.from(topic.guides)
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'es'));
}

function buildAppData() {
  const guides = GUIDE_FILES.map(buildGuideData);
  const totalExercises = guides.reduce((sum, guide) => sum + guide.exerciseCount, 0);
  const topics = buildTopics(guides);

  if (totalExercises !== 24) {
    throw new Error(`Se esperaban 24 reactivos y se obtuvieron ${totalExercises}.`);
  }

  return {
    meta: {
      title: 'Instituto Fernando Ramírez · ECOEMS Física',
      subject: 'Física',
      version: '1.0.0',
      generatedAt: toMexicoTimestamp(),
      totalExercises,
      topicCount: topics.length
    },
    topics,
    guides
  };
}

function writeOutput() {
  const data = buildAppData();
  const content = `window.IFR_APP_DATA = ${JSON.stringify(data, null, 2)};\n`;
  fs.writeFileSync(OUTPUT_FILE, content, 'utf8');
  return data;
}

if (require.main === module) {
  const data = writeOutput();
  console.log(`Archivo generado: ${path.basename(OUTPUT_FILE)}`);
  console.log(`Reactivos generados: ${data.meta.totalExercises}`);
  console.log(`Temas detectados: ${data.meta.topicCount}`);
}

module.exports = {
  buildAppData,
  writeOutput
};
