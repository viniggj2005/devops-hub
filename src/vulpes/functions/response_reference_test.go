package vulpesFunctions

import (
	"encoding/json"
	"regexp"
	"strings"
	"testing"
	"time"

	vulpesDtos "docker-manager-go/src/vulpes/dtos"
)

func TestParseTagArguments(test *testing.T) {
	arguments := ParseTagArguments(` 'body', "req_1" ,'it\'s', '', 60 `)
	expected := []string{"body", "req_1", "it's", "", "60"}
	if strings.Join(arguments, "|") != strings.Join(expected, "|") {
		test.Fatalf("unexpected arguments: %q", arguments)
	}
	if empty := ParseTagArguments("   "); len(empty) != 0 {
		test.Fatalf("expected no arguments, got %q", empty)
	}
}

func TestResponseReferenceRoundTrip(test *testing.T) {
	reference, err := ResponseReferenceFromArguments([]string{"body", "req_login", "b64::JC5kYXRhLnRva2Vu::46b", "when-expired", "90"})
	if err != nil {
		test.Fatalf("unexpected error: %v", err)
	}
	if reference.Filter != "$.data.token" || reference.MaxAge != 90*time.Second || reference.Trigger != ResendWhenExpired {
		test.Fatalf("unexpected reference: %+v", reference)
	}

	expression := reference.Expression()
	if expression != "{{$response 'body', 'req_login', '$.data.token', 'when-expired', 90}}" {
		test.Fatalf("unexpected expression: %s", expression)
	}
	reparsed, err := ParseResponseReference(strings.Trim(expression, "{}"))
	if err != nil || reparsed != reference {
		test.Fatalf("expression did not round trip: %+v %v", reparsed, err)
	}
	if tag := reference.InsomniaTag(); tag != "{% response 'body', 'req_login', 'b64::JC5kYXRhLnRva2Vu::46b', 'when-expired', 90 %}" {
		test.Fatalf("unexpected insomnia tag: %s", tag)
	}

	braced := ResponseReference{Field: "body", Filter: "$['{x}']", Trigger: ResendNever, RequestID: "req_1"}
	if expression := braced.Expression(); !variablePattern.MatchString(expression) || strings.Contains(expression, "{x}") {
		test.Fatalf("filters with braces must be encoded: %s", expression)
	}

	for _, invalid := range [][]string{{"body"}, {"cookie", "req_1"}, {"body", "req_1", "", "sometimes"}, {"body", "req_1", "", "when-expired", "abc"}} {
		if _, err := ResponseReferenceFromArguments(invalid); err == nil {
			test.Fatalf("expected %q to be rejected", invalid)
		}
	}
	if !IsResponseExpression("$response 'body'") || IsResponseExpression("$responseCode") {
		test.Fatalf("unexpected response expression detection")
	}
}

func TestResponseReferenceShouldResend(test *testing.T) {
	now := time.Now()
	recent, stale := now.Add(-10*time.Second), now.Add(-2*time.Minute)
	cases := []struct {
		trigger     string
		hasResponse bool
		receivedAt  time.Time
		expected    bool
	}{
		{ResendNever, true, stale, false},
		{ResendNever, false, time.Time{}, true},
		{ResendNoHistory, true, stale, false},
		{ResendAlways, true, recent, true},
		{ResendWhenExpired, true, recent, false},
		{ResendWhenExpired, true, stale, true},
		{ResendWhenExpired, false, time.Time{}, true},
	}
	for _, scenario := range cases {
		reference := ResponseReference{Trigger: scenario.trigger, MaxAge: time.Minute}
		if resend := reference.ShouldResend(scenario.hasResponse, scenario.receivedAt, now); resend != scenario.expected {
			test.Fatalf("%s with history=%v: expected %v, got %v", scenario.trigger, scenario.hasResponse, scenario.expected, resend)
		}
	}
}

