import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export async function withTemporaryDirectory(block: (dir: string) => Promise<void>) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'publib-test'));

  try {
    await block(tmpDir);
  } finally {
    fs.rmSync(tmpDir, { force: true, recursive: true });
  }
}

export async function inTemporaryDirectory(block: () => Promise<void>) {
  return withTemporaryDirectory(async (dir) => {
    const origDir = process.cwd();
    process.chdir(dir);

    try {
      await block();
    } finally {
      process.chdir(origDir);
    }
  });
}