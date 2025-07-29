#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const listAllCommand = require('./commands/list-all');
const cleanupCommand = require('./commands/cleanup');
const installLtsCommand = require("./commands/install-lts");
const fixFailedCommand = require("./commands/fix-failed");
const migrateCommand = require("./commands/migrate");

const program = new Command();

program
  .name("nvm-manager")
  .description(
    chalk.cyan(
      "A modern CLI tool to manage Node.js versions and global packages using nvm"
    )
  )
  .version("1.0.0", "-v, --version", "display version number");

// Add commands
program
  .command("list-all")
  .description(
    "List global npm packages from specified Node.js versions or all"
  )
  .option("--json", "Output data in JSON format instead of a table")
  .option(
    "-v, --versions <versions>",
    'Comma-separated list of Node versions to list. Use "all" for all installed versions (default).'
  )
  .action(() => listAllCommand(program));

program
  .command("cleanup")
  .description("Interactively uninstall all Node.js versions except latest LTS")
  .action(cleanupCommand);

program
  .command("install-lts")
  .description("Install latest Node.js LTS and restore global packages")
  .action(installLtsCommand);

program
  .command('fix-failed')
  .alias('fix')
  .description('Fix phantom Node.js versions that appear in nvm list but cannot be uninstalled')
  .action(fixFailedCommand);


program
  .command('migrate')
  .description('Migrate global packages to selected Node version')
  .option('-t, --to <version>', 'Node version to migrate to')
  .option('-f, --from <version>', 'Node version to migrate from')
  .option('-y, --yes', 'Install all packages without prompting')
  .action(()=>migrateCommand(program));

// Show help after error automatically
program.showHelpAfterError();

// Always parse arguments
program.parse(process.argv);

// Show help if no command is provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
