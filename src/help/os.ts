import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Creates a temporary directory inside the global temp dir of the OS.
 */
export function mkdtempSync() {
  // mkdtempSync only appends a six char suffix, it doesn't create a nested
  // directory.
  return fs.mkdtempSync(`${os.tmpdir()}${path.sep}`);
}
