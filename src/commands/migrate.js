const fs = require('fs');
const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const {
  getInstalledNodeVersions,
  getLatestLtsVersion,
  switchNodeVersion,
  getGlobalPackagesForVersion,
  installGlobalPackage,
  installNodeVersion,
  isVersionStillListed,
} = require("../utils");

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
  // console.log(chalk.cyan('=== Migrate global packages ==='));

  // Get installed Node versions
  let installedVersions = await getInstalledNodeVersions();
  if (!installedVersions.length) {
    console.log(chalk.yellow("No Node.js versions found installed with nvm."));
    return;
  }

  const opts = program.optsWithGlobals();

  // Interactive prompts if CLI options not provided
  const answers = await inquirer.prompt([
    {
      type: "list",
      name: "to",
      message: "Select Node version to migrate to:",
      choices: installedVersions.concat(["Latest stable LTS (default)"]),
      when: !opts.to,
    },
    {
      type: "list",
      name: "from",
      message: "Select source for migration:",
      choices: installedVersions.concat(["All versions"]),
      when: !opts.from,
    },
    {
      type: "confirm",
      name: "installAll",
      message: "Install all packages without prompt?",
      default: false,
      when: !opts.y,
    },
  ]);

  let targetVersion =
    opts.to ||
    (answers.to === "Latest stable LTS (default)"
      ? await getLatestLtsVersion()
      : answers.to);
  if (!targetVersion) {
    console.error(chalk.red("Could not detect latest stable LTS version."));
    return;
  }

  // If target version is not installed, install it first
  let isInstalled = installedVersions.includes(targetVersion);
  if (!isInstalled) {
    console.log(
      chalk.yellow(
        `Target Node.js version ${targetVersion} is not installed. Installing...`
      )
    );
    const installSuccess = await installNodeVersion(targetVersion);
    if (!installSuccess) {
      console.error(
        chalk.red(
          `Failed to install Node.js version ${targetVersion}. Aborting migration.`
        )
      );
      return;
    }
    // Refresh installed versions list
    installedVersions = await getInstalledNodeVersions();
    isInstalled = installedVersions.includes(targetVersion);
    if (!isInstalled) {
      console.error(
        chalk.red(
          `Node.js version ${targetVersion} still not detected after install. Aborting migration.`
        )
      );
      return;
    }
  }

  let fromVersion = opts.from || answers.from;
  if (fromVersion === "All versions") fromVersion = "all";

  const installAll = opts.y ?? answers.installAll;

  // console.log(chalk.blue(`Target Node version: ${targetVersion}`));
  // console.log(
  // 	chalk.blue(
  // 		`Source version(s): ${
  // 			fromVersion === "all" ? "All installed versions" : fromVersion
  // 		}`
  // 	)
  // );

  // Switch to target Node version
  const switched = await switchNodeVersion(targetVersion);
  if (!switched) {
    console.log(
      chalk.yellow(
        `Warning: Failed to switch to Node version ${targetVersion}, proceeding anyway.`
      )
    );
  }

  // Gather packages and their versions from source version(s)
  let packageMap = {};
  if (fromVersion === "all") {
    for (const version of installedVersions) {
      const pkgs = await getGlobalPackagesForVersion(version);
      for (const pkg of pkgs) {
        if (!packageMap[pkg]) {
          // Get version for this package in this version
          const { stdout } = await require('../utils').runNvmCmd(["use", version]);
          try {
            const { stdout: vout } = await require('execa')('npm', ['ls', '-g', pkg, '--json', '--depth=0'], { shell: true });
            const data = JSON.parse(vout);
            if (data.dependencies && data.dependencies[pkg] && data.dependencies[pkg].version) {
              packageMap[pkg] = data.dependencies[pkg].version;
            }
          } catch {}
        }
      }
    }
  } else {
    // Get versions for all packages in the source version
    const pkgs = await getGlobalPackagesForVersion(fromVersion);
    for (const pkg of pkgs) {
      try {
        const nvmDir = require('../utils').getNvmDir();
        const isWindows = process.platform === 'win32';
        let vout;
        if (isWindows) {
          const cmd = `nvm use ${fromVersion} > NUL && npm ls -g ${pkg} --json --depth=0`;
          ({ stdout: vout } = await require('execa').command(cmd, { shell: true }));
        } else {
          const cmd = `export NVM_DIR=\"${nvmDir}\"; . \"${nvmDir}/nvm.sh\"; nvm use ${fromVersion} > /dev/null; npm ls -g ${pkg} --json --depth=0`;
          ({ stdout: vout } = await require('execa').command(cmd, { shell: true }));
        }
        const data = JSON.parse(vout);
        if (data.dependencies && data.dependencies[pkg] && data.dependencies[pkg].version) {
          packageMap[pkg] = data.dependencies[pkg].version;
        }
      } catch {}
    }
  }
  let allPackages = Object.keys(packageMap);
  if (allPackages.length === 0) {
    console.log(chalk.yellow("No global packages found to migrate."));
    return;
  }

  // If not install all, ask user to select packages
  if (!installAll) {
    const pkgSelection = await inquirer.prompt({
      type: "checkbox",
      name: "packages",
      message: "Select packages to install:",
      choices: allPackages.map(pkg => `${pkg}@${packageMap[pkg]}`),
      pageSize: 15,
    });
    allPackages = pkgSelection.packages.map(str => str.split('@')[0]);
    if (allPackages.length === 0) {
      console.log(
        chalk.yellow("No packages selected for installation. Exiting.")
      );
      return;
    }
  }

  // Install selected packages with interactive feedback
  for (const packageName of allPackages) {
    const versionStr = packageMap[packageName] ? `@${packageMap[packageName]}` : '';
    const spinner = ora(`Installing ${packageName}${versionStr} to Node.js ${targetVersion}...`).start();
    const success = await installGlobalPackage(packageName, targetVersion);
    if (success) {
      spinner.succeed(`Installed ${packageName}${versionStr} to Node.js ${targetVersion}`);
    } else {
      spinner.fail(`Failed to install package ${packageName}${versionStr} to Node.js ${targetVersion}`);
      // Optionally handle abort or continue
    }
  }

  console.log(chalk.green(`\n✅ Successfully migrated global packages to Node version ${targetVersion}`));
}

module.exports = migrateCommand;
