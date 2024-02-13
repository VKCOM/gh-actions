// eslint-disable-next-line @typescript-eslint/naming-convention
import * as Figma from 'figma-js';
import * as core from '@actions/core';
import * as fs from 'fs/promises';
import { sortObjectRecursively } from './sort';

type Tokens = { [P in string]: Tokens | string };

function toSnack(s: string) {
  return s.replaceAll(/( – | )/g, '_');
}

function to16(n: number, padding = 2): string {
  let hex = n.toString(16);

  while (hex.length < padding) {
    hex = '0' + hex;
  }

  return hex;
}

/**
 * Переводит цвет из 0 - 1 в 0 - 255
 *
 * @param color цвет от 0 до 1
 * @return цвет от 0 до 255
 */
function color1To255(color: number): number {
  return Math.round(255 * color);
}

function toHex(r: number, g: number, b: number): string {
  return `#${to16(r)}${to16(g)}${to16(b)}`;
}

function toRGBA(r: number, g: number, b: number, a: number | string): string {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function figmaToCSS(color: Figma.Color, opacity: number): string {
  const r = color1To255(color.r);
  const g = color1To255(color.g);
  const b = color1To255(color.b);
  const a = opacity.toFixed(2);

  return a === '1.00' ? toHex(r, g, b) : toRGBA(r, g, b, a);
}

function recursiveTokens(tokens: Tokens, path: string[], value: string) {
  const key = toSnack(path[0]);

  if (path.length === 1) {
    tokens[key] = value;
  }

  const obj = tokens[key] || {};

  if (!(key in tokens)) {
    tokens[key] = obj;
  }

  if (typeof tokens[key] === 'string') {
    return;
  }

  recursiveTokens(obj as Tokens, path.slice(1), value);
}

const req = {
  required: true,
};

function getFigmaClient(personalAccessToken: string) {
  // eslint-disable-next-line new-cap
  return Figma.Client({
    personalAccessToken,
  });
}

async function main() {
  const personalAccessToken = core.getInput('token', req);
  const fileId = core.getInput('file_key', req);
  const pathToJSON = core.getInput('output_file_name', req);

  const figma = getFigmaClient(personalAccessToken);

  // Получаем все стили
  const styles = await figma.fileStyles(fileId);
  if (styles.status !== 200) {
    core.error(styles.statusText, { title: 'Figma get file styles' });
    process.exit(1);
  }

  // Собираем вместе все node_id
  const ids = styles.data.meta.styles.map((style) => style.node_id);

  // Запрашиваем ноды
  const nodes = await figma.fileNodes(fileId, { ids });

  const tokens: Tokens = {};

  // Перебираем все ноды
  styles.data.meta.styles.map((style) => {
    const doc = nodes.data.nodes[style.node_id]?.document;
    if (!doc) {
      core.warning(`document is undefined'`);
      return;
    }

    // Игнорируем текст
    if (doc.type === 'TEXT') {
      return;
    }

    if (doc.type !== 'RECTANGLE') {
      core.warning(`doc.type is ${doc.type}'`);
      return;
    }

    if (doc.fills.length !== 1) {
      core.warning(`doc.fills.length=${doc.fills.length}`);
      return;
    }

    // Разбиваем название стиля на части
    const splitPath = style.name
      .replace('VKUI · ', '')
      .toLowerCase()
      .split(/(\/| – )/g)
      .filter((v) => v !== '/' && v !== ' – ');

    let cssValue = '';

    switch (doc.fills[0].type) {
      case 'SOLID':
        const fill = doc.fills[0];

        if (!fill.color) {
          break;
        }

        cssValue = figmaToCSS(fill.color, fill.opacity || 1);
        break;
      // TODO: Обработка градиентов
      case 'GRADIENT_LINEAR':
        break;
      default:
        core.warning(`fills.type=${doc.fills.length}`);
        core.debug(JSON.stringify(doc.fills));
        break;
    }

    if (cssValue === '') {
      return;
    }

    recursiveTokens(tokens, splitPath, cssValue);
  });

  await fs.writeFile(pathToJSON, JSON.stringify(sortObjectRecursively(tokens), undefined, 2));
}

main()
  .then()
  .catch((err) => {
    core.error(err.stack);
    core.setFailed(err.message);
  });
