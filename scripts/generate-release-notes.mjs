#!/usr/bin/env node
// Generates App Store release notes for the current tag.
//
// Uses the same Bedrock API-key flow as ex-electron: the Anthropic Bedrock SDK
// reads AWS_BEARER_TOKEN_BEDROCK directly. If it is not configured, this script
// falls back to generic release notes so release uploads do not fail solely
// because AI generation is unavailable.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { AnthropicBedrock } from '@anthropic-ai/bedrock-sdk';

const DEFAULT_BEDROCK_MODEL = 'anthropic.claude-sonnet-4-6';
const DEFAULT_AWS_REGION = 'eu-north-1';
const DEFAULT_OUTPUT = 'build/ios/release-notes.txt';
const MAX_RELEASE_NOTES_CHARS = 3800;

function git(args, options = {}) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', options.ignoreStderr ? 'ignore' : 'pipe'],
  }).trim();
}

function tryGit(args) {
  try {
    return git(args, { ignoreStderr: true });
  } catch {
    return null;
  }
}

function currentTag() {
  return process.env.GITHUB_REF_NAME ?? tryGit(['describe', '--exact-match', '--tags', 'HEAD']) ?? git(['rev-parse', '--short', 'HEAD']);
}

function previousTag(tag) {
  return tryGit(['describe', '--tags', '--abbrev=0', '--match', 'v*', `${tag}^`]);
}

function commitsBetween(previous, tag) {
  const range = previous ? `${previous}..${tag}` : tag;
  return git(['log', '--first-parent', '--no-merges', range, '--pretty=format:- %s (%h)']);
}

function diffStat(previous, tag) {
  const range = previous ? `${previous}..${tag}` : tag;
  return tryGit(['diff', '--stat', range]) ?? '';
}

function fallbackNotes() {
  return '- Bug fixes and performance improvements.\n';
}

function normalizeNotes(notes) {
  const trimmed = notes.trim();
  if (!trimmed) return fallbackNotes();
  const clipped = trimmed.length > MAX_RELEASE_NOTES_CHARS ? trimmed.slice(0, MAX_RELEASE_NOTES_CHARS).trimEnd() : trimmed;
  return `${clipped}\n`;
}

async function summariseWithClaude(commits, stat, tag) {
  if (!process.env.AWS_BEARER_TOKEN_BEDROCK) {
    return null;
  }

  const prompt = `You are writing App Store release notes for ex Team Chat, a production iOS team chat app.

Generate concise, user-facing release notes from this git context.

Rules:
- Output only the release notes text.
- Use 2 to 5 short bullets.
- Keep it under ${MAX_RELEASE_NOTES_CHARS} characters.
- Prefer concrete user-visible changes.
- Do not mention commits, hashes, pull requests, CI, internal file names, or developer tooling.
- Skip pure maintenance unless it affects users.
- If the context is mostly maintenance, output one bullet: "Bug fixes and performance improvements."

Tag being released: ${tag}

Commits since previous tag:
${commits}

Diff stat:
${stat}`;

  try {
    const client = new AnthropicBedrock({
      awsRegion: process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? DEFAULT_AWS_REGION,
    });
    const response = await client.messages.create({
      model: process.env.BEDROCK_MODEL_ID ?? DEFAULT_BEDROCK_MODEL,
      max_tokens: 700,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = response.content
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('')
      .trim();
    return text.length > 0 ? text : null;
  } catch (error) {
    console.error('bedrock call failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

async function main() {
  const outputIndex = process.argv.indexOf('--output');
  const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : DEFAULT_OUTPUT;
  const dryRun = process.argv.includes('--dry-run');
  const tag = currentTag();
  const previous = previousTag(tag);
  const commits = commitsBetween(previous, tag);
  const stat = diffStat(previous, tag);

  const notes = normalizeNotes((await summariseWithClaude(commits, stat, tag)) ?? fallbackNotes());

  if (dryRun) {
    process.stdout.write(notes);
    return;
  }

  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, notes, 'utf8');
  console.log(`Wrote release notes to ${output}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
