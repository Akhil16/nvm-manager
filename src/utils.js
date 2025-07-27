const execa = require('execa');
const chalk = require('chalk');
const ora = require('ora');
const os = require('os');
const path = require('path');
const inquirer = require('inquirer');

/**
 * Normalize user input (lowercase and trim spaces)
 * @param {string} input
 * @returns {string}
 */
function normalizeInput(input) {
  return input.toString().toLowerCase().trim();
}

/**
 * Get installed Node.js versions via `nvm ls`
 * @returns {Promise<string[]>} versions
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
 * Get latest stable LTS Node.js version (nvm-windows style detection)
 * @returns {Promise<string|null>} version string like '24.4.1' or null on failure
 */
async function getLatestLtsVersion() {
  try {
    const { stdout } = await execa('nvm', ['list', 'available'], { shell: true });
    const lines = stdout.split('\n');

    // Skip header lines, extract first valid semver version
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
 * Get NVM directory path (uses env variable or default path on Windows)
 * @returns {string}
 */
function getNvmDir() {
  return process.env.NVM_HOME || path.join(os.homedir(), 'AppData', 'Roaming', 'nvm');
}

/**
 * Switch to a specific Node.js version via `nvm use`
 * @param {string} version
 * @returns {Promise<boolean>} success
 */
async function switchNodeVersion(version) {
  const spinner = ora(`Switching to Node.js version ${version}...`).start();
  try {
    await execa('nvm', ['use', version], { shell: true });
    spinner.succeed(`Switched to Node.js version ${version}`);
    return true;
  } catch (error) {
    spinner.fail(`Failed to switch to Node.js version ${version}`);
    console.error(chalk.red('Error:'), error.message);
    return false;
  }
}

/**
 * Install specific Node.js version via `nvm install`
 * @param {string} version
 * @returns {Promise<boolean>} success
 */
async function installNodeVersion(version) {
  const spinner = ora(`Installing Node.js version ${version}...`).start();
  try {
    await execa('nvm', ['install', version], { shell: true });
    spinner.succeed(`Installed Node.js version ${version}`);
    return true;
  } catch (error) {
    spinner.fail(`Failed to install Node.js version ${version}`);
    console.error(chalk.red('Error:'), error.message);
    return false;
  }
}

/**
 * Uninstall specific Node.js version via `nvm uninstall`
 * @param {string} version
 * @returns {Promise<boolean>} success
 */
async function uninstallNodeVersion(version) {
  try {
    await execa('nvm', ['uninstall', version], { shell: true });
    return true;
  } catch (error) {
    console.error(chalk.red(`Failed to uninstall Node.js version ${version}:`), error.message);
    return false;
  }
}

/**
 * Get global npm packages for the current active Node.js version
 * @returns {Promise<string[]>} list of package names excluding 'npm'
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
 * Get global npm packages for a specific Node.js version.
 * Switches to that version temporarily and then reverts.
 * @param {string} version target version (e.g. '18.12.1')
 * @returns {Promise<string[]>} list of global packages excluding 'npm'
 */
async function getGlobalPackagesForVersion(version) {
  const originalVersion = await getCurrentNodeVersion();
  console.log(chalk.cyan(`Getting global packages for Node.js version ${version}...`));

  try {
    if (version !== originalVersion) {
      await execa('nvm', ['use', version], { shell: true });
    }
    const { stdout } = await execa('npm', ['ls', '-g', '--depth=0', '--json'], { shell: true });
    const data = JSON.parse(stdout);
    const pkgs = data.dependencies ? Object.keys(data.dependencies).filter(pkg => pkg !== 'npm') : [];
    console.log(chalk.green(`Found ${pkgs.length} global package(s) for version ${version}`));
    return pkgs;
  } catch (err) {
    console.log(chalk.yellow(`Failed to get global packages for Node.js version ${version}: ${err.message}`));
    return [];
  } finally {
    if (originalVersion && version !== originalVersion) {
      try {
        await execa('nvm', ['use', originalVersion], { shell: true });
        console.log(chalk.gray(`Reverted to original Node.js version ${originalVersion}`));
      } catch (revertErr) {
        console.error(chalk.red(`Failed to revert to original Node.js version ${originalVersion}: ${revertErr.message}`));
      }
    }
  }
}

/**
 * Get current active Node.js version by running `nvm current` or fallback to `node -v`
 * @returns {Promise<string|null>} version string (without leading 'v') or null if not found
 */
async function getCurrentNodeVersion() {
  try {
    const { stdout } = await execa('nvm', ['current'], { shell: true });
    const version = stdout.trim().replace(/^v/, '');
    if (/^\d+\.\d+\.\d+$/.test(version)) {
      return version;
    }
  } catch {
    // fallback below
  }
  try {
    const { stdout } = await execa('node', ['-v'], { shell: true });
    return stdout.trim().replace(/^v/, '');
  } catch {
    return null;
  }
}

/**
 * Get installed version of a global npm package
 * @param {string} packageName
 * @returns {Promise<string|null>} version string or null if not installed
 */
async function getInstalledPackageVersion(packageName) {
  try {
    const { stdout } = await execa('npm', ['ls', '-g', packageName, '--json', '--depth=0'], { shell: true });
    const data = JSON.parse(stdout);
    return data.dependencies && data.dependencies[packageName] ? data.dependencies[packageName].version : null;
  } catch {
    return null;
  }
}

/**
 * Get latest version of a package from npm registry
 * @param {string} packageName
 * @returns {Promise<string|null>} latest version or null on failure
 */
async function getLatestPackageVersion(packageName) {
  try {
    const { stdout } = await execa('npm', ['view', packageName, 'version'], { shell: true });
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Get package description from npm registry
 * @param {string} packageName
 * @returns {Promise<string>} description or fallback message
 */
async function getPackageDescription(packageName) {
  try {
    const { stdout } = await execa('npm', ['view', packageName, 'description'], { shell: true });
    return stdout.trim() || 'No description available.';
  } catch {
    return 'No description available.';
  }
}

/**
 * Install a global npm package
 * @param {string} packageName
 * @returns {Promise<boolean>} success
 */
async function installGlobalPackage(packageName) {
  try {
    await execa('npm', ['install', '-g', packageName], { shell: true });
    return true;
  } catch (error) {
    console.error(chalk.red(`Failed to install ${packageName}:`), error.message);
    return false;
  }
}

/**
 * Check if a Node.js version is still listed in `nvm ls`
 * Uses regex word boundary to avoid partial matches
 * @param {string} version
 * @returns {Promise<boolean>}
 */
async function isVersionStillListed(version) {
  try {
    const { stdout } = await execa('nvm', ['list'], { shell: true });
    const regex = new RegExp(`\\b${version}\\b`);
    return regex.test(stdout);
  } catch {
    return false;
  }
}

/**
 * Prompt user to confirm an action
 * @param {string} message
 * @returns {Promise<boolean>} true if confirmed
 */
function confirmAction(message) {
  return inquirer
    .prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message,
        default: false,
      },
    ])
    .then((answers) => answers.confirmed);
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
  getGlobalPackagesForVersion,
  getCurrentNodeVersion,
  getInstalledPackageVersion,
  getLatestPackageVersion,
  getPackageDescription,
  installGlobalPackage,
  isVersionStillListed,
  confirmAction
};
