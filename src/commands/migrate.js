const fs = require('fs');
const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const {
  getInstalledNodeVersions,
  getLatestLtsVersion,
  switchNodeVersion,
  getGlobalPackagesForVersion,
  installGlobalPackage
} = require('../utils');

/**
 * Get unique global packages across all installed versions
 */
async function getGlobalPackagesFromAllVersions(installedVersions) {
  const allPackages = [];
  for (const version of installedVersions) {
    const packages = await getGlobalPackagesForVersion(version);
    allPackages.push(...packages);
  }
  return [...new Set(allPackages)]; // Remove duplicates
}

/**
 * Migrate global packages command handler
 * @param {import('commander').Command} program - commander program instance to access CLI options
 */
async function migrateCommand(program) {
  console.log(chalk.cyan('=== Migrate global packages ==='));

  // Get installed Node versions
  const installedVersions = await getInstalledNodeVersions();
  if (!installedVersions.length) {
    console.log(chalk.yellow('No Node.js versions found installed with nvm.'));
    return;
  }

  const opts = program.optsWithGlobals();

  // Interactive prompts if CLI options not provided
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'to',
      message: 'Select Node version to migrate to:',
      choices: installedVersions.concat(['Latest stable LTS (default)']),
      when: !opts.to,
    },
    {
      type: 'list',
      name: 'from',
      message: 'Select source for migration:',
      choices: installedVersions.concat(['All versions']),
      when: !opts.from,
    },
    {
      type: 'confirm',
      name: 'installAll',
      message: 'Install all packages without prompt?',
      default: false,
      when: !opts.y,
    },
  ]);

  let targetVersion =
    opts.to || (answers.to === 'Latest stable LTS (default)' ? await getLatestLtsVersion() : answers.to);
  if (!targetVersion) {
    console.error(chalk.red('Could not detect latest stable LTS version.'));
    return;
  }

  let fromVersion = opts.from || answers.from;
  if (fromVersion === 'All versions') fromVersion = 'all';

  const installAll = opts.y ?? answers.installAll;

  console.log(chalk.blue(`Target Node version: ${targetVersion}`));
  console.log(chalk.blue(`Source version(s): ${fromVersion === 'all' ? 'All installed versions' : fromVersion}`));

  // Switch to target Node version
  const switched = await switchNodeVersion(targetVersion);
  if (!switched) {
    console.log(chalk.yellow(`Warning: Failed to switch to Node version ${targetVersion}, proceeding anyway.`));
  }

  // Gather packages from source version(s)
  let allPackages = [];
  if (fromVersion === 'all') {
    allPackages = await getGlobalPackagesFromAllVersions(installedVersions);
  } else {
    allPackages = await getGlobalPackagesForVersion(fromVersion);
  }

  if (allPackages.length === 0) {
    console.log(chalk.yellow('No global packages found to migrate.'));
    return;
  }

  // If not install all, ask user to select packages
  if (!installAll) {
    const pkgSelection = await inquirer.prompt({
      type: 'checkbox',
      name: 'packages',
      message: 'Select packages to install:',
      choices: allPackages,
      pageSize: 15,
    });
    allPackages = pkgSelection.packages;
    if (allPackages.length === 0) {
      console.log(chalk.yellow('No packages selected for installation. Exiting.'));
      return;
    }
  }

  // Install selected packages with progress spinner
  const spinner = ora('Installing selected packages...').start();
  for (const packageName of allPackages) {
    const success = await installGlobalPackage(packageName);
    if (!success) {
      spinner.fail(`Failed to install package ${packageName}`);
      // Optionally handle abort or continue
    }
  }
  spinner.stop();

  console.log(chalk.green(`\n✅ Successfully migrated global packages to Node version ${targetVersion}`));
}

module.exports = migrateCommand;
