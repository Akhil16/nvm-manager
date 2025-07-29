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
// --- Platform helpers ---
function isWindows() {
  return process.platform === 'win32';
}

function getNvmDir() {
  if (isWindows()) {
    return process.env.NVM_HOME || path.join(os.homedir(), 'AppData', 'Roaming', 'nvm');
  } else {
    return process.env.NVM_DIR || `${process.env.HOME}/.nvm`;
  }
}

function getNvmSourceCmd() {
  const nvmDir = getNvmDir();
  return `. "${nvmDir}/nvm.sh"`;
}

async function runNvmCmd(args, opts = {}) {
  if (isWindows()) {
    return execa("nvm", args, { shell: true, ...opts });
  } else {
    // Source nvm and run the command in a shell session
    const nvmDir = getNvmDir();
    const sourceNvm = getNvmSourceCmd();
    // Build the command string
    const cmd = `export NVM_DIR=\"${nvmDir}\"; ${sourceNvm}; nvm ${args
      .map((a) => `'${a}'`)
      .join(" ")}`;
    return execa.command(cmd, { shell: true, ...opts });
  }
}
// --- Main utils ---
async function getInstalledNodeVersions() {
  try {
    const nvmDir = getNvmDir();
    let versions = [];
    if (isWindows()) {
      // Windows: nvm-windows stores versions in NVM_HOME root
      const fs = require("fs");
      if (fs.existsSync(nvmDir)) {
        versions = fs
          .readdirSync(nvmDir)
          .filter(
            (name) =>
              /^v?\d+\.\d+\.\d+$/.test(name) &&
              fs.statSync(path.join(nvmDir, name)).isDirectory()
          )
          .map((name) => name.replace(/^v/, ""));
        if (versions.length === 0) {
          console.log(
            chalk.yellow(`[nvm-manager] No versions found in ${nvmDir}`)
          );
        }
      } else {
        console.log(
          chalk.yellow(
            `[nvm-manager] NVM_HOME directory ${nvmDir} does not exist`
          )
        );
      }
    } else {
      // Unix: $NVM_DIR/versions/node/* (standard), fallback to $NVM_DIR/* (legacy)
      const fs = require("fs");
      let nodeDir = path.join(nvmDir, "versions", "node");
      if (fs.existsSync(nodeDir)) {
        // Standard nvm >=0.33.0 layout
        versions = fs
          .readdirSync(nodeDir)
          .filter(
            (name) =>
              /^v?\d+\.\d+\.\d+$/.test(name) &&
              fs.statSync(path.join(nodeDir, name)).isDirectory()
          )
          .map((name) => name.replace(/^v/, ""));
        if (versions.length === 0) {
          console.log(
            chalk.yellow(`[nvm-manager] No versions found in ${nodeDir}`)
          );
        }
      } else {
        // Fallback: legacy layout, versions directly under $NVM_DIR
        nodeDir = nvmDir;
        if (fs.existsSync(nodeDir)) {
          versions = fs
            .readdirSync(nodeDir)
            .filter(
              (name) =>
                /^v?\d+\.\d+\.\d+$/.test(name) &&
                fs.statSync(path.join(nodeDir, name)).isDirectory()
            )
            .map((name) => name.replace(/^v/, ""));
          if (versions.length === 0) {
            console.log(
              chalk.yellow(
                `[nvm-manager] No versions found in fallback ${nodeDir}`
              )
            );
          }
        } else {
          console.log(
            chalk.yellow(
              `[nvm-manager] Neither ${path.join(
                nvmDir,
                "versions",
                "node"
              )} nor ${nvmDir} exist`
            )
          );
        }
      }
    }
    return versions;
  } catch (error) {
    console.error(
      chalk.red("Error scanning Node.js version directories:"),
      error.message
    );
    return [];
  }
}

/**
 * Get latest stable LTS Node.js version (nvm-windows style detection)
 * @returns {Promise<string|null>} version string like '24.4.1' or null on failure
 */
async function getLatestLtsVersion() {
  try {
    let stdout;
    if (isWindows()) {
      ({ stdout } = await runNvmCmd(["list", "available"]));
      const ltsLine = stdout.split("\n").find((line) => line.includes("LTS:"));
      if (ltsLine) {
        const match = ltsLine.match(/\d+\.\d+\.\d+/);
        if (match) return match[0];
      }
    } else {
      ({ stdout } = await runNvmCmd(["ls-remote", "--lts"]));
      const lines = stdout
        .split("\n")
        .filter((line) => line.trim().startsWith("v"));
      if (lines.length) {
        const last = lines[lines.length - 1];
        const match = last.match(/\d+\.\d+\.\d+/);
        if (match) return match[0];
      }
    }
    throw new Error("Could not detect latest LTS version");
  } catch (error) {
    console.error(
      chalk.red("Error getting latest LTS version:"),
      error.message
    );
    return null;
  }
}

/**
 * Switch to a specific Node.js version via `nvm use`
 * @param {string} version
 * @returns {Promise<boolean>} success
 */
