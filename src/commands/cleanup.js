const chalk = require('chalk');
const inquirer = require('inquirer');
const {
  getInstalledNodeVersions,
  getLatestLtsVersion,
  switchNodeVersion,
  uninstallNodeVersion,
  normalizeInput
} = require('../utils');

async function cleanupCommand() {
  console.log(chalk.cyan('=== Cleanup: Remove Node.js versions except latest stable LTS ==='));

  const latestLts = await getLatestLtsVersion();
  if (!latestLts) {
    console.error(chalk.red('Could not detect latest stable LTS version.'));
    return;
  }

  console.log(chalk.green(`Latest stable LTS version (will be preserved): ${latestLts}`));

  // Switch to latest LTS
  const switched = await switchNodeVersion(latestLts);
  if (!switched) {
    console.log(chalk.yellow('Warning: Failed to switch to latest LTS, continuing anyway...'));
  }

  const installedVersions = await getInstalledNodeVersions();
  if (installedVersions.length === 0) {
    console.log(chalk.yellow('No Node.js versions found installed with nvm.'));
    return;
  }

  // Filter out latest LTS from uninstall list
  const toUninstall = installedVersions.filter(ver => ver !== latestLts);

  if (toUninstall.length === 0) {
    console.log(chalk.green('No Node.js versions to uninstall (only latest LTS is installed).'));
    return;
  }

  console.log(chalk.yellow('\nNode.js versions available for uninstallation:'));
  toUninstall.forEach(ver => console.log(chalk.gray(`  ${ver}`)));
  console.log('');

  let skipAll = false;
  let uninstallAll = false;

  for (const version of toUninstall) {
    if (skipAll) {
      console.log(chalk.gray(`Skipping Node.js version ${version} (skip all enabled).`));
      continue;
    }

    if (uninstallAll) {
      console.log(chalk.blue(`Uninstalling Node.js version ${version} (uninstall all enabled).`));
      const success = await uninstallNodeVersion(version);
      if (success) {
        console.log(chalk.green(`✅ Successfully uninstalled Node.js version ${version}`));
      } else {
        console.log(chalk.red(`❌ Failed to uninstall Node.js version ${version}`));
      }
      continue;
    }

    // Interactive prompt for each version
    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: `Do you want to uninstall Node.js version ${version}?`,
        choices: [
          { name: 'Yes (y)', value: 'y' },
          { name: 'No (n)', value: 'n' },
          { name: 'Yes to all remaining (y-all)', value: 'y-all' },
          { name: 'Skip all remaining (skip-all)', value: 'skip-all' }
        ],
        default: 'n'
      }
    ]);

    switch (answer.action) {
      case 'y':
        console.log(chalk.blue(`Uninstalling Node.js version ${version}...`));
        const success = await uninstallNodeVersion(version);
        if (success) {
          console.log(chalk.green(`✅ Successfully uninstalled Node.js version ${version}`));
        } else {
          console.log(chalk.red(`❌ Failed to uninstall Node.js version ${version}`));
        }
        break;

      case 'n':
        console.log(chalk.gray(`Skipping Node.js version ${version}.`));
        break;

      case 'y-all':
        console.log(chalk.blue(`Uninstalling Node.js version ${version} and all remaining versions...`));
        const successAll = await uninstallNodeVersion(version);
        if (successAll) {
          console.log(chalk.green(`✅ Successfully uninstalled Node.js version ${version}`));
        } else {
          console.log(chalk.red(`❌ Failed to uninstall Node.js version ${version}`));
        }
        uninstallAll = true;
        break;

      case 'skip-all':
        console.log(chalk.gray(`Skipping Node.js version ${version} and all remaining versions.`));
        skipAll = true;
        break;
    }
  }

  console.log(chalk.green(`\n✅ Cleanup complete. Latest LTS Node.js version ${latestLts} remains installed.`));
}

module.exports = cleanupCommand;
