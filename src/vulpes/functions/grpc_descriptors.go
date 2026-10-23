package vulpesFunctions

import (
	"context"
	"errors"
	"fmt"
	"net"
	"path/filepath"
	"sort"
	"strings"

	"github.com/jhump/protoreflect/desc/protoparse"
	"github.com/jhump/protoreflect/grpcreflect"
	"google.golang.org/grpc"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/reflect/protoregistry"
	"google.golang.org/protobuf/types/dynamicpb"
)

var reflectionServices = map[string]bool{
	"grpc.reflection.v1.ServerReflection":      true,
	"grpc.reflection.v1alpha.ServerReflection": true,
}

type GrpcDescriptorSource struct {
	types    *dynamicpb.Types
	files    *protoregistry.Files
	services []protoreflect.ServiceDescriptor
}

func newDescriptorSource() *GrpcDescriptorSource {
	return &GrpcDescriptorSource{files: new(protoregistry.Files)}
}

func ParseGrpcTarget(rawUrl string, useTls bool) (string, bool, error) {
	target := strings.TrimSpace(rawUrl)
	if target == "" {
		return "", false, errors.New("informe o endereço do servidor gRPC")
	}
	secure := useTls
	if scheme, rest, found := strings.Cut(target, "://"); found {
		switch strings.ToLower(scheme) {
		case "grpcs", "https":
			secure = true
		case "grpc", "http":
			secure = false
		default:
			return "", false, fmt.Errorf("esquema %q não suportado; use grpc:// ou grpcs://", scheme)
		}
		target = rest
	}
	target, _, _ = strings.Cut(target, "/")
	if target == "" {
		return "", false, errors.New("informe o host do servidor gRPC")
	}
	if _, _, err := net.SplitHostPort(target); err != nil {
		defaultPort := "80"
		if secure {
			defaultPort = "443"
		}
		target = net.JoinHostPort(strings.Trim(target, "[]"), defaultPort)
	}
	return target, secure, nil
}

func LoadReflectionDescriptors(ctx context.Context, connection grpc.ClientConnInterface) (*GrpcDescriptorSource, error) {
	client := grpcreflect.NewClientAuto(ctx, connection)
	defer client.Reset()

	serviceNames, err := client.ListServices()
	if err != nil {
		return nil, fmt.Errorf("o servidor não respondeu ao reflection (habilite-o no servidor ou use arquivos .proto): %w", err)
	}
	sort.Strings(serviceNames)

	source := newDescriptorSource()
	for _, serviceName := range serviceNames {
		if reflectionServices[serviceName] {
			continue
		}
		service, err := client.ResolveService(serviceName)
		if err != nil {
			return nil, fmt.Errorf("não foi possível carregar o serviço %s: %w", serviceName, err)
		}
		source.addService(service.UnwrapService())
	}
	if len(source.services) == 0 {
		return nil, errors.New("o servidor não expõe nenhum serviço via reflection")
	}
	return source, nil
}

func LoadProtoFiles(protoFiles []string, importPaths []string) (*GrpcDescriptorSource, error) {
	if len(protoFiles) == 0 {
		return nil, errors.New("adicione ao menos um arquivo .proto ou use o reflection do servidor")
	}

	searchPaths := []string{}
	seenPaths := map[string]bool{}
	addSearchPath := func(path string) {
		cleaned := filepath.Clean(strings.TrimSpace(path))
		if cleaned != "." && !seenPaths[cleaned] {
			seenPaths[cleaned] = true
			searchPaths = append(searchPaths, cleaned)
		}
	}
	for _, importPath := range importPaths {
		addSearchPath(importPath)
	}
	for _, protoFile := range protoFiles {
		addSearchPath(filepath.Dir(protoFile))
	}

	fileNames := make([]string, 0, len(protoFiles))
	for _, protoFile := range protoFiles {
		fileNames = append(fileNames, relativeProtoName(filepath.Clean(protoFile), searchPaths))
	}

	parser := protoparse.Parser{ImportPaths: searchPaths}
	descriptors, err := parser.ParseFiles(fileNames...)
	if err != nil {
		return nil, fmt.Errorf("erro ao interpretar os arquivos .proto: %w", err)
	}

	source := newDescriptorSource()
	seenServices := map[protoreflect.FullName]bool{}
	for _, descriptor := range descriptors {
		services := descriptor.UnwrapFile().Services()
		for index := 0; index < services.Len(); index++ {
			service := services.Get(index)
			if !seenServices[service.FullName()] {
				seenServices[service.FullName()] = true
				source.addService(service)
			}
		}
	}
	if len(source.services) == 0 {
		return nil, errors.New("nenhum serviço foi encontrado nos arquivos .proto")
	}
	return source, nil
}

func relativeProtoName(protoFile string, searchPaths []string) string {
	for _, searchPath := range searchPaths {
		relative, err := filepath.Rel(searchPath, protoFile)
		if err == nil && !strings.HasPrefix(relative, "..") && !filepath.IsAbs(relative) {
			return filepath.ToSlash(relative)
		}
	}
	return filepath.Base(protoFile)
}

func (source *GrpcDescriptorSource) addService(service protoreflect.ServiceDescriptor) {
	source.services = append(source.services, service)
	source.registerFile(service.ParentFile())
}

func (source *GrpcDescriptorSource) registerFile(file protoreflect.FileDescriptor) {
	if file == nil || file.IsPlaceholder() {
		return
	}
	if _, err := source.files.FindFileByPath(file.Path()); err == nil {
		return
	}
	imports := file.Imports()
	for index := 0; index < imports.Len(); index++ {
		source.registerFile(imports.Get(index).FileDescriptor)
	}
	_ = source.files.RegisterFile(file)
}

func (source *GrpcDescriptorSource) Services() []protoreflect.ServiceDescriptor {
	return source.services
}

func (source *GrpcDescriptorSource) Types() *dynamicpb.Types {
	if source.types == nil {
		source.types = dynamicpb.NewTypes(source.files)
	}
	return source.types
}

func (source *GrpcDescriptorSource) FindMethod(fullMethod string) (protoreflect.MethodDescriptor, error) {
	trimmed := strings.TrimPrefix(strings.TrimSpace(fullMethod), "/")
	if trimmed == "" {
		return nil, errors.New("selecione o método gRPC")
	}
	serviceName, methodName, found := strings.Cut(trimmed, "/")
	if !found {
		separator := strings.LastIndex(trimmed, ".")
		if separator < 0 {
			return nil, fmt.Errorf("método gRPC inválido: %q", fullMethod)
		}
		serviceName, methodName = trimmed[:separator], trimmed[separator+1:]
	}
	for _, service := range source.services {
		if string(service.FullName()) != serviceName {
			continue
		}
		if method := service.Methods().ByName(protoreflect.Name(methodName)); method != nil {
			return method, nil
		}
	}
	return nil, fmt.Errorf("o método %s não foi encontrado no servidor", trimmed)
}

func MethodPath(method protoreflect.MethodDescriptor) string {
	return "/" + string(method.Parent().FullName()) + "/" + string(method.Name())
}
