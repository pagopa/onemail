## Dev container

### Tools

- IDE: **VS Code**
- Rancher Desktop

### VS Code (recommended)
1. Install the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers).
2. Install [Dev Container CLI](https://github.com/devcontainers/cli)

### Prerequisites

- Rancher Desktop running with administrative privileges.
- Ensure the container/VM runtime is correctly configured on macOS.

### Template
The dev container in this repo is made using DX template [DX Dev container](https://dx.pagopa.it/docs/dev-containers/#extra-use-a-development-container-template)

### Setup

1. Start Rancher Desktop as an administrator.
2. Execute this command in terminal **devcontainer up --workspace-folder .**.
3. After container start execute this command for entering in shell **devcontainer exec --workspace-folder . /bin/bash**
4. Open the Command Palette (`Ctrl/Cmd+Shift+P`) and select **Dev Containers: Attach to a Running Container** for executing VSCode ide in dev container environment

VS Code window will reopen the workspace attached to the container.

### After startup

- Dependency installation is handled automatically by the dev container.

- If needed, follow package-specific instructions located in the repository root.
