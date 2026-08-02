#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');

function usage() {
  console.log(`Usage:
  node scripts/capture_slides.mjs --slide 4
  node scripts/capture_slides.mjs --all

Options:
  --slide N     Capture one slide using a 1-based page number
  --all         Capture every slide
  --url URL     Deck URL (default: http://127.0.0.1:8000/slides/)
  --out DIR     Output directory (default: output/slide-captures)
  --wait MS     Browser rendering budget (default: 2500)
`);
}

function parseArgs(argv) {
  const options = {
    all: false,
    slide: null,
    url: 'http://127.0.0.1:8000/slides/',
    out: join(repoRoot, 'output', 'slide-captures'),
    wait: 2500,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--all') options.all = true;
    else if (arg === '--slide') options.slide = Number(argv[++index]);
    else if (arg === '--url') options.url = argv[++index];
    else if (arg === '--out') options.out = resolve(argv[++index]);
    else if (arg === '--wait') options.wait = Number(argv[++index]);
    else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.all === (options.slide !== null)) {
    throw new Error('Choose exactly one of --slide N or --all');
  }
  if (options.slide !== null && (!Number.isInteger(options.slide) || options.slide < 1)) {
    throw new Error('--slide must be a positive integer');
  }
  if (!Number.isFinite(options.wait) || options.wait < 0) {
    throw new Error('--wait must be a non-negative number');
  }
  return options;
}

function slideCount() {
  const html = readFileSync(join(repoRoot, 'slides', 'index.html'), 'utf8');
  return (html.match(/<section\s+class=["'][^"']*\bslide\b[^"']*["']/g) || []).length;
}

function findBrowser() {
  const candidates = [
    process.env.SLIDE_CHROME,
    '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe',
    '/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/mnt/c/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const browser = candidates.find(existsSync);
  if (!browser) {
    throw new Error('Chrome or Edge was not found. Set SLIDE_CHROME to the browser executable.');
  }
  return browser;
}

function windowsTempDir() {
  const windowsPath = execFileSync('cmd.exe', ['/c', 'echo %TEMP%'], {
    cwd: '/mnt/c/Windows',
    encoding: 'utf8',
  }).trim();
  return execFileSync('wslpath', ['-u', windowsPath], { encoding: 'utf8' }).trim();
}

function toWindowsPath(path) {
  return execFileSync('wslpath', ['-w', path], { encoding: 'utf8' }).trim();
}

function pageUrl(baseUrl, slideNumber) {
  const url = new URL(baseUrl);
  url.searchParams.set('s', String(slideNumber - 1));
  url.searchParams.delete('f');
  return url.toString();
}

function capture(browser, options, slideNumber, stagingDir) {
  const isWindowsBrowser = browser.toLowerCase().endsWith('.exe');
  const stagedPng = join(stagingDir, `slide-${String(slideNumber).padStart(2, '0')}.png`);
  const profileDir = join(stagingDir, `profile-${slideNumber}`);
  mkdirSync(profileDir, { recursive: true });

  const screenshotArg = isWindowsBrowser ? toWindowsPath(stagedPng) : stagedPng;
  const profileArg = isWindowsBrowser ? toWindowsPath(profileDir) : profileDir;
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--disable-extensions',
    '--force-device-scale-factor=1',
    '--window-size=1920,1080',
    `--virtual-time-budget=${options.wait}`,
    `--user-data-dir=${profileArg}`,
    `--screenshot=${screenshotArg}`,
    pageUrl(options.url, slideNumber),
  ];

  const result = spawnSync(browser, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Browser exited with status ${result.status}`);
  if (!existsSync(stagedPng) || statSync(stagedPng).size < 1000) {
    throw new Error(`Screenshot was not created for slide ${slideNumber}`);
  }

  const outputPng = join(options.out, `slide-${String(slideNumber).padStart(2, '0')}.png`);
  copyFileSync(stagedPng, outputPng);
  console.log(outputPng);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const total = slideCount();
  if (!total) throw new Error('No slides found in slides/index.html');
  if (options.slide !== null && options.slide > total) {
    throw new Error(`Slide ${options.slide} does not exist (deck has ${total} slides)`);
  }

  const response = await fetch(options.url, { signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw new Error(`Deck server returned HTTP ${response.status}`);

  const browser = findBrowser();
  mkdirSync(options.out, { recursive: true });
  const tempRoot = browser.toLowerCase().endsWith('.exe') ? windowsTempDir() : tmpdir();
  const stagingDir = mkdtempSync(join(tempRoot, 'pxr-slide-capture-'));

  try {
    const pages = options.all
      ? Array.from({ length: total }, (_, index) => index + 1)
      : [options.slide];
    pages.forEach((slideNumber) => capture(browser, options, slideNumber, stagingDir));
  } finally {
    rmSync(stagingDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`capture_slides: ${error.message}`);
  process.exitCode = 1;
});
