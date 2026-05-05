import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {execSync} from 'node:child_process';
import {annexFiveOutputDir, annexFiveVideos} from '../remotion/content/annexFiveVideos.js';

const runner = process.platform === 'win32'
  ? join('node_modules', '.bin', 'remotion.cmd')
  : join('node_modules', '.bin', 'remotion');

const quote = (value) => `"${String(value).replaceAll('"', '\\"')}"`;

const runRemotion = (args) => {
  execSync([quote(runner), ...args.map(quote)].join(' '), {stdio: 'inherit'});
};

mkdirSync(annexFiveOutputDir, {recursive: true});

for (const video of annexFiveVideos) {
  const output = join(annexFiveOutputDir, video.poster);
  console.log(`Rendering poster ${video.id} -> ${output}`);
  runRemotion(['still', 'remotion/index.jsx', video.id, output, '--frame=120', '--scale=0.5', '--overwrite']);
}
