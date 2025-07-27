const fs = require('fs');
const chalk = require('chalk');
const ora = require('ora');
const { table } = require('table');
const inquirer = require('inquirer');
const {
  getInstalledNodeVersions,
  switchNodeVersion,
  getGlobalPackages
} = require('../utils');

const OUTPUT_FILE = 'nvm-global-packages.txt';

async function listAllCommand(program) {
  const jsonOutput = program.opts().json || false;
  const versionsFlag = program.opts().versions || null;

  console.log(chalk.cyan('=== Listing global npm packages for Node.js versions ==='));
  const spinner = ora('Retrieving installed Node.js versions...').start();

  const allInstalledVersions = await getInstalledNodeVersions();

  if (allInstalledVersions.length === 0) {
    spinner.fail('No Node.js versions found.');
    return;
  }
  spinner.succeed(`Found ${allInstalledVersions.length} Node.js version(s)`);

  // Decide which versions to process
  let versionsToUse;

  if (versionsFlag) {
    if (versionsFlag.toLowerCase() === 'all') {
      versionsToUse = allInstalledVersions;
    } else {
      // Parse CSV input
      const requestedVersions = versionsFlag.split(',').map(v => v.trim());
      // Validate each requested version exists
      const invalidVersions = requestedVersions.filter(
        v => !allInstalledVersions.includes(v)
      );
      if (invalidVersions.length > 0) {
        console.error(
          chalk.red(
            `Error: Invalid Node.js version(s) specified: ${invalidVersions.join(', ')}`
          )
        );
        console.error(chalk.yellow(`Installed versions: ${allInstalledVersions.join(', ')}`));
        process.exit(1);
      }
      versionsToUse = requestedVersions;
    }
  } else {
    // Default: all versions
    versionsToUse = allInstalledVersions;
  }

  const results = [];

  // Clear output file before starting
  fs.writeFileSync(OUTPUT_FILE, '');

  for (const version of versionsToUse) {
    console.log(chalk.yellow(`\nProcessing Node.js version ${version}...`));
    const switched = await switchNodeVersion(version);

    if (!switched) {
      console.log(chalk.red(`Failed to switch to Node version ${version}, skipping...`));
      continue;
    }

    const packageSpinner = ora('Getting global packages...').start();
    const packages = await getGlobalPackages();
    packageSpinner.stop();

    if (!packages.length) {
      console.log(chalk.gray('No global packages found for this version.'));
    } else {
      console.log(chalk.gray(`Packages: ${packages.join(', ')}`));
    }

    // Append to output file with headers
    fs.appendFileSync(OUTPUT_FILE, `Node Version: ${version}\n`);
    fs.appendFileSync(
      OUTPUT_FILE,
      (packages.length === 0 ? '(No global packages installed)' : packages.join(', ')) + '\n\n'
    );

    results.push({ version, packages });
  }

  console.log(chalk.green(`\n✅ Global packages saved to ${OUTPUT_FILE}`));

  if (jsonOutput) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    if (results.length === 0) {
      console.log(chalk.yellow('No global packages found for selected Node.js versions.'));
      return;
    }

    const tableData = [['Node Version', 'Global Packages']];

    results.forEach(({ version, packages }) => {
      tableData.push([
        version,
        packages.length === 0 ? '(None)' : packages.join(', ')
      ]);
    });

    const output = table(tableData, {
      columns: {
        0: { alignment: 'left', width: 15 },
        1: { alignment: 'left', width: 80 }
      }
    });

    console.log(output);
  }

  console.log(chalk.cyan('Listing done.'));
}

module.exports = listAllCommand;
