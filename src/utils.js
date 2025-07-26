const { execa } = require('execa');
const chalk = require('chalk');
const ora = require('ora');
const os = require('os');
const path = require('path');

/**
 * Normalize user input (lowercase and trim spaces)
 */
function normalizeInput(input) {
  return input.toString().toLowerCase().trim();
}

/**
 * Get installed Node.js versions from nvm
 */
async function getInstalledNodeVersions() {
  try {
    const { stdout } = await execa('nvm', ['ls'], { shell: true });
    const versions = stdout.match(/\d+\.\d+\.\d+/g) || [];
    return versions;
  } catch (error) {
    console.error(chalk.red('Error getting installed Node versions:'), error.message);
    return [];
  }
}

/**
 * Get latest stable LTS Node.js version (nvm-windows style)
 */
async function getLatestLtsVersion() {
  try {
    const { stdout } = await execa('nvm', ['list', 'available'], { shell: true });
    const lines = stdout.split('\n');

    // Skip header lines and find first version
    for (let i = 2; i < lines.length; i++) {
      const parts = lines[i].trim().split(/\s+/);
      if (parts.length >= 2 && /^\d+\.\d+\.\d+$/.test(parts[1])) {
        return parts[1];
      }
    }
    throw new Error('Could not detect latest LTS version');
  } catch (error) {
    console.error(chalk.red('Error getting latest LTS version:'), error.message);
    return null;
  }
}

/**
 * Get NVM directory path
 */
function getNvmDir() {
  return process.env.NVM_HOME || path.join(os.homedir(), 'AppData', 'Roaming', 'nvm');
}

/**
 * Switch to a specific Node.js version
 */
async function switchNodeVersion(version) {
  const spinner = ora(`Switching to Node.js version \${version}...`).start();
  try {
    await execa('nvm', ['use', version], { shell: true });
    spinner.succeed(`Switched to Node.js version \${version}`);
    return true;
  } catch (error) {
    spinner.fail(`Failed to switch to Node.js version \${version}`);
    console.error(chalk.red('Error:'), error.message);
    return false;
  }
}

/**
 * Install a Node.js version
 */
async function installNodeVersion(version) {
  const spinner = ora(`Installing Node.js version \${version}...`).start();
  try {
    await execa('nvm', ['install', version], { shell: true });
    spinner.succeed(`Installed Node.js version \${version}`);
    return true;
  } catch (error) {
    spinner.fail(`Failed to install Node.js version \${version}`);
    console.error(chalk.red('Error:'), error.message);
    return false;
  }
}

/**
 * Uninstall a Node.js version
 */
async function uninstallNodeVersion(version) {
  try {
    await execa('nvm', ['uninstall', version], { shell: true });
    return true;
  } catch (error) {
    console.error(chalk.red(`Failed to uninstall Node.js version \${version}:`), error.message);
    return false;
  }
}

/**
 * Get global packages for current Node version
 */
async function getGlobalPackages() {
  try {
    const { stdout } = await execa('npm', ['ls', '-g', '--depth=0', '--json'], { shell: true });
    const data = JSON.parse(stdout);
    if (data.dependencies) {
      return Object.keys(data.dependencies).filter(pkg => pkg !== 'npm');
    }
    return [];
  } catch (error) {
    console.error(chalk.red('Error getting global packages:'), error.message);
    return [];
  }
}

/**
 * Get installed version of a global package
 */
async function getInstalledPackageVersion(packageName) {
  try {
    const { stdout } = await execa('npm', ['ls', '-g', packageName, '--json', '--depth=0'], { shell: true });
    const data = JSON.parse(stdout);
    if (data.dependencies && data.dependencies[packageName]) {
      return data.dependencies[packageName].version;
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Get latest version of a package from npm registry
 */
async function getLatestPackageVersion(packageName) {
  try {
    const { stdout } = await execa('npm', ['view', packageName, 'version'], { shell: true });
    return stdout.trim();
  } catch (error) {
    return null;
  }
}

/**
 * Get package description from npm registry
 */
async function getPackageDescription(packageName) {
  try {
    const { stdout } = await execa('npm', ['view', packageName, 'description'], { shell: true });
    return stdout.trim() || 'No description available.';
  } catch (error) {
    return 'No description available.';
  }
}

/**
 * Install a global package
 */
async function installGlobalPackage(packageName) {
  try {
    await execa('npm', ['install', '-g', packageName], { shell: true });
    return true;
  } catch (error) {
    console.error(chalk.red(`Failed to install \${packageName}:`), error.message);
    return false;
  }
}

/**
 * Check if a version still appears in nvm list
 */
async function isVersionStillListed(version) {
  try {
    const { stdout } = await execa('nvm', ['list'], { shell: true });
    return stdout.includes(version);
  } catch (error) {
    return false;
  }
}

/**
 * Confirm action with user
 */
function confirmAction(message) {
  const inquirer = require('inquirer');
  return inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: message,
      default: false
    }
  ]).then(answers => answers.confirmed);
}

module.exports = {
  normalizeInput,
  getInstalledNodeVersions,
  getLatestLtsVersion,
  getNvmDir,
  switchNodeVersion,
  installNodeVersion,
  uninstallNodeVersion,
  getGlobalPackages,
  getInstalledPackageVersion,
  getLatestPackageVersion,
  getPackageDescription,
  installGlobalPackage,
  isVersionStillListed,
  confirmAction
};