func TestExtractJsonPath(test *testing.T) {
	document := `{"data": {"token": "abc", "id": 7, "items": [{"name": "a"}, {"name": "b"}], "user.name": "ana", "meta": {"count": 2.50}}}`
	cases := map[string]string{
		"$.data.token":            "abc",
		"$.data.id":               "7",
		"$.data.items[1].name":    "b",
		"$.data.items[-1].name":   "b",
		"$['data']['user.name']":  "ana",
		`$["data"].items[0]`:      `{"name":"a"}`,
		"$..token":                "abc",
		"$.data.meta.count":       "2.50",
		"$.data.items[*].name[0]": "",
	}
	for path, expected := range cases {
		value, err := ExtractJsonPath(document, path)
		if expected == "" {
			if err == nil {
				test.Fatalf("expected %s to fail, got %q", path, value)
			}
			continue
		}
		if err != nil || value != expected {
			test.Fatalf("%s: expected %q, got %q (%v)", path, expected, value, err)
		}
	}
	for _, invalid := range []string{"data.token", "$.data[?(@.id)]", "$.items[0", "$.", "$..data..name"} {
		if _, err := ExtractJsonPath(document, invalid); err == nil {
			test.Fatalf("expected %s to fail", invalid)
		}
	}
	if _, err := ExtractJsonPath("not json", "$.a"); err == nil {
		test.Fatalf("expected invalid JSON to fail")
	}
}

func TestExtractResponseValue(test *testing.T) {
	response := &vulpesDtos.HttpResponseDto{
		Url:          "https://api.dev/login",
		Body:         `{"token": "abc"}`,
		Headers:      []vulpesDtos.HeaderDto{{Key: "X-Session", Value: "s1"}},
		BodyEncoding: vulpesDtos.EncodingText,
	}
	cases := []struct {
		reference ResponseReference
		expected  string
	}{
		{ResponseReference{Field: ResponseFieldBody, Filter: "$.token"}, "abc"},
		{ResponseReference{Field: ResponseFieldBody}, `{"token": "abc"}`},
		{ResponseReference{Field: ResponseFieldRaw}, `{"token": "abc"}`},
		{ResponseReference{Field: ResponseFieldUrl}, "https://api.dev/login"},
		{ResponseReference{Field: ResponseFieldHeader, Filter: "x-session"}, "s1"},
	}
	for _, scenario := range cases {
		if value, err := ExtractResponseValue(response, scenario.reference); err != nil || value != scenario.expected {
			test.Fatalf("%+v: expected %q, got %q (%v)", scenario.reference, scenario.expected, value, err)
		}
	}
	for _, invalid := range []ResponseReference{{Field: ResponseFieldHeader, Filter: "X-Missing"}, {Field: ResponseFieldHeader}, {Field: ResponseFieldBody, Filter: "/xml/path"}} {
		if _, err := ExtractResponseValue(response, invalid); err == nil {
			test.Fatalf("expected %+v to fail", invalid)
		}
	}
}

func TestVariableResolverResponses(test *testing.T) {
	resolver := NewVariableResolver([]vulpesDtos.VariableDto{{Key: "token", Value: "{{$response 'body', 'req_login', '$.token'}}", Enabled: true}})
	if resolved := resolver.Resolve("Bearer {{token}}"); resolved != "Bearer {{$response 'body', 'req_login', '$.token'}}" || resolver.TakeError() == nil {
		test.Fatalf("resolving without a response source must fail: %q", resolved)
	}

	calls := 0
	resolver.UseResponses(func(reference ResponseReference) (*vulpesDtos.HttpResponseDto, error) {
		calls++
		if reference.RequestID != "req_login" {
			test.Fatalf("unexpected request id %q", reference.RequestID)
		}
		return &vulpesDtos.HttpResponseDto{Body: `{"token": "abc"}`}, nil
	})
	if resolved := resolver.Resolve("Bearer {{token}} {{token}}"); resolved != "Bearer abc abc" || calls != 1 {
		test.Fatalf("unexpected resolution %q after %d calls", resolved, calls)
	}
	if err := resolver.TakeError(); err != nil {
		test.Fatalf("unexpected error: %v", err)
	}
}

func TestFakeDataVariables(test *testing.T) {
	resolver := NewVariableResolver()
	emailPattern := regexp.MustCompile(`^[a-z]+\.[a-z]+\d*@[a-z]+\.[a-z.]+$`)
	if email := resolver.Resolve("{{$randomEmail}}"); !emailPattern.MatchString(email) {
		test.Fatalf("unexpected email %q", email)
	}
	for name := range fakeDataGenerators {
		if value := resolver.Resolve("{{" + name + "}}"); value == "" || strings.Contains(value, "{{") {
			test.Fatalf("%s generated %q", name, value)
		}
	}
	if !IsDynamicVariable("$randomFirstName") || !IsDynamicVariable("$guid") || IsDynamicVariable("$randomNothing") {
		test.Fatalf("unexpected dynamic variable detection")
	}
}

