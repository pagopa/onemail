## Dev container

### Tools

- IDE: **VS Code**
- Rancher Desktop

### VS Code (recommended)
1. Install the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers).

### Prerequisites

- Rancher Desktop running with administrative privileges.
- Ensure the container/VM runtime is correctly configured on macOS.

### Setup

1. Start Rancher Desktop as an administrator.
2. Open the Command Palette (`Ctrl/Cmd+Shift+P`) and select **Dev Containers: Reopen in Container**.

The dev container will start and the VS Code window will reopen the workspace attached to the container.

### After startup

- Dependency installation is handled automatically by the dev container.

- If needed, follow package-specific instructions located in the repository root.
