//go:build !windows

package processes

import "os/exec"

func hideConsoleWindow(command *exec.Cmd) {}
