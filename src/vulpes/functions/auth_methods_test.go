package vulpesFunctions

import (
	"time"
	"strings"
	"testing"
	"net/http"
	"encoding/json"
	vulpesDtos "docker-manager-go/src/vulpes/dtos"
)

func TestSignJwtMatchesReferenceToken(test *testing.T) {
	token, err := SignJwt(vulpesDtos.AuthDto{
		Secret:    "your-256-bit-secret",
		Payload:   "{\n  \"sub\": \"1234567890\",\n  \"name\": \"John Doe\",\n  \"iat\": 1516239022\n}",
		Algorithm: "HS256",
	})
	expected := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
	if err != nil || token != expected {
		test.Fatalf("unexpected JWT: %q, err=%v", token, err)
	}

	if _, err := SignJwt(vulpesDtos.AuthDto{Secret: "s", Payload: "[1]", Algorithm: "HS256"}); err == nil {
		test.Fatalf("expected a non-object payload to fail")
	}
	if _, err := SignJwt(vulpesDtos.AuthDto{Payload: "{}", Algorithm: "HS256"}); err == nil {
		test.Fatalf("expected a missing secret to fail")
	}
}

func TestDigestAuthorizationMatchesRfc2617Example(test *testing.T) {
	challenge, found := FindDigestChallenge([]string{
		`Basic realm="other"`,
		`Digest realm="testrealm@host.com", qop="auth,auth-int", nonce="dcd98b7102dd2f0e8b11d0f600bfb0c093", opaque="5ccc069c403ebaf9f0171e9517f40e41"`,
	})
	if !found || challenge["realm"] != "testrealm@host.com" || challenge["qop"] != "auth,auth-int" {
		test.Fatalf("unexpected challenge: %+v found=%v", challenge, found)
	}

	authorization, err := DigestAuthorization(challenge, "GET", "/dir/index.html", "Mufasa", "Circle Of Life", "0a4f113b")
	if err != nil || !strings.Contains(authorization, `response="6629fae49393a05397450978507c4ef1"`) {
		test.Fatalf("unexpected digest authorization: %q, err=%v", authorization, err)
	}
	for _, expectedField := range []string{`qop=auth`, `nc=00000001`, `cnonce="0a4f113b"`, `opaque="5ccc069c403ebaf9f0171e9517f40e41"`, `algorithm=MD5`} {
		if !strings.Contains(authorization, expectedField) {
			test.Fatalf("expected %s in %q", expectedField, authorization)
		}
	}

	if _, err := DigestAuthorization(map[string]string{"algorithm": "SHA-512-256"}, "GET", "/", "user", "pass", "nonce"); err == nil {
		test.Fatalf("expected an unsupported algorithm to fail")
	}
}

func TestSignAwsV4MatchesGetVanillaVector(test *testing.T) {
	request, _ := http.NewRequest(http.MethodGet, "https://example.amazonaws.com/", nil)
	signedAt := time.Date(2015, 8, 30, 12, 36, 0, 0, time.UTC)
	err := SignAwsV4(request, vulpesDtos.AuthDto{
		Region:    "us-east-1",
		Service:   "service",
		AccessKey: "AKIDEXAMPLE",
		SecretKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
	}, signedAt)
	expected := "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;x-amz-date, Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31"
	if err != nil || request.Header.Get("Authorization") != expected {
		test.Fatalf("unexpected AWS authorization: %q, err=%v", request.Header.Get("Authorization"), err)
	}
	if request.Header.Get("X-Amz-Date") != "20150830T123600Z" {
		test.Fatalf("unexpected X-Amz-Date: %q", request.Header.Get("X-Amz-Date"))
	}

	upload, _ := http.NewRequest(http.MethodPut, "https://bucket.s3.amazonaws.com/file.txt", strings.NewReader("hello"))
	if err := SignAwsV4(upload, vulpesDtos.AuthDto{Region: "us-east-1", Service: "s3", AccessKey: "a", SecretKey: "b", SessionToken: "session"}, signedAt); err != nil {
		test.Fatalf("unexpected error signing S3 request: %v", err)
	}
	if upload.Header.Get("X-Amz-Content-Sha256") != "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824" {
		test.Fatalf("unexpected payload hash: %q", upload.Header.Get("X-Amz-Content-Sha256"))
	}
	if !strings.Contains(upload.Header.Get("Authorization"), "SignedHeaders=host;x-amz-content-sha256;x-amz-date;x-amz-security-token,") {
		test.Fatalf("unexpected signed headers: %q", upload.Header.Get("Authorization"))
	}

	if err := SignAwsV4(request, vulpesDtos.AuthDto{AccessKey: "a", SecretKey: "b"}, signedAt); err == nil {
		test.Fatalf("expected a missing region to fail")
	}
}

