const fs = require('fs');
const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const {
  getInstalledNodeVersions,
  getLatestLtsVersion,
  switchNodeVersion,
  installNodeVersion,
  getInstalledPackageVersion,
  getLatestPackageVersion,
  getPackageDescription,
  installGlobalPackage,
  confirmAction
} = require('../utils');

const PACKAGE_LIST_FILE = 'nvm-global-packages.txt';

function parsePackageList() {
  if (!fs.existsSync(PACKAGE_LIST_FILE)) {
    console.error(chalk.red(`Error: Package list file '${PACKAGE_LIST_FILE}' not found.`));
    console.log(
      chalk.yellow(
        'Please run "nvm-manager list-all" first to create the package list.'
      )
    );
    return [];
  }

  const contents = fs.readFileSync(PACKAGE_LIST_FILE, 'utf-8');
  const lines = contents.split('\n');

  const packages = new Set();

  for (const line of lines) {
    // Skip empty lines, headers, and "no packages" messages
    if (!line.trim() || 
        line.startsWith('Node Version:') || 
        line.includes('No global packages installed')) {
      continue;
    }

    // Parse packages from comma-separated line
    const linePackages = line.split(',')
      .map(pkg => pkg.trim())
      .filter(pkg => pkg && pkg !== 'npm');

    linePackages.forEach(pkg => packages.add(pkg));
  }

  return Array.from(packages).sort();
}

async function installCommand() {
  console.log(chalk.cyan('=== Install latest Node.js LTS and global packages ==='));

  // Parse package list
  const allPackages = parsePackageList();
  if (allPackages.length === 0) {
    console.log(chalk.yellow('No global packages found in package list. Exiting.'));
    return;
  }

  // Get latest LTS version
  const latestLts = await getLatestLtsVersion();
  if (!latestLts) {
    console.error(chalk.red('Error: Could not detect latest stable Node.js version.'));
    return;
  }

  const installedVersions = await getInstalledNodeVersions();
  const alreadyHasLatest = installedVersions.includes(latestLts);

  console.log(chalk.green(`Latest stable Node.js LTS: ${latestLts}`));
  console.log(chalk.blue('Currently installed Node versions:'));
  installedVersions.forEach(ver => console.log(chalk.gray(`  ${ver}`)));

  // Check which packages need updating
  const spinner = ora('Checking package versions...').start();
  const missingPackages = [];

  for (const pkg of allPackages) {
    const latestVer = await getLatestPackageVersion(pkg);
    const installedVer = await getInstalledPackageVersion(pkg);

    if (installedVer !== latestVer) {
      missingPackages.push(pkg);
    }
  }
  spinner.stop();

  // Skip everything if up to date
  if (alreadyHasLatest && missingPackages.length === 0) {
    console.log(chalk.green(`\n✅ Latest Node.js (${latestLts}) and all packages are up to date.`));
    console.log(chalk.cyan('Nothing to install. Exiting.'));
    return;
  }

  // Confirm proceeding
  const shouldProceed = await confirmAction(
    `Proceed with installing Node.js ${latestLts} and ${missingPackages.length} missing/outdated packages?`
  );

  if (!shouldProceed) {
    console.log(chalk.yellow('Aborted by user.'));
    return;
  }

  // Install Node.js if needed
  if (!alreadyHasLatest) {
    const installed = await installNodeVersion(latestLts);
    if (!installed) {
      console.error(chalk.red(`Error installing Node.js ${latestLts}.`));
      return;
    }
  }

  // Switch to latest version  
  const switched = await switchNodeVersion(latestLts);
  if (!switched) {
    console.error(chalk.red(`Error switching to Node.js ${latestLts}.`));
    return;
  }

  // Determine packages to install
  const packagesToInstall = alreadyHasLatest ? missingPackages : allPackages;

  if (packagesToInstall.length === 0) {
    console.log(chalk.green('\n✅ No packages require installation.'));
    return;
  }

  console.log(chalk.yellow(`\nPackages to install/update (${packagesToInstall.length}):`));
  packagesToInstall.forEach(pkg => console.log(chalk.gray(`  ${pkg}`)));

  let skipAll = false;
  let installAll = false;

  for (const pkg of packagesToInstall) {
    if (skipAll) {
      console.log(chalk.gray(`Skipping package ${pkg} (skip all enabled).`));
      continue;
    }

    if (installAll) {
      console.log(chalk.blue(`Installing package ${pkg} (install all enabled).`));
      const success = await installGlobalPackage(pkg);
      if (success) {
        console.log(chalk.green(`✅ Installed ${pkg} successfully.`));
      } else {
        console.log(chalk.red(`❌ Error installing ${pkg}.`));
      }
      continue;
    }

    // Get package info
    const desc = await getPackageDescription(pkg);
    const latestVer = await getLatestPackageVersion(pkg) || 'unknown';
    const installedVer = await getInstalledPackageVersion(pkg);

    // Check if already at latest
    if (installedVer === latestVer) {
      console.log(chalk.green(`\n📦 Package: ${pkg} (version ${latestVer})`));
      console.log(chalk.gray(`   Description: ${desc}`));
      console.log(chalk.green(`   Already at latest version. Skipping.`));
      continue;
    }

    // Show package details
    console.log(chalk.yellow(`\n📦 Package: ${pkg}`));
    console.log(chalk.gray(`   Description: ${desc}`));
    console.log(chalk.blue(`   Latest Version Available: ${latestVer}`));
    console.log(chalk.gray(`   Installed Version: ${installedVer || 'Not installed'}`));

    // Interactive prompt
    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: `Install package '${pkg}'?`,
        choices: [
          { name: 'Yes (y)', value: 'y' },
          { name: 'No (n)', value: 'n' },
          { name: 'Yes to all remaining (y-all)', value: 'y-all' },
          { name: 'No to all remaining (n-all)', value: 'n-all' }
        ],
        default: 'y'
      }
    ]);

    switch (answer.action) {
      case 'y':
        console.log(chalk.blue(`Installing ${pkg}...`));
        const success = await installGlobalPackage(pkg);
        if (success) {
          console.log(chalk.green(`✅ Installed ${pkg} successfully.`));
        } else {
          console.log(chalk.red(`❌ Error installing ${pkg}.`));
        }
        break;

      case 'n':
        console.log(chalk.gray(`Skipping ${pkg}.`));
        break;

      case 'y-all':
        console.log(chalk.blue(`Installing ${pkg} and all remaining packages...`));
        const successAll = await installGlobalPackage(pkg);
        if (successAll) {
          console.log(chalk.green(`✅ Installed ${pkg} successfully.`));
        } else {
          console.log(chalk.red(`❌ Error installing ${pkg}.`));
        }
        installAll = true;
        break;

      case 'n-all':
        console.log(chalk.gray(`Skipping ${pkg} and all remaining packages.`));
        skipAll = true;
        break;
    }
  }

  console.log(chalk.green('\n✅ Installation complete.'));
}

module.exports = installCommand;
