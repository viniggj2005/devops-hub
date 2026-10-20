package models

import "testing"

func TestConfigTypeIsValid(test *testing.T) {
	validTypes := []ConfigType{User, Theme, Colors}
	for _, configType := range validTypes {
		if !configType.IsValid() {
			test.Fatalf("expected configType %q to be valid", configType)
		}
	}

	invalidTypes := []ConfigType{"", "invalid", "USER", "admin"}
	for _, configType := range invalidTypes {
		if configType.IsValid() {
			test.Fatalf("expected configType %q to be invalid", configType)
		}
	}
}

func TestModuleNameIsValid(test *testing.T) {
	validModules := []ModuleName{Vulpes, OctoHub, FerretShell, DockerManager, TalpaDB}
	for _, moduleName := range validModules {
		if !moduleName.IsValid() {
			test.Fatalf("expected moduleName %q to be valid", moduleName)
		}
	}

	invalidModules := []ModuleName{"", "unknown", "DOCKER", "postgres"}
	for _, moduleName := range invalidModules {
		if moduleName.IsValid() {
			test.Fatalf("expected moduleName %q to be invalid", moduleName)
		}
	}
}
