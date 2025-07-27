
# NVM Manager

A modern CLI tool to manage Node.js versions and global packages using nvm/nvm-windows.

Created to solve nvm-windows' missing `--reinstall-packages-from` functionality and provide a modern CLI experience for Node.js version management.

use

## 🚀 Features

- ** Migrate** Migrate global packages to selected Node version

```bash
nvm-manager migrate
```

- **list-all** global npm packages from all Node.js versions managed by nvm
- **Cleanup** unwanted Node.js versions while preserving latest LTS
- **Install** latest Node.js LTS and restore global packages with interactive prompts  
- **Fix** phantom Node.js versions that appear in `nvm list` but cannot be uninstalled
- **Interactive prompts** with options for batch operations (`y-all`, `n-all`, `skip-all`)
- **Cross-platform** compatible (Windows with nvm-windows, Linux, macOS with nvm)
- **Rich UI** with colored output, progress spinners, and clear feedback

## 📋 Prerequisites

- **nvm** or **nvm-windows** installed and configured
- **Node.js** (any version) and **npm** available in your shell
- **`NVM_HOME` environment variable** set (especially on Windows)

## 📦 Installation

```bash
# Clone or download this repository
cd nvm-manager

# Install dependencies
npm install

# Install globally for command-line usage
npm install -g .
```

## 🎯 Usage

### Migrate Global Packages
```bash
nvm-manager migrate
```
Migrate global packages to selected Node version

### Cleanup Old Versions
```bash
nvm-manager cleanup
```
Interactively removes all Node.js versions except the latest stable LTS. Options:
- `y` - Uninstall current version
- `n` - Skip current version
- `y-all` - Uninstall current and all remaining versions

### Install Latest Node + Packages
```bash
nvm-manager install
```
Installs latest stable Node.js LTS (if needed) and installs missing/outdated global packages from the package list with interactive confirmation.

### Fix Phantom Versions
```bash
nvm-manager fix-failed
```
Fixes Node.js versions that show in `nvm list` but cannot be uninstalled normally. Attempts manual folder deletion and provides guidance for config file cleanup.

## 📚 Command Help

```bash
nvm-manager --help           # Show all commands
nvm-manager <command> --help # Show help for specific command  
```

## 🔧 How It Works

1. **Extract**: Switches to each Node version, reads global packages via `npm ls -g --json`, saves to consolidated list
2. **Cleanup**: Detects latest LTS, preserves it, prompts to uninstall others with batch options
3. **Install**: Compares installed vs latest package versions, prompts for missing/outdated packages  
4. **Fix-Failed**: Attempts `nvm uninstall`, falls back to manual folder deletion, guides through config cleanup

## 🛠️ Troubleshooting

- **Phantom versions persist**: Check and edit `%NVM_HOME%\settings.txt` to remove stale entries
- **Permission errors**: Run with appropriate privileges or manually delete version folders
- **nvm commands not found**: Ensure nvm is in your PATH and shell environment is configured
- **NVM_HOME not set**: Set environment variable pointing to your nvm installation directory

## 📁 Project Structure

```
nvm-manager/
├── package.json
├── bin/
│   └── nvm-manager          # CLI executable
├── src/  
│   ├── index.js            # Main CLI entry point
│   ├── utils.js            # Shared utilities
│   └── commands/
│       ├── extract.js      # Extract command
│       ├── cleanup.js      # Cleanup command  
│       ├── install.js      # Install command
│       └── fix-failed.js   # Fix-failed command
└── README.md
```

## 🤝 Contributing

Issues, suggestions, and pull requests welcome!

## 📄 License

MIT License - Feel free to use, modify, and distribute.

## 🙏 Credits

Created to solve nvm-windows' missing `--reinstall-packages-from` functionality and provide a modern CLI experience for Node.js version management.

---

*Happy Node.js version management!* 🚀
