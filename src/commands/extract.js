const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const {
  getInstalledNodeVersions,
  switchNodeVersion,
  getGlobalPackages
} = require('../utils');

const OUTPUT_FILE = 'nvm-global-packages.txt';

async function extractCommand() {
  console.log(chalk.cyan('=== Extracting global npm packages from all Node.js versions ==='));

  const spinner = ora('Getting installed Node.js versions...').start();
  const nodeVersions = await getInstalledNodeVersions();

  if (nodeVersions.length === 0) {
    spinner.fail('No Node.js versions found.');
    return;
  }

  spinner.succeed(`Found ${nodeVersions.length} Node.js version(s)`);

  // Clear output file
  fs.writeFileSync(OUTPUT_FILE, '');

  for (const version of nodeVersions) {
    console.log(chalk.yellow(`\nProcessing Node.js version ${version}...`));

    const switched = await switchNodeVersion(version);
    if (!switched) {
      console.log(chalk.red(`Failed to switch to Node version ${version}, skipping...`));
      continue;
    }

    // Add version header to file
    fs.appendFileSync(OUTPUT_FILE, `Node Version: ${version}\n`);

    const packageSpinner = ora('Getting global packages...').start();
    const packages = await getGlobalPackages();

    if (packages.length === 0) {
      fs.appendFileSync(OUTPUT_FILE, '(No global packages installed)\n');
      packageSpinner.succeed('No global packages found for this version');
    } else {
      const joinedPackages = packages.join(', ');
      fs.appendFileSync(OUTPUT_FILE, `${joinedPackages}\n`);
      packageSpinner.succeed(`Found ${packages.length} global package(s)`);

      console.log(chalk.gray('  Packages:'), packages.join(', '));
    }

    fs.appendFileSync(OUTPUT_FILE, '\n');
  }

  console.log(chalk.green(`\n✅ Global packages saved to ${OUTPUT_FILE}`));
  console.log(chalk.cyan('Step 1 complete: Extraction done.'));
}

module.exports = extractCommand;
