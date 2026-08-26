import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const scriptsDir = './scripts';
const testFiles = fs.readdirSync(scriptsDir)
  .filter(f => f.startsWith('test_') && f.endsWith('.js'))
  .sort();

console.log(`Found ${testFiles.length} test scripts to execute.`);

let passed = 0;
let failed = 0;
const failedFiles = [];

for (const file of testFiles) {
  const filePath = path.join(scriptsDir, file);
  process.stdout.write(`▶ Running ${file} ... `);
  try {
    const output = execSync(`node ${filePath}`, { stdio: 'pipe', encoding: 'utf-8', timeout: 10000 });
    console.log('✅ PASS');
    passed++;
  } catch (err) {
    console.log('❌ FAIL');
    console.error(err.stdout || err.stderr || err.message);
    failed++;
    failedFiles.push(file);
  }
}

console.log('\n==================================================');
console.log(`TOTAL: ${testFiles.length} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('==================================================');

if (failed > 0) {
  console.error('Failed test suites:', failedFiles);
  process.exit(1);
} else {
  console.log('🎉 ALL TEST SUITES PASSED 100%!');
}
