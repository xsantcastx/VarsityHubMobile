# VarsityHub Mobile Development Tools Guide

## Summary
Native development tool setup for React Native + Expo iOS/Android project with SwiftLint for Xcode and recommendations for Android Studio.

---

## ✅ Installed & Configured

### macOS Development Environment
- **Fastlane** (v2.229.1): iOS/Android build automation and distribution
  - Location: `/opt/homebrew/bin/fastlane`
  - Added to PATH: `~/.zshrc`
  
- **SwiftLint** (v0.62.2): Swift code style linting and static analysis
  - Location: `/opt/homebrew/Cellar/swiftlint/0.62.2_1`
  - Configuration: `ios/.swiftlint.yml`
  - Surfaces style/static warnings as you type in Xcode
  - Rules: 25+ enabled for modern Swift best practices

---

## 📋 Recommended IDE Extensions

### For Xcode (Native iOS Development)

#### Core Tools
1. **SwiftLint** ✅ *Installed*
   - Integrated with build phase for automatic linting
   - Enforces Swift style guidelines
   - Config: `ios/.swiftlint.yml`

2. **InjectionIII** (Optional but Recommended)
   - Hot reload Swift/Obj-C views without rebuilding
   - Accelerates native module development
   - Download: https://github.com/johnno1962/InjectionIII

3. **SwiftFormat for Xcode** (Optional)
   - Automatic Swift code formatting
   - Integrates with editor for real-time formatting
   - Complements SwiftLint for consistency

#### Debugging & Inspection Tools
4. **Reveal** (Optional, Commercial)
   - Live view hierarchy inspection
   - UI constraint debugging
   - Useful for constraint-based layouts

5. **Flex** (Optional, Open Source)
   - Runtime introspection and modification
   - Free alternative to Reveal
   - Good for quick view debugging

#### Source Control & History
6. **GitX** (Optional)
   - Git blame extensions
   - Per-line commit history
   - Helpful for tracking changes

---

### For Android Studio / IntelliJ IDEA

#### Kotlin & Build Tools
1. **Kotlin Multiplatform Mobile** (if sharing Kotlin code)
   - Enhanced Gradle sync
   - Compose previews
   - Recommended if you touch `shared/` modules

2. **Android ButterKnife Zelezny** (Legacy - Not Recommended)
   - Outdated; use View Binding instead
   - Built-in View Binding preferred
   - Skip this extension

#### Code Generation & Helpers
3. **JSON To Kotlin Class** or **GsonFormatPlus**
   - Auto-generate Kotlin data classes from JSON
   - Useful if you craft native API models
   - Occasional use when building native integrations

4. **Android Parcelable Code Generator**
   - Streamlines Parcelable boilerplate
   - Saves time on inter-process communication
   - Optional but helpful

#### Code Quality & Linting
5. **SonarLint** (Recommended)
   - Inline static analysis
   - Catches issues beyond default lint warnings
   - Same company as SonarQube
   - Real-time feedback as you type

6. **LintCleaner**
   - Unused resource detection
   - Helps keep APK size minimal
   - Optional but good for optimization

---

## 🔧 Installation Instructions

### Xcode Extensions (Manual)

#### SwiftLint Build Phase
Already configured in: `ios/.swiftlint.yml`

To integrate with Xcode build:
1. Open `VarsityHub.xcworkspace` in Xcode
2. Select **VarsityHub** target → **Build Phases**
3. Click **+** → **New Run Script Phase**
4. Add script:
   ```bash
   if which swiftlint >/dev/null; then
     swiftlint
   fi
   ```
5. Move phase to run **before Compile Sources**

#### InjectionIII (Optional)
```bash
brew install injection
# Or download from: https://github.com/johnno1962/InjectionIII/releases
```

#### SwiftFormat for Xcode (Optional)
```bash
brew install swiftformat
```

---

### Android Studio Extensions (GUI Installation)

1. **Android Studio** → **Preferences** (or **Settings** on Linux/Windows)
2. Search for plugin in **Plugins** section
3. Click **Install** and restart IDE

#### Quick Plugin Install List:
- Search: `"Kotlin Multiplatform Mobile"`
- Search: `"JSON To Kotlin Class"`
- Search: `"SonarLint"`
- Search: `"Android Parcelable Code Generator"`
- Search: `"GsonFormatPlus"` (alternative to JSON To Kotlin)

---

## 📊 Development Setup Summary

| Component | Status | Location | Purpose |
|-----------|--------|----------|---------|
| **Fastlane** | ✅ Installed | `/opt/homebrew/bin` | iOS/Android automation |
| **SwiftLint** | ✅ Installed | `/opt/homebrew/Cellar/swiftlint` | iOS code style enforcement |
| **.swiftlint.yml** | ✅ Configured | `ios/.swiftlint.yml` | SwiftLint rules config |
| **InjectionIII** | 📦 Optional | App Store/GitHub | Hot reload views (iOS) |
| **SwiftFormat** | 📦 Optional | Homebrew | Auto-format Swift (iOS) |
| **SonarLint** | 📦 Optional | Android Studio Plugins | Code quality (Android) |
| **Kotlin MPM** | 📦 Optional | Android Studio Plugins | Multiplatform builds (Android) |

---

## 🚀 Usage Tips

### Using SwiftLint
```bash
# Manual lint check
swiftlint lint ios/

# Auto-fix violations (where possible)
swiftlint lint --fix ios/

# Config validation
swiftlint lint --config ios/.swiftlint.yml
```

### For React Native Development
- **Most extensions are optional** since you're primarily in JavaScript/TypeScript
- Install native tools **only when editing native modules** (`.swift`, `.kt` files)
- Focus on Swift/Kotlin quality when:
  - Adding native modules
  - Debugging platform-specific issues
  - Optimizing native performance

### CI/CD Integration
SwiftLint can be integrated into pre-commit hooks:
```bash
# In project root
echo "swiftlint" > .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

---

## 📝 Notes

- **View Binding** is the modern standard for Android (replaces ButterKnife)
- **SwiftLint config** excludes `Pods/` and build artifacts automatically
- **Strict mode** disabled to avoid over-zealous warnings during development
- Extensions can be selectively installed based on your workflow

---

## Next Steps

1. ✅ **SwiftLint**: Ready to use; review config in `ios/.swiftlint.yml`
2. 📦 **Android Studio**: Install SonarLint for real-time analysis
3. 🔧 **Xcode Integration**: Add SwiftLint to build phases (see instructions above)
4. 🎯 **Optional**: Install InjectionIII if doing frequent native iOS development

---

*Last Updated: December 8, 2025*
*VarsityHub Mobile Development Environment*
