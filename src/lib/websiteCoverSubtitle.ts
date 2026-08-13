export const WEBSITE_COVER_SUBTITLE_CENTER_X = 608;
export const WEBSITE_COVER_SUBTITLE_CENTER_Y = 741;
export const WEBSITE_COVER_SUBTITLE_FONT_SIZE = 38;
export const WEBSITE_COVER_SUBTITLE_LINE_HEIGHT = 44;

const MAX_LINE_UNITS = 10.5;
const MIN_BACKGROUND_WIDTH = 380;
const MAX_BACKGROUND_WIDTH = 455;
const HORIZONTAL_PADDING = 48;
const VERTICAL_PADDING = 24;

function characterUnits(character: string) {
  if (/\s/u.test(character)) return 0.35;
  if ((character.codePointAt(0) ?? 0) <= 0xff) return 0.58;
  return 1;
}

export function measureSubtitleUnits(value: string) {
  return Array.from(value).reduce((total, character) => total + characterUnits(character), 0);
}

function wrapParagraph(paragraph: string) {
  if (!paragraph) return [''];
  const lines: string[] = [];
  let line = '';
  let units = 0;

  Array.from(paragraph).forEach((character) => {
    const nextUnits = characterUnits(character);
    if (line && units + nextUnits > MAX_LINE_UNITS) {
      lines.push(line.trimEnd());
      line = character.trimStart();
      units = measureSubtitleUnits(line);
      return;
    }
    line += character;
    units += nextUnits;
  });

  lines.push(line.trimEnd());
  return lines;
}

export function getWebsiteCoverSubtitleLayout(value: string) {
  const lines = value
    .replace(/\r\n?/gu, '\n')
    .split('\n')
    .flatMap(wrapParagraph);
  const visibleLines = lines.length ? lines : [''];
  const longestLineUnits = Math.max(0, ...visibleLines.map(measureSubtitleUnits));
  const width = Math.min(
    MAX_BACKGROUND_WIDTH,
    Math.max(MIN_BACKGROUND_WIDTH, longestLineUnits * WEBSITE_COVER_SUBTITLE_FONT_SIZE + HORIZONTAL_PADDING)
  );
  const height = Math.max(76, visibleLines.length * WEBSITE_COVER_SUBTITLE_LINE_HEIGHT + VERTICAL_PADDING);

  return {
    lines: visibleLines,
    width,
    height,
    firstLineY: -((visibleLines.length - 1) * WEBSITE_COVER_SUBTITLE_LINE_HEIGHT) / 2
  };
}

export function normalizeWebsiteCoverSubtitleScale(value: number | undefined) {
  return Math.max(0.6, Math.min(1.6, Number.isFinite(value) ? value! : 1));
}