func TestAwsCanonicalQuerySortsAndEncodes(test *testing.T) {
	request, _ := http.NewRequest(http.MethodGet, "https://example.amazonaws.com/?b=2&a=z&a=y&space=a%20b&tilde=~", nil)
	if canonical := awsCanonicalQuery(request.URL); canonical != "a=y&a=z&b=2&space=a%20b&tilde=~" {
		test.Fatalf("unexpected canonical query: %q", canonical)
	}
}

func TestNormalizeAuthDefaultsForNewMethods(test *testing.T) {
	oauth := vulpesDtos.AuthDto{Type: "OAuth2"}
	NormalizeAuth(&oauth, vulpesDtos.AuthNone)
	if oauth.Type != vulpesDtos.AuthOAuth2 || oauth.GrantType != vulpesDtos.GrantClientCredentials || oauth.ClientAuth != vulpesDtos.ClientAuthHeader {
		test.Fatalf("unexpected normalized OAuth 2.0: %+v", oauth)
	}
	jwt := vulpesDtos.AuthDto{Type: "jwt", Algorithm: "rs256"}
	NormalizeAuth(&jwt, vulpesDtos.AuthNone)
	if jwt.Algorithm != "HS256" {
		test.Fatalf("unexpected normalized JWT algorithm: %q", jwt.Algorithm)
	}
}

func newAuthMethodsFixtures() []vulpesDtos.AuthDto {
	oauth := vulpesDtos.AuthDto{Type: vulpesDtos.AuthOAuth2, Scope: "read", ClientId: "app", Username: "bob", Password: "pw", TokenUrl: "https://auth.dev/token", GrantType: vulpesDtos.GrantPassword, ClientAuth: vulpesDtos.ClientAuthBody, ClientSecret: "shh"}
	return []vulpesDtos.AuthDto{
		{Type: vulpesDtos.AuthDigest, Username: "alice", Password: "secret"},
		{Type: vulpesDtos.AuthAwsV4, Region: "sa-east-1", Service: "s3", AccessKey: "AK", SecretKey: "SK", SessionToken: "ST"},
		oauth,
	}
}

func TestNewAuthMethodsSurvivePostmanRoundTrip(test *testing.T) {
	importer := postmanImporter{warnings: newWarningCollector()}
	fixtures := append(newAuthMethodsFixtures(), vulpesDtos.AuthDto{Type: vulpesDtos.AuthJwt, Secret: "k", Payload: `{"sub":"1"}`, Algorithm: "HS384"})
	for _, original := range fixtures {
		encoded, _ := json.Marshal(exportAuth(original))
		if restored := importer.parseAuth(encoded, vulpesDtos.AuthNone); restored != original {
			test.Fatalf("Postman round trip changed %s auth:\nbefore: %+v\nafter:  %+v", original.Type, original, restored)
		}
	}
}

func TestNewAuthMethodsSurviveInsomniaRoundTrip(test *testing.T) {
	exporter := &insomniaExporter{warnings: newWarningCollector()}
	importer := &insomniaImporter{warnings: newWarningCollector()}
	for _, original := range newAuthMethodsFixtures() {
		encoded, _ := json.Marshal(exporter.authentication(original, nil))
		if restored := importer.parseAuth(encoded, ""); restored != original {
			test.Fatalf("Insomnia round trip changed %s auth:\nbefore: %+v\nafter:  %+v", original.Type, original, restored)
		}
	}
}
