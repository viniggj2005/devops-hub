package processes

import (
	"context"
	"strings"
	"testing"
)

func TestCommandAndCommandContext(test *testing.T) {
	command := Command("go", "version")
	if command == nil {
		test.Fatalf("expected non-nil command")
	}
	output, err := command.Output()
	if err != nil {
		test.Fatalf("unexpected error running go version: %v", err)
	}
	if !strings.Contains(string(output), "go version") {
		test.Fatalf("unexpected output: %s", string(output))
	}

	ctx := context.Background()
	commandWithContext := CommandContext(ctx, "go", "env", "GOOS")
	if commandWithContext == nil {
		test.Fatalf("expected non-nil command with context")
	}
	contextOutput, err := commandWithContext.Output()
	if err != nil {
		test.Fatalf("unexpected error running go env GOOS: %v", err)
	}
	if strings.TrimSpace(string(contextOutput)) == "" {
		test.Fatalf("expected non-empty GOOS output")
	}
}

