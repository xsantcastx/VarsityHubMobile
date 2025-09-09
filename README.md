# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

### Local API (Node + PostgreSQL)

- Prerequisites: PostgreSQL 14+, Node 18+, npm
- Configure and run the server:

  ```bash
  cd server
  cp .env.example .env   # create and edit values
  npm install
  npx prisma migrate dev --name init
  npm run seed
  npm run dev
  # API at http://localhost:4000
  ```

- Environment for the app (PowerShell):

  ```powershell
  $env:EXPO_PUBLIC_API_URL = "http://localhost:4000"
  npm run web:ci
  ```

- Android emulator uses 10.0.2.2 to reach host:
  - Set `EXPO_PUBLIC_API_URL=http://10.0.2.2:4000` when running on emulator.

### Windows quick commands (avoid prompts/ports/emulator issues)

- Fix port prompts and start Metro on a fixed port:

  ```powershell
  npm run start:ci
  ```

- Start web on a fixed port:

  ```powershell
  npm run web:ci
  ```

- Start Android (after your emulator or device is ready):

  ```powershell
  npm run android:ci
  ```

- Free a port if something is already using it (replace 8081 as needed):

  ```powershell
  netstat -aon | findstr :8081
  taskkill /PID <pid> /F
  ```

- If the Android emulator shows `cmd: Can't find service: package`:

  1. Start the AVD manually and wait for full boot:

     ```powershell
     "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" @Medium_Phone_API_36.0 -no-snapshot-load -wipe-data -no-boot-anim
     ```

  2. Restart ADB and wait for the device:

     ```powershell
     adb kill-server; adb start-server; adb wait-for-device; adb devices
     ```

  3. Then launch from the project:

     ```powershell
     npm run android:ci
     ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
