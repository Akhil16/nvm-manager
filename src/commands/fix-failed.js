const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');
const {
  getInstalledNodeVersions,
  getLatestLtsVersion,
  getNvmDir,
  uninstallNodeVersion,
  isVersionStillListed
} = require('../utils');

async function fixFailedCommand() {
  console.log(chalk.cyan('=== Fix phantom Node.js versions showing in nvm list ==='));

  const latestLts = await getLatestLtsVersion();
  if (!latestLts) {
    console.error(chalk.red('Could not detect latest stable LTS version.'));
    return;
  }

  console.log(chalk.green(`Latest stable LTS version (will be preserved): ${latestLts}`));

  const nvmDir = getNvmDir();
  if (!fs.existsSync(nvmDir)) {
    console.error(chalk.red(`NVM directory not found: ${nvmDir}`));
    console.log(chalk.yellow('Please set NVM_HOME environment variable or update the script.'));
    return;
  }

  console.log(chalk.blue(`Detected NVM directory: ${nvmDir}`));

  const installedVersions = await getInstalledNodeVersions();
  if (installedVersions.length === 0) {
    console.log(chalk.yellow('No Node.js versions found installed with nvm.'));
    return;
  }

  console.log(chalk.yellow('\nAttempting to fix phantom Node.js versions...'));

  for (const version of installedVersions) {
    if (version === latestLts) {
      console.log(chalk.green(`Skipping latest stable LTS version: ${version}`));
      continue;
    }

    console.log(chalk.blue(`\nAttempting to uninstall Node.js version ${version}...`));
    const uninstallSuccess = await uninstallNodeVersion(version);

    // Check if version still appears in list
    const stillListed = await isVersionStillListed(version);

    if (uninstallSuccess && !stillListed) {
      console.log(chalk.green(`✅ Uninstalled Node.js version ${version} successfully.`));
      continue;
    }

    console.log(chalk.yellow(`⚠️  Uninstall failed or version ${version} still appears in 'nvm list'.`));
    console.log(chalk.gray('   Will attempt manual folder deletion.'));

    // Prompt for manual deletion
    const shouldDelete = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'delete',
        message: `Do you want to manually delete the folder for Node.js version ${version}?`,
        default: true
      }
    ]);

    if (shouldDelete.delete) {
      // Try with 'v' prefix first (standard nvm-windows naming)
      const versionPath = path.join(nvmDir, `v${version}`);
      const altVersionPath = path.join(nvmDir, version);

      let pathToDelete = null;

      if (fs.existsSync(versionPath)) {
        pathToDelete = versionPath;
      } else if (fs.existsSync(altVersionPath)) {
        pathToDelete = altVersionPath;
      }

      if (pathToDelete) {
        try {
          console.log(chalk.blue(`Deleting folder ${pathToDelete}...`));
          fs.rmSync(pathToDelete, { recursive: true, force: true });
          console.log(chalk.green(`✅ Successfully deleted folder ${pathToDelete}`));

          // Verify if version still appears
          const stillListedAfterDelete = await isVersionStillListed(version);
          if (stillListedAfterDelete) {
            console.log(chalk.yellow(`⚠️  Warning: Version ${version} still appears in 'nvm list'.`));
            console.log(chalk.gray('   You may need to check settings.txt or restart your shell.'));
          } else {
            console.log(chalk.green(`✅ Version ${version} no longer appears in 'nvm list'.`));
          }
        } catch (error) {
          console.error(chalk.red(`❌ Failed to delete folder ${pathToDelete}:`), error.message);
          console.log(chalk.yellow('   Please check permissions or delete manually.'));
        }
      } else {
        console.log(chalk.gray(`   Folder for version ${version} does not exist. Skipping manual deletion.`));

        // If folder doesn't exist but still listed, suggest config file check
        const stillListedNoFolder = await isVersionStillListed(version);
        if (stillListedNoFolder) {
          console.log(chalk.yellow(`\n⚠️  Version ${version} still appears in 'nvm list' but no folder exists.`));
          console.log(chalk.gray('   This suggests a phantom entry in nvm configuration.'));
          console.log(chalk.blue('   Manual steps to fix:'));
          console.log(chalk.gray(`   1. Open ${path.join(nvmDir, 'settings.txt')}`));
          console.log(chalk.gray(`   2. Remove any reference to version ${version}`));
          console.log(chalk.gray('   3. Save the file and restart your shell'));
        }
      }
    } else {
      console.log(chalk.gray(`Skipped manual deletion for version ${version}.`));
    }
  }

  console.log(chalk.green(`\n✅ Cleanup of phantom Node.js versions complete.`));
  console.log(chalk.cyan(`Latest LTS version ${latestLts} remains installed.`));
}

module.exports = fixFailedCommand;
