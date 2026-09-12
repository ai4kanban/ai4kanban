import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { hasLiveRun } from '../out/lib/projects.js';

test('finds checkout-local runs for the default and secondary board', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-desktop-project-'));
  try {
    fs.mkdirSync(path.join(root, '.git'));
    for (const relative of ['docs/kanban', 'marketing/kanban']) {
      const board = path.join(root, relative);
      fs.mkdirSync(path.join(board, 'todo'), { recursive: true });
      fs.writeFileSync(path.join(board, 'config.md'), '# Board\n');
      assert.equal(hasLiveRun(board), false);
      const state = path.join(root, '.akb/boards', relative);
      fs.mkdirSync(state, { recursive: true });
      fs.writeFileSync(path.join(state, 'sessions.json'), JSON.stringify({ live: [{ pid: process.pid }] }));
      assert.equal(hasLiveRun(board), true);
    }
    assert.equal(hasLiveRun(root), true);
    const nested = path.join(root, 'nested');
    fs.mkdirSync(path.join(nested, 'docs/kanban/todo'), { recursive: true });
    fs.mkdirSync(path.join(nested, '.akb/boards/docs/kanban'), { recursive: true });
    fs.writeFileSync(path.join(nested, '.akb/boards/docs/kanban/sessions.json'), JSON.stringify({ live: [{ pid: process.pid }] }));
    assert.equal(hasLiveRun(nested), true);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
