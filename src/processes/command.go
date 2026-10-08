package processes

import (
	"context"
	"os/exec"
)

func Command(name string, args ...string) *exec.Cmd {
	command := exec.Command(name, args...)
	hideConsoleWindow(command)
	return command
}

func CommandContext(ctx context.Context, name string, args ...string) *exec.Cmd {
	command := exec.CommandContext(ctx, name, args...)
	hideConsoleWindow(command)
	return command
}
