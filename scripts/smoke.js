const shell = require("shelljs");
const waitPort = require("wait-port");

const APP_NAME = "SmokeTest";

function throwError(message) {
  shell.echo(message);
  shell.exit(1);
}

function guardedExec(command, message) {
  if (shell.exec(command).code !== 0) {
    throwError(message);
  }
}

shell.rm("-rf", "/tmp/SmokeTest");
shell.cd("/tmp");

// Install React Native CLI
guardedExec(
  "yarn global add react-native-cli",
  "Error: Failed to install React Native CLI"
);

// Initialize new React Native Project
guardedExec(
  `react-native init ${APP_NAME}`,
  "Error: Failed to initialize new React Native project"
);

shell.cd(`/tmp/${APP_NAME}`);

// Install RNDom's RNPM Plugin
guardedExec(
  "yarn add --dev --exact rnpm-plugin-dom@canary",
  "Error: Failed to install rnpm-plugin-dom"
);

// Bootstrap React Native DOM
guardedExec(
  "react-native dom --exact --domVersion canary",
  "Error: Failed to bootstrap react-native-dom into new React Native project"
);

// Start React Native Packager
const packagerProcess = shell.exec("yarn start --reset-cache", { async: true });

// Wait for packager to be ready
waitPort({ host: "localhost", port: 8081 })
  .then((open) => {
    if (!open) throwError("Error: Waiting for RN Packager timed out");

    guardedExec(
      "curl http://localhost:8081/dom/bootstrap.bundle?platform=dom -o temp.bundle",
      "Error: Failed to bundle main thread"
    );
    shell.rm("-f", "temp.bundle");

    guardedExec(
      "curl http://localhost:8081/dom/entry.bundle?platform=dom -o temp.bundle",
      "Error: Failed to bundle JS thread"
    );
    shell.rm("-f", "temp.bundle");

    packagerProcess.kill();

    shell.echo("Sucesfully passed smoke test!");
  })
  .catch((err) => {
    console.error(err);
    throwError("Error: Waiting for RN Packager failed");
  });
