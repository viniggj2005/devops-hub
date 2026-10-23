package vulpesFunctions

import (
	"bytes"
	"encoding/json"

	"google.golang.org/protobuf/reflect/protoreflect"
)

const maxExampleDepth = 5

type orderedField struct {
	key   string
	value any
}

type orderedObject []orderedField

func (object orderedObject) MarshalJSON() ([]byte, error) {
	var buffer bytes.Buffer
	buffer.WriteByte('{')
	for index, field := range object {
		if index > 0 {
			buffer.WriteByte(',')
		}
		key, err := json.Marshal(field.key)
		if err != nil {
			return nil, err
		}
		value, err := json.Marshal(field.value)
		if err != nil {
			return nil, err
		}
		buffer.Write(key)
		buffer.WriteByte(':')
		buffer.Write(value)
	}
	buffer.WriteByte('}')
	return buffer.Bytes(), nil
}

var wellKnownExamples = map[protoreflect.FullName]any{
	"google.protobuf.Any":         orderedObject{},
	"google.protobuf.Empty":       orderedObject{},
	"google.protobuf.Value":       nil,
	"google.protobuf.Struct":      orderedObject{},
	"google.protobuf.Duration":    "0s",
	"google.protobuf.ListValue":   []any{},
	"google.protobuf.FieldMask":   "",
	"google.protobuf.Timestamp":   "1970-01-01T00:00:00Z",
	"google.protobuf.BoolValue":   false,
	"google.protobuf.BytesValue":  "",
	"google.protobuf.FloatValue":  0,
	"google.protobuf.Int32Value":  0,
	"google.protobuf.Int64Value":  "0",
	"google.protobuf.DoubleValue": 0,
	"google.protobuf.StringValue": "",
	"google.protobuf.UInt32Value": 0,
	"google.protobuf.UInt64Value": "0",
}

func ExampleMessageJson(message protoreflect.MessageDescriptor) string {
	encoded, err := json.MarshalIndent(exampleMessage(message, 0, map[protoreflect.FullName]bool{}), "", "  ")
	if err != nil {
		return "{}"
	}
	return string(encoded)
}

func exampleMessage(message protoreflect.MessageDescriptor, depth int, visiting map[protoreflect.FullName]bool) any {
	if example, isWellKnown := wellKnownExamples[message.FullName()]; isWellKnown {
		return example
	}
	if depth >= maxExampleDepth || visiting[message.FullName()] {
		return orderedObject{}
	}
	visiting[message.FullName()] = true
	defer delete(visiting, message.FullName())

	object := orderedObject{}
	usedOneofs := map[protoreflect.FullName]bool{}
	fields := message.Fields()
	for index := 0; index < fields.Len(); index++ {
		field := fields.Get(index)
		if oneof := field.ContainingOneof(); oneof != nil && !oneof.IsSynthetic() {
			if usedOneofs[oneof.FullName()] {
				continue
			}
			usedOneofs[oneof.FullName()] = true
		}
		object = append(object, orderedField{key: field.JSONName(), value: exampleField(field, depth, visiting)})
	}
	return object
}

func exampleField(field protoreflect.FieldDescriptor, depth int, visiting map[protoreflect.FullName]bool) any {
	switch {
	case field.IsMap():
		return orderedObject{{key: exampleMapKey(field.MapKey()), value: exampleValue(field.MapValue(), depth, visiting)}}
	case field.IsList():
		return []any{exampleValue(field, depth, visiting)}
	}
	return exampleValue(field, depth, visiting)
}

func exampleValue(field protoreflect.FieldDescriptor, depth int, visiting map[protoreflect.FullName]bool) any {
	switch field.Kind() {
	case protoreflect.BoolKind:
		return false
	case protoreflect.StringKind, protoreflect.BytesKind:
		return ""
	case protoreflect.EnumKind:
		if values := field.Enum().Values(); values.Len() > 0 {
			return string(values.Get(0).Name())
		}
		return 0
	case protoreflect.MessageKind, protoreflect.GroupKind:
		return exampleMessage(field.Message(), depth+1, visiting)
	case protoreflect.Int64Kind, protoreflect.Sint64Kind, protoreflect.Sfixed64Kind, protoreflect.Uint64Kind, protoreflect.Fixed64Kind:
		return "0"
	}
	return 0
}

func exampleMapKey(field protoreflect.FieldDescriptor) string {
	switch field.Kind() {
	case protoreflect.StringKind:
		return "key"
	case protoreflect.BoolKind:
		return "true"
	}
	return "0"
}
