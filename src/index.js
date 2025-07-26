#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const extractCommand = require('./commands/extract');
const cleanupCommand = require('./commands/cleanup');
const installCommand = require('./commands/install');
const fixFailedCommand = require('./commands/fix-failed');

const program = new Command();

program
  .name('nvm-manager')
  .description(chalk.cyan('A modern CLI tool to manage Node.js versions and global packages using nvm'))
  .version('1.0.0', '-v, --version', 'display version number');

// Add commands
program
  .command('extract')
  .description('Extract global npm packages from all installed Node.js versions')
  .action(extractCommand);

program
  .command('cleanup')
  .description('Interactively uninstall all Node.js versions except latest LTS')
  .action(cleanupCommand);

program
  .command('install')
  .description('Install latest Node.js LTS and restore global packages')
  .action(installCommand);

program
  .command('fix-failed')
  .alias('fix')
  .description('Fix phantom Node.js versions that appear in nvm list but cannot be uninstalled')
  .action(fixFailedCommand);

// Show help when no command is provided
program.on('--help', () => {
  console.log('');
  console.log(chalk.yellow('Examples:'));
  console.log('  $ nvm-manager extract');
  console.log('  $ nvm-manager cleanup');
  console.log('  $ nvm-manager install');
  console.log('  $ nvm-manager fix-failed');
  console.log('');
  console.log(chalk.green('For more information about a specific command:'));
  console.log('  $ nvm-manager <command> --help');
  console.log('');
});

// Parse command line arguments
program.parse(process.argv);

// Show help if no arguments provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
