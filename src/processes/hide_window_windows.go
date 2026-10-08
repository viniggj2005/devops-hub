package processes

import (
	"os/exec"
	"syscall"
)

const createNoWindow = 0x08000000

func hideConsoleWindow(command *exec.Cmd) {
	command.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: createNoWindow,
	}
}
