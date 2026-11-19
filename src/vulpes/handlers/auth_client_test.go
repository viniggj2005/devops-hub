package vulpesHandlers

import (
	"fmt"
	"strings"
	"context"
	"testing"
	"net/http"
	"crypto/md5"
	"sync/atomic"
	"encoding/hex"
	"net/http/httptest"
	vulpesDtos "docker-manager-go/src/vulpes/dtos"
	vulpesFunctions "docker-manager-go/src/vulpes/functions"
)

func md5Hex(parts ...string) string {
	digest := md5.Sum([]byte(strings.Join(parts, ":")))
	return hex.EncodeToString(digest[:])
}

func sendWithAuth(test *testing.T, environment testEnvironment, method string, url string, body string, auth vulpesDtos.AuthDto) (*vulpesDtos.HttpResponseDto, error) {
	test.Helper()
	request := vulpesFunctions.NewRequest(vulpesDtos.ProtocolHttp)
	request.Auth = auth
	request.Http.Url = url
	request.Http.Method = method
	if body != "" {
		request.Http.Body = vulpesDtos.HttpBodyDto{Mode: vulpesDtos.BodyRaw, Raw: body, Language: "text"}
	}
	return environment.client.SendHttpRequest(context.Background(), environment.token, vulpesDtos.ExecutionInputDto{Request: request})
}

func TestDigestAuthRetriesWithChallenge(test *testing.T) {
	environment := setupVulpesTest(test)
	const nonce = "abc123"
	var receivedBodies []string
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		content := make([]byte, request.ContentLength)
		request.Body.Read(content)
		receivedBodies = append(receivedBodies, string(content))

		authorization := request.Header.Get("Authorization")
		if !strings.HasPrefix(authorization, "Digest ") {
			writer.Header().Set("WWW-Authenticate", fmt.Sprintf(`Digest realm="vulpes", qop="auth", nonce="%s", opaque="xyz"`, nonce))
			writer.WriteHeader(http.StatusUnauthorized)
			return
		}
		challenge, _ := vulpesFunctions.FindDigestChallenge([]string{authorization})
		firstHash := md5Hex("alice", "vulpes", "secret")
		secondHash := md5Hex(request.Method, challenge["uri"])
		expected := md5Hex(firstHash, nonce, challenge["nc"], challenge["cnonce"], challenge["qop"], secondHash)
		if challenge["response"] != expected || challenge["uri"] != "/protected?page=2" || challenge["opaque"] != "xyz" {
			writer.WriteHeader(http.StatusForbidden)
			return
		}
		writer.Write([]byte("welcome"))
	}))
	defer server.Close()

	response, err := sendWithAuth(test, environment, "POST", server.URL+"/protected?page=2", "payload", vulpesDtos.AuthDto{Type: vulpesDtos.AuthDigest, Username: "alice", Password: "secret"})
	if err != nil || response.StatusCode != http.StatusOK || response.Body != "welcome" {
		test.Fatalf("unexpected digest response: %+v, err=%v", response, err)
	}
	if len(receivedBodies) != 2 || receivedBodies[1] != "payload" {
		test.Fatalf("expected the body to be replayed on the authenticated retry, got %q", receivedBodies)
	}

	wrongPassword, err := sendWithAuth(test, environment, "GET", server.URL+"/protected?page=2", "", vulpesDtos.AuthDto{Type: vulpesDtos.AuthDigest, Username: "alice", Password: "wrong"})
	if err != nil || wrongPassword.StatusCode != http.StatusForbidden {
		test.Fatalf("expected wrong password to be rejected, got %+v, err=%v", wrongPassword, err)
	}
}

func TestOAuth2ClientCredentialsFetchesAndCachesToken(test *testing.T) {
	environment := setupVulpesTest(test)
	var tokenRequests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch request.URL.Path {
		case "/token":
			tokenRequests.Add(1)
			clientId, clientSecret, hasBasic := request.BasicAuth()
			request.ParseForm()
			if !hasBasic || clientId != "app" || clientSecret != "shh" || request.Form.Get("grant_type") != "client_credentials" || request.Form.Get("scope") != "read" {
				writer.WriteHeader(http.StatusBadRequest)
				writer.Write([]byte(`{"error":"invalid_client","error_description":"bad client"}`))
				return
			}
			writer.Header().Set("Content-Type", "application/json")
			writer.Write([]byte(`{"access_token":"issued-token","token_type":"Bearer","expires_in":3600}`))
		case "/resource":
			if request.Header.Get("Authorization") != "Bearer issued-token" {
				writer.WriteHeader(http.StatusUnauthorized)
				return
			}
			writer.Write([]byte("ok"))
		}
	}))
	defer server.Close()

	auth := vulpesDtos.AuthDto{Type: vulpesDtos.AuthOAuth2, TokenUrl: server.URL + "/token", ClientId: "app", ClientSecret: "shh", Scope: "read"}
	for attempt := 0; attempt < 2; attempt++ {
		response, err := sendWithAuth(test, environment, "GET", server.URL+"/resource", "", auth)
		if err != nil || response.StatusCode != http.StatusOK {
			test.Fatalf("unexpected OAuth 2.0 response on attempt %d: %+v, err=%v", attempt, response, err)
		}
	}
	if tokenRequests.Load() != 1 {
		test.Fatalf("expected the token to be cached, got %d token requests", tokenRequests.Load())
	}

	auth.ClientSecret = "wrong"
	if _, err := sendWithAuth(test, environment, "GET", server.URL+"/resource", "", auth); err == nil || !strings.Contains(err.Error(), "bad client") {
		test.Fatalf("expected the token endpoint error to surface, got %v", err)
	}
}

func TestOAuth2PasswordGrantSendsCredentialsInBody(test *testing.T) {
	environment := setupVulpesTest(test)
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path == "/token" {
			request.ParseForm()
			_, _, hasBasic := request.BasicAuth()
			form := request.PostForm
			if hasBasic || form.Get("grant_type") != "password" || form.Get("username") != "bob" || form.Get("password") != "pw" || form.Get("client_id") != "app" {
				writer.WriteHeader(http.StatusBadRequest)
				return
			}
			writer.Write([]byte("access_token=form-token&token_type=bearer"))
			return
		}
		writer.Write([]byte(request.Header.Get("Authorization")))
	}))
	defer server.Close()

	response, err := sendWithAuth(test, environment, "GET", server.URL+"/me", "", vulpesDtos.AuthDto{
		Type:       vulpesDtos.AuthOAuth2,
		Username:   "bob",
		Password:   "pw",
		TokenUrl:   server.URL + "/token",
		ClientId:   "app",
		GrantType:  vulpesDtos.GrantPassword,
		ClientAuth: vulpesDtos.ClientAuthBody,
	})
	if err != nil || response.Body != "Bearer form-token" {
		test.Fatalf("unexpected password grant response: %+v, err=%v", response, err)
	}
}

func TestJwtAuthSendsSignedBearerToken(test *testing.T) {
	environment := setupVulpesTest(test)
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Write([]byte(request.Header.Get("Authorization")))
	}))
	defer server.Close()

	auth := vulpesDtos.AuthDto{Type: vulpesDtos.AuthJwt, Secret: "k", Payload: `{"sub":"42"}`, Algorithm: "HS256"}
	expectedToken, _ := vulpesFunctions.SignJwt(auth)
	response, err := sendWithAuth(test, environment, "GET", server.URL, "", auth)
	if err != nil || response.Body != "Bearer "+expectedToken {
		test.Fatalf("unexpected JWT header: %+v, err=%v", response, err)
	}
}