func TestInsomniaFakerAndResponseTags(test *testing.T) {
	imported, err := ParseInsomniaFile([]byte(`{
		"_type": "export", "__export_format": 4,
		"resources": [
			{"_id": "wrk_1", "_type": "workspace", "name": "Autoleads"},
			{"_id": "env_1", "_type": "environment", "parentId": "wrk_1", "data": {"token": "{% response 'body', 'req_login', 'b64::JC5hY2Nlc3NfdG9rZW4=::46b', 'when-expired', 60 %}"}},
			{"_id": "req_login", "_type": "request", "parentId": "wrk_1", "name": "Login", "url": "https://api.dev/login", "method": "POST"},
			{"_id": "req_lead", "_type": "request", "parentId": "wrk_1", "name": "Lead", "url": "https://api.dev/leads", "method": "POST",
				"headers": [{"name": "X-Session", "value": "{% response 'header', 'req_login', 'b64::WC1TZXNzaW9u::46b', 'never', 60 %}"}],
				"body": {"mimeType": "application/json", "text": "{\"name\": \"{% faker 'randomFullName' %}\", \"email\": \"{% faker 'randomEmail' %}\", \"x\": \"{% faker 'randomUnknown' %}\"}"}}
		]
	}`), "autoleads.json")
	if err != nil {
		test.Fatalf("unexpected error: %v", err)
	}

	content := imported.Collections[0].Content
	if content.Variables[0].Value != "{{$response 'body', 'req_login', '$.access_token', 'when-expired', 60}}" {
		test.Fatalf("unexpected token variable: %q", content.Variables[0].Value)
	}
	login, lead := FindItem(content.Items, "req_login"), FindItem(content.Items, "req_lead")
	if login == nil || lead == nil {
		test.Fatalf("insomnia request ids must be preserved: %+v", content.Items)
	}
	if header := lead.Request.Http.Headers[0].Value; header != "{{$response 'header', 'req_login', 'X-Session', 'never', 60}}" {
		test.Fatalf("unexpected header: %q", header)
	}
	if body := lead.Request.Http.Body.Raw; body != `{"name": "{{$randomFullName}}", "email": "{{$randomEmail}}", "x": "{% faker 'randomUnknown' %}"}` {
		test.Fatalf("unexpected body: %q", body)
	}
	if len(imported.Warnings) != 1 || !strings.Contains(imported.Warnings[0], "randomUnknown") {
		test.Fatalf("unexpected warnings: %q", imported.Warnings)
	}

	exported, _, err := ExportInsomniaCollection("Autoleads", content)
	if err != nil {
		test.Fatalf("unexpected export error: %v", err)
	}
	var file struct {
		Resources []struct {
			ID      string          `json:"_id"`
			Name    string          `json:"name"`
			Type    string          `json:"_type"`
			Data    json.RawMessage `json:"data"`
			Body    json.RawMessage `json:"body"`
			Headers []struct {
				Value string `json:"value"`
			} `json:"headers"`
		} `json:"resources"`
	}
	if err := json.Unmarshal(exported, &file); err != nil {
		test.Fatalf("unexpected export json: %v", err)
	}
	loginID := ""
	for _, resource := range file.Resources {
		if resource.Name == "Login" {
			loginID = resource.ID
		}
	}
	for _, resource := range file.Resources {
		switch {
		case resource.Type == "environment" && !strings.Contains(string(resource.Data), "{% response 'body', '"+loginID+"', 'b64::JC5hY2Nlc3NfdG9rZW4=::46b', 'when-expired', 60 %}"):
			test.Fatalf("unexpected exported environment: %s", resource.Data)
		case resource.Name == "Lead" && resource.Headers[0].Value != "{% response 'header', '"+loginID+"', 'b64::WC1TZXNzaW9u::46b', 'never', 60 %}":
			test.Fatalf("unexpected exported header: %q", resource.Headers[0].Value)
		case resource.Name == "Lead" && !strings.Contains(string(resource.Body), `{% faker 'randomFullName' %}`):
			test.Fatalf("unexpected exported body: %s", resource.Body)
		}
	}
}