async function switchNodeVersion(version) {
  const spinner = ora(`Switching to Node.js version ${version}...`).start();
  try {
    await runNvmCmd(["use", version]);
    spinner.succeed(`Switched to Node.js version ${version}`);
    return true;
  } catch (error) {
    spinner.fail(`Failed to switch to Node.js version ${version}`);
    console.error(chalk.red("Error:"), error.message);
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
    await runNvmCmd(["install", version]);
    spinner.succeed(`Installed Node.js version ${version}`);
    return true;
  } catch (error) {
    spinner.fail(`Failed to install Node.js version ${version}`);
    console.error(chalk.red("Error:"), error.message);
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
    await runNvmCmd(["uninstall", version]);
    return true;
  } catch (error) {
    console.error(
      chalk.red(`Failed to uninstall Node.js version ${version}:`),
      error.message
    );
    return false;
  }
}

/**
 * Get global npm packages for the current active Node.js version
 * @returns {Promise<string[]>} list of package names excluding 'npm'
 */
async function getGlobalPackages() {
  try {
    const { stdout } = await execa("npm", ["ls", "-g", "--depth=0", "--json"], {
      shell: true,
    });
    const data = JSON.parse(stdout);
    if (data.dependencies) {
      return Object.keys(data.dependencies).filter((pkg) => pkg !== "npm");
    }
    return [];
  } catch (error) {
    console.error(chalk.red("Error getting global packages:"), error.message);
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
  const isWindows = process.platform === "win32";
  console.log(
    chalk.cyan(`Getting global packages for Node.js version ${version}...`)
  );
  try {
    let stdout;
    const major = parseInt(version.split(".")[0], 10);
    if (isWindows) {
      // Run all commands in a single shell session to ensure correct version
      let cmd = `nvm use ${version} > NUL && `;
      if (major >= 16) {
        cmd += "npm install -g corepack > NUL 2>&1 && ";
      }
      cmd += "npm ls -g --depth=0 --json";
      ({ stdout } = await execa.command(cmd, { shell: true }));
    } else {
      // Unix: run all commands in a single shell session
      const nvmDir = getNvmDir();
      let cmd = `export NVM_DIR=\"${nvmDir}\"; . \"${nvmDir}/nvm.sh\"; nvm use ${version} > /dev/null;`;
      if (major >= 16) {
        cmd += " npm install -g corepack > /dev/null 2>&1;";
      }
      cmd += " npm ls -g --depth=0 --json";
      ({ stdout } = await execa.command(cmd, { shell: true }));
    }
    const data = JSON.parse(stdout);
    const pkgs = data.dependencies
      ? Object.keys(data.dependencies).filter((pkg) => pkg !== "npm")
      : [];
    if (major >= 16 && !pkgs.includes("corepack")) {
      console.log(
        chalk.yellow(
          `[nvm-manager] Warning: corepack missing from global packages for Node.js ${version}`
        )
      );
    }
    console.log(
      chalk.green(
        `Found ${pkgs.length} global package(s) for version ${version}`
      )
    );
    return pkgs;
  } catch (err) {
    console.log(
      chalk.yellow(
        `Failed to get global packages for Node.js version ${version}: ${err.message}`
      )
    );
    return [];
  }
}

/**
 * Get current active Node.js version by running `nvm current` or fallback to `node -v`
 * @returns {Promise<string|null>} version string (without leading 'v') or null if not found
 */
async function getCurrentNodeVersion() {
  try {
    const { stdout } = await runNvmCmd(["current"]);
    const version = stdout.trim().replace(/^v/, "");
    if (/^\d+\.\d+\.\d+$/.test(version)) {
      return version;
    }
  } catch {
    // fallback below
  }
  try {
    const { stdout } = await execa("node", ["-v"], { shell: true });
    return stdout.trim().replace(/^v/, "");
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
    const { stdout } = await execa(
      "npm",
      ["ls", "-g", packageName, "--json", "--depth=0"],
      { shell: true }
    );
    const data = JSON.parse(stdout);
    return data.dependencies && data.dependencies[packageName]
      ? data.dependencies[packageName].version
      : null;
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
    const { stdout } = await execa("npm", ["view", packageName, "version"], {
      shell: true,
    });
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
    const { stdout } = await execa(
      "npm",
      ["view", packageName, "description"],
      { shell: true }
    );
    return stdout.trim() || "No description available.";
  } catch {
    return "No description available.";
  }
}

/**
 * Install a global npm package
 * @param {string} packageName
 * @returns {Promise<boolean>} success
 */
/**
 * Install a global npm package for a specific Node.js version
 * @param {string} packageName
 * @param {string} [nodeVersion] Optional Node.js version to use for install
 * @returns {Promise<boolean>} success
 */
async function installGlobalPackage(packageName, nodeVersion) {
  try {
    if (nodeVersion) {
      const isWindows = process.platform === "win32";
      if (isWindows) {
        const cmd = `nvm use ${nodeVersion} > NUL && npm install -g ${packageName}`;
        await execa.command(cmd, { shell: true });
      } else {
        const nvmDir = getNvmDir();
        const cmd = `export NVM_DIR=\"${nvmDir}\"; . \"${nvmDir}/nvm.sh\"; nvm use ${nodeVersion} > /dev/null; npm install -g ${packageName}`;
        await execa.command(cmd, { shell: true });
      }
    } else {
      await execa("npm", ["install", "-g", packageName], { shell: true });
    }
    return true;
  } catch (error) {
    console.error(
      chalk.red(
        `Failed to install ${packageName} for Node.js ${nodeVersion || ""}:`
      ),
      error.message
    );
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
    const { stdout } = await runNvmCmd(["list"]);
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
